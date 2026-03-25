import type { DailyOptimizationSnapshot } from "./optimization-loop.js";

export interface DailyReportReasonSummary {
  reason: string;
  count: number;
}

export interface DailyReportDetectionsSummary {
  totalDetected: number;
  totalSubmitted: number;
  submissionConversionRate: number | null;
  detectedCandidateIds: string[];
  submittedCandidateIds: string[];
  submittedHeadlines: string[];
  beats: string[];
}

export interface DailyReportRejectionsSummary {
  totalRejected: number;
  rejectedCandidateIds: string[];
  reasons: DailyReportReasonSummary[];
}

export interface DailyReportApprovalsSummary {
  totalApprovals: number;
  totalDeclines: number;
  resolvedSubmissionCount: number;
  pendingSubmissionCount: number;
  sameDayResolvedApprovalRate: number | null;
  approvalNotes: string[];
  totalSatsEarned: number;
  btcRewards: string[];
  leaderboardChanges: string[];
}

export interface DailyReportNarrativeSummary {
  changed: string[];
  improve: string[];
}

export interface DailyReport {
  kind: "daily_report";
  reportDate: string;
  generatedAt: string;
  detections: DailyReportDetectionsSummary;
  rejections: DailyReportRejectionsSummary;
  approvalsAndRewards: DailyReportApprovalsSummary;
  narrative: DailyReportNarrativeSummary;
  optimization: DailyOptimizationSnapshot;
  markdown: string;
}
