import type { DeliveryMessage, PlacementProof } from "../types/paperboy.js";

const AIBTC_API_BASE = process.env["AIBTC_API_BASE"] ?? "https://aibtc.com/api";
const AGENT_BTC_ADDRESS = process.env["AIBTC_BITCOIN_ADDRESS"] ?? "";

interface NostrPostPayload {
  content: string;
  tags?: string[][];
}

interface InboxPostPayload {
  message: string;
  from: string;
}

async function deliverViaNostr(
  message: DeliveryMessage,
  deliveredAt: string
): Promise<PlacementProof> {
  const tags = message.deliveryTarget.destination
    .split(" ")
    .filter((t) => t.startsWith("#"))
    .map((t) => ["t", t.slice(1)]);

  const payload: NostrPostPayload = {
    content: message.fullMessage,
    tags
  };

  let messageId: string | null = null;
  let responseStatus: number | null = null;
  let verified = false;

  try {
    const response = await fetch(`${AIBTC_API_BASE}/nostr/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Address": AGENT_BTC_ADDRESS
      },
      body: JSON.stringify(payload)
    });

    responseStatus = response.status;

    if (response.ok) {
      const data = (await response.json()) as { id?: string; event_id?: string };
      messageId = data.id ?? data.event_id ?? null;
      verified = true;
    }
  } catch (error) {
    // network failure — proof recorded with verified=false
  }

  return {
    kind: "placement_proof",
    signalId: message.signalId,
    beat: message.beat,
    deliveredAt,
    channel: "nostr",
    destination: message.deliveryTarget.destination,
    messageId,
    headline: message.headline,
    contextLine: message.contextLine,
    fullMessage: message.fullMessage,
    responseStatus,
    verified
  };
}

async function deliverViaInbox(
  message: DeliveryMessage,
  deliveredAt: string
): Promise<PlacementProof> {
  const targetAddress = message.deliveryTarget.destination;

  const payload: InboxPostPayload = {
    message: message.fullMessage,
    from: AGENT_BTC_ADDRESS
  };

  let messageId: string | null = null;
  let responseStatus: number | null = null;
  let verified = false;

  try {
    const response = await fetch(`${AIBTC_API_BASE}/inbox/${targetAddress}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Address": AGENT_BTC_ADDRESS
      },
      body: JSON.stringify(payload)
    });

    responseStatus = response.status;

    if (response.ok) {
      const data = (await response.json()) as { id?: string; message_id?: string };
      messageId = data.id ?? data.message_id ?? null;
      verified = true;
    }
  } catch (error) {
    // network failure — proof recorded with verified=false
  }

  return {
    kind: "placement_proof",
    signalId: message.signalId,
    beat: message.beat,
    deliveredAt,
    channel: "inbox",
    destination: targetAddress,
    messageId,
    headline: message.headline,
    contextLine: message.contextLine,
    fullMessage: message.fullMessage,
    responseStatus,
    verified
  };
}

export async function deliverMessage(message: DeliveryMessage): Promise<PlacementProof> {
  const deliveredAt = new Date().toISOString();

  if (message.deliveryTarget.type === "inbox") {
    return deliverViaInbox(message, deliveredAt);
  }

  return deliverViaNostr(message, deliveredAt);
}
