// ── Filing gate validator ─────────────────────────────────────────────────────
//
// Verifies that a source artifact carries a complete, passing `filing_gate`
// block before any pipeline stage promotes it to "filing-ready".
//
// A signal that passes canonical payload validation (headline + analysis +
// sources + disclosure) but lacks a `filing_gate` is a DRAFT, not a candidate.
// The validator makes that distinction machine-checkable.

import type { FilingGate, FilingGateCheck, FilingGateTemplate, WinnerPatternCheck, WinnerPatternSubCheck } from "../types/filing-gate.js";

export interface FilingGateIssue {
  code: string;
  field: string;
  reason: string;
}

export interface FilingGateValidationResult {
  gate: FilingGate | null;
  issues: FilingGateIssue[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isIso8601Utc(value: string): boolean {
  if (!value) return false;
  if (!Number.isFinite(Date.parse(value))) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/i.test(value);
}

// Rationale must be non-trivial: at least 12 characters and not just "yes",
// "pass", "ok", "looks good", or other single-word/generic filler.
const TRIVIAL_RATIONALE_PATTERN = /^(?:yes|no|pass|fail|ok|n\/a|good|done|fine|checked|verified|confirmed)\.?$/i;

function isSubstantiveRationale(value: string): boolean {
  if (value.length < 12) return false;
  return !TRIVIAL_RATIONALE_PATTERN.test(value);
}

// ── headline anchor helpers ───────────────────────────────────────────────────

function extractStoryAnchors(text: string): string[] {
  return [...new Set([
    ...text.matchAll(/\bissue\s+#\d+\b/gi),
    ...text.matchAll(/\bpr\s+#\d+\b/gi),
    ...text.matchAll(/\bcve-\d{4}-\d+\b/gi),
    ...text.matchAll(/\bv\d+\.\d+(?:\.\d+)*(?:\.\d+)?\b/gi)
  ].map((m) => m[0].toLowerCase()))];
}

function extractMetricAnchors(text: string): string[] {
  return [...new Set([
    ...text.matchAll(/\$\d[\d,]*(?:\.\d+)?/g),
    ...text.matchAll(/\b\d+(?:\.\d+)?%/g),
    ...text.matchAll(/\b\d+\s*(?:hours?|days?|cycles?|agents?|signals?|slots?)\b/gi),
    ...text.matchAll(/\b\d{2,}\s*sats?\b/gi)
  ].map((m) => m[0].toLowerCase()))];
}

function hasExactHeadlineAnchor(headline: string): boolean {
  return (
    extractStoryAnchors(headline).length > 0 ||
    extractMetricAnchors(headline).length > 0 ||
    /`[^`]+`/.test(headline) ||
    /\b(?:err\s+[a-z0-9_]+|error\s+[a-z0-9_]+)\b/i.test(headline) ||
    /\b(?:post|get|put|patch|delete)\s+\/[a-z0-9/_-]+\b/i.test(headline)
  );
}

// ── disallowed-state language ─────────────────────────────────────────────────
// Signals containing any of these patterns are not filing-ready.
// Pattern matches are whole-word (word boundaries) and case-insensitive so that
// "rough" blocks "rough draft" without blocking "roughness", "idea" blocks the
// standalone word without blocking "ideal", etc.
//
// Each entry is a [compiled RegExp, human-readable label] pair so issue messages
// name the matched term explicitly rather than dumping the full pattern.

const DISALLOWED_STATE_ENTRIES: ReadonlyArray<[RegExp, string]> = [
  [/\bbackup\b/i,        "backup"],
  [/\bplaceholder\b/i,   "placeholder"],
  [/\brough\b/i,         "rough"],
  [/\bidea\b/i,          "idea"],
  [/\bworking set\b/i,   "working set"],
  [/\bprobably\b/i,      "probably"],
  [/\bmaybe\b/i,         "maybe"],
  [/\bshould review\b/i, "should review"],
  [/\bdraft\b/i,         "draft"],
  [/\btodo\b/i,          "todo"],
  [/\bpossibly\b/i,      "possibly"],
  [/\bnot sure\b/i,      "not sure"],
  [/\bspeculative\b/i,   "speculative"],
];

function firstDriftMatch(text: string): string | null {
  for (const [pattern, label] of DISALLOWED_STATE_ENTRIES) {
    if (pattern.test(text)) return label;
  }
  return null;
}

function checkDriftLanguage(
  text: string,
  fieldPath: string,
  issues: FilingGateIssue[]
): void {
  const matched = firstDriftMatch(text);
  if (matched !== null) {
    issues.push({
      code: "gate_draft_language",
      field: fieldPath,
      reason: `${fieldPath} contains draft/speculative language ("${matched}") — filing-ready records must be final, not conversational; remove all placeholder, backup, and hedging terms before queuing`
    });
  }
}

// ── sources / disclosure helpers ─────────────────────────────────────────────

function readCanonicalSources(root: Record<string, unknown>): Array<{ url: string }> {
  const record = asRecord(root.sendPackage) ?? root;
  if (!Array.isArray(record.sources)) return [];
  return record.sources
    .map((entry) => {
      if (typeof entry === "string") return entry.trim() ? { url: entry.trim() } : null;
      const rec = asRecord(entry);
      if (!rec) return null;
      const url = readString(rec.url) || readString(rec.source_url);
      return url ? { url } : null;
    })
    .filter((entry): entry is { url: string } => Boolean(entry));
}

function readCanonicalDisclosure(root: Record<string, unknown>): string {
  const record = asRecord(root.sendPackage) ?? root;
  const direct = readString(record.disclosure);
  if (direct) return direct;
  const modelDisclosure = asRecord(record.model_disclosure);
  if (!modelDisclosure) return "";
  const tools = Array.isArray(modelDisclosure.tools_used)
    ? modelDisclosure.tools_used.map((e) => readString(e)).filter(Boolean)
    : [];
  const steps = Array.isArray(modelDisclosure.derivation_steps)
    ? modelDisclosure.derivation_steps.map((e) => readString(e)).filter(Boolean)
    : [];
  return [...tools, ...steps].join("; ").trim();
}

function readCanonicalAnalysis(root: Record<string, unknown>): string {
  const record = asRecord(root.sendPackage) ?? root;
  return readString(record.analysis);
}

const VAGUE_DISCLOSURE_PATTERNS = [
  "used ai", "my own analysis", "various sources", "internal data",
  "used llm", "ai generated", "model output", "my analysis"
];

function isVagueDisclosure(disclosure: string): boolean {
  const lower = disclosure.toLowerCase();
  return VAGUE_DISCLOSURE_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isConcreteDisclosure(disclosure: string): boolean {
  if (disclosure.trim().length < 24) return false;
  return (
    /\b(?:claude|gpt|grok|gemini|opus|sonnet|haiku)\b/i.test(disclosure) ||
    /\b(?:curl|rg|npm|node|bun|gh|api|endpoint|query|search)\b/i.test(disclosure) ||
    /\/api\/|https?:\/\/|github\.com|issue\s+#\d+|pr\s+#\d+|release/i.test(disclosure)
  );
}

// ── per-check validator ───────────────────────────────────────────────────────

function validateGateCheck(
  raw: unknown,
  qKey: "q1" | "q2" | "q3" | "q4",
  issues: FilingGateIssue[]
): FilingGateCheck | null {
  const field = `filing_gate.${qKey}`;

  const rec = asRecord(raw);
  if (!rec) {
    issues.push({
      code: `gate_${qKey}_missing`,
      field,
      reason: `${field} is required — the gate block must record an explicit Q${qKey[1]} check`
    });
    return null;
  }

  const result = readString(rec.result);
  const rationale = readString(rec.rationale);
  const testedAt = readString(rec.testedAt);
  let valid = true;

  if (result !== "pass" && result !== "fail") {
    issues.push({
      code: `gate_${qKey}_invalid_result`,
      field: `${field}.result`,
      reason: `${field}.result must be "pass" or "fail", got ${JSON.stringify(result || null)}`
    });
    valid = false;
  }

  if (!rationale) {
    issues.push({
      code: `gate_${qKey}_empty_rationale`,
      field: `${field}.rationale`,
      reason: `${field}.rationale must be a non-empty string explaining why the check passed or failed — a blank rationale proves nothing`
    });
    valid = false;
  } else if (!isSubstantiveRationale(rationale)) {
    issues.push({
      code: `gate_${qKey}_trivial_rationale`,
      field: `${field}.rationale`,
      reason: `${field}.rationale is too generic ("${rationale}"); cite specific content from the signal — the headline text, source URL, disclosure wording, or exact data point that satisfies the check`
    });
    valid = false;
  }

  if (!testedAt) {
    issues.push({
      code: `gate_${qKey}_missing_tested_at`,
      field: `${field}.testedAt`,
      reason: `${field}.testedAt is required (ISO-8601 UTC datetime)`
    });
    valid = false;
  } else if (!isIso8601Utc(testedAt)) {
    issues.push({
      code: `gate_${qKey}_invalid_tested_at`,
      field: `${field}.testedAt`,
      reason: `${field}.testedAt must be ISO-8601 UTC, e.g. "2026-04-07T14:30:00Z", got ${JSON.stringify(testedAt)}`
    });
    valid = false;
  }

  // A failed check is itself a hard-block — the signal is not filing-ready.
  if (result === "fail") {
    issues.push({
      code: `gate_${qKey}_failed`,
      field: `${field}.result`,
      reason: `${field}.result is "fail": ${rationale || "(no rationale)"} — fix the signal before re-running the gate`
    });
    valid = false;
  }

  if (!valid) return null;
  return { result: result as "pass" | "fail", rationale, testedAt };
}

// ── template validator ────────────────────────────────────────────────────────

// Template fields must be non-trivial prose, not one-word placeholders.
// The same threshold used for Q1–Q4 rationale applies here.
const TEMPLATE_MIN_LENGTH = 12;

function isSubstantiveTemplateField(value: string): boolean {
  if (value.length < TEMPLATE_MIN_LENGTH) return false;
  return !TRIVIAL_RATIONALE_PATTERN.test(value);
}

function validateGateTemplate(
  raw: unknown,
  issues: FilingGateIssue[]
): FilingGateTemplate | null {
  const field = "filing_gate.template";

  // Reject a freeform string used in place of the structured template object.
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      issues.push({
        code: "gate_template_freeform",
        field,
        reason: `${field} is a freeform string ("${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}") — it must be a structured object with explicit claim, evidence, implication, and directive fields; a loose prose note cannot stand in for the editorial template`
      });
    } else {
      issues.push({
        code: "gate_template_missing",
        field,
        reason: `${field} is required and must contain claim, evidence, implication, and directive — these fields prove the template was applied, not just approximated`
      });
    }
    return null;
  }

  const rec = asRecord(raw);
  if (!rec) {
    issues.push({
      code: "gate_template_missing",
      field,
      reason: `${field} is required and must contain claim, evidence, implication, and directive — these fields prove the template was applied, not just approximated`
    });
    return null;
  }

  // Reject objects that carry only a loose freeform "note" key instead of the
  // four required structural fields.
  const hasNote = typeof rec.note === "string" && (rec.note as string).trim().length > 0;
  const hasStructuredFields = rec.claim !== undefined || rec.evidence !== undefined ||
    rec.implication !== undefined || rec.directive !== undefined;
  if (hasNote && !hasStructuredFields) {
    issues.push({
      code: "gate_template_note_not_structured",
      field,
      reason: `${field} contains only a freeform "note" key — the template object must have claim, evidence, implication, and directive fields; restructure the note into those four required fields before filing`
    });
    return null;
  }

  const claim = readString(rec.claim);
  const evidence = readString(rec.evidence);
  const implication = readString(rec.implication);
  const directive = readString(rec.directive);
  let valid = true;

  if (!claim) {
    issues.push({ code: "gate_template_missing_claim", field: `${field}.claim`, reason: `${field}.claim is required — state the falsifiable assertion in one sentence` });
    valid = false;
  } else if (!isSubstantiveTemplateField(claim)) {
    issues.push({ code: "gate_template_trivial_claim", field: `${field}.claim`, reason: `${field}.claim is too brief or generic ("${claim}") — state the falsifiable assertion in a complete sentence with a concrete subject and predicate` });
    valid = false;
  }

  if (!evidence) {
    issues.push({ code: "gate_template_missing_evidence", field: `${field}.evidence`, reason: `${field}.evidence is required — name the on-chain data, query result, or primary source that proves the claim` });
    valid = false;
  } else if (!isSubstantiveTemplateField(evidence)) {
    issues.push({ code: "gate_template_trivial_evidence", field: `${field}.evidence`, reason: `${field}.evidence is too brief ("${evidence}") — name the specific on-chain data point, API response, or source URL that proves the claim` });
    valid = false;
  }

  if (!implication) {
    issues.push({ code: "gate_template_missing_implication", field: `${field}.implication`, reason: `${field}.implication is required — explain what this means for agents, operators, or the network` });
    valid = false;
  } else if (!isSubstantiveTemplateField(implication)) {
    issues.push({ code: "gate_template_trivial_implication", field: `${field}.implication`, reason: `${field}.implication is too brief ("${implication}") — explain what this event means for agents, operators, or the network in a complete sentence` });
    valid = false;
  }

  if (!directive) {
    issues.push({ code: "gate_template_missing_directive", field: `${field}.directive`, reason: `${field}.directive is required — give the specific action agents should take` });
    valid = false;
  } else if (!isSubstantiveTemplateField(directive)) {
    issues.push({ code: "gate_template_trivial_directive", field: `${field}.directive`, reason: `${field}.directive is too brief ("${directive}") — give the specific action (update, pause, verify, monitor, migrate) with the target contract, endpoint, or parameter` });
    valid = false;
  }

  if (!valid) return null;
  return { claim, evidence, implication, directive };
}

// ── winner-pattern checks ─────────────────────────────────────────────────────

// Each sub-check has a required pass value and a hint keyword set.
// The rationale must contain at least one of the hint keywords so the model
// proves it actually looked at the named source, not just asserted "checked".
const WINNER_SUB_CHECK_DEFS = {
  sharedContext: {
    expectedResult: "pass",
    errorCode: "gate_winner_shared_context",
    failBlockReason: "result is not \"pass\"",
    rationalHints: ["shared-context", "shared context", "brieftitle", "brief title"],
    rationale: [
      "filing_gate.winnerCheck.sharedContext must be tested against data/briefs/shared-context.json",
      "rationale must name a title or beat from shared-context.json that was consulted"
    ]
  },
  briefExamples: {
    expectedResult: "pass",
    errorCode: "gate_winner_brief_examples",
    failBlockReason: "result is not \"pass\"",
    rationalHints: ["brief-examples", "brief examples", "brief example"],
    rationale: [
      "filing_gate.winnerCheck.briefExamples must be tested against data/training/brief-examples.json",
      "rationale must reference a specific example title or body from brief-examples.json"
    ]
  },
  signalHistory: {
    expectedResult: "pass",
    errorCode: "gate_winner_signal_history",
    failBlockReason: "result is not \"pass\"",
    rationalHints: ["signal-history", "signal history", "filed-signal", "filed signal", "signal_history"],
    rationale: [
      "filing_gate.winnerCheck.signalHistory must be tested against data/state/signal-history.json",
      "rationale must confirm no matching prior headline was found in signal history"
    ]
  },
  duplicateCheck: {
    expectedResult: "no_duplicate",
    errorCode: "gate_winner_duplicate_check",
    failBlockReason: "result is \"duplicate_found\" — this story shape is already filed or rejected; do not resubmit without a materially different angle",
    rationalHints: null,
    rationale: [
      "filing_gate.winnerCheck.duplicateCheck must confirm the story shape has not already been filed or rejected",
      "rationale must name what was compared (e.g. headline keywords checked against filed-signals.json and signal-history.json)"
    ]
  },
  losingPattern: {
    expectedResult: "no_match",
    errorCode: "gate_winner_losing_pattern",
    failBlockReason: "result is \"match_found\" — this signal matches a known losing pattern; reshape or discard",
    rationalHints: null,
    rationale: [
      "filing_gate.winnerCheck.losingPattern must confirm the signal does not match a known own-history losing pattern",
      "rationale must name the losing patterns checked (e.g. beat_cap, approved_not_in_brief, too_narrow, external_news_no_aibtc_angle)"
    ]
  },
  winnerPattern: {
    expectedResult: "matches",
    errorCode: "gate_winner_pattern_match",
    failBlockReason: "result is \"no_match\" — the signal does not fit any concrete winner pattern from recent briefs; revise framing before filing",
    rationalHints: null,
    rationale: [
      "filing_gate.winnerCheck.winnerPattern must confirm the signal matches a concrete winner pattern from recent briefs",
      "rationale must cite a specific winning headline or winner-pattern shape from shared-context.json or brief-examples.json"
    ]
  },
  framingStrength: {
    expectedResult: "pass",
    errorCode: "gate_winner_framing_strength",
    failBlockReason: "result is \"fail\" — framing is weaker than same-beat winners; strengthen the headline, metric, or consequence before filing",
    rationalHints: null,
    rationale: [
      "filing_gate.winnerCheck.framingStrength must confirm the framing is at least as strong as same-beat winners",
      "rationale must name a same-beat winner headline this signal is comparable to"
    ]
  }
} as const;

type WinnerSubKey = keyof typeof WINNER_SUB_CHECK_DEFS;

function validateWinnerSubCheck(
  raw: unknown,
  key: WinnerSubKey,
  issues: FilingGateIssue[]
): WinnerPatternSubCheck | null {
  const def = WINNER_SUB_CHECK_DEFS[key];
  const field = `filing_gate.winnerCheck.${key}`;

  const rec = asRecord(raw);
  if (!rec) {
    issues.push({
      code: `${def.errorCode}_missing`,
      field,
      reason: `${field} is required — ${def.rationale[0]}`
    });
    return null;
  }

  const result = readString(rec.result);
  const rationale = readString(rec.rationale);
  let valid = true;

  if (!rationale) {
    issues.push({
      code: `${def.errorCode}_empty_rationale`,
      field: `${field}.rationale`,
      reason: `${field}.rationale must be a non-empty string — ${def.rationale[1]}`
    });
    valid = false;
  } else if (!isSubstantiveRationale(rationale)) {
    issues.push({
      code: `${def.errorCode}_trivial_rationale`,
      field: `${field}.rationale`,
      reason: `${field}.rationale is too generic ("${rationale}"); ${def.rationale[1]}`
    });
    valid = false;
  } else if (def.rationalHints !== null) {
    // Source-proof checks: rationale must name the data source
    const lower = rationale.toLowerCase();
    const found = (def.rationalHints as readonly string[]).some((hint) => lower.includes(hint));
    if (!found) {
      issues.push({
        code: `${def.errorCode}_source_not_named`,
        field: `${field}.rationale`,
        reason: `${field}.rationale does not name the required data source; ${def.rationale[1]}`
      });
      valid = false;
    }
  }

  if (result !== def.expectedResult) {
    issues.push({
      code: `${def.errorCode}_failed`,
      field: `${field}.result`,
      reason: `${field}: ${def.failBlockReason} — fix the signal before re-running the gate`
    });
    valid = false;
  }

  if (!valid) return null;
  return { result, rationale };
}

function validateWinnerPatternCheck(
  raw: unknown,
  issues: FilingGateIssue[]
): WinnerPatternCheck | null {
  const field = "filing_gate.winnerCheck";

  const rec = asRecord(raw);
  if (!rec) {
    issues.push({
      code: "gate_winner_check_missing",
      field,
      reason: `${field} is required — every filing candidate must prove it was compared against shared-context.json, brief-examples.json, signal-history.json, and real winner/loser patterns before being treated as filing-ready; a signal that passes Q1–Q4 but was not tested against actual brief winners is not filing-ready`
    });
    return null;
  }

  const sharedContext  = validateWinnerSubCheck(rec.sharedContext,  "sharedContext",  issues);
  const briefExamples  = validateWinnerSubCheck(rec.briefExamples,  "briefExamples",  issues);
  const signalHistory  = validateWinnerSubCheck(rec.signalHistory,  "signalHistory",  issues);
  const duplicateCheck = validateWinnerSubCheck(rec.duplicateCheck, "duplicateCheck", issues);
  const losingPattern  = validateWinnerSubCheck(rec.losingPattern,  "losingPattern",  issues);
  const winnerPattern  = validateWinnerSubCheck(rec.winnerPattern,  "winnerPattern",  issues);
  const framingStrength = validateWinnerSubCheck(rec.framingStrength, "framingStrength", issues);

  if (!sharedContext || !briefExamples || !signalHistory || !duplicateCheck ||
      !losingPattern || !winnerPattern || !framingStrength) {
    return null;
  }

  return { sharedContext, briefExamples, signalHistory, duplicateCheck, losingPattern, winnerPattern, framingStrength };
}

// ── top-level validator ───────────────────────────────────────────────────────

/**
 * Validates that `sourceArtifact` carries a complete, passing `filing_gate`
 * block.
 *
 * Returns `{ gate, issues }`.
 *   - If `issues` is non-empty the artifact must be treated as a draft and
 *     hard-blocked from the filing queue and the approval step.
 *   - If `issues` is empty, `gate` is the fully typed FilingGate record.
 *
 * Additionally, callers that know the canonical headline (from
 * `parseCanonicalSignalPayload`) should compare it against `gate.headline`
 * to detect copy-paste mismatch.  That cross-check is not done here because
 * this module has no dependency on the canonical parser.
 */
export function validateFilingGate(sourceArtifact: unknown): FilingGateValidationResult {
  const root = asRecord(sourceArtifact);
  const issues: FilingGateIssue[] = [];

  if (!root) {
    issues.push({
      code: "gate_source_not_object",
      field: "filing_gate",
      reason: "Source artifact must be a JSON object"
    });
    return { gate: null, issues };
  }

  const gateRaw = root.filing_gate;

  // Missing gate block — the most common case when a model drafts a
  // canonical-looking payload without running the checklist.
  if (gateRaw === undefined || gateRaw === null) {
    issues.push({
      code: "gate_block_missing",
      field: "filing_gate",
      reason: 'Source artifact is missing the required "filing_gate" block — a canonical payload without explicit Q1–Q4 evidence is a draft, not a filing candidate; run the gate checklist and add the filing_gate block before queuing'
    });
    return { gate: null, issues };
  }

  const gateRecord = asRecord(gateRaw);
  if (!gateRecord) {
    issues.push({
      code: "gate_block_not_object",
      field: "filing_gate",
      reason: '"filing_gate" must be a JSON object'
    });
    return { gate: null, issues };
  }

  // ── scalar fields ──────────────────────────────────────────────────────────

  const reportDate = readString(gateRecord.reportDate);
  const beat = readString(gateRecord.beat);
  const headline = readString(gateRecord.headline);
  const templateUsed = readString(gateRecord.templateUsed);
  const testedAgainst = readString(gateRecord.testedAgainst);

  if (!reportDate) {
    issues.push({ code: "gate_missing_report_date", field: "filing_gate.reportDate", reason: "filing_gate.reportDate is required (YYYY-MM-DD)" });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    issues.push({ code: "gate_invalid_report_date", field: "filing_gate.reportDate", reason: `filing_gate.reportDate must be YYYY-MM-DD, got "${reportDate}"` });
  }

  if (!beat) {
    issues.push({ code: "gate_missing_beat", field: "filing_gate.beat", reason: "filing_gate.beat is required and must match the canonical beat_slug" });
  }

  if (!headline) {
    issues.push({ code: "gate_missing_headline", field: "filing_gate.headline", reason: "filing_gate.headline is required and must exactly match the signal headline" });
  } else {
    if (!hasExactHeadlineAnchor(headline)) {
      issues.push({
        code: "gate_headline_no_anchor",
        field: "filing_gate.headline",
        reason: `filing_gate.headline must embed an exact anchor — a PR#, issue#, version (v1.2.3), metric (42 agents), error code, or API path — that a reviewer can directly look up; got "${headline}"`
      });
    }
    checkDriftLanguage(headline, "filing_gate.headline", issues);
  }

