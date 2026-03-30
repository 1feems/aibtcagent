import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchCompetitorProfiles, readBriefWinnerSnapshot, type CompetitorProfile } from "../brief/index.js";
import { assessBeatPublishability, type PublishabilityStatus } from "../filing/publishability.js";
import { assessEditorialCompetitiveness, type EditorialCompetitivenessStatus } from "./editorial-contract.js";
import type { DailyOptimizationSnapshot } from "../types/index.js";
import { fetchLiveSignals, jaccardSimilarity, runAutoGates, type AutoGateResult } from "./auto-gates.js";

interface SerializedSubmission {
  candidate_signal: {
    candidate_id: string;
    beat: string;
    detected_at?: string;
    summary?: string;
    causality?: string;
    likely_duplicate: boolean;
    uses_dashboard_as_primary_source: boolean;
    significance: string;
    duplicate_check_status?: string;
    staleness_risk?: string;
  };
  headline: string;
  proof?: Array<{
    query_result?: string;
    proof_note?: string;
  }>;
  sources?: Array<{
    source_type?: string;
    source_url?: string;
  }>;
  pre_submission_intelligence?: {
    notes?: string[];
    beat_status_today?: string;
  };
  validation_status?: {
    checks?: {
      duplicate_check_note?: string;
    };
  };
  submission_decision: {
    status?: string;
    submissionStatus?: "submit" | "reject";
    rejection_reasons?: string[];
    editorial_review?: {
      ready_to_file?: boolean;
    };
    hold_reasons?: string[];
  };
  editorial_review?: {
    editorial_fit?: "strong" | "borderline" | "weak";
    publisher_confidence?: "high" | "medium" | "low";
    ready_to_file?: boolean;
    hold_reasons?: string[];
  };
  candidate_metadata?: {
    style_tested?: string;
    competitor_reference?: string | null;
    why_this_style_was_chosen?: string;
    duplicate_status?: "clear" | "pending" | "flagged";
    freshness_status?: "clear" | "risk_unresolved" | "unknown";
    publishability_status?: PublishabilityStatus;
    filing_beat_slug?: string;
  };
}

interface AgentBehaviorState {
  agents?: Array<{
    agent: string;
    wins: number;
    beats: string[];
    sameDayMultiWins: number;
    commonSourceDomains: Array<{ domain: string; count: number }>;
  }>;
  commonSourceDomains?: Array<{ domain: string; count: number }>;
}

interface HistoricalBriefSignals {
  preferredBeats: string[];
  prefersReleaseConsequence: boolean;
  prefersStructuralPatterns: boolean;
  prefersExactAnchors: boolean;
}

interface ScoreContext {
  optimization: DailyOptimizationSnapshot | null;
  briefSnapshot: Awaited<ReturnType<typeof readBriefWinnerSnapshot>>;
  agentBehavior: AgentBehaviorState | null;
  historicalBriefSignals: HistoricalBriefSignals;
  competitorWinningAngles: string[];
  autoGate?: AutoGateResult;
  competitorProfiles?: CompetitorProfile[];
}

interface ParsedCandidateSubmission {
  sourcePath: string;
  submission: SerializedSubmission;
}

interface StalePruningRecord {
  kind: "stale_dry_run_pruning";
  reportDate: string;
  generatedAt: string;
  removedCount: number;
  removed: Array<{
    candidateId: string;
    headline: string;
    detectedAt: string | null;
    sourcePath: string;
    reason: string;
  }>;
}

export interface RankedCandidate {
  candidateId: string;
  beat: string;
  filingBeatSlug: string;
  headline: string;
  score: number;
  decision: "file" | "hold" | "reject";
  styleTested: string;
  competitorReference: string | null;
  whyThisStyleWasChosen: string;
  duplicateStatus: "clear" | "pending" | "flagged";
  freshnessStatus: "clear" | "risk_unresolved" | "unknown";
  publishabilityStatus: PublishabilityStatus;
  publishabilityReasons: string[];
  competitivenessStatus: EditorialCompetitivenessStatus;
  competitivenessReasons: string[];
  competitorCoverage: Array<{ name: string; headline: string; similarity: number }>;
  reasons: string[];
  sourcePath: string;
}

function normalizeScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

