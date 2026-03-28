import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { DailyOptimizationSnapshot } from "../types/index.js";

interface SerializedSubmission {
  candidate_signal: {
    candidate_id: string;
    beat: string;
    likely_duplicate: boolean;
    uses_dashboard_as_primary_source: boolean;
    significance: string;
  };
  headline: string;
  submission_decision: {
    status: "submit" | "reject";
    rejection_reasons: string[];
  };
  editorial_review: {
    editorial_fit: "strong" | "borderline" | "weak";
    publisher_confidence: "high" | "medium" | "low";
    ready_to_file: boolean;
    hold_reasons: string[];
  };
}

export interface RankedCandidate {
  candidateId: string;
  beat: string;
  headline: string;
  score: number;
  decision: "file" | "hold" | "reject";
  reasons: string[];
  sourcePath: string;
}

function normalizeScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

async function readOptimizationSnapshot(
  reportDate: string,
  baseDir?: string
): Promise<DailyOptimizationSnapshot | null> {
  const filePath = resolve(
    baseDir ?? process.cwd(),
    `data/experiments/optimization/${reportDate}.json`
  );

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as DailyOptimizationSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function isManualCheckOnly(rejectionReasons: string[]): boolean {
  return rejectionReasons.length > 0 && rejectionReasons.every((reason) =>
    [
      "leaderboard_not_checked",
      "reputation_not_checked",
      "inbox_not_checked",
      "agent_status_not_checked"
    ].includes(reason)
  );
}

function scoreCandidate(
  submission: SerializedSubmission,
  optimization: DailyOptimizationSnapshot | null
): Omit<RankedCandidate, "sourcePath"> {
  let score = 50;
  const reasons: string[] = [];

  if (submission.submission_decision.status === "submit") {
    score += 20;
    reasons.push("submission gate passed");
  } else if (isManualCheckOnly(submission.submission_decision.rejection_reasons)) {
    score += 5;
    reasons.push("only blocked by manual pre-submission checks");
  } else {
    score -= 30;
    reasons.push("submission gate failed on substantive checks");
  }

  if (submission.editorial_review.ready_to_file) {
    score += 15;
    reasons.push("editorial review says ready to file");
  }

  if (submission.editorial_review.editorial_fit === "strong") {
    score += 10;
    reasons.push("strong editorial fit");
  } else if (submission.editorial_review.editorial_fit === "borderline") {
    score += 2;
    reasons.push("borderline editorial fit");
  } else {
    score -= 12;
    reasons.push("weak editorial fit");
  }

  if (submission.editorial_review.publisher_confidence === "high") {
    score += 10;
  } else if (submission.editorial_review.publisher_confidence === "medium") {
    score += 4;
  } else {
    score -= 8;
    reasons.push("low publisher confidence");
  }

  if (submission.headline.length <= 110) {
    score += 4;
  } else if (submission.headline.length > 140) {
    score -= 10;
    reasons.push("headline too long");
  }

  if (
    /\bbefore\b|\bearly\b|\bsame day\b/i.test(submission.candidate_signal.significance)
  ) {
    score += 5;
    reasons.push("significance claims timing or novelty edge");
  }

  if (submission.candidate_signal.likely_duplicate) {
    score -= 20;
    reasons.push("duplicate risk already flagged");
  }

  if (submission.candidate_signal.uses_dashboard_as_primary_source) {
    score -= 15;
    reasons.push("dashboard-first sourcing risk");
  }

  const beatPreference = optimization?.beatPreferences.find(
    (item) => item.beat === submission.candidate_signal.beat
  );

  if (beatPreference?.preference === "increase") {
    score += 10;
    reasons.push(`beat ${beatPreference.beat} is producing published wins`);
  } else if (beatPreference?.preference === "decrease") {
    score -= 10;
    reasons.push(`beat ${beatPreference.beat} is currently crowded or underperforming`);
  }

  const normalized = normalizeScore(score);
  const decision: RankedCandidate["decision"] =
    normalized >= 75
      ? "file"
      : normalized >= 45
        ? "hold"
        : "reject";

  return {
    candidateId: submission.candidate_signal.candidate_id,
    beat: submission.candidate_signal.beat,
    headline: submission.headline,
    score: normalized,
    decision,
    reasons
  };
}

export async function rankDryRunCandidates(
  reportDate: string,
  baseDir?: string
): Promise<RankedCandidate[]> {
  const root = resolve(baseDir ?? process.cwd());
  const queueDir = resolve(root, `data/dry-runs/${reportDate}`);
  const optimization = await readOptimizationSnapshot(reportDate, root);

  let fileNames: string[] = [];
  try {
    fileNames = await readdir(queueDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const submissions = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith("-submission.json"))
      .map(async (fileName) => {
        const sourcePath = resolve(queueDir, fileName);
        const submission = JSON.parse(
          await readFile(sourcePath, "utf8")
        ) as SerializedSubmission;
        return {
          ...scoreCandidate(submission, optimization),
          sourcePath
        } satisfies RankedCandidate;
      })
  );

  return submissions.sort(
    (left, right) => right.score - left.score || left.candidateId.localeCompare(right.candidateId)
  );
}

export async function saveRankedCandidateQueue(
  reportDate: string,
  rankedCandidates: RankedCandidate[],
  baseDir?: string
): Promise<string> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/queues/${reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        kind: "ranked_candidate_queue",
        reportDate,
        generatedAt: new Date().toISOString(),
        candidates: rankedCandidates
      },
      null,
      2
    ),
    "utf8"
  );
  return filePath;
}
