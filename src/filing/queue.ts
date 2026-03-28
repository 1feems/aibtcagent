import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { RankedCandidate } from "../scoring/index.js";

export interface FilingQueueItem {
  candidateId: string;
  headline: string;
  beat: string;
  score: number;
  sourcePath: string;
  queueStatus: "awaiting_human_approval" | "approved_for_filing" | "on_hold" | "rejected";
  reasons: string[];
}

export interface FilingQueueSnapshot {
  kind: "filing_queue";
  reportDate: string;
  generatedAt: string;
  topCandidateId: string | null;
  items: FilingQueueItem[];
}

export async function buildFilingQueue(
  reportDate: string,
  rankedCandidates: RankedCandidate[],
  baseDir?: string
): Promise<FilingQueueSnapshot> {
  let topCandidateAssigned = false;

  const items: FilingQueueItem[] = rankedCandidates.map((candidate) => {
    if (!topCandidateAssigned && candidate.decision === "file") {
      topCandidateAssigned = true;
      return {
        candidateId: candidate.candidateId,
        headline: candidate.headline,
        beat: candidate.beat,
        score: candidate.score,
        sourcePath: candidate.sourcePath,
        queueStatus: "awaiting_human_approval",
        reasons: candidate.reasons
      };
    }

    return {
      candidateId: candidate.candidateId,
      headline: candidate.headline,
      beat: candidate.beat,
      score: candidate.score,
      sourcePath: candidate.sourcePath,
      queueStatus: candidate.decision === "hold" ? "on_hold" : "rejected",
      reasons: candidate.reasons
    };
  });

  return {
    kind: "filing_queue",
    reportDate,
    generatedAt: new Date().toISOString(),
    topCandidateId: items.find((item) => item.queueStatus === "awaiting_human_approval")?.candidateId ?? null,
    items
  };
}

export async function saveFilingQueue(
  queue: FilingQueueSnapshot,
  baseDir?: string
): Promise<string> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/filing-queue/${queue.reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(queue, null, 2), "utf8");
  return filePath;
}

export async function readFilingQueue(
  reportDate: string,
  baseDir?: string
): Promise<FilingQueueSnapshot> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/filing-queue/${reportDate}.json`);
  return JSON.parse(await readFile(filePath, "utf8")) as FilingQueueSnapshot;
}
