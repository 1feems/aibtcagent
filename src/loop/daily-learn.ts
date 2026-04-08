import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncCandidateNextDayEvidence } from "../filing/index.js";
import { runOutcomeChecker, runRewardSync } from "../outcomes/index.js";
import { generateAndSaveDailyOptimizationSnapshot } from "./optimization.js";
import { generateAndSaveDailyReport } from "../reporting/index.js";
import { buildLivePreSubmission } from "../sources/index.js";
import { loadTrainingMemory, refreshLearningCache } from "../learning/index.js";
import { getPacificReportDate } from "../utils/report-date.js";

interface DailyLearnConfig {
  reportDate: string;
  generatedAt: string;
  refreshPreSubmission: boolean;
}

function parseArgs(argv: string[]): DailyLearnConfig {
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
    generatedAt: parsed.get("generated-at") ?? now,
    refreshPreSubmission: parsed.get("refresh-pre") !== "false"
  };
}

export async function runDailyLearn(argv: string[] = process.argv.slice(2)): Promise<void> {
  const config = parseArgs(argv);

  process.stdout.write(`[daily-learn] starting for ${config.reportDate}\n`);

  await runOutcomeChecker();
  process.stdout.write("[daily-learn] outcome check complete\n");

  const btcAddress = process.env.AIBTC_BITCOIN_ADDRESS ?? "";
  if (btcAddress) {
    try {
      const rewardSync = await runRewardSync(btcAddress, config.generatedAt);
      process.stdout.write(
        `[daily-learn] reward sync complete — total sats received ${rewardSync.satsReceived}, delta ${rewardSync.satsDelta}\n`
      );
      if (rewardSync.leaderboardMovement) {
        process.stdout.write(`[daily-learn] leaderboard movement: ${rewardSync.leaderboardMovement}\n`);
      }
      if (rewardSync.newAchievements.length > 0) {
        process.stdout.write(
          `[daily-learn] new achievements: ${rewardSync.newAchievements.join(", ")}\n`
        );
      }
    } catch (error) {
      process.stderr.write(`[daily-learn] reward sync skipped: ${(error as Error).message}\n`);
    }
  } else {
    process.stdout.write(
      "[daily-learn] AIBTC_BITCOIN_ADDRESS not set — skipping reward sync and leaderboard tracking.\n"
    );
  }

  const trainingMemory = await loadTrainingMemory();
  process.stdout.write(
    `[daily-learn] training memory loaded — ${trainingMemory.winningTags.length} winning tags, ${trainingMemory.rejectionTags.length} rejection tags\n`
  );
  const learningCache = await refreshLearningCache();
  process.stdout.write(
    `[daily-learn] learning cache refreshed — ${learningCache.lessonCount} lessons cached\n`
  );

  if (config.refreshPreSubmission) {
    const preSubmissionPath = await buildLivePreSubmission(config.generatedAt, config.reportDate);
    process.stdout.write(`[daily-learn] pre-submission memory refreshed at ${preSubmissionPath}\n`);
  }

  const { savedTo: optimizationPath } = await generateAndSaveDailyOptimizationSnapshot(
    config.reportDate,
    config.generatedAt
  );
  process.stdout.write(`[daily-learn] optimization snapshot saved to ${optimizationPath}\n`);

  const { savedTo: reportPath, savedJsonTo: reportJsonPath } = await generateAndSaveDailyReport(
    config.reportDate,
    config.generatedAt
  );
  process.stdout.write(`[daily-learn] daily report saved to ${reportPath}\n`);
  process.stdout.write(`[daily-learn] daily report JSON saved to ${reportJsonPath}\n`);

  const updatedEvidenceCount = await syncCandidateNextDayEvidence(config.reportDate);
  process.stdout.write(
    `[daily-learn] live ops evidence synced for ${updatedEvidenceCount} prior-day candidate(s)\n`
  );
}

async function main(): Promise<void> {
  await runDailyLearn();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
