import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { RankedCandidate } from "../scoring/index.js";
import { syncCandidateReplacementEvidence, upsertCandidateHistoryFromQueueItem } from "./candidate-history.js";
import { type CandidateLifecycle, type FilingQueueStatus, transitionLifecycleToQueue } from "./lifecycle.js";
import { runPreSubmitAudit } from "./pre-submit-audit.js";
import { evaluateCandidateSignability, readOperatorSignabilityState } from "./signability.js";

interface FiledSignalsState {
  filedSignals?: Array<{
    signalId?: string | null;
    headline?: string | null;
    beat?: string | null;
    filedAt?: string | null;
    resolved?: boolean;
  }>;
}

interface ObjectiveMemoryForQueue {
  cadenceLimits?: {
    maxSignalsPerDay?: number;
    maxSignalsPerBeatPerMinutes?: number;
  };
  currentStanding?: {
    streak?: string | null;
    gapToTop3?: number | null;
  };
}

export interface FilingQueueItem {
  candidateId: string;
  headline: string;
  beat: string;
  score: number;
  lifecycle: CandidateLifecycle;
  styleTested: string;
  competitorReference: string | null;
  whyThisStyleWasChosen: string;
  duplicateStatus: "clear" | "pending" | "flagged";
  freshnessStatus: "clear" | "risk_unresolved" | "unknown";
  competitorCoverage: Array<{ name: string; headline: string; similarity: number }>;
  sourcePath: string;
  queueStatus: FilingQueueStatus;
  reasons: string[];
}

export interface FilingQueueSnapshot {
  kind: "filing_queue";
  reportDate: string;
  generatedAt: string;
  topCandidateId: string | null;
  recommendationSummary: {
    targetRecommendations: number;
    recommendedCount: number;
    uniqueBeatCount: number;
    beatsRepresented: string[];
    quotaNotes: string[];
  };
  items: FilingQueueItem[];
}

function clearsBriefWinnerThresholdForQueue(candidate: RankedCandidate): boolean {
  if (typeof candidate.obviousBriefWinner === "boolean") {
    return candidate.obviousBriefWinner;
  }

  return candidate.decision === "file";
}

function buildRiskGateReasons(candidate: RankedCandidate): string[] {
  const reasons: string[] = [];

  if (candidate.duplicateStatus === "pending" || candidate.duplicateStatus === "flagged") {
    reasons.push("hard-blocked from signable queue because duplicate risk is unresolved");
  }

  if (candidate.freshnessStatus === "risk_unresolved") {
    reasons.push("hard-blocked from signable queue because freshness risk is unresolved");
  }

  return reasons;
}

async function buildSignabilityGateReasons(
  candidate: RankedCandidate,
  baseDir?: string
): Promise<string[]> {
  const preflight = await readOperatorSignabilityState(baseDir);
  return evaluateCandidateSignability(candidate.beat, preflight).reasons;
}

