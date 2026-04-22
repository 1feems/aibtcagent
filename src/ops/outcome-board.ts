import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { SignalLearningBrief } from "../learning/signal-learning-brief.js";
import { readSignalHistory } from "../filing/signal-history.js";

export interface OutcomeBoardDuplicateCluster {
  anchor: string;
  count: number;
  source: string;
}

export interface DailyOutcomeBoard {
  kind: "daily_outcome_board";
  reportDate: string;
  generatedAt: string;
  openBeats: string[];
  crowdedBeats: string[];
  duplicateClusters: OutcomeBoardDuplicateCluster[];
  recentRejectionReasons: string[];
  latestBriefWinnerShape: string;
  helperFailures: string[];
  sourcePaths: string[];
}

const OPERATING_BEATS = ["quantum", "aibtc-network", "bitcoin-macro"] as const;

function boardPath(reportDate: string, baseDir = process.cwd()): string {
  return resolve(baseDir, "data/state/outcome-boards", `${reportDate}.json`);
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function unique(values: string[], limit = 8): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

function normalizeBeat(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return OPERATING_BEATS.includes(normalized as typeof OPERATING_BEATS[number]) ? normalized : null;
}

function extractBriefBeats(text: string): string[] {
  const lower = text.toLowerCase();
  return OPERATING_BEATS.filter((beat) => lower.includes(beat));
}

function extractLatestHelperFailures(helperErrorsText: string, learningBrief: SignalLearningBrief | null): string[] {
  const parsedMessages = helperErrorsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-20)
    .map((line) => {
      try {
        return (JSON.parse(line) as { message?: string }).message?.trim() ?? "";
      } catch {
        return "";
      }
    });

  return unique([...(learningBrief?.helperErrorReview.messages ?? []), ...parsedMessages].reverse(), 6);
}

function buildDuplicateClusters(
  history: Awaited<ReturnType<typeof readSignalHistory>>,
  reportDate: string,
  learningBrief: SignalLearningBrief | null
): OutcomeBoardDuplicateCluster[] {
  const clusterCounts = new Map<string, number>();
  for (const entry of history.entries) {
    const anchor = entry.storyShape || entry.headline || "";
    if (!anchor) continue;
    if (entry.reportDate === reportDate || entry.outcome === "rejected" || entry.outcome === "approved") {
      clusterCounts.set(anchor, (clusterCounts.get(anchor) ?? 0) + 1);
    }
  }

  for (const headline of learningBrief?.rejectionReview.headlines ?? []) {
    const anchor = headline.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (anchor) clusterCounts.set(anchor, (clusterCounts.get(anchor) ?? 0) + 1);
  }

  return [...clusterCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([anchor, count]) => ({ anchor, count, source: "signal-history-and-learning-brief" }));
}

async function resolveLatestBriefText(reportDate: string, baseDir: string): Promise<{ path: string; text: string }> {
  const datedPath = resolve(baseDir, "data/briefs", `${reportDate}.md`);
  const datedText = await readTextIfExists(datedPath);
  if (datedText.trim()) return { path: datedPath, text: datedText };

  const briefDir = resolve(baseDir, "data/briefs");
  const entries = await readdir(briefDir).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [] as string[];
    throw error;
  });
  for (const entry of entries.filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name)).sort().reverse()) {
    const filePath = resolve(briefDir, entry);
    const text = await readTextIfExists(filePath);
    if (text.trim()) return { path: filePath, text };
  }
  return { path: datedPath, text: "" };
}

