import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  applyHumanDecision,
  buildFilingQueue,
  saveFilingQueue
} from "../dist/filing/index.js";

test("filing queue promotes top file candidate and approval writes ready artifact", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    const rankedCandidates = [
      {
        candidateId: "top-file",
        beat: "infrastructure",
        headline: "Top file candidate",
        score: 84,
        decision: "file",
        reasons: ["best score"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/top-file-submission.json")
      },
      {
        candidateId: "hold-me",
        beat: "security",
        headline: "Hold candidate",
        score: 55,
        decision: "hold",
        reasons: ["needs more review"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/hold-me-submission.json")
      }
    ];

    await mkdir("data/dry-runs/2026-03-28", { recursive: true });
    await writeFile(
      "data/dry-runs/2026-03-28/top-file-submission.json",
      JSON.stringify({ headline: "Top file candidate" }),
      "utf8"
    );
    await writeFile(
      "data/dry-runs/2026-03-28/hold-me-submission.json",
      JSON.stringify({ headline: "Hold candidate" }),
      "utf8"
    );

    const filingQueue = await buildFilingQueue("2026-03-28", rankedCandidates);
    assert.equal(filingQueue.topCandidateId, "top-file");
    assert.equal(filingQueue.items[0].queueStatus, "awaiting_human_approval");

    await saveFilingQueue(filingQueue);
    const result = await applyHumanDecision({
      reportDate: "2026-03-28",
      candidateId: "top-file",
      decision: "approve",
      reviewedBy: "operator"
    });

    assert.ok(result.readyArtifactPath);
    const ready = JSON.parse(await readFile(result.readyArtifactPath, "utf8"));
    assert.equal(ready.kind, "filing_ready_submission");
    assert.equal(ready.candidateId, "top-file");

    const updatedQueue = JSON.parse(await readFile(result.queuePath, "utf8"));
    assert.equal(updatedQueue.items[0].queueStatus, "approved_for_filing");
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
