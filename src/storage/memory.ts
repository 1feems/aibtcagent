import { access, mkdir, writeFile } from "node:fs/promises";
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

async function ensureFileDoesNotExist(filePath: string): Promise<void> {
  try {
    await access(resolve(process.cwd(), filePath));
    throw new Error(`Refusing to overwrite existing log file: ${filePath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) {
      throw error;
    }
  }
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

  const filePath = `data/logs/candidates/${sanitizeId(candidate.candidateId)}.json`;
  await ensureFileDoesNotExist(filePath);
  await writeJson(filePath, record);
}

export async function logRejectedCandidate(
  candidateId: string,
  reasons: string[],
  recordedAt: string
): Promise<void> {
  const record: import("../types/index.js").RejectionLogRecord = {
    kind: "rejection",
    recordedAt,
    candidateId,
    reasons
  };

  const filePath = `data/logs/rejections/${sanitizeId(candidateId)}.json`;
  await ensureFileDoesNotExist(filePath);
  await writeJson(filePath, record);
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

  const filePath = `data/logs/accepted/${sanitizeId(candidateId)}.json`;
  await ensureFileDoesNotExist(filePath);
  await writeJson(filePath, record);
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

  const filePath = `data/outcomes/approvals/${sanitizeId(candidateId)}.json`;
  await ensureFileDoesNotExist(filePath);
  await writeJson(filePath, record);
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

  const filePath = `data/outcomes/rewards/${sanitizeId(candidateId)}.json`;
  await ensureFileDoesNotExist(filePath);
  await writeJson(filePath, record);
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

  const filePath = `data/logs/leaderboard/${sanitizeId(beat)}-${sanitizeId(recordedAt)}.json`;
  await ensureFileDoesNotExist(filePath);
  await writeJson(filePath, record);
}
