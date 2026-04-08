import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  fetchBriefSignals,
  pickSignalsForDelivery,
  composeDeliveryMessage,
  deliverMessage,
  logPlacementProof,
  logAllPlacements
} from "../paperboy/index.js";
import type { DeliveryRunSummary, PlacementProof } from "../types/paperboy.js";

interface PaperboyRunConfig {
  reportDate: string;
  runAt: string;
  outputDir: string;
  briefOnly: boolean; // true = only brief-included signals; false = all approved
}

function parseArgs(argv: string[]): PaperboyRunConfig {
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) continue;
    parsed.set(token.slice(2), next);
    index += 1;
  }

  const runAt = parsed.get("run-at") ?? new Date().toISOString();
  const reportDate = parsed.get("report-date") ?? runAt.slice(0, 10);

  return {
    reportDate,
    runAt,
    outputDir: parsed.get("output-dir") ?? `data/deliveries/${reportDate}`,
    briefOnly: parsed.get("brief-only") !== "false"
  };
}

async function writeJsonFile(filePath: string, data: unknown): Promise<string> {
  const absolutePath = resolve(process.cwd(), filePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(data, null, 2), "utf8");
  return absolutePath;
}

export async function runPaperboyDelivery(
  config: PaperboyRunConfig
): Promise<DeliveryRunSummary> {
  const allSignals = await fetchBriefSignals(config.reportDate);

  const signals = config.briefOnly
    ? allSignals.filter((s) => s.briefIncludedAt !== null)
    : allSignals;

  const picks = await pickSignalsForDelivery(signals, config.reportDate);

  const placements: PlacementProof[] = [];

  for (const { signal, target } of picks) {
    const message = composeDeliveryMessage(signal, target);
    const proof = await deliverMessage(message);
    await logPlacementProof(proof);
    placements.push(proof);
  }

  await logAllPlacements(placements, config.reportDate);

  const summary: DeliveryRunSummary = {
    kind: "delivery_run_summary",
    runAt: config.runAt,
    reportDate: config.reportDate,
    briefSignalsFetched: allSignals.length,
    signalsSelected: picks.length,
    deliveriesAttempted: placements.length,
    deliveriesSucceeded: placements.filter((p) => p.verified).length,
    deliveriesFailed: placements.filter((p) => !p.verified).length,
    placements
  };

  await writeJsonFile(`${config.outputDir}/paperboy-summary.json`, summary);
  return summary;
}

async function main(): Promise<void> {
  const summary = await runPaperboyDelivery(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
