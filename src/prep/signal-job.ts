import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadBriefExamplesMemory,
  loadCompetitionMemory,
  loadEditorialMemory,
  loadObjectiveMemory,
  type CompetitionMemory,
  type EditorialMemory,
  type ObjectiveMemory,
  readRepairMemory,
  type BriefExamplesMemory,
  type RepairContract,
  verifyRepairContract
} from "../learning/index.js";
import { evaluateSignalGuard, type SignalGuardResult } from "../filing/signal-guard.js";
import { parseCanonicalSignalPayload } from "../filing/signal-contract.js";
import { readSignalHistory, type SignalHistoryEntry } from "../filing/signal-history.js";
import { validateArtifact } from "../filing/validate-artifact.js";
import {
  hasConcreteDisclosureAnchors,
  hasExactHeadlineAnchor,
  hasTemplateAnalysis,
  hasVagueDisclosure,
  tooManyTags
} from "../filing/template-rules.js";
import { checkBeatSaturation, formatSaturationWarning } from "../scoring/beat-saturation.js";
import { checkBriefWinShape, type BriefWinGateResult } from "../scoring/brief-win-gate.js";
import { assessEditorialCompetitiveness } from "../scoring/editorial-contract.js";
import { readDailyOptimizationSnapshot } from "../loop/optimization.js";
import { materializeGeneratedCandidates } from "./candidate-generator.js";

export interface SignalJobResult {
  outputPath: string;
  skipped: boolean;
  skipReason?: string;
}

interface SourceRef {
  url: string;
  title?: string;
}

interface ManualSubmission {
  kind?: string;
  fileable?: boolean;
  non_fileable?: boolean;
  status?: string;
  resubmission_for_signal_id?: string;
  beat_slug?: string;
  headline?: string;
  analysis?: string;
  candidate_signal?: {
    summary?: string;
    significance?: string;
    causality?: string;
    source_type?: string;
  };
  sources?: SourceRef[];
  tags?: string[];
  [key: string]: unknown;
}

interface RecentFiledSignal {
  beat: string | null;
  headline: string | null;
  filedAt: string | null;
}

interface ContextSnippet {
  source: string;
  text: string;
}

interface FiledSignalsState {
  filedSignals?: RecentFiledSignal[];
}

interface SharedBriefContextFile {
  dates?: Record<string, {
    briefTitles?: Array<{ title: string; beat?: string; snippet?: string }>;
    rejectedTitles?: Array<{ title: string; reason?: string }>;
    notes?: string[];
  }>;
}

interface DailyPrepHandoff {
  kind?: string;
  reportDate?: string;
  sharedBriefContext?: {
    recentWinningTitles?: string[];
    recentRejectedTitles?: string[];
    titleShapeLessons?: string[];
    rankingNotes?: string[];
  };
}

interface SignalJobContextReview {
  fileName: string;
  candidateId: string;
  headline: string;
  beat: string;
  accepted: boolean;
  preDraftAccepted: boolean;
  preDraftScore: number;
  reasons: string[];
}

interface CandidateReview {
  fileName: string;
  artifactPath: string;
  submission: ManualSubmission;
  accepted: boolean;
  preDraftAccepted: boolean;
  preDraftScore: number;
  reasons: string[];
  preDraftReasons: string[];
  guard: SignalGuardResult | null;
  briefWinGate: BriefWinGateResult | null;  // P28
  beatSaturation: string | null;             // P27 warning/block message
}

interface PreDraftPublisherFit {
  missionAligned: boolean;
  replicable: boolean;
  inscribable: boolean;
  valueCreating: boolean;
}

interface StructuralScreen {
  exactAnchor: boolean;
  directOperatorConsequence: boolean;
  claimEvidenceImplication: boolean;
  actionLineViable: boolean;
  displacementPotential: boolean;
}

interface BeatFocusState {
  primaryBeat: string | null;
  secondaryBeat: string | null;
  deprioritizedBeats: string[];
}

function isCanonicalCreateSignalArtifact(submission: ManualSubmission): boolean {
  const record = submission as Record<string, unknown>;
  return (
    record.kind === "create_signal_artifact" &&
    record.status === "in_queue" &&
    record.non_fileable !== true &&
    record.fileable !== false &&
    Boolean(record.filing_gate && typeof record.filing_gate === "object" && !Array.isArray(record.filing_gate))
  );
}

function getPriorDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function normalizeHeadline(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isLikelyCompleteHeadline(headline: string): boolean {
  const trimmed = headline.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;
  if (!/[a-z0-9)]$/.test(trimmed)) return false;
  const bannedEndings = [
    "operators onboarding new",
    "agents should review expo",
    "operators onboarding",
    "review expo"
  ];
  const normalized = normalizeHeadline(trimmed);
  return !bannedEndings.some((ending) => normalized.endsWith(normalizeHeadline(ending)));
}

function isBeatRecentlyCovered(beat: string, recentFilings: RecentFiledSignal[], withinDays = 3): boolean {
  // Correspondent coverage memory check: did this beat already get a filing within the window?
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  return recentFilings.some((f) => {
    if (f.beat !== beat) return false;
    if (!f.filedAt) return false;
    const filed = Date.parse(f.filedAt);
    return !Number.isNaN(filed) && filed >= cutoff;
  });
}

function hasHardNumberInBody(analysis: string): boolean {
  // Correspondent pre-flight check #1: "Is there a specific number in the first sentence?"
  return /\$[\d,.]+|\b\d[\d,.]*\s*(?:%|BTC|STX|sBTC|sats?|sat\/vB|EH\/s|ZH\/s|wallets?|agents?|txs?|blocks?|M\b|B\b|T\b|v\d)|\bblock\s+\d[\d,]*\b/i.test(analysis);
}

