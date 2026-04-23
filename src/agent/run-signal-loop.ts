import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAuditedLoop, type AuditInput, type AuditOutput } from "../audit/index.js";
import { runDailyLearn } from "../loop/index.js";
import { runSignalJob } from "../prep/signal-job.js";
import {
  replenishCandidateSlate,
  type ReplenishmentPassResult
} from "./replenishment.js";
import { runCandidateSourcingPass } from "./sourcing-pass.js";
import {
  autoLabelResolvedOutcomes,
  refreshOutcomeFeedbackMemory,
  refreshSnapshotMemory,
  syncRuntimeMemory,
  writeSignalLearningBrief
} from "../learning/index.js";
import { ingestManualDailyBrief, trackBriefWinners } from "../brief/index.js";
import { saveFilingQueue, writeTrustedSignalSlate, type FilingQueueSnapshot } from "../filing/index.js";
import { getPacificReportDate } from "../utils/report-date.js";
import { writeDailyOutcomeBoard } from "../ops/outcome-board.js";

interface SignalLoopConfig {
  reportDate: string;
  generatedAt: string;
  beatFilter: string | null;
  jsonLimit: number;
}

interface SignalLoopPhaseStatus {
  skill: "analyze-signal-outcomes" | "create-signal" | "record-signal-outcome";
  status: "completed" | "not_run";
  detail: string;
}

interface ReviewedInput {
  path: string;
  available: boolean;
  detail: string;
  reviewMode: "loaded_only" | "compliance_verified";
}

interface SignalLoopAnalysisReport {
  reportDate: string;
  generatedAt: string;
  skill: "analyze-signal-outcomes";
  reviewedInputs: {
    signalHistory: ReviewedInput;
    editorialMemory: ReviewedInput;
    outcomeFeedbackMemory: ReviewedInput;
    helperErrors: ReviewedInput;
    latestBrief: ReviewedInput;
    distilledLearningBrief: ReviewedInput;
    beatEditorGuidance: ReviewedInput[];
  };
}

interface SignalLoopResearchReport {
  reportDate: string;
  generatedAt: string;
  phase: "research";
  candidateCounts: {
    total: number;
    strong: number;
    onHold: number;
    rejected: number;
    other: number;
  };
  replenishment: {
    passesRun: number;
    lastPassFoundEvents: number;
    lastPassStatuses: string[];
  };
  verdict:
    | "strong_candidates_ready"
    | "needs_more_evidence"
    | "source_exhausted"
    | "no_candidates_generated";
  summary: string;
}

interface SignalLoopPlanReport {
  reportDate: string;
  generatedAt: string;
  phase: "plan";
  chosenAction:
    | "review_existing_candidates"
    | "source_more_evidence"
    | "hold_for_stronger_story"
    | "write_manual_candidate";
  reasons: string[];
  nextOperatorAction: string;
}

interface SignalLoopQueueSnapshot {
  items: Array<{ queueStatus: string }>;
}

interface SignalLoopAuditDependencies<TQueue extends SignalLoopQueueSnapshot> {
  runSignalJobPhase: (reportDate: string, generatedAt: string) => Promise<{ skipped: boolean; outputPath: string; skipReason?: string }>;
  replenishPhase: (
    reportDate: string,
    generatedAt: string
  ) => Promise<{
    filingQueue: TQueue;
    replenishmentPassesRun: number;
    lastPassResult: ReplenishmentPassResult | null;
  }>;
}

function parseArgs(argv: string[]): SignalLoopConfig {
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.set(key, "true");
      continue;
    }

    parsed.set(key, next);
    index += 1;
  }

  const now = new Date().toISOString();
  const parsedLimit = Number(parsed.get("limit") ?? "3");
  const normalizedLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(6, Math.trunc(parsedLimit))) : 3;
  return {
    reportDate: parsed.get("date") ?? getPacificReportDate(now),
    generatedAt: parsed.get("generated-at") ?? now,
    beatFilter: parsed.get("beat")?.trim().toLowerCase() ?? null,
    jsonLimit: normalizedLimit
  };
}

