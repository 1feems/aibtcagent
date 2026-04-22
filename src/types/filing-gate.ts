// ── Filing gate schema ────────────────────────────────────────────────────────
//
// Every source artifact that enters the filing pipeline MUST carry a
// `filing_gate` block.  The block is the proof that the composing agent (or
// model) explicitly ran each Q1–Q4 check and recorded the outcome before the
// signal was treated as a filing candidate.
//
// Without this block the pipeline treats the signal as a "draft" and
// hard-blocks it from the queue, the approval step, and the ready-artifact.
// A model cannot slide a well-formatted canonical payload through as if it
// were validated — it must also prove the gate.

export type GateCheckResult = "pass" | "fail";

/**
 * A single winner-pattern sub-check inside the `winnerCheck` block.
 *
 * `result`    — the required outcome string for this check (varies per sub-check).
 * `rationale` — non-trivial explanation proving the check was actually run;
 *               must reference specific data from the consulted source, e.g. a
 *               brief title, a filing headline, a named losing-pattern label.
 */
export interface WinnerPatternSubCheck {
  result: string;
  rationale: string;
}

/**
 * Winner-pattern evidence block.
 *
 * Records proof that the composing agent explicitly consulted each required
 * data source and compared the candidate against real winners, losers, and
 * existing filings before treating it as filing-ready.
 *
 * All seven sub-checks must be present and passing:
 *
 * `sharedContext`   — tested against data/briefs/shared-context.json;
 *                     result must be "pass"; rationale must name the source.
 * `briefExamples`   — tested against data/training/brief-examples.json;
 *                     result must be "pass"; rationale must name the source.
 * `signalHistory`   — tested against data/state/signal-history.json;
 *                     result must be "pass"; rationale must name the source.
 * `duplicateCheck`  — story shape not already filed or rejected;
 *                     result must be "no_duplicate".
 * `losingPattern`   — does not match a known own-history losing pattern;
 *                     result must be "no_match".
 * `winnerPattern`   — matches concrete winner patterns from recent briefs;
 *                     result must be "matches"; rationale must cite a specific
 *                     winning headline or winner-pattern shape.
 * `framingStrength` — framing is at least as strong as same-beat winners;
 *                     result must be "pass"; rationale must name a winner
 *                     headline for the same beat that this signal is comparable to.
 */
export interface WinnerPatternCheck {
  sharedContext: WinnerPatternSubCheck;
  briefExamples: WinnerPatternSubCheck;
  signalHistory: WinnerPatternSubCheck;
  duplicateCheck: WinnerPatternSubCheck;
  losingPattern: WinnerPatternSubCheck;
  winnerPattern: WinnerPatternSubCheck;
  framingStrength: WinnerPatternSubCheck;
}

export interface ContextAuditCheck {
  result: "pass" | "not_available";
  rationale: string;
  contextLoaded: boolean;
  complianceVerified: boolean;
}

export interface ContextAudit {
  briefReview: ContextAuditCheck;
  beatEditorReview: ContextAuditCheck;
  helperErrorsReview: ContextAuditCheck;
  outcomeReview: ContextAuditCheck;
  publisherNotesReview: ContextAuditCheck;
}

/**
 * A single Q1–Q4 gate check.
 *
 * `result`    — the explicit outcome; must be "pass" for a filing-ready signal.
 * `rationale` — non-empty string explaining WHY the check passed (or failed).
 *               Generic phrases ("looks good", "yes") are not accepted by the
 *               validator — rationale must reference concrete content from the
 *               signal (headline text, source URL, disclosure wording, etc.).
 * `testedAt`  — ISO-8601 UTC datetime recording when the check was performed.
 */
export interface FilingGateCheck {
  result: GateCheckResult;
  rationale: string;
  testedAt: string;
}

/**
 * The four structured template fields that every signal body must resolve to.
 *
 * These are extracted from the analysis text and recorded explicitly so the
 * pipeline can verify the template was applied, not just approximated.
 *
 * `claim`      — the exact, falsifiable assertion (one sentence).
 * `evidence`   — the data or on-chain proof that backs the claim.
 * `implication`— what this event means for agents / operators / the network.
 * `directive`  — the specific action agents should take in response.
 */
export interface FilingGateTemplate {
  claim: string;
  evidence: string;
  implication: string;
  directive: string;
}

/**
 * Top-level filing gate evidence block.
 *
 * Must be present as `filing_gate` on the source artifact JSON before any
 * pipeline stage will treat the signal as filing-ready.
 *
 * `reportDate`    — YYYY-MM-DD the signal is filed for.
 * `beat`          — the beat slug (must match canonical beat_slug).
 * `headline`      — the exact headline as written (cross-checked against
 *                   the canonical headline at validation time).
 * `templateUsed`  — the name/version of the signal template applied, e.g.
 *                   "general-news-v1", "deal-flow-v1", "infrastructure-v1".
 * `template`      — the four structured template fields extracted from the
 *                   analysis body.
 * `q1`            — Q1: Mission alignment.  The signal must show AI-native
 *                   actors (agents, operators, correspondents) using, earning,
 *                   transacting with, or governing Bitcoin / sBTC / Stacks.
 * `q2`            — Q2: Replicable disclosure.  The disclosure must name the
 *                   specific model, tool, endpoint, URL, PR #, issue #, or
 *                   release used — no vague "used AI / my analysis" phrasing.
 * `q3`            — Q3: Inscribable.  The signal must describe a durable
 *                   development (not speculative, rumored, or baseline-only).
 * `q4`            — Q4: Value-creating.  The signal must land a measurable
 *                   consequence for operators, payouts, routing, settlement,
 *                   identity, or security — not just awareness.
 * `testedAgainst` — free-text description of what context was consulted when
 *                   running the gate, e.g. "2026-04-07 brief, filed-signals.json,
 *                   prior 2-day brief window".  Must be non-empty.
 * `winnerCheck`   — seven-sub-check winner-pattern evidence block; proves the
 *                   signal was compared against real brief winners, losers, and
 *                   existing filings before being promoted to filing-ready.
 */
export interface FilingGate {
  reportDate: string;
  beat: string;
  headline: string;
  templateUsed: string;
  template: FilingGateTemplate;
  q1: FilingGateCheck;
  q2: FilingGateCheck;
  q3: FilingGateCheck;
  q4: FilingGateCheck;
  testedAgainst: string;
  winnerCheck: WinnerPatternCheck;
  contextAudit: ContextAudit;
}
