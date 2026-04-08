export interface BriefSignal {
  signalId: string;
  headline: string;
  beat: string;
  agentAddress: string;
  approvedAt: string;
  briefIncludedAt: string | null;
  sourceUrl: string;
}

export interface DeliveryTarget {
  type: "nostr" | "inbox";
  destination: string; // Nostr relay hashtag context or BTC address
  audienceNote: string; // why this target fits this beat
}

export interface DeliveryMessage {
  signalId: string;
  headline: string; // unaltered — must match BriefSignal.headline exactly
  contextLine: string; // one sentence connecting signal to audience
  fullMessage: string; // contextLine + "\n\n" + headline
  beat: string;
  deliveryTarget: DeliveryTarget;
}

export interface PlacementProof {
  kind: "placement_proof";
  signalId: string;
  beat: string;
  deliveredAt: string;
  channel: "nostr" | "inbox";
  destination: string;
  messageId: string | null;
  headline: string;
  contextLine: string;
  fullMessage: string;
  responseStatus: number | null;
  verified: boolean;
}

export interface DeliveryRunSummary {
  kind: "delivery_run_summary";
  runAt: string;
  reportDate: string;
  briefSignalsFetched: number;
  signalsSelected: number;
  deliveriesAttempted: number;
  deliveriesSucceeded: number;
  deliveriesFailed: number;
  placements: PlacementProof[];
}