function buildSignalLoopAuditOutput(args: {
  signalJob: { skipped: boolean; outputPath: string; skipReason?: string };
  strongCandidates: number;
  replenishmentPassesRun: number;
  reportDate: string;
}): AuditOutput {
  const claims = [
    `Signal loop evaluated ${args.reportDate} and produced ${args.strongCandidates} strong candidate(s).`
  ];
  const evidence =
    args.strongCandidates > 0
      ? [
          `signal-job output: ${args.signalJob.outputPath}`,
          `replenishment passes run: ${args.replenishmentPassesRun}`
        ]
      : [];
  const implications = [
    args.strongCandidates > 0
      ? `This means operators should review the awaiting_human_approval slate for ${args.reportDate}.`
      : `This means operators should add stronger manual candidates or refresh sources before the next filing window.`
  ];

  return { claims, evidence, implications };
}

function countStrongQueueItems(queue: SignalLoopQueueSnapshot): number {
  return queue.items.filter((item) => item.queueStatus === "awaiting_human_approval").length;
}

async function writeSignalLoopPhaseSummary(
  reportDate: string,
  phases: SignalLoopPhaseStatus[],
  baseDir = process.cwd()
): Promise<string> {
  const logDir = resolve(baseDir, "logs");
  await mkdir(logDir, { recursive: true });
  const outputPath = resolve(logDir, `signal-loop-phases-${reportDate}.json`);
  await writeFile(outputPath, JSON.stringify({
    reportDate,
    generatedAt: new Date().toISOString(),
    phases
  }, null, 2), "utf8");
  return outputPath;
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function writeJsonArtifact<T>(filePath: string, value: T): Promise<string> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  return filePath;
}

function summarizeQueue(queue: SignalLoopQueueSnapshot): SignalLoopResearchReport["candidateCounts"] {
  const counts = {
    total: queue.items.length,
    strong: 0,
    onHold: 0,
    rejected: 0,
    other: 0
  };

  for (const item of queue.items) {
    if (item.queueStatus === "awaiting_human_approval") {
      counts.strong += 1;
    } else if (item.queueStatus === "on_hold") {
      counts.onHold += 1;
    } else if (item.queueStatus === "rejected") {
      counts.rejected += 1;
    } else {
      counts.other += 1;
    }
  }

  return counts;
}

function buildResearchReport(args: {
  reportDate: string;
  generatedAt: string;
  filingQueue: SignalLoopQueueSnapshot;
  replenishmentPassesRun: number;
  lastPassResult: ReplenishmentPassResult | null;
}): SignalLoopResearchReport {
  const candidateCounts = summarizeQueue(args.filingQueue);
  const lastPassFoundEvents = args.lastPassResult?.results.length ?? 0;
  const lastPassStatuses = Array.from(new Set((args.lastPassResult?.results ?? []).map((result) => result.status))).sort();

  let verdict: SignalLoopResearchReport["verdict"];
  let summary: string;

  if (candidateCounts.strong > 0) {
    verdict = "strong_candidates_ready";
    summary = `${candidateCounts.strong} strong candidate(s) survived hard gates and are ready for operator review.`;
  } else if (candidateCounts.total === 0) {
    verdict = "no_candidates_generated";
    summary = "No candidate artifacts were generated during this run.";
  } else if (lastPassFoundEvents === 0 && args.replenishmentPassesRun > 0) {
    verdict = "source_exhausted";
    summary = "The loop searched for fresh events but found no new source material worth converting.";
  } else {
    verdict = "needs_more_evidence";
    summary = "Candidate artifacts exist, but none cleared the hard gates strongly enough for review.";
  }

  return {
    reportDate: args.reportDate,
    generatedAt: args.generatedAt,
    phase: "research",
    candidateCounts,
    replenishment: {
      passesRun: args.replenishmentPassesRun,
      lastPassFoundEvents,
      lastPassStatuses
    },
    verdict,
    summary
  };
}

