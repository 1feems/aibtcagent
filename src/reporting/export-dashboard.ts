import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface SignalHistoryEntry {
  signalId: string;
  candidateId: string | null;
  headline: string | null;
  beat: string | null;
  filedAt: string | null;
  reportDate: string;
  outcome: string;
  resolvedAt: string | null;
  feedbackLabels: string[];
  note: string | null;
  satsEarned: number | null;
}

interface SignalHistoryFile {
  version: number;
  updatedAt: string;
  entries: SignalHistoryEntry[];
}

interface LeaderboardSelf {
  rank: number;
  btcAddress: string;
  displayName: string;
  beats: string[];
  signals: number;
  streak: string;
  earned: string;
  score: number;
}

interface BeatStats {
  filed: number;
  approved: number;
  briefIncluded: number;
  rejected: number;
  pending: number;
  other: number;
  sats: number;
}

interface DashboardSignal {
  signalId: string | null;
  candidateId: string | null;
  headline: string;
  beat: string;
  reportDate: string;
  filedAt: string | null;
  resolvedAt: string | null;
  status: string;
  feedbackLabels: string[];
  satsEarned: number;
  note: string | null;
}

interface DashboardStats {
  generatedAt: string;
  source: {
    signalHistoryPath: string;
    leaderboardPath: string;
    signalReportsPath: string;
  };
  agent: {
    displayName: string;
    btcAddress: string;
    rank: number;
    score: number;
    streak: string;
    earned: string;
  };
  summary: {
    total: number;
    submitted: number;
    approved: number;
    briefIncluded: number;
    rejected: number;
    pending: number;
    other: number;
    totalSats: number;
    approvalRate: number;
    briefHitRate: number;
  };
  byBeat: Record<string, BeatStats>;
  signals: DashboardSignal[];
  recentSignals: DashboardSignal[];
}

