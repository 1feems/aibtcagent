import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readFiledSignalsState } from "../filing/state.js";
import { readQuantumTrackerState } from "../filing/quantum-map.js";

export interface QuantumWeeklySynthesis {
  kind: "quantum_weekly_synthesis";
  asOfDate: string;
  isoWeek: number;
  readinessIndex: number | null;
  readinessSource: "metadata" | "derived" | "unknown";
  trackedSignals: Array<{
    headline: string;
    status: "accepted" | "pending" | "rejected";
    filedAt: string | null;
  }>;
  dataUpdates: Array<{
    developerName: string;
    previousScore: number;
    newScore: number;
    sourceUrl: string | null;
  }>;
  whatsMoving: string[];
  nextWeek: string[];
  markdown: string;
}

interface SaveQuantumWeeklySynthesisPaths {
  markdownPath: string;
  jsonPath: string;
}

function formatDateLabel(date: string): string {
  return date;
}

function getIsoWeekNumber(date: string): number {
  const value = new Date(`${date}T12:00:00Z`);
  const dayNum = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekStart(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + diff);
  return value.toISOString().slice(0, 10);
}

function isWithinWeek(candidateDate: string | null, weekStart: string, weekEnd: string): boolean {
  if (!candidateDate) return false;
  const normalized = candidateDate.slice(0, 10);
  return normalized >= weekStart && normalized <= weekEnd;
}

function resolveSignalStatus(
  rawStatus: "accepted" | "pending" | "rejected",
  headline: string,
  filedState: Awaited<ReturnType<typeof readFiledSignalsState>>
): "accepted" | "pending" | "rejected" {
  const filedMatch = filedState.filedSignals.find((entry) => entry.headline === headline);
  if (!filedMatch) return rawStatus;
  if (filedMatch.brief_included || filedMatch.approved) return "accepted";
  return rawStatus;
}

