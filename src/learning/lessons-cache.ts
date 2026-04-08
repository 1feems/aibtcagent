import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface LearningLesson {
  section: string;
  text: string;
  recordedOn: string | null;
  categories: string[];
  signalIds: string[];
}

export interface LearningCache {
  generatedAt: string;
  sourcePath: string;
  sourceMtimeMs: number;
  lessonCount: number;
  lessons: LearningLesson[];
  topRules: {
    filingGuards: string[];
    evidence: string[];
    beatStrategy: string[];
    storySelection: string[];
  };
}

function classifyLesson(text: string): string[] {
  const normalized = text.toLowerCase();
  const categories = new Set<string>();

  if (/\bheadline\b|\bbody\b|\btruncated\b|\bpackag/i.test(normalized)) {
    categories.add("filing_guard");
  }
  if (/\btimestamp\b|\bsnapshot\b|\bverifiable\b|\bevidence\b|\bproof\b|\bmetric\b/i.test(normalized)) {
    categories.add("evidence");
  }
  if (/\bbeat\b|\bcap\b|\bdaily signal limit\b|\bslot\b|\btiming\b/i.test(normalized)) {
    categories.add("beat_strategy");
  }
  if (/\bbrief\b|\bapproved_not_in_brief\b|\bbroader\b|\bnetwork-economy\b|\bstory\b|\bframing\b/i.test(normalized)) {
    categories.add("story_selection");
  }
  if (categories.size === 0) {
    categories.add("general");
  }

  return [...categories];
}

function extractSignalIds(text: string): string[] {
  return [...text.matchAll(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi)]
    .map((match) => match[0].toLowerCase());
}

function parseLessons(markdown: string): LearningLesson[] {
  const lessons: LearningLesson[] = [];
  let currentSection = "General";

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionMatch = /^##\s+(.+)$/.exec(line);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    if (!line.startsWith("- ")) continue;

    const text = line.slice(2).trim();
    const recordedOnMatch = /^(\d{4}-\d{2}-\d{2}):\s*/.exec(text);

    lessons.push({
      section: currentSection,
      text,
      recordedOn: recordedOnMatch?.[1] ?? null,
      categories: classifyLesson(text),
      signalIds: extractSignalIds(text)
    });
  }

  return lessons;
}

function uniqueTopLessons(lessons: LearningLesson[], category: string, limit = 3): string[] {
  const seen = new Set<string>();
  const picked: string[] = [];

  for (const lesson of lessons) {
    if (!lesson.categories.includes(category)) continue;
    if (seen.has(lesson.text)) continue;
    seen.add(lesson.text);
    picked.push(lesson.text);
    if (picked.length >= limit) break;
  }

  return picked;
}

function buildCache(markdown: string, sourcePath: string, sourceMtimeMs: number): LearningCache {
  const lessons = parseLessons(markdown);

  return {
    generatedAt: new Date().toISOString(),
    sourcePath,
    sourceMtimeMs,
    lessonCount: lessons.length,
    lessons,
    topRules: {
      filingGuards: uniqueTopLessons(lessons, "filing_guard"),
      evidence: uniqueTopLessons(lessons, "evidence"),
      beatStrategy: uniqueTopLessons(lessons, "beat_strategy"),
      storySelection: uniqueTopLessons(lessons, "story_selection")
    }
  };
}

export function getLearningCachePath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/learning-cache.json");
}

export async function refreshLearningCache(baseDir?: string): Promise<LearningCache> {
  const root = resolve(baseDir ?? process.cwd());
  const sourcePath = resolve(root, "memory/learnings.md");
  const cachePath = getLearningCachePath(root);

  const markdown = await readFile(sourcePath, "utf8");
  const sourceStats = await stat(sourcePath);
  const cache = buildCache(markdown, sourcePath, sourceStats.mtimeMs);

  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");

  return cache;
}

export async function loadLearningCache(baseDir?: string): Promise<LearningCache> {
  const root = resolve(baseDir ?? process.cwd());
  const sourcePath = resolve(root, "memory/learnings.md");
  const cachePath = getLearningCachePath(root);

  if (!existsSync(sourcePath)) {
    return {
      generatedAt: new Date().toISOString(),
      sourcePath,
      sourceMtimeMs: 0,
      lessonCount: 0,
      lessons: [],
      topRules: {
        filingGuards: [],
        evidence: [],
        beatStrategy: [],
        storySelection: []
      }
    };
  }

  const sourceStats = await stat(sourcePath);

  if (existsSync(cachePath)) {
    try {
      const cached = JSON.parse(await readFile(cachePath, "utf8")) as LearningCache;
      if (cached.sourceMtimeMs >= sourceStats.mtimeMs) {
        return cached;
      }
    } catch {
      // Fall through to refresh on parse failures or stale cache.
    }
  }

  return refreshLearningCache(root);
}