function buildPlanReport(args: {
  reportDate: string;
  generatedAt: string;
  research: SignalLoopResearchReport;
}): SignalLoopPlanReport {
  if (args.research.candidateCounts.strong > 0) {
    return {
      reportDate: args.reportDate,
      generatedAt: args.generatedAt,
      phase: "plan",
      chosenAction: "review_existing_candidates",
      reasons: [
        `${args.research.candidateCounts.strong} candidate(s) already reached awaiting_human_approval`,
        "the next decision is editorial review, not more drafting"
      ],
      nextOperatorAction: "Review the trusted slate and filing queue, then approve only the strongest brief-competitive candidate."
    };
  }

  if (args.research.verdict === "source_exhausted") {
    return {
      reportDate: args.reportDate,
      generatedAt: args.generatedAt,
      phase: "plan",
      chosenAction: "write_manual_candidate",
      reasons: [
        `replenishment ran ${args.research.replenishment.passesRun} pass(es) without finding a strong candidate`,
        "the auto-source pipeline is exhausted for the current window"
      ],
      nextOperatorAction: "Write one manual candidate JSON with a stronger story or evidence edge, save it under data/manual-submissions/<report-date>/, and rerun signal-loop."
    };
  }

  if (args.research.candidateCounts.total > 0) {
    return {
      reportDate: args.reportDate,
      generatedAt: args.generatedAt,
      phase: "plan",
      chosenAction: "source_more_evidence",
      reasons: [
        `${args.research.candidateCounts.total} candidate(s) exist but none are strong`,
        "the bottleneck is evidence strength or displacement, not a total lack of stories"
      ],
      nextOperatorAction: "Repair the best existing candidate with harder anchors, fresher evidence, or a sharper operator consequence before drafting anything new."
    };
  }

  return {
    reportDate: args.reportDate,
    generatedAt: args.generatedAt,
    phase: "plan",
    chosenAction: "hold_for_stronger_story",
    reasons: [
      "no strong candidate survived and no meaningful candidate slate exists",
      "waiting is preferable to forcing a weak filing"
    ],
    nextOperatorAction: "Hold the slate unless a genuinely stronger story appears or a manual candidate can be sourced with exact proof."
  };
}

export async function writeSignalLoopResearchReport(
  reportDate: string,
  generatedAt: string,
  filingQueue: SignalLoopQueueSnapshot,
  replenishmentPassesRun: number,
  lastPassResult: ReplenishmentPassResult | null,
  baseDir = process.cwd()
): Promise<{ outputPath: string; report: SignalLoopResearchReport }> {
  const report = buildResearchReport({
    reportDate,
    generatedAt,
    filingQueue,
    replenishmentPassesRun,
    lastPassResult
  });
  const outputPath = resolve(baseDir, "logs", `signal-loop-research-${reportDate}.json`);
  await writeJsonArtifact(outputPath, report);
  return { outputPath, report };
}

export async function writeSignalLoopPlanReport(
  reportDate: string,
  generatedAt: string,
  research: SignalLoopResearchReport,
  baseDir = process.cwd()
): Promise<{ outputPath: string; report: SignalLoopPlanReport }> {
  const report = buildPlanReport({ reportDate, generatedAt, research });
  const outputPath = resolve(baseDir, "logs", `signal-loop-plan-${reportDate}.json`);
  await writeJsonArtifact(outputPath, report);
  return { outputPath, report };
}

interface HelperJsonSummary {
  path: string;
  candidateId: string | null;
  beat: string | null;
  json: Record<string, unknown>;
}

interface RoleLoopSummary {
  reportDate: string;
  generatedAt: string;
  briefPath: string | null;
  occupiedClusters: Array<{ anchor: string; count: number; source: string }>;
  verdict: SignalLoopResearchReport["verdict"];
  helperReady: HelperJsonSummary[];
}

