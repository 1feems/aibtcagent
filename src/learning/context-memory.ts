import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readBriefWinnerSnapshot, type BriefWinnerSnapshot } from "../brief/winner-tracker.js";
import { loadTrainingMemory } from "./training-memory.js";

interface LeaderboardMemoryEntry {
  rank: number;
  agent?: string;
  btcAddress?: string;
  beats?: string[];
  signals?: number;
  streak?: string;
  earned?: string;
  score?: number;
}

interface LeaderboardMemoryFile {
  capturedAt: string;
  captureSource: string;
  notes?: string[];
  headings?: string[];
  self?: LeaderboardMemoryEntry & {
    displayName?: string;
  };
  topSix?: LeaderboardMemoryEntry[];
  comparisons?: {
    gapToTopThreeScore?: number;
    gapToTopSixScore?: number;
    topSixLowestScore?: number;
    selfScore?: number;
  };
}

interface RejectedSignalSnapshotEntry {
  beat: string;
  headline: string;
  agent: string;
  status: string;
  timestamp: string;
  tags: string[];
  reason: string;
}

interface RejectedSignalSnapshot {
  kind: "rejected_signal_snapshot";
  reportDate: string;
  timezone: string;
  capturedAt: string;
  captureSource: string;
  scope: string;
  notes: string[];
  headings: string[];
  entries: RejectedSignalSnapshotEntry[];
}

interface BriefAgentBehaviorState {
  updatedAt: string;
  agents?: Array<{
    agent: string;
    wins: number;
    beats: string[];
    sameDayMultiWins?: number;
    commonSourceDomains?: Array<{ domain: string; count: number }>;
  }>;
  commonSourceDomains?: Array<{ domain: string; count: number }>;
}

interface RepairMemoryFile {
  contracts?: Array<{
    signalId?: string | null;
    feedbackMessage?: string;
  }>;
}

interface ApprovalOutcomeRecord {
  kind: "approval_outcome";
  recordedAt: string;
  signalId?: string | null;
  candidateId?: string | null;
  approved: boolean;
  published?: boolean;
  success?: boolean;
  failureMode?: "not_in_brief" | "rejected" | "pending" | "unknown" | null;
  status?: "approved" | "rejected" | "submitted" | "unknown";
  note?: string | null;
  learningWhy?: string | null;
  feedbackLabels?: string[];
  headline?: string | null;
  beat?: string | null;
}

interface SharedBriefContextFile {
  kind: string;
  dates?: Record<string, {
    source?: string;
    briefTitles?: Array<{
      beat?: string;
      title: string;
      snippet?: string;
    }>;
    rejectedTitles?: Array<{
      title: string;
      reason?: string;
    }>;
    notes?: string[];
  }>;
}

interface TrainingBriefExamplesFile {
  kind: string;
  dates?: Record<string, {
    source?: string;
    examples?: Array<{
      beat?: string;
      title: string;
      body?: string;
    }>;
    notes?: string[];
  }>;
}

interface SignalHistoryFile {
  version: number;
  updatedAt: string;
  entries?: Array<{
    headline?: string | null;
    beat?: string | null;
    outcome?: string | null;
    note?: string | null;
  }>;
}

export interface ObjectiveMemory {
  generatedAt: string;
  sourcePaths: string[];
  mainKpi: string;
  payoutModel: {
    briefInclusionSats: number;
    weeklyTop3PrizesSats: [number, number, number];
    briefRevenueShareBps: number;
  };
  leaderboardFormula: {
    formula: string;
    weights: Record<string, number>;
  };
  cadenceLimits: {
    maxSignalsPerDay: number;
    maxSignalsPerBeatPerMinutes: number;
  };
  currentStanding: {
    rank: number | null;
    score: number | null;
    streak: string | null;
    earned: string | null;
    gapToTop3: number | null;
    gapToTop6: number | null;
  };
  pressureNotes: string[];
}

export interface EditorialMemoryFocusArea {
  label: string;
  evidence: string;
  action: string;
}

export interface EditorialMemoryExample {
  headline: string;
  beat: string;
  whyItWonOrLost: string;
  source: string;
}

