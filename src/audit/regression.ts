import type { AuditInput, AuditOutput } from "./types.js";
import { evaluateAuditOutput } from "./evaluator.js";

export interface RegressionFixture {
  input: AuditInput;
  oldOutput: AuditOutput;
  newOutput: AuditOutput;
}

export interface RegressionCheckResult {
  passed: boolean;
  oldScore: number;
  newScore: number;
}

export function runRegressionCheck(fixture: RegressionFixture): RegressionCheckResult {
  const oldScore = evaluateAuditOutput(fixture.input, fixture.oldOutput).score;
  const newScore = evaluateAuditOutput(fixture.input, fixture.newOutput).score;
  return {
    passed: newScore >= oldScore,
    oldScore,
    newScore
  };
}
