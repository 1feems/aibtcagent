import { buildHeadline } from "./headline-composer.js";
import type {
  CandidateSignal,
  ModelDisclosure,
  ProofRecord,
  SourceRecord,
  ValidationSubject
} from "../types/index.js";

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

export interface InfrastructureLaneOutput {
  rawEvent: InfrastructureRawEvent;
  subject: ValidationSubject;
}

const PRIMARY_LANE_BEAT = "infrastructure";

export function confirmPrimaryLane(): string {
  return PRIMARY_LANE_BEAT;
}

export function buildInfrastructureCandidate(raw: InfrastructureRawEvent): CandidateSignal {
  return {
    candidateId: raw.id,
    detectedAt: raw.detectedAt,
    beat: confirmPrimaryLane(),
    category: "protocol-change",
    summary: raw.summary,
    significance: raw.significance,
    causality: raw.causalTrigger,
    detectionMethod: "raw-query",
    usesDashboardAsPrimarySource: raw.usesDashboardAsPrimarySource,
    likelyDuplicate: raw.likelyDuplicate
  };
}

export function buildInfrastructureProof(raw: InfrastructureRawEvent): ProofRecord[] {
  const isReleaseStyle = Boolean(raw.versionNumber && raw.sourceUrls.release);

  if (isReleaseStyle) {
    return [
      {
        chain: raw.chain,
        txHash: null,
        contractAddress: raw.versionNumber ?? null,
        queryName: "protocol-update-versioned-release",
        queryResult: raw.changelogEntry ?? null,
        blockHeight: null,
        proofNote:
          raw.proofNote ??
          "Primary proof comes from the versioned release tag and changelog in the public source."
      }
    ];
  }

  return [
    {
      chain: raw.chain,
      txHash: raw.firstInteractionTxHash ?? null,
      contractAddress: raw.contractAddress ?? null,
      queryName: "protocol-update-deploy-and-first-use",
      queryResult: raw.firstInteractionQueryResult ?? null,
      blockHeight: raw.blockHeight ?? null,
      proofNote:
        raw.proofNote ?? "First interaction followed deployment in the monitored window."
    }
  ];
}

export function buildInfrastructureSources(raw: InfrastructureRawEvent): SourceRecord[] {
  const isReleaseStyle = Boolean(raw.versionNumber && raw.sourceUrls.release);

  if (isReleaseStyle) {
    const sources: SourceRecord[] = [
      {
        sourceType: "documentation",
        sourceName: "Infrastructure Release",
        sourceUrl: raw.sourceUrls.release ?? "",
        sourceRole: "primary-proof"
      }
    ];

    if (raw.sourceUrls.compare) {
      sources.push({
        sourceType: "documentation",
        sourceName: "Infrastructure Compare",
        sourceUrl: raw.sourceUrls.compare,
        sourceRole: "verification"
      });
    }

    return sources;
  }

  return [
    {
      sourceType: "rpc",
      sourceName: "Infrastructure RPC",
      sourceUrl: raw.sourceUrls.rpc ?? "",
      sourceRole: "primary-proof"
    },
    {
      sourceType: "explorer",
      sourceName: "Infrastructure Explorer",
      sourceUrl: raw.sourceUrls.explorer ?? "",
      sourceRole: "verification"
    }
  ];
}

export function buildInfrastructureDisclosure(raw: InfrastructureRawEvent): ModelDisclosure {
  const isReleaseStyle = Boolean(raw.versionNumber && raw.sourceUrls.release);

  if (isReleaseStyle) {
    return {
      toolsUsed: ["release-audit", "changelog-review"],
      derivationSteps: [
        `Detected a versioned release for ${raw.versionNumber} from the primary source.`,
        `Read the changelog entry "${raw.changelogEntry ?? "release note"}" from the public release body.`,
        "Composed the final one-line headline only after the exact version, change, and consequence were attached."
      ]
    };
  }

  return {
    toolsUsed: ["query", "clarity-audit"],
    derivationSteps: [
      `Detected deployment activity for ${raw.contractAddress ?? "the target contract"} from direct chain data.`,
      `Matched first-use activity to ${raw.firstInteractionTxHash ?? "the first interaction"}.`,
      "Composed the final one-line headline only after proof and sources were attached."
    ]
  };
}

export function normalizeInfrastructure(raw: InfrastructureRawEvent): ValidationSubject {
  const candidate = buildInfrastructureCandidate(raw);

  return {
    candidate,
    headline: buildHeadline(candidate),
    proof: buildInfrastructureProof(raw),
    sources: buildInfrastructureSources(raw),
    modelDisclosure: buildInfrastructureDisclosure(raw)
  };
}

export function runInfrastructureLane(raw: InfrastructureRawEvent): InfrastructureLaneOutput {
  return {
    rawEvent: raw,
    subject: normalizeInfrastructure(raw)
  };
}