export interface EditorialContextMemory {
  generatedAt: string;
  sourcePath: string;
  lessonCount: number;
  lessonsByKind: Record<"win" | "loss" | "next" | "note", number>;
  editorialTemplate: {
    readTodayBriefFirst: true;
    source: string;
  };
  rejectionPolicy: {
    rejectedFeedbackIsOperatingInstruction: true;
    repairAndResubmitByDefault: true;
  };
  outcomeLogging: {
    requiredFormats: ["win:", "loss:", "next:"];
    guidance: string;
  };
  lessons: Array<{
    kind: "win" | "loss" | "next" | "note";
    text: string;
    recordedOn: string | null;
    categories: string[];
    signalIds: string[];
  }>;
  preFilingChecks: Array<{
    id: string;
    rule: string;
    rationale: string;
    triggerCount: number;
    sourceKinds: Array<"win" | "loss" | "next" | "note">;
  }>;
  publisherGate: {
    fourQuestions: string[];
    thisWeekPriority: string[];
  };
  factCheckerGate: {
    standards: string[];
    thisWeekPriority: string[];
  };
  currentBrief: {
    reportDate: string | null;
    occupiedBeats: string[];
    headlines: string[];
  };
  focusAreas: EditorialMemoryFocusArea[];
  qualityBar: string[];
  recentExamples: {
    winners: EditorialMemoryExample[];
    losses: EditorialMemoryExample[];
  };
}

export interface CompetitionMemory {
  generatedAt: string;
  sourcePaths: string[];
  crowdedBeats: Array<{
    beat: string;
    pressure: number;
    reasons: string[];
  }>;
  beatOwners: Array<{
    agent: string;
    beats: string[];
    wins: number;
    sameDayMultiWins: number;
  }>;
  winningStoryShapes: string[];
  convertingSourcePatterns: string[];
  crowdingNotes: string[];
}

export interface BriefExamplesMemory {
  generatedAt: string;
  sourcePaths: string[];
  recentWinners: Array<{
    headline: string;
    beat: string;
    agent: string;
    whyItWorked: string;
    source: string;
  }>;
  recentLosses: Array<{
    headline: string;
    beat: string;
    whyItLost: string;
    source: string;
  }>;
  repairedPatternsThatLaterWorked: string[];
  sideBySide: Array<{
    bad: string;
    briefWorthy: string;
    lesson: string;
  }>;
}

function pathFor(baseDir: string | undefined, fileName: string): string {
  return resolve(baseDir ?? process.cwd(), `data/state/${fileName}`);
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

async function listMatchingFiles(dirPath: string, prefix: string): Promise<string[]> {
  if (!existsSync(dirPath)) return [];
  return (await readdir(dirPath))
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort();
}

async function listJsonFiles(dirPath: string): Promise<string[]> {
  if (!existsSync(dirPath)) return [];
  return (await readdir(dirPath))
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function parseSatsLabel(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/(\d+)\s*sats/i);
  return match ? Number(match[1]) : null;
}

function parseStreakDays(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+)d/i);
  return match ? Number(match[1]) : null;
}

async function getLatestBriefSnapshot(root: string): Promise<BriefWinnerSnapshot | null> {
  const names = await listMatchingFiles(resolve(root, "data/state"), "brief-winners-");
  const latest = names.at(-1);
  if (!latest) return null;
  const reportDate = latest.replace(/^brief-winners-/, "").replace(/\.json$/, "");
  return readBriefWinnerSnapshot(reportDate, root);
}

async function getLatestRejectedSnapshot(root: string): Promise<RejectedSignalSnapshot | null> {
  const names = await listMatchingFiles(resolve(root, "data/state"), "rejected-signals-");
  const latest = names.at(-1);
  if (!latest) return null;
  return readJsonIfExists<RejectedSignalSnapshot>(resolve(root, "data/state", latest));
}

async function getLatestApprovalOutcomes(root: string): Promise<ApprovalOutcomeRecord[]> {
  const dirPath = resolve(root, "data/outcomes/approvals");
  const files = await listJsonFiles(dirPath);
  const parsed = (
    await Promise.all(files.map((name) => readJsonIfExists<ApprovalOutcomeRecord>(resolve(dirPath, name))))
  )
    .filter((entry): entry is ApprovalOutcomeRecord => Boolean(entry?.recordedAt))
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  const latestDate = parsed.at(-1)?.recordedAt?.slice(0, 10) ?? null;
  if (!latestDate) return [];
  return parsed.filter((entry) => entry.recordedAt.slice(0, 10) === latestDate);
}

