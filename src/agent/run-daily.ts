import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runDailyLearn } from "../loop/index.js";
import { runFetchAndRun } from "../loop/fetch-and-run.js";
import { runDailyPrep } from "../prep/daily-prep.js";
import { runSignalJob } from "../prep/signal-job.js";
import { rankDryRunCandidates, saveRankedCandidateQueue } from "../scoring/index.js";
import {
  autoLabelResolvedOutcomes,
  refreshOutcomeFeedbackMemory,
  refreshSnapshotMemory,
  syncRuntimeMemory
} from "../learning/index.js";
import { ingestManualDailyBrief, trackBriefWinners } from "../brief/index.js";
import { buildFilingQueue, saveFilingQueue, writeTrustedSignalSlate } from "../filing/index.js";
import { fetchAndCacheQuantumMapSnapshot } from "../filing/index.js";
import { generateDailyOperatorSummary, saveDailyOperatorSummary } from "../ops/index.js";
import { generateDailyStabilityReport, saveDailyStabilityReport } from "../ops/index.js";
import { appendRuntimeHistory } from "../ops/index.js";
import { generateDailyCompetitorReview, saveDailyCompetitorReview } from "../ops/index.js";
import { generateDailyFailureMemos, saveDailyFailureMemos } from "../ops/index.js";
import { generateHeartbeatReminder, saveHeartbeatReminder } from "../ops/index.js";
import { generateAndSaveQuantumWeeklySynthesis } from "../reporting/index.js";
import { generateActivityDashboard, saveActivityDashboard } from "../reporting/index.js";
import { runCorrectionHunter } from "../corrections/correction-hunter.js";
import { getPacificReportDate } from "../utils/report-date.js";
import type { FilingQueueSnapshot } from "../filing/index.js";
import type { DailyOperatorSummary } from "../types/index.js";

interface AgentDailyConfig {
  reportDate: string;
  generatedAt: string;
}

const TARGET_STRONG_CANDIDATES = 6;
const MAX_REPLENISHMENT_PASSES = 4;

function countStrongCandidates(queue: FilingQueueSnapshot): number {
  return queue.items.filter((item) => item.queueStatus === "awaiting_human_approval").length;
}

