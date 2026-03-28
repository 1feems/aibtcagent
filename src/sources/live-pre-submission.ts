import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { PreSubmissionRawInput } from "../intelligence/pre-submission.js";
import { loadTrainingMemory } from "../learning/index.js";

const API_BASE = "https://aibtc.news/api";

interface ApprovedSignal {
  beat?: string;
  beat_slug?: string;
}

async function fetchRecentApprovals(): Promise<ApprovedSignal[]> {
  try {
    const url = `${API_BASE}/signals?status=approved&limit=50`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as unknown;
    return Array.isArray(data)
      ? (data as ApprovedSignal[])
      : Array.isArray((data as Record<string, unknown>)?.signals)
        ? ((data as Record<string, unknown[]>).signals as ApprovedSignal[])
        : [];
  } catch {
    return [];
  }
}

function buildBeatSaturationNote(approvals: ApprovedSignal[]): string {
  const counts = new Map<string, number>();
  for (const signal of approvals) {
    const beat = signal.beat ?? signal.beat_slug ?? "unknown";
    counts.set(beat, (counts.get(beat) ?? 0) + 1);
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([beat, count]) => `${beat}: ${count}`)
    .join(", ");
  return sorted.length > 0
    ? `Recent approval counts by beat — ${sorted}`
    : "Beat saturation data unavailable";
}

export async function buildLivePreSubmission(now: string): Promise<string> {
  const [approvals, trainingMemory] = await Promise.all([
    fetchRecentApprovals(),
    loadTrainingMemory()
  ]);
  const beatNote = buildBeatSaturationNote(approvals);
  const trainingWinNote = trainingMemory.winningTags[0]
    ? `Historical brief winners frequently carry the tag "${trainingMemory.winningTags[0].tag}" (${trainingMemory.winningTags[0].count} examples).`
    : "Historical brief-winning tags unavailable";
  const trainingRejectNote = trainingMemory.rejectionTags[0]
    ? `Historical rejects frequently carry the tag "${trainingMemory.rejectionTags[0].tag}" (${trainingMemory.rejectionTags[0].count} examples).`
    : "Historical rejection tags unavailable";
  const trainingHeadlineNote = trainingMemory.winningHeadlinePatterns[0]
    ? `Historical winning headline pattern: ${trainingMemory.winningHeadlinePatterns[0].pattern} (${trainingMemory.winningHeadlinePatterns[0].count}).`
    : "Historical winning headline patterns unavailable";

  const raw: PreSubmissionRawInput = {
    dailyBriefChecked: approvals.length > 0,
    activityFeedChecked: true,
    leaderboardChecked: false,
    reputationChecked: false,
    inboxChecked: false,
    agentStatusChecked: false,
    notes: [
      beatNote,
      trainingWinNote,
      trainingRejectNote,
      trainingHeadlineNote,
      `Checked at ${now} via automated fetch-and-run.`
    ],
    checkedAt: now
  };

  const date = now.slice(0, 10);
  const filePath = resolve(
    process.cwd(),
    `data/live-inputs/pre-submission-${date}-auto.json`
  );
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(raw, null, 2) + "\n", "utf8");
  return filePath;
}
