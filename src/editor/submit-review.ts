import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EditorAnnotation, EditorMemory, EditorMemoryEntry } from "../types/index.js";

const API_BASE = "https://aibtc.news/api";
const EDITOR_MEMORY_PATH = "data/state/editor-memory.json";

// ── helpers ───────────────────────────────────────────────────────────────────

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

function buildApiPayload(annotation: EditorAnnotation): Record<string, unknown> {
  return {
    type: "editorial_review",
    signal_id: annotation.signal_id,
    correspondent: annotation.correspondent,
    score: annotation.score,
    factcheck: annotation.factcheck,
    edit_suggestions: annotation.edit_suggestions,
    beat_relevance: annotation.beat_relevance,
    recommendation: annotation.recommendation,
    feedback_for_correspondent: annotation.feedback_for_correspondent
  };
}

function updateCorrespondentPatterns(
  memory: EditorMemory,
  annotation: EditorAnnotation
): void {
  const addr = annotation.correspondent;
  if (!addr) return;

  const existing = memory.correspondentPatterns[addr] ?? {
    address: addr,
    reviewCount: 0,
    errorTypes: []
  };

  existing.reviewCount++;

  for (const flag of annotation.factcheck.flagged) {
    if (flag.startsWith("cap:") || flag.startsWith("penalty:")) continue;
    const errorKey = flag.split(":")[0]?.trim() ?? flag.slice(0, 40);
    if (!existing.errorTypes.includes(errorKey)) {
      existing.errorTypes.push(errorKey);
    }
  }

  memory.correspondentPatterns[addr] = existing;
}

// ── public API ────────────────────────────────────────────────────────────────

export interface SubmitResult {
  signalId: string;
  submitted: boolean;
  skipped: boolean;
  skipReason?: string;
  httpStatus?: number;
  error?: string;
}

export async function submitReview(
  annotation: EditorAnnotation,
  helperMode: boolean = false
): Promise<SubmitResult> {
  const memory = await readEditorMemory();
  const alreadyReviewed = memory.reviewed.some((r) => r.signal_id === annotation.signal_id);

  if (alreadyReviewed) {
    process.stdout.write(`[editor-submit] skipping ${annotation.signal_id} — already reviewed\n`);
    return { signalId: annotation.signal_id, submitted: false, skipped: true, skipReason: "already_reviewed" };
  }

  const payload = buildApiPayload(annotation);

  let submitted = false;
  let httpStatus: number | undefined;
  let errorMsg: string | undefined;

  if (!helperMode) {
    const url = `${API_BASE}/signals/${annotation.signal_id}/corrections`;
    process.stdout.write(`[editor-submit] POST ${url}\n`);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });
      httpStatus = response.status;
      if (response.ok) {
        submitted = true;
        process.stdout.write(`[editor-submit] ${annotation.signal_id} → ${response.status}\n`);
      } else {
        const body = await response.text().catch(() => "");
        errorMsg = `HTTP ${response.status}: ${body.slice(0, 200)}`;
        process.stderr.write(`[editor-submit] ${annotation.signal_id} failed: ${errorMsg}\n`);
      }
    } catch (err) {
      errorMsg = (err as Error).message;
      process.stderr.write(`[editor-submit] ${annotation.signal_id} error: ${errorMsg}\n`);
    }
  } else {
    // Helper mode: queue for human-assisted submission (BIP-137 flow)
    process.stdout.write(`[editor-submit] helper mode — queued ${annotation.signal_id} for human-assisted POST\n`);
    submitted = true; // treated as queued
  }

  // Always record into editor-memory regardless of submission outcome to prevent double-review
  const entry: EditorMemoryEntry = {
    signal_id: annotation.signal_id,
    headline: "",
    correspondent: annotation.correspondent,
    score: annotation.score,
    recommendation: annotation.recommendation,
    confidence: annotation.confidence,
    submitted_at: annotation.annotatedAt,
    spot_check_result: "pending",
    beat_relevance: annotation.beat_relevance
  };

  memory.reviewed.push(entry);
  memory.stats.total++;
  memory.stats[annotation.recommendation]++;
  memory.stats.spotCheckPending++;
  memory.lastUpdated = annotation.annotatedAt;
  updateCorrespondentPatterns(memory, annotation);
  await writeEditorMemory(memory);

  return { signalId: annotation.signal_id, submitted, skipped: false, httpStatus, error: errorMsg };
}

export async function submitReviews(
  annotations: EditorAnnotation[],
  date: string,
  helperMode: boolean = false
): Promise<SubmitResult[]> {
  const results: SubmitResult[] = [];

  for (const annotation of annotations) {
    const result = await submitReview(annotation, helperMode);
    results.push(result);
  }

  // Write submitted annotations to daily file
  const submitted = annotations.filter((a) =>
    results.find((r) => r.signalId === a.signal_id && r.submitted && !r.skipped)
  );

  if (submitted.length > 0) {
    const outPath = resolve(process.cwd(), `data/editor/submitted/${date}.json`);
    await mkdir(resolve(process.cwd(), "data/editor/submitted"), { recursive: true });
    let existing: EditorAnnotation[] = [];
    try {
      existing = JSON.parse(await readFile(outPath, "utf8")) as EditorAnnotation[];
    } catch { /* first write */ }
    const merged = [...existing, ...submitted];
    await writeFile(outPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
    process.stdout.write(`[editor-submit] wrote ${outPath} (${merged.length} total)\n`);
  }

  const submittedCount = results.filter((r) => r.submitted && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  process.stdout.write(
    `[editor-submit] done — ${submittedCount} submitted, ${skippedCount} skipped\n`
  );

  return results;
}
