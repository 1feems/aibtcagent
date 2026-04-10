import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runDailyLearn } from "../loop/index.js";
import { runFetchAndRun } from "../loop/fetch-and-run.js";
import {
  replenishCandidateSlate,
  countStrongCandidates
} from "./replenishment.js";
import {
  autoLabelResolvedOutcomes,
  refreshOutcomeFeedbackMemory,
  refreshSnapshotMemory,
  syncRuntimeMemory
} from "../learning/index.js";
import { ingestManualDailyBrief, trackBriefWinners } from "../brief/index.js";
import { saveFilingQueue, writeTrustedSignalSlate } from "../filing/index.js";
import { getPacificReportDate } from "../utils/report-date.js";

interface SignalLoopConfig {
  reportDate: string;
  generatedAt: string;
}

function parseArgs(argv: string[]): SignalLoopConfig {
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.set(key, "true");
      continue;
    }

    parsed.set(key, next);
    index += 1;
  }

  const now = new Date().toISOString();
  return {
    reportDate: parsed.get("date") ?? getPacificReportDate(now),
    generatedAt: parsed.get("generated-at") ?? now
  };
}

export async function runSignalLoop(argv: string[] = process.argv.slice(2)): Promise<void> {
  const config = parseArgs(argv);
  process.stdout.write(`[signal-loop] starting for ${config.reportDate}\n`);
  process.stdout.write("[signal-loop] goal: produce safe, sendable filing candidates through the repo loop\n");

  await runDailyLearn([
    "--date",
    config.reportDate,
    "--generated-at",
    config.generatedAt
  ]);

  const autoLabel = await autoLabelResolvedOutcomes();
  process.stdout.write(`[signal-loop] auto-labeled ${autoLabel.labeledCount} resolved outcome(s)\n`);
  const snapshotMemory = await refreshSnapshotMemory();
  process.stdout.write(
    `[signal-loop] snapshot memory refreshed from ${snapshotMemory.sourceFiles.length} raw snapshot file(s) with ${snapshotMemory.lessonCount} derived lesson(s)\n`
  );
  const outcomeFeedbackMemory = await refreshOutcomeFeedbackMemory();
  process.stdout.write(
    `[signal-loop] outcome feedback memory refreshed with ${outcomeFeedbackMemory.repeatedLabels.length} repeated label pattern(s)\n`
  );
  const runtimeMemory = await syncRuntimeMemory("signal-loop");
  const editorialMemory = JSON.parse(
    await readFile(runtimeMemory.editorialMemoryPath, "utf8")
  ) as { preFilingChecks?: unknown[] };
  process.stdout.write(`[signal-loop] objective memory refreshed at ${runtimeMemory.objectiveMemoryPath}\n`);
  process.stdout.write(
    `[signal-loop] editorial memory refreshed with ${(editorialMemory.preFilingChecks ?? []).length} pre-filing check(s)\n`
  );
  process.stdout.write(`[signal-loop] competition memory refreshed at ${runtimeMemory.competitionMemoryPath}\n`);
  process.stdout.write(`[signal-loop] brief examples refreshed at ${runtimeMemory.briefExamplesMemoryPath}\n`);

  const manualBrief = await ingestManualDailyBrief(config.reportDate);
  if (manualBrief) {
    process.stdout.write(`[signal-loop] ingested manual brief from ${manualBrief.briefInputPath}\n`);
    process.stdout.write(`[signal-loop] brief winner snapshot saved to ${manualBrief.briefSnapshotPath}\n`);
  } else {
    try {
      const briefWinnersPath = await trackBriefWinners(config.reportDate);
      process.stdout.write(`[signal-loop] brief winner snapshot saved to ${briefWinnersPath}\n`);
    } catch (error) {
      process.stderr.write(`[signal-loop] brief winner tracking failed: ${(error as Error).message}\n`);
    }
  }

  await runFetchAndRun(config.generatedAt, config.reportDate);

  const { filingQueue, replenishmentPassesRun } = await replenishCandidateSlate(config.reportDate, config.generatedAt, "signal-loop");

  const strongCandidates = countStrongCandidates(filingQueue);

  if (strongCandidates === 0) {
    process.stdout.write(
      `[signal-loop] SLATE EMPTY — 0 strong candidates after ${replenishmentPassesRun} replenishment pass(es). ` +
      `Auto-source pipeline has consumed all available events. ` +
      `To fill the slate: write candidate JSON files to data/manual-submissions/${config.reportDate}/ and re-run signal-loop. ` +
      `Do NOT generate signals in chat — write the JSON files and execute the script.\n`
    );
  }

  const filingQueuePath = await saveFilingQueue(filingQueue);
  process.stdout.write(`[signal-loop] filing queue saved to ${filingQueuePath}\n`);

  const trustedSignalSlatePath = await writeTrustedSignalSlate(config.reportDate);
  process.stdout.write(`[signal-loop] trusted signal slate saved to ${trustedSignalSlatePath}\n`);

  process.stdout.write(
    `[signal-loop] done — ${strongCandidates} candidate(s) are currently awaiting_human_approval for ${config.reportDate}\n`
  );
}

async function main(): Promise<void> {
  await runSignalLoop();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
