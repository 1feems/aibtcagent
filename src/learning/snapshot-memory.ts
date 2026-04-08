import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { LearningLesson } from "./lessons-cache.js";
import type { BriefWinnerSnapshot } from "../brief/winner-tracker.js";

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

export interface SnapshotMemory {
  generatedAt: string;
  sourceFiles: string[];
  lessonCount: number;
  lessons: LearningLesson[];
}

function getSnapshotMemoryPath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/snapshot-memory.json");
}

function makeLesson(
  section: string,
  recordedOn: string,
  text: string,
  categories: string[],
  signalIds: string[] = []
): LearningLesson {
  return {
    section,
    recordedOn,
    text,
    categories,
    signalIds
  };
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

function countMatching(entries: RejectedSignalSnapshotEntry[], pattern: RegExp): number {
  return entries.filter((entry) => pattern.test(entry.reason)).length;
}

function summarizeRejectedSnapshot(snapshot: RejectedSignalSnapshot): LearningLesson[] {
  const entries = snapshot.entries;
  if (entries.length === 0) return [];

  const lessons: LearningLesson[] = [];
  const duplicateCount = countMatching(entries, /\bduplicate\b|\balready covered\b|\balready approved\b/i);
  const fullRosterCount = countMatching(entries, /\broster is full\b|\bdoes not clear the bar for displacement\b/i);
  const truncatedCount = countMatching(entries, /\btruncated\b|\bcuts off mid-sentence\b|\bmid-sentence\b|\bcomplete the analysis\b/i);
  const rawDataCount = countMatching(entries, /\braw data\b|\bstat dump\b|\bwhat should an agent do differently\b/i);
  const externalCount = countMatching(entries, /\bdoes not cover aibtc network activity\b|\bexternal\b/i);
  const evidenceCount = countMatching(entries, /\bfactual error\b|\bsingle-source\b|\bsecond data source\b|\bverify data\b|\bspeculative\b|\bextraordinary claim\b/i);

  if (duplicateCount > 0) {
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        snapshot.reportDate,
        `${snapshot.reportDate}: next: reject same-day duplicate coverage before filing; ${duplicateCount} rejected snapshot item(s) lost because the roster already had the same angle.`,
        ["story_selection", "beat_strategy"]
      )
    );
  }

  if (fullRosterCount > 0) {
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        snapshot.reportDate,
        `${snapshot.reportDate}: next: when the roster is full, hold baseline-quality candidates and only file angles that clear the displacement bar with stronger evidence, sharper routing, or a more agent-actionable consequence (${fullRosterCount} rejected snapshot item(s) lost to full-roster pressure).`,
        ["story_selection", "beat_strategy"]
      )
    );
  }

  if (truncatedCount > 0) {
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        snapshot.reportDate,
        `${snapshot.reportDate}: next: fail incomplete drafts before signing; ${truncatedCount} rejected snapshot item(s) were rejected for truncated or unfinished analysis.`,
        ["filing_guard"]
      )
    );
  }

  if (rawDataCount > 0) {
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        snapshot.reportDate,
        `${snapshot.reportDate}: next: block raw counts without a clear implication; ${rawDataCount} rejected snapshot item(s) were rejected as stat dumps without an agent-actionable thesis.`,
        ["story_selection", "evidence"]
      )
    );
  }

  if (externalCount > 0) {
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        snapshot.reportDate,
        `${snapshot.reportDate}: next: reject external stories without a direct AIBTC network angle; ${externalCount} rejected snapshot item(s) failed for being outside AIBTC activity.`,
        ["story_selection"]
      )
    );
  }

  if (evidenceCount > 0) {
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        snapshot.reportDate,
        `${snapshot.reportDate}: next: require stronger proof for contrarian or quantitative claims; ${evidenceCount} rejected snapshot item(s) failed due to speculative framing, factual errors, or single-source evidence.`,
        ["evidence"]
      )
    );
  }

  return lessons;
}

function summarizeBriefSnapshot(snapshot: BriefWinnerSnapshot): LearningLesson[] {
  const lessons: LearningLesson[] = [];
  const reportDate = snapshot.reportDate;
  const repeatWinners = snapshot.repeatWinners.filter((entry) => entry.appearances > 1);

  if (snapshot.occupiedBeats.length > 0) {
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        reportDate,
        `${reportDate}: win: in-brief memory occupied these beats: ${snapshot.occupiedBeats.join(", ")}. Treat them as proven winning lanes for that cycle, not just generic approvals.`,
        ["story_selection", "beat_strategy"]
      )
    );
  }

  if (repeatWinners.length > 0) {
    const summary = repeatWinners
      .map((entry) => `${entry.agent} (${entry.appearances} wins across ${entry.beats.join(", ")})`)
      .join("; ");
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        reportDate,
        `${reportDate}: win: repeat brief winners were ${summary}. Treat same-cycle repeat winners as active beat owners until new evidence shows they can be displaced.`,
        ["story_selection"]
      )
    );
  }

  return lessons;
}

