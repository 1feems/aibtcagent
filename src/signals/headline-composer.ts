import type { CandidateSignal } from "../types/index.js";

export const MAX_HEADLINE_LENGTH = 140;

function stripEnding(text: string): string {
  return text.trim().replace(/[.!?]+$/u, "");
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function toSentence(text: string): string {
  const normalized = normalizeWhitespace(stripEnding(text));
  return normalized ? `${normalized}.` : "";
}

function ensureSingleSentence(text: string): string {
  const trimmed = normalizeWhitespace(text);
  if (!trimmed) {
    return "";
  }

  const segments =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(trimmed))
          .map((segment) => normalizeWhitespace(segment.segment))
          .filter(Boolean)
      : trimmed
          .split(/(?<=[!?])\s+|(?<!\d)\.(?=\s|$)/u)
          .map((part) => normalizeWhitespace(part))
          .filter(Boolean);

  const [first] = segments;

  return first ? `${stripEnding(first)}.` : "";
}

export function enforceConciseHeadline(headline: string, maxLength = MAX_HEADLINE_LENGTH): string {
  const singleSentence = ensureSingleSentence(headline);

  if (singleSentence.length <= maxLength) {
    return singleSentence;
  }

  const truncated = singleSentence.slice(0, Math.max(1, maxLength - 1)).replace(/[,\s]+$/u, "");
  return ensureSingleSentence(truncated).slice(0, maxLength);
}

export function buildHeadline(candidate: CandidateSignal, maxLength = MAX_HEADLINE_LENGTH): string {
  const summary = stripEnding(candidate.summary);
  const causality = stripEnding(candidate.causality);
  const significance = stripEnding(candidate.significance);

  const variants = [
    `${summary} because ${causality}`,
    `${summary}, which suggests ${significance}`,
    summary
  ]
    .map(toSentence)
    .filter(Boolean);

  for (const variant of variants) {
    if (variant.length <= maxLength) {
      return variant;
    }
  }

  return enforceConciseHeadline(variants[variants.length - 1] ?? "", maxLength);
}
