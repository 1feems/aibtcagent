import { resolve } from "node:path";

export const LIVE_READY_ARTIFACT_DIR = "data/filing-ready";

export interface FilingReadyArtifactSubmission {
  candidate_signal?: {
    candidate_id?: string;
    beat?: string;
    summary?: string;
    significance?: string;
    causality?: string;
  };
  headline?: string;
  article_preview?: {
    title?: string;
    dek?: string;
    lede?: string;
    why_it_matters?: string;
    proof_summary?: string;
  };
  proof?: Array<{
    proof_note?: string;
    query_result?: string;
  }>;
  sources?: Array<{
    source_type?: string;
    source_url?: string;
  }>;
}

export interface FilingReadyArtifact {
  kind: "filing_ready_submission";
  intendedUse?: "live" | "helper_test";
  reportDate: string;
  candidateId: string;
  reviewedBy: string;
  reviewedAt: string;
  sourcePath: string;
  submission: FilingReadyArtifactSubmission;
}

export function resolveLiveReadyArtifactPath(
  reportDate: string,
  candidateId: string,
  baseDir?: string
): string {
  return resolve(baseDir ?? process.cwd(), `${LIVE_READY_ARTIFACT_DIR}/${reportDate}/${candidateId}.json`);
}
