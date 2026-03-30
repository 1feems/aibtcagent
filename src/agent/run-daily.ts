import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runDailyLearn } from "../loop/index.js";
import { runFetchAndRun } from "../loop/fetch-and-run.js";
import { rankDryRunCandidates, saveRankedCandidateQueue } from "../scoring/index.js";
import { autoLabelResolvedOutcomes } from "../learning/index.js";
import { ingestManualDailyBrief, trackBriefWinners } from "../brief/index.js";
import { buildFilingQueue, saveFilingQueue } from "../filing/index.js";
import { generateDailyOperatorSummary, saveDailyOperatorSummary } from "../ops/index.js";
import { generateDailyStabilityReport, saveDailyStabilityReport } from "../ops/index.js";
import { appendRuntimeHistory } from "../ops/index.js";
import { generateDailyCompetitorReview, saveDailyCompetitorReview } from "../ops/index.js";
import { generateDailyFailureMemos, saveDailyFailureMemos } from "../ops/index.js";
import { generateHeartbeatReminder, saveHeartbeatReminder } from "../ops/index.js";
import type { FilingQueueSnapshot } from "../filing/index.js";
import type { DailyOperatorSummary } from "../types/index.js";

interface AgentDailyConfig {
  reportDate: string;
  generatedAt: string;
}

function countStrongCandidates(queue: FilingQueueSnapshot): number {
  return queue.items.filter((item) => item.queueStatus === "awaiting_human_approval").length;
}

function summarizeManualActions(
  reportDate: string,
  operatorSummary: DailyOperatorSummary,
  heartbeatReminderNeeded: boolean
): string[] {
  const actions: string[] = [];

  if (!operatorSummary.briefIngestStatus.ingested) {
    actions.push(
      `Place the manual brief at ${operatorSummary.briefIngestStatus.inputPath} and re-run agent-daily to capture editorial why-notes.`
    );
  }

  const nextReadyCandidate = operatorSummary.candidateReview.find(
    (candidate) => !candidate.alreadyFiled && candidate.briefReadiness === "ready"
  );
  if (nextReadyCandidate) {
    actions.push(
      `Approve ${nextReadyCandidate.candidateId} with npm run approve-filing -- --date ${reportDate} --candidate ${nextReadyCandidate.candidateId} --decision approve --reviewed-by <name> --approval-note "<why this should win>" only after data/state/operator-signability.json is green for wallet readiness, payload integrity, and beat permission.`
    );
    actions.push(
      `Open the Xverse filing helper and sign the artifact from data/filing-ready/${reportDate}/${nextReadyCandidate.candidateId}.json.`
    );
  } else {
    const headlineRewriteCandidate = operatorSummary.candidateReview.find(
      (candidate) => candidate.suggestedHeadline !== null && !candidate.alreadyFiled
    );
    if (headlineRewriteCandidate) {
      actions.push(
        `Review the suggested headline for ${headlineRewriteCandidate.candidateId}, then approve and sign it only if it still looks strongest and operator signability preflight is green.`
      );
    }
  }

  if (heartbeatReminderNeeded) {
    actions.push("Complete the manual heartbeat in tools/xverse-register/heartbeat.html.");
  }

  actions.push("Wallet signatures and reward claims remain manual. Let the agent prepare artifacts first, then sign only at the end.");
  return actions;
}

