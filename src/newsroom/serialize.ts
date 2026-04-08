import type { SubmissionPayload } from "../types/index.js";

function inferStyleTested(payload: SubmissionPayload): string {
  const headline = payload.headline.toLowerCase();
  const context = [
    payload.candidateSignal.summary,
    payload.candidateSignal.significance,
    payload.candidateSignal.causality
  ].join(" ").toLowerCase();

  if ((headline.includes(" and ") || headline.includes(" plus ") || /\b\d[\d,.]*\b.*\b\d[\d,.]*\b/.test(payload.headline)) &&
      /\bupgrade|risk|window|operator|agent|structural|system\b/.test(context)) {
    return "broad_same_beat_operator";
  }

  if (payload.sources.some((source) => source.sourceUrl.includes("github.com")) &&
      /\bupgrade|risk|window|operator|agent|payment|security\b/.test(context)) {
    return "release_operator_consequence";
  }

  if (/\bqueue|bottleneck|concentration|backlog|saturation|structural|threshold\b/.test(context)) {
    return "structural_pattern";
  }

  if (/\b\d[\d,.]*\b/.test(payload.headline) &&
      /\bbefore|early|same day|deadline|activation\b/.test(context)) {
    return "exact_anchor_timing";
  }

  return "single_story_operator_angle";
}

function inferCompetitorReference(payload: SubmissionPayload): string | null {
  const topAgentNote = payload.preSubmissionIntelligence.notes.find((note) =>
    note.startsWith("Repeat-winning brief agent to study:")
  );
  if (topAgentNote) {
    return topAgentNote.replace("Repeat-winning brief agent to study:", "").trim();
  }

  const ownedBeatNote = payload.preSubmissionIntelligence.notes.find((note) =>
    note.startsWith("Competitor-owned beats right now:")
  );
  if (ownedBeatNote) {
    return ownedBeatNote.replace("Competitor-owned beats right now:", "").trim();
  }

  return null;
}

function inferDuplicateStatus(payload: SubmissionPayload): "clear" | "pending" | "flagged" {
  if (payload.candidateSignal.likelyDuplicate) {
    return "flagged";
  }

  if (!payload.validationStatus.checks.duplicateRejected) {
    return "pending";
  }

  return "clear";
}

function inferFreshnessStatus(payload: SubmissionPayload): "clear" | "risk_unresolved" | "unknown" {
  const noteBlob = payload.preSubmissionIntelligence.notes.join(" ").toLowerCase();
  if (/\bstale\b|\bfreshness\b/.test(noteBlob)) {
    return "risk_unresolved";
  }

  return "unknown";
}

function buildWhyThisStyleWasChosen(payload: SubmissionPayload, styleTested: string): string {
  const reasons: string[] = [];

  if (/\b\d[\d,.]*\b/.test(payload.headline)) {
    reasons.push("headline carries a hard numeric anchor");
  }
  if (payload.sources.some((source) => source.sourceUrl.includes("github.com"))) {
    reasons.push("primary proof comes from a release or repo source");
  }
  if (/\bupgrade|risk|window|operator|agent|payment|security\b/i.test(
    `${payload.candidateSignal.significance} ${payload.candidateSignal.causality}`
  )) {
    reasons.push("the story has direct operator consequence");
  }
  if (styleTested === "broad_same_beat_operator") {
    reasons.push("the package is trying to win the beat with a broader story shape");
  }

  return reasons.length > 0
    ? reasons.join("; ")
    : "chosen as the strongest available story shape from the current candidate context";
}

