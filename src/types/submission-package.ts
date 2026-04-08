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

export interface EditorialRoleReview {
  status: "pass" | "warn" | "fail";
  notes: string[];
}

export interface EditorialReview {
  protocol: EditorialRoleReview;
  factChecker: EditorialRoleReview;
  publisher: EditorialRoleReview;
  editorialFit: "strong" | "borderline" | "weak";
  publisherConfidence: "high" | "medium" | "low";
  readyToFile: boolean;
  holdReasons: string[];
}

export interface ArticlePreview {
  title: string;
  dek: string;
  lede: string;
  whyItMatters: string;
  proofSummary: string;
  audience: "human";
}

export interface CandidateMetadata {
  styleTested: string;
  competitorReference: string | null;
  whyThisStyleWasChosen: string;
  duplicateStatus: "clear" | "pending" | "flagged";
  freshnessStatus: "clear" | "risk_unresolved" | "unknown";
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
  editorialReview: EditorialReview;
  articlePreview: ArticlePreview;
  candidateMetadata: CandidateMetadata;
  outcomeTracking: OutcomeTracking;
  generatedAt: string;
}
