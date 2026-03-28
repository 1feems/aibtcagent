export interface BeatPreferenceAdjustment {
  beat: string;
  detections: number;
  submissions: number;
  approvals: number;
  published: number;
  duplicateLosses: number;
  approvalRate: number | null;
  publicationRate: number | null;
  preference: "increase" | "hold" | "decrease";
  rationale: string;
}

export interface RejectionThresholdAdjustment {
  mode: "standard" | "tightened";
  drivers: string[];
}

export interface DuplicateLossPattern {
  beat: string;
  count: number;
  candidateIds: string[];
}

export interface WinningHeadlinePattern {
  pattern: string;
  count: number;
}

export interface TrainingReasonTag {
  tag: string;
  count: number;
}

export interface DailyOptimizationSnapshot {
  kind: "daily_optimization";
  reportDate: string;
  generatedAt: string;
  beatPreferences: BeatPreferenceAdjustment[];
  rejectionThreshold: RejectionThresholdAdjustment;
  duplicateLossPatterns: DuplicateLossPattern[];
  winningHeadlinePatterns: WinningHeadlinePattern[];
  trainingWinningTags: TrainingReasonTag[];
  trainingRejectionTags: TrainingReasonTag[];
  nextDayRecommendations: string[];
}
