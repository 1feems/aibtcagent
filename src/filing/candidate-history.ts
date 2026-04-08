import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CandidateLifecycle, CandidateLifecycleState, FilingQueueStatus } from "./lifecycle.js";

interface SerializedSource {
  source_name?: string;
  source_url?: string;
  source_role?: string;
}

interface FilingReadyArtifact {
  kind: "filing_ready_submission";
  reportDate: string;
  candidateId: string;
  reviewedBy: string;
  reviewedAt: string;
  lifecycle?: CandidateLifecycle;
  approvalEvidence?: {
    decision: "approve" | "reject";
    reasons: string[];
    operatorRationale?: string | null;
  };
  sourcePath: string;
  submission?: {
    headline?: string;
    candidate_signal?: {
      beat?: string;
    };
    candidate_metadata?: {
      style_tested?: string;
      competitor_reference?: string | null;
      why_this_style_was_chosen?: string;
      duplicate_status?: "clear" | "pending" | "flagged";
      freshness_status?: "clear" | "risk_unresolved" | "unknown";
    };
    sources?: SerializedSource[];
  };
}

interface CandidateSourceSubmission {
  headline?: string;
  candidate_signal?: {
    beat?: string;
  };
  candidate_metadata?: {
    style_tested?: string;
    competitor_reference?: string | null;
    why_this_style_was_chosen?: string;
    duplicate_status?: "clear" | "pending" | "flagged";
    freshness_status?: "clear" | "risk_unresolved" | "unknown";
  };
  sources?: SerializedSource[];
}

interface QueueHistoryInput {
  candidateId: string;
  headline: string;
  beat: string;
  sourcePath?: string;
  queueStatus: FilingQueueStatus;
  lifecycle: CandidateLifecycle;
  reasons: string[];
  styleTested: string;
  competitorReference: string | null;
  whyThisStyleWasChosen: string;
  duplicateStatus: "clear" | "pending" | "flagged";
  freshnessStatus: "clear" | "risk_unresolved" | "unknown";
}

interface DailyReportSnapshot {
  reportDate: string;
  changedFromYesterday?: string[];
}

interface OptimizationSnapshot {
  reportDate: string;
  nextDayRecommendations?: string[];
  beatPreferences?: Array<{
    beat: string;
    preference: "increase" | "hold" | "decrease";
    rationale: string;
  }>;
  stylePerformance?: Array<{
    style: string;
    preference: "promote" | "hold" | "demote";
    rationale: string;
  }>;
  packagingAdjustments?: {
    promoteBroadSameBeatPackaging: boolean;
    demoteNarrowFragmentPackaging: boolean;
    rationale: string[];
  };
  topCandidatePerformance?: {
    commonFailurePatterns?: string[];
  };
}

interface RankedQueueSnapshot {
  reportDate: string;
  candidates?: Array<{
    candidateId: string;
    headline?: string;
    beat?: string;
    score?: number;
    decision?: "file" | "hold" | "reject";
    reasons?: string[];
  }>;
}

interface FilingQueueSnapshot {
  reportDate: string;
  topCandidateId: string | null;
  items?: Array<{
    candidateId: string;
    headline: string;
    beat: string;
    score: number;
    queueStatus: FilingQueueStatus;
    reasons: string[];
  }>;
}

interface TopReplacementCandidate {
  candidateId: string;
  headline?: string;
  beat?: string;
  score?: number;
  decision?: "file" | "hold" | "reject";
  reasons?: string[];
}

interface BriefWinnerSnapshot {
  reportDate: string;
  publishedSignals?: Array<{
    signalId?: string | null;
    headline: string;
    beat: string;
    publishedAt?: string | null;
    approvedAt?: string | null;
    agent: string;
  }>;
}

interface CompetitiveReplayArtifact {
  kind: "candidate_competitive_replay";
  reportDate: string;
  candidateId: string;
  generatedAt: string;
  filedSignalId: string | null;
  headline: string | null;
  beat: string | null;
  publishedInBrief: boolean | null;
  beatOccupied: boolean;
  ownCandidateWon: boolean;
  sameBeatPublishedSignals: Array<{
    signalId: string | null;
    headline: string;
    agent: string;
    publishedAt: string | null;
  }>;
  winner: {
    signalId: string | null;
    headline: string | null;
    agent: string | null;
  } | null;
}