export async function generateQuantumWeeklySynthesis(asOfDate: string, baseDir?: string): Promise<QuantumWeeklySynthesis> {
  const tracker = await readQuantumTrackerState(baseDir);
  const filedState = await readFiledSignalsState(baseDir);
  const weekStart = getWeekStart(asOfDate);
  const isoWeek = getIsoWeekNumber(asOfDate);
  const latestSummary = tracker.latestSnapshot?.summary ?? null;
  const readinessIndex = latestSummary?.metadataCompositeScore ?? latestSummary?.derivedCompositeScore ?? null;
  const readinessSource =
    latestSummary?.metadataCompositeScore !== null && latestSummary?.metadataCompositeScore !== undefined
      ? "metadata"
      : latestSummary?.derivedCompositeScore !== null && latestSummary?.derivedCompositeScore !== undefined
        ? "derived"
        : "unknown";

  const trackedSignals = tracker.trackedSignals
    .filter((signal) => isWithinWeek(signal.filedAt ?? signal.reportDate, weekStart, asOfDate))
    .map((signal) => ({
      headline: signal.headline ?? "Untitled quantum signal",
      status: resolveSignalStatus(signal.status, signal.headline ?? "", filedState),
      filedAt: signal.filedAt
    }));

  const dataUpdates = tracker.scoreChanges
    .filter((change) => isWithinWeek(change.filedAt ?? change.reportDate, weekStart, asOfDate))
    .map((change) => ({
      developerName: change.developerName,
      previousScore: change.previousScore,
      newScore: change.newScore,
      sourceUrl: change.sourceUrl
    }));

  const whatsMoving: string[] = [];
  if (dataUpdates.length > 0) {
    whatsMoving.push(
      `${dataUpdates.length} developer score update${dataUpdates.length === 1 ? "" : "s"} moved through the quantum beat this week, led by ${dataUpdates.map((entry) => entry.developerName).slice(0, 2).join(" and ")}.`
    );
  }
  if (trackedSignals.length > 0) {
    const acceptedCount = trackedSignals.filter((signal) => signal.status === "accepted").length;
    whatsMoving.push(
      `${trackedSignals.length} quantum signal${trackedSignals.length === 1 ? "" : "s"} were filed this week; ${acceptedCount} ${acceptedCount === 1 ? "is" : "are"} currently accepted and the rest remain pending review.`
    );
  }
  if (latestSummary?.reconciliation.mismatchCodes.length) {
    whatsMoving.push(
      `The current dataset still has reconciliation noise (${latestSummary.reconciliation.mismatchCodes.join(", ")}), so readiness updates should be tied to a specific dataset version/date before publication.`
    );
  }
  if (whatsMoving.length === 0) {
    whatsMoving.push("No quantum filings or score updates were tracked in the current weekly window.");
  }

  const nextWeek: string[] = [];
  if (latestSummary?.reconciliation.mismatchCodes.includes("voiced_count_mismatch")) {
    nextWeek.push("Resolve the definition of `voiced` and reconcile metadata counts against the developer table.");
  }
  if (trackedSignals.some((signal) => signal.status === "pending")) {
    nextWeek.push("Follow up on pending quantum filings and update statuses once publisher review lands.");
  }
  if (dataUpdates.some((change) => change.sourceUrl === null)) {
    nextWeek.push("Backfill missing primary-source links on tracked score updates before the next synthesis.");
  }
  if (nextWeek.length === 0) {
    nextWeek.push("Monitor fresh developer stance changes, PQ milestone posts, and any live dataset version change.");
  }

  const markdownLines = [
    `## Weekly Synthesis — Week ${isoWeek} | ${formatDateLabel(asOfDate)}`,
    "",
    `**Readiness Index: ${readinessIndex ?? "n/a"}/100**`,
    "",
    "### Signals Filed This Week",
    ...(trackedSignals.length > 0
      ? trackedSignals.map((signal) => `- ${signal.headline} — ${signal.status === "accepted" ? "accepted" : signal.status === "rejected" ? "rejected" : "pending"}`)
      : ["- No quantum filings tracked this week"]),
    "",
    "### Data Updates",
    ...(dataUpdates.length > 0
      ? dataUpdates.map((update) =>
        `- ${update.developerName}: score ${update.previousScore} → ${update.newScore}${update.sourceUrl ? ` (${update.sourceUrl})` : ""}`)
      : ["- No tracked developer score changes this week"]),
    "",
    "### What's Moving",
    ...whatsMoving,
    "",
    "### Next Week",
    ...nextWeek
  ];

  return {
    kind: "quantum_weekly_synthesis",
    asOfDate,
    isoWeek,
    readinessIndex,
    readinessSource,
    trackedSignals,
    dataUpdates,
    whatsMoving,
    nextWeek,
    markdown: markdownLines.join("\n")
  };
}

export async function saveQuantumWeeklySynthesis(
  synthesis: QuantumWeeklySynthesis,
  baseDir?: string
): Promise<SaveQuantumWeeklySynthesisPaths> {
  const root = resolve(baseDir ?? process.cwd());
  const markdownPath = resolve(root, `data/reports/quantum-weekly/${synthesis.asOfDate}.md`);
  const jsonPath = resolve(root, `data/reports/quantum-weekly/${synthesis.asOfDate}.json`);
  await mkdir(dirname(markdownPath), { recursive: true });
  await writeFile(markdownPath, synthesis.markdown + "\n", "utf8");
  await writeFile(jsonPath, JSON.stringify(synthesis, null, 2) + "\n", "utf8");
  return { markdownPath, jsonPath };
}

export async function generateAndSaveQuantumWeeklySynthesis(
  asOfDate: string,
  baseDir?: string
): Promise<{ synthesis: QuantumWeeklySynthesis; paths: SaveQuantumWeeklySynthesisPaths }> {
  const synthesis = await generateQuantumWeeklySynthesis(asOfDate, baseDir);
  const paths = await saveQuantumWeeklySynthesis(synthesis, baseDir);
  return { synthesis, paths };
}
