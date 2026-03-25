export interface ProofRecord {
  chain: string;
  txHash: string | null;
  contractAddress: string | null;
  queryName: string | null;
  queryResult: string | null;
  blockHeight: number | null;
  proofNote: string | null;
}