export interface CandidateHistoryRecord {
  kind: "candidate_history";
  reportDate: string;
  candidateId: string;
  headline: string | null;
  beat: string | null;
  sourcePath: string | null;
  sourceSummary: Array<{
    name: string;
    url: string;
    role: string;
    domain: string;
  }>;
  sourceDomains: string[];
  candidateMetadata: {
    styleTested: string | null;
    competitorReference: string | null;
    whyThisStyleWasChosen: string | null;
    duplicateStatus: "clear" | "pending" | "flagged" | null;
    freshnessStatus: "clear" | "risk_unresolved" | "unknown" | null;
  };
  review: {
    reviewedBy: string | null;
    reviewedAt: string | null;
    readyArtifactPath: string | null;
  };
  liveOpsEvidence: {
    signability: {
      capturedAt: string | null;
      queueStatus: FilingQueueStatus | null;
      lifecycleState: CandidateLifecycleState | null;
      signable: boolean | null;
      reasons: string[];
    };
    approval: {
      decision: "approve" | "reject" | null;
      reviewedBy: string | null;
      reviewedAt: string | null;
      lifecycleState: CandidateLifecycleState | null;
      reasons: string[];
      operatorRationale: string | null;
      readyArtifactPath: string | null;
    };
    nextDay: Array<{
      reportDate: string;
      changedFromYesterday: string[];
      recommendations: string[];
      loopChanges: string[];
    }>;
    replacementReview: {
      replacementCandidateId: string | null;
      replacementHeadline: string | null;
      replacementBeat: string | null;
      replacementScore: number | null;
      surfacedInTime: boolean | null;
      trigger: "held_top_candidate" | "rejected_top_candidate" | "lost_top_candidate" | null;
      whyReplacementWasPreferred: string[];
      reviewedAt: string | null;
    };
    competitiveReplay: {
      artifactPath: string | null;
      beatOccupied: boolean | null;
      ownCandidateWon: boolean | null;
      winnerHeadline: string | null;
      winnerAgent: string | null;
      reviewedAt: string | null;
    };
  };
  filing: {
    signalId: string | null;
    filedAt: string | null;
  };
  outcome: {
    status: "approved" | "rejected" | "submitted" | "unknown" | null;
    approved: boolean | null;
    publishedInBrief: boolean | null;
    success: boolean | null;
    failureMode: "not_in_brief" | "rejected" | "pending" | "unknown" | null;
    recordedAt: string | null;
    note: string | null;
    learningWhy: string | null;
  };
}

function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function resolveHistoryJsonPath(candidateId: string, baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), `data/candidate-history/${candidateId}.json`);
}

function resolveHistoryMarkdownPath(candidateId: string, baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), `data/candidate-history/${candidateId}.md`);
}

