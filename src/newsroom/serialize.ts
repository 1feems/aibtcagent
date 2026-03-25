import type { SubmissionPayload } from "../types/index.js";

export function serializeSubmissionPayload(payload: SubmissionPayload) {
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
