import type {
  ArticlePreview,
  CandidateMetadata,
  EditorialReview,
  EditorialRoleReview,
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

function buildRoleReview(status: EditorialRoleReview["status"], notes: string[]): EditorialRoleReview {
  return { status, notes };
}

function proofAnchorLabel(subject: ValidationSubject): string {
  const firstProof = subject.proof[0];

  if (!firstProof) {
    return "the candidate";
  }

  return (
    firstProof.contractAddress ??
    firstProof.txHash ??
    firstProof.queryName ??
    "the candidate"
  );
}

export function buildEditorialReview(
  subject: ValidationSubject,
  validation: ValidationResult,
  preSubmissionIntelligence: PreSubmissionIntelligence,
  submissionDecision: SubmissionDecision
): EditorialReview {
  const protocolNotes: string[] = [];
  const factCheckerNotes: string[] = [];
  const publisherNotes: string[] = [];

  protocolNotes.push(`Candidate fits the ${subject.candidate.beat} beat.`);

  if (validation.checks.onchainProofPresent) {
    protocolNotes.push("Exact proof is attached to a specific contract, transaction, or versioned release.");
  } else {
    protocolNotes.push("Missing exact proof for a protocol beat submission.");
  }

  if (validation.checks.causalityPresent) {
    protocolNotes.push("Causal trigger is stated rather than implied.");
  } else {
    protocolNotes.push("Causality is too weak for a differentiated protocol update.");
  }

  if (validation.checks.independentlyVerifiable) {
    factCheckerNotes.push("Proof and sources appear independently verifiable.");
  } else {
    factCheckerNotes.push("Independent verification is too weak for fact-checker confidence.");
  }

  if (validation.checks.sourcesDisclosed) {
    factCheckerNotes.push("Source disclosure is present.");
  } else {
    factCheckerNotes.push("Source disclosure is incomplete.");
  }

  if (preSubmissionIntelligence.checks.dailyBriefChecked) {
    factCheckerNotes.push("Daily brief review was recorded.");
  } else {
    factCheckerNotes.push("Daily brief review is missing.");
  }

  if (preSubmissionIntelligence.checks.activityFeedChecked) {
    factCheckerNotes.push("Activity feed review was recorded.");
  } else {
    factCheckerNotes.push("Activity feed review is missing.");
  }

  if (!subject.candidate.usesDashboardAsPrimarySource) {
    publisherNotes.push("Signal is not framed as a dashboard recap.");
  } else {
    publisherNotes.push("Signal reads too much like a dashboard-first observation.");
  }

  if (!subject.candidate.likelyDuplicate) {
    publisherNotes.push("No duplicate flag was raised by the current pipeline.");
  } else {
    publisherNotes.push("Duplicate risk is elevated.");
  }

  if (subject.headline.length <= 140) {
    publisherNotes.push("Headline is concise enough for a newsroom-style signal.");
  } else {
    publisherNotes.push("Headline may be too long for a sharp publisher-facing signal.");
  }

  if (
    subject.candidate.significance.toLowerCase().includes("before") ||
    subject.candidate.significance.toLowerCase().includes("early") ||
    subject.candidate.significance.toLowerCase().includes("same day")
  ) {
    publisherNotes.push("Significance claims the event is early relative to broader visibility.");
  } else {
    publisherNotes.push("Early/non-obvious edge is not stated strongly enough.");
  }

  const protocolStatus: EditorialRoleReview["status"] =
    validation.checks.onchainProofPresent && validation.checks.causalityPresent
      ? "pass"
      : "fail";

  const factCheckerStatus: EditorialRoleReview["status"] =
    validation.checks.independentlyVerifiable &&
    validation.checks.sourcesDisclosed &&
    preSubmissionIntelligence.checks.dailyBriefChecked &&
    preSubmissionIntelligence.checks.activityFeedChecked
      ? "pass"
      : "fail";

  let publisherStatus: EditorialRoleReview["status"] = "pass";
  if (subject.candidate.usesDashboardAsPrimarySource || subject.candidate.likelyDuplicate) {
    publisherStatus = "fail";
  } else if (
    subject.headline.length > 140 ||
    !(
      subject.candidate.significance.toLowerCase().includes("before") ||
      subject.candidate.significance.toLowerCase().includes("early") ||
      subject.candidate.significance.toLowerCase().includes("same day")
    )
  ) {
    publisherStatus = "warn";
  }

  const holdReasons: string[] = [];
  if (submissionDecision.status !== "submit") {
    holdReasons.push("technical_submission_gate_failed");
  }
  if (protocolStatus !== "pass") {
    holdReasons.push("protocol_editorial_gate_failed");
  }
  if (factCheckerStatus !== "pass") {
    holdReasons.push("fact_checker_gate_failed");
  }
  if (publisherStatus === "fail") {
    holdReasons.push("publisher_gate_failed");
  }
  if (publisherStatus === "warn") {
    holdReasons.push("publisher_review_needed");
  }

  const readyToFile = holdReasons.length === 0;
  const editorialFit =
    protocolStatus === "pass" && factCheckerStatus === "pass" && publisherStatus === "pass"
      ? "strong"
      : protocolStatus === "fail" || factCheckerStatus === "fail" || publisherStatus === "fail"
        ? "weak"
        : "borderline";
  const publisherConfidence =
    readyToFile ? "high" : publisherStatus === "warn" && submissionDecision.status === "submit"
      ? "medium"
      : "low";

  return {
    protocol: buildRoleReview(protocolStatus, protocolNotes),
    factChecker: buildRoleReview(factCheckerStatus, factCheckerNotes),
    publisher: buildRoleReview(publisherStatus, publisherNotes),
    editorialFit,
    publisherConfidence,
    readyToFile,
    holdReasons
  };
}

function trimSentence(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildArticlePreview(
  subject: ValidationSubject,
  generatedAt: string
): ArticlePreview {
  const firstProof = subject.proof[0];
  const title = trimSentence(subject.headline);
  const dek = trimSentence(
    `${subject.candidate.summary} ${subject.candidate.significance.charAt(0).toUpperCase()}${subject.candidate.significance.slice(1)}.`
  );
  const lede = trimSentence(
    `${subject.candidate.summary} ${subject.candidate.causality.charAt(0).toUpperCase()}${subject.candidate.causality.slice(1)}.`
  );
  const whyItMatters = trimSentence(subject.candidate.significance);
  const proofSummary = trimSentence(firstProof
    ? `Proof anchor: ${proofAnchorLabel(subject)} on ${firstProof.chain}, reviewed at ${generatedAt}.`
    : `Proof anchor: ${subject.candidate.candidateId}, reviewed at ${generatedAt}.`);

  return {
    title,
    dek,
    lede,
    whyItMatters,
    proofSummary,
    audience: "human"
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

export function buildDefaultCandidateMetadata(): CandidateMetadata {
  return {
    styleTested: "",
    competitorReference: null,
    whyThisStyleWasChosen: "",
    duplicateStatus: "clear",
    freshnessStatus: "unknown"
  };
}

export function buildSubmissionPayload(
  subject: ValidationSubject,
  validation: ValidationResult,
  preSubmissionIntelligence: PreSubmissionIntelligence,
  generatedAt: string
): SubmissionPayload {
  const submissionDecision = buildSubmissionDecision(validation, preSubmissionIntelligence);
  const editorialReview = buildEditorialReview(
    subject,
    validation,
    preSubmissionIntelligence,
    submissionDecision
  );
  const articlePreview = buildArticlePreview(subject, generatedAt);

  return {
    candidateSignal: subject.candidate,
    headline: subject.headline,
    proof: subject.proof,
    sources: subject.sources,
    modelDisclosure: subject.modelDisclosure,
    validationStatus: validation,
    preSubmissionIntelligence,
    submissionDecision,
    editorialReview,
    articlePreview,
    candidateMetadata: buildDefaultCandidateMetadata(),
    outcomeTracking: buildDefaultOutcomeTracking(),
    generatedAt
  };
}
