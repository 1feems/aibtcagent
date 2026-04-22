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
  totalInBrief: number;
  approvalNotInBriefCount: number;
  walletSatsRealized: number;
  daysSinceLastBrief: number | null;
  daysSinceLastOnChainPayout: number | null;
  resolvedSubmissionCount: number;
  pendingSubmissionCount: number;
  sameDayResolvedApprovalRate: number | null;
  sameDayResolvedInBriefRate: number | null;
  approvalNotes: string[];
  failureNotes: string[];
  totalSatsEarned: number;
  btcRewards: string[];
  leaderboardChanges: string[];
}

export interface DailyReportNarrativeSummary {
  changed: string[];
  improve: string[];
}

export interface CandidateFilingReview {
  candidateId: string;
  headline: string;
  beat: string;
  score: number;
  alreadyFiled: boolean;
  flags: string[];
  briefComparison: string[];
  briefReadiness: "ready" | "borderline" | "not_ready";
  actionRequired: string;
  competitorContext: string | null;
  suggestedHeadline: string | null;
  detectedAt: string | null;
}

export interface DailyOperatorSummary {
  kind: "daily_operator_summary";
  reportDate: string;
  generatedAt: string;
  staggeredDispatch: {
    queueStatus: "active" | "paused" | "completed" | "cancelled" | "unavailable";
    nextCandidateId: string | null;
    nextHeadline: string | null;
    nextDueAt: string | null;
    nextStatus: string | null;
    pendingCount: number;
    notes: string[];
  };
  topCandidate: {
    candidateId: string | null;
    score: number | null;
    decision: "file" | "hold" | "reject" | "none";
    headline: string | null;
    reasons: string[];
  };
  candidateReview: CandidateFilingReview[];
  whyItRankedFirst: string[];
  rationaleGroups: Array<{
    label: string;
    points: string[];
  }>;
  operatorBoundary: string[];
  queueGuidance: string[];
  workingLoop: string[];
  changedFromYesterday: string[];
  improving: {
    status: "yes" | "no" | "unclear";
    reasons: string[];
  };
  urgencyNotes: string[];
  briefIngestStatus: {
    ingested: boolean;
    learned: boolean;
    inputPath: string;
    verifiedFiles: string[];
    missingFiles: string[];
    staleFiles: string[];
    note: string;
  };
}

export interface DailyCompetitorReview {
  kind: "daily_competitor_review";
  reportDate: string;
  generatedAt: string;
  whoWonToday: Array<{
    agent: string;
    appearances: number;
    beats: string[];
    headlines: string[];
  }>;
  stylesUsed: Array<{
    agent: string;
    styleLabel: string;
    styleReason: string;
    beats: string[];
  }>;
  copyTomorrow: string[];
  stopDoing: string[];
}

export interface FailureMemo {
  kind: "failure_memo";
  reportDate: string;
  generatedAt: string;
  candidateId: string;
  headline: string | null;
  beat: string | null;
  categories: Array<
    | "duplicate"
    | "stale"
    | "too_narrow"
    | "wrong_beat"
    | "weak_headline"
    | "weak_packaging"
    | "approved_but_not_published"
  >;
  summary: string;
  evidence: string[];
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
