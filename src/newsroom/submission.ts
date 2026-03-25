import type {
  OutcomeTracking,
  PreSubmissionIntelligence,
  SubmissionDecision,
  SubmissionPayload,
  ValidationResult,
  ValidationSubject
} from "../types/index.js";

function collectRejectionReasons(validation: ValidationResult): string[] {
  const reasons: string[] = [];

  if (!validation.checks.oneSentenceHeadline) {
    reasons.push("headline_not_one_sentence");
  }
  if (!validation.checks.onchainProofPresent) {
    reasons.push("proof_missing");
  }
  if (!validation.checks.causalityPresent) {
    reasons.push("causality_missing");
  }
  if (!validation.checks.sourcesDisclosed) {
    reasons.push("sources_missing");
  }
  if (!validation.checks.modelDisclosurePresent) {
    reasons.push("model_disclosure_missing");
  }
  if (!validation.checks.independentlyVerifiable) {
    reasons.push("not_independently_verifiable");
  }
  if (!validation.checks.dashboardPrimarySourceRejected) {
    reasons.push("dashboard_primary_source");
  }
  if (!validation.checks.duplicateRejected) {
    reasons.push("likely_duplicate");
  }

  return reasons;
}

function collectPreSubmissionFailures(
  preSubmissionIntelligence: PreSubmissionIntelligence
): string[] {
  const reasons: string[] = [];
  const checks = preSubmissionIntelligence.checks;

  if (!checks.dailyBriefChecked) {
    reasons.push("daily_brief_not_checked");
  }
  if (!checks.activityFeedChecked) {
    reasons.push("activity_feed_not_checked");
  }
  if (!checks.leaderboardChecked) {
    reasons.push("leaderboard_not_checked");
  }
  if (!checks.reputationChecked) {
    reasons.push("reputation_not_checked");
  }
  if (!checks.inboxChecked) {
    reasons.push("inbox_not_checked");
  }
  if (!checks.agentStatusChecked) {
    reasons.push("agent_status_not_checked");
  }

  return reasons;
}

export function buildSubmissionDecision(
  validation: ValidationResult,
  preSubmissionIntelligence: PreSubmissionIntelligence
): SubmissionDecision {
  const rejectionReasons = [
    ...collectRejectionReasons(validation),
    ...collectPreSubmissionFailures(preSubmissionIntelligence)
  ];

  return {
    status: validation.passed && rejectionReasons.length === 0 ? "submit" : "reject",
    rejectionReasons
  };
}

export function buildDefaultOutcomeTracking(): OutcomeTracking {
  return {
    approved: null,
    btcRewardEarned: null,
    satsEarned: null,
    leaderboardMovement: null,
    streakOrBadgeProgress: []
  };
}

export function buildSubmissionPayload(
  subject: ValidationSubject,
  validation: ValidationResult,
  preSubmissionIntelligence: PreSubmissionIntelligence,
  generatedAt: string
): SubmissionPayload {
  return {
    candidateSignal: subject.candidate,
    headline: subject.headline,
    proof: subject.proof,
    sources: subject.sources,
    modelDisclosure: subject.modelDisclosure,
    validationStatus: validation,
    preSubmissionIntelligence,
    submissionDecision: buildSubmissionDecision(validation, preSubmissionIntelligence),
    outcomeTracking: buildDefaultOutcomeTracking(),
    generatedAt
  };
}
