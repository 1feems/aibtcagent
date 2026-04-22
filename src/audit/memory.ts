import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { PatternMemoryRecord } from "./types.js";

export function failureToPattern(failure: string): string {
  return failure.replace(/_/g, " ") + " -> fail";
}

export async function readPatternMemory(filePath: string): Promise<PatternMemoryRecord[]> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as PatternMemoryRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writePatternMemory(filePath: string, patterns: PatternMemoryRecord[]): Promise<void> {
  const absolutePath = resolve(filePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(patterns, null, 2) + "\n", "utf8");
}

export async function updatePatternMemory(filePath: string, failures: string[]): Promise<PatternMemoryRecord[]> {
  const existing = await readPatternMemory(filePath);
  const counts = new Map(existing.map((entry) => [entry.pattern, entry.count]));

  for (const failure of failures) {
    const pattern = failureToPattern(failure);
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }

  const next = Array.from(counts.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((left, right) => right.count - left.count || left.pattern.localeCompare(right.pattern));

  await writePatternMemory(filePath, next);
  return next;
}
