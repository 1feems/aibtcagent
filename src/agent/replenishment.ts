import { runFetchAndRun } from "../loop/fetch-and-run.js";
import { rankDryRunCandidates, saveRankedCandidateQueue, type RankedCandidate } from "../scoring/index.js";
import { buildFilingQueue } from "../filing/index.js";
import type { FilingQueueSnapshot } from "../filing/index.js";

export const TARGET_STRONG_CANDIDATES = 6;
export const MAX_REPLENISHMENT_PASSES = 4;

export function countStrongCandidates(queue: FilingQueueSnapshot): number {
  return queue.items.filter((item) => item.queueStatus === "awaiting_human_approval").length;
}

export async function replenishCandidateSlate(
  reportDate: string,
  generatedAt: string,
  logPrefix: string
): Promise<{
  rankedCandidates: RankedCandidate[];
  queuePath: string;
  filingQueue: FilingQueueSnapshot;
  replenishmentPassesRun: number;
}> {
  let rankedCandidates = await rankDryRunCandidates(reportDate);
  let queuePath = await saveRankedCandidateQueue(reportDate, rankedCandidates);
  process.stdout.write(`[${logPrefix}] ranked queue saved to ${queuePath}\n`);

  let filingQueue = await buildFilingQueue(reportDate, rankedCandidates);
  let strongCandidates = countStrongCandidates(filingQueue);
  let replenishmentPassesRun = 0;

  while (
    strongCandidates < TARGET_STRONG_CANDIDATES &&
    replenishmentPassesRun < MAX_REPLENISHMENT_PASSES
  ) {
    replenishmentPassesRun += 1;
    process.stdout.write(
      `[${logPrefix}] only ${strongCandidates}/${TARGET_STRONG_CANDIDATES} strong candidate(s) survived hard gates; running replenishment pass ${replenishmentPassesRun}/${MAX_REPLENISHMENT_PASSES}\n`
    );

    const passTime = new Date(
      new Date(generatedAt).getTime() + replenishmentPassesRun * 60_000
    ).toISOString();
    const fetchResult = await runFetchAndRun(passTime, reportDate);

    rankedCandidates = await rankDryRunCandidates(reportDate);
    queuePath = await saveRankedCandidateQueue(reportDate, rankedCandidates);
    process.stdout.write(
      `[${logPrefix}] ranked queue refreshed after replenishment pass ${replenishmentPassesRun}: ${queuePath}\n`
    );
    filingQueue = await buildFilingQueue(reportDate, rankedCandidates);

    const updatedStrongCandidates = countStrongCandidates(filingQueue);
    process.stdout.write(
      `[${logPrefix}] replenishment pass ${replenishmentPassesRun} result — ${updatedStrongCandidates}/${TARGET_STRONG_CANDIDATES} strong candidate(s)\n`
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
        `[${logPrefix}] replenishment exhausted after pass ${replenishmentPassesRun} — ${exhaustionReason}\n`
      );
      strongCandidates = updatedStrongCandidates;
      break;
    }

    strongCandidates = updatedStrongCandidates;
  }

  return { rankedCandidates, queuePath, filingQueue, replenishmentPassesRun };
}