function renderMarkdown(record: CandidateHistoryRecord): string {
  return [
    `# Candidate History: ${record.candidateId}`,
    "",
    `Report date: ${record.reportDate}`,
    `Headline: ${record.headline ?? "n/a"}`,
    `Beat: ${record.beat ?? "n/a"}`,
    `Style tested: ${record.candidateMetadata.styleTested ?? "n/a"}`,
    `Competitor reference: ${record.candidateMetadata.competitorReference ?? "n/a"}`,
    `Duplicate status: ${record.candidateMetadata.duplicateStatus ?? "n/a"}`,
    `Freshness status: ${record.candidateMetadata.freshnessStatus ?? "n/a"}`,
    `Reviewed by: ${record.review.reviewedBy ?? "n/a"}`,
    `Reviewed at: ${record.review.reviewedAt ?? "n/a"}`,
    `Signal ID: ${record.filing.signalId ?? "not filed yet"}`,
    `Filed at: ${record.filing.filedAt ?? "not filed yet"}`,
    `Outcome status: ${record.outcome.status ?? "unknown"}`,
    `Approved: ${record.outcome.approved === null ? "unknown" : String(record.outcome.approved)}`,
    `Published in Brief: ${record.outcome.publishedInBrief === null ? "unknown" : String(record.outcome.publishedInBrief)}`,
    `Success: ${record.outcome.success === null ? "unknown" : String(record.outcome.success)}`,
    `Failure mode: ${record.outcome.failureMode ?? "n/a"}`,
    "",
    "## Live Ops Evidence",
    `- Signability captured at: ${record.liveOpsEvidence.signability.capturedAt ?? "n/a"}`,
    `- Queue status: ${record.liveOpsEvidence.signability.queueStatus ?? "n/a"}`,
    `- Lifecycle state: ${record.liveOpsEvidence.signability.lifecycleState ?? "n/a"}`,
    `- Was signable: ${record.liveOpsEvidence.signability.signable === null ? "unknown" : String(record.liveOpsEvidence.signability.signable)}`,
    ...(record.liveOpsEvidence.signability.reasons.length === 0
      ? ["- Signability reasons: n/a"]
      : record.liveOpsEvidence.signability.reasons.map((reason) => `- Signability reason: ${reason}`)),
    `- Approval decision: ${record.liveOpsEvidence.approval.decision ?? "n/a"}`,
    `- Approval lifecycle state: ${record.liveOpsEvidence.approval.lifecycleState ?? "n/a"}`,
    `- Operator rationale: ${record.liveOpsEvidence.approval.operatorRationale ?? "n/a"}`,
    ...(record.liveOpsEvidence.approval.reasons.length === 0
      ? ["- Approval reasons: n/a"]
      : record.liveOpsEvidence.approval.reasons.map((reason) => `- Approval reason: ${reason}`)),
    `- Approval rationale check: ${buildApprovalRationaleCheck(record) ?? "n/a"}`,
    ...(record.liveOpsEvidence.nextDay.length === 0
      ? ["- Next-day changes: n/a"]
      : record.liveOpsEvidence.nextDay.flatMap((entry) => [
          `- Next-day report: ${entry.reportDate}`,
          ...(entry.loopChanges.length === 0
            ? ["- Next-day loop change: n/a"]
            : entry.loopChanges.map((line) => `- Next-day loop change: ${line}`)),
          ...(entry.changedFromYesterday.length === 0
            ? ["- Next-day delta: n/a"]
            : entry.changedFromYesterday.map((line) => `- Next-day delta: ${line}`)),
          ...(entry.recommendations.length === 0
            ? ["- Next-day recommendation: n/a"]
            : entry.recommendations.map((line) => `- Next-day recommendation: ${line}`))
        ])),
    `- Replacement candidate: ${record.liveOpsEvidence.replacementReview.replacementCandidateId ?? "n/a"}`,
    `- Replacement surfaced in time: ${record.liveOpsEvidence.replacementReview.surfacedInTime === null ? "unknown" : String(record.liveOpsEvidence.replacementReview.surfacedInTime)}`,
    `- Replacement trigger: ${record.liveOpsEvidence.replacementReview.trigger ?? "n/a"}`,
    ...(record.liveOpsEvidence.replacementReview.whyReplacementWasPreferred.length === 0
      ? ["- Replacement reasons: n/a"]
      : record.liveOpsEvidence.replacementReview.whyReplacementWasPreferred.map((line) => `- Replacement reason: ${line}`)),
    `- Competitive replay artifact: ${record.liveOpsEvidence.competitiveReplay.artifactPath ?? "n/a"}`,
    `- Beat occupied at replay time: ${record.liveOpsEvidence.competitiveReplay.beatOccupied === null ? "unknown" : String(record.liveOpsEvidence.competitiveReplay.beatOccupied)}`,
    `- Replay says own candidate won: ${record.liveOpsEvidence.competitiveReplay.ownCandidateWon === null ? "unknown" : String(record.liveOpsEvidence.competitiveReplay.ownCandidateWon)}`,
    `- Replay winner headline: ${record.liveOpsEvidence.competitiveReplay.winnerHeadline ?? "n/a"}`,
    `- Replay winner agent: ${record.liveOpsEvidence.competitiveReplay.winnerAgent ?? "n/a"}`,
    "",
    "## Sources",
    ...(record.sourceSummary.length === 0
      ? ["- No sources captured."]
      : record.sourceSummary.map((source) => `- [${source.role}] ${source.name} — ${source.domain} — ${source.url}`)),
    "",
    "## Notes",
    `- Why this style was chosen: ${record.candidateMetadata.whyThisStyleWasChosen ?? "n/a"}`,
    `- Source path: ${record.sourcePath ?? "n/a"}`,
    `- Ready artifact: ${record.review.readyArtifactPath ?? "n/a"}`,
    `- Outcome note: ${record.outcome.note ?? "n/a"}`,
    `- Learning why: ${record.outcome.learningWhy ?? "n/a"}`,
    ""
  ].join("\n");
}

