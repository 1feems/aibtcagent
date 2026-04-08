/**
 * migrate-signal-history.ts
 *
 * One-time bootstrap: reads data/state/filed-signals.json and all
 * data/outcomes/approvals/*.json, merges them into the canonical
 * data/state/signal-history.json format.
 *
 * Safe to re-run: existing signal-history.json entries are preserved;
 * only missing signalIds are inserted.
 *
 * Usage:
 *   npx tsx src/filing/migrate-signal-history.ts
 */

import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  readSignalHistory,
  toStoryShape,
  type FeedbackLabel,
  type SignalHistory,
  type SignalHistoryEntry,
  type SignalOutcome
} from "./signal-history.js";
import { getPacificReportDate } from "../utils/report-date.js";

const ROOT = process.cwd();

// ── read helpers ──────────────────────────────────────────────────────────────

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

interface LegacyFiledSignal {
  signalId: string;
  candidateId: string | null;
  headline: string | null;
  beat: string | null;
  filedAt: string | null;
  resolved: boolean;
  outcome?: string;
  approved?: boolean;
  brief_included?: boolean;
  cap_blocked?: boolean;
  satsEarned?: number;
}

interface LegacyFiledSignalsState {
  filedSignals: LegacyFiledSignal[];
}

interface LegacyOutcomeRecord {
  kind: "approval_outcome";
  recordedAt: string;
  signalId: string;
  candidateId: string | null;
  approved: boolean;
  published: boolean;
  success: boolean;
  failureMode: string | null;
  status: string;
  note: string | null;
  learningWhy: string | null;
  feedbackLabels: string[];
}

// ── outcome normalisation ─────────────────────────────────────────────────────

function normaliseOutcome(filed: LegacyFiledSignal, legacy: LegacyOutcomeRecord | null): SignalOutcome {
  // Priority order: explicit fields on the filed record, then outcome record
  if (filed.brief_included) return "brief_included";
  if (filed.cap_blocked) return "cap_blocked";

  if (legacy) {
    if (legacy.published) return "brief_included";
    if (legacy.approved && !legacy.published) return "approved";
    if (legacy.status === "rejected") return "rejected";
    if (legacy.status === "submitted") return "pending";
  }

  // fall back to the string outcome field written by some older code paths
  if (filed.outcome === "brief_included") return "brief_included";
  if (filed.outcome === "approved") return "approved";
  if (filed.outcome === "denied") return "rejected";

  if (filed.approved === true) return "approved";
  if (filed.resolved && !filed.approved) return "unknown";

  return "pending";
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // load existing history so we don't duplicate entries
  const history = await readSignalHistory(ROOT);
  const existingIds = new Set(history.entries.map((e) => e.signalId));

  // load filed-signals.json
  const stateRaw = await readJson<LegacyFiledSignalsState>(
    resolve(ROOT, "data/state/filed-signals.json")
  );
  if (!stateRaw) {
    process.stderr.write("[migrate] filed-signals.json not found — nothing to migrate\n");
    return;
  }

  // index all outcome records by signalId
  const outcomesDir = resolve(ROOT, "data/outcomes/approvals");
  const outcomeMap = new Map<string, LegacyOutcomeRecord>();
  try {
    const files = await readdir(outcomesDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const record = await readJson<LegacyOutcomeRecord>(resolve(outcomesDir, file));
      if (record?.signalId) outcomeMap.set(record.signalId, record);
    }
  } catch {
    // outcomes dir may not exist yet
  }

  const toInsert: SignalHistoryEntry[] = [];

  for (const filed of stateRaw.filedSignals) {
    const { signalId } = filed;
    if (!signalId || existingIds.has(signalId)) continue;

    const legacy = outcomeMap.get(signalId) ?? null;
    const outcome = normaliseOutcome(filed, legacy);
    const resolvedAt =
      legacy?.recordedAt ??
      (outcome !== "pending" && outcome !== "unknown" ? new Date().toISOString() : null);

    const reportDate = filed.filedAt
      ? getPacificReportDate(filed.filedAt)
      : "unknown";

    const entry: SignalHistoryEntry = {
      signalId,
      candidateId: filed.candidateId,
      headline: filed.headline,
      beat: filed.beat,
      storyShape: toStoryShape(filed.headline),
      filedAt: filed.filedAt,
      reportDate,
      outcome,
      resolvedAt,
      feedbackLabels: (legacy?.feedbackLabels ?? []) as FeedbackLabel[],
      note: legacy?.note ?? null,
      satsEarned: filed.satsEarned ?? null
    };

    toInsert.push(entry);
  }

  if (toInsert.length === 0) {
    process.stdout.write("[migrate] signal-history.json is already up to date\n");
    return;
  }

  // prepend new entries (newest first) then write
  const { writeFile, mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");

  const outputPath = resolve(ROOT, "data/state/signal-history.json");
  const merged: SignalHistory = {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: [...toInsert.reverse(), ...history.entries]  // oldest first within new batch so newest end up at top
  };
  // sort newest filedAt first
  merged.entries.sort((a, b) => {
    const ta = a.filedAt ? new Date(a.filedAt).getTime() : 0;
    const tb = b.filedAt ? new Date(b.filedAt).getTime() : 0;
    return tb - ta;
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(merged, null, 2) + "\n", "utf8");

  process.stdout.write(
    `[migrate] wrote ${toInsert.length} new entr${toInsert.length === 1 ? "y" : "ies"} to signal-history.json\n`
  );

  // print summary
  const outcomes: Record<string, number> = {};
  for (const e of merged.entries) {
    outcomes[e.outcome] = (outcomes[e.outcome] ?? 0) + 1;
  }
  process.stdout.write(`[migrate] outcome summary: ${JSON.stringify(outcomes, null, 0)}\n`);
}

const { fileURLToPath } = await import("node:url");
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}

export { main as migrateSignalHistory };