async function readOptimizationSnapshot(
  reportDate: string,
  baseDir?: string
): Promise<DailyOptimizationSnapshot | null> {
  const filePath = resolve(
    baseDir ?? process.cwd(),
    `data/experiments/optimization/${reportDate}.json`
  );

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as DailyOptimizationSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function isManualCheckOnly(rejectionReasons: string[]): boolean {
  return rejectionReasons.length > 0 && rejectionReasons.every((reason) =>
    [
      "leaderboard_not_checked",
      "reputation_not_checked",
      "inbox_not_checked",
      "agent_status_not_checked"
    ].includes(reason)
  );
}

function hasRawReleaseNoteShape(headline: string): boolean {
  return (
    /\bbug fixes?\b/i.test(headline) ||
    /\bcloses?\s+#\d+\b/i.test(headline) ||
    /\bv\d+\.\d+\.\d+\b/i.test(headline)
  );
}

function hasArtifactTitleShape(headline: string): boolean {
  const normalized = headline.trim().toLowerCase();
  return (
    /^\S+\s+ships\s+\S*?v\d+\.\d+/i.test(normalized) ||
    /^\S+:\s+/i.test(normalized) ||
    /\(#\d+\)/.test(headline) ||
    /\([0-9a-f]{7,}\)/i.test(headline)
  );
}

function inferHeadlinePattern(headline: string): string {
  const normalized = headline.toLowerCase();

  if (normalized.includes(" because ")) {
    return "because-causality";
  }
  if (normalized.includes(", signaling ")) {
    return "signaling-significance";
  }
  if (normalized.includes("which suggests")) {
    return "which-suggests-significance";
  }
  if (normalized.includes(" before ")) {
    return "before-advantage";
  }
  if (headline.length <= 90) {
    return "short-form";
  }
  if (headline.length <= 140) {
    return "full-length";
  }

  return "summary-led";
}

function extractDomain(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function readAgentBehaviorState(baseDir?: string): Promise<AgentBehaviorState | null> {
  const filePath = resolve(baseDir ?? process.cwd(), "data/state/brief-agent-behavior.json");

  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as AgentBehaviorState;
    return {
      agents: (parsed.agents ?? []).map((agent) => ({
        agent: agent.agent,
        wins: agent.wins,
        beats: Array.isArray(agent.beats) ? agent.beats : [],
        sameDayMultiWins: agent.sameDayMultiWins ?? 0,
        commonSourceDomains: Array.isArray(agent.commonSourceDomains) ? agent.commonSourceDomains : []
      })),
      commonSourceDomains: Array.isArray(parsed.commonSourceDomains) ? parsed.commonSourceDomains : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function getSubmissionStatus(submission: SerializedSubmission): "submit" | "reject" {
  if (submission.submission_decision.status === "submit" || submission.submission_decision.status === "reject") {
    return submission.submission_decision.status;
  }
  return submission.submission_decision.submissionStatus ?? "reject";
}

function getRejectionReasons(submission: SerializedSubmission): string[] {
  return submission.submission_decision.rejection_reasons ?? [];
}

function getEditorialReview(submission: SerializedSubmission): {
  editorialFit: "strong" | "borderline" | "weak";
  publisherConfidence: "high" | "medium" | "low";
  readyToFile: boolean;
  holdReasons: string[];
} {
  const topLevel = submission.editorial_review;
  const nested = submission.submission_decision.editorial_review;

  return {
    editorialFit: topLevel?.editorial_fit ?? "borderline",
    publisherConfidence: topLevel?.publisher_confidence ?? "low",
    readyToFile: topLevel?.ready_to_file ?? nested?.ready_to_file ?? false,
    holdReasons: topLevel?.hold_reasons ?? submission.submission_decision.hold_reasons ?? []
  };
}

async function readHistoricalBriefSignals(baseDir?: string): Promise<HistoricalBriefSignals> {
  const root = baseDir ?? process.cwd();
  // Brief JSON files are saved to data/briefs/ by ingestManualDailyBrief
  const briefsDir = resolve(root, "data/briefs");
  const stateDir = resolve(root, "data/state");

  // Collect notes from manually ingested brief entry notes[]
  let briefFiles: string[] = [];
  try {
    briefFiles = (await readdir(briefsDir)).filter((f) => f.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const notes: string[] = [];
  for (const fileName of briefFiles) {
    const parsed = JSON.parse(
      await readFile(resolve(briefsDir, fileName), "utf8")
    ) as { entries?: Array<{ notes?: string[] }> };
    for (const entry of parsed.entries ?? []) {
      for (const note of entry.notes ?? []) {
        notes.push(note);
      }
    }
  }

  // Also read publishedSignals from auto-tracked brief-winners-*.json files
  let stateFiles: string[] = [];
  try {
    stateFiles = (await readdir(stateDir))
      .filter((f) => f.startsWith("brief-winners-") && f.endsWith(".json"))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const publishedHeadlines: string[] = [];
  const publishedBeats: string[] = [];
  for (const fileName of stateFiles) {
    const parsed = JSON.parse(
      await readFile(resolve(stateDir, fileName), "utf8")
    ) as { publishedSignals?: Array<{ headline: string; beat: string }> };
    for (const signal of parsed.publishedSignals ?? []) {
      publishedHeadlines.push(signal.headline);
      publishedBeats.push(signal.beat);
    }
  }

  const normalizedNotes = notes.map((note) => note.toLowerCase());
  const normalizedHeadlines = publishedHeadlines.map((h) => h.toLowerCase());
  const normalizedBeats = publishedBeats.map((b) => b.toLowerCase());

  // Live beat slugs from aibtc.news/api/beats — must match exactly what is used in submissions
  const beatVocabulary = [
    "dev-tools",
    "security",
    "aibtc-network",
    "agent-economy",
    "agent-trading",
    "dao-watch",
    "deal-flow",
    "distribution",
    "agent-skills",
    "agent-social",
    "bitcoin-yield",
    "bitcoin-macro",
    "bitcoin-culture",
    "ordinals",
    "runes",
    "art"
  ];

  const preferredBeats = beatVocabulary
    .filter((beat) =>
      normalizedNotes.some((note) => note.includes(beat)) ||
      normalizedBeats.some((b) => b === beat)
    );

  const prefersReleaseConsequence =
    normalizedNotes.some((note) =>
      note.includes("release or pr plus operator consequence") ||
      note.includes("release-driven stories won")
    ) ||
    normalizedHeadlines.some((h) =>
      /\brelease[sd]?\b|\bv\d+\.\d+\b|\bupgrade[sd]?\b/.test(h) && hasOperatorConsequence(h)
    );

  const prefersStructuralPatterns =
    normalizedNotes.some((note) =>
      note.includes("structural pattern") ||
      note.includes("bottleneck") ||
      note.includes("saturation")
    ) ||
    normalizedHeadlines.some((h) => hasStructuralPattern(h));

  const prefersExactAnchors =
    normalizedNotes.some((note) =>
      note.includes("exact numbers") ||
      note.includes("versions") ||
      note.includes("thresholds") ||
      note.includes("release tags")
    ) ||
    normalizedHeadlines.some((h) => hasExactAnchor(h));

  return { preferredBeats, prefersReleaseConsequence, prefersStructuralPatterns, prefersExactAnchors };
}

function inferWinningAngle(text: string): string | null {
  const normalized = text.toLowerCase();

  if (/\bdependency risk\b|\bconcentration\b|\bgap\b|\btrap\b|\brisk\b/.test(normalized)) {
    return "structural-risk";
  }

  if (/\binstead of\b|\bafter \d+s instead of \d+s\b|\btimeout\b|\blatency\b|\bfaster\b|\bslower\b/.test(normalized)) {
    return "measured-operator-improvement";
  }

  if (/\btop \d+\b|\b\d+%\b|\bmarket formation\b|\btaxonomy\b|\bpool\b|\bshare\b/.test(normalized)) {
    return "market-structure";
  }

  return null;
}

async function readCompetitorWinningAngles(
  reportDate: string,
  baseDir?: string
): Promise<string[]> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/reports/competitor-review/${reportDate}.json`);

  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as {
      whoWonToday?: Array<{ headlines?: string[] }>;
    };
    const angles = new Map<string, number>();

    for (const winner of parsed.whoWonToday ?? []) {
      for (const headline of winner.headlines ?? []) {
        const angle = inferWinningAngle(headline);
        if (angle) {
          angles.set(angle, (angles.get(angle) ?? 0) + 1);
        }
      }
    }

    return [...angles.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([angle]) => angle);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function hasExactAnchor(headline: string): boolean {
  return /\b\d[\d,.]*\b/.test(headline) || /\bv\d+\.\d+(?:\.\d+)?\b/i.test(headline);
}

function hasStructuralPattern(text: string): boolean {
  return /\bcluster|gap|bottleneck|threshold|saturation|queue|concentration|backlog|lead|dominat/i.test(text);
}

function hasOperatorConsequence(text: string): boolean {
  return /\bagents should\b|\boperators should\b|\bmatters because\b|\brequires\b|\bupgrade\b|\brisk\b|\bwindow\b|\bconsequence\b/i.test(text);
}

function isRawReleaseWithoutOperatorConsequence(
  submission: SerializedSubmission,
  operatorConsequence: boolean
): boolean {
  return (
    (hasRawReleaseNoteShape(submission.headline) || hasArtifactTitleShape(submission.headline)) &&
    !operatorConsequence
  );
}

function hasBroadWinnerShape(submission: SerializedSubmission, text: string): boolean {
  const numericAnchors = submission.headline.match(/\b\d[\d,.]*\b/g) ?? [];
  return (
    /\b(and|plus|simultaneous|bundle|bundled|combined|cluster)\b/i.test(submission.headline) ||
    /\bbroader\b|\bstructural\b|\bsystem\b|\bnetwork-level\b|\bnetwork wide\b/i.test(text) ||
    numericAnchors.length >= 2
  );
}

function inferStyleTestedFromSubmission(
  submission: SerializedSubmission,
  contextText: string,
  broadWinnerShape: boolean,
  operatorConsequence: boolean,
  structuralPattern: boolean,
  exactAnchor: boolean
): string {
  if (submission.candidate_metadata?.style_tested) {
    return submission.candidate_metadata.style_tested;
  }

  if (broadWinnerShape && operatorConsequence) {
    return "broad_same_beat_operator";
  }

  if ((submission.sources ?? []).some((source) => source.source_url?.includes("github.com")) && operatorConsequence) {
    return "release_operator_consequence";
  }

  if (structuralPattern) {
    return "structural_pattern";
  }

  if (exactAnchor && /\bbefore|early|same day|deadline|activation\b/i.test(contextText)) {
    return "exact_anchor_timing";
  }

  return "single_story_operator_angle";
}

function inferCompetitorReferenceFromSubmission(
  submission: SerializedSubmission,
  dominantBeatOwners: Array<{ agent: string }>,
  topWinningDomains: Array<{ domain: string; count: number }>
): string | null {
  if (submission.candidate_metadata?.competitor_reference !== undefined) {
    return submission.candidate_metadata.competitor_reference ?? null;
  }

  if (dominantBeatOwners[0]) {
    return `${dominantBeatOwners[0].agent} is a repeat winner on ${submission.candidate_signal.beat}`;
  }

  if (topWinningDomains[0]) {
    return `${topWinningDomains[0].domain} is a recent winning source domain`;
  }

  return null;
}

function inferWhyStyleWasChosen(
  submission: SerializedSubmission,
  styleTested: string,
  exactAnchor: boolean,
  operatorConsequence: boolean,
  broadWinnerShape: boolean
): string {
  if (submission.candidate_metadata?.why_this_style_was_chosen) {
    return submission.candidate_metadata.why_this_style_was_chosen;
  }

  const reasons: string[] = [];
  if (exactAnchor) {
    reasons.push("uses a hard anchor");
  }
  if (operatorConsequence) {
    reasons.push("frames a direct operator consequence");
  }
  if (broadWinnerShape) {
    reasons.push("tests the broader same-beat package instead of a narrow fragment");
  }
  if ((submission.sources ?? []).some((source) => source.source_url?.includes("github.com"))) {
    reasons.push("leans on release-grade proof");
  }

  return reasons.length > 0
    ? `${styleTested}: ${reasons.join("; ")}`
    : `${styleTested}: chosen as the strongest available style from current evidence`;
}

function inferDuplicateStatus(
  submission: SerializedSubmission,
  pendingDuplicateRisk: boolean,
  autoGate?: AutoGateResult
): "clear" | "pending" | "flagged" {
  if (autoGate?.duplicateStatus === "flagged") return "flagged";
  if (autoGate?.duplicateStatus === "pending") return "pending";
  if (submission.candidate_metadata?.duplicate_status) {
    return submission.candidate_metadata.duplicate_status;
  }
  if (submission.candidate_signal.likely_duplicate) return "flagged";
  if (pendingDuplicateRisk) return "pending";
  return "clear";
}

function inferFreshnessStatus(
  submission: SerializedSubmission,
  freshnessRisk: boolean,
  autoGate?: AutoGateResult
): "clear" | "risk_unresolved" | "unknown" {
  if (autoGate !== undefined) return autoGate.freshnessStatus;
  if (submission.candidate_metadata?.freshness_status) {
    return submission.candidate_metadata.freshness_status;
  }
  if (freshnessRisk) return "risk_unresolved";
  return "unknown";
}

function buildCandidateContextText(submission: SerializedSubmission): string {
  return [
    submission.headline,
    submission.candidate_signal.summary,
    submission.candidate_signal.significance,
    submission.candidate_signal.causality,
    ...(submission.proof ?? []).flatMap((item) => [item.query_result, item.proof_note])
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
}

function hasRequiredUpgradeWindow(text: string): boolean {
  return /\brequired upgrade\b|\bgenesis sync\b|\bactivation\b|\bbitcoin block\b|\bupgrade before\b/i.test(text);
}

function readsLikeGenericExternalAdaptation(submission: SerializedSubmission): boolean {
  const sourceTypes = [...new Set(
    (submission.sources ?? [])
      .map((source) => source.source_type)
      .filter((value): value is string => typeof value === "string")
  )];
  const contextText = buildCandidateContextText(submission);

  return (
    sourceTypes.length > 0 &&
    sourceTypes.every((value) => value === "live-feed") &&
    /published this event/i.test(submission.candidate_signal.causality ?? "") &&
    !hasStructuralPattern(contextText) &&
    !hasRequiredUpgradeWindow(contextText)
  );
}

function hasPendingDuplicateRisk(submission: SerializedSubmission): boolean {
  const signals = [
    submission.candidate_signal.duplicate_check_status,
    submission.validation_status?.checks?.duplicate_check_note,
    ...(submission.pre_submission_intelligence?.notes ?? [])
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  return (
    /\bpending\b/.test(signals) &&
    /\bduplicate\b/.test(signals)
  ) || /\bmanual check required\b/.test(signals);
}

function hasFreshnessRisk(submission: SerializedSubmission): boolean {
  const stale = submission.candidate_signal.staleness_risk?.toLowerCase() ?? "";
  return stale.length > 0;
}

function extractPrimarySourceRepo(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return parsed.hostname.replace(/^www\./, "");
    }

    return `${parsed.hostname.replace(/^www\./, "")}/${segments[0]}/${segments[1]}`;
  } catch {
    return null;
  }
}

function extractActivationAnchor(text: string): string | null {
  const blockMatch = text.match(/\bblock\s+(\d[\d,]*)\b/i);
  if (blockMatch) {
    return `block:${blockMatch[1]}`;
  }

  const dateMatch = text.match(/\bactivation is estimated for ([^.]+)/i);
  if (dateMatch) {
    return `activation:${dateMatch[1].trim().toLowerCase()}`;
  }

  return null;
}

function isComponentRelease(submission: SerializedSubmission): boolean {
  const text = `${submission.candidate_signal.candidate_id} ${submission.headline}`.toLowerCase();
  return /\bsigner\b|\bplugin\b|\bsdk\b|\bworker\b|\bcli\b/.test(text);
}

function applyCompanionReleaseAdjustments(
  rankedCandidates: RankedCandidate[],
  parsedSubmissions: ParsedCandidateSubmission[]
): void {
  const rankedById = new Map(rankedCandidates.map((candidate) => [candidate.candidateId, candidate]));
  const grouped = new Map<string, SerializedSubmission[]>();

  for (const { submission } of parsedSubmissions) {
    const primarySource = (submission.sources ?? []).find((source) => source.source_url)?.source_url;
    const repo = extractPrimarySourceRepo(primarySource);
    const activationAnchor = extractActivationAnchor(buildCandidateContextText(submission));

    if (!repo || !activationAnchor) {
      continue;
    }

    const key = `${repo}::${activationAnchor}`;
    const existing = grouped.get(key) ?? [];
    existing.push(submission);
    grouped.set(key, existing);
  }

  for (const submissions of grouped.values()) {
    if (submissions.length < 2) {
      continue;
    }

    const canonical = submissions.find((submission) => !isComponentRelease(submission)) ?? submissions[0];
    const canonicalRanked = rankedById.get(canonical.candidate_signal.candidate_id);
    if (canonicalRanked) {
      canonicalRanked.score = normalizeScore(canonicalRanked.score + 6);
      canonicalRanked.reasons.push("paired-release cluster detected; this is the broader primary release story");
    }

    for (const submission of submissions) {
      if (submission.candidate_signal.candidate_id === canonical.candidate_signal.candidate_id) {
        continue;
      }

      const ranked = rankedById.get(submission.candidate_signal.candidate_id);
      if (!ranked) {
        continue;
      }

      ranked.score = normalizeScore(ranked.score - 8);
      ranked.reasons.push("paired-release cluster detected; this companion release is better folded into the broader primary story");
    }
  }
}

async function scoreCandidate(
  submission: SerializedSubmission,
  context: ScoreContext
): Promise<Omit<RankedCandidate, "sourcePath">> {
  const { optimization, briefSnapshot, agentBehavior, historicalBriefSignals, competitorWinningAngles, autoGate } = context;
  let score = 50;
  const reasons: string[] = [];
  const submissionStatus = getSubmissionStatus(submission);
  const rejectionReasons = getRejectionReasons(submission);
  const editorialReview = getEditorialReview(submission);
  const manualCheckOnlyBlocked = isManualCheckOnly(rejectionReasons);
  const pendingDuplicateRisk =
    hasPendingDuplicateRisk(submission) || autoGate?.duplicateStatus === "pending";
  const freshnessRisk =
    hasFreshnessRisk(submission) || autoGate?.freshnessStatus === "risk_unresolved";
  const sourceDomains = [...new Set(
    (submission.sources ?? [])
      .map((source) => source.source_url)
      .filter((value): value is string => typeof value === "string")
      .map((value) => extractDomain(value))
      .filter((value): value is string => value !== null)
  )];
  const topWinningDomains = (agentBehavior?.commonSourceDomains ?? []).slice(0, 5);
  const winningDomainMatches = topWinningDomains.filter((item) => sourceDomains.includes(item.domain));
  const beatOwners = (agentBehavior?.agents ?? []).filter((agent) =>
    agent.beats.includes(submission.candidate_signal.beat)
  );
  const dominantBeatOwners = beatOwners.filter((agent) => agent.wins >= 2 || agent.sameDayMultiWins >= 1);

  const COMPETITOR_OVERLAP_THRESHOLD = 0.25;
  const competitorCoverage: Array<{ name: string; headline: string; similarity: number }> = [];
  for (const profile of context.competitorProfiles ?? []) {
    let bestSim = 0;
    let bestHeadline = "";
    for (const competitorHeadline of profile.recentHeadlines) {
      const sim = jaccardSimilarity(submission.headline, competitorHeadline);
      if (sim > bestSim) {
        bestSim = sim;
        bestHeadline = competitorHeadline;
      }
    }
    if (bestSim >= COMPETITOR_OVERLAP_THRESHOLD) {
      competitorCoverage.push({ name: profile.name, headline: bestHeadline, similarity: bestSim });
    }
  }
  const candidateContextText = buildCandidateContextText(submission);
  const candidateWinningAngle = inferWinningAngle(candidateContextText);
  const exactAnchor = hasExactAnchor(submission.headline);
  const structuralPattern = hasStructuralPattern(candidateContextText);
  const operatorConsequence = hasOperatorConsequence(candidateContextText);
  const broadWinnerShape = hasBroadWinnerShape(submission, candidateContextText);
  const rawReleaseWithoutOperatorConsequence = isRawReleaseWithoutOperatorConsequence(
    submission,
    operatorConsequence
  );
  const styleTested = inferStyleTestedFromSubmission(
    submission,
    candidateContextText,
    broadWinnerShape,
    operatorConsequence,
    structuralPattern,
    exactAnchor
  );
  const competitorReference = inferCompetitorReferenceFromSubmission(
    submission,
    dominantBeatOwners,
    topWinningDomains
  );
  const whyThisStyleWasChosen = inferWhyStyleWasChosen(
    submission,
    styleTested,
    exactAnchor,
    operatorConsequence,
    broadWinnerShape
  );
  const duplicateStatus = inferDuplicateStatus(submission, pendingDuplicateRisk, autoGate);
  const freshnessStatus = inferFreshnessStatus(submission, freshnessRisk, autoGate);
  const publishability = await assessBeatPublishability(submission.candidate_signal.beat);
  const competitiveness = assessEditorialCompetitiveness({
    headline: submission.headline,
    summary: submission.candidate_signal.summary,
    significance: submission.candidate_signal.significance,
    causality: submission.candidate_signal.causality,
    proofNotes: (submission.proof ?? []).flatMap((item) => [item.query_result, item.proof_note]).filter(
      (value): value is string => typeof value === "string"
    ),
    sourceTypes: (submission.sources ?? [])
      .map((source) => source.source_type)
      .filter((value): value is string => typeof value === "string")
  });
  const approvalReady =
    submissionStatus === "submit" &&
    editorialReview.readyToFile &&
    editorialReview.editorialFit !== "weak" &&
    editorialReview.publisherConfidence !== "low";
  const targetMet = optimization?.successMetrics?.targetMet ?? false;
  const topCandidatePublicationRate = optimization?.topCandidatePerformance?.publicationRate ?? null;

  if (submissionStatus === "submit") {
    score += 12;
    reasons.push("submission gate passed");
  } else if (manualCheckOnlyBlocked) {
    reasons.push("manual checks still missing before this can be filed");
  } else {
    score -= 30;
    reasons.push("submission gate failed on substantive checks");
  }

  if (editorialReview.readyToFile) {
    score += 8;
    reasons.push("editorial review says ready to file");
  } else {
    score -= 8;
    reasons.push("editorial review does not consider it filing-ready");
  }

  if (editorialReview.editorialFit === "strong") {
    score += 6;
    reasons.push("strong editorial fit");
  } else if (editorialReview.editorialFit === "borderline") {
    score += 1;
    reasons.push("borderline editorial fit");
  } else {
    score -= 12;
    reasons.push("weak editorial fit");
  }

  if (editorialReview.publisherConfidence === "high") {
    score += 4;
  } else if (editorialReview.publisherConfidence === "medium") {
    score += 2;
  } else {
    score -= 8;
    reasons.push("low publisher confidence");
  }

  if (submission.headline.length <= 110) {
    score += 2;
  } else if (submission.headline.length > 140) {
    score -= 10;
    reasons.push("headline too long");
  }

  if (hasRawReleaseNoteShape(submission.headline)) {
    score -= 10;
    reasons.push("headline reads like raw release notes instead of a finished filing");
  }

  if (hasArtifactTitleShape(submission.headline)) {
    score -= 8;
    reasons.push("headline starts with a source artifact instead of a publishable news event");
  }

  if (rawReleaseWithoutOperatorConsequence) {
    score -= 25;
    reasons.push("raw release-note framing without operator consequence is not competitive for In Brief");
  }

  if (
    /\bbefore\b|\bearly\b|\bsame day\b/i.test(submission.candidate_signal.significance)
  ) {
    score += 5;
    reasons.push("significance claims timing or novelty edge");
  }

  if (submission.candidate_signal.likely_duplicate || autoGate?.duplicateStatus === "flagged") {
    score -= 20;
    reasons.push("duplicate risk already flagged");
  }

  if (pendingDuplicateRisk) {
    score -= 18;
    reasons.push("unresolved duplicate check is still pending");
  }

  if (freshnessRisk) {
    score -= 10;
    reasons.push("freshness risk must be cleared before filing");
  }

  if (publishability.status !== "publishable") {
    score -= 20;
    reasons.push(...publishability.reasons);
  }

  if (competitiveness.status !== "competitive") {
    score -= 20;
    reasons.push(...competitiveness.reasons);
  }

  if (submission.candidate_signal.uses_dashboard_as_primary_source || autoGate?.dashboardContaminated) {
    score -= 15;
    reasons.push("dashboard-first sourcing risk");
  }

  if (hasRequiredUpgradeWindow(candidateContextText)) {
    score += 8;
    reasons.push("source carries an exact upgrade window or failure threshold operators can act on");
  }

  if (readsLikeGenericExternalAdaptation(submission)) {
    score -= 10;
    reasons.push("external story still reads descriptive rather than like a filing-ready operator signal");
  }

  const beatPreference = optimization?.beatPreferences.find(
    (item) => item.beat === submission.candidate_signal.beat
  );
  const beatCrowding = optimization?.beatCrowding?.find(
    (item) => item.beat === submission.candidate_signal.beat
  );
  const preferredHeadlinePattern = optimization?.winningHeadlinePatterns[0]?.pattern ?? null;
  const headlinePattern = inferHeadlinePattern(submission.headline);
  const stylePerformance = optimization?.stylePerformance?.find((item) => item.style === styleTested);
  const packagingAdjustments = optimization?.packagingAdjustments;

  if (beatPreference?.preference === "increase") {
    score += 10;
    reasons.push(`beat ${beatPreference.beat} is producing published wins`);
  } else if (beatPreference?.preference === "decrease") {
    score -= 10;
    reasons.push(`beat ${beatPreference.beat} is currently crowded or underperforming`);
  }

  if (beatPreference?.publicationRate !== null && beatPreference?.publicationRate !== undefined) {
    if (beatPreference.publicationRate >= 0.5) {
      score += 6;
      reasons.push(`beat ${beatPreference.beat} is converting into published brief wins`);
    } else if (beatPreference.publicationRate < 0.25) {
      score -= 6;
      reasons.push(`beat ${beatPreference.beat} has weak published conversion history`);
    }
  }

  if (beatCrowding && beatCrowding.crowdingScore >= 40) {
    score -= 6;
    reasons.push(`beat ${beatCrowding.beat} is crowded right now`);
  }

  if (optimization?.rejectionThreshold.mode === "tightened") {
    if (!editorialReview.readyToFile) {
      score -= 5;
      reasons.push("current strictness regime punishes non-ready filings");
    }

    if (editorialReview.publisherConfidence !== "high") {
      score -= 4;
      reasons.push("current strictness regime favors cleaner publisher fit");
    }
  }

  if (preferredHeadlinePattern !== null) {
    if (headlinePattern === preferredHeadlinePattern) {
      score += 4;
      reasons.push(`headline matches the current winning pattern (${headlinePattern})`);
    } else {
      score -= 2;
      reasons.push(`headline misses the current winning pattern (${preferredHeadlinePattern})`);
    }
  }

  if (stylePerformance?.preference === "promote") {
    score += 8;
    reasons.push(`style ${styleTested} is converting into In Brief and is currently promoted`);
  } else if (stylePerformance?.preference === "demote") {
    score -= 10;
    reasons.push(`style ${styleTested} is underperforming against the real KPI and is currently demoted`);
  }

  if (stylePerformance?.briefIncludedRate !== null && stylePerformance?.briefIncludedRate !== undefined) {
    if (stylePerformance.briefIncludedRate >= 0.5) {
      score += 4;
      reasons.push(`style ${styleTested} has a strong brief-included conversion history`);
    } else if (stylePerformance.resolvedSubmissions >= 2 && stylePerformance.briefIncludedRate < 0.25) {
      score -= 4;
      reasons.push(`style ${styleTested} has weak brief-included conversion history`);
    }
  }

  if ((stylePerformance?.satsEarned ?? 0) > 0) {
    const satsBoost = Math.min(4, Math.max(1, Math.round((stylePerformance?.satsEarned ?? 0) / 500)));
    score += satsBoost;
    reasons.push(`style ${styleTested} has already converted into wallet sats`);
  } else if ((stylePerformance?.resolvedSubmissions ?? 0) >= 2 && (stylePerformance?.inBriefWins ?? 0) === 0) {
    score -= 5;
    reasons.push(`style ${styleTested} has not converted into In Brief or wallet sats yet`);
  }

  if (candidateWinningAngle && competitorWinningAngles.includes(candidateWinningAngle)) {
    score += 4;
    reasons.push(`candidate matches a competitor winning angle that landed today (${candidateWinningAngle})`);
  } else if (
    competitorWinningAngles.length > 0 &&
    competitiveness.status === "competitive" &&
    candidateWinningAngle === null
  ) {
    score -= 3;
    reasons.push("candidate misses the concrete winning angles top competitors are landing today");
  }

  if (packagingAdjustments?.promoteBroadSameBeatPackaging && styleTested === "broad_same_beat_operator") {
    score += 6;
    reasons.push("recent loss memory says broader same-beat packaging should be promoted");
  }

  if (
    packagingAdjustments?.demoteNarrowFragmentPackaging &&
    styleTested === "single_story_operator_angle" &&
    ((beatCrowding?.crowdingScore ?? 0) >= 40 || dominantBeatOwners.length > 0)
  ) {
    score -= 8;
    reasons.push("recent loss memory says narrow same-beat fragments should be demoted in crowded lanes");
  }

  if (briefSnapshot?.occupiedBeats.includes(submission.candidate_signal.beat)) {
    score -= 8;
    reasons.push(`beat ${submission.candidate_signal.beat} is already occupied in the latest brief snapshot`);
  }

  if (briefSnapshot && briefSnapshot.repeatWinners.length > 0) {
    score -= 3;
    reasons.push("repeat-winner pressure is high in the latest brief snapshot");
  }

  if (approvalReady) {
    reasons.push("candidate already clears the approval-quality floor, so brief-win signals can act as upside");

    if (!targetMet) {
      score -= 3;
      reasons.push("real KPI is still being missed, so approval-ready cleanliness is not enough by itself");
    }

    if (historicalBriefSignals.preferredBeats.includes(submission.candidate_signal.beat)) {
      score += 4;
      reasons.push(`beat ${submission.candidate_signal.beat} matches the historical brief-winning lanes`);
    }

    if (
      historicalBriefSignals.prefersReleaseConsequence &&
      sourceDomains.includes("github.com") &&
      !hasRawReleaseNoteShape(submission.headline) &&
      operatorConsequence
    ) {
      score += 6;
      reasons.push("candidate matches the release-plus-operator-consequence shape recent winners use");
    }

    if (
      historicalBriefSignals.prefersStructuralPatterns &&
      structuralPattern
    ) {
      score += 5;
      reasons.push("candidate matches the structural-pattern behavior that brief winners keep using");
    }

    if (historicalBriefSignals.prefersExactAnchors && exactAnchor) {
      score += 5;
      reasons.push("headline uses the exact numeric or version anchors that top winners favor");
    }

    if (operatorConsequence) {
      score += 5;
      reasons.push("candidate leads with direct operator consequence instead of a descriptive fragment");
    }

    if (broadWinnerShape) {
      score += 5;
      reasons.push("candidate has the broader same-beat packaging shape that converts better into In Brief");
    }

    if (winningDomainMatches.length > 0) {
      score += 8;
      reasons.push(
        `sources match domains that have recently won the brief (${winningDomainMatches.map((item) => item.domain).join(", ")})`
      );
    } else if (sourceDomains.length > 0 && topWinningDomains.length > 0) {
      score -= 4;
      reasons.push("sources do not match the domains that are recently winning the brief");
    }

    if (dominantBeatOwners.length >= 2) {
      score -= broadWinnerShape && operatorConsequence ? 4 : 11;
      reasons.push(`beat ${submission.candidate_signal.beat} is actively owned by repeat-winning agents`);
    } else if (dominantBeatOwners.length === 1) {
      score -= broadWinnerShape && operatorConsequence ? 2 : 7;
      reasons.push(`beat ${submission.candidate_signal.beat} is regularly won by ${dominantBeatOwners[0].agent}`);
    }

    if (dominantBeatOwners.length > 0 && winningDomainMatches.length === 0) {
      score -= 6;
      reasons.push("crowded beat without matching the source pattern recent winners are using");
    }

    if (dominantBeatOwners.length > 0 && !broadWinnerShape) {
      score -= 6;
      reasons.push("narrow packaging is unlikely to beat correspondents already winning this beat");
    }

    if (competitorCoverage.length >= 2) {
      score += 5;
      reasons.push(
        `story validated: ${competitorCoverage.length} tracked competitors also covering this (${competitorCoverage.map((c) => c.name).join(", ")}) — strong brief candidate, ensure angle is differentiated`
      );
    } else if (competitorCoverage.length === 1) {
      reasons.push(
        `1 tracked competitor on similar story: ${competitorCoverage[0].name} — note competition, ensure angle is differentiated`
      );
    } else if (competitiveness.status === "competitive") {
      score += 3;
      reasons.push("no tracked competitors on this story — unique pick advantage");
    } else {
      reasons.push("no tracked competitors on this story, but uniqueness does not help until the story clears the competitive bar");
    }
  } else if (winningDomainMatches.length > 0 || dominantBeatOwners.length > 0) {
    reasons.push("brief-win pattern signals were observed but ignored because the candidate has not cleared the approval-quality floor");
  }

  if (competitorCoverage.length === 0 && !approvalReady) {
    reasons.push("no tracked competitors on this story (unique pick noted, but candidate has not cleared approval-quality floor)");
  }

  if (!targetMet && topCandidatePublicationRate !== null && topCandidatePublicationRate < 0.25) {
    score -= 3;
    reasons.push("recent top candidates are not converting into published wins, so the scorer is leaning harder on outcome signals");
  }

  const normalized = normalizeScore(score);
  let decision: RankedCandidate["decision"] =
    normalized >= 75
      ? "file"
      : normalized >= 45
        ? "hold"
        : "reject";

  if ((manualCheckOnlyBlocked || pendingDuplicateRisk || freshnessRisk) && decision === "file") {
    decision = "hold";
  }

  if (rawReleaseWithoutOperatorConsequence && decision === "file") {
    decision = approvalReady ? "hold" : "reject";
  }

  if (publishability.status !== "publishable" && decision === "file") {
    decision = "hold";
  }

  if (competitiveness.status !== "competitive" && decision === "file") {
    decision = approvalReady ? "hold" : "reject";
  }

  return {
    candidateId: submission.candidate_signal.candidate_id,
    beat: submission.candidate_signal.beat,
    filingBeatSlug: publishability.filingBeatSlug,
    headline: submission.headline,
    score: normalized,
    decision,
    styleTested,
    competitorReference,
    whyThisStyleWasChosen,
    duplicateStatus,
    freshnessStatus,
    publishabilityStatus: publishability.status,
    publishabilityReasons: publishability.reasons,
    competitivenessStatus: competitiveness.status,
    competitivenessReasons: competitiveness.reasons,
    competitorCoverage,
    reasons
  };
}

function detectedBeforeReportDate(
  submission: SerializedSubmission,
  reportDate: string
): boolean {
  const detectedAt = submission.candidate_signal.detected_at;
  return typeof detectedAt === "string" && detectedAt.slice(0, 10) < reportDate;
}

async function saveStalePruningRecord(
  reportDate: string,
  staleSubmissions: ParsedCandidateSubmission[],
  baseDir?: string
): Promise<void> {
  const root = resolve(baseDir ?? process.cwd());
  const filePath = resolve(root, `data/logs/stale-pruning/${reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  const record: StalePruningRecord = {
    kind: "stale_dry_run_pruning",
    reportDate,
    generatedAt: new Date().toISOString(),
    removedCount: staleSubmissions.length,
    removed: staleSubmissions.map(({ sourcePath, submission }) => ({
      candidateId: submission.candidate_signal.candidate_id,
      headline: submission.headline,
      detectedAt: submission.candidate_signal.detected_at ?? null,
      sourcePath,
      reason: `detected_at predates report date ${reportDate}`
    }))
  };
  await writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
}

export async function rankDryRunCandidates(
  reportDate: string,
  baseDir?: string
): Promise<RankedCandidate[]> {
  const root = resolve(baseDir ?? process.cwd());
  const queueDir = resolve(root, `data/dry-runs/${reportDate}`);
  const [optimization, briefSnapshot, agentBehavior, historicalBriefSignals, competitorProfiles, competitorWinningAngles] = await Promise.all([
    readOptimizationSnapshot(reportDate, root),
    readBriefWinnerSnapshot(reportDate, root),
    readAgentBehaviorState(root),
    readHistoricalBriefSignals(root),
    fetchCompetitorProfiles(root),
    readCompetitorWinningAngles(reportDate, root)
  ]);

  let fileNames: string[] = [];
  try {
    fileNames = await readdir(queueDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const parsedSubmissions = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith("-submission.json"))
      .map(async (fileName) => {
        const sourcePath = resolve(queueDir, fileName);
        const submission = JSON.parse(
          await readFile(sourcePath, "utf8")
        ) as SerializedSubmission;
        return {
          sourcePath,
          submission
        } satisfies ParsedCandidateSubmission;
      })
  );

  const staleSubmissions = parsedSubmissions.filter(({ submission }) =>
    detectedBeforeReportDate(submission, reportDate)
  );
  await saveStalePruningRecord(reportDate, staleSubmissions, root);
  await Promise.all(
    staleSubmissions.map(({ sourcePath }) => rm(sourcePath, { force: true }))
  );
  const submissions = parsedSubmissions.filter(({ submission }) =>
    !detectedBeforeReportDate(submission, reportDate)
  );

  const runAt = new Date().toISOString();
  const liveSignals = await fetchLiveSignals();
  const autoGateResults = await Promise.all(
    submissions.map(({ submission }) =>
      runAutoGates(
        submission.candidate_signal.candidate_id,
        submission.headline,
        (submission.sources ?? [])
          .map((s) => s.source_url)
          .filter((u): u is string => typeof u === "string"),
        runAt,
        root,
        liveSignals
      )
    )
  );

  const rankedCandidates = await Promise.all(
    submissions.map(async ({ sourcePath, submission }, index) => ({
      ...(await scoreCandidate(submission, {
        optimization,
        briefSnapshot,
        agentBehavior,
        historicalBriefSignals,
        competitorWinningAngles,
        autoGate: autoGateResults[index],
        competitorProfiles
      })),
      sourcePath
    }) satisfies RankedCandidate)
  );

  applyCompanionReleaseAdjustments(rankedCandidates, submissions);

  const byBeatCounts = new Map<string, number>();
  for (const candidate of [...rankedCandidates].sort((left, right) => right.score - left.score)) {
    const seen = byBeatCounts.get(candidate.beat) ?? 0;
    if (seen === 0) {
      candidate.score = normalizeScore(candidate.score + 5);
      candidate.reasons.push(`beat ${candidate.beat} is needed to keep the daily slate diverse`);
    } else if (seen >= 2) {
      candidate.score = normalizeScore(candidate.score - 6);
      candidate.reasons.push(`daily slate already has multiple ${candidate.beat} candidates`);
    }
    byBeatCounts.set(candidate.beat, seen + 1);
  }

  return rankedCandidates.sort(
    (left, right) => right.score - left.score || left.candidateId.localeCompare(right.candidateId)
  );
}

export async function saveRankedCandidateQueue(
  reportDate: string,
  rankedCandidates: RankedCandidate[],
  baseDir?: string
): Promise<string> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/queues/${reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        kind: "ranked_candidate_queue",
        reportDate,
        generatedAt: new Date().toISOString(),
        candidates: rankedCandidates
      },
      null,
      2
    ),
    "utf8"
  );
  return filePath;
}