function hasMissionAlignment(headline: string, analysis: string): boolean {
  const text = `${headline} ${analysis}`.toLowerCase();
  const agentTerms = ["agent", "agents", "operator", "operators", "autonomous", "llm", "model", " ai "];
  const bitcoinTerms = ["bitcoin", "btc", "sbtc", "stacks", "stx", "lightning", "ordinal", "rune", "inscription"];
  return agentTerms.some((term) => text.includes(term)) && bitcoinTerms.some((term) => text.includes(term));
}

// Publisher Q3: Inscribable — no unverified speculative language suitable for permanent record
function isInscribable(headline: string, analysis: string): boolean {
  const text = `${headline} ${analysis}`.toLowerCase();
  return ![
    "sources say", "reportedly", "allegedly", "rumored", "could soon",
    "may be planning", "expected to launch", "it appears that",
    "seems to be planning", "unconfirmed", "said to be"
  ].some((p) => text.includes(p));
}

// Publisher Q4: Value-creating — must state a consequence or implication for the AI-native economy
function isValueCreating(analysis: string): boolean {
  const lower = analysis.toLowerCase();
  return [
    "implication:", "agents should", "operators should", "this means",
    "because of this", "as a result", "which means", "this enables",
    "for agents", "agent consequence", "operators need", "this allows agents"
  ].some((p) => lower.includes(p));
}

function hasExactAnchor(headline: string, analysis: string): boolean {
  const text = `${headline} ${analysis}`;
  return /\bissue\s+#\d+\b|\bpr\s+#\d+\b|\bcve-\d{4}-\d+\b|\bv\d+\.\d+(?:\.\d+)*(?:\.\d+)?\b|\bblock\s+\d[\d,]*\b|0x[0-9a-f]{8,}|\$[\d,.]+|\b\d+(?:\.\d+)?%|\b\d[\d,.]*\s*(?:sats?|stx|sbtc|agents?|signals?|slots?|hours?|days?)\b/i.test(text);
}

function hasDirectOperatorConsequence(text: string): boolean {
  return /\bagents should\b|\boperators should\b|\boperators need\b|\bcorrespondents should\b|\bthis means\b|\bwhich means\b|\bas a result\b|\bchanges how\b|\breduces\b|\bprevents\b|\benables\b|\bforces\b/i.test(text);
}

function hasClaimEvidenceImplicationViability(analysis: string): boolean {
  const lowered = analysis.toLowerCase();
  if (/\bclaim:\b.*\bevidence:\b.*\bimplication:\b/s.test(lowered)) {
    return true;
  }
  const sentences = analysis
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  if (sentences.length < 2) return false;
  const hasEvidence = sentences.some((sentence) =>
    /\bissue\s+#\d+\b|\bpr\s+#\d+\b|\brelease\b|\bapi\b|\bendpoint\b|\bquery\b|\bblock\s+\d[\d,]*\b|\$[\d,.]+|\b\d+(?:\.\d+)?%|\b\d[\d,.]*\s*(?:sats?|stx|sbtc|agents?|signals?|slots?)\b/i.test(sentence)
  );
  const hasImplication = sentences.some((sentence) =>
    /\bthis means\b|\bwhich means\b|\bas a result\b|\bfor agents\b|\bfor operators\b|\bchanges how\b|\breduces\b|\bprevents\b|\benables\b|\bforces\b/i.test(sentence)
  );
  return hasEvidence && hasImplication;
}

function hasActionLineViability(analysis: string): boolean {
  return /\bagents should\b|\boperators should\b|\bcorrespondents should\b|\bmonitor\b|\bavoid\b|\bupdate\b|\bverify\b|\bpatch\b|\bredeploy\b|\bcheck\b/i.test(analysis.toLowerCase());
}

function hasMeasurableEcosystemDelta(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    /(?:up|down|from|to|vs\.?|versus|jump(?:ed)?|surge(?:d)?|spike(?:d)?|drop(?:ped)?|fell|rose)\s+\d[\d,.]*(?:\.\d+)?/.test(normalized) ||
    /\b\d[\d,.]*(?:\.\d+)?%\b/.test(normalized) ||
    /\b\d[\d,.]*\s*(?:agents?|signals?|slots?|members?|wallets?|sats?|stx|sbtc)\b.*\b(?:in|within|over)\s+\d[\d,.]*\s*(?:hours?|days?)\b/.test(normalized)
  );
}

function hasDisplacementPotential(headline: string, analysis: string): boolean {
  const text = `${headline} ${analysis}`.toLowerCase();
  return (
    /\bbefore\b|\bearly\b|\bsame day\b|\bwindow\b|\bthreshold\b|\bactivation\b|\boutpace\b|\bsurge\b|\bjump\b|\bspike\b|\bdoubles?\b|\btriples?\b|\bdrops?\b|\bfalls?\b/i.test(text) ||
    hasMeasurableEcosystemDelta(text) ||
    /\bsecurity\b|\bcve\b|\bexploit\b|\bnonce\b|\brelay\b|\bsettlement\b|\brouting\b|\bpayout\b|\bidentity\b/i.test(text)
  );
}

export function buildPreDraftPublisherFit(
  headline: string,
  analysis: string,
  disclosure: string
): PreDraftPublisherFit {
  return {
    missionAligned: hasMissionAlignment(headline, analysis),
    replicable: !hasVagueDisclosure(disclosure) && hasConcreteDisclosureAnchors(disclosure),
    inscribable: isInscribable(headline, analysis),
    valueCreating: isValueCreating(analysis) && hasDirectOperatorConsequence(`${headline} ${analysis}`)
  };
}

export function buildStructuralScreen(headline: string, analysis: string): StructuralScreen {
  return {
    exactAnchor: hasExactAnchor(headline, analysis),
    directOperatorConsequence: hasDirectOperatorConsequence(`${headline} ${analysis}`),
    claimEvidenceImplication: hasClaimEvidenceImplicationViability(analysis),
    actionLineViable: hasActionLineViability(analysis),
    displacementPotential: hasDisplacementPotential(headline, analysis)
  };
}

