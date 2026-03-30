import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { markCandidateOutcome } from "../filing/candidate-history.js";

const BTC_ADDRESS =
  process.env.AIBTC_BITCOIN_ADDRESS ?? "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv";
const API_BASE = "https://aibtc.news/api";
const STATE_PATH = "data/state/filed-signals.json";

// ── types ─────────────────────────────────────────────────────────────────────

interface FiledSignal {
  signalId: string;
  candidateId: string | null;
  headline: string | null;
  beat: string | null;
  filedAt: string | null;
  resolved: boolean;
}

interface FiledSignalsState {
  filedSignals: FiledSignal[];
}

interface ApiSignal {
  id?: string;
  signal_id?: string;
  signalId?: string;
  headline?: string;
  status?: string;
  brief_included_at?: string | null;
  briefIncludedAt?: string | null;
  published_at?: string | null;
  publishedAt?: string | null;
}

interface OutcomeRecord {
  kind: "approval_outcome";
  recordedAt: string;
  signalId: string;
  candidateId: string | null;
  approved: boolean;
  published: boolean;
  success: boolean;
  failureMode: "not_in_brief" | "rejected" | "pending" | "unknown" | null;
  status: "approved" | "rejected" | "submitted" | "unknown";
  note: string | null;
  learningWhy: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function extractId(signal: ApiSignal): string | null {
  return signal.id ?? signal.signal_id ?? signal.signalId ?? null;
}

function isPublished(signal: ApiSignal): boolean {
  return Boolean(
    signal.brief_included_at ?? signal.briefIncludedAt ??
    signal.published_at ?? signal.publishedAt
  );
}

async function fetchFeed(status: string): Promise<Map<string, ApiSignal>> {
  const url = `${API_BASE}/signals?status=${status}&agent=${encodeURIComponent(BTC_ADDRESS)}&limit=200`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      process.stderr.write(`[checker] ${status} feed returned ${response.status}\n`);
      return new Map();
    }
    const data = (await response.json()) as unknown;
    const items: ApiSignal[] = Array.isArray(data)
      ? (data as ApiSignal[])
      : Array.isArray((data as Record<string, unknown>)?.signals)
        ? ((data as Record<string, unknown[]>).signals as ApiSignal[])
        : [];

    const byId = new Map<string, ApiSignal>();
    for (const item of items) {
      const id = extractId(item);
      if (id) byId.set(id, item);
    }
    return byId;
  } catch (error) {
    process.stderr.write(`[checker] failed to fetch ${status} feed: ${(error as Error).message}\n`);
    return new Map();
  }
}

async function readState(): Promise<FiledSignalsState> {
  const absolutePath = resolve(process.cwd(), STATE_PATH);
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw) as FiledSignalsState;
}

async function writeState(state: FiledSignalsState): Promise<void> {
  const absolutePath = resolve(process.cwd(), STATE_PATH);
  await writeFile(absolutePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function writeOutcome(outcome: OutcomeRecord): Promise<void> {
  const safeId = outcome.signalId.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const filePath = resolve(
    process.cwd(),
    `data/outcomes/approvals/${safeId}.json`
  );
  await mkdir(dirname(filePath), { recursive: true });
  // never overwrite — if file exists, skip
  try {
    await readFile(filePath, "utf8");
    return; // already recorded
  } catch {
    // file doesn't exist, safe to write
  }
  await writeFile(filePath, JSON.stringify(outcome, null, 2) + "\n", "utf8");
}

// ── main ──────────────────────────────────────────────────────────────────────

export async function runOutcomeChecker(): Promise<void> {
  const state = await readState();
  const unresolved = state.filedSignals.filter((s) => !s.resolved);

  if (unresolved.length === 0) {
    process.stdout.write("[checker] no unresolved signals — nothing to do\n");
    return;
  }

  process.stdout.write(`[checker] checking ${unresolved.length} unresolved signal(s) for ${BTC_ADDRESS}\n`);

  const [approvedFeed, rejectedFeed, submittedFeed, briefIncludedFeed] = await Promise.all([
    fetchFeed("approved"),
    fetchFeed("rejected"),
    fetchFeed("submitted"),
    fetchFeed("brief_included")
  ]);

  const now = new Date().toISOString();
  let newOutcomes = 0;

  for (const filed of unresolved) {
    const { signalId } = filed;

    let status: OutcomeRecord["status"] = "unknown";
    let apiSignal: ApiSignal | undefined;

    if (briefIncludedFeed.has(signalId)) {
      status = "approved";
      apiSignal = briefIncludedFeed.get(signalId);
    } else if (approvedFeed.has(signalId)) {
      status = "approved";
      apiSignal = approvedFeed.get(signalId);
    } else if (rejectedFeed.has(signalId)) {
      status = "rejected";
      apiSignal = rejectedFeed.get(signalId);
    } else if (submittedFeed.has(signalId)) {
      status = "submitted";
      apiSignal = submittedFeed.get(signalId);
    }

    if (status === "unknown") {
      process.stdout.write(`[checker] ${signalId} — not found in any feed (still unknown)\n`);
      continue;
    }

    const published = briefIncludedFeed.has(signalId) || (status === "approved" && apiSignal ? isPublished(apiSignal) : false);
    const success = status === "approved" && published;
    const failureMode =
      status === "approved" && !published
        ? "not_in_brief"
        : status === "rejected"
          ? "rejected"
          : status === "submitted"
            ? "pending"
            : null;
    const note =
      status === "approved"
        ? published
          ? "approved and published in compiled brief"
          : "approved but not published in In Brief — failed outcome for the real KPI"
        : status === "rejected"
          ? "rejected by editorial review"
          : "still in submitted queue";
    const learningWhy =
      status === "approved" && !published
        ? "Approved, but no live evidence of In Brief yet. Review the winning same-day beat story and note whether this lost on breadth, framing, timing, or headline strength."
        : status === "approved" && published
          ? "Converted into In Brief. Study what made this stronger than same-day alternatives."
          : status === "rejected"
            ? "Rejected by editorial review. Use publisher feedback to identify the failure mode before filing a similar story again."
            : "Still pending. Re-check live feeds before drawing conclusions.";

    const outcome: OutcomeRecord = {
      kind: "approval_outcome",
      recordedAt: now,
      signalId,
      candidateId: filed.candidateId,
      approved: status === "approved",
      published,
      success,
      failureMode,
      status,
      note,
      learningWhy
    };

    await writeOutcome(outcome);
    if (filed.candidateId) {
      await markCandidateOutcome(
        filed.candidateId,
        {
          status,
          approved: status === "approved",
          publishedInBrief: published,
          success,
          failureMode,
          recordedAt: now,
          note,
          learningWhy
        }
      );
    }
    process.stdout.write(`[checker] ${signalId} — ${status}${published ? " + published" : ""}\n`);
    newOutcomes += 1;

    // mark resolved only if outcome is terminal (approved or rejected)
    if (status === "approved" || status === "rejected") {
      filed.resolved = true;
    }
  }

  await writeState(state);
  process.stdout.write(`[checker] done — ${newOutcomes} new outcome(s) recorded\n`);
}

async function main(): Promise<void> {
  await runOutcomeChecker();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const { fileURLToPath } = await import("node:url");
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
