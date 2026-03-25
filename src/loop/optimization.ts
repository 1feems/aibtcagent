import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  AcceptedSubmissionRecord,
  ApprovalOutcomeRecord,
  CandidateLogRecord,
  DailyOptimizationSnapshot,
  DuplicateLossPattern,
  LeaderboardObservationRecord,
  RejectionLogRecord,
  RewardOutcomeRecord,
  WinningHeadlinePattern
} from "../types/index.js";

interface OptimizationOptions {
  baseDir?: string;
}

type DailyRecord =
  | CandidateLogRecord
  | RejectionLogRecord
  | AcceptedSubmissionRecord
  | ApprovalOutcomeRecord
  | RewardOutcomeRecord
  | LeaderboardObservationRecord;

function resolveBaseDir(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd());
}

function isSameDay(timestamp: string, reportDate: string): boolean {
  return timestamp.slice(0, 10) === reportDate;
}

function formatRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }

  return Number((numerator / denominator).toFixed(2));
}

async function readDailyRecords<T extends DailyRecord>(
  relativeDir: string,
  reportDate: string,
  baseDir?: string
): Promise<T[]> {
  const absoluteDir = resolve(resolveBaseDir(baseDir), relativeDir);

  try {
    const fileNames = await readdir(absoluteDir);
    const records = await Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".json"))
        .map(async (fileName) => {
          const contents = await readFile(resolve(absoluteDir, fileName), "utf8");
          return JSON.parse(contents) as T;
        })
    );

    return records.filter((record) => isSameDay(record.recordedAt, reportDate));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readAllRecords<T extends DailyRecord>(
  relativeDir: string,
  baseDir?: string
): Promise<T[]> {
  const absoluteDir = resolve(resolveBaseDir(baseDir), relativeDir);

  try {
    const fileNames = await readdir(absoluteDir);
    return Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".json"))
        .map(async (fileName) => {
          const contents = await readFile(resolve(absoluteDir, fileName), "utf8");
          return JSON.parse(contents) as T;
        })
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function buildWinningHeadlinePatterns(headlines: string[]): WinningHeadlinePattern[] {
  const patternCounts = new Map<string, number>();

  for (const headline of headlines) {
    const normalized = headline.toLowerCase();
    const patterns = new Set<string>();

    if (normalized.includes(" because ")) {
      patterns.add("because-causality");
    }
    if (normalized.includes("which suggests")) {
      patterns.add("which-suggests-significance");
    }
    if (normalized.includes(" before ")) {
      patterns.add("before-advantage");
    }
    if (headline.length <= 90) {
      patterns.add("short-form");
    } else if (headline.length <= 140) {
      patterns.add("full-length");
    }

    if (patterns.size === 0) {
      patterns.add("summary-led");
    }

    for (const pattern of patterns) {
      patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
    }
  }

  return [...patternCounts.entries()]
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((left, right) => right.count - left.count || left.pattern.localeCompare(right.pattern));
}

function buildDuplicateLossPatterns(
  rejections: RejectionLogRecord[],
  beatByCandidateId: Map<string, string>
): DuplicateLossPattern[] {
  const grouped = new Map<string, string[]>();

  for (const rejection of rejections) {
    if (!rejection.reasons.includes("likely_duplicate")) {
      continue;
    }

    const beat = beatByCandidateId.get(rejection.candidateId) ?? "unknown";
    const candidateIds = grouped.get(beat) ?? [];
    candidateIds.push(rejection.candidateId);
    grouped.set(beat, candidateIds);
  }

  return [...grouped.entries()]
    .map(([beat, candidateIds]) => ({
      beat,
      count: candidateIds.length,
      candidateIds: candidateIds.sort()
    }))
    .sort((left, right) => right.count - left.count || left.beat.localeCompare(right.beat));
}

