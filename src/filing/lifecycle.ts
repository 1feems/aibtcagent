export type RankedCandidateDecision = "file" | "hold" | "reject";

export type FilingQueueStatus =
  | "awaiting_human_approval"
  | "approved_for_filing"
  | "filed"
  | "on_hold"
  | "rejected";

export type CandidateLifecyclePhase =
  | "sourcing"
  | "scoring"
  | "queue"
  | "approval"
  | "filing";

export type CandidateLifecycleState =
  | "sourced"
  | "scored_for_filing"
  | "held_after_scoring"
  | "rejected_after_scoring"
  | "awaiting_human_approval"
  | "approved_for_filing"
  | "filed"
  | "on_hold"
  | "rejected";

export interface CandidateLifecycle {
  contract: "source_to_signing_v1";
  phase: CandidateLifecyclePhase;
  state: CandidateLifecycleState;
  summary: string;
  blockingReasons: string[];
}

function buildLifecycleSummary(state: CandidateLifecycleState): string {
  switch (state) {
    case "sourced":
      return "Candidate has been sourced and is waiting for scoring.";
    case "scored_for_filing":
      return "Candidate cleared scoring and is eligible for queue review.";
    case "held_after_scoring":
      return "Candidate was held during scoring and needs more work before queueing.";
    case "rejected_after_scoring":
      return "Candidate was rejected during scoring and should not enter the filing queue.";
    case "awaiting_human_approval":
      return "Candidate cleared queue gates and is awaiting explicit human approval.";
    case "approved_for_filing":
      return "Candidate has human approval and is ready for manual wallet signing.";
    case "filed":
      return "Candidate was filed and is now waiting for downstream outcome tracking.";
    case "on_hold":
      return "Candidate is on hold in the filing queue until blocking issues are resolved.";
    case "rejected":
      return "Candidate was rejected from the queue or approval flow and should not be filed.";
  }
}

function toLifecycle(
  phase: CandidateLifecyclePhase,
  state: CandidateLifecycleState,
  blockingReasons: string[]
): CandidateLifecycle {
  return {
    contract: "source_to_signing_v1",
    phase,
    state,
    summary: buildLifecycleSummary(state),
    blockingReasons
  };
}

export function createSourcedCandidateLifecycle(): CandidateLifecycle {
  return toLifecycle("sourcing", "sourced", []);
}

export function createScoredCandidateLifecycle(
  decision: RankedCandidateDecision,
  blockingReasons: string[] = []
): CandidateLifecycle {
  switch (decision) {
    case "file":
      return toLifecycle("scoring", "scored_for_filing", []);
    case "hold":
      return toLifecycle("scoring", "held_after_scoring", blockingReasons);
    case "reject":
      return toLifecycle("scoring", "rejected_after_scoring", blockingReasons);
  }
}

export function transitionLifecycleToQueue(
  queueStatus: FilingQueueStatus,
  blockingReasons: string[] = []
): CandidateLifecycle {
  switch (queueStatus) {
    case "awaiting_human_approval":
      return toLifecycle("queue", "awaiting_human_approval", []);
    case "approved_for_filing":
      return toLifecycle("approval", "approved_for_filing", []);
    case "filed":
      return toLifecycle("filing", "filed", []);
    case "on_hold":
      return toLifecycle("queue", "on_hold", blockingReasons);
    case "rejected":
      return toLifecycle("queue", "rejected", blockingReasons);
  }
}

export function transitionLifecycleToApproval(
  decision: "approve" | "reject"
): CandidateLifecycle {
  if (decision === "approve") {
    return transitionLifecycleToQueue("approved_for_filing");
  }

  return transitionLifecycleToQueue("rejected");
}

export function transitionLifecycleToFiled(): CandidateLifecycle {
  return transitionLifecycleToQueue("filed");
}

export function isAwaitingHumanApproval(lifecycle?: CandidateLifecycle | null): boolean {
  return lifecycle?.state === "awaiting_human_approval";
}

export function inferLifecycleFromDecision(
  decision: RankedCandidateDecision,
  reasons: string[] = []
): CandidateLifecycle {
  return createScoredCandidateLifecycle(
    decision,
    decision === "file" ? [] : reasons
  );
}

export function inferLifecycleFromQueueStatus(
  queueStatus: FilingQueueStatus,
  reasons: string[] = []
): CandidateLifecycle {
  return transitionLifecycleToQueue(
    queueStatus,
    queueStatus === "awaiting_human_approval" || queueStatus === "approved_for_filing" || queueStatus === "filed"
      ? []
      : reasons
  );
}
