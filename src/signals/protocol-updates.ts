import { buildHeadline } from "./headline-composer.js";
import type {
  CandidateSignal,
  ModelDisclosure,
  ProofRecord,
  SourceRecord,
  ValidationSubject
} from "../types/index.js";

export interface ProtocolUpdateRawEvent {
  id: string;
  detectedAt: string;
  chain: string;
  contractAddress: string;
  deployTxHash: string;
  firstInteractionTxHash: string;
  blockHeight: number;
  summary: string;
  significance: string;
  causalTrigger: string;
  sourceUrls: {
    rpc: string;
    explorer: string;
  };
}

export interface ProtocolUpdateLaneOutput {
  rawEvent: ProtocolUpdateRawEvent;
  subject: ValidationSubject;
}

export function confirmPrimaryLane(): string {
  return "protocol-updates";
}

export function buildProtocolUpdateCandidate(raw: ProtocolUpdateRawEvent): CandidateSignal {
  return {
    candidateId: raw.id,
    detectedAt: raw.detectedAt,
    beat: confirmPrimaryLane(),
    category: "protocol-change",
    summary: raw.summary,
    significance: raw.significance,
    causality: raw.causalTrigger,
    detectionMethod: "raw-query",
    usesDashboardAsPrimarySource: false,
    likelyDuplicate: false
  };
}

export function buildProtocolUpdateProof(raw: ProtocolUpdateRawEvent): ProofRecord[] {
  return [
    {
      chain: raw.chain,
      txHash: raw.firstInteractionTxHash,
      contractAddress: raw.contractAddress,
      queryName: "protocol-update-deploy-and-first-use",
      queryResult: `deploy ${raw.deployTxHash} -> first interaction ${raw.firstInteractionTxHash}`,
      blockHeight: raw.blockHeight,
      proofNote: "First interaction followed deployment in the monitored window."
    }
  ];
}

export function buildProtocolUpdateSources(raw: ProtocolUpdateRawEvent): SourceRecord[] {
  return [
    {
      sourceType: "rpc",
      sourceName: "Protocol Update RPC",
      sourceUrl: raw.sourceUrls.rpc,
      sourceRole: "primary-proof"
    },
    {
      sourceType: "explorer",
      sourceName: "Protocol Update Explorer",
      sourceUrl: raw.sourceUrls.explorer,
      sourceRole: "verification"
    }
  ];
}

export function buildProtocolUpdateDisclosure(raw: ProtocolUpdateRawEvent): ModelDisclosure {
  return {
    toolsUsed: ["query", "clarity-audit"],
    derivationSteps: [
      `Detected deployment activity for ${raw.contractAddress} from direct chain data.`,
      `Matched first-use activity to ${raw.firstInteractionTxHash}.`,
      "Composed the final one-line headline only after proof and sources were attached."
    ]
  };
}

export function normalizeProtocolUpdate(raw: ProtocolUpdateRawEvent): ValidationSubject {
  const candidate = buildProtocolUpdateCandidate(raw);

  return {
    candidate,
    headline: buildHeadline(candidate),
    proof: buildProtocolUpdateProof(raw),
    sources: buildProtocolUpdateSources(raw),
    modelDisclosure: buildProtocolUpdateDisclosure(raw)
  };
}

export function runProtocolUpdateLane(raw: ProtocolUpdateRawEvent): ProtocolUpdateLaneOutput {
  return {
    rawEvent: raw,
    subject: normalizeProtocolUpdate(raw)
  };
}