async function collectHelperReadyJson(args: {
  reportDate: string;
  beatFilter: string | null;
  limit: number;
  baseDir?: string;
}): Promise<HelperJsonSummary[]> {
  const baseDir = args.baseDir ?? process.cwd();
  const filingReadyDir = resolve(baseDir, "data/filing-ready", args.reportDate);
  const files = await readdir(filingReadyDir).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [] as string[];
    throw error;
  });

  const summaries: HelperJsonSummary[] = [];
  for (const file of files.filter((entry) => entry.endsWith(".json")).sort()) {
    const path = resolve(filingReadyDir, file);
    const raw = await readTextIfExists(path);
    if (!raw.trim()) continue;

    let parsed: {
      candidateId?: string;
      canonicalSignal?: { beat_slug?: string };
      sendPackage?: { json?: Record<string, unknown> };
    };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      continue;
    }

    const beat = parsed.canonicalSignal?.beat_slug?.trim().toLowerCase() ?? null;
    if (args.beatFilter && beat !== args.beatFilter) continue;
    if (!parsed.sendPackage?.json) continue;
    summaries.push({
      path,
      candidateId: parsed.candidateId ?? null,
      beat,
      json: parsed.sendPackage.json
    });
    if (summaries.length >= args.limit) break;
  }

  return summaries;
}

async function writeRoleLoopSummary(args: {
  reportDate: string;
  generatedAt: string;
  briefPath: string | null;
  occupiedClusters: Array<{ anchor: string; count: number; source: string }>;
  verdict: SignalLoopResearchReport["verdict"];
  helperReady: HelperJsonSummary[];
  baseDir?: string;
}): Promise<string> {
  const baseDir = args.baseDir ?? process.cwd();
  const outputPath = resolve(baseDir, "logs", `role-loop-summary-${args.reportDate}.json`);
  const report: RoleLoopSummary = {
    reportDate: args.reportDate,
    generatedAt: args.generatedAt,
    briefPath: args.briefPath,
    occupiedClusters: args.occupiedClusters,
    verdict: args.verdict,
    helperReady: args.helperReady
  };
  await writeJsonArtifact(outputPath, report);
  return outputPath;
}

async function resolveLatestBriefPath(reportDate: string, baseDir = process.cwd()): Promise<string | null> {
  const briefDir = resolve(baseDir, "data/briefs");
  const datedCandidates = [
    resolve(briefDir, `${reportDate}.md`),
    resolve(briefDir, `${reportDate}.json`),
    resolve(briefDir, `${reportDate}.txt`)
  ];

  for (const candidate of datedCandidates) {
    const text = await readTextIfExists(candidate);
    if (text.trim()) {
      return candidate;
    }
  }

  let entries: string[] = [];
  try {
    entries = await readdir(briefDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }

  const datedEntries = entries
    .filter((entry) => /^\d{4}-\d{2}-\d{2}\.(md|json|txt)$/i.test(entry))
    .sort()
    .reverse();

  for (const entry of datedEntries) {
    const candidate = resolve(briefDir, entry);
    const text = await readTextIfExists(candidate);
    if (text.trim()) {
      return candidate;
    }
  }

  return null;
}

function extractLatestHelperErrorMessage(helperErrorsText: string): string {
  const lines = helperErrorsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-20)
    .reverse();

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as { message?: string };
      if (parsed.message?.trim()) {
        return parsed.message.trim();
      }
    } catch {
      continue;
    }
  }

  return "no helper error message found";
}