export function computePreDraftScore(
  publisherFit: PreDraftPublisherFit,
  structural: StructuralScreen,
  beat: string,
  beatFocus: BeatFocusState | null
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (publisherFit.missionAligned) score += 1;
  if (publisherFit.replicable) score += 1;
  if (publisherFit.inscribable) score += 1;
  if (publisherFit.valueCreating) score += 1;

  if (structural.exactAnchor) score += 2; else reasons.push("missing exact anchor at pre-draft stage");
  if (structural.directOperatorConsequence) score += 2; else reasons.push("missing direct operator consequence at pre-draft stage");
  if (structural.claimEvidenceImplication) score += 2; else reasons.push("candidate cannot yet support claim/evidence/implication cleanly");
  if (structural.actionLineViable) score += 1; else reasons.push("candidate lacks a viable action/warning line");
  if (structural.displacementPotential) score += 1; else reasons.push("candidate does not yet show strong displacement potential");

  const normalizedBeat = beat.trim().toLowerCase();
  if (beatFocus) {
    if (beatFocus.primaryBeat?.toLowerCase() === normalizedBeat) {
      score += 2;
      reasons.push("matches learned primary beat");
    } else if (beatFocus.secondaryBeat?.toLowerCase() === normalizedBeat) {
      score += 1;
      reasons.push("matches learned secondary beat");
    } else if (beatFocus.deprioritizedBeats.map((entry) => entry.toLowerCase()).includes(normalizedBeat)) {
      score -= 3;
      reasons.push("beat is currently deprioritized by outcome memory");
    }
  }

  return { score, reasons };
}

function parseBriefHeadlines(briefText: string): string[] {
  const headlines: string[] = [];
  for (const line of briefText.split("\n")) {
    if (line.startsWith("#### ")) {
      headlines.push(line.slice(5).trim());
    }
  }
  return headlines;
}

function headlineAlreadyInBrief(headline: string, briefHeadlines: string[]): boolean {
  const normalized = normalizeHeadline(headline);
  return briefHeadlines.some((briefHeadline) => normalizeHeadline(briefHeadline) === normalized);
}

