// P29 — Cap-blocked resubmission queue
// Surfaces signals that were approved but missed the brief due to beat cap
// (not quality failures). These are top resubmission candidates next cycle.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FiledSignalRecord } from "./state.js";

interface FiledSignalsState {
  filedSignals: FiledSignalRecord[];
}

const BEAT_CAP_THRESHOLD = 4; // 4+ approved on same beat+date = likely cap-blocked

// ── Cap detection ─────────────────────────────────────────────────────────────

function detectCapBlocked(records: FiledSignalRecord[]): FiledSignalRecord[] {
  // Group approved-not-brief signals by beat + date
  const approvedNotBrief = records.filter((r) => (r.approved || r.brief_included !== undefined) && !r.brief_included);

  const beatDateCounts = new Map<string, number>();
  for (const r of records) {
    if (!r.beat || !r.filedAt) continue;
    const date = r.filedAt.slice(0, 10);
    const key = `${r.beat}::${date}`;
    const current = beatDateCounts.get(key) ?? 0;
    beatDateCounts.set(key, current + 1);
  }

  return approvedNotBrief.filter((r) => {
    if (!r.beat || !r.filedAt) return false;
    const date = r.filedAt.slice(0, 10);
    const key = `${r.beat}::${date}`;
    const sameDay = beatDateCounts.get(key) ?? 0;
    return sameDay >= BEAT_CAP_THRESHOLD;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CapBlockedEntry {
  signalId: string;
  headline: string | null;
  beat: string | null;
  filedAt: string | null;
  isExplicitlyFlagged: boolean;  // cap_blocked field was set by checker
}

export async function getCapBlockedQueue(baseDir?: string): Promise<CapBlockedEntry[]> {
  const path = resolve(baseDir ?? process.cwd(), "data/state/filed-signals.json");
  let records: FiledSignalRecord[] = [];
  try {
    const state = JSON.parse(await readFile(path, "utf8")) as FiledSignalsState;
    records = state.filedSignals ?? [];
  } catch { return []; }

  // Explicit cap_blocked flag first, then infer from saturation
  const explicit = records.filter((r) => r.cap_blocked === true);
  const inferred = detectCapBlocked(records).filter(
    (r) => !explicit.some((e) => e.signalId === r.signalId)
  );

  const all: CapBlockedEntry[] = [
    ...explicit.map((r) => ({
      signalId: r.signalId,
      headline: r.headline,
      beat: r.beat,
      filedAt: r.filedAt,
      isExplicitlyFlagged: true
    })),
    ...inferred.map((r) => ({
      signalId: r.signalId,
      headline: r.headline,
      beat: r.beat,
      filedAt: r.filedAt,
      isExplicitlyFlagged: false
    }))
  ];

  // Sort: most recent first (best resubmission candidates)
  return all.sort((a, b) => {
    const ta = a.filedAt ? Date.parse(a.filedAt) : 0;
    const tb = b.filedAt ? Date.parse(b.filedAt) : 0;
    return tb - ta;
  });
}

export function formatCapBlockedSection(entries: CapBlockedEntry[]): string {
  if (entries.length === 0) {
    return "- none — no cap-blocked candidates from prior cycles";
  }
  return entries.slice(0, 5).map((e) => {
    const flagged = e.isExplicitlyFlagged ? "[confirmed cap-blocked]" : "[inferred cap-blocked]";
    const date = e.filedAt?.slice(0, 10) ?? "unknown date";
    return `- ${e.signalId} ${flagged}\n  beat: ${e.beat ?? "unknown"} | filed: ${date}\n  headline: ${e.headline ?? "(missing)"}`;
  }).join("\n");
}
