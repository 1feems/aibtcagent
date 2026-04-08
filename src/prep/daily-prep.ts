import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeConversion, formatConversionSection } from "../scoring/conversion-tracker.js";
import { getCapBlockedQueue, formatCapBlockedSection } from "../filing/cap-blocked-queue.js";
import { analyzeBeatCoverage, formatBeatCoverageSection } from "../scoring/beat-coverage.js";
import { refreshEditorialMemory } from "../learning/editorial-memory.js";
import { refreshLearningCache } from "../learning/lessons-cache.js";
import { readSignalHistory, type SignalHistoryEntry } from "../filing/signal-history.js";

export interface DailyPrepResult {
  reportPath: string;
  handoffPath?: string;
  briefFound: boolean;
  skipped: boolean;
  skipReason?: string;
}

interface FiledSignal {
  signalId: string | null;
  candidateId?: string | null;
  headline: string | null;
  beat?: string | null;
  filedAt: string | null;
  resolved: boolean;
  outcome?: string;
  satsEarned?: number;
}

interface FiledSignalsFile {
  filedSignals: FiledSignal[];
}

interface StatusReviewItem {
  signalId: string;
  headline: string;
  status: string;
  evidence: string;
  confidence: string;
}

interface ManualOutcomeInput {
  briefWinners: string[];
  inBrief: string[];
  rejected: string[];
  topSix: string[];
  valiantRank: string | null;
  notes: string[];
}

interface OutcomeWriteBackResult {
  inputFound: boolean;
  inputPath: string;
  lessonsAdded: string[];
  categories: string[];
  signalReportPath: string;
}

interface SharedBriefContextFile {
  dates?: Record<string, {
    briefTitles?: Array<{ title: string; beat?: string; snippet?: string }>;
    rejectedTitles?: Array<{ title: string; reason?: string }>;
    notes?: string[];
  }>;
}

async function readIfExists(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) return null;
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return null;
  }
}

function getPriorDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function bulletList(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

function normalizeBulletValue(line: string): string {
  return line.replace(/^[-*]\s+/, "").trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseManualOutcomeInput(markdown: string): ManualOutcomeInput {
  const input: ManualOutcomeInput = {
    briefWinners: [],
    inBrief: [],
    rejected: [],
    topSix: [],
    valiantRank: null,
    notes: []
  };

  let currentSection = "";

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionMatch = /^##\s+(.+)$/.exec(line);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim().toLowerCase();
      continue;
    }

    if (/^valiant rank\s*:/i.test(line)) {
      input.valiantRank = line.split(":").slice(1).join(":").trim() || null;
      continue;
    }

    if (!/^[-*]\s+/.test(line)) continue;
    const value = normalizeBulletValue(line);

    if (currentSection.includes("brief winner")) {
      input.briefWinners.push(value);
    } else if (currentSection.includes("in brief")) {
      input.inBrief.push(value);
    } else if (currentSection.includes("reject")) {
      input.rejected.push(value);
    } else if (currentSection.includes("top 6") || currentSection.includes("top six")) {
      input.topSix.push(value);
    } else if (currentSection.includes("note")) {
      input.notes.push(value);
    }
  }

  input.briefWinners = uniqueStrings(input.briefWinners);
  input.inBrief = uniqueStrings(input.inBrief);
  input.rejected = uniqueStrings(input.rejected);
  input.topSix = uniqueStrings(input.topSix);
  input.notes = uniqueStrings(input.notes);

  return input;
}

