import { assessEditorialCompetitiveness } from "../scoring/editorial-contract.js";
import type { FilingReadyArtifactSubmission } from "./artifacts.js";

export interface PublisherCandidateValidationResult {
  valid: boolean;
  reasons: string[];
}

function headlineReadsLikeReleaseArtifact(headline: string): boolean {
  return (
    /^\S+\s+ships\s+/i.test(headline.trim()) ||
    /:\s*v\d+\.\d+/i.test(headline) ||
    /\([0-9a-f]{7,}\)/i.test(headline) ||
    /\(#\d+\)/.test(headline)
  );
}

function validateOneSentenceHeadline(headline: string): boolean {
  const trimmed = headline.trim();
  if (!trimmed) return false;
  if (/[.!?]\s+[A-Z0-9]/.test(trimmed)) return false;
  return !/[\r\n]/.test(trimmed);
}

export function validatePublisherReadySubmission(
  submission: FilingReadyArtifactSubmission
): PublisherCandidateValidationResult {
  const headline = submission.headline?.trim() ?? "";
  const previewTitle = submission.article_preview?.title?.trim() ?? "";
  const previewDek = submission.article_preview?.dek?.trim() ?? "";
  const previewLede = submission.article_preview?.lede?.trim() ?? "";
  const previewWhyItMatters = submission.article_preview?.why_it_matters?.trim() ?? "";
  const previewProofSummary = submission.article_preview?.proof_summary?.trim() ?? "";
  const reasons: string[] = [];

  if (!headline) {
    return {
      valid: false,
      reasons: ["publisher candidate validation failed: headline is missing"]
    };
  }

  if (!validateOneSentenceHeadline(headline)) {
    reasons.push("publisher candidate validation failed: headline must be a single sentence");
  }

  if (headlineReadsLikeReleaseArtifact(headline)) {
    reasons.push("publisher candidate validation failed: headline still reads like a repo-led release artifact");
  }

  if (!previewTitle) {
    reasons.push("publisher candidate validation failed: article_preview.title is missing");
  } else if (headline !== previewTitle) {
    reasons.push("publisher candidate validation failed: article_preview.title must match the publisher headline");
  }

  if (!previewDek) {
    reasons.push("publisher candidate validation failed: article_preview.dek is missing");
  }

  if (!previewLede) {
    reasons.push("publisher candidate validation failed: article_preview.lede is missing");
  }

  if (!previewWhyItMatters) {
    reasons.push("publisher candidate validation failed: article_preview.why_it_matters is missing");
  }

  if (!previewProofSummary) {
    reasons.push("publisher candidate validation failed: article_preview.proof_summary is missing");
  }

  const editorial = assessEditorialCompetitiveness({
    headline,
    summary: submission.candidate_signal?.summary,
    significance: submission.candidate_signal?.significance ?? submission.article_preview?.why_it_matters,
    causality: submission.candidate_signal?.causality ?? submission.article_preview?.lede,
    proofNotes: (submission.proof ?? []).flatMap((item) => [item.proof_note, item.query_result]).filter(
      (value): value is string => typeof value === "string" && value.length > 0
    ),
    sourceTypes: (submission.sources ?? [])
      .map((item) => item.source_type)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
    sourceUrls: (submission.sources ?? [])
      .map((item) => item.source_url)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  });

  if (editorial.status !== "competitive") {
    reasons.push(...editorial.reasons.map((reason) => `publisher candidate validation failed: ${reason}`));
  }

  if (!editorial.humanNewsHeadline) {
    reasons.push("publisher candidate validation failed: headline does not read like a human news line");
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}