export async function writeSignalLoopAnalysisReport(
  reportDate: string,
  generatedAt: string,
  baseDir = process.cwd()
): Promise<string> {
  const beatEditorDir = resolve(baseDir, "docs/beat-editors");
  const beatEditorEntries = await readdir(beatEditorDir).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [] as string[];
    }
    throw error;
  });

  const beatEditorGuidance = await Promise.all(
    beatEditorEntries
      .filter((entry) => entry.endsWith(".md"))
      .sort()
      .map(async (entry) => {
        const filePath = resolve(beatEditorDir, entry);
        const text = await readTextIfExists(filePath);
        return {
          path: filePath,
          available: text.trim().length > 0,
          detail: text.trim()
            ? `loaded ${entry} before create-signal candidate drafting; this records guidance availability, not proof that every beat-specific hard gate passed`
            : `${entry} exists but had no readable guidance content`,
          reviewMode: "loaded_only"
        } satisfies ReviewedInput;
      })
  );

  const signalHistoryPath = resolve(baseDir, "data/state/signal-history.json");
  const editorialMemoryPath = resolve(baseDir, "data/state/editorial-memory.json");
  const outcomeFeedbackPath = resolve(baseDir, "data/state/outcome-feedback-memory.json");
  const helperErrorsPath = resolve(baseDir, "data/state/helper-errors.jsonl");
  const distilledLearningBriefPath = resolve(baseDir, "data/state/signal-learning-briefs", `${reportDate}.json`);
  const latestBriefPath = await resolveLatestBriefPath(reportDate, baseDir);

  const [signalHistoryText, editorialMemoryText, outcomeFeedbackText, helperErrorsText, latestBriefText, distilledLearningBriefText] = await Promise.all([
    readTextIfExists(signalHistoryPath),
    readTextIfExists(editorialMemoryPath),
    readTextIfExists(outcomeFeedbackPath),
    readTextIfExists(helperErrorsPath),
    latestBriefPath ? readTextIfExists(latestBriefPath) : Promise.resolve(""),
    readTextIfExists(distilledLearningBriefPath)
  ]);

  const report: SignalLoopAnalysisReport = {
    reportDate,
    generatedAt,
    skill: "analyze-signal-outcomes",
    reviewedInputs: {
      signalHistory: {
        path: signalHistoryPath,
        available: signalHistoryText.trim().length > 0,
        detail: signalHistoryText.trim()
          ? "reviewed canonical filed-signal ledger before candidate drafting"
          : "signal-history.json unavailable during analyze-signal-outcomes phase",
        reviewMode: signalHistoryText.trim().length > 0 ? "compliance_verified" : "loaded_only"
      },
      editorialMemory: {
        path: editorialMemoryPath,
        available: editorialMemoryText.trim().length > 0,
        detail: editorialMemoryText.trim()
          ? "reviewed editorial-memory preFilingChecks and current brief context before candidate drafting"
          : "editorial-memory.json unavailable during analyze-signal-outcomes phase",
        reviewMode: editorialMemoryText.trim().length > 0 ? "compliance_verified" : "loaded_only"
      },
      outcomeFeedbackMemory: {
        path: outcomeFeedbackPath,
        available: outcomeFeedbackText.trim().length > 0,
        detail: outcomeFeedbackText.trim()
          ? "reviewed normalized repeated outcome labels before candidate drafting"
          : "outcome-feedback-memory.json unavailable during analyze-signal-outcomes phase",
        reviewMode: outcomeFeedbackText.trim().length > 0 ? "compliance_verified" : "loaded_only"
      },
      helperErrors: {
        path: helperErrorsPath,
        available: helperErrorsText.trim().length > 0,
        detail: helperErrorsText.trim()
          ? `reviewed helper-errors.jsonl before candidate drafting; latest helper issue: "${extractLatestHelperErrorMessage(helperErrorsText)}"`
          : "helper-errors.jsonl unavailable during analyze-signal-outcomes phase",
        reviewMode: helperErrorsText.trim().length > 0 ? "compliance_verified" : "loaded_only"
      },
      latestBrief: {
        path: latestBriefPath ?? resolve(baseDir, "data/briefs"),
        available: Boolean(latestBriefPath && latestBriefText.trim()),
        detail: latestBriefPath && latestBriefText.trim()
          ? `reviewed latest brief artifact before candidate drafting: ${latestBriefPath.replace(`${baseDir}/`, "")}`
          : "no dated brief artifact was available during analyze-signal-outcomes phase",
        reviewMode: latestBriefPath && latestBriefText.trim() ? "compliance_verified" : "loaded_only"
      },
      distilledLearningBrief: {
        path: distilledLearningBriefPath,
        available: distilledLearningBriefText.trim().length > 0,
        detail: distilledLearningBriefText.trim()
          ? "reviewed distilled signal-learning-brief before candidate drafting"
          : "signal-learning-brief unavailable during analyze-signal-outcomes phase",
        reviewMode: distilledLearningBriefText.trim().length > 0 ? "compliance_verified" : "loaded_only"
      },
      beatEditorGuidance
    }
  };

  const logDir = resolve(baseDir, "logs");
  await mkdir(logDir, { recursive: true });
  const outputPath = resolve(logDir, `signal-loop-analysis-${reportDate}.json`);
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return outputPath;
}

