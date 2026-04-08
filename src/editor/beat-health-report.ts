import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EditorAnnotation, EditorMemory } from "../types/index.js";

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

async function readSubmittedAnnotations(dates: string[]): Promise<EditorAnnotation[]> {
  const all: EditorAnnotation[] = [];
  for (const date of dates) {
    try {
      const path = resolve(process.cwd(), `data/editor/submitted/${date}.json`);
      const parsed = JSON.parse(await readFile(path, "utf8")) as EditorAnnotation[];
      all.push(...parsed);
    } catch { /* missing dates are fine */ }
  }
  return all;
}

function weekDates(anchorDate: string): string[] {
  const anchor = new Date(anchorDate);
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function countRejectionPatterns(annotations: EditorAnnotation[]): Array<{ pattern: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const a of annotations) {
    if (a.recommendation !== "reject") continue;
    for (const flag of a.factcheck.flagged) {
      if (flag.startsWith("cap:") || flag.startsWith("penalty:")) continue;
      const key = flag.split(":")[0]?.trim() ?? flag.slice(0, 60);
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);
}

function computeTurnaround(annotations: EditorAnnotation[]): string {
  if (annotations.length === 0) return "n/a";
  // annotatedAt is available; submitted_at on signal is not stored in annotation directly
  // Use annotatedAt as proxy — report is about review cycle time conceptually
  return `${annotations.length} signal(s) reviewed this cycle`;
}

function computeSpotCheckPassRate(memory: EditorMemory): string {
  const total = memory.stats.spotCheckPass + memory.stats.spotCheckFail;
  if (total === 0) return "no spot-checks completed yet";
  const pct = Math.round((memory.stats.spotCheckPass / total) * 100);
  return `${pct}% (${memory.stats.spotCheckPass}/${total})`;
}

function summarizeCorrespondentTrends(memory: EditorMemory): string[] {
  const lines: string[] = [];
  const patterns = Object.values(memory.correspondentPatterns);
  if (patterns.length === 0) return ["No correspondent data yet."];

  const frequent = patterns
    .filter((p) => p.reviewCount >= 3)
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 5);

  for (const p of frequent) {
    const addr = p.address.slice(0, 12) + "…";
    const errors = p.errorTypes.slice(0, 3).join(", ") || "none";
    lines.push(`- ${addr}: ${p.reviewCount} reviews, recurring patterns: ${errors}`);
  }

  if (lines.length === 0) {
    lines.push("Insufficient data for trend analysis (<3 reviews per correspondent).");
  }

  return lines;
}

function formatBeatLessons(memory: EditorMemory, beat: string): string[] {
  const lessons = memory.beatLessons?.[beat] ?? [];
  if (lessons.length === 0) return [`- No lessons recorded for ${beat} yet.`];
  return lessons.map((l) => `- [${l.date}] ${l.lesson}`);
}

// ── public API ────────────────────────────────────────────────────────────────

export async function generateBeatHealthReport(date: string): Promise<string> {
  const memory = await readEditorMemory();
  const dates = weekDates(date);
  const annotations = await readSubmittedAnnotations(dates);

  const approveCount = annotations.filter((a) => a.recommendation === "approve").length;
  const reviseCount = annotations.filter((a) => a.recommendation === "revise").length;
  const rejectCount = annotations.filter((a) => a.recommendation === "reject").length;

  const rejectionPatterns = countRejectionPatterns(annotations).slice(0, 3);
  const turnaround = computeTurnaround(annotations);
  const spotCheckRate = computeSpotCheckPassRate(memory);
  const correspondentTrends = summarizeCorrespondentTrends(memory);

  const lines: string[] = [
    `# Beat Health Report (Infrastructure + Quantum) — ${date}`,
    "",
    "## Signals Reviewed This Week",
    `- Total: ${annotations.length}`,
    `- Approve: ${approveCount}`,
    `- Revise: ${reviseCount}`,
    `- Reject: ${rejectCount}`,
    `- Turnaround: ${turnaround}`,
    "",
    "## Top 3 Rejection Patterns",
  ];

  if (rejectionPatterns.length === 0) {
    lines.push("- No rejections this week.");
  } else {
    for (const { pattern, count } of rejectionPatterns) {
      lines.push(`- ${pattern} (×${count})`);
    }
  }

  lines.push(
    "",
    "## Correspondent Quality Trends",
    ...correspondentTrends,
    "",
    "## Source Reliability Notes",
    "- GitHub API: primary Tier 1 source — stable.",
    "- Hiro API (api.mainnet.hiro.so): check status.hiro.so for live degradation.",
    "- Relay health endpoint (relay.aibtc.dev): never trust `healthy` boolean alone — verify nonce-gap and pending-tx fields.",
    "",
    "## Unresolved Patterns to Monitor",
  );

  // Surface signals with 'pending' spot-check that were scored low (likely false approvals)
  const pendingLow = memory.reviewed.filter(
    (r) => r.spot_check_result === "pending" && r.score < 60 && r.recommendation === "approve"
  );
  if (pendingLow.length > 0) {
    lines.push(`- ${pendingLow.length} low-score approval(s) pending spot-check — monitor for Publisher feedback.`);
  } else {
    lines.push("- No anomalies flagged.");
  }

  lines.push(
    "",
    "## Spot-Check Summary",
    `- Pass rate: ${spotCheckRate}`,
    `- Pending: ${memory.stats.spotCheckPending}`,
    `- Pass: ${memory.stats.spotCheckPass}`,
    `- Fail: ${memory.stats.spotCheckFail}`,
    "",
    "## Beat Lessons",
    ...formatBeatLessons(memory, "infrastructure"),
    "",
    "### Quantum Beat Lessons",
    ...formatBeatLessons(memory, "quantum"),
    "",
    `_Generated at ${new Date().toISOString()}_`
  );

  return lines.join("\n");
}

export async function writeBeatHealthReport(date: string): Promise<string> {
  const report = await generateBeatHealthReport(date);
  const outPath = resolve(process.cwd(), `data/editor/reports/${date}-beat-health.md`);
  await mkdir(resolve(process.cwd(), "data/editor/reports"), { recursive: true });
  await writeFile(outPath, report + "\n", "utf8");
  process.stdout.write(`[editor-report] wrote ${outPath}\n`);
  return outPath;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("beat-health-report.js")) {
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  writeBeatHealthReport(date).then((path) => {
    process.stdout.write(`[editor-report] done — ${path}\n`);
  }).catch((err: unknown) => {
    process.stderr.write(`[editor-report] fatal: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
