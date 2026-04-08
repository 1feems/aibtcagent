export type SignalCategory =
  | "protocol-change"
  | "liquidity-shift"
  | "yield-opportunity"
  | "incentive-event"
  | "market-structure";

export type DetectionMethod =
  | "mempool"
  | "raw-query"
  | "contract-analysis"
  | "agent-tip"
  | "mixed";

export interface CandidateSignal {
  candidateId: string;
  detectedAt: string;
  beat: string;
  category: SignalCategory;
  summary: string;
  significance: string;
  causality: string;
  detectionMethod: DetectionMethod;
  usesDashboardAsPrimarySource: boolean;
  likelyDuplicate: boolean;
}
