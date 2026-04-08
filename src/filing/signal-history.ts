/**
 * signal-history.ts
 *
 * Canonical single-file store for every signal filed, its content, and its outcome.
 *
 * Location: data/state/signal-history.json
 *
 * One entry per signalId. Append on filing, resolve on outcome.
 * Queryable by reportDate for "what did we send on April 1?".
 * storyShape enables near-duplicate detection before filing.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// ── types ────────────────────────────────────────────────────────────────────

export type SignalOutcome =
  | "pending"        // filed, not yet reviewed
  | "brief_included" // won — appeared in the brief
  | "approved"       // approved by publisher but did not make the brief
  | "rejected"       // rejected by publisher
  | "cap_blocked"    // approved but beat cap prevented brief inclusion
  | "unknown";       // resolved without clear status

export type FeedbackLabel =
  | "brief_included"
  | "approved_not_in_brief"
  | "headline_truncated"
  | "body_missing"
  | "duplicate_story_shape"
  | "missing_timestamped_evidence"
  | "beat_cap"
  | "publisher_feedback_required"
  | "repair_and_resubmit"
  | "too_early_unshipped_code"
  | "pending_outcome"
  | "rejected_editorial"
  | "q1_fail_implied_agent_angle"
  | "q3_fail_not_inscribable"
  | "q4_fail_no_operator_consequence"
  | "source_fail_internal_only"
  | "disclosure_fail_vague";

export interface SignalHistoryEntry {
  /** UUID returned by the news API */
  signalId: string;
  /** internal candidate/draft id used before filing */
  candidateId: string | null;
  /** headline as filed */
  headline: string | null;
  /** beat slug, e.g. "infrastructure" */
  beat: string | null;
  /**
   * Normalised headline for near-duplicate detection.
   * Lowercase, stripped of punctuation/stop-words, hyphen-joined.
   * Compare against existing entries before filing a similar story.
   */
  storyShape: string | null;
  /** ISO timestamp of filing */
  filedAt: string | null;
  /** YYYY-MM-DD Pacific date used to bucket daily signals */
  reportDate: string;
  /** Normalised outcome — the single source of truth for learning */
  outcome: SignalOutcome;
  /** ISO timestamp when outcome was recorded (null while pending) */
  resolvedAt: string | null;
  /** Publisher feedback labels attached to this signal */
  feedbackLabels: FeedbackLabel[];
  /** Human-readable reason or publisher note */
  note: string | null;
  /** Sats earned if brief_included */
  satsEarned: number | null;
}

export interface SignalHistory {
  version: 1;
  updatedAt: string;
  entries: SignalHistoryEntry[];
}

// ── stop words for storyShape ────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "so", "than", "that",
  "this", "it", "its", "into", "not", "no"
]);

export function toStoryShape(headline: string | null): string | null {
  if (!headline) return null;
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")   // strip punctuation
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .join("-");
}

// ── file path ────────────────────────────────────────────────────────────────

function resolveHistoryPath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/signal-history.json");
}

// ── validation ────────────────────────────────────────────────────────────────

/**
 * Returns true only for entries that represent a real filed signal:
 *   - signalId is a non-empty string (real API UUID, not null or placeholder)
 *   - filedAt is a non-empty string parseable as a datetime
 *
 * Entries that fail this check are placeholder/draft entries that were written
 * directly to the JSON file; they are stripped on read so they never pollute
 * duplicate detection, outcome tracking, or context-memory loading.
 */
function isFiledEntry(entry: unknown): entry is SignalHistoryEntry {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.signalId !== "string" || e.signalId.trim().length === 0) return false;
  if (typeof e.filedAt !== "string" || e.filedAt.trim().length === 0) return false;
  if (!Number.isFinite(Date.parse(e.filedAt as string))) return false;
  return true;
}

// ── read / write ─────────────────────────────────────────────────────────────

export async function readSignalHistory(baseDir?: string): Promise<SignalHistory> {
  const filePath = resolveHistoryPath(baseDir);
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as SignalHistory;
    // Strip invalid entries written directly to the file by models or scripts.
    // Only entries with a real signalId and a real filedAt belong here.
    const before = parsed.entries?.length ?? 0;
    const validEntries = (parsed.entries ?? []).filter(isFiledEntry);
    const stripped = before - validEntries.length;
    if (stripped > 0) {
      parsed.entries = validEntries;
      // Persist the cleaned version so the corrupt entries don't reappear.
      await saveSignalHistory(parsed, baseDir);
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
    }
    throw error;
  }
}

async function saveSignalHistory(history: SignalHistory, baseDir?: string): Promise<void> {
  const filePath = resolveHistoryPath(baseDir);
  history.updatedAt = new Date().toISOString();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(history, null, 2) + "\n", "utf8");
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Append a new pending entry when a signal is filed.
 * No-ops if the signalId already exists (idempotent).
 *
 * INVARIANT: signal-history.json is a record of FILED signals only.
 * Drafts, candidates, placeholders, and "probably good" entries must never
 * be written here.  This function enforces that contract at write time:
 *   - `signalId` must be a non-empty string (the real UUID from the news API).
 *   - `filedAt` must be a non-empty ISO-8601 datetime (the actual filing timestamp).
 * If either condition is not met the function throws rather than writing
 * a corrupt entry.
 */