function buildBeatPreferences(
  detections: CandidateLogRecord[],
  submissions: AcceptedSubmissionRecord[],
  approvals: ApprovalOutcomeRecord[],
  duplicateLossPatterns: DuplicateLossPattern[]
): DailyOptimizationSnapshot["beatPreferences"] {
  const beatByCandidateId = new Map<string, string>();
  const allBeats = new Set<string>();

  for (const detection of detections) {
    beatByCandidateId.set(detection.candidate.candidateId, detection.candidate.beat);
    allBeats.add(detection.candidate.beat);
  }

  const detectionCounts = new Map<string, number>();
  const submissionCounts = new Map<string, number>();
  const approvalCounts = new Map<string, number>();
  const duplicateLossCounts = new Map<string, number>();

  for (const detection of detections) {
    detectionCounts.set(
      detection.candidate.beat,
      (detectionCounts.get(detection.candidate.beat) ?? 0) + 1
    );
  }

  for (const submission of submissions) {
    const beat = beatByCandidateId.get(submission.candidateId) ?? submission.submission.candidateSignal.beat;
    allBeats.add(beat);
    submissionCounts.set(beat, (submissionCounts.get(beat) ?? 0) + 1);
  }

  for (const approval of approvals) {
    const beat = beatByCandidateId.get(approval.candidateId);
    if (!beat) {
      continue;
    }

    allBeats.add(beat);
    if (approval.approved) {
      approvalCounts.set(beat, (approvalCounts.get(beat) ?? 0) + 1);
    }
  }

  for (const duplicateLoss of duplicateLossPatterns) {
    allBeats.add(duplicateLoss.beat);
    duplicateLossCounts.set(duplicateLoss.beat, duplicateLoss.count);
  }

  return [...allBeats]
    .sort((left, right) => left.localeCompare(right))
    .map((beat) => {
      const detectionsForBeat = detectionCounts.get(beat) ?? 0;
      const submissionsForBeat = submissionCounts.get(beat) ?? 0;
      const approvalsForBeat = approvalCounts.get(beat) ?? 0;
      const duplicateLossesForBeat = duplicateLossCounts.get(beat) ?? 0;
      const approvalRate = formatRatio(approvalsForBeat, submissionsForBeat);

      if (approvalsForBeat > 0 && duplicateLossesForBeat === 0) {
        return {
          beat,
          detections: detectionsForBeat,
          submissions: submissionsForBeat,
          approvals: approvalsForBeat,
          duplicateLosses: duplicateLossesForBeat,
          approvalRate,
          preference: "increase" as const,
          rationale: "Approvals landed without duplicate losses."
        };
      }

      if (duplicateLossesForBeat > 0 || (submissionsForBeat > 0 && approvalsForBeat === 0)) {
        return {
          beat,
          detections: detectionsForBeat,
          submissions: submissionsForBeat,
          approvals: approvalsForBeat,
          duplicateLosses: duplicateLossesForBeat,
          approvalRate,
          preference: "decrease" as const,
          rationale: duplicateLossesForBeat > 0
            ? "Duplicate pressure suggests this beat is crowded."
            : "Submissions failed to convert into approvals."
        };
      }

      return {
        beat,
        detections: detectionsForBeat,
        submissions: submissionsForBeat,
        approvals: approvalsForBeat,
        duplicateLosses: duplicateLossesForBeat,
        approvalRate,
        preference: "hold" as const,
        rationale: "Outcome data is still limited, so keep the current focus steady."
      };
    });
}

function buildThresholdAdjustment(
  rejections: RejectionLogRecord[],
  submissions: AcceptedSubmissionRecord[],
  approvals: ApprovalOutcomeRecord[],
  duplicateLossPatterns: DuplicateLossPattern[]
): DailyOptimizationSnapshot["rejectionThreshold"] {
  const drivers: string[] = [];
  const approvalsByCandidateId = new Map(approvals.map((record) => [record.candidateId, record]));
  const resolvedSubmissions = submissions.filter((record) => approvalsByCandidateId.has(record.candidateId));
  const resolvedApprovalRate = formatRatio(
    resolvedSubmissions.filter((record) => approvalsByCandidateId.get(record.candidateId)?.approved === true).length,
    resolvedSubmissions.length
  );

  if (duplicateLossPatterns.some((pattern) => pattern.count > 0)) {
    drivers.push("tighten duplicate rejection when a candidate resembles same-day signals");
  }

  const proofOrCausalityFailures = rejections.filter((record) =>
    record.reasons.includes("proof_missing") || record.reasons.includes("causality_missing")
  ).length;

  if (proofOrCausalityFailures > 0 || (resolvedApprovalRate !== null && resolvedApprovalRate < 0.5)) {
    drivers.push("tighten proof and causality thresholds when approval rate slips");
  }

  if (drivers.length === 0) {
    drivers.push("keep current rejection thresholds unchanged until more outcome data lands");
    return { mode: "standard", drivers };
  }

  return { mode: "tightened", drivers };
}