  if (!templateUsed) {
    issues.push({ code: "gate_missing_template_used", field: "filing_gate.templateUsed", reason: 'filing_gate.templateUsed is required — name the template version applied, e.g. "general-news-v1", "deal-flow-v1"' });
  }

  if (!testedAgainst) {
    issues.push({
      code: "gate_missing_tested_against",
      field: "filing_gate.testedAgainst",
      reason: 'filing_gate.testedAgainst must describe what context was consulted when running the gate (e.g. "2026-04-07 brief, filed-signals.json, 2-day prior brief window") — an empty field means the gate was not actually run against live state'
    });
  }

  // ── template sub-object ────────────────────────────────────────────────────

  const template = validateGateTemplate(gateRecord.template, issues);

  // ── disallowed-state checks: template fields ──────────────────────────────
  if (template) {
    checkDriftLanguage(template.claim,       "filing_gate.template.claim",       issues);
    checkDriftLanguage(template.evidence,    "filing_gate.template.evidence",    issues);
    checkDriftLanguage(template.implication, "filing_gate.template.implication", issues);
    checkDriftLanguage(template.directive,   "filing_gate.template.directive",   issues);
  }

  // ── disallowed-state checks: canonical analysis body ─────────────────────
  const canonicalAnalysis = readCanonicalAnalysis(root);
  if (canonicalAnalysis) {
    checkDriftLanguage(canonicalAnalysis, "analysis", issues);
  }

