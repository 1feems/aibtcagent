import test from "node:test";
import assert from "node:assert/strict";
import { auditSkillUsage } from "../dist/audit/index.js";

test("auditSkillUsage uses repo-specific contracts for create-signal, record-signal-outcome, and analyze-signal-outcomes", async () => {
  const result = await auditSkillUsage(process.cwd());
  assert.equal(result.skill_usage_correct, true, result.issues?.join("; "));
  assert.equal(Array.isArray(result.checked_paths), true);
  assert.equal(result.checked_paths.some((path) => path.endsWith("src/prep/candidate-generator.ts")), true);
  assert.equal(result.checked_paths.some((path) => path.endsWith("src/loop/daily-learn.ts")), true);
  assert.equal(result.checked_paths.some((path) => path.endsWith("src/learning/editorial-memory.ts")), true);
});
