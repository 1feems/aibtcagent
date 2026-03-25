import type { ValidationResult, ValidationChecks, ValidationSubject } from "../types/index.js";

function sentenceCount(headline: string): number {
  return headline
    .trim()
    .split(/[.!?]+/u)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

export function validateOneSentenceHeadline(headline: string): boolean {
  return sentenceCount(headline) === 1;
}

export function validateProof(subject: ValidationSubject): boolean {
  return subject.proof.some((item) => {
    return Boolean(item.txHash || item.contractAddress || item.queryResult);
  });
}

export function validateCausality(subject: ValidationSubject): boolean {
  return subject.candidate.causality.trim().length > 0;
}

export function validateDisclosure(subject: ValidationSubject): boolean {
  const hasSources = subject.sources.length > 0;
  const hasTools = subject.modelDisclosure.toolsUsed.length > 0;
  const hasDerivation = subject.modelDisclosure.derivationSteps.length > 0;

  return hasSources && hasTools && hasDerivation;
}

export function rejectDashboardPrimarySource(subject: ValidationSubject): boolean {
  return !subject.candidate.usesDashboardAsPrimarySource;
}

export function rejectDuplicate(subject: ValidationSubject): boolean {
  return !subject.candidate.likelyDuplicate;
}

export function validateSubject(subject: ValidationSubject): ValidationResult {
  const checks: ValidationChecks = {
    oneSentenceHeadline: validateOneSentenceHeadline(subject.headline),
    onchainProofPresent: validateProof(subject),
    causalityPresent: validateCausality(subject),
    sourcesDisclosed: subject.sources.length > 0,
    modelDisclosurePresent:
      subject.modelDisclosure.toolsUsed.length > 0 &&
      subject.modelDisclosure.derivationSteps.length > 0,
    independentlyVerifiable: validateProof(subject) && subject.sources.length > 0,
    dashboardPrimarySourceRejected: rejectDashboardPrimarySource(subject),
    duplicateRejected: rejectDuplicate(subject)
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks
  };
}