  // ── Q1–Q4 checks ──────────────────────────────────────────────────────────

  const q1 = validateGateCheck(gateRecord.q1, "q1", issues);
  const q2 = validateGateCheck(gateRecord.q2, "q2", issues);
  const q3 = validateGateCheck(gateRecord.q3, "q3", issues);
  const q4 = validateGateCheck(gateRecord.q4, "q4", issues);

  // ── winner-pattern checks ─────────────────────────────────────────────────

  const winnerCheck = validateWinnerPatternCheck(gateRecord.winnerCheck, issues);

  // ── canonical payload: sources must be concrete ───────────────────────────
  // Read directly from the artifact so a gate block cannot pass while the
  // underlying payload has no verifiable sources.

  const canonicalSources = readCanonicalSources(root);

  if (canonicalSources.length === 0) {
    issues.push({
      code: "gate_sources_missing",
      field: "sources",
      reason: "Signal must include at least one source with a concrete URL — a signal with no sources cannot be independently verified"
    });
  } else {
    const vagueUrls = canonicalSources
      .filter((s) => !s.url.startsWith("http://") && !s.url.startsWith("https://"))
      .map((s) => JSON.stringify(s.url));
    if (vagueUrls.length > 0) {
      issues.push({
        code: "gate_sources_not_concrete",
        field: "sources",
        reason: `${vagueUrls.length} source(s) lack a concrete http/https URL — every source must be directly reachable; got: ${vagueUrls.join(", ")}`
      });
    }
  }

