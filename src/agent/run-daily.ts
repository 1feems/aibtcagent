import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runDailyLearn } from "../loop/index.js";
import { runFetchAndRun } from "../loop/fetch-and-run.js";
import { rankDryRunCandidates, saveRankedCandidateQueue } from "../scoring/index.js";
import { autoLabelResolvedOutcomes } from "../learning/index.js";
import { trackBriefWinners } from "../brief/index.js";
import { buildFilingQueue, saveFilingQueue } from "../filing/index.js";

interface AgentDailyConfig {
  reportDate: string;
  generatedAt: string;
}

function parseArgs(argv: string[]): AgentDailyConfig {
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
    reportDate: parsed.get("date") ?? now.slice(0, 10),
    generatedAt: parsed.get("generated-at") ?? now
  };
}

export async function runAgentDaily(argv: string[] = process.argv.slice(2)): Promise<void> {
  const config = parseArgs(argv);
  process.stdout.write(`[agent-daily] starting for ${config.reportDate}\n`);

  await runDailyLearn([
    "--date",
    config.reportDate,
    "--generated-at",
    config.generatedAt
  ]);

  const autoLabel = await autoLabelResolvedOutcomes();
  process.stdout.write(`[agent-daily] auto-labeled ${autoLabel.labeledCount} resolved outcome(s)\n`);

  try {
    const briefWinnersPath = await trackBriefWinners(config.reportDate);
    process.stdout.write(`[agent-daily] brief winner snapshot saved to ${briefWinnersPath}\n`);
  } catch (error) {
    process.stderr.write(`[agent-daily] brief winner tracking failed: ${(error as Error).message}\n`);
  }

  await runFetchAndRun(config.generatedAt);

  const rankedCandidates = await rankDryRunCandidates(config.reportDate);
  const queuePath = await saveRankedCandidateQueue(config.reportDate, rankedCandidates);
  process.stdout.write(`[agent-daily] ranked queue saved to ${queuePath}\n`);

  const filingQueue = await buildFilingQueue(config.reportDate, rankedCandidates);
  const filingQueuePath = await saveFilingQueue(filingQueue);
  process.stdout.write(`[agent-daily] filing queue saved to ${filingQueuePath}\n`);

  if (rankedCandidates.length > 0) {
    const top = rankedCandidates[0];
    process.stdout.write(
      `[agent-daily] top candidate: ${top.decision.toUpperCase()} ${top.candidateId} (${top.score})\n`
    );
  } else {
    process.stdout.write("[agent-daily] no ranked candidates for today\n");
  }
}

async function main(): Promise<void> {
  await runAgentDaily();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