function createEmptyLiveOpsEvidence(): CandidateHistoryRecord["liveOpsEvidence"] {
  return {
    signability: {
      capturedAt: null,
      queueStatus: null,
      lifecycleState: null,
      signable: null,
      reasons: []
    },
    approval: {
      decision: null,
      reviewedBy: null,
      reviewedAt: null,
      lifecycleState: null,
      reasons: [],
      operatorRationale: null,
      readyArtifactPath: null
    },
    nextDay: []
    ,
    replacementReview: {
      replacementCandidateId: null,
      replacementHeadline: null,
      replacementBeat: null,
      replacementScore: null,
      surfacedInTime: null,
      trigger: null,
      whyReplacementWasPreferred: [],
      reviewedAt: null
    },
    competitiveReplay: {
      artifactPath: null,
      beatOccupied: null,
      ownCandidateWon: null,
      winnerHeadline: null,
      winnerAgent: null,
      reviewedAt: null
    }
  };
}

function createEmptyOutcome(): CandidateHistoryRecord["outcome"] {
  return {
    status: null,
    approved: null,
    publishedInBrief: null,
    success: null,
    failureMode: null,
    recordedAt: null,
    note: null,
    learningWhy: null
  };
}

function createEmptyFiling(): CandidateHistoryRecord["filing"] {
  return {
    signalId: null,
    filedAt: null
  };
}

function buildSourceSummary(sources: SerializedSource[]): CandidateHistoryRecord["sourceSummary"] {
  return sources.map((source) => ({
    name: source.source_name ?? "Unknown source",
    url: source.source_url ?? "",
    role: source.source_role ?? "unknown",
    domain: extractDomain(source.source_url ?? "")
  }));
}

function buildApprovalRationaleCheck(record: CandidateHistoryRecord): string | null {
  const rationale = record.liveOpsEvidence.approval.operatorRationale?.trim();
  if (!rationale) {
    return null;
  }

  if (record.outcome.success === true) {
    return "Approval rationale held up against the observed win.";
  }

  if (record.outcome.success === false) {
    if (record.outcome.learningWhy) {
      return `Revisit approval rationale against outcome learning: ${record.outcome.learningWhy}`;
    }
    if (record.outcome.note) {
      return `Revisit approval rationale against outcome note: ${record.outcome.note}`;
    }
    return "Approval rationale did not convert into the desired outcome.";
  }

  return "Outcome still pending, so the approval rationale is not validated yet.";
}

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function saveCandidateHistory(record: CandidateHistoryRecord, baseDir?: string): Promise<string> {
  const jsonPath = resolveHistoryJsonPath(record.candidateId, baseDir);
  const markdownPath = resolveHistoryMarkdownPath(record.candidateId, baseDir);
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(record, null, 2) + "\n", "utf8");
  await writeFile(markdownPath, renderMarkdown(record), "utf8");
  return jsonPath;
}

export async function readCandidateHistory(
  candidateId: string,
  baseDir?: string
): Promise<CandidateHistoryRecord | null> {
  return readJsonOrNull<CandidateHistoryRecord>(resolveHistoryJsonPath(candidateId, baseDir));
}

async function readSourceSubmission(sourcePath: string | undefined): Promise<CandidateSourceSubmission | null> {
  if (!sourcePath) {
    return null;
  }

  return readJsonOrNull<CandidateSourceSubmission>(sourcePath);
}

