import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EditorMemory, SubmittedSignal } from "../types/index.js";

const API_BASE = "https://aibtc.news/api";
const EDITOR_MEMORY_PATH = "data/state/editor-memory.json";

// ── helpers ───────────────────────────────────────────────────────────────────

function parseSignalArray(data: unknown): SubmittedSignal[] {
  if (Array.isArray(data)) return data as SubmittedSignal[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj?.signals)) return obj.signals as SubmittedSignal[];
  return [];
}

function normalizeSignal(raw: Record<string, unknown>): SubmittedSignal {
  const sources: Array<{ url: string; title?: string }> = Array.isArray(raw.sources)
    ? (raw.sources as Array<{ url?: string; title?: string }>).map((s) => ({
        url: s?.url ?? "",
        title: s?.title
      }))
    : [];

  return {
    id: String(raw.id ?? raw.signal_id ?? raw.signalId ?? ""),
    beat: String(raw.beat ?? raw.beat_slug ?? ""),
    beat_slug: raw.beat_slug !== undefined ? String(raw.beat_slug) : undefined,
    status: String(raw.status ?? "submitted"),
    headline: String(raw.headline ?? ""),
    analysis: String(raw.analysis ?? raw.body ?? raw.content ?? ""),
    sources,
    correspondent: String(raw.correspondent ?? raw.agent ?? raw.author ?? ""),
    submitted_at: String(raw.submitted_at ?? raw.created_at ?? raw.submittedAt ?? ""),
    created_at: raw.created_at !== undefined ? String(raw.created_at) : undefined
  };
}

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

// ── public API ────────────────────────────────────────────────────────────────

export async function fetchSubmittedSignals(date: string): Promise<SubmittedSignal[]> {
  const memory = await readEditorMemory();
  const reviewedIds = new Set(memory.reviewed.map((r) => r.signal_id));

  let rawSignals: SubmittedSignal[] = [];
  try {
    const url = `${API_BASE}/signals?beat=infrastructure&status=submitted`;
    process.stdout.write(`[editor-fetch] GET ${url}\n`);
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      process.stderr.write(`[editor-fetch] API ${response.status}: ${response.statusText}\n`);
      return [];
    }
    rawSignals = parseSignalArray(await response.json() as unknown).map((s) =>
      normalizeSignal(s as unknown as Record<string, unknown>)
    );
  } catch (err) {
    process.stderr.write(`[editor-fetch] fetch failed: ${(err as Error).message}\n`);
    return [];
  }

  const unreviewed = rawSignals.filter((s) => !reviewedIds.has(s.id));
  process.stdout.write(
    `[editor-fetch] ${rawSignals.length} submitted, ${unreviewed.length} unreviewed\n`
  );

  const outPath = resolve(process.cwd(), `data/editor/fetched/${date}.json`);
  await mkdir(resolve(process.cwd(), "data/editor/fetched"), { recursive: true });
  await writeFile(outPath, JSON.stringify(unreviewed, null, 2) + "\n", "utf8");
  process.stdout.write(`[editor-fetch] wrote ${outPath}\n`);

  return unreviewed;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("fetch-signals.js")) {
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  fetchSubmittedSignals(date).then((signals) => {
    process.stdout.write(`[editor-fetch] done — ${signals.length} signal(s) to review\n`);
  }).catch((err: unknown) => {
    process.stderr.write(`[editor-fetch] fatal: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
