import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runAuditedLoop, validateAuditOutput, runRegressionCheck } from "../dist/audit/index.js";

test("validateAuditOutput blocks outputs without claims and evidence", () => {
  const result = validateAuditOutput({ claims: [], evidence: [] });
  assert.equal(result.valid, false);
  assert.deepEqual(result.failures.sort(), ["missing_claims", "missing_evidence"]);
});

test("runAuditedLoop retries when evidence is missing and writes /logs/{run_id}.json", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-audit-loop-"));
  let calls = 0;

  try {
    const result = await runAuditedLoop(
      { prompt: "draft candidate", constraints: ["anchor"] },
      (input) => {
        calls += 1;
        if (!/exact source anchors/i.test(input.prompt)) {
          return { claims: ["anchor claim"], evidence: [], implications: ["anchor implication"] };
        }
        return {
          claims: ["anchor claim"],
          evidence: ["exact source anchor"],
          implications: ["anchor implication"]
        };
      },
      { root: tempDir, runId: "loop-fixture", maxIterations: 2 }
    );

    assert.equal(calls, 2);
    assert.equal(result.evaluation.score >= 4, true);
    const log = JSON.parse(await readFile(resolve(tempDir, "logs/loop-fixture.json"), "utf8"));
    assert.equal(log.iteration, 2);
    assert.deepEqual(log.output.evidence, ["exact source anchor"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("regression check fails when the new output scores lower than the old output", () => {
  const result = runRegressionCheck({
    input: { prompt: "draft", constraints: [] },
    oldOutput: {
      claims: ["claim"],
      evidence: ["evidence"],
      implications: ["implication"]
    },
    newOutput: {
      claims: ["claim"],
      evidence: [],
      implications: []
    }
  });

  assert.equal(result.passed, false);
  assert.equal(result.newScore < result.oldScore, true);
});