export async function upsertCandidateHistoryFromQueueItem(
  reportDate: string,
  item: QueueHistoryInput,
  baseDir?: string
): Promise<string> {
  const existing = await readCandidateHistory(item.candidateId, baseDir);
  const sourceSubmission = await readSourceSubmission(item.sourcePath);
  const sourceSummary = buildSourceSummary(sourceSubmission?.sources ?? []);
  const existingSignability = existing?.liveOpsEvidence?.signability;
  const shouldCaptureCurrentSignability =
    item.queueStatus === "awaiting_human_approval" ||
    existingSignability === undefined ||
    existingSignability.signable === null;

  const record: CandidateHistoryRecord = {
    kind: "candidate_history",
    reportDate,
    candidateId: item.candidateId,
    headline: item.headline ?? sourceSubmission?.headline ?? existing?.headline ?? null,
    beat: item.beat ?? sourceSubmission?.candidate_signal?.beat ?? existing?.beat ?? null,
    sourcePath: item.sourcePath ?? existing?.sourcePath ?? null,
    sourceSummary: sourceSummary.length > 0 ? sourceSummary : existing?.sourceSummary ?? [],
    sourceDomains: [
      ...new Set((sourceSummary.length > 0 ? sourceSummary : existing?.sourceSummary ?? []).map((source) => source.domain))
    ].sort(),
    candidateMetadata: {
      styleTested: item.styleTested ?? sourceSubmission?.candidate_metadata?.style_tested ?? existing?.candidateMetadata?.styleTested ?? null,
      competitorReference: item.competitorReference ?? sourceSubmission?.candidate_metadata?.competitor_reference ?? existing?.candidateMetadata?.competitorReference ?? null,
      whyThisStyleWasChosen: item.whyThisStyleWasChosen ?? sourceSubmission?.candidate_metadata?.why_this_style_was_chosen ?? existing?.candidateMetadata?.whyThisStyleWasChosen ?? null,
      duplicateStatus: item.duplicateStatus ?? sourceSubmission?.candidate_metadata?.duplicate_status ?? existing?.candidateMetadata?.duplicateStatus ?? null,
      freshnessStatus: item.freshnessStatus ?? sourceSubmission?.candidate_metadata?.freshness_status ?? existing?.candidateMetadata?.freshnessStatus ?? null
    },
    review: existing?.review ?? {
      reviewedBy: null,
      reviewedAt: null,
      readyArtifactPath: null
    },
    liveOpsEvidence: {
      signability: shouldCaptureCurrentSignability
        ? {
            capturedAt: new Date().toISOString(),
            queueStatus: item.queueStatus,
            lifecycleState: item.lifecycle.state,
            signable: item.queueStatus === "awaiting_human_approval",
            reasons: item.reasons
          }
        : existingSignability,
      approval: existing?.liveOpsEvidence?.approval ?? createEmptyLiveOpsEvidence().approval,
      nextDay: existing?.liveOpsEvidence?.nextDay ?? [],
      replacementReview: existing?.liveOpsEvidence?.replacementReview ?? createEmptyLiveOpsEvidence().replacementReview,
      competitiveReplay: existing?.liveOpsEvidence?.competitiveReplay ?? createEmptyLiveOpsEvidence().competitiveReplay
    },
    filing: existing?.filing ?? createEmptyFiling(),
    outcome: existing?.outcome ?? createEmptyOutcome()
  };

  return saveCandidateHistory(record, baseDir);
}

export async function upsertCandidateHistoryFromReadyArtifact(
  readyArtifactPath: string,
  baseDir?: string
): Promise<string> {
  const artifact = JSON.parse(await readFile(readyArtifactPath, "utf8")) as FilingReadyArtifact;
  const existing = await readCandidateHistory(artifact.candidateId, baseDir);
  const sourceSummary = buildSourceSummary(artifact.submission?.sources ?? []);

  const record: CandidateHistoryRecord = {
    kind: "candidate_history",
    reportDate: artifact.reportDate,
    candidateId: artifact.candidateId,
    headline: artifact.submission?.headline ?? existing?.headline ?? null,
    beat: artifact.submission?.candidate_signal?.beat ?? existing?.beat ?? null,
    sourcePath: artifact.sourcePath ?? existing?.sourcePath ?? null,
    sourceSummary,
    sourceDomains: [...new Set(sourceSummary.map((source) => source.domain))].sort(),
    candidateMetadata: {
      styleTested: artifact.submission?.candidate_metadata?.style_tested ?? existing?.candidateMetadata?.styleTested ?? null,
      competitorReference: artifact.submission?.candidate_metadata?.competitor_reference ?? existing?.candidateMetadata?.competitorReference ?? null,
      whyThisStyleWasChosen: artifact.submission?.candidate_metadata?.why_this_style_was_chosen ?? existing?.candidateMetadata?.whyThisStyleWasChosen ?? null,
      duplicateStatus: artifact.submission?.candidate_metadata?.duplicate_status ?? existing?.candidateMetadata?.duplicateStatus ?? null,
      freshnessStatus: artifact.submission?.candidate_metadata?.freshness_status ?? existing?.candidateMetadata?.freshnessStatus ?? null
    },
    review: {
      reviewedBy: artifact.reviewedBy,
      reviewedAt: artifact.reviewedAt,
      readyArtifactPath
    },
    liveOpsEvidence: {
      signability: existing?.liveOpsEvidence?.signability ?? createEmptyLiveOpsEvidence().signability,
      approval: {
        decision: artifact.approvalEvidence?.decision ?? "approve",
        reviewedBy: artifact.reviewedBy,
        reviewedAt: artifact.reviewedAt,
        lifecycleState: artifact.lifecycle?.state ?? existing?.liveOpsEvidence?.approval.lifecycleState ?? null,
        reasons: artifact.approvalEvidence?.reasons ?? existing?.liveOpsEvidence?.approval.reasons ?? [],
        operatorRationale: artifact.approvalEvidence?.operatorRationale ?? existing?.liveOpsEvidence?.approval.operatorRationale ?? null,
        readyArtifactPath
      },
      nextDay: existing?.liveOpsEvidence?.nextDay ?? [],
      replacementReview: existing?.liveOpsEvidence?.replacementReview ?? createEmptyLiveOpsEvidence().replacementReview,
      competitiveReplay: existing?.liveOpsEvidence?.competitiveReplay ?? createEmptyLiveOpsEvidence().competitiveReplay
    },
    filing: existing?.filing ?? createEmptyFiling(),
    outcome: existing?.outcome ?? createEmptyOutcome()
  };

  return saveCandidateHistory(record, baseDir);
}

