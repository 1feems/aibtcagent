import type {
  BeatRelevance,
  Confidence,
  EditorAnnotation,
  Recommendation,
  ScoreBreakdown,
  SubmittedSignal
} from "../types/index.js";

// ── Tier-1 source domains ─────────────────────────────────────────────────────

const TIER1_DOMAINS = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "api.github.com",
  "hiro.so",
  "api.hiro.so",
  "explorer.hiro.so",
  "status.hiro.so",
  "stacks.co",
  "stacks-node-api.mainnet.stacks.co",
  "api.mainnet.hiro.so",
  "relay.aibtc.dev",
  "sponsor.aibtc.dev"
]);

const TIER3_DOMAINS = new Set([
  "twitter.com",
  "x.com",
  "t.co",
  "discord.com",
  "discord.gg",
  "t.me",
  "reddit.com"
]);

// ── Scoring keyword sets ──────────────────────────────────────────────────────

const INFRA_OPERATIONAL_KEYWORDS = [
  "nonce", "nonce gap", "nonce-gap", "stuck", "relay", "sponsor", "circuit breaker",
  "health", "outage", "degraded", "incident", "recovery", "mempool", "fee escalat",
  "signer", "consensus", "epoch", "activation", "block time", "indexing", "deprecat",
  "breaking change", "endpoint", "api change", "contract deploy", "upgrade", "migration"
];

const SPECIFICITY_PATTERNS = [
  /\bv\d+[\d.]+\b/i,          // version numbers
  /\bpr\s*#?\d+\b/i,          // PR references
  /\b#\d{3,}\b/,              // issue/PR numbers
  /\bblock\s+\d{5,}\b/i,      // block heights
  /\b0x[0-9a-f]{10,}\b/i,     // tx hashes
  /\b20\d{2}-\d{2}-\d{2}\b/,  // dates
  /\b\d{4,}-\d{2}-\d{2}\b/,   // dates alt
  /commit\s+[0-9a-f]{7,}/i     // git commits
];

const PR_TITLE_BIAS_PATTERNS = [
  /^(feat|fix|chore|refactor|docs|ci|test|update|bump|add|remove|improve)(\(.+\))?:/i,
  /merged pull request #\d+/i,
  /^pr #?\d+\s*[-:]/i
];

