export interface InfrastructureRawEvent {
  id: string;
  detectedAt: string;
  chain: string;
  contractAddress?: string;
  deployTxHash?: string;
  firstInteractionTxHash?: string;
  blockHeight?: number;
  summary: string;
  significance: string;
  causalTrigger: string;
  usesDashboardAsPrimarySource: boolean;
  likelyDuplicate: boolean;
  firstInteractionQueryResult?: string | null;
  versionNumber?: string;
  releaseDate?: string;
  changelogEntry?: string | null;
  proofNote?: string | null;
  sourceUrls: {
    rpc?: string;
    explorer?: string;
    release?: string;
    compare?: string;
  };
}

export interface GeneralNewsRawEvent {
  id: string;
  detectedAt: string;
  beat: string;
  sourcePublication: string;
  articleUrl: string;
  publishedAt: string;
  namedEntity: string;
  hardNumber: string;
  summary: string;
  significance: string;
  causalTrigger: string;
  agentConsequence: string;
  proofUrl: string;
  proofNote: string;
  usesDashboardAsPrimarySource: boolean;
  likelyDuplicate: boolean;
}
