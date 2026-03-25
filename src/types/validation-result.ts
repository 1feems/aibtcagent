export interface ValidationChecks {
  oneSentenceHeadline: boolean;
  onchainProofPresent: boolean;
  causalityPresent: boolean;
  sourcesDisclosed: boolean;
  modelDisclosurePresent: boolean;
  independentlyVerifiable: boolean;
  dashboardPrimarySourceRejected: boolean;
  duplicateRejected: boolean;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationChecks;
}