export function serializeSubmissionPayload(payload: SubmissionPayload) {
  const styleTested = payload.candidateMetadata.styleTested || inferStyleTested(payload);
  const competitorReference = payload.candidateMetadata.competitorReference ?? inferCompetitorReference(payload);
  const duplicateStatus = payload.candidateMetadata.duplicateStatus || inferDuplicateStatus(payload);
  const freshnessStatus = payload.candidateMetadata.freshnessStatus || inferFreshnessStatus(payload);
  const whyThisStyleWasChosen =
    payload.candidateMetadata.whyThisStyleWasChosen || buildWhyThisStyleWasChosen(payload, styleTested);

  return {
    candidate_signal: {
      candidate_id: payload.candidateSignal.candidateId,
      detected_at: payload.candidateSignal.detectedAt,
      beat: payload.candidateSignal.beat,
      category: payload.candidateSignal.category,
      summary: payload.candidateSignal.summary,
      significance: payload.candidateSignal.significance,
      causality: payload.candidateSignal.causality,
      detection_method: payload.candidateSignal.detectionMethod,
      uses_dashboard_as_primary_source: payload.candidateSignal.usesDashboardAsPrimarySource,
      likely_duplicate: payload.candidateSignal.likelyDuplicate
    },
    headline: payload.headline,
    proof: payload.proof.map((item) => ({
      chain: item.chain,
      tx_hash: item.txHash,
      contract_address: item.contractAddress,
      query_name: item.queryName,
      query_result: item.queryResult,
      block_height: item.blockHeight,
      proof_note: item.proofNote
    })),
    sources: payload.sources.map((item) => ({
      source_type: item.sourceType,
      source_name: item.sourceName,
      source_url: item.sourceUrl,
      source_role: item.sourceRole
    })),
    model_disclosure: {
      tools_used: payload.modelDisclosure.toolsUsed,
      derivation_steps: payload.modelDisclosure.derivationSteps
    },
    validation_status: {
      passed: payload.validationStatus.passed,
      checks: {
        one_sentence_headline: payload.validationStatus.checks.oneSentenceHeadline,
        onchain_proof_present: payload.validationStatus.checks.onchainProofPresent,
        causality_present: payload.validationStatus.checks.causalityPresent,
        sources_disclosed: payload.validationStatus.checks.sourcesDisclosed,
        model_disclosure_present: payload.validationStatus.checks.modelDisclosurePresent,
        independently_verifiable: payload.validationStatus.checks.independentlyVerifiable,
        dashboard_primary_source_rejected:
          payload.validationStatus.checks.dashboardPrimarySourceRejected,
        duplicate_rejected: payload.validationStatus.checks.duplicateRejected
      }
    },
    pre_submission_intelligence: {
      checks: {
        daily_brief_checked: payload.preSubmissionIntelligence.checks.dailyBriefChecked,
        activity_feed_checked: payload.preSubmissionIntelligence.checks.activityFeedChecked,
        leaderboard_checked: payload.preSubmissionIntelligence.checks.leaderboardChecked,
        reputation_checked: payload.preSubmissionIntelligence.checks.reputationChecked,
        inbox_checked: payload.preSubmissionIntelligence.checks.inboxChecked,
        agent_status_checked: payload.preSubmissionIntelligence.checks.agentStatusChecked
      },
      notes: payload.preSubmissionIntelligence.notes,
      checked_at: payload.preSubmissionIntelligence.checkedAt
    },
    submission_decision: {
      status: payload.submissionDecision.status,
      rejection_reasons: payload.submissionDecision.rejectionReasons
    },
    editorial_review: {
      protocol: payload.editorialReview.protocol,
      fact_checker: payload.editorialReview.factChecker,
      publisher: payload.editorialReview.publisher,
      editorial_fit: payload.editorialReview.editorialFit,
      publisher_confidence: payload.editorialReview.publisherConfidence,
      ready_to_file: payload.editorialReview.readyToFile,
      hold_reasons: payload.editorialReview.holdReasons
    },
    article_preview: {
      title: payload.articlePreview.title,
      dek: payload.articlePreview.dek,
      lede: payload.articlePreview.lede,
      why_it_matters: payload.articlePreview.whyItMatters,
      proof_summary: payload.articlePreview.proofSummary,
      audience: payload.articlePreview.audience
    },
    candidate_metadata: {
      style_tested: styleTested,
      competitor_reference: competitorReference,
      why_this_style_was_chosen: whyThisStyleWasChosen,
      duplicate_status: duplicateStatus,
      freshness_status: freshnessStatus
    },
    outcome_tracking: {
      approved: payload.outcomeTracking.approved,
      btc_reward_earned: payload.outcomeTracking.btcRewardEarned,
      sats_earned: payload.outcomeTracking.satsEarned,
      leaderboard_movement: payload.outcomeTracking.leaderboardMovement,
      streak_or_badge_progress: payload.outcomeTracking.streakOrBadgeProgress
    },
    generated_at: payload.generatedAt
  };
}