  // ── canonical payload: disclosure must be concrete ────────────────────────

  const canonicalDisclosure = readCanonicalDisclosure(root);

  if (!canonicalDisclosure) {
    issues.push({
      code: "gate_disclosure_missing",
      field: "disclosure",
      reason: "Signal disclosure is empty — name the model, tool, endpoint, or PR used to produce this signal"
    });
  } else if (isVagueDisclosure(canonicalDisclosure)) {
    issues.push({
      code: "gate_disclosure_vague",
      field: "disclosure",
      reason: `Signal disclosure contains generic phrasing ("${canonicalDisclosure.slice(0, 80)}") — name the specific model (e.g. claude-sonnet-4-6), tool, or endpoint used; phrases like "used AI" or "my analysis" are not accepted`
    });
  } else if (!isConcreteDisclosure(canonicalDisclosure)) {
    issues.push({
      code: "gate_disclosure_not_concrete",
      field: "disclosure",
      reason: `Signal disclosure does not reference a named model, tool, endpoint, URL, PR, or release ("${canonicalDisclosure.slice(0, 80)}") — a reviewer must be able to reproduce the derivation`
    });
  }

  if (issues.length > 0) {
    return { gate: null, issues };
  }

  return {
    gate: {
      reportDate,
      beat,
      headline,
      templateUsed,
      template: template!,
      q1: q1!,
      q2: q2!,
      q3: q3!,
      q4: q4!,
      testedAgainst,
      winnerCheck: winnerCheck!
    },
    issues: []
  };
}

/**
 * Converts FilingGateIssue[] into hard-block reason strings that match the
 * format used throughout the rest of the pre-submit audit pipeline.
 */
export function filingGateIssuesToBlockers(issues: FilingGateIssue[]): string[] {
  return issues.map(
    (issue) => `hard-blocked from signable queue because filing gate check failed [${issue.code}]: ${issue.reason}`
  );
}
