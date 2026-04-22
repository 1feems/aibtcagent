import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadTrainingMemory } from "./training-memory.js";

interface JsonlExample {
  headline?: string;
  reason_tags?: string[];
}

interface BriefExamplesMemory {
  recentWinners?: Array<{
    headline?: string;
    beat?: string;
    whyItWorked?: string;
  }>;
  recentLosses?: Array<{
    headline?: string;
    beat?: string;
    whyItLost?: string;
  }>;
}

interface HelperErrorLogEntry {
  message?: string;
}

export interface SignalLearningBrief {
  kind: "signal_learning_brief";
  reportDate: string;
  generatedAt: string;
  sourcePaths: string[];
  latestBrief: {
    path: string | null;
    headlineSample: string | null;
  };
  winnerReview: {
    headlines: string[];
    patterns: string[];
    tags: string[];
    lessons: string[];
  };
  rejectionReview: {
    headlines: string[];
    tags: string[];
    lessons: string[];
  };
  approvedNotInBriefReview: {
    headlines: string[];
    tags: string[];
    lessons: string[];
  };
  helperErrorReview: {
    messages: string[];
    lessons: string[];
  };
  draftingDirectives: string[];
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function readJsonlIfExists(filePath: string): Promise<JsonlExample[]> {
  const text = await readTextIfExists(filePath);
  if (!text.trim()) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as JsonlExample;
      } catch {
        return {};
      }
    });
}

function compact<T>(items: Array<T | null | undefined | false>): T[] {
  return items.filter(Boolean) as T[];
}

function uniqueStrings(items: string[], limit = 5): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit);
}

function extractLatestBriefHeadline(text: string): string | null {
  const bullet = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^[-*]\s+/.test(line));
  return bullet ? bullet.replace(/^[-*]\s+/, "").trim() : null;
}

