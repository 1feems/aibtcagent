import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  AcceptedSubmissionRecord,
  ApprovalOutcomeRecord,
  CandidateLogRecord,
  CandidateSignal,
  LeaderboardObservationRecord,
  RewardOutcomeRecord,
  SubmissionPayload
} from "../types/index.js";

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const absolutePath = resolve(process.cwd(), filePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(data, null, 2));
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

export async function logDetectedCandidate(
  candidate: CandidateSignal,
  recordedAt: string
): Promise<void> {
  const record: CandidateLogRecord = {
    kind: "candidate",
    recordedAt,
    candidate
  };

  await writeJson(`data/logs/candidates/${sanitizeId(candidate.candidateId)}.json`, record);
}

export async function logRejectedCandidate(
  candidateId: string,
  reasons: string[],
  recordedAt: string
): Promise<void> {
  const record = {
    kind: "rejection",
    recordedAt,
    candidateId,
    reasons
  };

  await writeJson(`data/logs/rejections/${sanitizeId(candidateId)}.json`, record);
}

export async function logAcceptedSubmission(
  candidateId: string,
  submission: SubmissionPayload,
  recordedAt: string
): Promise<void> {
  const record: AcceptedSubmissionRecord = {
    kind: "accepted_submission",
    recordedAt,
    candidateId,
    submission
  };

  await writeJson(`data/logs/accepted/${sanitizeId(candidateId)}.json`, record);
}

export async function logApprovalOutcome(
  candidateId: string,
  approved: boolean,
  note: string | null,
  recordedAt: string
): Promise<void> {
  const record: ApprovalOutcomeRecord = {
    kind: "approval_outcome",
    recordedAt,
    candidateId,
    approved,
    note
  };

  await writeJson(`data/outcomes/approvals/${sanitizeId(candidateId)}.json`, record);
}

export async function logRewardOutcome(
  candidateId: string,
  satsEarned: number | null,
  btcRewardEarned: string | null,
  recordedAt: string
): Promise<void> {
  const record: RewardOutcomeRecord = {
    kind: "reward_outcome",
    recordedAt,
    candidateId,
    satsEarned,
    btcRewardEarned
  };

  await writeJson(`data/outcomes/rewards/${sanitizeId(candidateId)}.json`, record);
}

export async function logLeaderboardObservation(
  beat: string,
  leaderboardMovement: string | null,
  notes: string[],
  recordedAt: string
): Promise<void> {
  const record: LeaderboardObservationRecord = {
    kind: "leaderboard_observation",
    recordedAt,
    beat,
    leaderboardMovement,
    notes
  };

  await writeJson(`data/logs/leaderboard/${sanitizeId(beat)}-${sanitizeId(recordedAt)}.json`, record);
}
