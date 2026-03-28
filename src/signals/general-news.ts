import type { CandidateSignal, ModelDisclosure, ProofRecord, SourceRecord, ValidationSubject } from "../types/index.js";

// Beat-agnostic input. Works for GitHub PRs, Hiro Explorer data,
// on-chain stats, Bitcoin mempool, real-world news, audit reports, etc.
export interface GeneralNewsRawEvent {
  id: string;
  detectedAt: string;
  beat: string; // e.g. "governance", "agent-economy", "security", "infrastructure"
  sourcePublication: string; // "aibtc.news", "Hiro Explorer", "GitHub", "CoinDesk", etc.
  articleUrl: string; // primary source URL — must be publicly accessible
  publishedAt: string;
  namedEntity: string; // company, protocol, contract, agent, or PR
  hardNumber: string; // $ amount, version, block height, %, count — required
  summary: string; // one sentence: what happened
  significance: string; // one sentence: why it matters structurally
  causalTrigger: string; // what caused this event (different from the event itself)
  agentConsequence: string; // what agents should do or know differently now
  proofUrl: string; // URL anyone can open to independently verify the claim
  proofNote: string; // plain-language description of what the proof shows
  usesDashboardAsPrimarySource: boolean;
  likelyDuplicate: boolean;
}

export interface GeneralNewsLaneOutput {
  subject: ValidationSubject;
  rawEvent: GeneralNewsRawEvent;
}

function buildGeneralNewsCandidate(event: GeneralNewsRawEvent): CandidateSignal {
  return {
    candidateId: event.id,
    detectedAt: event.detectedAt,
    beat: event.beat,
    category: "protocol-change",
    detectionMethod: "mixed",
    summary: event.summary,
    significance: event.significance,
    causality: event.causalTrigger,
    usesDashboardAsPrimarySource: event.usesDashboardAsPrimarySource,
    likelyDuplicate: event.likelyDuplicate
  };
}

function buildGeneralNewsHeadline(event: GeneralNewsRawEvent): string {
  const base = `${event.summary} — ${event.agentConsequence}`;
  if (base.length <= 140) return base;
  return `${event.summary.slice(0, 110)} — ${event.agentConsequence.slice(0, 25)}`;
}

function buildGeneralNewsProof(event: GeneralNewsRawEvent): ProofRecord[] {
  return [
    {
      chain: "stacks",
      txHash: null,
      contractAddress: null,
      queryName: `${event.sourcePublication} — ${event.namedEntity}`,
      queryResult: `${event.hardNumber} — ${event.proofNote}`,
      blockHeight: null,
      proofNote: event.proofNote
    }
  ];
}

function buildGeneralNewsSources(event: GeneralNewsRawEvent): SourceRecord[] {
  return [
    {
      sourceType: "live-feed",
      sourceName: event.sourcePublication,
      sourceUrl: event.articleUrl,
      sourceRole: "primary-proof"
    },
    {
      sourceType: "live-feed",
      sourceName: `Verification: ${event.sourcePublication}`,
      sourceUrl: event.proofUrl,
      sourceRole: "verification"
    }
  ];
}

function buildGeneralNewsDisclosure(event: GeneralNewsRawEvent): ModelDisclosure {
  return {
    toolsUsed: ["web-fetch", "article-extraction", "beat-classification"],
    derivationSteps: [
      `Fetched primary source: ${event.articleUrl}`,
      `Identified named entity: ${event.namedEntity}`,
      `Extracted hard number: ${event.hardNumber}`,
      `Verified via: ${event.proofUrl}`,
      `Assessed agent consequence: ${event.agentConsequence}`,
      `Beat assigned: ${event.beat}`
    ]
  };
}

export function runGeneralNewsLane(event: GeneralNewsRawEvent): GeneralNewsLaneOutput {
  const candidate = buildGeneralNewsCandidate(event);
  const headline = buildGeneralNewsHeadline(event);
  const proof = buildGeneralNewsProof(event);
  const sources = buildGeneralNewsSources(event);
  const modelDisclosure = buildGeneralNewsDisclosure(event);

  const subject: ValidationSubject = {
    candidate,
    headline,
    proof,
    sources,
    modelDisclosure
  };

  return { subject, rawEvent: event };
}