function isHardBlockedFromSignQueue(candidate: RankedCandidate): boolean {
  return buildRiskGateReasons(candidate).length > 0;
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

async function buildCadenceGateReasons(
  reportDate: string,
  candidate: RankedCandidate,
  baseDir?: string
): Promise<string[]> {
  const root = resolve(baseDir ?? process.cwd());
  const [filedState, objectiveMemory] = await Promise.all([
    readJsonOrNull<FiledSignalsState>(resolve(root, "data/state/filed-signals.json")),
    readJsonOrNull<ObjectiveMemoryForQueue>(resolve(root, "data/state/objective-memory.json"))
  ]);
  const today = new Date().toISOString().slice(0, 10);

  if (!objectiveMemory || reportDate !== today) {
    return [];
  }

  const filedToday = (filedState?.filedSignals ?? []).filter((entry) => entry.filedAt?.slice(0, 10) === reportDate);
  const maxSignalsPerDay = objectiveMemory?.cadenceLimits?.maxSignalsPerDay ?? 6;
  const maxSignalsPerBeatPerMinutes = objectiveMemory?.cadenceLimits?.maxSignalsPerBeatPerMinutes ?? 60;
  const reasons: string[] = [];

  if (filedToday.length >= maxSignalsPerDay) {
    reasons.push(`hard-blocked from signable queue because today's filing limit of ${maxSignalsPerDay} signals is already exhausted`);
  }

  const sameBeatFiled = filedToday
    .filter((entry) => (entry.beat ?? "").trim().toLowerCase() === candidate.beat.trim().toLowerCase())
    .sort((left, right) => (right.filedAt ?? "").localeCompare(left.filedAt ?? ""));
  const latestSameBeat = sameBeatFiled[0] ?? null;
  if (latestSameBeat?.filedAt) {
    const minutesSince = Math.floor((Date.now() - new Date(latestSameBeat.filedAt).getTime()) / 60000);
    if (minutesSince < maxSignalsPerBeatPerMinutes) {
      reasons.push(`hard-blocked from signable queue because beat ${candidate.beat} is still inside the ${maxSignalsPerBeatPerMinutes}-minute cooldown window`);
    }
  }

  return reasons;
}

export async function buildFilingQueue(
  reportDate: string,
  rankedCandidates: RankedCandidate[],
  baseDir?: string
): Promise<FilingQueueSnapshot> {
  const MAX_RECOMMENDATIONS = 6;
  const signabilityReasonsByCandidate = new Map<string, string[]>();

  for (const candidate of rankedCandidates) {
    const reasons = [
      ...buildRiskGateReasons(candidate),
      ...(await buildCadenceGateReasons(reportDate, candidate, baseDir)),
      ...(await buildSignabilityGateReasons(candidate, baseDir)),
      ...(await runPreSubmitAudit(reportDate, candidate, baseDir)).reasons
    ];
    signabilityReasonsByCandidate.set(candidate.candidateId, reasons);
  }

  const eligible = rankedCandidates.filter((candidate) =>
    (signabilityReasonsByCandidate.get(candidate.candidateId)?.length ?? 0) === 0 &&
    candidate.decision === "file" &&
    clearsBriefWinnerThresholdForQueue(candidate)
  );
  const recommended: RankedCandidate[] = [];
  const recommendedIds = new Set<string>();
  const recommendedBeats = new Set<string>();
  const recommendedBeatCounts = new Map<string, number>();
  const quotaNotes: string[] = [];

  for (const candidate of eligible) {
    if (recommended.length >= MAX_RECOMMENDATIONS) {
      break;
    }
    if (recommendedBeats.has(candidate.beat)) {
      continue;
    }
    recommended.push(candidate);
    recommendedIds.add(candidate.candidateId);
    recommendedBeats.add(candidate.beat);
    recommendedBeatCounts.set(candidate.beat, 1);
  }

  for (const candidate of eligible) {
    if (recommended.length >= MAX_RECOMMENDATIONS) {
      break;
    }
    if (recommendedIds.has(candidate.candidateId)) {
      continue;
    }
    const currentBeatCount = recommendedBeatCounts.get(candidate.beat) ?? 0;
    if (currentBeatCount >= 2) {
      continue;
    }
    recommended.push(candidate);
    recommendedIds.add(candidate.candidateId);
    recommendedBeatCounts.set(candidate.beat, currentBeatCount + 1);
  }

  for (const candidate of eligible) {
    if (recommended.length >= MAX_RECOMMENDATIONS) {
      break;
    }
    if (recommendedIds.has(candidate.candidateId)) {
      continue;
    }
    recommended.push(candidate);
    recommendedIds.add(candidate.candidateId);
    recommendedBeatCounts.set(candidate.beat, (recommendedBeatCounts.get(candidate.beat) ?? 0) + 1);
  }

  if (recommended.length < MAX_RECOMMENDATIONS) {
    quotaNotes.push(
      `Only ${recommended.length} recommendation${recommended.length === 1 ? "" : "s"} cleared the obvious-brief-winner threshold and signability review.`
    );
  }
  const objectiveMemory = await readJsonOrNull<ObjectiveMemoryForQueue>(resolve(baseDir ?? process.cwd(), "data/state/objective-memory.json"));
  if (objectiveMemory?.currentStanding?.streak) {
    quotaNotes.push(`Active streak: ${objectiveMemory.currentStanding.streak}. Protect it without spending slots on low-odds filler.`);
  }
  if ((objectiveMemory?.currentStanding?.gapToTop3 ?? null) !== null) {
    quotaNotes.push(`Gap to weekly top-3 line: ${objectiveMemory?.currentStanding?.gapToTop3}. Favor brief-winning candidates over volume.`);
  }
  if (recommendedBeats.size >= 3) {
    quotaNotes.push(`Soft beat quota kept ${recommendedBeats.size} beats represented in the recommendation slate.`);
  } else if (recommended.length > 0) {
    quotaNotes.push("Soft beat quota could not diversify the slate further with the available eligible candidates.");
  }
  if ([...recommendedBeatCounts.values()].some((count) => count > 1)) {
    quotaNotes.push("Second-slot beat repeats were only used after unique-beat options were exhausted.");
  }

  const orderedCandidates = [
    ...recommended,
    ...rankedCandidates.filter((candidate) => !recommendedIds.has(candidate.candidateId))
  ];

  const items: FilingQueueItem[] = orderedCandidates.map((candidate) => {
    const gateReasons = signabilityReasonsByCandidate.get(candidate.candidateId) ?? [];

    if (recommendedIds.has(candidate.candidateId)) {
      const queueStatus: FilingQueueStatus = "awaiting_human_approval";
      return {
        candidateId: candidate.candidateId,
        headline: candidate.headline,
        beat: candidate.beat,
        score: candidate.score,
        lifecycle: transitionLifecycleToQueue(queueStatus),
        styleTested: candidate.styleTested,
        competitorReference: candidate.competitorReference,
        whyThisStyleWasChosen: candidate.whyThisStyleWasChosen,
        duplicateStatus: candidate.duplicateStatus,
        freshnessStatus: candidate.freshnessStatus,
        competitorCoverage: candidate.competitorCoverage,
        sourcePath: candidate.sourcePath,
        queueStatus,
        reasons: recommended.length >= 5
          ? [...candidate.reasons, "selected for the hard-coded daily recommendation slate"]
          : candidate.reasons
      };
    }

    const queueStatus: FilingQueueStatus =
      candidate.decision === "hold" || gateReasons.length > 0
        ? "on_hold"
        : "rejected";

    return {
      candidateId: candidate.candidateId,
      headline: candidate.headline,
      beat: candidate.beat,
      score: candidate.score,
      lifecycle: transitionLifecycleToQueue(
        queueStatus,
        gateReasons.length > 0 ? gateReasons : candidate.reasons
      ),
      styleTested: candidate.styleTested,
      competitorReference: candidate.competitorReference,
      whyThisStyleWasChosen: candidate.whyThisStyleWasChosen,
      duplicateStatus: candidate.duplicateStatus,
      freshnessStatus: candidate.freshnessStatus,
      competitorCoverage: candidate.competitorCoverage,
      sourcePath: candidate.sourcePath,
      queueStatus,
      reasons: gateReasons.length > 0
        ? [...candidate.reasons, ...gateReasons]
        : candidate.reasons
    };
  });

  return {
    kind: "filing_queue",
    reportDate,
    generatedAt: new Date().toISOString(),
    topCandidateId: recommended[0]?.candidateId ?? null,
    recommendationSummary: {
      targetRecommendations: MAX_RECOMMENDATIONS,
      recommendedCount: recommended.length,
      uniqueBeatCount: recommendedBeats.size,
      beatsRepresented: [...recommendedBeats].sort(),
      quotaNotes
    },
    items
  };
}

export async function saveFilingQueue(
  queue: FilingQueueSnapshot,
  baseDir?: string
): Promise<string> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/filing-queue/${queue.reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(queue, null, 2), "utf8");
  for (const item of queue.items) {
    await upsertCandidateHistoryFromQueueItem(queue.reportDate, item, baseDir);
  }
  await syncCandidateReplacementEvidence(queue.reportDate, baseDir);
  return filePath;
}

export async function readFilingQueue(
  reportDate: string,
  baseDir?: string
): Promise<FilingQueueSnapshot> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/filing-queue/${reportDate}.json`);
  return JSON.parse(await readFile(filePath, "utf8")) as FilingQueueSnapshot;
}
