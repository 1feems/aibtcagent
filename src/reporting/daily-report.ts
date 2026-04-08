import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateDailyOptimizationSnapshot } from "../loop/index.js";
import type {
  AcceptedSubmissionRecord,
  ApprovalOutcomeRecord,
  CandidateLogRecord,
  DailyReport,
  DailyReportReasonSummary,
  LeaderboardObservationRecord,
  RejectionLogRecord,
  RewardOutcomeRecord
} from "../types/index.js";

interface ReportOptions {
  baseDir?: string;
}

type DailyRecord =
  | CandidateLogRecord
  | RejectionLogRecord
  | AcceptedSubmissionRecord
  | ApprovalOutcomeRecord
  | RewardOutcomeRecord
  | LeaderboardObservationRecord;

interface SavedDailyReportPaths {
  markdownPath: string;
  jsonPath: string;
}

interface RewardSyncState {
  address: string;
  lastCheckedAt: string;
  lastSatsReceived: number;
  lastLeaderboardRank: number | null;
  lastLeaderboardScore: number | null;
  lastAchievementIds: string[];
}

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

async function readJsonOrNull<T>(relativePath: string, baseDir?: string): Promise<T | null> {
  try {
    const absolutePath = resolve(resolveBaseDir(baseDir), relativePath);
    const contents = await readFile(absolutePath, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function toUniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function summarizeReasons(rejections: RejectionLogRecord[]): DailyReportReasonSummary[] {
  const reasonCounts = new Map<string, number>();

  for (const rejection of rejections) {
    for (const reason of rejection.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }

  return [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function buildChangedNarrative(report: Omit<DailyReport, "kind" | "generatedAt" | "markdown">): string[] {
  const changed: string[] = [];
  const { detections, approvalsAndRewards } = report;

  if (detections.totalDetected > 0) {
    changed.push(
      `Detected ${detections.totalDetected} candidate${detections.totalDetected === 1 ? "" : "s"} across ${detections.beats.length} beat${detections.beats.length === 1 ? "" : "s"}.`
    );
  }

  if (detections.totalSubmitted > 0) {
    changed.push(
      `Submitted ${detections.totalSubmitted} candidate${detections.totalSubmitted === 1 ? "" : "s"} with a ${Math.round((detections.submissionConversionRate ?? 0) * 100)}% detection-to-submission conversion rate.`
    );
  }

  if (approvalsAndRewards.totalInBrief > 0) {
    changed.push(
      `Recorded ${approvalsAndRewards.totalInBrief} In Brief win${approvalsAndRewards.totalInBrief === 1 ? "" : "s"} today.`
    );
  }

  if (approvalsAndRewards.totalSatsEarned > 0 || approvalsAndRewards.btcRewards.length > 0) {
    const rewardParts: string[] = [];

    if (approvalsAndRewards.totalSatsEarned > 0) {
      rewardParts.push(`${approvalsAndRewards.totalSatsEarned} sats`);
    }
    if (approvalsAndRewards.btcRewards.length > 0) {
      rewardParts.push(approvalsAndRewards.btcRewards.join(", "));
    }

    changed.push(`Rewards recorded: ${rewardParts.join(" and ")}.`);
  }

  if (approvalsAndRewards.approvalNotInBriefCount > 0) {
    changed.push(
      `${approvalsAndRewards.approvalNotInBriefCount} approved submission${approvalsAndRewards.approvalNotInBriefCount === 1 ? "" : "s"} still failed to make In Brief.`
    );
  }

  if (approvalsAndRewards.leaderboardChanges.length > 0) {
    changed.push(
      `Observed leaderboard movement: ${approvalsAndRewards.leaderboardChanges.join(", ")}.`
    );
  }

  if (changed.length === 0) {
    changed.push("No detections, submissions, In Brief wins, rewards, or leaderboard changes were recorded today.");
  }

  return changed;
}

function buildImproveNarrative(report: Omit<DailyReport, "kind" | "generatedAt" | "markdown">): string[] {
  const improve: string[] = [];
  const { detections, rejections, approvalsAndRewards } = report;
  const topReason = rejections.reasons[0];

  if (detections.totalDetected > 0 && detections.totalSubmitted === 0) {
    improve.push("Convert validated detections into submission-ready packages faster.");
  }

  if (topReason) {
    improve.push(`Reduce ${topReason.reason} rejections, which occurred ${topReason.count} time${topReason.count === 1 ? "" : "s"} today.`);
  }

  if (approvalsAndRewards.totalApprovals > 0 && approvalsAndRewards.totalInBrief === 0) {
    improve.push("Treat approved-but-not-published outcomes as failed beat-slot attempts and rework story breadth, framing, or timing.");
  }

  if (approvalsAndRewards.approvalNotInBriefCount > 0) {
    improve.push("Review the approved-not-in-brief failure notes before filing similar stories again.");
  }

  const proofOrCausalityIssues = rejections.reasons.filter(
    (reason) => reason.reason === "proof_missing" || reason.reason === "causality_missing"
  );
  if (proofOrCausalityIssues.length > 0) {
    improve.push("Tighten proof and causality checks before packaging the next signal.");
  }

  if (
    approvalsAndRewards.leaderboardChanges.length === 0 &&
    (detections.totalDetected > 0 || detections.totalSubmitted > 0 || approvalsAndRewards.totalApprovals > 0)
  ) {
    improve.push("Record a leaderboard observation each day so momentum can be measured.");
  }

  if (approvalsAndRewards.totalInBrief > 0 && approvalsAndRewards.totalSatsEarned === 0 && approvalsAndRewards.btcRewards.length === 0) {
    improve.push("Track reward follow-through after In Brief wins so paid outcomes are not missed.");
  }

  if (
    approvalsAndRewards.daysSinceLastBrief !== null &&
    approvalsAndRewards.daysSinceLastBrief >= 3
  ) {
    improve.push(
      `Brief drought is at ${approvalsAndRewards.daysSinceLastBrief} day${approvalsAndRewards.daysSinceLastBrief === 1 ? "" : "s"}; reject generic filings until they clear the slot-winning bar.`
    );
  }

  if (
    approvalsAndRewards.daysSinceLastOnChainPayout !== null &&
    approvalsAndRewards.daysSinceLastOnChainPayout >= 3
  ) {
    improve.push(
      `Payout drought is at ${approvalsAndRewards.daysSinceLastOnChainPayout} day${approvalsAndRewards.daysSinceLastOnChainPayout === 1 ? "" : "s"}; optimize for stories that can convert into visible wallet sats, not just approvals.`
    );
  }

  if (report.optimization.successMetrics.inBriefWins < report.optimization.successMetrics.targetInBriefWins) {
    improve.push(
      `Target miss: ${report.optimization.successMetrics.inBriefWins}/${report.optimization.successMetrics.targetInBriefWins} In Brief wins today. Keep sourcing and packaging toward the beat-slot target.`
    );
  }

  if (improve.length === 0) {
    improve.push("Keep the current workflow steady and gather another day of outcome data before changing strategy.");
  }

  return improve;
}

function renderMarkdown(report: Omit<DailyReport, "kind" | "markdown">): string {
  const submissionConversionRate = report.detections.submissionConversionRate === null
    ? "n/a"
    : `${Math.round(report.detections.submissionConversionRate * 100)}%`;
  const sameDayResolvedApprovalRate = report.approvalsAndRewards.sameDayResolvedApprovalRate === null
    ? "n/a"
    : `${Math.round(report.approvalsAndRewards.sameDayResolvedApprovalRate * 100)}%`;
  const sameDayResolvedInBriefRate = report.approvalsAndRewards.sameDayResolvedInBriefRate === null
    ? "n/a"
    : `${Math.round(report.approvalsAndRewards.sameDayResolvedInBriefRate * 100)}%`;
  const reasonLines = report.rejections.reasons.length === 0
    ? ["- None recorded"]
    : report.rejections.reasons.map((reason) => `- ${reason.reason}: ${reason.count}`);
  const headlineLines = report.detections.submittedHeadlines.length === 0
    ? ["- None recorded"]
    : report.detections.submittedHeadlines.map((headline) => `- ${headline}`);
  const failureLines = report.approvalsAndRewards.failureNotes.length === 0
    ? ["- None recorded"]
    : report.approvalsAndRewards.failureNotes.map((note) => `- ${note}`);
  const changedLines = report.narrative.changed.map((line) => `- ${line}`);
  const improveLines = report.narrative.improve.map((line) => `- ${line}`);
  const optimizationLines = report.optimization.nextDayRecommendations.map((line) => `- ${line}`);

  return [
    `# Daily Report: ${report.reportDate}`,
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Top KPI",
    `- Success definition: ${report.optimization.successMetrics.successDefinition}`,
    `- In Brief wins: ${report.approvalsAndRewards.totalInBrief}`,
    `- Approved but not briefed: ${report.approvalsAndRewards.approvalNotInBriefCount}`,
    `- Wallet sats realized: ${report.approvalsAndRewards.walletSatsRealized}`,
    `- Days since last brief: ${report.approvalsAndRewards.daysSinceLastBrief ?? "n/a"}`,
    `- Days since last on-chain payout: ${report.approvalsAndRewards.daysSinceLastOnChainPayout ?? "n/a"}`,
    `- In Brief target: ${report.optimization.successMetrics.targetInBriefWins}`,
    `- Sats earned: ${report.approvalsAndRewards.totalSatsEarned}`,
    `- Target met: ${report.optimization.successMetrics.targetMet ? "yes" : "no"}`,
    "",
    "## Detections and Submissions",
    `- Detections: ${report.detections.totalDetected}`,
    `- Submissions: ${report.detections.totalSubmitted}`,
    `- Submission conversion rate: ${submissionConversionRate}`,
    `- Beats touched: ${report.detections.beats.length === 0 ? "none" : report.detections.beats.join(", ")}`,
    `- Detected candidate IDs: ${report.detections.detectedCandidateIds.length === 0 ? "none" : report.detections.detectedCandidateIds.join(", ")}`,
    "- Submitted headlines:",
    ...headlineLines,
    "",
    "## Rejections and Reasons",
    `- Rejections: ${report.rejections.totalRejected}`,
    `- Rejected candidate IDs: ${report.rejections.rejectedCandidateIds.length === 0 ? "none" : report.rejections.rejectedCandidateIds.join(", ")}`,
    "- Reasons:",
    ...reasonLines,
    "",
    "## Approvals and Rewards",
    `- Approvals: ${report.approvalsAndRewards.totalApprovals}`,
    `- In Brief wins: ${report.approvalsAndRewards.totalInBrief}`,
    `- Approved but not in brief: ${report.approvalsAndRewards.approvalNotInBriefCount}`,
    `- Declines: ${report.approvalsAndRewards.totalDeclines}`,
    `- Resolved same-day submissions: ${report.approvalsAndRewards.resolvedSubmissionCount}`,
    `- Pending submissions without same-day outcome: ${report.approvalsAndRewards.pendingSubmissionCount}`,
    `- Same-day resolved approval rate: ${sameDayResolvedApprovalRate}`,
    `- Same-day resolved In Brief rate: ${sameDayResolvedInBriefRate}`,
    `- Total sats earned: ${report.approvalsAndRewards.totalSatsEarned}`,
    `- BTC rewards: ${report.approvalsAndRewards.btcRewards.length === 0 ? "none" : report.approvalsAndRewards.btcRewards.join(", ")}`,
    `- Leaderboard changes: ${report.approvalsAndRewards.leaderboardChanges.length === 0 ? "none" : report.approvalsAndRewards.leaderboardChanges.join(", ")}`,
    `- Approval notes: ${report.approvalsAndRewards.approvalNotes.length === 0 ? "none" : report.approvalsAndRewards.approvalNotes.join(" | ")}`,
    "- Failure notes:",
    ...failureLines,
    "",
    "## What Changed",
    ...changedLines,
    "",
    "## What to Improve",
    ...improveLines,
    "",
    "## Next-Day Recommendations",
    ...optimizationLines,
    ""
  ].join("\n");
}

export async function generateDailyReport(
  reportDate: string,
  generatedAt: string,
  options: ReportOptions = {}
): Promise<DailyReport> {
  const optimization = await generateDailyOptimizationSnapshot(reportDate, generatedAt, options);
  const [allDetections, detections, rejections, submissions, approvals, rewards, leaderboardObservations, rewardSyncState, allApprovals, allRewards] =
    await Promise.all([
      readAllRecords<CandidateLogRecord>("data/logs/candidates", options.baseDir),
      readDailyRecords<CandidateLogRecord>("data/logs/candidates", reportDate, options.baseDir),
      readDailyRecords<RejectionLogRecord>("data/logs/rejections", reportDate, options.baseDir),
      readDailyRecords<AcceptedSubmissionRecord>("data/logs/accepted", reportDate, options.baseDir),
      readDailyRecords<ApprovalOutcomeRecord>("data/outcomes/approvals", reportDate, options.baseDir),
      readDailyRecords<RewardOutcomeRecord>("data/outcomes/rewards", reportDate, options.baseDir),
      readDailyRecords<LeaderboardObservationRecord>(
        "data/logs/leaderboard",
        reportDate,
        options.baseDir
      ),
      readJsonOrNull<RewardSyncState>("data/state/reward-sync.json", options.baseDir),
      readAllRecords<ApprovalOutcomeRecord>("data/outcomes/approvals", options.baseDir),
      readAllRecords<RewardOutcomeRecord>("data/outcomes/rewards", options.baseDir)
    ]);
  const detectedCandidateIdsForDay = new Set(
    allDetections
      .filter((record) => isSameDay(record.candidate.detectedAt, reportDate))
      .map((record) => record.candidate.candidateId)
  );
  const submissionsForDetectedDay = submissions.filter((record) =>
    detectedCandidateIdsForDay.has(record.candidateId)
  );
  const approvalsByCandidateId = new Map(approvals.map((record) => [record.candidateId, record]));
  const resolvedSubmissions = submissionsForDetectedDay.filter((record) =>
    approvalsByCandidateId.has(record.candidateId)
  );
  const resolvedApprovals = resolvedSubmissions.filter((record) =>
    approvalsByCandidateId.get(record.candidateId)?.approved === true
  );
  const resolvedInBrief = resolvedSubmissions.filter((record) =>
    approvalsByCandidateId.get(record.candidateId)?.published === true
  );
  const approvalNotInBrief = approvals.filter((record) => record.approved && record.published !== true);
  const mostRecentBrief = allApprovals
    .filter((record) => record.published === true)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0] ?? null;
  const mostRecentReward = allRewards
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0] ?? null;
  const daysSince = (timestamp: string | null): number | null => {
    if (!timestamp) return null;
    const generatedMs = Date.parse(generatedAt);
    const seenMs = Date.parse(timestamp);
    if (Number.isNaN(generatedMs) || Number.isNaN(seenMs) || generatedMs < seenMs) {
      return null;
    }
    return Math.floor((generatedMs - seenMs) / 86400000);
  };

  const baseReport = {
    reportDate,
    detections: {
      totalDetected: detections.length,
      totalSubmitted: submissionsForDetectedDay.length,
      submissionConversionRate: formatRatio(submissionsForDetectedDay.length, detections.length),
      detectedCandidateIds: detections.map((record) => record.candidate.candidateId).sort(),
      submittedCandidateIds: submissionsForDetectedDay.map((record) => record.candidateId).sort(),
      submittedHeadlines: submissionsForDetectedDay.map((record) => record.submission.headline).sort(),
      beats: toUniqueSorted(detections.map((record) => record.candidate.beat))
    },
    rejections: {
      totalRejected: rejections.length,
      rejectedCandidateIds: rejections.map((record) => record.candidateId).sort(),
      reasons: summarizeReasons(rejections)
    },
    approvalsAndRewards: {
      totalApprovals: approvals.filter((record) => record.approved).length,
      totalDeclines: approvals.filter((record) => !record.approved).length,
      totalInBrief: approvals.filter((record) => record.published === true).length,
      approvalNotInBriefCount: approvalNotInBrief.length,
      walletSatsRealized: rewardSyncState?.lastSatsReceived ?? 0,
      daysSinceLastBrief: daysSince(mostRecentBrief?.recordedAt ?? null),
      daysSinceLastOnChainPayout: daysSince(mostRecentReward?.recordedAt ?? null),
      resolvedSubmissionCount: resolvedSubmissions.length,
      pendingSubmissionCount: submissionsForDetectedDay.length - resolvedSubmissions.length,
      sameDayResolvedApprovalRate: formatRatio(
        resolvedApprovals.length,
        resolvedSubmissions.length
      ),
      sameDayResolvedInBriefRate: formatRatio(
        resolvedInBrief.length,
        resolvedSubmissions.length
      ),
      approvalNotes: approvals
        .map((record) => record.note)
        .filter((note): note is string => note !== null)
        .sort(),
      failureNotes: approvalNotInBrief
        .map((record) => record.learningWhy ?? record.note)
        .filter((note): note is string => note !== null)
        .sort(),
      totalSatsEarned: rewards.reduce(
        (sum, record) => sum + (record.satsEarned ?? 0),
        0
      ),
      btcRewards: rewards
        .map((record) => record.btcRewardEarned)
        .filter((reward): reward is string => reward !== null)
        .sort(),
      leaderboardChanges: toUniqueSorted(
        leaderboardObservations
          .map((record) => record.leaderboardMovement)
          .filter((movement): movement is string => movement !== null)
      )
    },
    narrative: {
      changed: [] as string[],
      improve: [] as string[]
    },
    optimization
  };

  baseReport.narrative.changed = buildChangedNarrative(baseReport);
  baseReport.narrative.improve = buildImproveNarrative(baseReport);

  return {
    kind: "daily_report",
    generatedAt,
    ...baseReport,
    markdown: renderMarkdown({
      generatedAt,
      ...baseReport
    })
  };
}

export async function saveDailyReport(
  report: DailyReport,
  options: ReportOptions = {}
): Promise<SavedDailyReportPaths> {
  const markdownPath = resolve(
    resolveBaseDir(options.baseDir),
    `data/reports/daily/${report.reportDate}.md`
  );
  const jsonPath = resolve(
    resolveBaseDir(options.baseDir),
    `data/reports/daily/${report.reportDate}.json`
  );
  await mkdir(dirname(markdownPath), { recursive: true });
  await writeFile(markdownPath, report.markdown, "utf8");
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  return { markdownPath, jsonPath };
}

export async function generateAndSaveDailyReport(
  reportDate: string,
  generatedAt: string,
  options: ReportOptions = {}
): Promise<{ report: DailyReport; savedTo: string; savedJsonTo: string }> {
  const report = await generateDailyReport(reportDate, generatedAt, options);
  const savedPaths = await saveDailyReport(report, options);
  return {
    report,
    savedTo: savedPaths.markdownPath,
    savedJsonTo: savedPaths.jsonPath
  };
}
