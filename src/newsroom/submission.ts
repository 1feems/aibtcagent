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

export function buildSubmissionDecision(validation: ValidationResult): SubmissionDecision {
  const rejectionReasons = collectRejectionReasons(validation);

  return {
    status: rejectionReasons.length === 0 ? "submit" : "reject",
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
    headline: subject.headline,
    proof: subject.proof,
    sources: subject.sources,
    modelDisclosure: subject.modelDisclosure,
    validationStatus: validation,
    preSubmissionIntelligence,
    submissionDecision: buildSubmissionDecision(validation),
    outcomeTracking: buildDefaultOutcomeTracking(),
    generatedAt
  };
}
