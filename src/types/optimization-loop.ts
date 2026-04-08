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

export interface DailySuccessMetrics {
  targetInBriefWins: number;
  inBriefWins: number;
  satsEarned: number;
  btcRewards: string[];
  targetMet: boolean;
  successDefinition: string;
}

export interface StylePerformanceSnapshot {
  style: string;
  submissions: number;
  resolvedSubmissions: number;
  approvals: number;
  inBriefWins: number;
  approvalRate: number | null;
  briefIncludedRate: number | null;
  satsEarned: number;
  preference: "promote" | "hold" | "demote";
  rationale: string;
}

export interface ScoringFactorAttribution {
  factor: string;
  label: string;
  effect: "boost" | "penalty";
  resolvedSubmissions: number;
  inBriefWins: number;
  approvedNotInBrief: number;
  rejected: number;
  approvalRate: number | null;
  publicationRate: number | null;
  verdict: "validated" | "disproved" | "mixed" | "insufficient_evidence";
  rationale: string;
}

export interface OperatorLoadSnapshot {
  totalSignableCandidates: number;
  headlineRewriteRequiredCount: number;
  rankingOverrideCount: number;
  skippedSignableCount: number;
  untouchedSignableCount: number;
  loadScore: number;
  status: "light" | "moderate" | "heavy";
  headlineRewriteCandidateIds: string[];
  rankingOverrideCandidateIds: string[];
  skippedSignableCandidateIds: string[];
  untouchedSignableCandidateIds: string[];
  rationale: string[];
}

export interface EditorialLearningSnapshot {
  structuralRules: string[];
  sourcingRules: string[];
  timingRules: string[];
  specializationRules: string[];
  competitionRules: string[];
  // Structured enforcement flags — used directly in scoring without text parsing
  timingLossObserved: boolean;
  primaryBeat: string | null;
  secondaryBeat: string | null;
  deprioritizedBeats: string[];
  lateWindowThresholdRaised: boolean;
  rawStatDumpAntiPatternActive: boolean;
  feedOnlySourceAntiPatternActive: boolean;
}

export interface DailyOptimizationSnapshot {
  kind: "daily_optimization";
  reportDate: string;
  generatedAt: string;
  successMetrics: DailySuccessMetrics;
  beatPreferences: BeatPreferenceAdjustment[];
  rejectionThreshold: RejectionThresholdAdjustment;
  duplicateLossPatterns: DuplicateLossPattern[];
  winningHeadlinePatterns: WinningHeadlinePattern[];
  trainingWinningTags: TrainingReasonTag[];
  trainingRejectionTags: TrainingReasonTag[];
  stylePerformance: StylePerformanceSnapshot[];
  factorAttribution: ScoringFactorAttribution[];
  operatorLoad?: OperatorLoadSnapshot;
  packagingAdjustments?: {
    promoteBroadSameBeatPackaging: boolean;
    demoteNarrowFragmentPackaging: boolean;
    rationale: string[];
  };
  beatCrowding: Array<{
    beat: string;
    crowdingScore: number;
    publishedConversionRate: number | null;
    duplicateLosses: number;
  }>;
  competitorIntel: {
    topAgents: Array<{
      agent: string;
      wins: number;
      sameDayMultiWins: number;
      beats: string[];
      commonSourceDomains: Array<{ domain: string; count: number }>;
    }>;
    topSourceDomains: Array<{ domain: string; count: number }>;
    ownedBeats: string[];
    recommendations: string[];
  };
  topCandidatePerformance: {
    recentTopCandidates: Array<{
      reportDate: string;
      candidateId: string;
      beat: string | null;
      score: number | null;
      decision: "file" | "hold" | "reject" | "none";
      outcomeStatus: "approved" | "rejected" | "submitted" | "unknown" | "pending";
      publishedInBrief: boolean | null;
    }>;
    approvalRate: number | null;
    publicationRate: number | null;
    commonFailurePatterns: string[];
    recommendations: string[];
  };
  editorialLearnings: EditorialLearningSnapshot;
  nextDayRecommendations: string[];
}