export async function markCandidateFiled(
  candidateId: string,
  signalId: string,
  filedAt: string,
  baseDir?: string
): Promise<string | null> {
  const existing = await readCandidateHistory(candidateId, baseDir);
  if (!existing) {
    return null;
  }

  existing.filing.signalId = signalId;
  existing.filing.filedAt = filedAt;
  return saveCandidateHistory(existing, baseDir);
}

export async function markCandidateOutcome(
  candidateId: string,
  outcome: {
    status: "approved" | "rejected" | "submitted" | "unknown";
    approved: boolean;
    publishedInBrief: boolean;
    success?: boolean;
    failureMode?: "not_in_brief" | "rejected" | "pending" | "unknown" | null;
    recordedAt: string;
    note: string | null;
    learningWhy?: string | null;
  },
  baseDir?: string
): Promise<string | null> {
  const existing = await readCandidateHistory(candidateId, baseDir);
  if (!existing) {
    return null;
  }

  existing.outcome = {
    status: outcome.status,
    approved: outcome.approved,
    publishedInBrief: outcome.publishedInBrief,
    success:
      typeof outcome.success === "boolean"
        ? outcome.success
        : outcome.status === "approved" && outcome.publishedInBrief === true,
    failureMode:
      outcome.failureMode !== undefined
        ? outcome.failureMode
        : outcome.status === "approved" && outcome.publishedInBrief !== true
          ? "not_in_brief"
          : outcome.status === "rejected"
            ? "rejected"
            : outcome.status === "submitted"
              ? "pending"
              : outcome.status === "unknown"
                ? "unknown"
                : null,
    recordedAt: outcome.recordedAt,
    note: outcome.note,
    learningWhy: outcome.learningWhy ?? null
  };
  const savedPath = await saveCandidateHistory(existing, baseDir);
  await updateReplacementEvidenceForReport(existing.reportDate, baseDir);
  await syncCompetitiveReplayForReport(existing.reportDate, baseDir);
  return savedPath;
}

export async function recordCandidateApprovalDecision(
  candidateId: string,
  approval: {
    decision: "approve" | "reject";
    reviewedBy: string;
    reviewedAt: string;
    lifecycleState: CandidateLifecycleState;
    reasons: string[];
    operatorRationale: string;
    readyArtifactPath: string | null;
  },
  baseDir?: string
): Promise<string | null> {
  const existing = await readCandidateHistory(candidateId, baseDir);
  if (!existing) {
    return null;
  }

  existing.review = {
    reviewedBy: approval.reviewedBy,
    reviewedAt: approval.reviewedAt,
    readyArtifactPath: approval.readyArtifactPath
  };
  existing.liveOpsEvidence.approval = {
    decision: approval.decision,
    reviewedBy: approval.reviewedBy,
    reviewedAt: approval.reviewedAt,
    lifecycleState: approval.lifecycleState,
    reasons: approval.reasons,
    operatorRationale: approval.operatorRationale,
    readyArtifactPath: approval.readyArtifactPath
  };
  return saveCandidateHistory(existing, baseDir);
}

function buildReplacementTrigger(
  topCandidate: TopReplacementCandidate,
  history: CandidateHistoryRecord | null
): CandidateHistoryRecord["liveOpsEvidence"]["replacementReview"]["trigger"] {
  if (topCandidate.decision === "hold") {
    return "held_top_candidate";
  }
  if (topCandidate.decision === "reject") {
    return "rejected_top_candidate";
  }
  if (history?.outcome?.success === false) {
    return "lost_top_candidate";
  }
  return null;
}

