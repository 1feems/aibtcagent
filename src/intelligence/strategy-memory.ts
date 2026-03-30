import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const STRATEGY_DOCS = [
  "docs/brief-win-rules.md",
  "docs/signal-sourcing-checklist.md",
  "docs/brief-winner-tracking.md",
  "docs/sources.md",
  "docs/beat-strategy.md"
] as const;

export interface DailyStrategySnapshot {
  kind: "daily_strategy_snapshot";
  reportDate: string;
  generatedAt: string;
  sourceDocs: string[];
  priorities: string[];
  sourceLanes: string[];
  competitionRules: string[];
  antiPatterns: string[];
  historicalNotes: string[];
}

interface HistoricalBriefSeed {
  kind: "historical_brief_seed";
  label: string;
  notes: string[];
}

async function readDoc(relativePath: string, baseDir?: string): Promise<string> {
  return readFile(resolve(baseDir ?? process.cwd(), relativePath), "utf8");
}

async function readHistoricalBriefNotes(baseDir?: string): Promise<string[]> {
  const root = resolve(baseDir ?? process.cwd(), "data/brief-history");
  let files: string[] = [];

  try {
    files = (await readdir(root)).filter((fileName) => fileName.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const notes: string[] = [];
  for (const fileName of files) {
    const seed = JSON.parse(
      await readFile(resolve(root, fileName), "utf8")
    ) as HistoricalBriefSeed;
    for (const note of seed.notes ?? []) {
      if (!notes.includes(note)) {
        notes.push(note);
      }
    }
  }

  return notes;
}

function extractBulletLines(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function pickMatching(lines: string[], patterns: RegExp[], limit: number): string[] {
  const picked: string[] = [];
  for (const line of lines) {
    if (patterns.some((pattern) => pattern.test(line)) && !picked.includes(line)) {
      picked.push(line);
    }
    if (picked.length >= limit) {
      break;
    }
  }
  return picked;
}

export async function buildDailyStrategySnapshot(
  reportDate: string,
  generatedAt: string,
  baseDir?: string
): Promise<DailyStrategySnapshot> {
  const [docs, historicalNotes] = await Promise.all([
    Promise.all(STRATEGY_DOCS.map((relativePath) => readDoc(relativePath, baseDir))),
    readHistoricalBriefNotes(baseDir)
  ]);
  const bulletLines = docs.flatMap((doc) => extractBulletLines(doc));

  const priorities = pickMatching(
    bulletLines,
    [
      /\bin_brief\b/i,
      /\bbroadest\b/i,
      /\bstructural\b/i,
      /\bhidden driver\b/i,
      /\brisk window\b/i,
      /\boperator\b/i,
      /\bselection probability\b/i,
      /\bfewer, stronger\b/i
    ],
    8
  );
  const sourceLanes = pickMatching(
    bulletLines,
    [
      /\bgithub\b/i,
      /\breleases?\b/i,
      /\bapi\b/i,
      /\bexplorer\b/i,
      /\bresearch\b/i,
      /\bsecurity researcher\b/i,
      /\bregulatory\b/i,
      /\bexternal actionable\b/i,
      /\bdaily brief\b/i,
      /\blive activity feed\b/i,
      /\bapproved\b/i,
      /\bsubmitted\b/i,
      /\brejected\b/i,
      /\bmempool\b/i,
      /\bprimary source\b/i,
      /\bhuman news\b/i
    ],
    10
  );
  const competitionRules = pickMatching(
    bulletLines,
    [
      /\brepeat\b/i,
      /\boccupied\b/i,
      /\bsame-beat\b/i,
      /\bstronger same-beat\b/i,
      /\bbrief slot\b/i,
      /\bflooded\b/i
    ],
    8
  );
  const antiPatterns = pickMatching(
    bulletLines,
    [
      /\bdashboard-first\b/i,
      /\braw\b/i,
      /\bchangelog\b/i,
      /\bartifact\b/i,
      /\bgeneric\b/i,
      /\bno operational consequence\b/i,
      /\bwithout clear causality\b/i,
      /\bmulti-sentence\b/i,
      /\bsecondary summaries\b/i
    ],
    8
  );

  return {
    kind: "daily_strategy_snapshot",
    reportDate,
    generatedAt,
    sourceDocs: [...STRATEGY_DOCS],
    priorities,
    sourceLanes,
    competitionRules,
    antiPatterns,
    historicalNotes
  };
}

export function buildStrategyNotes(snapshot: DailyStrategySnapshot): string[] {
  const notes: string[] = [];

  if (snapshot.priorities[0]) {
    notes.push(`Daily strategy priority: ${snapshot.priorities[0]}`);
  }
  if (snapshot.competitionRules[0]) {
    notes.push(`Competition rule: ${snapshot.competitionRules[0]}`);
  }
  if (snapshot.sourceLanes[0]) {
    notes.push(`Source lane to favor: ${snapshot.sourceLanes[0]}`);
  }
  if (snapshot.antiPatterns[0]) {
    notes.push(`Avoid this pattern: ${snapshot.antiPatterns[0]}`);
  }
  if (snapshot.historicalNotes[0]) {
    notes.push(`Historical brief pattern: ${snapshot.historicalNotes[0]}`);
  }

  return notes;
}

export async function saveDailyStrategySnapshot(
  snapshot: DailyStrategySnapshot,
  baseDir?: string
): Promise<string> {
  const filePath = resolve(
    baseDir ?? process.cwd(),
    `data/reports/strategy/${snapshot.reportDate}.json`
  );
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  return filePath;
}