function detectWinningCategories(input: ManualOutcomeInput): string[] {
  const corpus = [...input.briefWinners, ...input.inBrief].join("\n").toLowerCase();
  const categories: string[] = [];

  const checks: Array<[string, RegExp]> = [
    ["Infrastructure and security patches", /\b(cve|nonce|relay|patch|vulnerability|security|dependency|wallet bug|api update|merge|pr #|issue #)\b/],
    ["Deep DeFi analytics and agent skills", /\b(bitflow|zest|hermetica|hodlmm|jingswap|dex|liquidity|auction|yield|skill|bff)\b/],
    ["Measurable network deltas and macro shifts", /\b(registration|registered|pending|active agents|a2a|volume|block\s+\d|counts?|inversion|delta)\b/],
    ["Platform governance and payout auditing", /\b(payout|leaderboard|guild|rate limit|30-signal|cap|audit|earnings|brief slot)\b/],
    ["Quantum threat intelligence", /\b(quantum|bip-360|ecdsa|whitepaper|cryptography|post-quantum)\b/]
  ];

  for (const [label, pattern] of checks) {
    if (pattern.test(corpus)) categories.push(label);
  }

  return categories;
}

function buildDurableLessons(reportDate: string, input: ManualOutcomeInput, categories: string[]): string[] {
  const lessons: string[] = [];
  const hasOutcomeEvidence = input.briefWinners.length > 0 || input.inBrief.length > 0 || input.rejected.length > 0;

  if (!hasOutcomeEvidence) return lessons;

  lessons.push(
    `${reportDate}: next: source AIBTC-native stories only; default reject angles that do not directly change AIBTC code, capital flows, security, payout mechanics, or verifiable network state.`,
    `${reportDate}: next: brief-winning signals need exact anchors in the headline and body such as PR numbers, sats amounts, block heights, API error codes, or measurable before/after deltas.`,
    `${reportDate}: next: use CLAIM -> EVIDENCE -> IMPLICATION structure and end with a direct operator consequence or action line.`
  );

  if (categories.length > 0) {
    lessons.push(
      `${reportDate}: note: recent brief winners cluster in these categories: ${categories.join(", ")}.`
    );
  }

  if (input.topSix.length > 0 || input.valiantRank) {
    lessons.push(
      `${reportDate}: next: top-agent pressure is real; optimize for brief wins, streak continuity, corrections, and full use of the 6-per-day quota when winner-quality stories exist.`
    );
  }

  lessons.push(
    `${reportDate}: next: keep Valiant focused on infrastructure and agent-skills first, even when broader generalist coverage appears on the leaderboard.`,
    `${reportDate}: next: general crypto market summaries and broad ecosystem trend pieces are structurally weak unless they carry exact AIBTC-native evidence and immediate operator consequence.`
  );

  return uniqueStrings(lessons);
}

async function appendDurableLessons(learningsPath: string, lessons: string[]): Promise<string[]> {
  if (lessons.length === 0) return [];

  const existing = (await readIfExists(learningsPath)) ?? "# Learnings\n";
  const appended: string[] = [];
  const nextLines = existing.endsWith("\n") ? existing : `${existing}\n`;
  let updated = nextLines;

  for (const lesson of lessons) {
    const line = `- ${lesson}`;
    if (existing.includes(line) || updated.includes(line)) continue;
    updated += `${line}\n`;
    appended.push(lesson);
  }

  if (appended.length > 0) {
    await mkdir(dirname(learningsPath), { recursive: true });
    await writeFile(learningsPath, updated, "utf8");
  }

  return appended;
}

async function writeBackBeatLessons(
  root: string,
  reportDate: string,
  lessonsAdded: string[],
  categories: string[]
): Promise<void> {
  if (lessonsAdded.length === 0) return;

  const editorMemoryPath = resolve(root, "data/state/editor-memory.json");
  let memory: Record<string, unknown> = {};
  try {
    memory = JSON.parse(await readFile(editorMemoryPath, "utf8")) as Record<string, unknown>;
  } catch { /* first run */ }

  const beatLessons = (memory.beatLessons ?? {}) as Record<string, Array<{ date: string; lesson: string; source: string }>>;

  const beatKeywords: Array<[string, RegExp]> = [
    ["infrastructure", /\b(cve|nonce|relay|patch|vulnerability|security|dependency|wallet bug|api update|merge|pr #|issue #)\b/i],
    ["quantum", /\b(quantum|bip-360|ecdsa|whitepaper|cryptography|post-quantum)\b/i]
  ];

  for (const lesson of lessonsAdded) {
    for (const [beat, pattern] of beatKeywords) {
      const matchesCategory = categories.some((c) => c.toLowerCase().includes(beat === "infrastructure" ? "infrastructure" : "quantum"));
      if (pattern.test(lesson) || matchesCategory) {
        beatLessons[beat] ??= [];
        const alreadyExists = beatLessons[beat].some((e) => e.lesson === lesson);
        if (!alreadyExists) {
          beatLessons[beat].push({ date: reportDate, lesson, source: "daily-prep" });
        }
        break;
      }
    }
  }

  memory.beatLessons = beatLessons;
  await writeFile(editorMemoryPath, JSON.stringify(memory, null, 2) + "\n", "utf8");
}

function buildSignalReportBase(reportDate: string): string {
  return [
    `# Signal Report: ${reportDate}`,
    "",
    `Generated at: ${reportDate}T00:00:00Z`,
    "",
    `Working report for ${reportDate} signal selection.`,
    ""
  ].join("\n");
}

async function updateSignalReport(args: {
  reportDate: string;
  signalReportPath: string;
  input: ManualOutcomeInput;
  categories: string[];
}): Promise<void> {
  const existing = (await readIfExists(args.signalReportPath)) ?? buildSignalReportBase(args.reportDate);
  const beforeMarker = "\n## Daily outcome intake\n";
  const withoutOldSection = existing.includes(beforeMarker)
    ? existing.slice(0, existing.indexOf(beforeMarker)).trimEnd()
    : existing.trimEnd();

  const section = [
    "## Daily outcome intake",
    `- Manual input file reviewed for ${args.reportDate}.`,
    `- Brief winners captured: ${args.input.briefWinners.length || 0}`,
    `- In-brief references captured: ${args.input.inBrief.length || 0}`,
    `- Rejected signals captured: ${args.input.rejected.length || 0}`,
    `- Top-6 context captured: ${args.input.topSix.length || 0}`,
    `- Valiant rank: ${args.input.valiantRank ?? "not provided"}`,
    "",
    "## Winning categories observed",
    ...(args.categories.length > 0 ? args.categories.map((category) => `- ${category}`) : ["- None derived from manual input yet"]),
    "",
    "## Sourcing reinforcement",
    "- Brief winners are dominated by highly technical, precise, AIBTC-native ecosystem data.",
    "- Prefer stories with exact PRs, merges, sats amounts, block heights, API errors, code deltas, and verifiable sources.",
    "- Reject broad crypto summaries unless they clearly change AIBTC code, capital, or security.",
    "- Keep Valiant concentrated on infrastructure and agent-skills unless an adjacent story is materially stronger."
  ].join("\n");

  await mkdir(dirname(args.signalReportPath), { recursive: true });
  await writeFile(args.signalReportPath, `${withoutOldSection}\n\n${section}\n`, "utf8");
}

async function applyManualOutcomeLoop(
  reportDate: string,
  root: string,
  learningsPath: string
): Promise<OutcomeWriteBackResult> {
  const inputPath = resolve(root, `data/reports/daily-input/${reportDate}.md`);
  const signalReportPath = resolve(root, `data/reports/signals/${reportDate}.md`);

  if (!existsSync(inputPath)) {
    return {
      inputFound: false,
      inputPath,
      lessonsAdded: [],
      categories: [],
      signalReportPath
    };
  }

  const markdown = await readFile(inputPath, "utf8");
  const input = parseManualOutcomeInput(markdown);
  const categories = detectWinningCategories(input);
  const lessons = buildDurableLessons(reportDate, input, categories);
  const lessonsAdded = await appendDurableLessons(learningsPath, lessons);
  await updateSignalReport({ reportDate, signalReportPath, input, categories });
  await refreshLearningCache(root);
  await refreshEditorialMemory(root);
  await writeBackBeatLessons(root, reportDate, lessonsAdded, categories);

  return {
    inputFound: true,
    inputPath,
    lessonsAdded,
    categories,
    signalReportPath
  };
}

function toRelative(root: string, filePath: string): string {
  const relative = filePath.slice(root.length + 1);
  return relative || filePath;
}

function readSharedContextSummary(sharedContext: SharedBriefContextFile | null): {
  recentWinningTitles: string[];
  recentRejectedTitles: string[];
  titleShapeLessons: string[];
  rankingNotes: string[];
} {
  const datedEntries = Object.entries(sharedContext?.dates ?? {})
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 3);

  const recentWinningTitles = datedEntries.flatMap(([, entry]) =>
    (entry.briefTitles ?? []).map((item) => item.title.trim()).filter(Boolean)
  ).slice(0, 6);
  const recentRejectedTitles = datedEntries.flatMap(([, entry]) =>
    (entry.rejectedTitles ?? []).map((item) => item.title.trim()).filter(Boolean)
  ).slice(0, 6);
  const titleShapeLessons = datedEntries.flatMap(([, entry]) => [
    ...(entry.briefTitles ?? []).map((item) => item.snippet?.trim()).filter((value): value is string => Boolean(value)),
    ...(entry.rejectedTitles ?? []).map((item) => item.reason?.trim()).filter((value): value is string => Boolean(value))
  ]).slice(0, 6);
  const rankingNotes = datedEntries.flatMap(([, entry]) => entry.notes ?? []).map((note) => note.trim()).filter(Boolean).slice(0, 6);

  return { recentWinningTitles, recentRejectedTitles, titleShapeLessons, rankingNotes };
}

function summarizeSignalHistory(entries: SignalHistoryEntry[]): {
  recentHeadlines: string[];
  recentRejectedHeadlines: string[];
  recentApprovedNotInBriefHeadlines: string[];
} {
  return {
    recentHeadlines: entries.slice(0, 12).map((entry) => entry.headline?.trim()).filter((value): value is string => Boolean(value)),
    recentRejectedHeadlines: entries.filter((entry) => entry.outcome === "rejected").slice(0, 6).map((entry) => entry.headline?.trim()).filter((value): value is string => Boolean(value)),
    recentApprovedNotInBriefHeadlines: entries.filter((entry) => entry.outcome === "approved").slice(0, 6).map((entry) => entry.headline?.trim()).filter((value): value is string => Boolean(value))
  };
}

async function writeDailyPrepHandoff(args: {
  root: string;
  reportDate: string;
  generatedAt: string;
  briefHeadlines: string[];
  sharedContext: SharedBriefContextFile | null;
  signalHistoryEntries: SignalHistoryEntry[];
  pendingSignals: string[];
}): Promise<string> {
  const handoffPath = resolve(args.root, `data/reports/daily/${args.reportDate}.json`);
  const sharedBriefContext = readSharedContextSummary(args.sharedContext);
  const signalHistory = summarizeSignalHistory(args.signalHistoryEntries);
  const handoff = {
    kind: "daily_prep_handoff",
    reportDate: args.reportDate,
    generatedAt: args.generatedAt,
    activeBrief: {
      occupiedHeadlines: args.briefHeadlines
    },
    sharedBriefContext,
    signalHistory,
    generationPriorities: [
      "Use stronger source anchors before rewriting weak drafts.",
      "Do not reuse same-shape stories already present in today's brief, shared context, or signal history.",
      "Prefer candidates that can satisfy the signal template before drafting."
    ],
    pendingSignals: args.pendingSignals
  };
  await mkdir(dirname(handoffPath), { recursive: true });
  await writeFile(handoffPath, JSON.stringify(handoff, null, 2) + "\n", "utf8");
  return handoffPath;
}

function normalizeOutcome(signal: FiledSignal): StatusReviewItem {
  const signalId = signal.signalId ?? "(missing signal id)";
  const headline = signal.headline ?? "(missing headline)";

  if (!signal.resolved) {
    return {
      signalId,
      headline,
      status: "pending",
      evidence: "local filed-signals state shows resolved: false",
      confidence: "direct evidence"
    };
  }

  if (!signal.outcome) {
    return {
      signalId,
      headline,
      status: "unresolved",
      evidence: "local filed-signals state shows resolved: true but no explicit outcome label is stored",
      confidence: "direct evidence"
    };
  }

  const outcome = signal.outcome === "brief_included" ? "published" : signal.outcome;
  return {
    signalId,
    headline,
    status: outcome,
    evidence: `local filed-signals state stores outcome: ${signal.outcome}`,
    confidence: "direct evidence"
  };
}

function summarizeApprovedSignals(items: StatusReviewItem[]): string[] {
  const approvedStatuses = new Set(["published", "approved", "approved_not_in_brief"]);
  const approved = items.filter((item) => approvedStatuses.has(item.status));
  if (approved.length === 0) return ["none in local state"];
  return approved.map(
    (item) => `signal_id: ${item.signalId}\n  headline: ${item.headline}\n  source: data/state/filed-signals.json\n  note: local state outcome is \`${item.status}\``
  );
}

function summarizeRejectedSignals(items: StatusReviewItem[]): string[] {
  const rejectedStatuses = new Set(["denied", "rejected", "duplicate_loss"]);
  const rejected = items.filter((item) => rejectedStatuses.has(item.status));
  if (rejected.length === 0) return ["none in local state"];
  return rejected.map(
    (item) => `signal_id: ${item.signalId}\n  headline: ${item.headline}\n  source: data/state/filed-signals.json\n  note: local state outcome is \`${item.status}\``
  );
}

function summarizePendingWatchlist(items: StatusReviewItem[]): string[] {
  const pending = items.filter((item) => item.status === "pending" || item.status === "unresolved");
  if (pending.length === 0) return ["none"];
  return pending.map(
    (item) =>
      `signal_id: ${item.signalId}\n  headline: ${item.headline}\n  why_still_pending: ${item.evidence}\n  what_to_recheck_next: publisher outcome, brief inclusion status, or explicit manual label`
  );
}

function formatStatusSection(items: StatusReviewItem[]): string {
  if (items.length === 0) {
    return "- signal_id: none\n  headline: none\n  status: unresolved\n  evidence: no filed signals were found in local state\n  confidence: direct evidence";
  }

  return items
    .map(
      (item) =>
        `- signal_id: ${item.signalId}\n  headline: ${item.headline}\n  status: ${item.status}\n  evidence: ${item.evidence}\n  confidence: ${item.confidence}`
    )
    .join("\n");
}

function formatBucketSection(items: StatusReviewItem[]): string {
  const statuses = [
    "published",
    "approved_not_in_brief",
    "approved",
    "rejected",
    "denied",
    "pending",
    "duplicate_loss",
    "unresolved"
  ];

  return statuses
    .map((status) => {
      const matches = items.filter((item) => item.status === status);
      if (matches.length === 0) return `- ${status}: none`;
      return `- ${status}: ${matches.map((item) => item.signalId).join(", ")}`;
    })
    .join("\n");
}

function isPlaceholderBriefArtifact(text: string): boolean {
  return /Status:\s+awaiting manual brief input/i.test(text);
}

function buildDailyReportContent(args: {
  reportDate: string;
  generatedAt: string;
  root: string;
  briefPath: string;
  currentBriefExists: boolean;
  priorBriefPath: string;
  priorBriefExists: boolean;
  priorReportPath: string;
  priorReportExists: boolean;
  learningsPath: string;
  learningsExists: boolean;
  filedPath: string;
  filedSignals: FiledSignal[];
  conversionSection: string;      // P26
  capBlockedSection: string;      // P29
  beatCoverageSection: string;    // P30
  outcomeLoop: OutcomeWriteBackResult;
}): string {
  const statusItems = args.filedSignals.map(normalizeOutcome);
  const recentSignals = statusItems.slice(0, 8);
  const pendingCount = statusItems.filter((item) => item.status === "pending").length;
  const unresolvedCount = statusItems.filter((item) => item.status === "unresolved").length;
  const approvedCount = statusItems.filter((item) => item.status === "approved").length;
  const publishedCount = statusItems.filter((item) => item.status === "published").length;
  const rejectedCount = statusItems.filter((item) => item.status === "rejected" || item.status === "denied").length;

  const docsRead = [
    resolve(args.root, "docs/daily-docs-map.md"),
    resolve(args.root, "data/reports/daily/TEMPLATE.md"),
    resolve(args.root, "README.md"),
    args.filedPath,
    args.briefPath,
    args.priorReportPath,
    args.learningsPath
  ];

  if (args.priorBriefExists) {
    docsRead.splice(5, 0, args.priorBriefPath);
  }

  const currentBriefReference = args.currentBriefExists
    ? `\`${toRelative(args.root, args.briefPath)}\``
    : `\`${toRelative(args.root, args.briefPath)}\` was auto-created as a placeholder because no brief artifact existed yet`;
  const priorBriefReference = args.priorBriefExists
    ? `\`${toRelative(args.root, args.priorBriefPath)}\``
    : args.priorReportExists
      ? `no prior brief artifact found; using \`${toRelative(args.root, args.priorReportPath)}\` as the declared proxy`
      : "no prior brief artifact or prior daily report found locally";

  return [
    `# Daily Report: ${args.reportDate}`,
    "",
    `Generated at: ${args.generatedAt}`,
    "",
    "## Inputs gathered",
    bulletList([
      `Cycle dates: active local prep date ${args.reportDate}; prior cycle date ${getPriorDate(args.reportDate)}`,
      `Today's brief: ${args.currentBriefExists ? "current brief artifact already exists locally" : "no current brief artifact existed, so a dated placeholder file was created"}`,
      `Prior cycle brief: ${args.priorBriefExists ? "prior brief artifact exists locally" : "no standalone prior brief artifact exists locally"}`,
      "From Feems: operator-provided daily inputs were present before prep ran",
      "From local repo: docs, templates, filed-signals state, learnings, current brief artifact path, and prior-cycle artifacts when present",
      `Substitute inputs used: ${args.priorReportExists ? `prior daily report \`${toRelative(args.root, args.priorReportPath)}\`` : "none"}`,
      `Prior-day proxy used: ${args.priorReportExists ? `\`${toRelative(args.root, args.priorReportPath)}\`` : "none available"}`,
      `Still missing: ${args.currentBriefExists ? "manual ranking / publisher inbox inputs" : "manual brief content plus ranking / publisher inbox inputs"}`
    ]),
    "",
    "## Input coverage check",
    bulletList([
      "Latest approved signals: review against operator-provided publisher responses when available",
      "Latest rejected signals: review against operator-provided publisher responses when available",
      "Publisher approvals used as substitute: operator-provided evidence required",
      "Publisher denials used as substitute: operator-provided evidence required",
      "Inbox/chat content used as substitute: operator-provided evidence required"
    ]),
    "",
    "## Brief artifacts used",
    bulletList([
      `Current brief file/reference: ${currentBriefReference}`,
      `Prior brief file/reference: ${priorBriefReference}`
    ]),
    "",
    "## Docs read",
    bulletList(docsRead.map((filePath) => filePath)),
    "",
    "## What Feems sent recently",
    recentSignals.length > 0
      ? recentSignals
          .map((item) => `- signal_id: ${item.signalId}\n  headline: ${item.headline}`)
          .join("\n")
      : "- signal_id: none\n  headline: no recent filed signals were available locally",
    "",
    "## Filed items reviewed",
    recentSignals.length > 0
      ? recentSignals
          .map((item) => `- signal_id: ${item.signalId}\n  headline: ${item.headline}`)
          .join("\n")
      : "- signal_id: none\n  headline: no filed items were available locally",
    "",
    "## Status updates by item",
    formatStatusSection(statusItems),
    "",
    "## Status bucket check",
    formatBucketSection(statusItems),
    "",
    "## Approved signals reviewed",
    summarizeApprovedSignals(statusItems).map((item) => `- ${item.replace(/\n/g, "\n  ")}`).join("\n"),
    "",
    "## Rejected signals reviewed",
    summarizeRejectedSignals(statusItems).map((item) => `- ${item.replace(/\n/g, "\n  ")}`).join("\n"),
    "",
    "## Today vs prior-day brief",
    bulletList([
      `Today: ${args.currentBriefExists ? "current brief artifact exists locally and can be reviewed manually" : "current brief artifact missing; prep should have been blocked before analysis"}`,
      `Prior cycle: ${args.priorBriefExists ? "prior brief artifact exists locally" : args.priorReportExists ? "using prior daily report as declared proxy" : "no prior-cycle local proxy available"}`,
      "Repeat winners: not deterministically derived in this non-LLM prep run",
      "Top-6 repeaters: not deterministically derived in this non-LLM prep run",
      "What changed: this run only normalizes local file state and leaves competitive interpretation for manual or future deterministic implementation"
    ]),
    "",
    "## Approved review",
    bulletList([
      `Published: ${publishedCount > 0 ? `${publishedCount} item(s) labeled published in local state` : "none in local state"}`,
      `Approved not in brief: not inferred automatically in this deterministic run`,
      `Why approved-not-in-brief lost: not deterministically derived without trusted brief and publisher evidence`,
      `Approval patterns worth copying: no local heuristic beyond the repo docs; review current brief and manual inputs before drawing conclusions`
    ]),
    "",
    "## Rejected/denied review",
    bulletList([
      `Denied: ${statusItems.filter((item) => item.status === "denied").length} item(s) labeled denied in local state`,
      `Rejected: ${statusItems.filter((item) => item.status === "rejected").length} item(s) labeled rejected in local state`,
      "Patterns to avoid: use README rejection rules plus explicit publisher notes; this deterministic run does not invent reasons that are not present in local state"
    ]),
    "",
    "## Ranking context",
    bulletList([
      `Top 6: ${args.outcomeLoop.inputFound ? `provided via \`${toRelative(args.root, args.outcomeLoop.inputPath)}\`` : "not available from deterministic local-only inputs"}`,
      `My rank: ${args.outcomeLoop.inputFound ? "provided via manual daily outcome input when present" : "not available from deterministic local-only inputs"}`,
      "Earnings gap: not available from deterministic local-only inputs",
      "Pressure: weekly-top-3 pressure is documented in the repo, but current-cycle ranking data was not provided locally",
      "Payout implications: published brief wins still matter more than approvals, but current numeric gap cannot be computed from local-only files"
    ]),
    "",
    "## Decision model",
    bulletList([
      "short operational model for the next sourcing cycle: use the daily report as a state-normalization handoff, not as a generated strategy memo",
      "Next-cycle operating rules: fill the dated brief artifact with the exact brief text or reference, collect ranking and publisher outcome inputs, then rerun prep before trusting any competitive conclusions",
      "Next-cycle operating rules: avoid beats already covered by pending local signals until those outcomes are confirmed",
      "Next-cycle operating rules: treat missing publisher evidence as unresolved rather than inferring a stronger status"
    ]),
    "",
    "## Pending watchlist",
    summarizePendingWatchlist(statusItems).map((item) => `- ${item.replace(/\n/g, "\n  ")}`).join("\n"),
    "",
    "## Durable lessons to carry forward",
    args.outcomeLoop.lessonsAdded.length > 0
      ? args.outcomeLoop.lessonsAdded.map((lesson) => `- lesson: ${lesson}\n  write_to: memory/learnings.md`).join("\n")
      : "- lesson: none added by deterministic daily-prep; keep using existing durable lessons until new confirmed lessons are available\n  write_to: none",
    "",
    "## Manual outcome intake",
    bulletList([
      `Manual daily input file: ${args.outcomeLoop.inputFound ? `used \`${toRelative(args.root, args.outcomeLoop.inputPath)}\`` : "none found for this date"}`,
      `Winning categories detected: ${args.outcomeLoop.categories.length > 0 ? args.outcomeLoop.categories.join(", ") : "none derived yet"}`,
      `Signal report updated: ${args.outcomeLoop.inputFound ? `\`${toRelative(args.root, args.outcomeLoop.signalReportPath)}\`` : "no dated signal report write-back performed"}`
    ]),
    "",
    "## Brief conversion analysis",
    args.conversionSection,
    "",
    "## Cap-blocked resubmission queue",
    args.capBlockedSection,
    "",
    "## Beat coverage",
    args.beatCoverageSection,
    "",
    "## Signal-generation handoff",
    bulletList([
      "Best beats to target next: not computed by this non-LLM prep implementation",
      `Beats to avoid: beats attached to currently pending local filings (${pendingCount} pending, ${unresolvedCount} unresolved) until outcomes are confirmed`,
      "Strongest story shapes: follow repo docs manually; this prep run does not synthesize new story shapes",
      `Unresolved items to recheck before sourcing: ${pendingCount + unresolvedCount > 0 ? `${pendingCount + unresolvedCount} local filed item(s)` : "none"}`
    ]),
    "",
    "## Prep-only boundary",
    "- No signal candidates produced: true",
    "",
    "## Write-back updates made",
    bulletList([
      `\`data/reports/daily/${args.reportDate}.md\`: created or updated deterministically from local repo state`,
      `\`memory/learnings.md\`: ${args.outcomeLoop.lessonsAdded.length > 0 ? `${args.outcomeLoop.lessonsAdded.length} durable lesson(s) appended` : "none"}`,
      "`data/state/filed-signals.json`: none",
      "Inferred statuses left only in daily report: none; this run avoids new inferred statuses",
      `\`data/briefs/${args.reportDate}.md\`: ${args.currentBriefExists ? "left in place" : "missing; prep should be blocked until the exact brief text or reference is provided"}`,
      `\`data/reports/signals/${args.reportDate}.md\`: ${args.outcomeLoop.inputFound ? "updated with daily outcome intake and winning categories" : "not updated because no manual daily input file was present"}`,
      "`data/state/editorial-memory.json`: refreshed after lesson write-back when manual input was present",
      `Other files: local state reviewed (${args.filedSignals.length} filed item(s), ${approvedCount} approved, ${publishedCount} published, ${rejectedCount} rejected or denied)`
    ])
  ].join("\n");
}

export async function runDailyPrep(
  reportDate: string,
  generatedAt: string,
  baseDir?: string
): Promise<DailyPrepResult> {
  const root = resolve(baseDir ?? process.cwd());
  const priorDate = getPriorDate(reportDate);

  const paths = {
    brief: resolve(root, `data/briefs/${reportDate}.md`),
    priorBrief: resolve(root, `data/briefs/${priorDate}.md`),
    priorReport: resolve(root, `data/reports/daily/${priorDate}.md`),
    filed: resolve(root, "data/state/filed-signals.json"),
    sharedContext: resolve(root, "data/briefs/shared-context.json"),
    learnings: resolve(root, "memory/learnings.md"),
    output: resolve(root, `data/reports/daily/${reportDate}.md`),
    handoff: resolve(root, `data/reports/daily/${reportDate}.json`)
  };

  const briefExists = existsSync(paths.brief);
  if (!briefExists) {
    process.stdout.write(
      `[daily-prep] BLOCKED — data/briefs/${reportDate}.md missing. Ask Feems for the exact brief text or exact brief reference before running prep.\n`
    );
    return {
      reportPath: "",
      briefFound: false,
      skipped: true,
      skipReason: `brief artifact missing for ${reportDate}; operator must provide the daily brief before prep runs`
    };
  }

  const briefText = await readFile(paths.brief, "utf8");
  if (isPlaceholderBriefArtifact(briefText)) {
    process.stdout.write(
      `[daily-prep] BLOCKED — data/briefs/${reportDate}.md still contains the manual-input placeholder. Ask Feems for the exact brief text or exact brief reference, plus publisher responses and ranking context, before running prep.\n`
    );
    return {
      reportPath: "",
      briefFound: false,
      skipped: true,
      skipReason: `brief artifact for ${reportDate} is still a placeholder; operator inputs are still required before prep runs`
    };
  }

  const filedRaw = await readIfExists(paths.filed);
  const filedSignals = filedRaw
    ? (JSON.parse(filedRaw) as FiledSignalsFile).filedSignals ?? []
    : [];
  const sharedContextRaw = await readIfExists(paths.sharedContext);
  const sharedContext = sharedContextRaw
    ? (JSON.parse(sharedContextRaw) as SharedBriefContextFile)
    : null;
  const signalHistory = await readSignalHistory(root);
  const briefHeadlines = briefText.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("#### "))
    .map((line) => line.slice(5).trim());

  // P26/P29/P30: compute conversion, cap-blocked, beat coverage concurrently
  const [conversionAnalysis, capBlockedEntries, beatCoverage] = await Promise.all([
    analyzeConversion(root).catch(() => null),
    getCapBlockedQueue(root).catch(() => []),
    analyzeBeatCoverage(reportDate, root).catch(() => null)
  ]);

  const conversionSection = conversionAnalysis
    ? formatConversionSection(conversionAnalysis)
    : "- conversion data unavailable — run check-outcomes first";
  const capBlockedSection = formatCapBlockedSection(capBlockedEntries);
  const beatCoverageSection = beatCoverage
    ? formatBeatCoverageSection(beatCoverage)
    : "- beat coverage data unavailable";
  const outcomeLoop = await applyManualOutcomeLoop(reportDate, root, paths.learnings);

  const reportContent = buildDailyReportContent({
    reportDate,
    generatedAt,
    root,
    briefPath: paths.brief,
    currentBriefExists: briefExists,
    priorBriefPath: paths.priorBrief,
    priorBriefExists: existsSync(paths.priorBrief),
    priorReportPath: paths.priorReport,
    priorReportExists: existsSync(paths.priorReport),
    learningsPath: paths.learnings,
    learningsExists: existsSync(paths.learnings),
    filedPath: paths.filed,
    filedSignals,
    conversionSection,
    capBlockedSection,
    beatCoverageSection,
    outcomeLoop
  });

  await mkdir(dirname(paths.output), { recursive: true });
  await writeFile(paths.output, reportContent, "utf8");
  const handoffPath = await writeDailyPrepHandoff({
    root,
    reportDate,
    generatedAt,
    briefHeadlines,
    sharedContext,
    signalHistoryEntries: signalHistory.entries,
    pendingSignals: signalHistory.entries
      .filter((entry) => entry.outcome === "pending")
      .map((entry) => entry.headline?.trim())
      .filter((value): value is string => Boolean(value))
  });

  process.stdout.write(`[daily-prep] report saved to ${paths.output}\n`);
  process.stdout.write(`[daily-prep] handoff saved to ${handoffPath}\n`);

  return { reportPath: paths.output, handoffPath, briefFound: briefExists, skipped: false };
}

async function main(): Promise<void> {
  const now = new Date().toISOString();
  const reportDate = process.argv[2] ?? now.slice(0, 10);
  await runDailyPrep(reportDate, now);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
