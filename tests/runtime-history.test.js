import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { appendRuntimeHistory } from "../dist/ops/index.js";

test("runtime history records recent agent-daily runs with report outputs", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-runtime-history-"));

  try {
    process.env.GITHUB_EVENT_NAME = "schedule";
    process.env.GITHUB_RUN_ID = "12345";
    process.env.GITHUB_RUN_ATTEMPT = "1";
    process.env.GITHUB_REPOSITORY = "1feems/aibtcagent";
    process.env.GITHUB_REF_NAME = "main";
    process.env.GITHUB_ACTOR = "github-actions[bot]";

    const statePath = await appendRuntimeHistory(
      {
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T06:15:00Z",
        runtime: {
          walletActionsRequireHumanSignature: true,
          secondSourcingPassTriggered: true,
          initialStrongCandidates: 2,
          finalStrongCandidates: 4
        },
        reports: {
          queuePath: "/tmp/queue.json",
          filingQueuePath: "/tmp/filing-queue.json",
          operatorSummaryPath: "/tmp/operator.json",
          stabilityReportPath: "/tmp/stability.json",
          competitorReviewPath: "/tmp/competitor-review.json"
        }
      },
      tempDir
    );

    const state = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(state.kind, "agent_runtime_history");
    assert.equal(state.runs.length, 1);
    assert.equal(state.runs[0].eventName, "schedule");
    assert.equal(state.runs[0].runId, "12345");
    assert.equal(state.runs[0].runtime.walletActionsRequireHumanSignature, true);
    assert.equal(state.runs[0].runtime.secondSourcingPassTriggered, true);
    assert.equal(state.runs[0].reports.stabilityReportPath, "/tmp/stability.json");
    assert.equal(state.runs[0].reports.competitorReviewPath, "/tmp/competitor-review.json");
  } finally {
    delete process.env.GITHUB_EVENT_NAME;
    delete process.env.GITHUB_RUN_ID;
    delete process.env.GITHUB_RUN_ATTEMPT;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_REF_NAME;
    delete process.env.GITHUB_ACTOR;
    await rm(tempDir, { recursive: true, force: true });
  }
});