async function updateReplacementEvidenceForReport(
  reportDate: string,
  baseDir?: string
): Promise<number> {
  const root = baseDir ?? process.cwd();
  const [rankedQueue, filingQueue] = await Promise.all([
    readJsonOrNull<RankedQueueSnapshot>(resolve(root, `data/queues/${reportDate}.json`)),
    readJsonOrNull<FilingQueueSnapshot>(resolve(root, `data/filing-queue/${reportDate}.json`))
  ]);

  const topCandidate = rankedQueue?.candidates?.[0];
  if (!topCandidate?.candidateId) {
    return 0;
  }

  const topHistory = await readCandidateHistory(topCandidate.candidateId, root);
  const trigger = buildReplacementTrigger(topCandidate, topHistory);
  if (trigger === null) {
    return 0;
  }

  const replacementFromQueue = (filingQueue?.items ?? []).find((item) =>
    item.candidateId !== topCandidate.candidateId && item.queueStatus === "awaiting_human_approval"
  );
  const replacementFromRanked = rankedQueue?.candidates?.find((candidate) =>
    candidate.candidateId !== topCandidate.candidateId && candidate.decision === "file"
  ) ?? rankedQueue?.candidates?.find((candidate) => candidate.candidateId !== topCandidate.candidateId);
  const replacement = replacementFromQueue ?? replacementFromRanked ?? null;

  if (!topHistory) {
    return 0;
  }

  topHistory.liveOpsEvidence.replacementReview = {
    replacementCandidateId: replacement?.candidateId ?? null,
    replacementHeadline:
      replacement && "headline" in replacement
        ? replacement.headline ?? null
        : null,
    replacementBeat:
      replacement && "beat" in replacement
        ? replacement.beat ?? null
        : null,
    replacementScore:
      replacement && "score" in replacement
        ? replacement.score ?? null
        : null,
    surfacedInTime: replacementFromQueue ? true : replacement ? false : null,
    trigger,
    whyReplacementWasPreferred: replacement
      ? [
          ...(trigger === "held_top_candidate" || trigger === "rejected_top_candidate"
            ? topCandidate.reasons ?? []
            : topHistory.outcome.learningWhy
              ? [topHistory.outcome.learningWhy]
              : topHistory.outcome.note
                ? [topHistory.outcome.note]
                : []),
          ...(replacementFromQueue?.reasons ?? replacementFromRanked?.reasons ?? [])
        ]
      : [],
    reviewedAt: new Date().toISOString()
  };

  await saveCandidateHistory(topHistory, root);
  return 1;
}

function resolveCompetitiveReplayPath(
  reportDate: string,
  candidateId: string,
  baseDir?: string
): string {
  return resolve(baseDir ?? process.cwd(), `data/reports/competitive-replay/${reportDate}/${candidateId}.json`);
}

async function saveCompetitiveReplayArtifact(
  artifact: CompetitiveReplayArtifact,
  baseDir?: string
): Promise<string> {
  const filePath = resolveCompetitiveReplayPath(artifact.reportDate, artifact.candidateId, baseDir);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
  return filePath;
}

async function syncCompetitiveReplayForReport(
  reportDate: string,
  baseDir?: string
): Promise<number> {
  const root = baseDir ?? process.cwd();
  const [briefSnapshot, histories] = await Promise.all([
    readJsonOrNull<BriefWinnerSnapshot>(resolve(root, `data/state/brief-winners-${reportDate}.json`)),
    readCandidateHistoryDir(root)
  ]);

  if (!briefSnapshot) {
    return 0;
  }

  let updatedCount = 0;
  for (const history of histories.filter((entry) => entry.reportDate === reportDate && entry.filing.signalId !== null)) {
    const sameBeatPublishedSignals = (briefSnapshot.publishedSignals ?? [])
      .filter((signal) => signal.beat === history.beat)
      .map((signal) => ({
        signalId: signal.signalId ?? null,
        headline: signal.headline,
        agent: signal.agent,
        publishedAt: signal.publishedAt ?? null
      }));

    const ownWinningSignal = sameBeatPublishedSignals.find((signal) => signal.signalId === history.filing.signalId);
    const winner = ownWinningSignal ?? sameBeatPublishedSignals[0] ?? null;
    const artifact: CompetitiveReplayArtifact = {
      kind: "candidate_competitive_replay",
      reportDate,
      candidateId: history.candidateId,
      generatedAt: new Date().toISOString(),
      filedSignalId: history.filing.signalId,
      headline: history.headline,
      beat: history.beat,
      publishedInBrief: history.outcome.publishedInBrief,
      beatOccupied: sameBeatPublishedSignals.length > 0,
      ownCandidateWon: ownWinningSignal !== undefined || history.outcome.publishedInBrief === true,
      sameBeatPublishedSignals,
      winner: winner
        ? {
            signalId: winner.signalId,
            headline: winner.headline,
            agent: winner.agent
          }
        : null
    };
    const artifactPath = await saveCompetitiveReplayArtifact(artifact, root);

    history.liveOpsEvidence.competitiveReplay = {
      artifactPath,
      beatOccupied: artifact.beatOccupied,
      ownCandidateWon: artifact.ownCandidateWon,
      winnerHeadline: artifact.winner?.headline ?? null,
      winnerAgent: artifact.winner?.agent ?? null,
      reviewedAt: artifact.generatedAt
    };
    await saveCandidateHistory(history, root);
    updatedCount += 1;
  }

  return updatedCount;
}