async function replenishCandidateSlate(
  reportDate: string,
  generatedAt: string
): Promise<{
  rankedCandidates: Awaited<ReturnType<typeof rankDryRunCandidates>>;
  queuePath: string;
  filingQueue: FilingQueueSnapshot;
  replenishmentPassesRun: number;
}> {
  let rankedCandidates = await rankDryRunCandidates(reportDate);
  let queuePath = await saveRankedCandidateQueue(reportDate, rankedCandidates);
  process.stdout.write(`[agent-daily] ranked queue saved to ${queuePath}\n`);

  let filingQueue = await buildFilingQueue(reportDate, rankedCandidates);
  let strongCandidates = countStrongCandidates(filingQueue);
  let replenishmentPassesRun = 0;

  while (
    strongCandidates < TARGET_STRONG_CANDIDATES &&
    replenishmentPassesRun < MAX_REPLENISHMENT_PASSES
  ) {
    replenishmentPassesRun += 1;
    process.stdout.write(
      `[agent-daily] only ${strongCandidates}/${TARGET_STRONG_CANDIDATES} strong candidate(s) survived hard gates; running replenishment pass ${replenishmentPassesRun}/${MAX_REPLENISHMENT_PASSES}\n`
    );

    const passTime = new Date(
      new Date(generatedAt).getTime() + replenishmentPassesRun * 60_000
    ).toISOString();
    const fetchResult = await runFetchAndRun(passTime, reportDate);

    rankedCandidates = await rankDryRunCandidates(reportDate);
    queuePath = await saveRankedCandidateQueue(reportDate, rankedCandidates);
    process.stdout.write(
      `[agent-daily] ranked queue refreshed after replenishment pass ${replenishmentPassesRun}: ${queuePath}\n`
    );
    filingQueue = await buildFilingQueue(reportDate, rankedCandidates);

    const updatedStrongCandidates = countStrongCandidates(filingQueue);
    process.stdout.write(
      `[agent-daily] replenishment pass ${replenishmentPassesRun} result — ${updatedStrongCandidates}/${TARGET_STRONG_CANDIDATES} strong candidate(s)\n`
    );

    if (updatedStrongCandidates >= TARGET_STRONG_CANDIDATES) {
      strongCandidates = updatedStrongCandidates;
      break;
    }

    if (fetchResult.results.length === 0 || updatedStrongCandidates <= strongCandidates) {
      const exhaustionReason =
        fetchResult.results.length === 0
          ? "no fresh candidate events were found"
          : "fresh candidates were tested but none improved the strong-candidate count";
      process.stdout.write(
        `[agent-daily] replenishment exhausted after pass ${replenishmentPassesRun} — ${exhaustionReason}\n`
      );
      strongCandidates = updatedStrongCandidates;
      break;
    }

    strongCandidates = updatedStrongCandidates;
  }

  return { rankedCandidates, queuePath, filingQueue, replenishmentPassesRun };
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
    reportDate: parsed.get("date") ?? getPacificReportDate(now),
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

  try {
    const quantumSnapshot = await fetchAndCacheQuantumMapSnapshot({
      fetchedAt: config.generatedAt
    });
    process.stdout.write(
      `[agent-daily] quantum map snapshot refreshed (${quantumSnapshot.summary.source}) — metadata composite ${quantumSnapshot.summary.metadataCompositeScore ?? "n/a"}, derived composite ${quantumSnapshot.summary.derivedCompositeScore}\n`
    );
  } catch (error) {
    process.stderr.write(`[agent-daily] quantum map snapshot refresh failed: ${(error as Error).message}\n`);
  }

  await runDailyLearn([
    "--date",
    config.reportDate,
    "--generated-at",
    config.generatedAt
  ]);

  const autoLabel = await autoLabelResolvedOutcomes();
  process.stdout.write(`[agent-daily] auto-labeled ${autoLabel.labeledCount} resolved outcome(s)\n`);
  const snapshotMemory = await refreshSnapshotMemory();
  process.stdout.write(
    `[agent-daily] snapshot memory refreshed from ${snapshotMemory.sourceFiles.length} raw snapshot file(s) with ${snapshotMemory.lessonCount} derived lesson(s)\n`
  );
  const outcomeFeedbackMemory = await refreshOutcomeFeedbackMemory();
  process.stdout.write(
    `[agent-daily] outcome feedback memory refreshed with ${outcomeFeedbackMemory.repeatedLabels.length} repeated label pattern(s)\n`
  );
  const runtimeMemory = await syncRuntimeMemory("agent-daily");
  const editorialMemory = JSON.parse(
    await readFile(runtimeMemory.editorialMemoryPath, "utf8")
  ) as { preFilingChecks?: unknown[] };
  process.stdout.write(`[agent-daily] objective memory refreshed at ${runtimeMemory.objectiveMemoryPath}\n`);
  process.stdout.write(
    `[agent-daily] editorial memory refreshed with ${(editorialMemory.preFilingChecks ?? []).length} pre-filing check(s)\n`
  );
  process.stdout.write(`[agent-daily] competition memory refreshed at ${runtimeMemory.competitionMemoryPath}\n`);
  process.stdout.write(`[agent-daily] brief examples refreshed at ${runtimeMemory.briefExamplesMemoryPath}\n`);

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

  const dailyPrepResult = await runDailyPrep(config.reportDate, config.generatedAt);
  if (dailyPrepResult.skipped) {
    process.stdout.write(`[agent-daily] daily prep skipped: ${dailyPrepResult.skipReason}\n`);
  } else {
    process.stdout.write(`[agent-daily] daily prep report saved to ${dailyPrepResult.reportPath}\n`);
    if (!dailyPrepResult.briefFound) {
      process.stdout.write(
        `[agent-daily] daily prep ran without brief artifact — place data/briefs/${config.reportDate}.md before next run for full analysis\n`
      );
    }
  }

  await runFetchAndRun(config.generatedAt, config.reportDate);

  const signalJobResult = await runSignalJob(config.reportDate, config.generatedAt);
  if (signalJobResult.skipped) {
    process.stdout.write(`[agent-daily] signal job skipped: ${signalJobResult.skipReason}\n`);
    if (signalJobResult.outputPath) {
      process.stdout.write(
        `[agent-daily] signal job wrote an explicit blocked report to ${signalJobResult.outputPath}\n`
      );
    }
  } else {
    process.stdout.write(`[agent-daily] signal report saved to ${signalJobResult.outputPath}\n`);
  }

  const {
    rankedCandidates,
    queuePath,
    filingQueue,
    replenishmentPassesRun
  } = await replenishCandidateSlate(config.reportDate, config.generatedAt);
  const initialStrongCandidates = 0;
  const secondSourcingPassTriggered = replenishmentPassesRun > 0;

  const finalStrongCandidates = countStrongCandidates(filingQueue);

  if (finalStrongCandidates === 0) {
    process.stdout.write(
      `[agent-daily] SLATE EMPTY — 0 strong candidates after ${replenishmentPassesRun} replenishment pass(es). ` +
      `Auto-source pipeline has consumed all available events. ` +
      `To fill the slate: write candidate JSON files to data/manual-submissions/${config.reportDate}/ and re-run agent-daily. ` +
      `Do NOT generate signals in chat — write the JSON files and execute the script.\n`
    );
  }

  const filingQueuePath = await saveFilingQueue(filingQueue);
  process.stdout.write(`[agent-daily] filing queue saved to ${filingQueuePath}\n`);
  const trustedSignalSlatePath = await writeTrustedSignalSlate(config.reportDate);
  process.stdout.write(`[agent-daily] trusted signal slate saved to ${trustedSignalSlatePath}\n`);

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

  const activityDashboard = await generateActivityDashboard();
  const activityDashboardPaths = await saveActivityDashboard(activityDashboard);
  process.stdout.write(
    `[agent-daily] activity dashboard saved to ${activityDashboardPaths.repoPath}\n`
  );

  try {
    const quantumWeekly = await generateAndSaveQuantumWeeklySynthesis(config.reportDate);
    process.stdout.write(
      `[agent-daily] quantum weekly synthesis draft saved to ${quantumWeekly.paths.markdownPath}\n`
    );
  } catch (error) {
    process.stderr.write(`[agent-daily] quantum weekly synthesis skipped: ${(error as Error).message}\n`);
  }

  // Correction-hunting loop — deterministic, zero-LLM, capped at 3/day
  try {
    const correctionResult = await runCorrectionHunter(config.reportDate);
    process.stdout.write(
      `[agent-daily] correction hunt: ${correctionResult.candidates.length} flaw(s) found, ${correctionResult.scanned} signal(s) scanned (quota ${correctionResult.quota.filedCount}/${3})\n`
    );
  } catch (error) {
    process.stderr.write(`[agent-daily] correction hunt skipped: ${(error as Error).message}\n`);
  }

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
      if (heartbeatReport.status === "skipped") {
        process.stdout.write(
          `[agent-daily] heartbeat check skipped: ${heartbeatReport.note}\n`
        );
      } else if (heartbeatReport.reminderNeeded) {
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
