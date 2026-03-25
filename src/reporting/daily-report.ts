import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
      `Submitted ${detections.totalSubmitted} candidate${detections.totalSubmitted === 1 ? "" : "s"} with a ${detections.detectionRate === null ? 0 : Math.round(detections.detectionRate * 100)}% detection-to-submission conversion rate.`
    );
  }

  if (approvalsAndRewards.totalApprovals > 0) {
    changed.push(
      `Recorded ${approvalsAndRewards.totalApprovals} approval${approvalsAndRewards.totalApprovals === 1 ? "" : "s"} today.`
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

  if (approvalsAndRewards.leaderboardChanges.length > 0) {
    changed.push(
      `Observed leaderboard movement: ${approvalsAndRewards.leaderboardChanges.join(", ")}.`
    );
  }

  if (changed.length === 0) {
    changed.push("No detections, submissions, approvals, rewards, or leaderboard changes were recorded today.");
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

  if (detections.totalSubmitted > 0 && approvalsAndRewards.totalApprovals === 0) {
    improve.push("Tighten proof quality and duplicate checks before submitting.");
  }

  if (approvalsAndRewards.leaderboardChanges.length === 0) {
    improve.push("Record a leaderboard observation each day so momentum can be measured.");
  }

  if (approvalsAndRewards.totalApprovals > 0 && approvalsAndRewards.totalSatsEarned === 0 && approvalsAndRewards.btcRewards.length === 0) {
    improve.push("Track reward follow-through after approvals so paid outcomes are not missed.");
  }

  if (improve.length === 0) {
    improve.push("Keep the current workflow steady and gather another day of outcome data before changing strategy.");
  }

  return improve;
}

function renderMarkdown(report: Omit<DailyReport, "kind" | "markdown">): string {
  const detectionRate = report.detections.detectionRate === null
    ? "n/a"
    : `${Math.round(report.detections.detectionRate * 100)}%`;
  const approvalRate = report.approvalsAndRewards.approvalRate === null
    ? "n/a"
    : `${Math.round(report.approvalsAndRewards.approvalRate * 100)}%`;
  const reasonLines = report.rejections.reasons.length === 0
    ? ["- None recorded"]
    : report.rejections.reasons.map((reason) => `- ${reason.reason}: ${reason.count}`);
  const headlineLines = report.detections.submittedHeadlines.length === 0
    ? ["- None recorded"]
    : report.detections.submittedHeadlines.map((headline) => `- ${headline}`);
  const changedLines = report.narrative.changed.map((line) => `- ${line}`);
  const improveLines = report.narrative.improve.map((line) => `- ${line}`);

  return [
    `# Daily Report: ${report.reportDate}`,
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Detections and Submissions",
    `- Detections: ${report.detections.totalDetected}`,
    `- Submissions: ${report.detections.totalSubmitted}`,
    `- Detection to submission rate: ${detectionRate}`,
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
    `- Declines: ${report.approvalsAndRewards.totalDeclines}`,
    `- Approval rate: ${approvalRate}`,
    `- Total sats earned: ${report.approvalsAndRewards.totalSatsEarned}`,
    `- BTC rewards: ${report.approvalsAndRewards.btcRewards.length === 0 ? "none" : report.approvalsAndRewards.btcRewards.join(", ")}`,
    `- Leaderboard changes: ${report.approvalsAndRewards.leaderboardChanges.length === 0 ? "none" : report.approvalsAndRewards.leaderboardChanges.join(", ")}`,
    `- Approval notes: ${report.approvalsAndRewards.approvalNotes.length === 0 ? "none" : report.approvalsAndRewards.approvalNotes.join(" | ")}`,
    "",
    "## What Changed",
    ...changedLines,
    "",
    "## What to Improve",
    ...improveLines,
    ""
  ].join("\n");
}

export async function generateDailyReport(
  reportDate: string,
  generatedAt: string,
  options: ReportOptions = {}
): Promise<DailyReport> {
  const [detections, rejections, submissions, approvals, rewards, leaderboardObservations] =
    await Promise.all([
      readDailyRecords<CandidateLogRecord>("data/logs/candidates", reportDate, options.baseDir),
      readDailyRecords<RejectionLogRecord>("data/logs/rejections", reportDate, options.baseDir),
      readDailyRecords<AcceptedSubmissionRecord>("data/logs/accepted", reportDate, options.baseDir),
      readDailyRecords<ApprovalOutcomeRecord>("data/outcomes/approvals", reportDate, options.baseDir),
      readDailyRecords<RewardOutcomeRecord>("data/outcomes/rewards", reportDate, options.baseDir),
      readDailyRecords<LeaderboardObservationRecord>(
        "data/logs/leaderboard",
        reportDate,
        options.baseDir
      )
    ]);

  const baseReport = {
    reportDate,
    detections: {
      totalDetected: detections.length,
      totalSubmitted: submissions.length,
      detectionRate: formatRatio(submissions.length, detections.length),
      detectedCandidateIds: detections.map((record) => record.candidate.candidateId).sort(),
      submittedCandidateIds: submissions.map((record) => record.candidateId).sort(),
      submittedHeadlines: submissions.map((record) => record.submission.headline).sort(),
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
      approvalRate: formatRatio(
        approvals.filter((record) => record.approved).length,
        submissions.length
      ),
      approvalNotes: approvals
        .map((record) => record.note)
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
    }
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
): Promise<string> {
  const filePath = resolve(resolveBaseDir(options.baseDir), `data/reports/daily/${report.reportDate}.md`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, report.markdown, "utf8");
  return filePath;
}

export async function generateAndSaveDailyReport(
  reportDate: string,
  generatedAt: string,
  options: ReportOptions = {}
): Promise<{ report: DailyReport; savedTo: string }> {
  const report = await generateDailyReport(reportDate, generatedAt, options);
  const savedTo = await saveDailyReport(report, options);
  return { report, savedTo };
}