function previousDate(reportDate: string): string {
  const value = new Date(`${reportDate}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

async function readCandidateHistoryDir(baseDir?: string): Promise<CandidateHistoryRecord[]> {
  const dirPath = resolve(baseDir ?? process.cwd(), "data/candidate-history");

  try {
    const entries = await readdir(dirPath);
    const histories = await Promise.all(
      entries
        .filter((fileName) => fileName.endsWith(".json"))
        .map(async (fileName) =>
          JSON.parse(await readFile(resolve(dirPath, fileName), "utf8")) as CandidateHistoryRecord
        )
    );
    return histories;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function buildNextDayLoopChanges(
  history: CandidateHistoryRecord,
  optimization: OptimizationSnapshot
): string[] {
  const changes: string[] = [];
  const beatPreference = optimization.beatPreferences?.find((beat) => beat.beat === history.beat);
  if (beatPreference) {
    changes.push(
      `Beat ${beatPreference.beat} is now ${beatPreference.preference}: ${beatPreference.rationale}`
    );
  }

  const stylePreference = optimization.stylePerformance?.find(
    (style) => style.style === history.candidateMetadata.styleTested
  );
  if (stylePreference) {
    changes.push(
      `Style ${stylePreference.style} is now ${stylePreference.preference}: ${stylePreference.rationale}`
    );
  }

  if (history.outcome.learningWhy && optimization.packagingAdjustments?.rationale?.length) {
    const outcomeText = history.outcome.learningWhy.toLowerCase();
    if (
      /\bbroader\b|\bnarrow\b|\bpackag/i.test(outcomeText) ||
      /\bheadline\b|\bframing\b/.test(outcomeText)
    ) {
      changes.push(...optimization.packagingAdjustments.rationale);
    }
  }

  if (optimization.topCandidatePerformance?.commonFailurePatterns?.length) {
    changes.push(...optimization.topCandidatePerformance.commonFailurePatterns);
  }

  return [...new Set(changes)];
}

export async function syncCandidateNextDayEvidence(
  reportDate: string,
  baseDir?: string
): Promise<number> {
  const root = baseDir ?? process.cwd();
  const priorReportDate = previousDate(reportDate);
  const [dailyReport, optimization, histories] = await Promise.all([
    readJsonOrNull<DailyReportSnapshot>(resolve(root, `data/reports/daily/${reportDate}.json`)),
    readJsonOrNull<OptimizationSnapshot>(resolve(root, `data/experiments/optimization/${reportDate}.json`)),
    readCandidateHistoryDir(root)
  ]);

  if (!dailyReport || !optimization) {
    return 0;
  }

  const candidatesToUpdate = histories.filter((history) =>
    history.reportDate === priorReportDate &&
    !history.liveOpsEvidence.nextDay.some((entry) => entry.reportDate === reportDate)
  );

  for (const history of candidatesToUpdate) {
    history.liveOpsEvidence.nextDay.push({
      reportDate,
      changedFromYesterday: dailyReport.changedFromYesterday ?? [],
      recommendations: optimization.nextDayRecommendations ?? [],
      loopChanges: buildNextDayLoopChanges(history, optimization)
    });
    await saveCandidateHistory(history, root);
  }

  return candidatesToUpdate.length;
}

export async function syncCandidateReplacementEvidence(
  reportDate: string,
  baseDir?: string
): Promise<number> {
  return updateReplacementEvidenceForReport(reportDate, baseDir);
}

export async function syncCandidateCompetitiveReplay(
  reportDate: string,
  baseDir?: string
): Promise<number> {
  return syncCompetitiveReplayForReport(reportDate, baseDir);
}