function extractStoryAnchors(text: string): string[] {
  const matches = [
    ...text.matchAll(/\bissue\s+#\d+\b/gi),
    ...text.matchAll(/\bpr\s+#\d+\b/gi),
    ...text.matchAll(/\bcve-\d{4}-\d+\b/gi),
    ...text.matchAll(/\bv\d+\.\d+(?:\.\d+)*(?:\.\d+)?\b/gi)
  ].map((match) => match[0].toLowerCase());

  return [...new Set(matches)];
}

function extractMetricAnchors(text: string): string[] {
  const matches = [
    ...text.matchAll(/\$\d[\d,]*(?:\.\d+)?/g),
    ...text.matchAll(/\b\d+(?:\.\d+)?%/g),
    ...text.matchAll(/\b\d+\s*(?:hours?|days?|cycles?|agents?|signals?|slots?)\b/gi),
    ...text.matchAll(/\b\d{2,}\s*sats?\b/gi)
  ].map((match) => match[0].toLowerCase());

  return [...new Set(matches)];
}

function findAnchorCollision(
  headline: string,
  analysis: string,
  contexts: ContextSnippet[]
): string | null {
  const candidateText = `${headline} ${analysis}`;
  const candidateAnchors = extractStoryAnchors(candidateText);
  if (candidateAnchors.length === 0) {
    return null;
  }

  const candidateMetrics = extractMetricAnchors(candidateText);

  for (const context of contexts) {
    const contextAnchors = extractStoryAnchors(context.text);
    const sharedAnchors = candidateAnchors.filter((anchor) => contextAnchors.includes(anchor));
    if (sharedAnchors.length === 0) {
      continue;
    }

    const contextMetrics = extractMetricAnchors(context.text);
    const sharedMetrics = candidateMetrics.filter((metric) => contextMetrics.includes(metric));
    if (sharedMetrics.length > 0 || isLikelyCompleteHeadline(headline) && normalizeHeadline(context.text).includes(normalizeHeadline(headline))) {
      return `${context.source} already contains ${sharedAnchors.join(", ")}${sharedMetrics.length > 0 ? ` with overlapping metrics ${sharedMetrics.join(", ")}` : ""}`;
    }
  }

  return null;
}

function buildGuardSection(guard: SignalGuardResult | null): string[] {
  if (!guard) {
    return [
      "- Ready-to-file gate:",
      "  - `Editor guidance`: unknown",
      "  - `Fact-check source verification`: unknown",
      "  - `Fact-check claim verification`: unknown",
      "  - `Duplicate-shape`: unknown",
      "  - `Winner bar`: unknown",
      "  - `Verdict`: kill"
    ];
  }

  const duplicatePass =
    guard.checks.currentBrief === "pass" &&
    guard.checks.priorBriefs === "pass" &&
    guard.checks.priorMatchedRejection === "pass";

  return [
    "- Ready-to-file gate:",
    `  - \`Editor guidance\`: ${guard.checks.editorGuidance ?? "enforced_by_create_signal_and_beat_editor"}`,
    `  - \`Fact-check source verification\`: ${guard.checks.factCheckerSourceVerification}`,
    `  - \`Fact-check claim verification\`: ${guard.checks.factCheckerClaimVerification}`,
    `  - \`Duplicate-shape\`: ${duplicatePass ? "pass" : "reject"}`,
    `  - \`Winner bar\`: ${guard.checks.winnerBar}`,
    `  - \`Verdict\`: ${guard.ok ? "pass" : "kill"}`
  ];
}

function buildCandidateSection(index: number, review: CandidateReview): string {
  const submission = review.submission;
  const artifactRelative = review.artifactPath;
  const saturationLine = review.beatSaturation
    ? [`- Beat saturation: ${review.beatSaturation}`]
    : [];
  const briefWinLines = review.briefWinGate
    ? [
        `- Brief-win gate: ${review.briefWinGate.pass ? "pass" : "demoted"}`,
        `  - operator_consequence: ${review.briefWinGate.checks.operatorConsequence ? "✓" : "✗"}`,
        `  - exact_number_in_opening: ${review.briefWinGate.checks.exactNumber ? "✓" : "✗"}`,
        `  - displacement_framing: ${review.briefWinGate.checks.displacementFraming ? "✓" : "✗"}`
      ]
    : [];
  return [
    `## Candidate ${index}`,
    `- Status: in_queue (\`${artifactRelative}\`)`,
    `- Headline: ${submission.headline ?? "MISSING HEADLINE"}`,
    `- Analysis: ${submission.analysis ?? "MISSING ANALYSIS"}`,
    "- Sources:",
    ...(submission.sources?.length
      ? submission.sources.map((source) => `  - \`${source.url}\``)
      : ["  - none"]),
    "- Tags:",
    ...(submission.tags?.length ? submission.tags.map((tag) => `  - \`${tag}\``) : ["  - none"]),
    `- Pre-draft screen: ${review.preDraftAccepted ? "pass" : "kill"} (${review.preDraftScore})`,
    ...review.preDraftReasons.map((reason) => `  - ${reason}`),
    ...saturationLine,
    ...briefWinLines,
    ...buildGuardSection(review.guard)
  ].join("\n");
}

function buildRejectedSection(index: number, review: CandidateReview): string {
  return [
    `## Candidate ${index}`,
    "- Headline: NOT GENERATED",
    `- Analysis: Rejected during fail-closed validation for \`${review.fileName}\`: ${review.reasons.join("; ")}`,
    "- Sources:",
    "  - none",
    "- Tags:",
    "  - `blocked`",
    "  - `validation-failed`",
    `- Pre-draft screen: ${review.preDraftAccepted ? "pass" : "kill"} (${review.preDraftScore})`,
    ...review.preDraftReasons.map((reason) => `  - ${reason}`),
    ...buildGuardSection(review.guard)
  ].join("\n");
}

export function buildSignalReport(args: {
  reportDate: string;
  generatedAt: string;
  targetCount: number;
  priorReference: string;
  accepted: CandidateReview[];
  rejected: CandidateReview[];
  dailyReportRelative: string;
  briefRelative: string;
  objectiveMemoryRelative: string;
  editorialMemoryRelative: string;
  competitionMemoryRelative: string;
  briefExamplesRelative: string;
  objectiveMemory: ObjectiveMemory;
  editorialMemory: EditorialMemory;
  competitionMemory: CompetitionMemory;
  briefExamplesMemory: BriefExamplesMemory;
}): string {
  const allSections: string[] = [];
  const editorialChecks =
    args.editorialMemory.preFilingChecks.length > 0
      ? args.editorialMemory.preFilingChecks.map(
          (check) =>
            `- ${check.id}: ${check.rule} (triggered by ${check.triggerCount} lesson(s); rationale: ${check.rationale})`
        )
      : ["- none generated yet"];

  for (let i = 0; i < args.targetCount; i += 1) {
    const candidate = args.accepted[i];
    if (candidate) {
      allSections.push(buildCandidateSection(i + 1, candidate));
    } else {
      allSections.push(
        [
          `## Candidate ${i + 1}`,
          "- Status: slot_empty",
          "- No candidate survived validation for this slot.",
          "- Action: return to Signal Discovery — load shared-context.json and brief-examples.json, identify a stronger source anchor, generate a new candidate."
        ].join("\n")
      );
    }
  }

  if (args.rejected.length > 0) {
    allSections.push(
      [
        "## Rejected candidates (not actionable)",
        `${args.rejected.length} candidate(s) failed validation and are excluded from the operator slate.`,
        "Do not attempt to repair these. Return to Signal Discovery and generate new candidates from stronger source anchors.",
        "",
        ...args.rejected.map((review) =>
          `- \`${review.fileName}\`: ${review.reasons.slice(0, 8).join("; ")}`
        )
      ].join("\n")
    );
  }

  return [
    `# Signal Report: ${args.reportDate}`,
    "",
    `Generated at: ${args.generatedAt}`,
    "",
    "Validation-only report: this file is not the trusted send slate.",
    "Trusted runtime output must come from `data/filing-queue/YYYY-MM-DD.json` and `data/filing-ready/YYYY-MM-DD/*.json` after agent-daily finishes.",
    "",
    "## Inputs used",
    `- Daily prep report: \`${args.dailyReportRelative}\``,
    `- Current brief artifact: \`${args.briefRelative}\``,
    `- Prior brief artifact or proxy: ${args.priorReference}`,
    `- Structured editorial memory: \`${args.editorialMemoryRelative}\``,
    "- Pending items rechecked: none; this command validates queued candidates rather than sourcing new ones",
    `- Still missing: ${args.accepted.length >= args.targetCount ? "none" : "enough submit-ready queued candidates to satisfy the target count"}`,
    "",
    "## Objective context",
    `- Objective memory: \`${args.objectiveMemoryRelative}\``,
    `- Main KPI: ${args.objectiveMemory.mainKpi}`,
    `- Brief inclusion payout: ${args.objectiveMemory.payoutModel.briefInclusionSats} sats`,
    `- Weekly top-3 prizes: ${args.objectiveMemory.payoutModel.weeklyTop3PrizesSats.join(" / ")} sats`,
    `- Leaderboard formula: ${args.objectiveMemory.leaderboardFormula.formula}`,
    `- Filing limits: max ${args.objectiveMemory.cadenceLimits.maxSignalsPerDay}/day, 1 beat per ${args.objectiveMemory.cadenceLimits.maxSignalsPerBeatPerMinutes} minutes`,
    ...args.objectiveMemory.pressureNotes.slice(0, 3).map((note) => `- ${note}`),
    "",
    "## Editorial context",
    `- Editorial memory: \`${args.editorialMemoryRelative}\``,
    `- Read today's brief first: ${String(args.editorialMemory.editorialTemplate.readTodayBriefFirst)}`,
    `- Rejected feedback is operating instruction: ${String(args.editorialMemory.rejectionPolicy.rejectedFeedbackIsOperatingInstruction)}`,
    `- Default repair/resubmit: ${String(args.editorialMemory.rejectionPolicy.repairAndResubmitByDefault)}`,
    `- Current cycle date in memory: ${args.editorialMemory.currentCycle.reportDate ?? "unknown"}`,
    ...args.editorialMemory.currentCycle.winnersToday.slice(0, 2).map((entry) => `- Today winner pattern: ${entry.headline} (${entry.beat})`),
    ...args.editorialMemory.currentCycle.lossesToday.slice(0, 2).map((entry) => `- Today loss pattern: ${entry.headline} (${entry.beat})`),
    ...args.editorialMemory.currentCycle.valueCreatingPatterns.slice(0, 2).map((entry) => `- Value bar today: ${entry}`),
    ...args.editorialMemory.currentCycle.sourcePatternsThatPassed.slice(0, 2).map((entry) => `- Passed source pattern: ${entry}`),
    ...args.editorialMemory.focusAreas.slice(0, 3).map((entry) => `- ${entry.label}: ${entry.action}`),
    "",
    "## Competitive context",
    `- Competition memory: \`${args.competitionMemoryRelative}\``,
    ...args.competitionMemory.crowdingNotes.slice(0, 3).map((note) => `- ${note}`),
    ...args.competitionMemory.beatOwners.slice(0, 3).map((owner) => `- Beat owner: ${owner.agent} on ${owner.beats.join(", ")} (${owner.wins} wins)`),
    "",
    "## Example context",
    `- Brief examples memory: \`${args.briefExamplesRelative}\``,
    ...args.briefExamplesMemory.recentWinners.slice(0, 2).map((entry) => `- Winner example: ${entry.headline} (${entry.beat})`),
    ...args.briefExamplesMemory.recentLosses.slice(0, 2).map((entry) => `- Loss example: ${entry.headline} (${entry.whyItLost})`),
    "",
    "## Hard editorial gates",
    ...editorialChecks,
    "",
    "## Competitive setup",
    `- Best beats to target: ${args.competitionMemory.crowdedBeats.length > 0 ? "lanes not showing cap/duplicate pressure today" : "derived from daily prep; crowding memory is thin"}`,
    "- Beats to avoid: any story already in today's brief, any known rejection-pattern packaging failure",
    `- Strongest story shapes: ${args.competitionMemory.winningStoryShapes.slice(0, 3).join("; ")}`,
    `- Top-3 pressure: ${args.objectiveMemory.currentStanding.gapToTop3 ?? "unknown"} score gap`,
    "- Key payout implication: fail short rather than pad the slate with approval-quality candidates",
    "",
    "## Output rule",
    `- Accepted candidates: ${args.accepted.length} of ${args.targetCount} slots filled`,
    `- Rejected candidates: ${args.rejected.length} (logged in appendix, not actionable)`,
    "- If slots are empty: generate new candidates from Signal Discovery context, do not repair rejected ones",
    "- Human-readable first: true",
    "- JSON conversion later: uses queued manual submission artifacts that survived validation",
    "- No alternates or rough ideas: true",
    "",
    ...allSections,
    "",
    "## Final recommendation",
    `- Strongest candidates first: ${args.accepted.length > 0 ? args.accepted.map((_, index) => `Candidate ${index + 1}`).join(", ") : "none generated"}`,
    `- Best beat to prioritize: ${args.accepted[0]?.submission.beat_slug ?? "none"}`,
    `- Biggest risk to avoid: ${args.accepted.length >= args.targetCount ? "padding the slate after validation passes" : "pretending weak or already-printed candidates are sure winners"}`
  ].join("\n");
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function listQueuedCandidates(dirPath: string): Promise<string[]> {
  if (!existsSync(dirPath)) return [];
  const names = await readdir(dirPath);
  return names.filter((name) => name.endsWith(".json")).sort();
}

async function reviewCandidate(
  root: string,
  reportDate: string,
  fileName: string,
  artifactPath: string,
  submission: ManualSubmission,
  briefHeadlines: string[],
  recentFilings: RecentFiledSignal[],
  duplicateContexts: ContextSnippet[]
  ,
  beatFocus: BeatFocusState | null
): Promise<CandidateReview> {
  const reasons: string[] = [];
  const preDraftReasons: string[] = [];
  const { payload, issues } = parseCanonicalSignalPayload(submission);
  const artifactValidation = validateArtifact(submission);
  const canonicalCreateSignalArtifact = isCanonicalCreateSignalArtifact(submission);
  const headline = payload?.headline ?? submission.headline?.trim() ?? "";
  const analysis = payload?.analysis ?? submission.analysis?.trim() ?? "";
  const sources = payload?.sources ?? [];
  const tags = payload?.tags ?? [];
  const beat = payload?.beat_slug ?? submission.beat_slug?.trim() ?? "";
  const disclosure = payload?.disclosure ?? "";

  const publisherFit = buildPreDraftPublisherFit(headline, analysis, disclosure);
  const structural = buildStructuralScreen(headline, analysis);
  const editorialCompetitiveness = assessEditorialCompetitiveness({
    headline,
    summary: submission.candidate_signal?.summary,
    significance: submission.candidate_signal?.significance,
    causality: submission.candidate_signal?.causality,
    sourceUrls: sources.map((source) => source.url),
    sourceTypes: submission.candidate_signal?.source_type
      ? [String(submission.candidate_signal.source_type)]
      : []
  });
  const preDraft = computePreDraftScore(publisherFit, structural, beat, beatFocus);
  preDraftReasons.push(
    `publisher-fit (legacy informational only): missionAlignment ${publisherFit.missionAligned ? "pass" : "reject"}, replicable ${publisherFit.replicable ? "pass" : "reject"}, inscribable ${publisherFit.inscribable ? "pass" : "reject"}, valueCreating ${publisherFit.valueCreating ? "pass" : "reject"}`,
    `structural: exact-anchor ${structural.exactAnchor ? "yes" : "no"}, operator-consequence ${structural.directOperatorConsequence ? "yes" : "no"}, claim-evidence-implication ${structural.claimEvidenceImplication ? "yes" : "no"}, action-line ${structural.actionLineViable ? "yes" : "no"}, displacement ${structural.displacementPotential ? "yes" : "no"}`,
    `editorial-competitiveness: ${editorialCompetitiveness.status}`
  );
  preDraftReasons.push(...preDraft.reasons);
  if (editorialCompetitiveness.reasons.length > 0) {
    preDraftReasons.push(...editorialCompetitiveness.reasons);
  }

  if (submission.status !== "in_queue") reasons.push("artifact status is not in_queue");
  if (artifactValidation.issues.length > 0) {
    reasons.push(...artifactValidation.issues.map((issue) => `canonical create-signal artifact failed: ${issue.code} at ${issue.field}: ${issue.reason}`));
  } else if (issues.length > 0) {
    reasons.push(...issues.map((issue) => `canonical payload mismatch: ${issue.reason}`));
  }
  if (!headline) reasons.push("headline missing");
  if (!canonicalCreateSignalArtifact && headline && !isLikelyCompleteHeadline(headline)) reasons.push("headline is incomplete, truncated, or exceeds 120 characters");
  if (!canonicalCreateSignalArtifact && headline && !hasExactHeadlineAnchor(headline)) {
    reasons.push("pre-draft kill: headline-anchor fast-check failed — headline has no exact anchor (PR#, issue#, version, block, sat amount, endpoint); do not file");
  }
  if (headline && headlineAlreadyInBrief(headline, briefHeadlines)) {
    const duplicateReason = "headline already appears in today's brief";
    if (canonicalCreateSignalArtifact) {
      preDraftReasons.push(`post-artifact duplicate warning: ${duplicateReason}`);
    } else {
      reasons.push(duplicateReason);
    }
  }
  if (!analysis) reasons.push("analysis/body missing");
  if (!canonicalCreateSignalArtifact && analysis && !hasTemplateAnalysis(analysis)) {
    reasons.push("analysis must use Framework A (CLAIM/EVIDENCE/IMPLICATION/Directive) or Framework B (What changed/What it means/What to do) — freeform analysis is rejected");
  }
  if (sources.length === 0) reasons.push("sources missing");
  if (tags.length === 0) reasons.push("tags missing");
  if (tooManyTags(tags)) {
    reasons.push(`too many tags: ${tags.length} tags present, maximum is 2 — single-beat specialists earn 135K sats avg vs 26K for sprawl`);
  }
  const anchorCollision = findAnchorCollision(headline, analysis, duplicateContexts);
  if (anchorCollision) {
    const collisionReason = `duplicate anchor collision: ${anchorCollision}`;
    if (canonicalCreateSignalArtifact) {
      preDraftReasons.push(`post-artifact duplicate warning: ${collisionReason}`);
    } else {
      reasons.push(collisionReason);
    }
  }

  if (!canonicalCreateSignalArtifact && editorialCompetitiveness.status !== "competitive") {
    reasons.push(
      "pre-draft kill: headline/story shape is not competitive for In Brief — " +
      editorialCompetitiveness.reasons.join("; ")
    );
  }
  if (!canonicalCreateSignalArtifact && preDraft.score < 10) reasons.push(`pre-draft kill: structural score ${preDraft.score} is below the minimum winner threshold`);

  // P27: beat saturation check (non-blocking warning unless blocked)
  let beatSaturationMsg: string | null = null;
  if (beat) {
    try {
      const saturation = await checkBeatSaturation(beat);
      const warning = formatSaturationWarning(saturation);
      if (warning) {
        beatSaturationMsg = warning;
        if (saturation.saturationLevel === "blocked") {
          reasons.push(warning);
        }
      }
    } catch { /* network failure — don't block */ }
  }

  // P28: brief-win shape gate (demote, not hard-block)
  const briefWinGate = (headline && analysis)
    ? checkBriefWinShape(headline, analysis)
    : null;
  if (!canonicalCreateSignalArtifact && briefWinGate && !briefWinGate.pass && briefWinGate.demotionReason) {
    reasons.push(`pre-draft kill: ${briefWinGate.demotionReason}`);
  }

  const preDraftAccepted = !reasons.some((reason) => reason.startsWith("pre-draft kill:"));

  if (!preDraftAccepted) {
    return {
      fileName,
      artifactPath,
      submission,
      accepted: false,
      preDraftAccepted,
      preDraftScore: preDraft.score,
      reasons,
      preDraftReasons,
      guard: null,
      briefWinGate,
      beatSaturation: beatSaturationMsg
    };
  }

  if (payload) {
    const guard = await evaluateSignalGuard({
      reportDate,
      headline: payload.headline,
      beat_slug: payload.beat_slug,
      body: payload.analysis,
      sources: payload.sources,
      enforceWinnerBar: true,
      model_disclosure: {
        tools_used: [],
        derivation_steps: payload.disclosure ? [payload.disclosure] : []
      }
    }, root);
    if (!guard.ok && !canonicalCreateSignalArtifact) {
      reasons.push(...guard.blockers.map((blocker) => `shared editorial guard: ${blocker}`));
      return {
        fileName,
        artifactPath,
        submission,
        accepted: false,
        preDraftAccepted,
        preDraftScore: preDraft.score,
        reasons,
        preDraftReasons,
        guard,
        briefWinGate,
        beatSaturation: beatSaturationMsg
      };
    }
    return {
      fileName,
      artifactPath,
      submission,
      accepted: reasons.length === 0,
      preDraftAccepted,
      preDraftScore: preDraft.score,
      reasons,
      preDraftReasons,
      guard,
      briefWinGate,
      beatSaturation: beatSaturationMsg
    };
  }

  return {
    fileName,
    artifactPath,
    submission,
    accepted: reasons.length === 0,
    preDraftAccepted,
    preDraftScore: preDraft.score,
    reasons,
    preDraftReasons,
    guard: null,
    briefWinGate,
    beatSaturation: beatSaturationMsg
  };
}

function findRepairContract(
  signalId: string,
  contracts: RepairContract[]
): RepairContract | null {
  return contracts.find((entry) => entry.signalId === signalId) ?? null;
}

function reviewRepairContract(
  submission: ManualSubmission,
  contracts: RepairContract[]
): string[] {
  const resubmissionSignalId = submission.resubmission_for_signal_id?.trim();
  if (!resubmissionSignalId) return [];

  const contract = findRepairContract(resubmissionSignalId, contracts);
  if (!contract) {
    return [
      `resubmission_for_signal_id '${resubmissionSignalId}' has no recorded repair contract; register the publisher rejection message first`
    ];
  }

  const verification = verifyRepairContract(contract, {
    beat: submission.beat_slug?.trim() ?? null,
    analysis: submission.analysis?.trim() ?? "",
    sourceTitlesAndUrls: (submission.sources ?? []).flatMap((source) => [source.title ?? "", source.url])
  });

  return verification.reasons;
}

export async function runSignalJob(
  reportDate: string,
  generatedAt: string,
  baseDir?: string
): Promise<SignalJobResult> {
  const root = resolve(baseDir ?? process.cwd());
  const priorDate = getPriorDate(reportDate);
  const targetCount = 6;

  const paths = {
    dailyReport: resolve(root, `data/reports/daily/${reportDate}.md`),
    dailyHandoff: resolve(root, `data/reports/daily/${reportDate}.json`),
    brief: resolve(root, `data/briefs/${reportDate}.md`),
    priorBrief: resolve(root, `data/briefs/${priorDate}.md`),
    priorReport: resolve(root, `data/reports/daily/${priorDate}.md`),
    queueDir: resolve(root, `data/manual-submissions/${reportDate}`),
    output: resolve(root, `data/reports/signals/${reportDate}.md`),
    editorialMemory: resolve(root, "data/state/editorial-memory.json"),
    sharedContext: resolve(root, "data/briefs/shared-context.json"),
    contextRunDir: resolve(root, `data/context-runs/${reportDate}`)
  };

  if (!existsSync(paths.dailyReport)) {
    process.stdout.write(
      `[signal-job] BLOCKED — data/reports/daily/${reportDate}.md missing. Run daily prep first.\n`
    );
    return { outputPath: "", skipped: true, skipReason: `daily prep report missing for ${reportDate}` };
  }
  if (!existsSync(paths.brief)) {
    process.stdout.write(
      `[signal-job] BLOCKED — data/briefs/${reportDate}.md missing. Run daily prep first.\n`
    );
    return { outputPath: "", skipped: true, skipReason: `brief artifact missing for ${reportDate}` };
  }

  const briefText = await readFile(paths.brief, "utf8");
  const briefHeadlines = parseBriefHeadlines(briefText);
  const prepHandoff = await readJsonIfExists<DailyPrepHandoff>(paths.dailyHandoff);
  const [objectiveMemory, editorialMemory, competitionMemory, briefExamplesMemory] = await Promise.all([
    loadObjectiveMemory(root),
    loadEditorialMemory(root),
    loadCompetitionMemory(root),
    loadBriefExamplesMemory(root)
  ]);
  const optimizationSnapshot = await readDailyOptimizationSnapshot(reportDate, { baseDir: root });
  const editorialLearnings = optimizationSnapshot?.editorialLearnings;
  const beatFocus: BeatFocusState | null = editorialLearnings
    ? {
        primaryBeat: editorialLearnings.primaryBeat,
        secondaryBeat: editorialLearnings.secondaryBeat,
        deprioritizedBeats: editorialLearnings.deprioritizedBeats
      }
    : null;
  let queueFiles = await listQueuedCandidates(paths.queueDir);
  if (queueFiles.length === 0) {
    const generated = await materializeGeneratedCandidates(reportDate, root);
    if (generated.written.length > 0 || generated.winnerGateBlocked > 0) {
      process.stdout.write(
        `[signal-job] generated ${generated.written.length} candidate artifact(s) from dry-run submissions in ${generated.outputDir}` +
        (generated.winnerGateBlocked > 0 ? ` (${generated.winnerGateBlocked} blocked by winner-gate)` : "") +
        "\n"
      );
    }
    queueFiles = await listQueuedCandidates(paths.queueDir);
  }
  const repairMemory = await readRepairMemory(root);

  const signalHistory = await readSignalHistory(root);
  const recentFilings: RecentFiledSignal[] = (signalHistory.entries ?? []).map((entry: SignalHistoryEntry) => ({
    beat: entry.beat ?? null,
    headline: entry.headline ?? null,
    filedAt: entry.filedAt ?? null
  }));
  const sharedContext = await readJsonIfExists<SharedBriefContextFile>(paths.sharedContext);
  const sharedContextEntries = Object.entries(sharedContext?.dates ?? {})
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 3);
  const duplicateContexts: ContextSnippet[] = [
    { source: `data/briefs/${reportDate}.md`, text: briefText },
    ...(prepHandoff?.sharedBriefContext?.recentWinningTitles ?? []).map((title) => ({
      source: `data/reports/daily/${reportDate}.json#sharedBriefContext.winner`,
      text: title
    })),
    ...(prepHandoff?.sharedBriefContext?.recentRejectedTitles ?? []).map((title) => ({
      source: `data/reports/daily/${reportDate}.json#sharedBriefContext.rejected`,
      text: title
    })),
    ...sharedContextEntries.flatMap(([date, entry]) => [
      ...(entry.briefTitles ?? []).map((item) => ({
        source: `data/briefs/shared-context.json#${date}`,
        text: `${item.title} ${item.snippet ?? ""}`.trim()
      })),
      ...(entry.rejectedTitles ?? []).map((item) => ({
        source: `data/briefs/shared-context.json#${date}`,
        text: `${item.title} ${item.reason ?? ""}`.trim()
      }))
    ]),
    { source: "data/state/editorial-memory.json", text: JSON.stringify(editorialMemory) },
    { source: "data/state/repairable-candidates.json", text: JSON.stringify(repairMemory) },
    ...recentFilings
      .filter((entry) => typeof entry.headline === "string" && entry.headline.trim().length > 0)
      .map((entry) => ({
        source: `data/state/signal-history.json${entry.filedAt ? `@${entry.filedAt}` : ""}`,
        text: entry.headline ?? ""
      }))
  ];

  const reviews: CandidateReview[] = [];

  for (const fileName of queueFiles) {
    const absolutePath = resolve(paths.queueDir, fileName);
    const relativePath = absolutePath.slice(root.length + 1);
    const submission = await readJsonFile<ManualSubmission>(absolutePath);
    const review = await reviewCandidate(root, reportDate, fileName, relativePath, submission, briefHeadlines, recentFilings, duplicateContexts, beatFocus);
    const repairReasons = reviewRepairContract(submission, repairMemory.contracts);
    if (repairReasons.length > 0) {
      review.accepted = false;
      review.reasons.push(...repairReasons);
    }
    reviews.push(review);
  }

  const accepted = reviews
    .filter((review) => review.accepted)
    .sort((left, right) =>
      right.preDraftScore - left.preDraftScore ||
      left.fileName.localeCompare(right.fileName)
    );
  const rejected = reviews
    .filter((review) => !review.accepted)
    .sort((left, right) =>
      right.preDraftScore - left.preDraftScore ||
      left.fileName.localeCompare(right.fileName)
    );
  const priorReference = existsSync(paths.priorBrief)
    ? `\`data/briefs/${priorDate}.md\``
    : existsSync(paths.priorReport)
      ? `\`data/reports/daily/${priorDate}.md\` (declared proxy because no prior brief artifact exists)`
      : "none available";

  const reportContent = buildSignalReport({
    reportDate,
    generatedAt,
    targetCount,
    priorReference,
    accepted,
    rejected,
    dailyReportRelative: `data/reports/daily/${reportDate}.md`,
    briefRelative: `data/briefs/${reportDate}.md`,
    objectiveMemoryRelative: "data/state/objective-memory.json",
    editorialMemoryRelative: "data/state/editorial-memory.json",
    competitionMemoryRelative: "data/state/competition-memory.json",
    briefExamplesRelative: "data/state/brief-examples.json",
    objectiveMemory,
    editorialMemory,
    competitionMemory,
    briefExamplesMemory
  });

  await mkdir(dirname(paths.output), { recursive: true });
  await writeFile(paths.output, reportContent, "utf8");
  await mkdir(paths.contextRunDir, { recursive: true });
  await writeFile(
    resolve(paths.contextRunDir, "signal-job.json"),
    JSON.stringify({
      kind: "signal_job_context",
      reportDate,
      generatedAt,
      sourceFiles: [
        `data/reports/daily/${reportDate}.md`,
        `data/reports/daily/${reportDate}.json`,
        `data/briefs/${reportDate}.md`,
        "data/briefs/shared-context.json",
        "data/state/signal-history.json",
        "data/state/editorial-memory.json",
        "data/state/objective-memory.json",
        "data/state/competition-memory.json",
        "data/state/brief-examples.json"
      ],
      queueDir: paths.queueDir,
      queueFiles,
      reviews: reviews.map((review) => ({
        fileName: review.fileName,
        candidateId: review.fileName.replace(/\.json$/, ""),
        headline: review.submission.headline?.trim() ?? review.fileName.replace(/\.json$/, ""),
        beat: review.submission.beat_slug?.trim() ?? "",
        accepted: review.accepted,
        preDraftAccepted: review.preDraftAccepted,
        preDraftScore: review.preDraftScore,
        reasons: review.reasons
      } satisfies SignalJobContextReview)),
      acceptedCount: accepted.length,
      rejectedCount: rejected.length
    }, null, 2) + "\n",
    "utf8"
  );

  const skipped = accepted.length < targetCount;
  if (skipped) {
    process.stdout.write(
      `[signal-job] FAIL-CLOSED — only ${accepted.length}/${targetCount} queued candidates survived validation. Report saved to ${paths.output}\n`
    );
  } else {
    process.stdout.write(
      `[signal-job] OK — ${accepted.length}/${targetCount} queued candidates survived validation. Report saved to ${paths.output}\n`
    );
  }

  return {
    outputPath: paths.output,
    skipped,
    skipReason: skipped ? `only ${accepted.length}/${targetCount} queued candidates survived validation` : undefined
  };
}

async function main(): Promise<void> {
  const now = new Date().toISOString();
  const reportDate = process.argv[2] ?? now.slice(0, 10);
  await runSignalJob(reportDate, now);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
