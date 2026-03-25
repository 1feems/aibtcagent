import type { CandidateSignal } from "./candidate-signal.js";
import type { ModelDisclosure } from "./model-disclosure.js";
import type { ProofRecord } from "./proof.js";
import type { SourceRecord } from "./source.js";

export interface ValidationSubject {
  candidate: CandidateSignal;
  headline: string;
  proof: ProofRecord[];
  sources: SourceRecord[];
  modelDisclosure: ModelDisclosure;
}
