import type { AuditEvaluationResult, AuditInput, AuditOutput } from "./types.js";
import { validateAuditOutput } from "./validator.js";

function clampScore(value: number): 1 | 2 | 3 | 4 | 5 {
  if (value <= 1) return 1;
  if (value >= 5) return 5;
  return value as 1 | 2 | 3 | 4 | 5;
}

export function evaluateAuditOutput(input: AuditInput, output: AuditOutput): AuditEvaluationResult {
  const validation = validateAuditOutput(output);
  const failures = [...validation.failures];
  let score = 5;

  if (!validation.valid) {
    score -= validation.failures.length * 2;
  }

  const implications = Array.isArray(output.implications)
    ? output.implications.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    : [];
  if (implications.length === 0) {
    failures.push("missing_implication");
    score -= 1;
  }

  const constraints = input.constraints ?? [];
  if (constraints.length > 0) {
    const flattened = JSON.stringify(output).toLowerCase();
    const unmet = constraints.filter((constraint) => !flattened.includes(constraint.toLowerCase()));
    if (unmet.length > 0) {
      failures.push("constraint_violation");
      score -= 1;
    }
  }

  if ((output.claims ?? []).length > 1) {
    score += 0;
  }

  return {
    score: clampScore(score),
    failures: Array.from(new Set(failures))
  };
}
