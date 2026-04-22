import type { AuditOutput, AuditValidationResult } from "./types.js";

function hasNonEmptyStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.some((entry) => typeof entry === "string" && entry.trim().length > 0);
}

export function validateAuditOutput(output: AuditOutput): AuditValidationResult {
  const failures: string[] = [];

  if (!hasNonEmptyStrings(output.claims)) {
    failures.push("missing_claims");
  }

  if (!hasNonEmptyStrings(output.evidence)) {
    failures.push("missing_evidence");
  }

  return {
    valid: failures.length === 0,
    failures
  };
}
