import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadTrainingMemory } from "../learning/index.js";
import type {
  AcceptedSubmissionRecord,
  ApprovalOutcomeRecord,
  CandidateLogRecord,
  DailySuccessMetrics,
  DailyOptimizationSnapshot,
  DuplicateLossPattern,
  LeaderboardObservationRecord,
  OperatorLoadSnapshot,
  RejectionLogRecord,
  RewardOutcomeRecord,
  ScoringFactorAttribution,
  StylePerformanceSnapshot,
  WinningHeadlinePattern
} from "../types/index.js";

interface OptimizationOptions {
  baseDir?: string;
}

interface BriefAgentBehaviorState {
  agents?: Array<{
    agent: string;
    wins: number;
    beats?: string[];
    sameDayMultiWins?: number;
    commonSourceDomains?: Array<{ domain: string; count: number }>;
  }>;
  commonSourceDomains?: Array<{ domain: string; count: number }>;
}

interface RankedQueueSnapshot {
  reportDate: string;
  candidates?: Array<{
    candidateId: string;
    beat?: string;
    score?: number;
    decision?: "file" | "hold" | "reject";
  }>;
}

interface FilingQueueSnapshot {
  reportDate: string;
  topCandidateId: string | null;
  items?: Array<{
    candidateId: string;
    queueStatus?: string;
    reasons?: string[];
  }>;
}

interface CandidateHistorySnapshot {
  candidateId: string;
  beat?: string | null;
  candidateMetadata?: {
    styleTested?: string | null;
  };
  outcome?: {
    status?: "approved" | "rejected" | "submitted" | "unknown" | null;
    publishedInBrief?: boolean | null;
    learningWhy?: string | null;
    note?: string | null;
  };
  liveOpsEvidence?: {
    approval?: {
      decision?: "approve" | "reject" | null;
      reviewedAt?: string | null;
    };
  };
}

interface FactorDefinition {
  factor: string;
  label: string;
  effect: "boost" | "penalty";
}

interface SubmissionFactorContext {
  sourceDomains: string[];
  topWinningDomains: Array<{ domain: string; count: number }>;
  dominantBeatOwners: Array<{ agent: string; wins: number; sameDayMultiWins?: number; beats?: string[] }>;
}

type DailyRecord =
  | CandidateLogRecord
  | RejectionLogRecord
  | AcceptedSubmissionRecord
  | ApprovalOutcomeRecord
  | RewardOutcomeRecord
  | LeaderboardObservationRecord;

function resolveBaseDir(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd());
}

function isSameDay(timestamp: string, reportDate: string): boolean {
  return timestamp.slice(0, 10) === reportDate;
}

function formatRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }

  return Number((numerator / denominator).toFixed(2));
}

function isOnOrBeforeReportDate(timestamp: string, reportDate: string): boolean {
  return timestamp.slice(0, 10) <= reportDate;
}

function inferStyleFromSubmissionRecord(submission: AcceptedSubmissionRecord["submission"]): string {
  if (submission.candidateMetadata?.styleTested) {
    return submission.candidateMetadata.styleTested;
  }

  const headline = submission.headline.toLowerCase();
  const context = [
    submission.candidateSignal.summary,
    submission.candidateSignal.significance,
    submission.candidateSignal.causality
  ].join(" ").toLowerCase();

  if ((headline.includes(" and ") || headline.includes(" plus ") || /\b\d[\d,.]*\b.*\b\d[\d,.]*\b/.test(submission.headline)) &&
      /\bupgrade|risk|window|operator|agent|structural|system\b/.test(context)) {
    return "broad_same_beat_operator";
  }

  if (submission.sources.some((source) => source.sourceUrl.includes("github.com")) &&
      /\bupgrade|risk|window|operator|agent|payment|security\b/.test(context)) {
    return "release_operator_consequence";
  }

  if (/\bqueue|bottleneck|concentration|backlog|saturation|structural|threshold\b/.test(context)) {
    return "structural_pattern";
  }

  if (/\b\d[\d,.]*\b/.test(submission.headline) &&
      /\bbefore|early|same day|deadline|activation\b/.test(context)) {
    return "exact_anchor_timing";
  }

  return "single_story_operator_angle";
}