function dedupeLessons(lessons: LearningLesson[]): LearningLesson[] {
  const seen = new Set<string>();
  const unique: LearningLesson[] = [];

  for (const lesson of lessons) {
    const key = `${lesson.recordedOn ?? ""}::${lesson.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(lesson);
  }

  return unique.sort((left, right) => {
    const leftDate = left.recordedOn ?? "";
    const rightDate = right.recordedOn ?? "";
    return leftDate.localeCompare(rightDate) || left.text.localeCompare(right.text);
  });
}

function summarizeApprovalOutcomes(reportDate: string, outcomes: ApprovalOutcomeRecord[]): LearningLesson[] {
  if (outcomes.length === 0) return [];

  const lessons: LearningLesson[] = [];
  const publishedCount = outcomes.filter((entry) => entry.approved && entry.published).length;
  const approvedNotInBriefCount = outcomes.filter((entry) => (entry.failureMode ?? null) === "not_in_brief").length;
  const rejectedCount = outcomes.filter((entry) => (entry.failureMode ?? null) === "rejected").length;

  if (publishedCount > 0) {
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        reportDate,
        `${reportDate}: win: ${publishedCount} resolved outcome(s) made brief today. Use those accepted winners as the live standard for headline shape, consequence framing, and proof density.`,
        ["story_selection", "beat_strategy"]
      )
    );
  }

  if (approvedNotInBriefCount > 0) {
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        reportDate,
        `${reportDate}: loss: ${approvedNotInBriefCount} resolved outcome(s) were approved but not selected for brief. Treat approval without publication as a losing shape unless the next cycle broadens or sharpens the angle.`,
        ["story_selection", "beat_strategy"]
      )
    );
  }

  if (rejectedCount > 0) {
    lessons.push(
      makeLesson(
        "Snapshot Memory",
        reportDate,
        `${reportDate}: loss: ${rejectedCount} resolved outcome(s) were rejected by editorial review. Feed the recorded failure reasons back into the next cycle instead of redrafting the same shape.`,
        ["story_selection", "evidence"]
      )
    );
  }

  return lessons;
}

export async function refreshSnapshotMemory(baseDir?: string): Promise<SnapshotMemory> {
  const root = resolve(baseDir ?? process.cwd());
  const stateDir = resolve(root, "data/state");
  const approvalsDir = resolve(root, "data/outcomes/approvals");
  const names = existsSync(stateDir) ? await readdir(stateDir) : [];
  const approvalFiles = existsSync(approvalsDir) ? (await readdir(approvalsDir)).filter((name) => name.endsWith(".json")).sort() : [];

  const briefFiles = names
    .filter((name) => name.startsWith("brief-winners-") && name.endsWith(".json"))
    .sort();
  const rejectedFiles = names
    .filter((name) => name.startsWith("rejected-signals-") && name.endsWith(".json"))
    .sort();

  const sourceFiles = [
    ...briefFiles.map((name) => `data/state/${name}`),
    ...rejectedFiles.map((name) => `data/state/${name}`),
    ...approvalFiles.map((name) => `data/outcomes/approvals/${name}`)
  ];
  const lessons: LearningLesson[] = [];

  for (const fileName of briefFiles) {
    const snapshot = await readJsonOrNull<BriefWinnerSnapshot>(resolve(stateDir, fileName));
    if (!snapshot) continue;
    lessons.push(...summarizeBriefSnapshot(snapshot));
  }

  for (const fileName of rejectedFiles) {
    const snapshot = await readJsonOrNull<RejectedSignalSnapshot>(resolve(stateDir, fileName));
    if (!snapshot) continue;
    lessons.push(...summarizeRejectedSnapshot(snapshot));
  }

  if (approvalFiles.length > 0) {
    const outcomes = (
      await Promise.all(
        approvalFiles.map((fileName) => readJsonOrNull<ApprovalOutcomeRecord>(resolve(approvalsDir, fileName)))
      )
    ).filter((entry): entry is ApprovalOutcomeRecord => Boolean(entry?.recordedAt));
    const byDate = new Map<string, ApprovalOutcomeRecord[]>();
    for (const outcome of outcomes) {
      const reportDate = outcome.recordedAt.slice(0, 10);
      byDate.set(reportDate, [...(byDate.get(reportDate) ?? []), outcome]);
    }
    for (const [reportDate, records] of [...byDate.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
      lessons.push(...summarizeApprovalOutcomes(reportDate, records));
    }
  }

  const uniqueLessons = dedupeLessons(lessons);
  const snapshotMemory: SnapshotMemory = {
    generatedAt: new Date().toISOString(),
    sourceFiles,
    lessonCount: uniqueLessons.length,
    lessons: uniqueLessons
  };

  const outputPath = getSnapshotMemoryPath(root);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshotMemory, null, 2)}\n`, "utf8");
  return snapshotMemory;
}

export async function loadSnapshotMemory(baseDir?: string): Promise<SnapshotMemory> {
  const root = resolve(baseDir ?? process.cwd());
  const outputPath = getSnapshotMemoryPath(root);

  if (!existsSync(outputPath)) {
    return refreshSnapshotMemory(root);
  }

  try {
    return JSON.parse(await readFile(outputPath, "utf8")) as SnapshotMemory;
  } catch {
    return refreshSnapshotMemory(root);
  }
}