export async function runAuditedSignalLoopPhase<TQueue extends SignalLoopQueueSnapshot>(
  config: SignalLoopConfig,
  dependencies: SignalLoopAuditDependencies<TQueue>
): Promise<{
  signalJob: { skipped: boolean; outputPath: string; skipReason?: string };
  filingQueue: TQueue;
  replenishmentPassesRun: number;
  lastPassResult: ReplenishmentPassResult | null;
  strongCandidates: number;
  auditLogPath: string;
}> {
  const auditInput: AuditInput = {
    prompt: `Run audited signal loop for ${config.reportDate}`,
    metadata: { reportDate: config.reportDate, generatedAt: config.generatedAt }
  };

  let latestSignalJob: { skipped: boolean; outputPath: string; skipReason?: string } | null = null;
  let latestReplenishment:
    | {
        filingQueue: TQueue;
        replenishmentPassesRun: number;
        lastPassResult: ReplenishmentPassResult | null;
      }
    | null = null;

  const auditResult = await runAuditedLoop(
    auditInput,
    async (currentInput) => {
      const iteration = typeof currentInput.metadata?.iteration === "number"
        ? Number(currentInput.metadata.iteration)
        : 1;
      const iterationGeneratedAt = new Date(
        new Date(config.generatedAt).getTime() + (iteration - 1) * 60_000
      ).toISOString();

      latestSignalJob = await dependencies.runSignalJobPhase(config.reportDate, iterationGeneratedAt);
      latestReplenishment = await dependencies.replenishPhase(config.reportDate, iterationGeneratedAt);
      const strongCandidates = countStrongQueueItems(latestReplenishment.filingQueue);

      return buildSignalLoopAuditOutput({
        signalJob: latestSignalJob,
        strongCandidates,
        replenishmentPassesRun: latestReplenishment.replenishmentPassesRun,
        reportDate: config.reportDate
      });
    },
    {
      runId: `signal-loop-${config.reportDate}`,
      maxIterations: 2,
      tightenPrompt: (currentInput, failures) => ({
        ...currentInput,
        prompt: `${currentInput.prompt}\nTighten prompt: include direct evidence with exact source anchors. Failures: ${failures.join(", ")}`,
        metadata: {
          ...(currentInput.metadata ?? {}),
          iteration: Number(currentInput.metadata?.iteration ?? 1) + 1
        }
      })
    }
  );

  if (!latestSignalJob || !latestReplenishment) {
    throw new Error("signal-loop audit did not execute any runtime phase");
  }

  const finalSignalJob = latestSignalJob as { skipped: boolean; outputPath: string; skipReason?: string };
  const finalReplenishment = latestReplenishment as {
    filingQueue: TQueue;
    replenishmentPassesRun: number;
    lastPassResult: ReplenishmentPassResult | null;
  };

  return {
    signalJob: finalSignalJob,
    filingQueue: finalReplenishment.filingQueue,
    replenishmentPassesRun: finalReplenishment.replenishmentPassesRun,
    lastPassResult: finalReplenishment.lastPassResult,
    strongCandidates: countStrongQueueItems(finalReplenishment.filingQueue),
    auditLogPath: auditResult.logPath
  };
}

