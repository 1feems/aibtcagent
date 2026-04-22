import test from "node:test";
import assert from "node:assert/strict";
import { auditLearning } from "../dist/audit/index.js";

test("auditLearning confirms controlled pattern-only learning plus editorial promotion path", async () => {
  const result = await auditLearning(process.cwd());
  assert.equal(result.learning, true, result.issues.join("; "));
  assert.equal(Array.isArray(result.checked_paths), true);
  assert.equal(result.checked_paths.some((path) => path.endsWith("src/audit/memory.ts")), true);
  assert.equal(result.checked_paths.some((path) => path.endsWith("src/learning/outcome-feedback.ts")), true);
  assert.equal(result.checked_paths.some((path) => path.endsWith("src/learning/editorial-memory.ts")), true);
  assert.equal(result.checked_paths.some((path) => path.endsWith("src/loop/daily-learn.ts")), true);
});