function buildNextDayRecommendations(
  snapshot: Omit<DailyOptimizationSnapshot, "kind" | "generatedAt">
): string[] {
  const recommendations: string[] = [];
  const increasedBeat = snapshot.beatPreferences.find((beat) => beat.preference === "increase");
  const decreasedBeat = snapshot.beatPreferences.find((beat) => beat.preference === "decrease");
  const topDuplicateLoss = snapshot.duplicateLossPatterns[0];
  const topHeadlinePattern = snapshot.winningHeadlinePatterns[0];

  if (increasedBeat) {
    recommendations.push(`Lean harder into ${increasedBeat.beat}; it is the strongest beat from today's outcomes.`);
  }

  if (decreasedBeat) {
    recommendations.push(`Be more selective on ${decreasedBeat.beat} until approval quality or timing improves.`);
  }

  if (snapshot.rejectionThreshold.mode === "tightened") {
    recommendations.push(snapshot.rejectionThreshold.drivers[0]);
  }

  if (topDuplicateLoss) {
    recommendations.push(
      `Watch for duplicate pressure in ${topDuplicateLoss.beat}; ${topDuplicateLoss.count} candidate${topDuplicateLoss.count === 1 ? "" : "s"} lost on duplicate risk today.`
    );
  }

  if (topHeadlinePattern) {
    recommendations.push(
      `Favor ${topHeadlinePattern.pattern} headlines next run because they matched today's approved winners best.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Hold the current setup steady and gather another day of data before adjusting the loop.");
  }

  return recommendations;
}

export async function generateDailyOptimizationSnapshot(
  reportDate: string,
  generatedAt: string,
  options: OptimizationOptions = {}
): Promise<DailyOptimizationSnapshot> {
  const [allDetections, allSubmissions, detections, rejections, submissions, approvals] = await Promise.all([
    readAllRecords<CandidateLogRecord>("data/logs/candidates", options.baseDir),
    readAllRecords<AcceptedSubmissionRecord>("data/logs/accepted", options.baseDir),
    readDailyRecords<CandidateLogRecord>("data/logs/candidates", reportDate, options.baseDir),
    readDailyRecords<RejectionLogRecord>("data/logs/rejections", reportDate, options.baseDir),
    readDailyRecords<AcceptedSubmissionRecord>("data/logs/accepted", reportDate, options.baseDir),
    readDailyRecords<ApprovalOutcomeRecord>("data/outcomes/approvals", reportDate, options.baseDir)
  ]);

  const beatByCandidateId = new Map(
    allDetections.map((record) => [record.candidate.candidateId, record.candidate.beat])
  );
  const submissionsByCandidateId = new Map(
    allSubmissions.map((record) => [record.candidateId, record])
  );
  const approvedHeadlines = submissions
    .filter((submission) => approvals.some((approval) => approval.candidateId === submission.candidateId && approval.approved))
    .map((submission) => submission.submission.headline)
    .concat(
      approvals
        .filter((approval) => approval.approved)
        .map((approval) => submissionsByCandidateId.get(approval.candidateId)?.submission.headline)
        .filter((headline): headline is string => Boolean(headline))
    );

  const duplicateLossPatterns = buildDuplicateLossPatterns(rejections, beatByCandidateId);
  const winningHeadlinePatterns = buildWinningHeadlinePatterns(approvedHeadlines);
  const beatPreferences = buildBeatPreferences(
    detections,
    submissions,
    approvals,
    duplicateLossPatterns
  );
  const rejectionThreshold = buildThresholdAdjustment(
    rejections,
    submissions,
    approvals,
    duplicateLossPatterns
  );

  const baseSnapshot = {
    reportDate,
    beatPreferences,
    rejectionThreshold,
    duplicateLossPatterns,
    winningHeadlinePatterns,
    nextDayRecommendations: [] as string[]
  };

  return {
    kind: "daily_optimization",
    generatedAt,
    ...baseSnapshot,
    nextDayRecommendations: buildNextDayRecommendations(baseSnapshot)
  };
}

export async function saveDailyOptimizationSnapshot(
  snapshot: DailyOptimizationSnapshot,
  options: OptimizationOptions = {}
): Promise<string> {
  const filePath = resolve(
    resolveBaseDir(options.baseDir),
    `data/experiments/optimization/${snapshot.reportDate}.json`
  );
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  return filePath;
}

export async function generateAndSaveDailyOptimizationSnapshot(
  reportDate: string,
  generatedAt: string,
  options: OptimizationOptions = {}
): Promise<{ snapshot: DailyOptimizationSnapshot; savedTo: string }> {
  const snapshot = await generateDailyOptimizationSnapshot(reportDate, generatedAt, options);
  const savedTo = await saveDailyOptimizationSnapshot(snapshot, options);
  return { snapshot, savedTo };
}
