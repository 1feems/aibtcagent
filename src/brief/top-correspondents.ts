import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

interface TopCorrespondentEntry {
  agent: string;
  btcAddress?: string;
  seats?: number;
  beats?: string[];
  signals?: number;
  streakDays?: number;
  earnedSats?: number;
  score?: number;
  notes?: string[];
  headlinePatterns?: string[];
  sourceDomains?: string[];
}

interface TopCorrespondentsFile {
  kind?: "top_correspondents";
  reportDate?: string;
  correspondents: TopCorrespondentEntry[];
}

interface TopCorrespondentBehaviorState {
  kind: "top_correspondent_behavior";
  reportDate: string;
  updatedAt: string;
  correspondents: Array<{
    agent: string;
    btcAddress: string | null;
    totalSeatWins: number;
    daysTracked: number;
    averageSeatsPerTrackedDay: number;
    beats: string[];
    latestSignals: number | null;
    latestStreakDays: number | null;
    latestEarnedSats: number | null;
    peakEarnedSats: number;
    latestScore: number | null;
    repeatedSeatDays: number;
    commonPatterns: Array<{ pattern: string; count: number }>;
    commonSourceDomains: Array<{ domain: string; count: number }>;
    notes: string[];
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

function normalizeList(values: string[] | undefined): string[] {
  return [...new Set(
    (values ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  )];
}

async function findAvailableCorrespondentDates(baseDir?: string): Promise<string[]> {
  const root = resolve(baseDir ?? process.cwd());
  const correspondentsDir = resolve(root, "data/correspondents");

  let files: string[] = [];
  try {
    files = await readdir(correspondentsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return [...new Set(
    files
      .map((fileName) => fileName.match(/^(\d{4}-\d{2}-\d{2})\.json$/)?.[1] ?? null)
      .filter((value): value is string => value !== null)
  )].sort();
}

async function readTopCorrespondents(
  reportDate: string,
  baseDir?: string
): Promise<TopCorrespondentsFile | null> {
  const root = resolve(baseDir ?? process.cwd());
  const filePath = resolve(root, `data/correspondents/${reportDate}.json`);
  const parsed = await readJsonOrNull<TopCorrespondentsFile>(filePath);
  if (!parsed) {
    return null;
  }

  return {
    kind: "top_correspondents",
    reportDate,
    correspondents: (parsed.correspondents ?? []).map((entry) => ({
      agent: entry.agent,
      ...(entry.btcAddress ? { btcAddress: entry.btcAddress } : {}),
      seats: entry.seats ?? 0,
      beats: normalizeList(entry.beats),
      ...(typeof entry.signals === "number" ? { signals: entry.signals } : {}),
      ...(typeof entry.streakDays === "number" ? { streakDays: entry.streakDays } : {}),
      ...(typeof entry.earnedSats === "number" ? { earnedSats: entry.earnedSats } : {}),
      ...(typeof entry.score === "number" ? { score: entry.score } : {}),
      notes: normalizeList(entry.notes),
      headlinePatterns: normalizeList(entry.headlinePatterns),
      sourceDomains: normalizeList(entry.sourceDomains)
    }))
  };
}

async function saveDailyTopCorrespondentSnapshot(
  reportDate: string,
  data: TopCorrespondentsFile,
  baseDir?: string
): Promise<string> {
  const root = resolve(baseDir ?? process.cwd());
  const filePath = resolve(root, `data/state/top-correspondents-${reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        kind: "top_correspondents_snapshot",
        reportDate,
        updatedAt: new Date().toISOString(),
        correspondents: data.correspondents
      },
      null,
      2
    ),
    "utf8"
  );
  return filePath;
}

async function updateTopCorrespondentBehavior(
  reportDate: string,
  baseDir?: string
): Promise<string> {
  const root = resolve(baseDir ?? process.cwd());
  const dates = await findAvailableCorrespondentDates(root);
  const stats = new Map<string, {
    btcAddress: string | null;
    totalSeatWins: number;
    daysTracked: number;
    repeatedSeatDays: number;
    beats: string[];
    latestSignals: number | null;
    latestStreakDays: number | null;
    latestEarnedSats: number | null;
    peakEarnedSats: number;
    latestScore: number | null;
    patterns: string[];
    sourceDomains: string[];
    notes: string[];
  }>();

  for (const date of dates) {
    const file = await readTopCorrespondents(date, root);
    if (!file) {
      continue;
    }

    for (const correspondent of file.correspondents) {
      const current = stats.get(correspondent.agent) ?? {
        btcAddress: null,
        totalSeatWins: 0,
        daysTracked: 0,
        repeatedSeatDays: 0,
        beats: [],
        latestSignals: null,
        latestStreakDays: null,
        latestEarnedSats: null,
        peakEarnedSats: 0,
        latestScore: null,
        patterns: [],
        sourceDomains: [],
        notes: []
      };

      current.btcAddress = correspondent.btcAddress ?? current.btcAddress;
      current.totalSeatWins += correspondent.seats ?? 0;
      current.daysTracked += 1;
      if ((correspondent.seats ?? 0) >= 2) {
        current.repeatedSeatDays += 1;
      }
      current.beats.push(...(correspondent.beats ?? []));
      current.latestSignals = correspondent.signals ?? current.latestSignals;
      current.latestStreakDays = correspondent.streakDays ?? current.latestStreakDays;
      current.latestEarnedSats = correspondent.earnedSats ?? current.latestEarnedSats;
      current.peakEarnedSats = Math.max(current.peakEarnedSats, correspondent.earnedSats ?? 0);
      current.latestScore = correspondent.score ?? current.latestScore;
      current.patterns.push(...(correspondent.headlinePatterns ?? []));
      current.sourceDomains.push(...(correspondent.sourceDomains ?? []));
      current.notes.push(...(correspondent.notes ?? []));
      stats.set(correspondent.agent, current);
    }
  }

  const behavior: TopCorrespondentBehaviorState = {
    kind: "top_correspondent_behavior",
    reportDate,
    updatedAt: new Date().toISOString(),
    correspondents: [...stats.entries()]
      .map(([agent, value]) => {
        const patternCounts = new Map<string, number>();
        const domainCounts = new Map<string, number>();

        for (const pattern of value.patterns) {
          patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
        }
        for (const domain of value.sourceDomains) {
          domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
        }

        return {
          agent,
          btcAddress: value.btcAddress,
          totalSeatWins: value.totalSeatWins,
          daysTracked: value.daysTracked,
          averageSeatsPerTrackedDay: Number((value.totalSeatWins / Math.max(value.daysTracked, 1)).toFixed(2)),
          beats: [...new Set(value.beats)].sort(),
          latestSignals: value.latestSignals,
          latestStreakDays: value.latestStreakDays,
          latestEarnedSats: value.latestEarnedSats,
          peakEarnedSats: value.peakEarnedSats,
          latestScore: value.latestScore,
          repeatedSeatDays: value.repeatedSeatDays,
          commonPatterns: [...patternCounts.entries()]
            .map(([pattern, count]) => ({ pattern, count }))
            .sort((left, right) => right.count - left.count || left.pattern.localeCompare(right.pattern))
            .slice(0, 5),
          commonSourceDomains: [...domainCounts.entries()]
            .map(([domain, count]) => ({ domain, count }))
            .sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain))
            .slice(0, 5),
          notes: [...new Set(value.notes)].slice(0, 8)
        };
      })
      .sort((left, right) =>
        right.totalSeatWins - left.totalSeatWins ||
        right.repeatedSeatDays - left.repeatedSeatDays ||
        left.agent.localeCompare(right.agent)
      )
  };

  const filePath = resolve(root, "data/state/top-correspondent-behavior.json");
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(behavior, null, 2), "utf8");
  return filePath;
}

export async function ingestTopCorrespondentSets(
  reportDate: string,
  baseDir?: string
): Promise<null | { dailySnapshotPath: string; behaviorPath: string }> {
  const root = resolve(baseDir ?? process.cwd());
  const today = await readTopCorrespondents(reportDate, root);
  if (!today) {
    return null;
  }

  const dailySnapshotPath = await saveDailyTopCorrespondentSnapshot(reportDate, today, root);
  const behaviorPath = await updateTopCorrespondentBehavior(reportDate, root);
  return { dailySnapshotPath, behaviorPath };
}