export async function buildDailyOutcomeBoard(
  reportDate: string,
  generatedAt: string,
  baseDir = process.cwd()
): Promise<DailyOutcomeBoard> {
  const learningBriefPath = resolve(baseDir, "data/state/signal-learning-briefs", `${reportDate}.json`);
  const helperErrorsPath = resolve(baseDir, "data/state/helper-errors.jsonl");
  const signalHistoryPath = resolve(baseDir, "data/state/signal-history.json");
  const [learningBrief, helperErrorsText, history, latestBrief] = await Promise.all([
    readJsonIfExists<SignalLearningBrief>(learningBriefPath),
    readTextIfExists(helperErrorsPath),
    readSignalHistory(baseDir),
    resolveLatestBriefText(reportDate, baseDir)
  ]);

  const crowdedBeats = unique([
    ...extractBriefBeats(latestBrief.text),
    ...history.entries
      .filter((entry) => entry.reportDate === reportDate)
      .map((entry) => normalizeBeat(entry.beat))
      .filter((beat): beat is string => Boolean(beat))
  ], OPERATING_BEATS.length);
  const openBeats = OPERATING_BEATS.filter((beat) => !crowdedBeats.includes(beat));
  const latestBriefWinnerShape =
    learningBrief?.winnerReview.patterns[0] ||
    learningBrief?.winnerReview.headlines[0] ||
    latestBrief.text.split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).find((line) => line.length > 20) ||
    "No latest brief winner shape available";

  return {
    kind: "daily_outcome_board",
    reportDate,
    generatedAt,
    openBeats,
    crowdedBeats,
    duplicateClusters: buildDuplicateClusters(history, reportDate, learningBrief),
    recentRejectionReasons: unique([
      ...(learningBrief?.rejectionReview.tags ?? []),
      ...history.entries.flatMap((entry) => entry.feedbackLabels ?? []),
      ...history.entries.map((entry) => entry.note ?? "")
    ], 8),
    latestBriefWinnerShape,
    helperFailures: extractLatestHelperFailures(helperErrorsText, learningBrief),
    sourcePaths: unique([
      learningBriefPath,
      helperErrorsPath,
      signalHistoryPath,
      latestBrief.path
    ], 8)
  };
}

export async function writeDailyOutcomeBoard(
  reportDate: string,
  generatedAt: string,
  baseDir = process.cwd()
): Promise<{ board: DailyOutcomeBoard; statePath: string; logPath: string }> {
  const board = await buildDailyOutcomeBoard(reportDate, generatedAt, baseDir);
  const statePath = boardPath(reportDate, baseDir);
  const logPath = resolve(baseDir, "logs", `outcome-board-${reportDate}.json`);
  await mkdir(dirname(statePath), { recursive: true });
  await mkdir(dirname(logPath), { recursive: true });
  const serialized = `${JSON.stringify(board, null, 2)}\n`;
  await writeFile(statePath, serialized, "utf8");
  await writeFile(logPath, serialized, "utf8");
  return { board, statePath, logPath };
}

export async function readDailyOutcomeBoard(
  reportDate: string,
  baseDir = process.cwd()
): Promise<DailyOutcomeBoard | null> {
  return readJsonIfExists<DailyOutcomeBoard>(boardPath(reportDate, baseDir));
}

export function validateDailyOutcomeBoard(board: DailyOutcomeBoard | null, reportDate: string): string[] {
  const issues: string[] = [];
  if (!board) return [`today's outcome board is missing at data/state/outcome-boards/${reportDate}.json`];
  if (board.kind !== "daily_outcome_board") issues.push("outcome board kind must be daily_outcome_board");
  if (board.reportDate !== reportDate) issues.push(`outcome board reportDate is ${board.reportDate}, not ${reportDate}`);
  if (!Array.isArray(board.openBeats)) issues.push("outcome board openBeats field is required");
  if (!Array.isArray(board.crowdedBeats)) issues.push("outcome board crowdedBeats field is required");
  if (!Array.isArray(board.duplicateClusters)) issues.push("outcome board duplicateClusters field is required");
  if (!Array.isArray(board.recentRejectionReasons)) issues.push("outcome board recentRejectionReasons field is required");
  if (!board.latestBriefWinnerShape?.trim()) issues.push("outcome board latestBriefWinnerShape field is required");
  if (!Array.isArray(board.helperFailures)) issues.push("outcome board helperFailures field is required");
  return issues;
}