interface ReportSignalEntry {
  headline: string;
  beat: string;
  filedAt: string;
  reportDate: string;
  note: string | null;
  sourcePath: string;
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeStatus(entry: SignalHistoryEntry): string {
  switch (entry.outcome) {
    case "submitted":
      return "submitted";
    case "brief_included":
      return "brief_included";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "pending":
      return "pending";
    case "cap_blocked":
      return "cap_blocked";
    default:
      return entry.outcome || "unknown";
  }
}

function normalizeHeadline(headline: string): string {
  return headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function listSignalReportFiles(dirPath: string): Promise<string[]> {
  try {
    return (await readdir(dirPath))
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/u.test(name))
      .sort();
  } catch {
    return [];
  }
}

function extractCandidateSections(markdown: string): string[] {
  const matches = markdown.match(/## Candidate [\s\S]*?(?=\n## Candidate |\n## Final recommendation|\n## Bugs and Rejections|$)/g);
  return matches ?? [];
}

function extractLineValue(section: string, label: string): string | null {
  const match = section.match(new RegExp(`- ${label}:\\s*(.+)`));
  return match?.[1]?.trim() ?? null;
}

function parseReportSignals(reportDate: string, filePath: string, markdown: string): ReportSignalEntry[] {
  const parsed = extractCandidateSections(markdown)
    .map((section): ReportSignalEntry | null => {
      const headline = extractLineValue(section, "Headline");
      if (!headline || headline === "NOT GENERATED") {
        return null;
      }

      const tagsBlock = section.match(/- Tags:\s*([\s\S]*?)(?=\n## |\n- [A-Z][a-z]+:|$)/);
      const tags = (tagsBlock?.[1] ?? "")
        .split("\n")
        .map((line) => line.replace(/^- /, "").trim().replace(/^`|`$/g, ""))
        .filter(Boolean)
        .filter((tag) => !["blocked", "validation-failed", "insufficient-candidates"].includes(tag));

      return {
        headline,
        beat: tags[0] ?? "uncategorized",
        filedAt: `${reportDate}T12:00:00.000Z`,
        reportDate,
        note: extractLineValue(section, "Analysis"),
        sourcePath: filePath
      };
    })
    .filter((entry): entry is ReportSignalEntry => entry !== null);
  return parsed;
}

async function loadSignalsFromReports(root: string): Promise<ReportSignalEntry[]> {
  const reportsDir = resolve(root, "data/reports/signals");
  const files = await listSignalReportFiles(reportsDir);
  const parsed = await Promise.all(
    files.map(async (name) => {
      const markdown = await readFile(resolve(reportsDir, name), "utf8");
      const reportDate = name.replace(/\.md$/u, "");
      return parseReportSignals(reportDate, `data/reports/signals/${name}`, markdown);
    })
  );
  return parsed.flat();
}

function sortNewest(left: DashboardSignal, right: DashboardSignal): number {
  const leftTime = new Date(left.filedAt ?? left.resolvedAt ?? 0).getTime();
  const rightTime = new Date(right.filedAt ?? right.resolvedAt ?? 0).getTime();
  return rightTime - leftTime;
}

export async function generateActivityDashboard(baseDir?: string): Promise<DashboardStats> {
  const root = resolve(baseDir ?? process.cwd());
  const signalHistoryPath = resolve(root, "data/state/signal-history.json");
  const leaderboardPath = resolve(root, "data/state/leaderboard-memory.json");
  const signalReportsPath = resolve(root, "data/reports/signals");

  const [signalHistory, reportSignals] = await Promise.all([
    readJsonFile<SignalHistoryFile>(signalHistoryPath),
    loadSignalsFromReports(root)
  ]);
  const leaderboardData = await readJsonFile<{ self: LeaderboardSelf }>(leaderboardPath);
  const self = leaderboardData?.self;

  const canonicalSignals = (signalHistory?.entries ?? [])
    .map((entry) => ({
      signalId: entry.signalId,
      candidateId: entry.candidateId,
      headline: entry.headline?.trim() || "(missing headline)",
      beat: entry.beat?.trim() || "uncategorized",
      reportDate: entry.reportDate,
      filedAt: entry.filedAt,
      resolvedAt: entry.resolvedAt,
      status: normalizeStatus(entry),
      feedbackLabels: entry.feedbackLabels ?? [],
      satsEarned: entry.satsEarned ?? 0,
      note: entry.note
    }))
    .sort(sortNewest);

  const mergedSignals = new Map<string, DashboardSignal>();
  for (const signal of canonicalSignals) {
    mergedSignals.set(normalizeHeadline(signal.headline), signal);
  }

  for (const reportSignal of reportSignals) {
    const key = normalizeHeadline(reportSignal.headline);
    if (mergedSignals.has(key)) {
      continue;
    }

    mergedSignals.set(key, {
      signalId: null,
      candidateId: null,
      headline: reportSignal.headline,
      beat: reportSignal.beat,
      reportDate: reportSignal.reportDate,
      filedAt: reportSignal.filedAt,
      resolvedAt: null,
      status: "submitted",
      feedbackLabels: [],
      satsEarned: 0,
      note: reportSignal.note ? `${reportSignal.note} [source: ${reportSignal.sourcePath}]` : `source: ${reportSignal.sourcePath}`
    });
  }

  const recentSignals = [...mergedSignals.values()].sort(sortNewest);

  let submitted = 0;
  let approved = 0;
  let briefIncluded = 0;
  let rejected = 0;
  let pending = 0;
  let other = 0;
  let totalSats = 0;

  const byBeat: Record<string, BeatStats> = {};
  for (const signal of recentSignals) {
    totalSats += signal.satsEarned;
    switch (signal.status) {
      case "submitted":
        submitted += 1;
        pending += 1;
        break;
      case "approved":
        approved += 1;
        break;
      case "brief_included":
        briefIncluded += 1;
        break;
      case "rejected":
        rejected += 1;
        break;
      case "pending":
        pending += 1;
        break;
      default:
        other += 1;
        break;
    }

    if (!byBeat[signal.beat]) {
      byBeat[signal.beat] = {
        filed: 0,
        approved: 0,
        briefIncluded: 0,
        rejected: 0,
        pending: 0,
        other: 0,
        sats: 0
      };
    }

    const beatStats = byBeat[signal.beat];
    beatStats.filed += 1;
    beatStats.sats += signal.satsEarned;
    switch (signal.status) {
      case "submitted":
        beatStats.pending += 1;
        break;
      case "approved":
        beatStats.approved += 1;
        break;
      case "brief_included":
        beatStats.briefIncluded += 1;
        break;
      case "rejected":
        beatStats.rejected += 1;
        break;
      case "pending":
        beatStats.pending += 1;
        break;
      default:
        beatStats.other += 1;
        break;
    }
  }

  const resolvedCount = approved + briefIncluded + rejected + other;
  const total = recentSignals.length;
  const approvalRate = resolvedCount > 0
    ? Math.round(((approved + briefIncluded) / resolvedCount) * 100)
    : 0;
  const briefHitRate = total > 0
    ? Math.round((briefIncluded / total) * 100)
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    source: {
      signalHistoryPath,
      leaderboardPath,
      signalReportsPath
    },
    agent: {
      displayName: self?.displayName ?? "unknown",
      btcAddress: self?.btcAddress ?? "",
      rank: self?.rank ?? 0,
      score: self?.score ?? 0,
      streak: self?.streak ?? "0d",
      earned: self?.earned ?? "0 sats"
    },
    summary: {
      total,
      submitted,
      approved,
      briefIncluded,
      rejected,
      pending,
      other,
      totalSats,
      approvalRate,
      briefHitRate
    },
    byBeat,
    signals: recentSignals,
    recentSignals
  };
}

export async function saveActivityDashboard(
  stats: DashboardStats,
  baseDir?: string
): Promise<{ repoPath: string; dashboardPath: string | null }> {
  const root = resolve(baseDir ?? process.cwd());
  const repoPath = resolve(root, "data/state/activity-dashboard.json");
  await mkdir(dirname(repoPath), { recursive: true });
  await writeFile(repoPath, JSON.stringify(stats, null, 2) + "\n", "utf8");

  const workspaceDashboardPath = resolve(root, "..", "dashboard", "stats.json");
  if (existsSync(dirname(workspaceDashboardPath))) {
    await mkdir(dirname(workspaceDashboardPath), { recursive: true });
    await writeFile(workspaceDashboardPath, JSON.stringify(stats, null, 2) + "\n", "utf8");
    return { repoPath, dashboardPath: workspaceDashboardPath };
  }

  return { repoPath, dashboardPath: null };
}

async function main(): Promise<void> {
  const stats = await generateActivityDashboard();
  const paths = await saveActivityDashboard(stats);
  process.stdout.write(`[activity-dashboard] repo stats written to ${paths.repoPath}\n`);
  if (paths.dashboardPath) {
    process.stdout.write(`[activity-dashboard] dashboard stats written to ${paths.dashboardPath}\n`);
  }
  process.stdout.write(
    `[activity-dashboard] ${stats.summary.total} signals | ${stats.summary.briefIncluded} brief | ${stats.summary.approved} approved | ${stats.summary.rejected} rejected | ${stats.summary.pending} pending\n`
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
