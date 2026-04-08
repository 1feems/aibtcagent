// P28 — Brief-win signal shape gate
// Enforces three mandatory attributes on every candidate before queue.
// Failures demote to secondary queue rather than hard-blocking (unlike editorial gates).

// ── Checks ────────────────────────────────────────────────────────────────────

/**
 * Check 1: Explicit operator consequence
 * "What changes for agents now" must be stated, not implied.
 */
function hasExplicitOperatorConsequence(headline: string, analysis: string): boolean {
  const combined = `${headline} ${analysis}`.toLowerCase();
  return [
    "agents should", "operators should", "agents must", "operators must",
    "what this means", "this means", "agent consequence", "operators need",
    "for agents,", "for operators,", "agents running", "agents using",
    "this enables agents", "this allows agents", "this breaks", "this requires",
    "implication:", "action required", "agents will need", "operators will need"
  ].some((p) => combined.includes(p));
}

/**
 * Check 2: Exact number in the first two sentences
 * A verifiable quantity must appear early in the signal.
 */
function hasExactNumberInFirstTwoSentences(analysis: string): boolean {
  const firstTwo = analysis.trim().split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  return /\$[\d,.]+|\b\d[\d,.]*\s*(?:%|BTC|STX|sBTC|sats?|sat\/vB|EH\/s|ZH\/s|wallets?|agents?|txs?|blocks?|M\b|B\b|T\b|v\d)|\bblock\s+\d[\d,]*\b|\bpr\s*#\d+\b|\bv\d+\.\d[\d.]*\b/i.test(firstTwo);
}

/**
 * Check 3: Displacement framing
 * Signal must include a reason why it belongs in the brief over existing coverage.
 * Either comparative language OR "first/only/unique" framing.
 */
function hasDisplacementFraming(headline: string, analysis: string): boolean {
  const combined = `${headline} ${analysis}`.toLowerCase();
  return [
    "unlike", "first time", "first agent", "only agent", "unique to",
    "no other", "ahead of", "before other", "before any other",
    "stronger than", "replaces", "supersedes", "overrides",
    "breaks existing", "changes existing", "contradicts",
    "while others", "competitors have not", "not yet covered",
    "displacement:", "why this beats"
  ].some((p) => combined.includes(p));
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BriefWinGateResult {
  pass: boolean;
  checks: {
    operatorConsequence: boolean;
    exactNumber: boolean;
    displacementFraming: boolean;
  };
  missingAttributes: string[];
  demotionReason: string | null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function checkBriefWinShape(headline: string, analysis: string): BriefWinGateResult {
  const operatorConsequence = hasExplicitOperatorConsequence(headline, analysis);
  const exactNumber = hasExactNumberInFirstTwoSentences(analysis);
  const displacementFraming = hasDisplacementFraming(headline, analysis);

  const missing: string[] = [];
  if (!operatorConsequence) missing.push("explicit_operator_consequence: add 'agents should' / 'operators should' / 'this means' statement");
  if (!exactNumber) missing.push("exact_number_in_opening: add a verifiable quantity (block height, version, sat amount, %) in the first two sentences");
  if (!displacementFraming) missing.push("displacement_framing: add 'unlike', 'first time', 'only', or a direct reason why this beats existing beat coverage");

  const pass = missing.length === 0;
  const demotionReason = pass
    ? null
    : `brief_win_gate: missing ${missing.length}/3 attribute(s) — ${missing.map((m) => m.split(":")[0]).join(", ")} — demoted to secondary queue`;

  return {
    pass,
    checks: { operatorConsequence, exactNumber, displacementFraming },
    missingAttributes: missing,
    demotionReason
  };
}

export function formatBriefWinGateSection(result: BriefWinGateResult): string[] {
  const lines: string[] = [
    `  - \`Brief-win shape\`: ${result.pass ? "pass" : "demoted"}`,
    `    - operator_consequence: ${result.checks.operatorConsequence ? "✓" : "✗"}`,
    `    - exact_number_in_opening: ${result.checks.exactNumber ? "✓" : "✗"}`,
    `    - displacement_framing: ${result.checks.displacementFraming ? "✓" : "✗"}`
  ];
  if (!result.pass) {
    lines.push(`    - reason: ${result.demotionReason ?? "missing attributes"}`);
  }
  return lines;
}
