import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { BriefSignal, DeliveryTarget } from "../types/paperboy.js";

// Beat → delivery targets mapping.
// Nostr destinations use hashtag context strings; inbox destinations use BTC addresses.
// Extend this map as new delivery channels are identified.
const BEAT_TARGETS: Record<string, DeliveryTarget[]> = {
  infrastructure: [
    {
      type: "nostr",
      destination: "#stacks #bitcoin #infrastructure #buildonbitcoin",
      audienceNote: "relay operators and infrastructure builders on Nostr"
    }
  ],
  "agent-economy": [
    {
      type: "nostr",
      destination: "#stacks #bitcoinagents #agenteconomy",
      audienceNote: "agents tracking yield, rewards, and onchain earnings"
    }
  ],
  "agent-skills": [
    {
      type: "nostr",
      destination: "#stacks #agentskills #aibtc",
      audienceNote: "agent developers watching new skill releases"
    }
  ],
  "agent-trading": [
    {
      type: "nostr",
      destination: "#stacks #defi #agenttrading #bitcoin",
      audienceNote: "trading agents and DeFi participants"
    }
  ],
  "agent-social": [
    {
      type: "nostr",
      destination: "#stacks #nostr #agentsocial #aibtc",
      audienceNote: "social layer agents and Nostr participants"
    }
  ],
  "deal-flow": [
    {
      type: "nostr",
      destination: "#stacks #bitcoin #dealflow #startups",
      audienceNote: "investors and founders watching deal activity"
    }
  ],
  governance: [
    {
      type: "nostr",
      destination: "#stacks #governance #bitcoin",
      audienceNote: "token holders and governance participants"
    }
  ],
  onboarding: [
    {
      type: "nostr",
      destination: "#stacks #bitcoin #onboarding #aibtc",
      audienceNote: "newcomers and agents helping others onboard"
    }
  ],
  security: [
    {
      type: "nostr",
      destination: "#stacks #bitcoin #security #audits",
      audienceNote: "security researchers and protocol watchers"
    }
  ],
  distribution: [
    {
      type: "nostr",
      destination: "#stacks #aibtcnews #distribution",
      audienceNote: "correspondents and distribution agents"
    }
  ]
};

async function getAlreadyDeliveredSignalIds(date: string): Promise<Set<string>> {
  const dir = resolve(process.cwd(), `data/logs/deliveries`);
  const delivered = new Set<string>();

  try {
    const entries = await readdir(dir);
    const prefix = date.slice(0, 10);
    for (const entry of entries) {
      if (entry.startsWith(prefix) || entry.includes("-delivery-")) {
        const match = entry.match(/^(.+?)-delivery-/);
        if (match) delivered.add(match[1]);
      }
    }
  } catch {
    // no deliveries yet — directory may not exist
  }

  return delivered;
}

export async function pickSignalsForDelivery(
  signals: BriefSignal[],
  date: string
): Promise<Array<{ signal: BriefSignal; target: DeliveryTarget }>> {
  const alreadyDelivered = await getAlreadyDeliveredSignalIds(date);
  const picks: Array<{ signal: BriefSignal; target: DeliveryTarget }> = [];

  for (const signal of signals) {
    if (alreadyDelivered.has(signal.signalId)) continue;

    const targets = BEAT_TARGETS[signal.beat];
    if (!targets || targets.length === 0) continue;

    // Take the first matching target per signal. Expand later.
    picks.push({ signal, target: targets[0] });
  }

  return picks;
}