export async function runSignalLoop(argv: string[] = process.argv.slice(2)): Promise<void> {
  const config = parseArgs(argv);
  process.stdout.write(`[signal-loop] starting for ${config.reportDate}\n`);
  process.stdout.write("[signal-loop] goal: produce safe, sendable filing candidates through the repo loop\n");
  process.stdout.write("[signal-loop] role order: Outcome Updater -> Outcome Analyst -> Create Signal -> Signal Filer(stop before filing)\n");
  if (config.beatFilter) {
    process.stdout.write(`[signal-loop] helper JSON filter beat: ${config.beatFilter} (limit ${config.jsonLimit})\n`);
  }

  process.stdout.write("[signal-loop] phase analyze-signal-outcomes — refreshing outcomes, memory, briefs, and beat context\n");
  await runDailyLearn([
    "--date",
    config.reportDate,
    "--generated-at",
    config.generatedAt
  ]);

  const autoLabel = await autoLabelResolvedOutcomes();
  process.stdout.write(`[signal-loop] auto-labeled ${autoLabel.labeledCount} resolved outcome(s)\n`);
  const snapshotMemory = await refreshSnapshotMemory();
  process.stdout.write(
    `[signal-loop] snapshot memory refreshed from ${snapshotMemory.sourceFiles.length} raw snapshot file(s) with ${snapshotMemory.lessonCount} derived lesson(s)\n`
  );
  const outcomeFeedbackMemory = await refreshOutcomeFeedbackMemory();
  process.stdout.write(
    `[signal-loop] outcome feedback memory refreshed with ${outcomeFeedbackMemory.repeatedLabels.length} repeated label pattern(s)\n`
  );
  const runtimeMemory = await syncRuntimeMemory("signal-loop");
  const editorialMemory = JSON.parse(
    await readFile(runtimeMemory.editorialMemoryPath, "utf8")
  ) as { preFilingChecks?: unknown[] };
  process.stdout.write(`[signal-loop] objective memory refreshed at ${runtimeMemory.objectiveMemoryPath}\n`);
  process.stdout.write(
    `[signal-loop] editorial memory refreshed with ${(editorialMemory.preFilingChecks ?? []).length} pre-filing check(s)\n`
  );
  process.stdout.write(`[signal-loop] competition memory refreshed at ${runtimeMemory.competitionMemoryPath}\n`);
  process.stdout.write(`[signal-loop] brief examples refreshed at ${runtimeMemory.briefExamplesMemoryPath}\n`);

  const manualBrief = await ingestManualDailyBrief(config.reportDate);
  if (manualBrief) {
    process.stdout.write(`[signal-loop] ingested manual brief from ${manualBrief.briefInputPath}\n`);
    process.stdout.write(`[signal-loop] brief winner snapshot saved to ${manualBrief.briefSnapshotPath}\n`);
  } else {
    try {
      const briefWinnersPath = await trackBriefWinners(config.reportDate);
      process.stdout.write(`[signal-loop] brief winner snapshot saved to ${briefWinnersPath}\n`);
    } catch (error) {
      process.stderr.write(`[signal-loop] brief winner tracking failed: ${(error as Error).message}\n`);
    }
  }

  const learningBriefPath = await writeSignalLearningBrief(config.reportDate, config.generatedAt);
  process.stdout.write(`[signal-loop] distilled learning brief saved to ${learningBriefPath}\n`);
  const outcomeBoard = await writeDailyOutcomeBoard(config.reportDate, config.generatedAt);
  process.stdout.write(`[signal-loop] outcome board saved to ${outcomeBoard.statePath}\n`);
  const analysisReportPath = await writeSignalLoopAnalysisReport(config.reportDate, config.generatedAt);
  process.stdout.write(`[signal-loop] analyze-signal-outcomes report saved to ${analysisReportPath}\n`);

  process.stdout.write("[signal-loop] phase research — packaging candidates and testing whether any story is truly competitive\n");
  const auditedPhase = await runAuditedSignalLoopPhase(config, {
    runSignalJobPhase: runSignalJob,
    replenishPhase: async (reportDate, generatedAt) => {
      const { filingQueue, replenishmentPassesRun, lastPassResult } = await replenishCandidateSlate(
        reportDate,
        generatedAt,
        "signal-loop",
        runCandidateSourcingPass
      );
      return { filingQueue, replenishmentPassesRun, lastPassResult };
    }
  });
  const signalJob = auditedPhase.signalJob;
  if (signalJob.skipped) {
    process.stdout.write(
      `[signal-loop] signal-job skipped: ${signalJob.skipReason ?? "unknown reason"}\n`
    );
  } else {
    process.stdout.write(`[signal-loop] signal-job report saved to ${signalJob.outputPath}\n`);
  }

  process.stdout.write(`[signal-loop] audit log saved to ${auditedPhase.auditLogPath}\n`);
  const { filingQueue, replenishmentPassesRun, lastPassResult, strongCandidates } = auditedPhase;
  const researchReport = await writeSignalLoopResearchReport(
    config.reportDate,
    config.generatedAt,
    filingQueue,
    replenishmentPassesRun,
    lastPassResult
  );
  process.stdout.write(`[signal-loop] research report saved to ${researchReport.outputPath}\n`);

  process.stdout.write("[signal-loop] phase plan — selecting the next action from the researched slate\n");
  const planReport = await writeSignalLoopPlanReport(
    config.reportDate,
    config.generatedAt,
    researchReport.report
  );
  process.stdout.write(`[signal-loop] plan report saved to ${planReport.outputPath}\n`);

  process.stdout.write("[signal-loop] phase implement — persisting queue artifacts for the selected path\n");

  if (strongCandidates === 0) {
    process.stdout.write(
      `[signal-loop] SLATE EMPTY — 0 strong candidates after ${replenishmentPassesRun} replenishment pass(es). ` +
      `Research verdict: ${researchReport.report.verdict}. ` +
      `Plan action: ${planReport.report.chosenAction}. ` +
      `Candidate counts: total=${researchReport.report.candidateCounts.total}, on_hold=${researchReport.report.candidateCounts.onHold}, rejected=${researchReport.report.candidateCounts.rejected}, other=${researchReport.report.candidateCounts.other}. ` +
      `Next action: ${planReport.report.nextOperatorAction}\n`
    );
  }

  const filingQueuePath = await saveFilingQueue(filingQueue);
  process.stdout.write(`[signal-loop] filing queue saved to ${filingQueuePath}\n`);

  const trustedSignalSlatePath = await writeTrustedSignalSlate(config.reportDate);
  process.stdout.write(`[signal-loop] trusted signal slate saved to ${trustedSignalSlatePath}\n`);

  process.stdout.write("[signal-loop] phase record-signal-outcome — deferred until a real filing result exists\n");
  const phaseSummaryPath = await writeSignalLoopPhaseSummary(config.reportDate, [
    {
      skill: "analyze-signal-outcomes",
      status: "completed",
      detail: `daily-learn, outcome auto-labeling, snapshot memory, outcome feedback memory, runtime memory sync, brief tracking, and explicit analysis artifact completed before candidate drafting (${analysisReportPath})`
    },
    {
      skill: "create-signal",
      status: "completed",
      detail: `research, plan, and implementation artifacts completed; filing queue saved to ${filingQueuePath}; plan report: ${planReport.outputPath}`
    },
    {
      skill: "record-signal-outcome",
      status: "not_run",
      detail: "submission outcome recording happens only after a real filed signal id/status exists"
    }
  ]);
  process.stdout.write(`[signal-loop] phase summary saved to ${phaseSummaryPath}\n`);

  const helperReady = await collectHelperReadyJson({
    reportDate: config.reportDate,
    beatFilter: config.beatFilter,
    limit: config.jsonLimit
  });
  const briefPath = await resolveLatestBriefPath(config.reportDate);
  const roleLoopSummaryPath = await writeRoleLoopSummary({
    reportDate: config.reportDate,
    generatedAt: config.generatedAt,
    briefPath,
    occupiedClusters: outcomeBoard.board.duplicateClusters,
    verdict: researchReport.report.verdict,
    helperReady
  });
  process.stdout.write(`[signal-loop] role-loop summary saved to ${roleLoopSummaryPath}\n`);
  process.stdout.write(
    `[signal-loop] summary: brief=${briefPath ?? "missing"}, occupied_clusters=${outcomeBoard.board.duplicateClusters.length}, verdict=${researchReport.report.verdict}, helper_json_ready=${helperReady.length}\n`
  );

  process.stdout.write(
    `[signal-loop] done — ${strongCandidates} candidate(s) are currently awaiting_human_approval for ${config.reportDate}\n`
  );
}

async function main(): Promise<void> {
  await runSignalLoop();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
