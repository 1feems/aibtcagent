import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EditorMemory, SpotCheckResult } from "../types/index.js";
import { incrementApprovedCorrections } from "../filing/state.js";

const API_BASE = "https://aibtc.news/api";
const EDITOR_MEMORY_PATH = "data/state/editor-memory.json";
const FETCH_TIMEOUT_MS = 10000;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CorrectionRecord {
  id?: string;
  signal_id?: string;
  signalId?: string;
  type?: string;
  status?: string;
  publisher_decision?: string;
  publisherDecision?: string;
  reviewed_at?: string | null;
  reviewedAt?: string | null;
  spot_checked?: boolean;
  spotChecked?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readEditorMemory(): Promise<EditorMemory> {
  try {
    const path = resolve(process.cwd(), EDITOR_MEMORY_PATH);
    return JSON.parse(await readFile(path, "utf8")) as EditorMemory;
  } catch {
    return {
      reviewed: [],
      stats: { total: 0, approve: 0, revise: 0, reject: 0, spotCheckPass: 0, spotCheckFail: 0, spotCheckPending: 0 },
      correspondentPatterns: {},
      beatLessons: {},
      lastUpdated: new Date().toISOString()
    };
  }
}

async function writeEditorMemory(memory: EditorMemory): Promise<void> {
  const path = resolve(process.cwd(), EDITOR_MEMORY_PATH);
  await writeFile(path, JSON.stringify(memory, null, 2) + "\n", "utf8");
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
  } finally {
    clearTimeout(id);
  }
}

function parseSpotCheckResult(correction: CorrectionRecord): SpotCheckResult {
  const decision = (correction.publisher_decision ?? correction.publisherDecision ?? "").toLowerCase();
  const status = (correction.status ?? "").toLowerCase();

  if (decision === "pass" || status === "approved") return "pass";
  if (decision === "fail" || status === "rejected" || status === "overturned") return "fail";
  return "pending";
}

function computePassRate(memory: EditorMemory): number {
  const total = memory.stats.spotCheckPass + memory.stats.spotCheckFail;
  if (total === 0) return 1.0;
  return memory.stats.spotCheckPass / total;
}

// ── Poll corrections endpoint for a single signal ─────────────────────────────

async function pollSignalCorrections(signalId: string): Promise<SpotCheckResult> {
  const url = `${API_BASE}/signals/${signalId}/corrections`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      process.stderr.write(`[spot-check] corrections API ${response.status} for ${signalId}\n`);
      return "pending";
    }

    const data = await response.json() as unknown;
    const corrections: CorrectionRecord[] = Array.isArray(data)
      ? (data as CorrectionRecord[])
      : Array.isArray((data as Record<string, unknown>)?.corrections)
        ? ((data as Record<string, unknown[]>).corrections as CorrectionRecord[])
        : [];

    // Find the editorial_review correction we submitted
    const ourCorrection = corrections.find(
      (c) => c.type === "editorial_review"
    );

    if (!ourCorrection) return "pending";
    return parseSpotCheckResult(ourCorrection);
  } catch (err) {
    process.stderr.write(`[spot-check] fetch error for ${signalId}: ${(err as Error).message}\n`);
    return "pending";
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface PollResult {
  signalId: string;
  previous: SpotCheckResult;
  current: SpotCheckResult;
  changed: boolean;
}

export async function pollSpotCheckOutcomes(): Promise<PollResult[]> {
  const memory = await readEditorMemory();
  const pending = memory.reviewed.filter((r) => r.spot_check_result === "pending");

  if (pending.length === 0) {
    process.stdout.write("[spot-check] no pending spot-checks\n");
    return [];
  }

  process.stdout.write(`[spot-check] polling ${pending.length} pending signal(s)\n`);
  const results: PollResult[] = [];

  for (const entry of pending) {
    const current = await pollSignalCorrections(entry.signal_id);
    const changed = current !== entry.spot_check_result;

    if (changed) {
      const previous = entry.spot_check_result;
      entry.spot_check_result = current;

      // Update aggregate stats
      memory.stats.spotCheckPending = Math.max(0, memory.stats.spotCheckPending - 1);
      if (current === "pass") {
        memory.stats.spotCheckPass++;
        // P35: approved corrections earn 15 leaderboard points — track in filed-signals.json
        const total = await incrementApprovedCorrections().catch(() => null);
        process.stdout.write(
          `[spot-check] correction approved — total approved_corrections: ${total ?? "unknown"}\n`
        );
      } else if (current === "fail") memory.stats.spotCheckFail++;
      else memory.stats.spotCheckPending++;

      process.stdout.write(
        `[spot-check] ${entry.signal_id}: ${previous} → ${current}\n`
      );
      results.push({ signalId: entry.signal_id, previous, current, changed: true });
    } else {
      results.push({ signalId: entry.signal_id, previous: current, current, changed: false });
    }
  }

  memory.lastUpdated = new Date().toISOString();
  await writeEditorMemory(memory);

  const changed = results.filter((r) => r.changed).length;
  const passRate = computePassRate(memory);
  process.stdout.write(
    `[spot-check] done — ${changed} updated, pass rate: ${Math.round(passRate * 100)}%\n`
  );

  return results;
}

export async function getSpotCheckPassRate(): Promise<number> {
  const memory = await readEditorMemory();
  return computePassRate(memory);
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("spot-check-poller.js")) {
  pollSpotCheckOutcomes().then((results) => {
    const changed = results.filter((r) => r.changed);
    process.stdout.write(
      `[spot-check] ${changed.length}/${results.length} updated\n`
    );
  }).catch((err: unknown) => {
    process.stderr.write(`[spot-check] fatal: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