export async function appendSignalHistory(
  entry: Omit<SignalHistoryEntry, "outcome" | "resolvedAt" | "feedbackLabels" | "note" | "satsEarned" | "storyShape"> & Partial<Pick<SignalHistoryEntry, "outcome" | "storyShape">>,
  baseDir?: string
): Promise<void> {
  // ── filing invariant guards ────────────────────────────────────────────────
  if (!entry.signalId || typeof entry.signalId !== "string" || entry.signalId.trim().length === 0) {
    throw new Error(
      `appendSignalHistory: signalId must be the real UUID returned by the news API — ` +
      `got ${JSON.stringify(entry.signalId)}. ` +
      `Candidates and drafts must not be written to signal-history.json.`
    );
  }

  if (!entry.filedAt || typeof entry.filedAt !== "string" || entry.filedAt.trim().length === 0) {
    throw new Error(
      `appendSignalHistory: filedAt must be a non-empty ISO-8601 datetime recording when the signal was filed — ` +
      `got ${JSON.stringify(entry.filedAt)}. ` +
      `Do not write an entry until the signal has actually been filed.`
    );
  }

  const parsedFiledAt = Date.parse(entry.filedAt.trim());
  if (!Number.isFinite(parsedFiledAt)) {
    throw new Error(
      `appendSignalHistory: filedAt "${entry.filedAt}" is not a valid datetime. ` +
      `Use the ISO-8601 UTC timestamp returned by the filing API response.`
    );
  }
  // ── end guards ─────────────────────────────────────────────────────────────

  const history = await readSignalHistory(baseDir);
  const exists = history.entries.some((e) => e.signalId === entry.signalId);
  if (exists) return;

  const newEntry: SignalHistoryEntry = {
    signalId: entry.signalId,
    candidateId: entry.candidateId,
    headline: entry.headline,
    beat: entry.beat,
    storyShape: entry.storyShape ?? toStoryShape(entry.headline),
    filedAt: entry.filedAt,
    reportDate: entry.reportDate,
    outcome: entry.outcome ?? "pending",
    resolvedAt: null,
    feedbackLabels: [],
    note: null,
    satsEarned: null
  };

  history.entries.unshift(newEntry); // newest first
  await saveSignalHistory(history, baseDir);
}

/**
 * Update the outcome of a filed signal.
 * Called by the outcome checker after polling the API.
 */
export async function resolveSignalHistory(
  signalId: string,
  update: {
    outcome: SignalOutcome;
    feedbackLabels?: FeedbackLabel[];
    note?: string | null;
    satsEarned?: number | null;
  },
  baseDir?: string
): Promise<void> {
  const history = await readSignalHistory(baseDir);
  const entry = history.entries.find((e) => e.signalId === signalId);
  if (!entry) return; // not in history yet — will be caught on next append

  entry.outcome = update.outcome;
  entry.resolvedAt = new Date().toISOString();
  if (update.feedbackLabels !== undefined) entry.feedbackLabels = update.feedbackLabels;
  if (update.note !== undefined) entry.note = update.note;
  if (update.satsEarned !== undefined) entry.satsEarned = update.satsEarned;

  await saveSignalHistory(history, baseDir);
}

// ── query helpers ─────────────────────────────────────────────────────────────

/** Return all entries for a given YYYY-MM-DD reportDate. */
export function queryByDate(history: SignalHistory, date: string): SignalHistoryEntry[] {
  return history.entries.filter((e) => e.reportDate === date);
}

/** Return entries with a given outcome. */
export function queryByOutcome(history: SignalHistory, outcome: SignalOutcome): SignalHistoryEntry[] {
  return history.entries.filter((e) => e.outcome === outcome);
}

/**
 * Check whether a sufficiently similar story has already been filed.
 * Returns the matching entry if found, null otherwise.
 * "Similar" = storyShape shares ≥ 60% of tokens.
 */
export function findDuplicateStory(
  history: SignalHistory,
  headline: string,
  options: { onlyResolved?: boolean } = {}
): SignalHistoryEntry | null {
  const candidateShape = toStoryShape(headline);
  if (!candidateShape) return null;
  const candidateTokens = new Set(candidateShape.split("-"));

  for (const entry of history.entries) {
    if (options.onlyResolved && entry.outcome === "pending") continue;
    if (!entry.storyShape) continue;

    const entryTokens = new Set(entry.storyShape.split("-"));
    const intersection = [...candidateTokens].filter((t) => entryTokens.has(t));
    const union = new Set([...candidateTokens, ...entryTokens]);
    const jaccard = intersection.length / union.size;

    if (jaccard >= 0.6) return entry;
  }
  return null;
}

/** Summary stats — useful for "what happened on April 1?" queries. */
export function summariseDate(history: SignalHistory, date: string): {
  date: string;
  filed: number;
  pending: number;
  brief_included: number;
  approved: number;
  rejected: number;
  cap_blocked: number;
  unknown: number;
  entries: SignalHistoryEntry[];
} {
  const entries = queryByDate(history, date);
  const count = (outcome: SignalOutcome) => entries.filter((e) => e.outcome === outcome).length;
  return {
    date,
    filed: entries.length,
    pending: count("pending"),
    brief_included: count("brief_included"),
    approved: count("approved"),
    rejected: count("rejected"),
    cap_blocked: count("cap_blocked"),
    unknown: count("unknown"),
    entries
  };
}