const MAINNET_KEYWORDS = ["mainnet", "production"];
const TESTNET_KEYWORDS = ["testnet", "devnet", "sandbox", "staging"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function hasTier1Source(signal: SubmittedSignal): boolean {
  return signal.sources.some((s) => {
    const domain = extractDomain(s.url);
    return domain !== null && TIER1_DOMAINS.has(domain);
  });
}

function countTier3Only(signal: SubmittedSignal): number {
  return signal.sources.filter((s) => {
    const domain = extractDomain(s.url);
    return domain !== null && TIER3_DOMAINS.has(domain);
  }).length;
}

function hasGitHubSource(signal: SubmittedSignal): boolean {
  return signal.sources.some((s) => extractDomain(s.url) === "github.com");
}

function hasSpecificClaims(text: string): boolean {
  return SPECIFICITY_PATTERNS.some((re) => re.test(text));
}

function hasOperationalImpact(text: string): boolean {
  const lower = text.toLowerCase();
  return INFRA_OPERATIONAL_KEYWORDS.some((kw) => lower.includes(kw));
}

function isPrTitleBias(text: string): boolean {
  return PR_TITLE_BIAS_PATTERNS.some((re) => re.test(text.trim()));
}

function mentionsMergedNotDeployed(text: string): boolean {
  const lower = text.toLowerCase();
  return (lower.includes("merged") || lower.includes("pr merged")) &&
    !lower.includes("deployed") &&
    !lower.includes("release") &&
    !lower.includes("shipped");
}

function claimsMainnet(text: string): boolean {
  const lower = text.toLowerCase();
  return MAINNET_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function onlyTestnet(text: string): boolean {
  const lower = text.toLowerCase();
  return TESTNET_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase())) &&
    !MAINNET_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function classifyBeatRelevance(signal: SubmittedSignal): BeatRelevance {
  const combined = `${signal.headline} ${signal.analysis}`.toLowerCase();

  const CORE_KEYWORDS = [
    "mcp server", "sponsor relay", "nonce", "hiro api", "stacks mainnet",
    "aibtcdev", "contract deploy", "contract upgrade", "relay health",
    "epoch activation", "signer version", "block time", "mempool",
    "circuit breaker", "relay incident", "infrastructure",
    "deprecat", "endpoint", "hiro", "stacks-blockchain-api",
    "/extended/", "api change", "release tag", "agent-news", "aibtc-mcp",
    "stacks node", "stacks signer", "indexing", "block production"
  ];

  const OFF_BEAT_KEYWORDS = [
    "price action", "market cap", "trading volume", "governance vote",
    "token launch", "airdrop", "nft mint", "defi yield", "swap",
    "staking reward", "community announcement", "tutorial", "roadmap",
    "speculation", "testnet only", "agent skill", "vulnerability analysis"
  ];

  const coreScore = CORE_KEYWORDS.filter((kw) => combined.includes(kw)).length;
  const offScore = OFF_BEAT_KEYWORDS.filter((kw) => combined.includes(kw)).length;

  if (offScore > 0 && coreScore === 0) return "off-beat";
  if (coreScore >= 2) return "core";
  if (coreScore === 1) return "tangential";
  // Default to tangential when no signals either way — avoid false off-beat rejections
  return "tangential";
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreVerification(signal: SubmittedSignal): {
  score: number;
  verified: string[];
  flagged: string[];
  sources_checked: string[];
} {
  const combined = `${signal.headline} ${signal.analysis}`;
  const verified: string[] = [];
  const flagged: string[] = [];
  const sources_checked: string[] = signal.sources.map((s) => s.url).filter(Boolean);

  let score = 0;

  if (hasTier1Source(signal)) {
    score += 20;
    verified.push("Tier 1 source present");
  } else {
    flagged.push("No Tier 1 source found (GitHub, Hiro, relay endpoint)");
  }

  if (hasSpecificClaims(combined)) {
    score += 12;
    verified.push("Signal contains specific claims (version, PR ref, block height, or date)");
  } else {
    flagged.push("No specific identifiers found (version number, PR #, block height, date)");
  }

  if (hasGitHubSource(signal)) {
    verified.push("GitHub source linked");
    // Check for PR title bias
    if (isPrTitleBias(signal.analysis) || isPrTitleBias(signal.headline)) {
      score += 4;
      flagged.push("pr_title_bias: headline or analysis matches PR commit prefix pattern — verify diff behavior, not just title");
    } else {
      score += 8;
    }
  }

  if (mentionsMergedNotDeployed(combined)) {
    flagged.push("unverified_deployment: signal references merged code but no deployment confirmation");
    score = Math.max(0, score - 5);
  }

  if (onlyTestnet(combined)) {
    flagged.push("testnet_only: claims reference testnet/devnet, not mainnet production");
    score = Math.max(0, score - 10);
  }

  return { score: Math.min(40, score), verified, flagged, sources_checked };
}

function scoreOperationalImpact(signal: SubmittedSignal): number {
  const combined = `${signal.headline} ${signal.analysis}`.toLowerCase();

  let score = 0;

  if (hasOperationalImpact(combined)) {
    score += 15;
  }

  // Agent-blocking language
  if (/agent[s]?\s+(should|must|need to|require|cannot|will|won't|break)/i.test(combined) ||
      /operator[s]?\s+(should|must|need to|require)/i.test(combined)) {
    score += 10;
  }

  // Scope specificity
  if (/(all agents|all operators|every agent|any agent using)/i.test(combined)) {
    score += 5;
  } else if (/(agents that use|operators running|dependent on|impacted when)/i.test(combined)) {
    score += 3;
  }

  return Math.min(30, score);
}

function scoreSourceQuality(signal: SubmittedSignal): number {
  if (signal.sources.length === 0) return 0;

  let score = 0;
  let tier1Count = 0;
  let tier3Count = 0;

  for (const s of signal.sources) {
    const domain = extractDomain(s.url);
    if (!domain) continue;
    if (TIER1_DOMAINS.has(domain)) {
      tier1Count++;
      score += 8;
    } else if (TIER3_DOMAINS.has(domain)) {
      tier3Count++;
    } else {
      score += 3; // Tier 2
    }
  }

  // Bonus for multiple Tier 1 sources
  if (tier1Count >= 2) score += 4;

  // Penalty for relying only on Tier 3
  if (tier3Count > 0 && tier1Count === 0) score = Math.max(0, score - 5);

  return Math.min(20, score);
}

function scoreClarityActionability(signal: SubmittedSignal): number {
  const combined = `${signal.headline} ${signal.analysis}`;
  let score = 0;

  // Clear what changed
  if (/(what changed|changed|deprecated|removed|added|updated|fixed|upgraded)/i.test(combined)) score += 3;

  // Whether it is live
  if (/(live|deployed|mainnet|production|active|shipped|released)/i.test(combined)) score += 3;

  // What action follows
  if (/(agents should|operators should|action required|update to|migrate|patch)/i.test(combined)) score += 4;

  return Math.min(10, score);
}

function applyScoreCaps(
  raw: number,
  signal: SubmittedSignal,
  beatRelevance: BeatRelevance,
  flagged: string[]
): { capped: number; capReasons: string[] } {
  let score = raw;
  const capReasons: string[] = [];

  if (!hasTier1Source(signal)) {
    if (score > 60) { score = 60; capReasons.push("cap:no_tier1_source (max 60)"); }
  }

  const combined = `${signal.headline} ${signal.analysis}`;
  if (mentionsMergedNotDeployed(combined)) {
    if (score > 75) { score = 75; capReasons.push("cap:unverified_deployment (max 75)"); }
  }

  if (beatRelevance === "off-beat") {
    if (score > 55) { score = 55; capReasons.push("cap:off_beat (max 55)"); }
  }

  const decorativeSourceFlagged = flagged.some((f) => f.includes("decorative"));
  if (decorativeSourceFlagged) {
    score = Math.max(0, score - 10);
    capReasons.push("penalty:decorative_sources (-10)");
  }

  if (countTier3Only(signal) > 0 && !hasTier1Source(signal)) {
    score = Math.max(0, score - 10);
    capReasons.push("penalty:tier3_as_sole_verification (-10)");
  }

  return { capped: score, capReasons };
}

// ── Recommendation ────────────────────────────────────────────────────────────

function deriveRecommendation(
  score: number,
  beatRelevance: BeatRelevance,
  flagged: string[]
): Recommendation {
  if (beatRelevance === "off-beat") return "reject";

  const hasNoTier1 = flagged.some((f) => f.includes("No Tier 1 source"));
  const hasPrTitleBias = flagged.some((f) => f.includes("pr_title_bias"));
  const hasTestnetOnly = flagged.some((f) => f.includes("testnet_only"));

  if (hasNoTier1 && score < 50) return "reject";
  if (hasTestnetOnly) return "reject";
  if (hasPrTitleBias && score < 60) return "reject";

  if (score >= 80) return "approve";
  if (score >= 55) return "revise";
  return "reject";
}

function deriveConfidence(score: number, flagged: string[]): Confidence {
  if (flagged.length === 0 && score >= 75) return "high";
  if (flagged.length <= 1 && score >= 55) return "medium";
  return "low";
}

function buildFeedback(
  flagged: string[],
  beatRelevance: BeatRelevance,
  recommendation: Recommendation
): string | null {
  const lines: string[] = [];

  if (beatRelevance === "off-beat") {
    lines.push("Signal does not fall within the infrastructure beat scope. See beat-guide for coverage definition.");
  }

  for (const flag of flagged) {
    if (flag.includes("No Tier 1 source")) {
      lines.push("Add a Tier 1 source (GitHub PR/release, Hiro API endpoint, relay health URL) that resolves to the exact claim.");
    } else if (flag.includes("pr_title_bias")) {
      lines.push("PR title alone is not verification. Confirm the claimed behavior appears in the diff, release notes, or deployed code — not just the PR title.");
    } else if (flag.includes("unverified_deployment")) {
      lines.push("Clarify deployment status: is this merged code, a published release, or confirmed live on production?");
    } else if (flag.includes("testnet_only")) {
      lines.push("Infrastructure beat covers mainnet/production only. Resubmit when the change is confirmed on mainnet.");
    } else if (flag.includes("No specific identifiers")) {
      lines.push("Add specific identifiers: version number, PR #, block height, incident window, or date to make the claim verifiable.");
    }
  }

  if (lines.length === 0 && recommendation === "revise") {
    lines.push("Signal is directionally correct. Strengthen with deployment confirmation and Tier 1 source that resolves to the exact claim.");
  }

  return lines.length > 0 ? lines.join(" ") : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function reviewSignal(signal: SubmittedSignal, now: string): EditorAnnotation {
  const beatRelevance = classifyBeatRelevance(signal);

  const {
    score: verificationRaw,
    verified,
    flagged,
    sources_checked
  } = scoreVerification(signal);

  const operationalImpact = scoreOperationalImpact(signal);
  const sourceQuality = scoreSourceQuality(signal);
  const clarityActionability = scoreClarityActionability(signal);

  const breakdown: ScoreBreakdown = {
    verification: verificationRaw,
    operationalImpact,
    sourceQuality,
    clarityActionability
  };

  const rawScore = verificationRaw + operationalImpact + sourceQuality + clarityActionability;
  const { capped: score, capReasons } = applyScoreCaps(rawScore, signal, beatRelevance, flagged);

  const allFlagged = [...flagged, ...capReasons];
  const recommendation = deriveRecommendation(score, beatRelevance, allFlagged);
  const confidence = deriveConfidence(score, allFlagged);
  const feedback = buildFeedback(allFlagged, beatRelevance, recommendation);

  const editSuggestions =
    recommendation === "revise" && verified.length > 0
      ? `Verified: ${verified.slice(0, 2).join("; ")}. Add: ${flagged.slice(0, 2).join("; ")}.`
      : null;

  return {
    signal_id: signal.id,
    correspondent: signal.correspondent,
    score,
    scoreBreakdown: breakdown,
    factcheck: { verified, flagged: allFlagged, sources_checked },
    edit_suggestions: editSuggestions,
    beat_relevance: beatRelevance,
    recommendation,
    confidence,
    feedback_for_correspondent: feedback,
    annotatedAt: now
  };
}

export function reviewSignals(signals: SubmittedSignal[], now: string): EditorAnnotation[] {
  return signals.map((s) => reviewSignal(s, now));
}
