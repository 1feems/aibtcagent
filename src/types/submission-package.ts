import type { ModelDisclosure } from "./model-disclosure.js";
import type { OutcomeTracking } from "./outcome-tracking.js";
import type { PreSubmissionIntelligence } from "./pre-submission.js";
import type { ProofRecord } from "./proof.js";
import type { SourceRecord } from "./source.js";
import type { ValidationResult } from "./validation-result.js";
import type { CandidateSignal } from "./candidate-signal.js";

export interface SubmissionDecision {
  status: "submit" | "reject";
  rejectionReasons: string[];
}

export interface SubmissionPayload {
  candidateSignal: CandidateSignal;
  headline: string;
  proof: ProofRecord[];
  sources: SourceRecord[];
  modelDisclosure: ModelDisclosure;
  validationStatus: ValidationResult;
  preSubmissionIntelligence: PreSubmissionIntelligence;
  submissionDecision: SubmissionDecision;
  outcomeTracking: OutcomeTracking;
  generatedAt: string;
}
