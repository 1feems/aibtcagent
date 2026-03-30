import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { FailureMemo } from "../types/index.js";

interface CandidateHistoryRecord {
  candidateId: string;
  reportDate: string;
  headline: string | null;
  beat: string | null;
  candidateMetadata?: {
    duplicateStatus?: "clear" | "pending" | "flagged" | null;
    freshnessStatus?: "clear" | "risk_unresolved" | "unknown" | null;
  };
  outcome?: {
    success?: boolean | null;
    publishedInBrief?: boolean | null;
    note?: string | null;
    learningWhy?: string | null;
  };
}

interface RankedQueueSnapshot {
  candidates?: Array<{
    candidateId: string;
    reasons?: string[];
  }>;
}

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function buildCategories(
  history: CandidateHistoryRecord,
  queueReasons: string[]
): FailureMemo["categories"] {
  const categories = new Set<FailureMemo["categories"][number]>();
  const evidenceBlob = [
    ...(queueReasons ?? []),
    history.outcome?.note ?? "",
    history.outcome?.learningWhy ?? ""
  ].join(" ");

  if (history.candidateMetadata?.duplicateStatus === "pending" || history.candidateMetadata?.duplicateStatus === "flagged" || /duplicate/i.test(evidenceBlob)) {
    categories.add("duplicate");
  }

  if (history.candidateMetadata?.freshnessStatus === "risk_unresolved" || /\bstale\b|\bfreshness\b|\btiming\b/i.test(evidenceBlob)) {
    categories.add("stale");
  }

  if (/\btoo narrow\b|\bnarrow\b|\bbroader same-beat\b|\bbroader same day\b|\bcomponent update\b/i.test(evidenceBlob)) {
    categories.add("too_narrow");
  }

  if (/\bwrong beat\b|\bbeat mismatch\b|\bwrong lane\b/i.test(evidenceBlob)) {
    categories.add("wrong_beat");
  }

  if (/\bheadline\b|\braw release note\b|\btitle\b/i.test(evidenceBlob)) {
    categories.add("weak_headline");
  }

  if (/\bpackaging\b|\bpackage\b|\barticle-shaped\b|\bfragment\b/i.test(evidenceBlob)) {
    categories.add("weak_packaging");
  }

  if (history.outcome?.publishedInBrief === false || /approved but not published/i.test(evidenceBlob)) {
    categories.add("approved_but_not_published");
  }

  return [...categories];
}

function buildSummary(categories: FailureMemo["categories"]): string {
  if (categories.length === 0) {
    return "Miss recorded, but no normalized failure category was strong enough to assign from the available evidence.";
  }

  return `Miss categories: ${categories.join(", ")}.`;
}

function renderMarkdown(memo: FailureMemo): string {
  return [
    `# Failure Memo: ${memo.candidateId}`,
    "",
    `Report date: ${memo.reportDate}`,
    `Generated at: ${memo.generatedAt}`,
    `Headline: ${memo.headline ?? "n/a"}`,
    `Beat: ${memo.beat ?? "n/a"}`,
    `Categories: ${memo.categories.join(", ") || "none"}`,
    "",
    "## Summary",
    memo.summary,
    "",
    "## Evidence",
    ...(memo.evidence.length === 0 ? ["- No evidence captured."] : memo.evidence.map((line) => `- ${line}`)),
    ""
  ].join("\n");
}

export async function generateDailyFailureMemos(
  reportDate: string,
  generatedAt: string,
  baseDir?: string
): Promise<FailureMemo[]> {
  const root = resolve(baseDir ?? process.cwd());
  const historyDir = resolve(root, "data/candidate-history");
  const queue = await readJsonOrNull<RankedQueueSnapshot>(resolve(root, `data/queues/${reportDate}.json`));
  const queueReasonsById = new Map(
    (queue?.candidates ?? []).map((candidate) => [candidate.candidateId, candidate.reasons ?? []])
  );

  let fileNames: string[] = [];
  try {
    fileNames = (await readdir(historyDir)).filter((fileName) => fileName.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const histories = await Promise.all(
    fileNames.map(async (fileName) =>
      readJsonOrNull<CandidateHistoryRecord>(resolve(historyDir, fileName))
    )
  );

  return histories
    .filter((history): history is CandidateHistoryRecord => Boolean(history))
    .filter((history) => history.reportDate === reportDate)
    .filter((history) => history.outcome?.success !== true)
    .map((history) => {
      const queueReasons = queueReasonsById.get(history.candidateId) ?? [];
      const evidence = [
        ...queueReasons,
        history.outcome?.note ?? "",
        history.outcome?.learningWhy ?? ""
      ].filter((line) => line.length > 0);
      const categories = buildCategories(history, queueReasons);

      return {
        kind: "failure_memo",
        reportDate,
        generatedAt,
        candidateId: history.candidateId,
        headline: history.headline ?? null,
        beat: history.beat ?? null,
        categories,
        summary: buildSummary(categories),
        evidence
      } satisfies FailureMemo;
    });
}

export async function saveDailyFailureMemos(
  memos: FailureMemo[],
  baseDir?: string
): Promise<string[]> {
  const root = resolve(baseDir ?? process.cwd());
  const savedPaths: string[] = [];

  for (const memo of memos) {
    const jsonPath = resolve(root, `data/reports/failure-memos/${memo.reportDate}/${memo.candidateId}.json`);
    const markdownPath = resolve(root, `data/reports/failure-memos/${memo.reportDate}/${memo.candidateId}.md`);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, JSON.stringify(memo, null, 2), "utf8");
    await writeFile(markdownPath, renderMarkdown(memo), "utf8");
    savedPaths.push(jsonPath);
  }

  return savedPaths;
}
