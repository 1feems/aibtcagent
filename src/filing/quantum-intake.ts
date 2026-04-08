import type { QuantumMapSnapshot } from "./quantum-map.js";
import { locateQuantumSubject } from "./quantum-map.js";

export interface QuantumCandidateIntake {
  candidateId: string;
  intakedAt: string;
  headline: string;
  beat: "quantum";
  subjectName: string;
  signalType: "quantum_signal" | "score_update_signal";
  currentMapScore: number | null;
  proposedScore: number | null;
  primarySourceUrl: string;
  mapEntryFound: boolean;
  readyToFile: boolean;
  gateFailReason: string | null;
}

export function evaluateQuantumCandidate(
  source: {
    candidateId: string;
    headline: string;
    subjectName: string;
    signalType: "quantum_signal" | "score_update_signal";
    proposedScore: number | null;
    primarySourceUrl: string;
  },
  snapshot: QuantumMapSnapshot
): QuantumCandidateIntake {
  const located = locateQuantumSubject(snapshot, source.subjectName);
  const currentMapScore = located?.quantum_urgency_score ?? null;
  const mapEntryFound = located !== null;

  let gateFailReason: string | null = null;

  if (source.signalType === "score_update_signal" && !mapEntryFound) {
    gateFailReason = `subject "${source.subjectName}" not found in live quantum map dataset`;
  } else if (source.signalType === "score_update_signal" && currentMapScore === null) {
    gateFailReason = `live dataset entry for "${source.subjectName}" has no readable score`;
  } else if (!source.primarySourceUrl) {
    gateFailReason = "missing primarySourceUrl";
  }

  return {
    candidateId: source.candidateId,
    intakedAt: new Date().toISOString(),
    headline: source.headline,
    beat: "quantum",
    subjectName: source.subjectName,
    signalType: source.signalType,
    currentMapScore,
    proposedScore: source.proposedScore,
    primarySourceUrl: source.primarySourceUrl,
    mapEntryFound,
    readyToFile: gateFailReason === null,
    gateFailReason
  };
}
