import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  applyHumanDecision,
  buildFilingQueue,
  markCandidateOutcome,
  recordFiledSignal,
  readCandidateHistory,
  saveFilingQueue
} from "../dist/filing/index.js";

test("recordFiledSignal persists receipt, filed state, and queue status", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filed-state-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await writeFile(
      "data/dry-runs/2026-03-29/top-file-submission.json",
      JSON.stringify({
        candidate_signal: { beat: "infrastructure" },
        headline: "Top file candidate"
      }),
      "utf8"
    );

    const filingQueue = await buildFilingQueue("2026-03-29", [
      {
        candidateId: "top-file",
        beat: "infrastructure",
        headline: "Top file candidate",
        score: 82,
        decision: "file",
        reasons: ["best candidate"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-29/top-file-submission.json")
      }
    ]);
    await saveFilingQueue(filingQueue);
    await applyHumanDecision({
      reportDate: "2026-03-29",
      candidateId: "top-file",
      decision: "approve",
      reviewedBy: "operator"
    });

    const result = await recordFiledSignal({
      reportDate: "2026-03-29",
      candidateId: "top-file",
      signalId: "signal-789",
      filedAt: "2026-03-29T12:00:00Z",
      apiResponse: { id: "signal-789", ok: true }
    });

    const state = JSON.parse(await readFile(result.statePath, "utf8"));
    assert.equal(state.filedSignals.length, 1);
    assert.equal(state.filedSignals[0].signalId, "signal-789");
    assert.equal(state.filedSignals[0].candidateId, "top-file");

    const receipt = JSON.parse(await readFile(result.receiptPath, "utf8"));
    assert.equal(receipt.kind, "filed_signal_receipt");
    assert.equal(receipt.signalId, "signal-789");

    const queue = JSON.parse(await readFile(result.queuePath, "utf8"));
    assert.equal(queue.items[0].queueStatus, "filed");
    assert.equal(queue.topCandidateId, null);

    const history = await readCandidateHistory("top-file", tempDir);
    assert.ok(history);
    assert.equal(history.filing.signalId, "signal-789");
    assert.equal(history.sourceSummary.length, 0);
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("candidate history tracks readable sources and in-brief outcome state", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filed-state-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await writeFile(
      "data/dry-runs/2026-03-29/source-rich-submission.json",
      JSON.stringify({
        candidate_signal: { beat: "security" },
        headline: "$137M Lost in Q1 2026 as Private Key Compromise Overtakes Smart Contract Bugs",
        sources: [
          {
            source_name: "Rekt News exploit analysis",
            source_url: "https://rekt.news/example-q1-2026-exploit-analysis",
            source_role: "primary-proof"
          },
          {
            source_name: "ALEX Docs",
            source_url: "https://docs.alexlab.co/security/oracles",
            source_role: "verification"
          }
        ]
      }),
      "utf8"
    );

    const filingQueue = await buildFilingQueue("2026-03-29", [
      {
        candidateId: "source-rich",
        beat: "security",
        headline: "$137M Lost in Q1 2026 as Private Key Compromise Overtakes Smart Contract Bugs",
        score: 84,
        decision: "file",
        reasons: ["best candidate"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-29/source-rich-submission.json")
      }
    ]);
    await saveFilingQueue(filingQueue);
    await applyHumanDecision({
      reportDate: "2026-03-29",
      candidateId: "source-rich",
      decision: "approve",
      reviewedBy: "operator"
    });

    await recordFiledSignal({
      reportDate: "2026-03-29",
      candidateId: "source-rich",
      signalId: "signal-999",
      filedAt: "2026-03-29T12:00:00Z",
      apiResponse: { id: "signal-999", ok: true }
    });

    await markCandidateOutcome(
      "source-rich",
      {
        status: "approved",
        approved: true,
        publishedInBrief: true,
        recordedAt: "2026-03-29T18:00:00Z",
        note: "approved and published in compiled brief",
        learningWhy: "Converted into In Brief because it was the strongest same-day beat story."
      },
      tempDir
    );

    const history = await readCandidateHistory("source-rich", tempDir);
    assert.ok(history);
    assert.equal(history.sourceSummary.length, 2);
    assert.equal(history.sourceSummary[0].domain, "rekt.news");
    assert.equal(history.outcome.publishedInBrief, true);
    const markdown = await readFile(resolve(tempDir, "data/candidate-history/source-rich.md"), "utf8");
    assert.match(markdown, /Rekt News exploit analysis/);
    assert.match(markdown, /Published in Brief: true/);
    assert.match(markdown, /Learning why: Converted into In Brief/);
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
