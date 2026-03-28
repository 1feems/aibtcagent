import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { PlacementProof } from "../types/paperboy.js";

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const absolutePath = resolve(process.cwd(), filePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(data, null, 2));
}

export async function logPlacementProof(proof: PlacementProof): Promise<string> {
  const datePrefix = proof.deliveredAt.slice(0, 10);
  const signalSegment = sanitizeId(proof.signalId);
  const channelSegment = proof.channel;
  const filePath = `data/logs/deliveries/${datePrefix}-${signalSegment}-delivery-${channelSegment}.json`;
  await writeJson(filePath, proof);
  return filePath;
}

export async function logAllPlacements(
  proofs: PlacementProof[],
  date: string
): Promise<void> {
  const summary = {
    kind: "delivery_day_summary",
    date,
    total: proofs.length,
    succeeded: proofs.filter((p) => p.verified).length,
    failed: proofs.filter((p) => !p.verified).length,
    proofs
  };

  const filePath = `data/logs/deliveries/${date}-summary.json`;
  await writeJson(filePath, summary);
}