function topReasonTags(entries: JsonlExample[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.reason_tags ?? []) {
      const normalized = tag.trim();
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function latestMessages(helperErrorsText: string, limit = 3): string[] {
  return helperErrorsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-20)
    .reverse()
    .map((line) => {
      try {
        return (JSON.parse(line) as HelperErrorLogEntry).message?.trim() ?? "";
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .slice(0, limit);
}

export function getSignalLearningBriefPath(reportDate: string, baseDir = process.cwd()): string {
  return resolve(baseDir, "data/state/signal-learning-briefs", `${reportDate}.json`);
}

export async function readSignalLearningBrief(reportDate: string, baseDir = process.cwd()): Promise<SignalLearningBrief | null> {
  return readJsonIfExists<SignalLearningBrief>(getSignalLearningBriefPath(reportDate, baseDir));
}

export async function buildSignalLearningBrief(
  reportDate: string,
  generatedAt: string,
  baseDir = process.cwd()
): Promise<SignalLearningBrief> {
  const root = resolve(baseDir);
  const latestBriefMdPath = resolve(root, "data/briefs", `${reportDate}.md`);
  const latestBriefJsonPath = resolve(root, "data/briefs", `${reportDate}.json`);
  const helperErrorsPath = resolve(root, "data/state/helper-errors.jsonl");
  const briefExamplesPath = resolve(root, "data/state/brief-examples.json");
  const rejectedTrainingPath = resolve(root, "data/training/rejected.jsonl");
  const approvedNotInBriefPath = resolve(root, "data/training/approved-not-in-brief.jsonl");
  const inBriefPath = resolve(root, "data/training/in-brief.jsonl");

  const [briefExamplesMemory, helperErrorsText, latestBriefMdText, latestBriefJsonText, rejectedRows, approvedNotInBriefRows, inBriefRows, trainingMemory] = await Promise.all([
    readJsonIfExists<BriefExamplesMemory>(briefExamplesPath),
    readTextIfExists(helperErrorsPath),
    readTextIfExists(latestBriefMdPath),
    readTextIfExists(latestBriefJsonPath),
    readJsonlIfExists(rejectedTrainingPath),
    readJsonlIfExists(approvedNotInBriefPath),
    readJsonlIfExists(inBriefPath),
    loadTrainingMemory(root)
  ]);

  const latestBriefPath = latestBriefMdText.trim()
    ? latestBriefMdPath
    : (latestBriefJsonText.trim() ? latestBriefJsonPath : null);
  const latestBriefHeadline = extractLatestBriefHeadline(latestBriefMdText) ?? null;

  const winnerHeadlines = uniqueStrings(compact([
    ...(briefExamplesMemory?.recentWinners ?? []).map((entry) => entry.headline ?? ""),
    ...inBriefRows.map((entry) => entry.headline ?? "")
  ]), 5);
  const winnerLessons = uniqueStrings(compact([
    winnerHeadlines[0] ? `Recent winner shape to emulate: "${winnerHeadlines[0]}"` : null,
    trainingMemory.winningHeadlinePatterns[0]?.pattern ? `Winning headline pattern showing up most often: ${trainingMemory.winningHeadlinePatterns[0].pattern}` : null,
    trainingMemory.winningTags[0]?.tag ? `Winning training tag to bias toward when real evidence supports it: ${trainingMemory.winningTags[0].tag}` : null
  ]), 4);

  const rejectionHeadlines = uniqueStrings(compact([
    ...(briefExamplesMemory?.recentLosses ?? []).map((entry) => entry.headline ?? ""),
    ...rejectedRows.map((entry) => entry.headline ?? "")
  ]), 5);
  const rejectionTags = uniqueStrings(topReasonTags(rejectedRows, 3), 3);
  const rejectionLessons = uniqueStrings(compact([
    rejectionHeadlines[0] ? `Recent rejection shape to avoid: "${rejectionHeadlines[0]}"` : null,
    rejectionTags[0] ? `Repeated rejection tag currently hurting filings: ${rejectionTags[0]}` : null,
    trainingMemory.rejectionTags[0]?.tag ? `Historical rejection pressure remains elevated for: ${trainingMemory.rejectionTags[0].tag}` : null
  ]), 4);

  const approvedNotInBriefHeadlines = uniqueStrings(approvedNotInBriefRows.map((entry) => entry.headline ?? ""), 5);
  const approvedNotInBriefTags = uniqueStrings(topReasonTags(approvedNotInBriefRows, 3), 3);
  const approvedNotInBriefLessons = uniqueStrings(compact([
    approvedNotInBriefHeadlines[0] ? `Approved-not-in-brief miss to learn from: "${approvedNotInBriefHeadlines[0]}"` : null,
    approvedNotInBriefTags[0] ? `A common approved-not-in-brief weakness is tagged as: ${approvedNotInBriefTags[0]}` : null
  ]), 3);

  const helperMessages = latestMessages(helperErrorsText, 3);
  const helperLessons = uniqueStrings(compact([
    ...helperMessages.map((message) => `Recent helper failure to avoid repeating: ${message}`),
    helperMessages.length > 0 ? "If the payload or helper broke recently, assume the same mistake will repeat unless the new draft explicitly fixes it." : null
  ]), 4);

  const draftingDirectives = uniqueStrings(compact([
    latestBriefHeadline ? `Beat the latest brief headline, not just the validation contract: "${latestBriefHeadline}".` : null,
    winnerLessons[0] ?? null,
    rejectionLessons[0] ?? null,
    approvedNotInBriefLessons[0] ?? null,
    helperLessons[0] ?? null,
    "Draft only stories with an exact anchor, reproducible source proof, and a direct operator consequence."
  ]), 6);

  return {
    kind: "signal_learning_brief",
    reportDate,
    generatedAt,
    sourcePaths: [
      ...(latestBriefPath ? [latestBriefPath] : []),
      briefExamplesPath,
      inBriefPath,
      rejectedTrainingPath,
      approvedNotInBriefPath,
      helperErrorsPath
    ],
    latestBrief: {
      path: latestBriefPath,
      headlineSample: latestBriefHeadline
    },
    winnerReview: {
      headlines: winnerHeadlines,
      patterns: trainingMemory.winningHeadlinePatterns.slice(0, 3).map((entry) => entry.pattern),
      tags: trainingMemory.winningTags.slice(0, 3).map((entry) => entry.tag),
      lessons: winnerLessons
    },
    rejectionReview: {
      headlines: rejectionHeadlines,
      tags: rejectionTags,
      lessons: rejectionLessons
    },
    approvedNotInBriefReview: {
      headlines: approvedNotInBriefHeadlines,
      tags: approvedNotInBriefTags,
      lessons: approvedNotInBriefLessons
    },
    helperErrorReview: {
      messages: helperMessages,
      lessons: helperLessons
    },
    draftingDirectives
  };
}

export async function writeSignalLearningBrief(
  reportDate: string,
  generatedAt: string,
  baseDir = process.cwd()
): Promise<string> {
  const outputPath = getSignalLearningBriefPath(reportDate, baseDir);
  const brief = await buildSignalLearningBrief(reportDate, generatedAt, baseDir);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(brief, null, 2), "utf8");
  return outputPath;
}