export function shouldRunSecondSourcingPass(queue: FilingQueueSnapshot): boolean {
  return countStrongCandidates(queue) < 5;
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
  process.stdout.write(
    "[agent-daily] startup preflight: confirm you are in aibtcagent and start from README.md/AIBTC-AGENTS.md, not cross-repo chat memory\n"
  );
  process.stdout.write(
    "[agent-daily] goal: maximize In Brief wins and sats; approvals alone do not count\n"
  );

  await runDailyLearn([
    "--date",
    config.reportDate,
    "--generated-at",
    config.generatedAt
  ]);

  const autoLabel = await autoLabelResolvedOutcomes();
  process.stdout.write(`[agent-daily] auto-labeled ${autoLabel.labeledCount} resolved outcome(s)\n`);

  const manualBrief = await ingestManualDailyBrief(config.reportDate);
  if (manualBrief) {
    process.stdout.write(`[agent-daily] ingested manual brief from ${manualBrief.briefInputPath}\n`);
    process.stdout.write(`[agent-daily] brief winner snapshot saved to ${manualBrief.briefSnapshotPath}\n`);
    process.stdout.write(`[agent-daily] brief analysis saved to ${manualBrief.analysisPath}\n`);
    process.stdout.write(`[agent-daily] top competitor styles saved to ${manualBrief.competitorStylesPath}\n`);
  } else {
    try {
      const briefWinnersPath = await trackBriefWinners(config.reportDate);
      process.stdout.write(`[agent-daily] brief winner snapshot saved to ${briefWinnersPath}\n`);
    } catch (error) {
      process.stderr.write(`[agent-daily] brief winner tracking failed: ${(error as Error).message}\n`);
    }
  }

  process.stdout.write(
    "[agent-daily] operator boundary: wallet signing, heartbeat signing, and claim signing remain manual via Xverse helper flows\n"
  );

  await runFetchAndRun(config.generatedAt, config.reportDate);

  let rankedCandidates = await rankDryRunCandidates(config.reportDate);
  let queuePath = await saveRankedCandidateQueue(config.reportDate, rankedCandidates);
  process.stdout.write(`[agent-daily] ranked queue saved to ${queuePath}\n`);

  let filingQueue = await buildFilingQueue(config.reportDate, rankedCandidates);
  const initialStrongCandidates = countStrongCandidates(filingQueue);
  let secondSourcingPassTriggered = false;

  if (shouldRunSecondSourcingPass(filingQueue)) {
    secondSourcingPassTriggered = true;
    process.stdout.write(
      `[agent-daily] only ${initialStrongCandidates} strong signable candidate(s) survived hard gates; running mandatory second sourcing pass\n`
    );
    const secondPassTime = new Date(new Date(config.generatedAt).getTime() + 60_000).toISOString();
    await runFetchAndRun(secondPassTime, config.reportDate);
    rankedCandidates = await rankDryRunCandidates(config.reportDate);
    queuePath = await saveRankedCandidateQueue(config.reportDate, rankedCandidates);
    process.stdout.write(`[agent-daily] ranked queue refreshed after second sourcing pass: ${queuePath}\n`);
    filingQueue = await buildFilingQueue(config.reportDate, rankedCandidates);
  }

  const finalStrongCandidates = countStrongCandidates(filingQueue);
  const filingQueuePath = await saveFilingQueue(filingQueue);
  process.stdout.write(`[agent-daily] filing queue saved to ${filingQueuePath}\n`);

  const operatorSummary = await generateDailyOperatorSummary(
    config.reportDate,
    config.generatedAt
  );
  const operatorSummaryPaths = await saveDailyOperatorSummary(operatorSummary);
  process.stdout.write(
    `[agent-daily] operator summary saved to ${operatorSummaryPaths.jsonPath}\n`
  );

  const stabilityReport = await generateDailyStabilityReport(config.reportDate);
  const stabilityPaths = await saveDailyStabilityReport(stabilityReport);
  process.stdout.write(
    `[agent-daily] stability report saved to ${stabilityPaths.jsonPath}\n`
  );

  const { review: competitorReview, profiles: competitorProfiles } = await generateDailyCompetitorReview(
    config.reportDate,
    config.generatedAt
  );
  const competitorReviewPaths = await saveDailyCompetitorReview(competitorReview, competitorProfiles);
  process.stdout.write(
    `[agent-daily] competitor review saved to ${competitorReviewPaths.jsonPath}\n`
  );

  const failureMemos = await generateDailyFailureMemos(
    config.reportDate,
    config.generatedAt
  );
  const failureMemoPaths = await saveDailyFailureMemos(failureMemos);
  process.stdout.write(
    `[agent-daily] failure memos saved: ${failureMemoPaths.length}\n`
  );

  const runtimeHistoryPath = await appendRuntimeHistory({
    reportDate: config.reportDate,
    generatedAt: config.generatedAt,
    runtime: {
      walletActionsRequireHumanSignature: true,
      secondSourcingPassTriggered,
      initialStrongCandidates,
      finalStrongCandidates
    },
    reports: {
      queuePath,
      filingQueuePath,
      operatorSummaryPath: operatorSummaryPaths.jsonPath,
      stabilityReportPath: stabilityPaths.jsonPath,
      competitorReviewPath: competitorReviewPaths.jsonPath,
      failureMemoCount: failureMemoPaths.length
    }
  });
  process.stdout.write(`[agent-daily] runtime history saved to ${runtimeHistoryPath}\n`);

  const btcAddress = process.env.AIBTC_BITCOIN_ADDRESS ?? "";
  let heartbeatReminderNeeded = false;
  if (btcAddress) {
    try {
      const { report: heartbeatReport, state: heartbeatState } = await generateHeartbeatReminder(
        btcAddress,
        config.generatedAt
      );
      await saveHeartbeatReminder(heartbeatReport, heartbeatState);
      heartbeatReminderNeeded = heartbeatReport.reminderNeeded;
      if (heartbeatReport.reminderNeeded) {
        process.stdout.write(
          `[agent-daily] HEARTBEAT REMINDER: check-in count has not increased since last run (${heartbeatReport.previousCheckInCount ?? "unknown"} → ${heartbeatReport.checkInCount ?? "unknown"}). Open tools/xverse-register/heartbeat.html to submit a manual heartbeat.\n`
        );
      } else {
        process.stdout.write(
          `[agent-daily] heartbeat check-in count: ${heartbeatReport.checkInCount ?? "unknown"}\n`
        );
      }
    } catch (error) {
      process.stderr.write(`[agent-daily] heartbeat check skipped: ${(error as Error).message}\n`);
    }
  } else {
    process.stdout.write(
      "[agent-daily] AIBTC_BITCOIN_ADDRESS not set — skipping heartbeat check. Set it to track check-in status automatically.\n"
    );
  }

  if (operatorSummary.topCandidate.candidateId !== null) {
    const top = operatorSummary.topCandidate;
    process.stdout.write(
      `[agent-daily] top candidate: ${top.decision.toUpperCase()} ${top.candidateId} (${top.score})\n`
    );
  } else if (rankedCandidates.length > 0) {
    const top = rankedCandidates[0];
    process.stdout.write(
      `[agent-daily] top ranked candidate is not signable: ${top.decision.toUpperCase()} ${top.candidateId} (${top.score})\n`
    );
  } else {
    process.stdout.write("[agent-daily] no ranked candidates for today\n");
  }

  const manualActions = summarizeManualActions(
    config.reportDate,
    operatorSummary,
    heartbeatReminderNeeded
  );
  process.stdout.write("[agent-daily] remaining manual actions:\n");
  for (const action of manualActions) {
    process.stdout.write(`[agent-daily] - ${action}\n`);
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
