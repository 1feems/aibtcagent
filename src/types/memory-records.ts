import type { CandidateSignal } from "./candidate-signal.js";
import type { SubmissionPayload } from "./submission-package.js";

export interface CandidateLogRecord {
  kind: "candidate";
  recordedAt: string;
  candidate: CandidateSignal;
}

export interface RejectionLogRecord {
  kind: "rejection";
  recordedAt: string;
  candidateId: string;
  reasons: string[];
}

export interface AcceptedSubmissionRecord {
  kind: "accepted_submission";
  recordedAt: string;
  candidateId: string;
  submission: SubmissionPayload;
}

export interface ApprovalOutcomeRecord {
  kind: "approval_outcome";
  recordedAt: string;
  candidateId: string;
  approved: boolean;
  note: string | null;
}

export interface RewardOutcomeRecord {
  kind: "reward_outcome";
  recordedAt: string;
  candidateId: string;
  satsEarned: number | null;
  btcRewardEarned: string | null;
}

export interface LeaderboardObservationRecord {
  kind: "leaderboard_observation";
  recordedAt: string;
  beat: string;
  leaderboardMovement: string | null;
  notes: string[];
}