function getLatestDatedEntry<T>(
  entries: Record<string, T> | undefined
): { reportDate: string; entry: T } | null {
  if (!entries) return null;
  const reportDate = Object.keys(entries).sort().at(-1);
  if (!reportDate) return null;
  const entry = entries[reportDate];
  return entry ? { reportDate, entry } : null;
}

function summarizeBody(text: string | undefined, fallback: string): string {
  const normalized = text?.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length <= 220 ? normalized : `${normalized.slice(0, 217)}...`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function sortCountMap(counts: Map<string, number>): Array<{ label: string; count: number }> {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function getObjectiveMemoryPath(baseDir?: string): string {
  return pathFor(baseDir, "objective-memory.json");
}

export async function refreshObjectiveMemory(baseDir?: string): Promise<ObjectiveMemory> {
  const root = resolve(baseDir ?? process.cwd());
  const leaderboard = await readJsonIfExists<LeaderboardMemoryFile>(resolve(root, "data/state/leaderboard-memory.json"));
  const self = leaderboard?.self ?? null;
  const comparisons = leaderboard?.comparisons ?? {};

  const pressureNotes: string[] = [
    "Brief inclusion is the main KPI; optimize for making the brief, not just being approved.",
    "Each brief win is worth 30000 sats, so filing slots are scarce capital rather than cheap attempts.",
    "Streak continuity matters because it feeds leaderboard score and weekly top-3 odds."
  ];

  if ((comparisons.gapToTopThreeScore ?? null) !== null) {
    pressureNotes.push(`Current gap to weekly top-3 score line: ${comparisons.gapToTopThreeScore}.`);
  }
  if ((comparisons.gapToTopSixScore ?? null) !== null) {
    pressureNotes.push(`Current gap to top-6 score line: ${comparisons.gapToTopSixScore}.`);
  }
  if ((parseStreakDays(self?.streak) ?? 0) > 0) {
    pressureNotes.push(`Current streak is ${self?.streak}; protect it when the slate is weak, but do not burn slots on low-odds junk.`);
  }

  const memory: ObjectiveMemory = {
    generatedAt: new Date().toISOString(),
    sourcePaths: ["data/state/leaderboard-memory.json", "docs/daily-docs-map.md", "docs/build-plan.md"],
    mainKpi: "Brief inclusion wins are the primary output metric because they drive both direct payout and leaderboard leverage.",
    payoutModel: {
      briefInclusionSats: 30000,
      weeklyTop3PrizesSats: [200000, 100000, 50000],
      briefRevenueShareBps: 7000
    },
    leaderboardFormula: {
      formula: "brief_inclusions x20 + signal_count x5 + current_streak x5 + days_active x2 + approved_corrections x15 + referral_credits x25",
      weights: {
        brief_inclusions: 20,
        signal_count: 5,
        current_streak: 5,
        days_active: 2,
        approved_corrections: 15,
        referral_credits: 25
      }
    },
    cadenceLimits: {
      maxSignalsPerDay: 6,
      maxSignalsPerBeatPerMinutes: 60
    },
    currentStanding: {
      rank: self?.rank ?? null,
      score: self?.score ?? null,
      streak: self?.streak ?? null,
      earned: self?.earned ?? null,
      gapToTop3: comparisons.gapToTopThreeScore ?? null,
      gapToTop6: comparisons.gapToTopSixScore ?? null
    },
    pressureNotes
  };

  const outputPath = getObjectiveMemoryPath(root);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(memory, null, 2)}\n`, "utf8");
  return memory;
}

export function getCompetitionMemoryPath(baseDir?: string): string {
  return pathFor(baseDir, "competition-memory.json");
}

export async function refreshCompetitionMemory(baseDir?: string): Promise<CompetitionMemory> {
  const root = resolve(baseDir ?? process.cwd());
  const [rejectedSnapshot, behavior, trainingMemory] = await Promise.all([
    getLatestRejectedSnapshot(root),
    readJsonIfExists<BriefAgentBehaviorState>(resolve(root, "data/state/brief-agent-behavior.json")),
    loadTrainingMemory(root)
  ]);

  const beatPressure = new Map<string, { pressure: number; reasons: Set<string> }>();
  for (const entry of rejectedSnapshot?.entries ?? []) {
    const normalizedBeat = entry.beat.trim() || "unknown";
    const reason = entry.reason;
    if (!/\bcap\b|\broster is full\b|\bdoes not clear the bar for displacement\b|\bduplicate\b/i.test(reason)) {
      continue;
    }

    const current = beatPressure.get(normalizedBeat) ?? { pressure: 0, reasons: new Set<string>() };
    current.pressure += /\bduplicate\b/i.test(reason) ? 2 : 1;
    current.reasons.add(reason);
    beatPressure.set(normalizedBeat, current);
  }

  const crowdedBeats = [...beatPressure.entries()]
    .map(([beat, value]) => ({
      beat,
      pressure: value.pressure,
      reasons: [...value.reasons].slice(0, 3)
    }))
    .sort((left, right) => right.pressure - left.pressure || left.beat.localeCompare(right.beat));

  const beatOwners = (behavior?.agents ?? [])
    .map((entry) => ({
      agent: entry.agent,
      beats: entry.beats ?? [],
      wins: entry.wins,
      sameDayMultiWins: entry.sameDayMultiWins ?? 0
    }))
    .sort((left, right) => right.wins - left.wins || left.agent.localeCompare(right.agent));

  const convertingSourcePatterns = [
    ...(behavior?.commonSourceDomains ?? []).slice(0, 5).map((entry) => `${entry.domain} (${entry.count})`),
    "Pair repo or API evidence with an independent verifier when claims are quantitative or extraordinary."
  ];

  const winningStoryShapes = [
    ...trainingMemory.winningHeadlinePatterns.slice(0, 4).map((pattern) => pattern.pattern),
    "Broad same-beat package with exact evidence and direct operator consequence",
    "Displacement story that is broader, earlier, or more operationally important than the crowded incumbent angle"
  ];

  const crowdingNotes = crowdedBeats.length > 0
    ? crowdedBeats.slice(0, 3).map((entry) => `${entry.beat} is crowded; do not enter without a displacement-level angle.`)
    : ["Crowding data is thin; default to checking today's brief and rejected snapshot before assuming an angle is open."];

  const memory: CompetitionMemory = {
    generatedAt: new Date().toISOString(),
    sourcePaths: [
      "data/state/rejected-signals-*.json",
      "data/state/brief-agent-behavior.json",
      "data/training/in-brief.jsonl"
    ],
    crowdedBeats,
    beatOwners,
    winningStoryShapes: unique(winningStoryShapes),
    convertingSourcePatterns: unique(convertingSourcePatterns),
    crowdingNotes
  };

  const outputPath = getCompetitionMemoryPath(root);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(memory, null, 2)}\n`, "utf8");
  return memory;
}

