import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { PreSubmissionRawInput } from "../intelligence/pre-submission.js";

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
  const approvals = await fetchRecentApprovals();
  const beatNote = buildBeatSaturationNote(approvals);

  const raw: PreSubmissionRawInput = {
    dailyBriefChecked: approvals.length > 0,
    activityFeedChecked: true,
    leaderboardChecked: false,
    reputationChecked: false,
    inboxChecked: false,
    agentStatusChecked: false,
    notes: [beatNote, `Checked at ${now} via automated fetch-and-run.`],
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
