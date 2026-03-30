import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { RankedCandidate } from "../scoring/index.js";
import type { PublishabilityStatus } from "./publishability.js";

export interface FilingQueueItem {
  candidateId: string;
  headline: string;
  beat: string;
  filingBeatSlug: string;
  score: number;
  styleTested: string;
  competitorReference: string | null;
  whyThisStyleWasChosen: string;
  duplicateStatus: "clear" | "pending" | "flagged";
  freshnessStatus: "clear" | "risk_unresolved" | "unknown";
  publishabilityStatus: PublishabilityStatus;
  publishabilityReasons: string[];
  competitivenessStatus: "competitive" | "valid_but_not_competitive";
  competitivenessReasons: string[];
  competitorCoverage: Array<{ name: string; headline: string; similarity: number }>;
  sourcePath: string;
  queueStatus:
    | "awaiting_human_approval"
    | "approved_for_filing"
    | "filed"
    | "on_hold"
    | "rejected";
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

function buildRiskGateReasons(candidate: RankedCandidate): string[] {
  const reasons: string[] = [];

  if (candidate.duplicateStatus === "pending" || candidate.duplicateStatus === "flagged") {
    reasons.push("hard-blocked from signable queue because duplicate risk is unresolved");
  }

  if (candidate.freshnessStatus === "risk_unresolved") {
    reasons.push("hard-blocked from signable queue because freshness risk is unresolved");
  }

  if ((candidate.publishabilityStatus ?? "publishable") !== "publishable") {
    reasons.push("hard-blocked from signable queue because publishability preflight did not pass");
    reasons.push(...(candidate.publishabilityReasons ?? []));
  }

  if ((candidate.competitivenessStatus ?? "competitive") !== "competitive") {
    reasons.push("hard-blocked from signable queue because editorial competitiveness contract did not pass");
    reasons.push(...(candidate.competitivenessReasons ?? []));
  }

  return reasons;
}

function isHardBlockedFromSignQueue(candidate: RankedCandidate): boolean {
  return buildRiskGateReasons(candidate).length > 0;
}

export async function buildFilingQueue(
  reportDate: string,
  rankedCandidates: RankedCandidate[],
  baseDir?: string
): Promise<FilingQueueSnapshot> {
  const MAX_RECOMMENDATIONS = 5;
  const eligible = rankedCandidates.filter((candidate) =>
    !isHardBlockedFromSignQueue(candidate) &&
    candidate.decision === "file"
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
      `Only ${recommended.length} recommendation${recommended.length === 1 ? "" : "s"} survived signable-quality and diversity review.`
    );
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
    const riskGateReasons = buildRiskGateReasons(candidate);

    if (recommendedIds.has(candidate.candidateId)) {
      return {
        candidateId: candidate.candidateId,
        headline: candidate.headline,
        beat: candidate.beat,
        filingBeatSlug: candidate.filingBeatSlug ?? candidate.beat,
        score: candidate.score,
        styleTested: candidate.styleTested,
        competitorReference: candidate.competitorReference,
        whyThisStyleWasChosen: candidate.whyThisStyleWasChosen,
        duplicateStatus: candidate.duplicateStatus,
        freshnessStatus: candidate.freshnessStatus,
        publishabilityStatus: candidate.publishabilityStatus ?? "publishable",
        publishabilityReasons: candidate.publishabilityReasons ?? [],
        competitivenessStatus: candidate.competitivenessStatus ?? "competitive",
        competitivenessReasons: candidate.competitivenessReasons ?? [],
        competitorCoverage: candidate.competitorCoverage,
        sourcePath: candidate.sourcePath,
        queueStatus: "awaiting_human_approval",
        reasons: recommended.length >= 5
          ? [...candidate.reasons, "selected for the hard-coded daily recommendation slate"]
          : candidate.reasons
      };
    }

    const queueStatus =
      candidate.decision === "hold" || riskGateReasons.length > 0
        ? "on_hold"
        : "rejected";

    return {
      candidateId: candidate.candidateId,
      headline: candidate.headline,
      beat: candidate.beat,
      filingBeatSlug: candidate.filingBeatSlug ?? candidate.beat,
      score: candidate.score,
      styleTested: candidate.styleTested,
      competitorReference: candidate.competitorReference,
      whyThisStyleWasChosen: candidate.whyThisStyleWasChosen,
      duplicateStatus: candidate.duplicateStatus,
      freshnessStatus: candidate.freshnessStatus,
      publishabilityStatus: candidate.publishabilityStatus ?? "publishable",
      publishabilityReasons: candidate.publishabilityReasons ?? [],
      competitivenessStatus: candidate.competitivenessStatus ?? "competitive",
      competitivenessReasons: candidate.competitivenessReasons ?? [],
      competitorCoverage: candidate.competitorCoverage,
      sourcePath: candidate.sourcePath,
      queueStatus,
      reasons: riskGateReasons.length > 0
        ? [...candidate.reasons, ...riskGateReasons]
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
  return filePath;
}

export async function readFilingQueue(
  reportDate: string,
  baseDir?: string
): Promise<FilingQueueSnapshot> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/filing-queue/${reportDate}.json`);
  return JSON.parse(await readFile(filePath, "utf8")) as FilingQueueSnapshot;
}
