import type { ValidationResult, ValidationChecks, ValidationSubject } from "../types/index.js";

function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    return Array.from(segmenter.segment(trimmed))
      .map((segment) => segment.segment.trim())
      .filter(Boolean);
  }

  return trimmed
    .split(/(?<=[!?])\s+|(?<!\d)\.(?=\s|$)/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function validateOneSentenceHeadline(headline: string): boolean {
  return splitIntoSentences(headline).length === 1;
}

function isValidTxHash(txHash: string | null): boolean {
  if (!txHash) {
    return false;
  }

  return /^0x[a-fA-F0-9]{64}$/u.test(txHash);
}

export function validateProof(subject: ValidationSubject): boolean {
  return subject.proof.some((item) => {
    return Boolean(isValidTxHash(item.txHash) || item.contractAddress || item.queryResult);
  });
}

export function validateCausality(subject: ValidationSubject): boolean {
  return subject.candidate.causality.trim().length > 0;
}

export function validateDisclosure(subject: ValidationSubject): boolean {
  return validateSourcesDisclosed(subject) && validateModelDisclosure(subject);
}

export function validateSourcesDisclosed(subject: ValidationSubject): boolean {
  return subject.sources.length > 0;
}

export function validateModelDisclosure(subject: ValidationSubject): boolean {
  const hasTools = subject.modelDisclosure.toolsUsed.length > 0;
  const hasDerivation = subject.modelDisclosure.derivationSteps.length > 0;

  return hasTools && hasDerivation;
}

export function rejectDashboardPrimarySource(subject: ValidationSubject): boolean {
  return !subject.candidate.usesDashboardAsPrimarySource;
}

export function rejectDuplicate(subject: ValidationSubject): boolean {
  return !subject.candidate.likelyDuplicate;
}

export function validateSubject(subject: ValidationSubject): ValidationResult {
  const proofPresent = validateProof(subject);
  const causalityPresent = validateCausality(subject);
  const sourcesDisclosed = validateSourcesDisclosed(subject);
  const modelDisclosurePresent = validateModelDisclosure(subject);

  const checks: ValidationChecks = {
    oneSentenceHeadline: validateOneSentenceHeadline(subject.headline),
    onchainProofPresent: proofPresent,
    causalityPresent,
    sourcesDisclosed,
    modelDisclosurePresent,
    independentlyVerifiable: proofPresent && sourcesDisclosed,
    dashboardPrimarySourceRejected: rejectDashboardPrimarySource(subject),
    duplicateRejected: rejectDuplicate(subject)
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks
  };
}
