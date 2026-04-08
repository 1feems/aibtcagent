import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TrainingReasonTag, WinningHeadlinePattern } from "../types/index.js";

interface TrainingExample {
  label?: string;
  headline?: string;
  reason_tags?: string[];
}

export interface TrainingMemorySnapshot {
  winningHeadlinePatterns: WinningHeadlinePattern[];
  winningTags: TrainingReasonTag[];
  rejectionTags: TrainingReasonTag[];
}

async function readJsonl(filePath: string): Promise<TrainingExample[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TrainingExample);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function buildWinningHeadlinePatterns(headlines: string[]): WinningHeadlinePattern[] {
  const patternCounts = new Map<string, number>();

  for (const headline of headlines) {
    const normalized = headline.toLowerCase();
    const patterns = new Set<string>();

    if (normalized.includes(" because ")) {
      patterns.add("because-causality");
    }
    if (normalized.includes(", signaling ")) {
      patterns.add("signaling-significance");
    }
    if (normalized.includes("which suggests")) {
      patterns.add("which-suggests-significance");
    }
    if (normalized.includes(" before ")) {
      patterns.add("before-advantage");
    }
    if (headline.length <= 90) {
      patterns.add("short-form");
    } else if (headline.length <= 140) {
      patterns.add("full-length");
    }

    if (patterns.size === 0) {
      patterns.add("summary-led");
    }

    for (const pattern of patterns) {
      patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
    }
  }

  return [...patternCounts.entries()]
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((left, right) => right.count - left.count || left.pattern.localeCompare(right.pattern));
}

function buildTagCounts(examples: TrainingExample[]): TrainingReasonTag[] {
  const counts = new Map<string, number>();

  for (const example of examples) {
    for (const tag of example.reason_tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

export async function loadTrainingMemory(baseDir?: string): Promise<TrainingMemorySnapshot> {
  const root = resolve(baseDir ?? process.cwd());
  const [inBrief, rejected] = await Promise.all([
    readJsonl(resolve(root, "data/training/in-brief.jsonl")),
    readJsonl(resolve(root, "data/training/rejected.jsonl"))
  ]);

  const winningHeadlines = inBrief
    .map((example) => example.headline)
    .filter((headline): headline is string => Boolean(headline));

  return {
    winningHeadlinePatterns: buildWinningHeadlinePatterns(winningHeadlines),
    winningTags: buildTagCounts(inBrief),
    rejectionTags: buildTagCounts(rejected)
  };
}