function normalizeBeat(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function extractDomain(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function buildSubmissionContextText(submission: AcceptedSubmissionRecord["submission"]): string {
  return [
    submission.headline,
    submission.candidateSignal.summary,
    submission.candidateSignal.significance,
    submission.candidateSignal.causality,
    ...(submission.proof ?? []).flatMap((item) => [item.queryResult, item.proofNote])
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
}

function hasExactAnchor(text: string): boolean {
  return /\b\d[\d,.]*\b/.test(text) || /\bv\d+\.\d+(?:\.\d+)?\b/i.test(text);
}

function hasStructuralPattern(text: string): boolean {
  return /\bcluster|gap|bottleneck|threshold|saturation|queue|concentration|backlog|lead|dominat/i.test(text);
}

function hasOperatorConsequence(text: string): boolean {
  return /\bagents should\b|\boperators should\b|\bmatters because\b|\brequires\b|\bupgrade\b|\brisk\b|\bwindow\b|\bconsequence\b/i.test(text);
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

function hasRequiredUpgradeWindow(text: string): boolean {
  return /\brequired upgrade\b|\bgenesis sync\b|\bactivation\b|\bbitcoin block\b|\bupgrade before\b/i.test(text);
}

function hasBroadWinnerShape(submission: AcceptedSubmissionRecord["submission"], text: string): boolean {
  const numericAnchors = submission.headline.match(/\b\d[\d,.]*\b/g) ?? [];
  return (
    /\b(and|plus|simultaneous|bundle|bundled|combined|cluster)\b/i.test(submission.headline) ||
    /\bstructural\b|\bsystem\b|\bnetwork-level\b|\bnetwork wide\b|\bbroader same-beat\b|\bbroader package\b|\bbroader story\b/i.test(text) ||
    numericAnchors.length >= 2
  );
}

function readsLikeGenericExternalAdaptation(submission: AcceptedSubmissionRecord["submission"], contextText: string): boolean {
  const sourceTypes = [...new Set(
    submission.sources
      .map((source) => source.sourceType)
      .filter((value) => typeof value === "string")
  )];

  return (
    sourceTypes.length > 0 &&
    sourceTypes.every((value) => value === "live-feed") &&
    /published this event/i.test(submission.candidateSignal.causality) &&
    !hasStructuralPattern(contextText) &&
    !hasRequiredUpgradeWindow(contextText)
  );
}

function inferSubmissionFactors(
  submission: AcceptedSubmissionRecord["submission"],
  context: SubmissionFactorContext
): string[] {
  const contextText = buildSubmissionContextText(submission);
  const inferredStyle = submission.candidateMetadata.styleTested || inferStyleFromSubmissionRecord(submission);
  const exactAnchor = hasExactAnchor(submission.headline);
  const structuralPattern = hasStructuralPattern(contextText);
  const operatorConsequence = hasOperatorConsequence(contextText);
  const broadWinnerShape = hasBroadWinnerShape(submission, contextText);
  const sourceDomains = context.sourceDomains;
  const winningDomainMatches = context.topWinningDomains.filter((item) => sourceDomains.includes(item.domain));
  const rawReleaseWithoutOperatorConsequence =
    (hasRawReleaseNoteShape(submission.headline) || hasArtifactTitleShape(submission.headline)) &&
    !operatorConsequence;

  const factors: string[] = [];

  if (broadWinnerShape || inferredStyle === "broad_same_beat_operator") {
    factors.push("broad_same_beat_packaging");
  }
  if (operatorConsequence) {
    factors.push("direct_operator_consequence");
  }
  if (exactAnchor) {
    factors.push("exact_anchor");
  }
  if (structuralPattern) {
    factors.push("structural_pattern");
  }
  if (submission.sources.some((source) => source.sourceUrl.includes("github.com")) || inferredStyle === "release_operator_consequence") {
    factors.push("release_grade_proof");
  }
  if (winningDomainMatches.length > 0) {
    factors.push("winning_source_domain_match");
  }
  if (context.dominantBeatOwners.length > 0 && winningDomainMatches.length === 0) {
    factors.push("crowded_beat_without_winning_domain_match");
  }
  if (context.dominantBeatOwners.length > 0 && !broadWinnerShape) {
    factors.push("narrow_packaging_in_competitor_lane");
  }
  if (rawReleaseWithoutOperatorConsequence) {
    factors.push("raw_release_without_operator_consequence");
  }
  if (submission.candidateSignal.usesDashboardAsPrimarySource) {
    factors.push("dashboard_first_sourcing");
  }
  if (submission.candidateSignal.likelyDuplicate) {
    factors.push("duplicate_risk");
  }
  if (submission.candidateMetadata.freshnessStatus === "risk_unresolved") {
    factors.push("freshness_risk");
  }
  if (readsLikeGenericExternalAdaptation(submission, contextText)) {
    factors.push("generic_external_adaptation");
  }

  return factors;
}

const FACTOR_DEFINITIONS: FactorDefinition[] = [
  {
    factor: "broad_same_beat_packaging",
    label: "Broader same-beat packaging",
    effect: "boost"
  },
  {
    factor: "direct_operator_consequence",
    label: "Direct operator consequence",
    effect: "boost"
  },
  {
    factor: "exact_anchor",
    label: "Exact numeric or version anchor",
    effect: "boost"
  },
  {
    factor: "structural_pattern",
    label: "Structural pattern framing",
    effect: "boost"
  },
  {
    factor: "release_grade_proof",
    label: "Release-grade proof",
    effect: "boost"
  },
  {
    factor: "winning_source_domain_match",
    label: "Winning source-domain match",
    effect: "boost"
  },
  {
    factor: "crowded_beat_without_winning_domain_match",
    label: "Crowded beat without winning-domain match",
    effect: "penalty"
  },
  {
    factor: "narrow_packaging_in_competitor_lane",
    label: "Narrow packaging in competitor-owned lane",
    effect: "penalty"
  },
  {
    factor: "raw_release_without_operator_consequence",
    label: "Raw release framing without operator consequence",
    effect: "penalty"
  },
  {
    factor: "dashboard_first_sourcing",
    label: "Dashboard-first sourcing",
    effect: "penalty"
  },
  {
    factor: "duplicate_risk",
    label: "Duplicate risk",
    effect: "penalty"
  },
  {
    factor: "freshness_risk",
    label: "Freshness risk",
    effect: "penalty"
  },
  {
    factor: "generic_external_adaptation",
    label: "Generic external adaptation",
    effect: "penalty"
  }
];

function buildSuccessMetrics(
  approvals: ApprovalOutcomeRecord[],
  rewards: RewardOutcomeRecord[]
): DailySuccessMetrics {
  const inBriefWins = approvals.filter((approval) => approval.published === true).length;
  const satsEarned = rewards.reduce(
    (total, reward) => total + (typeof reward.satsEarned === "number" ? reward.satsEarned : 0),
    0
  );
  const btcRewards = rewards
    .map((reward) => reward.btcRewardEarned)
    .filter((reward): reward is string => typeof reward === "string" && reward.length > 0);
  const targetInBriefWins = 5;

  return {
    targetInBriefWins,
    inBriefWins,
    satsEarned,
    btcRewards,
    targetMet: inBriefWins >= targetInBriefWins && satsEarned > 0,
    successDefinition: "Success means getting paid and landing In Brief; approvals alone do not count."
  };
}

async function readDailyRecords<T extends DailyRecord>(
  relativeDir: string,
  reportDate: string,
  baseDir?: string
): Promise<T[]> {
  const absoluteDir = resolve(resolveBaseDir(baseDir), relativeDir);

  try {
    const fileNames = await readdir(absoluteDir);
    const records = await Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".json"))
        .map(async (fileName) => {
          const contents = await readFile(resolve(absoluteDir, fileName), "utf8");
          return JSON.parse(contents) as T;
        })
    );

    return records.filter((record) => isSameDay(record.recordedAt, reportDate));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readAllRecords<T extends DailyRecord>(
  relativeDir: string,
  baseDir?: string
): Promise<T[]> {
  const absoluteDir = resolve(resolveBaseDir(baseDir), relativeDir);

  try {
    const fileNames = await readdir(absoluteDir);
    return Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".json"))
        .map(async (fileName) => {
          const contents = await readFile(resolve(absoluteDir, fileName), "utf8");
          return JSON.parse(contents) as T;
        })
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function buildWinningHeadlinePatterns(headlines: string[]): WinningHeadlinePattern[] {
  const patternCounts = new Map<string, number>();

  for (const headline of headlines) {
    const normalized = headline.toLowerCase();
    const patterns = new Set<string>();

    if (normalized.includes(" because ")) {
      patterns.add("because-causality");
    }
    if (normalized.includes(", signaling ")) {
      patterns.add("signaling-significance");
    }
    if (normalized.includes("which suggests")) {
      patterns.add("which-suggests-significance");
    }
    if (normalized.includes(" before ")) {
      patterns.add("before-advantage");
    }
    if (headline.length <= 90) {
      patterns.add("short-form");
    } else if (headline.length <= 140) {
      patterns.add("full-length");
    }

    if (patterns.size === 0) {
      patterns.add("summary-led");
    }

    for (const pattern of patterns) {
      patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
    }
  }

  return [...patternCounts.entries()]
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((left, right) => right.count - left.count || left.pattern.localeCompare(right.pattern));
}

function buildDuplicateLossPatterns(
  rejections: RejectionLogRecord[],
  beatByCandidateId: Map<string, string>
): DuplicateLossPattern[] {
  const grouped = new Map<string, string[]>();

  for (const rejection of rejections) {
    if (!rejection.reasons.includes("likely_duplicate")) {
      continue;
    }

    const beat = beatByCandidateId.get(rejection.candidateId) ?? "unknown";
    const candidateIds = grouped.get(beat) ?? [];
    candidateIds.push(rejection.candidateId);
    grouped.set(beat, candidateIds);
  }

  return [...grouped.entries()]
    .map(([beat, candidateIds]) => ({
      beat,
      count: candidateIds.length,
      candidateIds: candidateIds.sort()
    }))
    .sort((left, right) => right.count - left.count || left.beat.localeCompare(right.beat));
}

function buildBeatPreferences(
  beatByCandidateId: Map<string, string>,
  detections: CandidateLogRecord[],
  submissions: AcceptedSubmissionRecord[],
  approvals: ApprovalOutcomeRecord[],
  duplicateLossPatterns: DuplicateLossPattern[]
): DailyOptimizationSnapshot["beatPreferences"] {
  const allBeats = new Set<string>();

  const detectionCounts = new Map<string, number>();
  const submissionCounts = new Map<string, number>();
  const approvalCounts = new Map<string, number>();
  const publicationCounts = new Map<string, number>();
  const resolvedSubmissionCounts = new Map<string, number>();
  const duplicateLossCounts = new Map<string, number>();
  const approvalsByCandidateId = new Map(approvals.map((record) => [record.candidateId, record]));

  for (const detection of detections) {
    allBeats.add(detection.candidate.beat);
    detectionCounts.set(
      detection.candidate.beat,
      (detectionCounts.get(detection.candidate.beat) ?? 0) + 1
    );
  }

  for (const submission of submissions) {
    const beat =
      beatByCandidateId.get(submission.candidateId) ?? submission.submission.candidateSignal.beat;
    allBeats.add(beat);
    submissionCounts.set(beat, (submissionCounts.get(beat) ?? 0) + 1);
    if (approvalsByCandidateId.has(submission.candidateId)) {
      resolvedSubmissionCounts.set(beat, (resolvedSubmissionCounts.get(beat) ?? 0) + 1);
    }
  }

  for (const approval of approvals) {
    const beat = beatByCandidateId.get(approval.candidateId);
    if (!beat) {
      continue;
    }

    allBeats.add(beat);
    if (approval.approved) {
      approvalCounts.set(beat, (approvalCounts.get(beat) ?? 0) + 1);
    }
    if (approval.published) {
      publicationCounts.set(beat, (publicationCounts.get(beat) ?? 0) + 1);
    }
  }

  for (const duplicateLoss of duplicateLossPatterns) {
    allBeats.add(duplicateLoss.beat);
    duplicateLossCounts.set(duplicateLoss.beat, duplicateLoss.count);
  }

  return [...allBeats]
    .sort((left, right) => left.localeCompare(right))
    .map((beat) => {
      const detectionsForBeat = detectionCounts.get(beat) ?? 0;
      const submissionsForBeat = submissionCounts.get(beat) ?? 0;
      const resolvedSubmissionsForBeat = resolvedSubmissionCounts.get(beat) ?? 0;
      const approvalsForBeat = approvalCounts.get(beat) ?? 0;
      const publishedForBeat = publicationCounts.get(beat) ?? 0;
      const duplicateLossesForBeat = duplicateLossCounts.get(beat) ?? 0;
      const approvalRate = formatRatio(approvalsForBeat, resolvedSubmissionsForBeat);
      const publicationRate = formatRatio(publishedForBeat, resolvedSubmissionsForBeat);

      if (publishedForBeat > 0 && duplicateLossesForBeat === 0) {
        return {
          beat,
          detections: detectionsForBeat,
          submissions: submissionsForBeat,
          approvals: approvalsForBeat,
          published: publishedForBeat,
          duplicateLosses: duplicateLossesForBeat,
          approvalRate,
          publicationRate,
          preference: "increase" as const,
          rationale: "Published wins landed without duplicate losses."
        };
      }

      if (approvalsForBeat > 0 && duplicateLossesForBeat === 0) {
        return {
          beat,
          detections: detectionsForBeat,
          submissions: submissionsForBeat,
          approvals: approvalsForBeat,
          published: publishedForBeat,
          duplicateLosses: duplicateLossesForBeat,
          approvalRate,
          publicationRate,
          preference: "hold" as const,
          rationale: "Approvals landed, but no compiled-brief win is recorded yet."
        };
      }

      if (
        duplicateLossesForBeat > 0 ||
        (resolvedSubmissionsForBeat > 0 && approvalsForBeat === 0)
      ) {
        return {
          beat,
          detections: detectionsForBeat,
          submissions: submissionsForBeat,
          approvals: approvalsForBeat,
          published: publishedForBeat,
          duplicateLosses: duplicateLossesForBeat,
          approvalRate,
          publicationRate,
          preference: "decrease" as const,
          rationale: duplicateLossesForBeat > 0
            ? "Duplicate pressure suggests this beat is crowded."
            : "Submissions failed to convert into approvals or published wins."
        };
      }

      return {
        beat,
        detections: detectionsForBeat,
        submissions: submissionsForBeat,
        approvals: approvalsForBeat,
        published: publishedForBeat,
        duplicateLosses: duplicateLossesForBeat,
        approvalRate,
        publicationRate,
        preference: "hold" as const,
        rationale: "Outcome data is still limited, so keep the current focus steady."
      };
    });
}

function buildThresholdAdjustment(
  rejections: RejectionLogRecord[],
  submissions: AcceptedSubmissionRecord[],
  approvals: ApprovalOutcomeRecord[],
  duplicateLossPatterns: DuplicateLossPattern[]
): DailyOptimizationSnapshot["rejectionThreshold"] {
  const drivers: string[] = [];
  const approvalsByCandidateId = new Map(approvals.map((record) => [record.candidateId, record]));
  const resolvedSubmissions = submissions.filter((record) => approvalsByCandidateId.has(record.candidateId));
  const resolvedApprovalRate = formatRatio(
    resolvedSubmissions.filter((record) => approvalsByCandidateId.get(record.candidateId)?.approved === true).length,
    resolvedSubmissions.length
  );
  const resolvedPublicationRate = formatRatio(
    resolvedSubmissions.filter((record) => approvalsByCandidateId.get(record.candidateId)?.published === true).length,
    resolvedSubmissions.length
  );

  if (duplicateLossPatterns.some((pattern) => pattern.count > 0)) {
    drivers.push("tighten duplicate rejection when a candidate resembles same-day signals");
  }

  const proofOrCausalityFailures = rejections.filter((record) =>
    record.reasons.includes("proof_missing") || record.reasons.includes("causality_missing")
  ).length;

  if (proofOrCausalityFailures > 0 || (resolvedApprovalRate !== null && resolvedApprovalRate < 0.5)) {
    drivers.push("tighten proof and causality thresholds when approval rate slips");
  }

  if (
    resolvedPublicationRate !== null &&
    resolvedApprovalRate !== null &&
    resolvedApprovalRate >= 0.5 &&
    resolvedPublicationRate < 0.25
  ) {
    drivers.push("tighten publisher-fit thresholds when approvals are landing but brief wins are scarce");
  }

  if (drivers.length === 0) {
    drivers.push("keep current rejection thresholds unchanged until more outcome data lands");
    return { mode: "standard", drivers };
  }

  return { mode: "tightened", drivers };
}

function buildStylePerformance(
  submissions: AcceptedSubmissionRecord[],
  approvals: ApprovalOutcomeRecord[],
  rewards: RewardOutcomeRecord[],
  histories: CandidateHistorySnapshot[],
  reportDate: string
): StylePerformanceSnapshot[] {
  const statsByStyle = new Map<
    string,
    { submissions: number; resolvedSubmissions: number; approvals: number; inBriefWins: number; satsEarned: number }
  >();
  const historyById = new Map(histories.map((history) => [history.candidateId, history]));
  const approvalByCandidateId = new Map(
    approvals
      .filter((record) => isOnOrBeforeReportDate(record.recordedAt, reportDate))
      .map((record) => [record.candidateId, record])
  );
  const rewardByCandidateId = new Map(
    rewards
      .filter((record) => isOnOrBeforeReportDate(record.recordedAt, reportDate))
      .map((record) => [record.candidateId, record])
  );

  for (const submission of submissions.filter((record) => isOnOrBeforeReportDate(record.recordedAt, reportDate))) {
    const historyStyle = historyById.get(submission.candidateId)?.candidateMetadata?.styleTested ?? null;
    const style = historyStyle || inferStyleFromSubmissionRecord(submission.submission);
    const current = statsByStyle.get(style) ?? {
      submissions: 0,
      resolvedSubmissions: 0,
      approvals: 0,
      inBriefWins: 0,
      satsEarned: 0
    };
    current.submissions += 1;

    const approval = approvalByCandidateId.get(submission.candidateId);
    if (approval) {
      current.resolvedSubmissions += 1;
      if (approval.approved) {
        current.approvals += 1;
      }
      if (approval.published) {
        current.inBriefWins += 1;
      }
    }

    const reward = rewardByCandidateId.get(submission.candidateId);
    if (typeof reward?.satsEarned === "number") {
      current.satsEarned += reward.satsEarned;
    }

    statsByStyle.set(style, current);
  }

  return [...statsByStyle.entries()]
    .map(([style, value]) => {
      const approvalRate = formatRatio(value.approvals, value.resolvedSubmissions);
      const briefIncludedRate = formatRatio(value.inBriefWins, value.resolvedSubmissions);
      let preference: StylePerformanceSnapshot["preference"] = "hold";
      let rationale = "Outcome history is still thin, so keep testing this style without a hard preference shift.";

      if (value.inBriefWins > 0 && (briefIncludedRate ?? 0) >= 0.5) {
        preference = "promote";
        rationale = "This style is converting into In Brief and should be promoted in ranking decisions.";
      } else if (value.approvals > 0 && value.inBriefWins === 0) {
        preference = "demote";
        rationale = "This style can get approved without winning In Brief, so demote it until packaging improves.";
      } else if (value.resolvedSubmissions >= 2 && value.approvals === 0) {
        preference = "demote";
        rationale = "This style keeps losing before approval, so reduce exposure until it proves it can convert.";
      }

      return {
        style,
        submissions: value.submissions,
        resolvedSubmissions: value.resolvedSubmissions,
        approvals: value.approvals,
        inBriefWins: value.inBriefWins,
        approvalRate,
        briefIncludedRate,
        satsEarned: value.satsEarned,
        preference,
        rationale
      };
    })
    .sort((left, right) =>
      right.inBriefWins - left.inBriefWins ||
      right.satsEarned - left.satsEarned ||
      right.approvals - left.approvals ||
      left.style.localeCompare(right.style)
    );
}

function buildFactorAttribution(
  submissions: AcceptedSubmissionRecord[],
  approvals: ApprovalOutcomeRecord[],
  reportDate: string,
  behavior: BriefAgentBehaviorState | null
): ScoringFactorAttribution[] {
  const approvalByCandidateId = new Map(
    approvals
      .filter((record) => isOnOrBeforeReportDate(record.recordedAt, reportDate))
      .map((record) => [record.candidateId, record])
  );
  const topWinningDomains = (behavior?.commonSourceDomains ?? []).slice(0, 5);
  const behaviorAgents = behavior?.agents ?? [];
  const statsByFactor = new Map<
    string,
    { resolvedSubmissions: number; inBriefWins: number; approvedNotInBrief: number; rejected: number }
  >();

  for (const definition of FACTOR_DEFINITIONS) {
    statsByFactor.set(definition.factor, {
      resolvedSubmissions: 0,
      inBriefWins: 0,
      approvedNotInBrief: 0,
      rejected: 0
    });
  }

  for (const submissionRecord of submissions.filter((record) => isOnOrBeforeReportDate(record.recordedAt, reportDate))) {
    const approval = approvalByCandidateId.get(submissionRecord.candidateId);
    if (!approval) {
      continue;
    }

    const sourceDomains = [...new Set(
      submissionRecord.submission.sources
        .map((source) => source.sourceUrl)
        .filter((value): value is string => typeof value === "string")
        .map((value) => extractDomain(value))
        .filter((value): value is string => value !== null)
    )];
    const normalizedBeat = normalizeBeat(submissionRecord.submission.candidateSignal.beat);
    const dominantBeatOwners = behaviorAgents.filter((agent) =>
      (agent.beats ?? []).map(normalizeBeat).includes(normalizedBeat) &&
      (agent.wins >= 2 || (agent.sameDayMultiWins ?? 0) >= 1)
    );
    const presentFactors = inferSubmissionFactors(submissionRecord.submission, {
      sourceDomains,
      topWinningDomains,
      dominantBeatOwners
    });

    for (const factor of presentFactors) {
      const stats = statsByFactor.get(factor);
      if (!stats) {
        continue;
      }

      stats.resolvedSubmissions += 1;
      if (approval.approved && approval.published === true) {
        stats.inBriefWins += 1;
      } else if (approval.approved) {
        stats.approvedNotInBrief += 1;
      } else {
        stats.rejected += 1;
      }
    }
  }

  return FACTOR_DEFINITIONS
    .map((definition) => {
      const stats = statsByFactor.get(definition.factor) ?? {
        resolvedSubmissions: 0,
        inBriefWins: 0,
        approvedNotInBrief: 0,
        rejected: 0
      };
      const failures = stats.approvedNotInBrief + stats.rejected;
      const approvalRate = formatRatio(stats.inBriefWins + stats.approvedNotInBrief, stats.resolvedSubmissions);
      const publicationRate = formatRatio(stats.inBriefWins, stats.resolvedSubmissions);
      let verdict: ScoringFactorAttribution["verdict"] = "mixed";

      if (stats.resolvedSubmissions < 2) {
        verdict = "insufficient_evidence";
      } else if (definition.effect === "boost") {
        if (stats.inBriefWins > failures && (publicationRate ?? 0) >= 0.5) {
          verdict = "validated";
        } else if (stats.inBriefWins === 0) {
          verdict = "disproved";
        }
      } else if (failures > stats.inBriefWins && (publicationRate ?? 0) < 0.5) {
        verdict = "validated";
      } else if (failures === 0 && stats.inBriefWins > 0) {
        verdict = "disproved";
      }

      let rationale = `${stats.inBriefWins}/${stats.resolvedSubmissions} resolved submissions with this factor won In Brief.`;
      if (verdict === "validated") {
        rationale = definition.effect === "boost"
          ? `${definition.label} is helping more than hurting: ${stats.inBriefWins} In Brief win(s), ${stats.approvedNotInBrief} approved-not-in-brief miss(es), ${stats.rejected} rejection(s).`
          : `${definition.label} is earning its penalty: ${failures} of ${stats.resolvedSubmissions} resolved submissions still failed the real KPI.`;
      } else if (verdict === "disproved") {
        rationale = definition.effect === "boost"
          ? `${definition.label} is not earning a boost yet: ${stats.approvedNotInBrief + stats.rejected} failure(s) and no In Brief wins in ${stats.resolvedSubmissions} resolved submissions.`
          : `${definition.label} did not behave like a warning sign here: ${stats.inBriefWins} resolved submission(s) still won In Brief.`;
      } else if (verdict === "insufficient_evidence") {
        rationale = `${definition.label} only appeared in ${stats.resolvedSubmissions} resolved submission(s), so outcome evidence is still thin.`;
      }

      return {
        factor: definition.factor,
        label: definition.label,
        effect: definition.effect,
        resolvedSubmissions: stats.resolvedSubmissions,
        inBriefWins: stats.inBriefWins,
        approvedNotInBrief: stats.approvedNotInBrief,
        rejected: stats.rejected,
        approvalRate,
        publicationRate,
        verdict,
        rationale
      };
    })
    .sort((left, right) =>
      right.resolvedSubmissions - left.resolvedSubmissions ||
      right.inBriefWins - left.inBriefWins ||
      left.label.localeCompare(right.label)
    );
}

function buildPackagingAdjustments(
  recentApprovedNotInBriefLearnings: string[]
): NonNullable<DailyOptimizationSnapshot["packagingAdjustments"]> {
  const broaderSameBeatLosses = recentApprovedNotInBriefLearnings.filter((learning) =>
    /\bbroader\b|\bsame-beat\b|\bsame day\b|\boutcompeted\b|\blost to\b/i.test(learning)
  );
  const packagingLosses = recentApprovedNotInBriefLearnings.filter((learning) =>
    /\barticle-shaped\b|\bpackage\b|\bpackaging\b|\bbundl/i.test(learning)
  );
  const rationale: string[] = [];

  if (broaderSameBeatLosses.length > 0) {
    rationale.push("Recent approved-but-not-published outcomes lost to broader same-beat stories.");
  }
  if (packagingLosses.length > 0) {
    rationale.push("Recent losses say packaging was too fragmented or not article-shaped enough.");
  }

  return {
    promoteBroadSameBeatPackaging: broaderSameBeatLosses.length > 0 || packagingLosses.length > 0,
    demoteNarrowFragmentPackaging: broaderSameBeatLosses.length > 0,
    rationale
  };
}

function buildNextDayRecommendations(
  snapshot: Omit<DailyOptimizationSnapshot, "kind" | "generatedAt">,
  options: {
    recentApprovedNotInBriefLearnings?: string[];
  } = {}
): string[] {
  const recommendations: string[] = [];
  const increasedBeat = snapshot.beatPreferences.find((beat) => beat.preference === "increase");
  const decreasedBeat = snapshot.beatPreferences.find((beat) => beat.preference === "decrease");
  const topDuplicateLoss = snapshot.duplicateLossPatterns[0];
  const topHeadlinePattern = snapshot.winningHeadlinePatterns[0];
  const topWinningTag = snapshot.trainingWinningTags[0];
  const topRejectionTag = snapshot.trainingRejectionTags[0];
  const approvedNotInBriefLearnings = options.recentApprovedNotInBriefLearnings ?? [];
  const broaderSameBeatLosses = approvedNotInBriefLearnings.filter((learning) =>
    /\bbroader\b|\bsame-beat\b|\bsame day\b|\boutcompeted\b|\blost to\b/i.test(learning)
  );
  const packagingLosses = approvedNotInBriefLearnings.filter((learning) =>
    /\barticle-shaped\b|\bpackage\b|\bpackaging\b|\bbundl/i.test(learning)
  );
  const promotedStyle = snapshot.stylePerformance.find((style) => style.preference === "promote");
  const demotedStyle = snapshot.stylePerformance.find((style) => style.preference === "demote");
  const packagingAdjustments = snapshot.packagingAdjustments;
  const validatedFactor = snapshot.factorAttribution.find((factor) => factor.verdict === "validated");
  const disprovedFactor = snapshot.factorAttribution.find((factor) => factor.verdict === "disproved");
  const operatorLoad = snapshot.operatorLoad;

  if (broaderSameBeatLosses.length > 0) {
    recommendations.push(
      "Step 0 lesson: recent approved-but-not-published signals lost to broader same-day stories, so do not file a narrow component update when a stronger same-beat package is available."
    );
  }

  if (!snapshot.successMetrics.targetMet) {
    recommendations.push(
      `Target still missed: ${snapshot.successMetrics.inBriefWins}/${snapshot.successMetrics.targetInBriefWins} In Brief wins and ${snapshot.successMetrics.satsEarned} sats recorded. Until both improve, optimize for brief-slot wins and payout, not approval count.`
    );
  }

  if (packagingLosses.length > 0) {
    recommendations.push(
      "Package related release activity into one operator-facing story with consequence up top; approval-quality fragments are still losing the brief slot."
    );
  }

  if (increasedBeat) {
    recommendations.push(`Lean harder into ${increasedBeat.beat}; it produced the strongest published outcome today.`);
  }

  if (decreasedBeat) {
    recommendations.push(`Be more selective on ${decreasedBeat.beat} until approval quality or timing improves.`);
  }

  if (snapshot.rejectionThreshold.mode === "tightened") {
    recommendations.push(snapshot.rejectionThreshold.drivers[0]);
  }

  if (topDuplicateLoss) {
    recommendations.push(
      `Watch for duplicate pressure in ${topDuplicateLoss.beat}; ${topDuplicateLoss.count} candidate${topDuplicateLoss.count === 1 ? "" : "s"} lost on duplicate risk today.`
    );
  }

  if (topHeadlinePattern) {
    recommendations.push(
      `Favor ${topHeadlinePattern.pattern} headlines next run because they matched today's approved winners best.`
    );
  }

  if (topWinningTag) {
    recommendations.push(
      `Bias toward candidates with ${topWinningTag.tag}; it is the most common tag in the historical in-brief training set.`
    );
  }

  if (topRejectionTag) {
    recommendations.push(
      `Reject or rewrite candidates that look like ${topRejectionTag.tag}; it is the most common reject pattern in training data.`
    );
  }

  if (promotedStyle) {
    recommendations.push(
      `Promote ${promotedStyle.style}; it is converting at ${promotedStyle.briefIncludedRate ?? 0} brief-included rate with ${promotedStyle.satsEarned} sats earned.`
    );
  }

  if (demotedStyle) {
    recommendations.push(
      `Demote ${demotedStyle.style}; it is not turning resolved submissions into real In Brief wins yet.`
    );
  }

  if (validatedFactor) {
    recommendations.push(
      `Validated scoring factor: ${validatedFactor.label} (${validatedFactor.inBriefWins}/${validatedFactor.resolvedSubmissions} resolved submissions reached In Brief).`
    );
  }

  if (disprovedFactor) {
    recommendations.push(
      `Disproved scoring factor: ${disprovedFactor.label} (${disprovedFactor.inBriefWins}/${disprovedFactor.resolvedSubmissions} resolved submissions reached In Brief).`
    );
  }

  if (operatorLoad?.status === "heavy") {
    recommendations.push(
      `Operator load is heavy (${operatorLoad.loadScore}): ${operatorLoad.headlineRewriteRequiredCount} rewrite(s), ${operatorLoad.rankingOverrideCount} ranking override(s), ${operatorLoad.skippedSignableCount} skipped signable candidate(s).`
    );
  } else if (operatorLoad?.status === "moderate") {
    recommendations.push(
      `Operator load is still moderate (${operatorLoad.loadScore}); keep reducing rewrites, overrides, and untouched signable candidates.`
    );
  }

  if (packagingAdjustments?.promoteBroadSameBeatPackaging) {
    recommendations.push(
      "Promote broader same-beat packaging in crowded lanes; recent losses show narrow fragments are not enough."
    );
  }

  if (packagingAdjustments?.demoteNarrowFragmentPackaging) {
    recommendations.push(
      "Demote narrow component-only filings when repeat winners are taking the slot with a broader package."
    );
  }

  if (snapshot.competitorIntel.recommendations[0]) {
    recommendations.push(snapshot.competitorIntel.recommendations[0]);
  }

  if (snapshot.topCandidatePerformance.recommendations[0]) {
    recommendations.push(snapshot.topCandidatePerformance.recommendations[0]);
  }

  if (recommendations.length === 0) {
    recommendations.push("Hold the current setup steady and gather another day of data before adjusting the loop.");
  }

  return recommendations;
}

function buildBeatCrowding(
  beatPreferences: DailyOptimizationSnapshot["beatPreferences"]
): DailyOptimizationSnapshot["beatCrowding"] {
  return beatPreferences
    .map((beat) => {
      const crowdingScore = Math.max(
        0,
        Math.min(
          100,
          (beat.duplicateLosses * 25) +
            (beat.preference === "decrease" ? 20 : 0) +
            (beat.preference === "hold" ? 5 : 0) +
            (beat.publicationRate === null ? 10 : Math.round((1 - beat.publicationRate) * 30))
        )
      );

      return {
        beat: beat.beat,
        crowdingScore,
        publishedConversionRate: beat.publicationRate,
        duplicateLosses: beat.duplicateLosses
      };
    })
    .sort((left, right) => right.crowdingScore - left.crowdingScore || left.beat.localeCompare(right.beat));
}

async function readBriefAgentBehaviorState(baseDir?: string): Promise<BriefAgentBehaviorState | null> {
  const filePath = resolve(resolveBaseDir(baseDir), "data/state/brief-agent-behavior.json");

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as BriefAgentBehaviorState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function readRecentRankedQueues(limit: number, baseDir?: string): Promise<RankedQueueSnapshot[]> {
  const absoluteDir = resolve(resolveBaseDir(baseDir), "data/queues");

  try {
    const fileNames = (await readdir(absoluteDir))
      .filter((fileName) => fileName.endsWith(".json"))
      .sort()
      .slice(-limit);

    return Promise.all(
      fileNames.map(async (fileName) =>
        JSON.parse(await readFile(resolve(absoluteDir, fileName), "utf8")) as RankedQueueSnapshot
      )
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readCandidateHistories(baseDir?: string): Promise<CandidateHistorySnapshot[]> {
  const absoluteDir = resolve(resolveBaseDir(baseDir), "data/candidate-history");

  try {
    const fileNames = await readdir(absoluteDir);
    return Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".json"))
        .map(async (fileName) =>
          JSON.parse(await readFile(resolve(absoluteDir, fileName), "utf8")) as CandidateHistorySnapshot
        )
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readFilingQueueSnapshot(
  reportDate: string,
  baseDir?: string
): Promise<FilingQueueSnapshot | null> {
  const filePath = resolve(resolveBaseDir(baseDir), `data/filing-queue/${reportDate}.json`);

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as FilingQueueSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function needsHeadlineRewrite(reasons: string[]): boolean {
  return reasons.some((reason) =>
    /raw release notes|source artifact|headline too long|weak headline/i.test(reason)
  );
}

function buildOperatorLoad(
  filingQueue: FilingQueueSnapshot | null,
  histories: CandidateHistorySnapshot[],
  reportDate: string
): OperatorLoadSnapshot {
  const signableStatuses = new Set(["awaiting_human_approval", "approved_for_filing", "filed"]);
  const signableItems = (filingQueue?.items ?? []).filter((item) =>
    signableStatuses.has(item.queueStatus ?? "")
  );
  const historyById = new Map(histories.map((history) => [history.candidateId, history]));
  const headlineRewriteCandidateIds = signableItems
    .filter((item) => needsHeadlineRewrite(item.reasons ?? []))
    .map((item) => item.candidateId);
  const sameDayDecisionByCandidateId = new Map<
    string,
    { decision: "approve" | "reject"; reviewedAt: string }
  >();

  for (const item of signableItems) {
    const approval = historyById.get(item.candidateId)?.liveOpsEvidence?.approval;
    if (!approval?.decision || !approval.reviewedAt || !isSameDay(approval.reviewedAt, reportDate)) {
      continue;
    }

    sameDayDecisionByCandidateId.set(item.candidateId, {
      decision: approval.decision,
      reviewedAt: approval.reviewedAt
    });
  }

  const rankingOverrideCandidateIds = signableItems
    .filter((item) =>
      sameDayDecisionByCandidateId.has(item.candidateId) &&
      filingQueue?.topCandidateId !== null &&
      item.candidateId !== filingQueue?.topCandidateId
    )
    .map((item) => item.candidateId);

  const skippedSignableCandidateIds = new Set(
    signableItems
      .filter((item) => sameDayDecisionByCandidateId.get(item.candidateId)?.decision === "reject")
      .map((item) => item.candidateId)
  );
  const topCandidateId = filingQueue?.topCandidateId ?? null;
  const approvedOverrideExists = rankingOverrideCandidateIds.some(
    (candidateId) => sameDayDecisionByCandidateId.get(candidateId)?.decision === "approve"
  );
  if (
    approvedOverrideExists &&
    topCandidateId !== null &&
    signableItems.some((item) => item.candidateId === topCandidateId) &&
    sameDayDecisionByCandidateId.get(topCandidateId)?.decision !== "approve"
  ) {
    skippedSignableCandidateIds.add(topCandidateId);
  }

  const untouchedSignableCandidateIds = signableItems
    .filter((item) =>
      (item.queueStatus ?? "") === "awaiting_human_approval" &&
      !sameDayDecisionByCandidateId.has(item.candidateId)
    )
    .map((item) => item.candidateId);

  const headlineRewriteRequiredCount = headlineRewriteCandidateIds.length;
  const rankingOverrideCount = rankingOverrideCandidateIds.length;
  const skippedSignableCount = skippedSignableCandidateIds.size;
  const untouchedSignableCount = untouchedSignableCandidateIds.length;
  const loadScore =
    (headlineRewriteRequiredCount * 2) +
    (rankingOverrideCount * 3) +
    (skippedSignableCount * 2) +
    untouchedSignableCount;
  const status: OperatorLoadSnapshot["status"] =
    loadScore >= 6 ? "heavy" : loadScore >= 3 ? "moderate" : "light";
  const rationale: string[] = [];

  if (signableItems.length === 0) {
    rationale.push("No signable candidates reached the operator today, so intervention load stayed low.");
  } else {
    rationale.push(
      `${signableItems.length} signable candidate${signableItems.length === 1 ? "" : "s"} reached human review today.`
    );
    if (headlineRewriteRequiredCount > 0) {
      rationale.push(
        `${headlineRewriteRequiredCount} signable candidate${headlineRewriteRequiredCount === 1 ? "" : "s"} still needed a headline rewrite before approval.`
      );
    }
    if (rankingOverrideCount > 0) {
      rationale.push(
        `${rankingOverrideCount} signable candidate${rankingOverrideCount === 1 ? "" : "s"} got a same-day operator decision despite not being the queue top candidate.`
      );
    }
    if (skippedSignableCount > 0) {
      rationale.push(
        `${skippedSignableCount} signable candidate${skippedSignableCount === 1 ? " was" : "s were"} skipped or rejected even though ${skippedSignableCount === 1 ? "it reached" : "they reached"} the signable slate.`
      );
    }
    if (untouchedSignableCount > 0) {
      rationale.push(
        `${untouchedSignableCount} signable candidate${untouchedSignableCount === 1 ? " was" : "s were"} still waiting for a decision at day end.`
      );
    }
  }

  return {
    totalSignableCandidates: signableItems.length,
    headlineRewriteRequiredCount,
    rankingOverrideCount,
    skippedSignableCount,
    untouchedSignableCount,
    loadScore,
    status,
    headlineRewriteCandidateIds: headlineRewriteCandidateIds.sort(),
    rankingOverrideCandidateIds: rankingOverrideCandidateIds.sort(),
    skippedSignableCandidateIds: [...skippedSignableCandidateIds].sort(),
    untouchedSignableCandidateIds: untouchedSignableCandidateIds.sort(),
    rationale
  };
}

function buildCompetitorIntel(
  behavior: BriefAgentBehaviorState | null,
  beatCrowding: DailyOptimizationSnapshot["beatCrowding"]
): DailyOptimizationSnapshot["competitorIntel"] {
  const topAgents = (behavior?.agents ?? [])
    .map((agent) => ({
      agent: agent.agent,
      wins: agent.wins,
      sameDayMultiWins: agent.sameDayMultiWins ?? 0,
      beats: Array.isArray(agent.beats) ? agent.beats : [],
      commonSourceDomains: Array.isArray(agent.commonSourceDomains) ? agent.commonSourceDomains : []
    }))
    .sort((left, right) => right.wins - left.wins || left.agent.localeCompare(right.agent))
    .slice(0, 5);
  const topSourceDomains = (behavior?.commonSourceDomains ?? []).slice(0, 5);
  const ownedBeats = [...new Set(
    topAgents
      .filter((agent) => agent.wins >= 2 || agent.sameDayMultiWins >= 1)
      .flatMap((agent) => agent.beats)
  )].sort();
  const crowdedBeat = beatCrowding[0] ?? null;
  const topAgent = topAgents[0] ?? null;
  const recommendations: string[] = [];

  if (topAgent) {
    recommendations.push(
      `Study ${topAgent.agent}; ${topAgent.wins} wins and ${topAgent.sameDayMultiWins} same-day multi-win cycles make this the strongest competitor pattern in memory.`
    );
    if (topAgent.beats.length > 1 || topAgent.sameDayMultiWins > 0) {
      recommendations.push(
        `${topAgent.agent} is winning with broader same-day packaging across beats; avoid filing narrow fragments into lanes this agent can outcompete.`
      );
    }
  }

  if (crowdedBeat && crowdedBeat.crowdingScore >= 40) {
    recommendations.push(
      `Do not chase ${crowdedBeat.beat} with a narrow story while competitor pressure is high; win with a broader package or shift lanes.`
    );
  }

  if (topSourceDomains[0]) {
    recommendations.push(
      `Top competitors are repeatedly winning from ${topSourceDomains[0].domain}; prefer similar proof quality when sourcing this cycle.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Competitor intel is limited today; keep collecting brief-winner patterns before making a large strategy change.");
  }

  return {
    topAgents,
    topSourceDomains,
    ownedBeats,
    recommendations
  };
}

function buildTopCandidatePerformance(
  rankedQueues: RankedQueueSnapshot[],
  histories: CandidateHistorySnapshot[]
): DailyOptimizationSnapshot["topCandidatePerformance"] {
  const historyById = new Map(histories.map((history) => [history.candidateId, history]));
  const recentTopCandidates = rankedQueues.map((queue) => {
    const top = queue.candidates?.[0];
    const history = top ? historyById.get(top.candidateId) : null;
    const decision: "file" | "hold" | "reject" | "none" =
      top?.decision === "file" || top?.decision === "hold" || top?.decision === "reject"
        ? top.decision
        : "none";
    const outcomeStatus: "approved" | "rejected" | "submitted" | "unknown" | "pending" =
      history?.outcome?.status === "approved" ||
      history?.outcome?.status === "rejected" ||
      history?.outcome?.status === "submitted" ||
      history?.outcome?.status === "unknown"
        ? history.outcome.status
        : "pending";

    return {
      reportDate: queue.reportDate,
      candidateId: top?.candidateId ?? "none",
      beat: history?.beat ?? top?.beat ?? null,
      score: top?.score ?? null,
      decision,
      outcomeStatus,
      publishedInBrief: history?.outcome?.publishedInBrief ?? null,
      note: history?.outcome?.note ?? "",
      learning: history?.outcome?.learningWhy ?? ""
    };
  });

  const resolved = recentTopCandidates.filter((candidate) => candidate.outcomeStatus !== "pending");
  const approvals = resolved.filter((candidate) => candidate.outcomeStatus === "approved").length;
  const published = resolved.filter((candidate) => candidate.publishedInBrief === true).length;
  const failureTexts = recentTopCandidates
    .filter((candidate) => candidate.outcomeStatus !== "approved" || candidate.publishedInBrief !== true)
    .flatMap((candidate) => [candidate.note, candidate.learning])
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const commonFailurePatterns: string[] = [];
  if (failureTexts.some((text) => /\bbroader\b|\bsame-day\b|\bsame beat\b/i.test(text))) {
    commonFailurePatterns.push("top candidates are still losing to broader same-beat competitors");
  }
  if (failureTexts.some((text) => /\bheadline\b|\bframing\b|\bpackag/i.test(text))) {
    commonFailurePatterns.push("top candidates need stronger packaging or headline framing");
  }
  if (failureTexts.some((text) => /\btiming\b|\bstale\b/i.test(text))) {
    commonFailurePatterns.push("top candidates are arriving too late relative to the winning brief slot");
  }

  const recommendations: string[] = [];
  if (commonFailurePatterns[0]) {
    recommendations.push(`Recent top-candidate issue: ${commonFailurePatterns[0]}.`);
  }

  const latest = recentTopCandidates[recentTopCandidates.length - 1] ?? null;
  if (latest && latest.outcomeStatus === "pending") {
    recommendations.push("Do not trust today’s top-ranked candidate blindly; inspect the last few top-candidate outcomes before signing.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Top-candidate performance looks stable; keep using the current ranking logic until a loss pattern emerges.");
  }

  return {
    recentTopCandidates: recentTopCandidates.map(({ note: _note, learning: _learning, ...candidate }) => candidate),
    approvalRate: formatRatio(approvals, resolved.length),
    publicationRate: formatRatio(published, resolved.length),
    commonFailurePatterns,
    recommendations
  };
}

export async function generateDailyOptimizationSnapshot(
  reportDate: string,
  generatedAt: string,
  options: OptimizationOptions = {}
): Promise<DailyOptimizationSnapshot> {
  const [
    allDetections,
    allSubmissions,
    detections,
    rejections,
    submissions,
    approvals,
    rewards,
    allRewards,
    allApprovals,
    trainingMemory,
    briefAgentBehavior,
    recentRankedQueues,
    candidateHistories,
    filingQueue
  ] = await Promise.all([
    readAllRecords<CandidateLogRecord>("data/logs/candidates", options.baseDir),
    readAllRecords<AcceptedSubmissionRecord>("data/logs/accepted", options.baseDir),
    readDailyRecords<CandidateLogRecord>("data/logs/candidates", reportDate, options.baseDir),
    readDailyRecords<RejectionLogRecord>("data/logs/rejections", reportDate, options.baseDir),
    readDailyRecords<AcceptedSubmissionRecord>("data/logs/accepted", reportDate, options.baseDir),
    readDailyRecords<ApprovalOutcomeRecord>("data/outcomes/approvals", reportDate, options.baseDir),
    readDailyRecords<RewardOutcomeRecord>("data/outcomes/rewards", reportDate, options.baseDir),
    readAllRecords<RewardOutcomeRecord>("data/outcomes/rewards", options.baseDir),
    readAllRecords<ApprovalOutcomeRecord>("data/outcomes/approvals", options.baseDir),
    loadTrainingMemory(options.baseDir),
    readBriefAgentBehaviorState(options.baseDir),
    readRecentRankedQueues(5, options.baseDir),
    readCandidateHistories(options.baseDir),
    readFilingQueueSnapshot(reportDate, options.baseDir)
  ]);

  const beatByCandidateId = new Map(
    allDetections.map((record) => [record.candidate.candidateId, record.candidate.beat])
  );
  const submissionsByCandidateId = new Map(
    allSubmissions.map((record) => [record.candidateId, record])
  );
  const approvedHeadlineSet = new Set(
    approvals
      .filter((approval) => approval.approved)
      .map((approval) => submissionsByCandidateId.get(approval.candidateId)?.submission.headline)
      .filter((headline): headline is string => Boolean(headline))
  );
  const approvedHeadlines = [...approvedHeadlineSet];

  const duplicateLossPatterns = buildDuplicateLossPatterns(rejections, beatByCandidateId);
  const liveWinningHeadlinePatterns = buildWinningHeadlinePatterns(approvedHeadlines);
  const winningHeadlinePatterns = liveWinningHeadlinePatterns.length > 0
    ? liveWinningHeadlinePatterns
    : trainingMemory.winningHeadlinePatterns;
  const beatPreferences = buildBeatPreferences(
    beatByCandidateId,
    detections,
    submissions,
    approvals,
    duplicateLossPatterns
  );
  const successMetrics = buildSuccessMetrics(approvals, rewards);
  const rejectionThreshold = buildThresholdAdjustment(
    rejections,
    submissions,
    approvals,
    duplicateLossPatterns
  );
  const beatCrowding = buildBeatCrowding(beatPreferences);
  const stylePerformance = buildStylePerformance(
    allSubmissions,
    allApprovals,
    allRewards,
    candidateHistories,
    reportDate
  );
  const factorAttribution = buildFactorAttribution(
    allSubmissions,
    allApprovals,
    reportDate,
    briefAgentBehavior
  );
  const operatorLoad = buildOperatorLoad(filingQueue, candidateHistories, reportDate);
  const competitorIntel = buildCompetitorIntel(briefAgentBehavior, beatCrowding);
  const topCandidatePerformance = buildTopCandidatePerformance(recentRankedQueues, candidateHistories);

  const baseSnapshot = {
    reportDate,
    successMetrics,
    beatPreferences,
    rejectionThreshold,
    duplicateLossPatterns,
    winningHeadlinePatterns,
    trainingWinningTags: trainingMemory.winningTags,
    trainingRejectionTags: trainingMemory.rejectionTags,
    stylePerformance,
    factorAttribution,
    operatorLoad,
    packagingAdjustments: undefined,
    beatCrowding,
    competitorIntel,
    topCandidatePerformance,
    nextDayRecommendations: [] as string[]
  };
  const recentApprovedNotInBriefLearnings = allApprovals
    .filter((approval) => approval.approved && approval.published !== true)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
    .map((approval) => approval.learningWhy)
    .filter((learningWhy): learningWhy is string => typeof learningWhy === "string" && learningWhy.length > 0)
    .slice(0, 5);
  const packagingAdjustments = buildPackagingAdjustments(recentApprovedNotInBriefLearnings);
  const recommendationSnapshot = {
    ...baseSnapshot,
    packagingAdjustments
  };

  return {
    kind: "daily_optimization",
    generatedAt,
    ...recommendationSnapshot,
    packagingAdjustments,
    nextDayRecommendations: buildNextDayRecommendations(recommendationSnapshot, {
      recentApprovedNotInBriefLearnings
    })
  };
}

export async function saveDailyOptimizationSnapshot(
  snapshot: DailyOptimizationSnapshot,
  options: OptimizationOptions = {}
): Promise<string> {
  const filePath = resolve(
    resolveBaseDir(options.baseDir),
    `data/experiments/optimization/${snapshot.reportDate}.json`
  );
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  const stylePerformancePath = resolve(
    resolveBaseDir(options.baseDir),
    "data/state/style-performance.json"
  );
  const operatorLoadPath = resolve(
    resolveBaseDir(options.baseDir),
    "data/state/operator-load.json"
  );
  await mkdir(dirname(stylePerformancePath), { recursive: true });
  await writeFile(
    stylePerformancePath,
    JSON.stringify({
      kind: "style_performance",
      reportDate: snapshot.reportDate,
      generatedAt: snapshot.generatedAt,
      styles: snapshot.stylePerformance
    }, null, 2),
    "utf8"
  );
  await mkdir(dirname(operatorLoadPath), { recursive: true });
  await writeFile(
    operatorLoadPath,
    JSON.stringify({
      kind: "operator_load",
      reportDate: snapshot.reportDate,
      generatedAt: snapshot.generatedAt,
      operatorLoad: snapshot.operatorLoad ?? null
    }, null, 2),
    "utf8"
  );
  return filePath;
}

export async function generateAndSaveDailyOptimizationSnapshot(
  reportDate: string,
  generatedAt: string,
  options: OptimizationOptions = {}
): Promise<{ snapshot: DailyOptimizationSnapshot; savedTo: string }> {
  const snapshot = await generateDailyOptimizationSnapshot(reportDate, generatedAt, options);
  const savedTo = await saveDailyOptimizationSnapshot(snapshot, options);
  return { snapshot, savedTo };
}

export async function readDailyOptimizationSnapshot(
  reportDate: string,
  options: OptimizationOptions = {}
): Promise<DailyOptimizationSnapshot | null> {
  const filePath = resolve(
    resolveBaseDir(options.baseDir),
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
