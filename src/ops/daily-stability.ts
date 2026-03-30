import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ApprovalOutcomeRecord, DailyReport } from "../types/index.js";

interface RankedQueue {
  reportDate: string;
  candidates: Array<{
    candidateId: string;
    score: number;
    decision: "file" | "hold" | "reject";
    headline: string;
  }>;
}

interface TrainingEntry {
  label?: string;
  reason_tags?: string[];
}

interface RuntimeHistoryState {
  runs?: Array<{
    reportDate?: string;
    eventName?: string | null;
  }>;
}

export interface DailyStabilityReport {
  kind: "daily_stability_report";
  reportDate: string;
  generatedAt: string;
  datesAnalyzed: string[];
  evidence: {
    analyzedDays: number;
    topPickDays: number;
    minimumDaysRequiredForApprovalOnly: number;
    minimumDaysRequiredForWalletSignOnly: number;
  };
  scheduler: {
    recordedRuns: number;
    consecutiveDailyRuns: number;
    last7DayCoverage: number | null;
  };
  totals: {
    filingQuality: number | null;
    approvalRate: number | null;
    publicationRate: number | null;
    falsePositiveTopPickRate: number | null;
    trainingDrift: number | null;
  };
  breakdown: Array<{
    reportDate: string;
    topCandidateId: string | null;
    topDecision: "file" | "hold" | "reject" | "none";
    topScore: number | null;
    topApproved: boolean | null;
    topPublished: boolean | null;
    falsePositiveTopPick: boolean | null;
  }>;
  recommendation: {
    roleMode: "manual_coaching" | "approval_and_sign_only" | "wallet_sign_only_candidate";
    reasons: string[];
  };
}

function formatRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }
  return Number((numerator / denominator).toFixed(2));
}

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readJsonl(filePath: string): Promise<TrainingEntry[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TrainingEntry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function buildReasonTagCounts(entries: TrainingEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.reason_tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

function computeDriftScore(before: Map<string, number>, after: Map<string, number>): number | null {
  const keys = new Set([...before.keys(), ...after.keys()]);
  if (keys.size === 0) {
    return null;
  }

  let totalDistance = 0;
  for (const key of keys) {
    totalDistance += Math.abs((before.get(key) ?? 0) - (after.get(key) ?? 0));
  }

  return Number((totalDistance / keys.size).toFixed(2));
}

function addDays(date: string, delta: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}

function buildSchedulerStats(
  reportDate: string,
  runtimeHistory: RuntimeHistoryState | null
): DailyStabilityReport["scheduler"] {
  const runDates = new Set(
    (runtimeHistory?.runs ?? [])
      .map((run) => run.reportDate)
      .filter((date): date is string => Boolean(date))
  );

  let consecutiveDailyRuns = 0;
  for (let offset = 0; offset < 30; offset += 1) {
    const date = addDays(reportDate, -offset);
    if (!runDates.has(date)) {
      break;
    }
    consecutiveDailyRuns += 1;
  }

  const last7Dates = Array.from({ length: 7 }, (_, index) => addDays(reportDate, -index));
  const covered = last7Dates.filter((date) => runDates.has(date)).length;

  return {
    recordedRuns: runDates.size,
    consecutiveDailyRuns,
    last7DayCoverage: formatRatio(covered, last7Dates.length)
  };
}

export async function generateDailyStabilityReport(
  reportDate?: string,
  baseDir?: string
): Promise<DailyStabilityReport> {
  const root = resolve(baseDir ?? process.cwd());
  const effectiveReportDate = reportDate ?? new Date().toISOString().slice(0, 10);
  const queueDir = resolve(root, "data/queues");
  const approvalDir = resolve(root, "data/outcomes/approvals");
  const beforeTraining = await readJsonl(resolve(root, "data/training/approved-not-in-brief.jsonl"));
  const afterTraining = await readJsonl(resolve(root, "data/training/in-brief.jsonl"));
  const runtimeHistory = await readJsonOrNull<RuntimeHistoryState>(
    resolve(root, "data/state/agent-runtime.json")
  );

  let queueFiles: string[] = [];
  try {
    queueFiles = (await readdir(queueDir)).filter((fileName) => fileName.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  let approvalFiles: string[] = [];
  try {
    approvalFiles = (await readdir(approvalDir)).filter((fileName) => fileName.endsWith(".json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const approvals = new Map<string, ApprovalOutcomeRecord>();
  for (const fileName of approvalFiles) {
    const approval = await readJsonOrNull<ApprovalOutcomeRecord>(resolve(approvalDir, fileName));
    if (approval?.candidateId) {
      approvals.set(approval.candidateId, approval);
    }
  }

  const breakdown: DailyStabilityReport["breakdown"] = [];
  let topPickDays = 0;
  let topApprovedDays = 0;
  let topPublishedDays = 0;
  let falsePositiveTopPicks = 0;

  for (const fileName of queueFiles) {
    const queue = await readJsonOrNull<RankedQueue>(resolve(queueDir, fileName));
    if (!queue) {
      continue;
    }

    const top = queue.candidates[0] ?? null;
    const outcome = top ? approvals.get(top.candidateId) ?? null : null;
    const falsePositive = top && top.decision === "file" && outcome?.approved === false;

    if (top) {
      topPickDays += 1;
      if (outcome?.approved) {
        topApprovedDays += 1;
      }
      if (outcome?.published) {
        topPublishedDays += 1;
      }
      if (falsePositive) {
        falsePositiveTopPicks += 1;
      }
    }

    breakdown.push({
      reportDate: queue.reportDate,
      topCandidateId: top?.candidateId ?? null,
      topDecision: top?.decision ?? "none",
      topScore: top?.score ?? null,
      topApproved: outcome?.approved ?? null,
      topPublished: outcome?.published ?? null,
      falsePositiveTopPick: top ? falsePositive ?? false : null
    });
  }

  const approvalRate = formatRatio(topApprovedDays, topPickDays);
  const publicationRate = formatRatio(topPublishedDays, topPickDays);
  const falsePositiveTopPickRate = formatRatio(falsePositiveTopPicks, topPickDays);
  const filingQuality = approvalRate;
  const trainingDrift = computeDriftScore(
    buildReasonTagCounts(beforeTraining),
    buildReasonTagCounts(afterTraining)
  );
  const scheduler = buildSchedulerStats(effectiveReportDate, runtimeHistory);
  const minimumDaysRequiredForApprovalOnly = 5;
  const minimumDaysRequiredForWalletSignOnly = 10;
  const enoughDaysForApprovalOnly = breakdown.length >= minimumDaysRequiredForApprovalOnly;
  const enoughDaysForWalletSignOnly = breakdown.length >= minimumDaysRequiredForWalletSignOnly;
  const schedulerHealthyForApprovalOnly =
    scheduler.last7DayCoverage !== null && scheduler.last7DayCoverage >= 0.7;
  const schedulerHealthyForWalletSignOnly =
    scheduler.last7DayCoverage !== null && scheduler.last7DayCoverage >= 0.85;

  const reasons: string[] = [];
  let roleMode: DailyStabilityReport["recommendation"]["roleMode"] = "manual_coaching";

  if (approvalRate !== null && publicationRate !== null && falsePositiveTopPickRate !== null) {
    if (
      enoughDaysForApprovalOnly &&
      schedulerHealthyForApprovalOnly &&
      approvalRate >= 0.7 &&
      falsePositiveTopPickRate <= 0.2
    ) {
      roleMode = "approval_and_sign_only";
      reasons.push("Top picks are approving often enough to reduce daily coaching.");
    }
    if (
      enoughDaysForWalletSignOnly &&
      schedulerHealthyForWalletSignOnly &&
      approvalRate >= 0.8 &&
      publicationRate >= 0.5 &&
      falsePositiveTopPickRate <= 0.1
    ) {
      roleMode = "wallet_sign_only_candidate";
      reasons.push("Quality metrics are strong enough to consider automating everything except wallet signing.");
    }
  }

  if (!enoughDaysForApprovalOnly) {
    reasons.push(
      `Need at least ${minimumDaysRequiredForApprovalOnly} analyzed days before reducing the operator role.`
    );
  }

  if (!schedulerHealthyForApprovalOnly) {
    reasons.push("Daily GitHub runtime has not yet shown strong enough schedule coverage.");
  }

  if (reasons.length === 0) {
    reasons.push("Need more real daily outcomes before reducing the operator role safely.");
  }

  return {
    kind: "daily_stability_report",
    reportDate: effectiveReportDate,
    generatedAt: new Date().toISOString(),
    datesAnalyzed: breakdown.map((item) => item.reportDate),
    evidence: {
      analyzedDays: breakdown.length,
      topPickDays,
      minimumDaysRequiredForApprovalOnly,
      minimumDaysRequiredForWalletSignOnly
    },
    scheduler,
    totals: {
      filingQuality,
      approvalRate,
      publicationRate,
      falsePositiveTopPickRate,
      trainingDrift
    },
    breakdown,
    recommendation: {
      roleMode,
      reasons
    }
  };
}

export async function saveDailyStabilityReport(
  report: DailyStabilityReport,
  baseDir?: string
): Promise<{ jsonPath: string; markdownPath: string }> {
  const root = resolve(baseDir ?? process.cwd());
  const date = report.reportDate;
  const jsonPath = resolve(root, `data/reports/stability/${date}.json`);
  const markdownPath = resolve(root, `data/reports/stability/${date}.md`);
  const markdown = [
    `# Daily Stability Report: ${date}`,
    "",
    `Generated at: ${report.generatedAt}`,
    `Dates analyzed: ${report.datesAnalyzed.length === 0 ? "none" : report.datesAnalyzed.join(", ")}`,
    "",
    `Analyzed days: ${report.evidence.analyzedDays}`,
    `Top-pick days: ${report.evidence.topPickDays}`,
    `Scheduler consecutive daily runs: ${report.scheduler.consecutiveDailyRuns}`,
    `Scheduler last-7-day coverage: ${report.scheduler.last7DayCoverage ?? "n/a"}`,
    "",
    `Filing quality: ${report.totals.filingQuality ?? "n/a"}`,
    `Approval rate: ${report.totals.approvalRate ?? "n/a"}`,
    `Publication rate: ${report.totals.publicationRate ?? "n/a"}`,
    `False-positive top picks: ${report.totals.falsePositiveTopPickRate ?? "n/a"}`,
    `Training drift: ${report.totals.trainingDrift ?? "n/a"}`,
    "",
    `Recommended role mode: ${report.recommendation.roleMode}`,
    ...report.recommendation.reasons.map((reason) => `- ${reason}`),
    ""
  ].join("\n");

  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(markdownPath, markdown, "utf8");
  return { jsonPath, markdownPath };
}