export function getBriefExamplesMemoryPath(baseDir?: string): string {
  return pathFor(baseDir, "brief-examples.json");
}

export async function refreshBriefExamplesMemory(baseDir?: string): Promise<BriefExamplesMemory> {
  const root = resolve(baseDir ?? process.cwd());
  const [
    briefSnapshot,
    rejectedSnapshot,
    approvalOutcomes,
    repairMemory,
    trainingMemory,
    sharedContext,
    trainingBriefExamples,
    signalHistory
  ] = await Promise.all([
    getLatestBriefSnapshot(root),
    getLatestRejectedSnapshot(root),
    getLatestApprovalOutcomes(root),
    readJsonIfExists<RepairMemoryFile>(resolve(root, "data/state/repairable-candidates.json")),
    loadTrainingMemory(root),
    readJsonIfExists<SharedBriefContextFile>(resolve(root, "data/briefs/shared-context.json")),
    readJsonIfExists<TrainingBriefExamplesFile>(resolve(root, "data/training/brief-examples.json")),
    readJsonIfExists<SignalHistoryFile>(resolve(root, "data/state/signal-history.json"))
  ]);

  const latestSharedContext = getLatestDatedEntry(sharedContext?.dates);
  const latestTrainingExamples = getLatestDatedEntry(trainingBriefExamples?.dates);

  const winnerMap = new Map<string, {
    headline: string;
    beat: string;
    agent: string;
    whyItWorked: string;
    source: string;
  }>();
  for (const entry of (briefSnapshot?.publishedSignals ?? []).slice(0, 6)) {
    winnerMap.set(entry.headline, {
      headline: entry.headline,
      beat: entry.beat,
      agent: entry.agent,
      whyItWorked: "Published in the brief, so it cleared both approval and selection pressure for that cycle.",
      source: `data/state/brief-winners-${briefSnapshot?.reportDate ?? "latest"}.json`
    });
  }
  for (const entry of approvalOutcomes.filter((outcome) => outcome.approved && outcome.published)) {
    const headline = entry.headline?.trim();
    if (!headline || winnerMap.has(headline)) continue;
    winnerMap.set(headline, {
      headline,
      beat: entry.beat?.trim() || "unknown",
      agent: "unknown",
      whyItWorked: "Resolved approval outcome says this signal made brief on the current cycle.",
      source: "data/outcomes/approvals/*.json"
    });
  }
  for (const entry of signalHistory?.entries ?? []) {
    const headline = entry.headline?.trim();
    if (!headline || winnerMap.has(headline) || entry.outcome !== "brief_included") continue;
    winnerMap.set(headline, {
      headline,
      beat: entry.beat?.trim() || "unknown",
      agent: "signal-history",
      whyItWorked: entry.note?.trim() || "Resolved in signal history as a brief-included winner.",
      source: "data/state/signal-history.json"
    });
  }
  for (const entry of latestSharedContext?.entry.briefTitles ?? []) {
    const headline = entry.title?.trim();
    if (!headline || winnerMap.has(headline)) continue;
    winnerMap.set(headline, {
      headline,
      beat: entry.beat?.trim() || "unknown",
      agent: "shared-context",
      whyItWorked: entry.snippet?.trim() || "Captured in shared brief context as a live winner/reference headline.",
      source: `data/briefs/shared-context.json#${latestSharedContext?.reportDate ?? "latest"}`
    });
  }
  for (const entry of latestTrainingExamples?.entry.examples ?? []) {
    const headline = entry.title?.trim();
    if (!headline || winnerMap.has(headline)) continue;
    winnerMap.set(headline, {
      headline,
      beat: entry.beat?.trim() || "unknown",
      agent: "training-examples",
      whyItWorked: summarizeBody(
        entry.body,
        "Stored as a full winner-style example for headline/body/source/disclosure shape."
      ),
      source: `data/training/brief-examples.json#${latestTrainingExamples?.reportDate ?? "latest"}`
    });
  }
  const recentWinners = [...winnerMap.values()].slice(0, 6);

  const lossMap = new Map<string, {
    headline: string;
    beat: string;
    whyItLost: string;
    source: string;
  }>();
  for (const entry of (rejectedSnapshot?.entries ?? []).slice(0, 6)) {
    lossMap.set(entry.headline, {
      headline: entry.headline,
      beat: entry.beat,
      whyItLost: entry.reason,
      source: `data/state/rejected-signals-${rejectedSnapshot?.reportDate ?? "latest"}.json`
    });
  }
  for (const entry of approvalOutcomes.filter((outcome) => (outcome.failureMode ?? null) === "rejected" || (outcome.failureMode ?? null) === "not_in_brief")) {
    const headline = entry.headline?.trim();
    if (!headline || lossMap.has(headline)) continue;
    lossMap.set(headline, {
      headline,
      beat: entry.beat?.trim() || "unknown",
      whyItLost: entry.learningWhy?.trim() || entry.note?.trim() || entry.failureMode || "Rejected in outcome records",
      source: "data/outcomes/approvals/*.json"
    });
  }
  for (const entry of signalHistory?.entries ?? []) {
    const headline = entry.headline?.trim();
    const outcome = entry.outcome?.trim() || null;
    if (!headline || lossMap.has(headline) || (outcome !== "rejected" && outcome !== "approved")) continue;
    lossMap.set(headline, {
      headline,
      beat: entry.beat?.trim() || "unknown",
      whyItLost:
        entry.note?.trim() ||
        (outcome === "approved"
          ? "Resolved in signal history as approved but not converted into the brief."
          : "Resolved in signal history as rejected."),
      source: "data/state/signal-history.json"
    });
  }
  for (const entry of latestSharedContext?.entry.rejectedTitles ?? []) {
    const headline = entry.title?.trim();
    if (!headline || lossMap.has(headline)) continue;
    lossMap.set(headline, {
      headline,
      beat: "unknown",
      whyItLost: entry.reason?.trim() || "Captured in shared brief context as a rejected example.",
      source: `data/briefs/shared-context.json#${latestSharedContext?.reportDate ?? "latest"}`
    });
  }
  const recentLosses = [...lossMap.values()].slice(0, 6);

  const repairedPatternsThatLaterWorked = unique([
    ...((repairMemory?.contracts ?? [])
      .map((contract) => contract.feedbackMessage?.trim())
      .filter(
        (value): value is string =>
          typeof value === "string" &&
          value.length > 0 &&
          /\brepair\b|\bresubmit\b|\badd\b|\bstrengthen\b/i.test(value)
      )
      .slice(0, 4)),
    "Add a second source or a dated proof point before retrying a quantitative claim.",
    "Broaden the package when a narrow same-beat angle loses to a fuller incumbent winner."
  ]);

  const winningPattern = trainingMemory.winningHeadlinePatterns[0]?.pattern ?? "short-form";
  const sideBySide = recentLosses.slice(0, 3).map((loss, index) => ({
    bad: loss.headline,
    briefWorthy: recentWinners[index]?.headline ?? `Rewrite this as a ${winningPattern} headline with claim + evidence + operator consequence.`,
    lesson: loss.whyItLost
  }));

  const memory: BriefExamplesMemory = {
    generatedAt: new Date().toISOString(),
    sourcePaths: [
      "data/state/brief-winners-*.json",
      "data/state/rejected-signals-*.json",
      "data/outcomes/approvals/*.json",
      "data/state/repairable-candidates.json",
      "data/state/signal-history.json",
      "data/briefs/shared-context.json",
      "data/training/brief-examples.json"
    ],
    recentWinners,
    recentLosses,
    repairedPatternsThatLaterWorked,
    sideBySide
  };

  const outputPath = getBriefExamplesMemoryPath(root);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(memory, null, 2)}\n`, "utf8");
  return memory;
}

export async function loadObjectiveMemory(baseDir?: string): Promise<ObjectiveMemory> {
  const outputPath = getObjectiveMemoryPath(baseDir);
  if (!existsSync(outputPath)) return refreshObjectiveMemory(baseDir);
  return (await readJsonIfExists<ObjectiveMemory>(outputPath)) ?? refreshObjectiveMemory(baseDir);
}

export async function loadCompetitionMemory(baseDir?: string): Promise<CompetitionMemory> {
  const outputPath = getCompetitionMemoryPath(baseDir);
  if (!existsSync(outputPath)) return refreshCompetitionMemory(baseDir);
  return (await readJsonIfExists<CompetitionMemory>(outputPath)) ?? refreshCompetitionMemory(baseDir);
}

export async function loadBriefExamplesMemory(baseDir?: string): Promise<BriefExamplesMemory> {
  const outputPath = getBriefExamplesMemoryPath(baseDir);
  if (!existsSync(outputPath)) return refreshBriefExamplesMemory(baseDir);
  return (await readJsonIfExists<BriefExamplesMemory>(outputPath)) ?? refreshBriefExamplesMemory(baseDir);
}

export async function loadLatestContextBundle(baseDir?: string): Promise<{
  objective: ObjectiveMemory;
  competition: CompetitionMemory;
  briefExamples: BriefExamplesMemory;
}> {
  const [objective, competition, briefExamples] = await Promise.all([
    loadObjectiveMemory(baseDir),
    loadCompetitionMemory(baseDir),
    loadBriefExamplesMemory(baseDir)
  ]);

  return { objective, competition, briefExamples };
}
