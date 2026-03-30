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
    assert.equal(
      filingQueue.items.find((item) => item.candidateId === "hold-me")?.queueStatus,
      "on_hold"
    );
    assert.equal(filingQueue.recommendationSummary.recommendedCount, 1);
    assert.equal(filingQueue.recommendationSummary.uniqueBeatCount, 1);

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

test("filing queue does not promote hold decisions into awaiting_human_approval", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "hold-only",
        beat: "protocol-updates",
        headline: "Hold-only candidate",
        score: 92,
        decision: "hold",
        styleTested: "broad_same_beat_operator",
        competitorReference: null,
        whyThisStyleWasChosen: "broad_same_beat_operator",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["non-competitive release-note framing"],
        sourcePath: resolve(tempDir, "hold-only.json")
      }
    ]);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.recommendationSummary.recommendedCount, 0);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue applies soft beat quotas before using repeat beats", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "infra-1",
        beat: "infrastructure",
        headline: "Infra one",
        score: 90,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        reasons: ["top score"],
        sourcePath: resolve(tempDir, "infra-1.json")
      },
      {
        candidateId: "infra-2",
        beat: "infrastructure",
        headline: "Infra two",
        score: 89,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        reasons: ["second infra"],
        sourcePath: resolve(tempDir, "infra-2.json")
      },
      {
        candidateId: "security-1",
        beat: "security",
        headline: "Security one",
        score: 88,
        decision: "file",
        styleTested: "single_story_operator_angle",
        competitorReference: null,
        whyThisStyleWasChosen: "single_story_operator_angle",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        reasons: ["security candidate"],
        sourcePath: resolve(tempDir, "security-1.json")
      }
    ]);

    const signable = filingQueue.items.filter((item) => item.queueStatus === "awaiting_human_approval");
    assert.deepEqual(signable.map((item) => item.candidateId), ["infra-1", "security-1", "infra-2"]);
    assert.ok(
      filingQueue.recommendationSummary.quotaNotes.some((line) => /Second-slot beat repeats were only used/.test(line))
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue hard-blocks unresolved duplicate risk from signable output", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "duplicate-risk",
        beat: "infrastructure",
        headline: "Duplicate-risk candidate",
        score: 90,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "pending",
        freshnessStatus: "clear",
        reasons: ["strong score but duplicate check still pending"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/duplicate-risk-submission.json")
      }
    ]);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
    assert.ok(
      filingQueue.items[0].reasons.includes("hard-blocked from signable queue because duplicate risk is unresolved")
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue hard-blocks unresolved freshness risk from signable output", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "freshness-risk",
        beat: "security",
        headline: "Freshness-risk candidate",
        score: 88,
        decision: "file",
        styleTested: "single_story_operator_angle",
        competitorReference: null,
        whyThisStyleWasChosen: "single_story_operator_angle",
        duplicateStatus: "clear",
        freshnessStatus: "risk_unresolved",
        reasons: ["strong score but freshness still unresolved"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/freshness-risk-submission.json")
      }
    ]);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
    assert.ok(
      filingQueue.items[0].reasons.includes("hard-blocked from signable queue because freshness risk is unresolved")
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue hard-blocks candidates that fail publishability preflight", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "deal-flow-blocked",
        beat: "deal-flow",
        filingBeatSlug: "deal-flow",
        headline: "Blocked by publisher permissions",
        score: 94,
        decision: "file",
        styleTested: "broad_same_beat_operator",
        competitorReference: null,
        whyThisStyleWasChosen: "broad_same_beat_operator",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        publishabilityStatus: "permission_blocked",
        publishabilityReasons: [
          "publishability preflight failed: beat deal-flow is not configured as publishable for the current operator"
        ],
        competitorCoverage: [],
        reasons: ["strong story but current operator cannot publish the filing beat"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/deal-flow-blocked.json")
      }
    ]);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
    assert.ok(
      filingQueue.items[0].reasons.includes("hard-blocked from signable queue because publishability preflight did not pass")
    );
    assert.ok(
      filingQueue.items[0].reasons.some((reason) => /deal-flow/.test(reason))
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue hard-blocks candidates that are valid but not competitive", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "not-competitive",
        beat: "protocol-updates",
        filingBeatSlug: "dev-tools",
        headline: "Artifact headline candidate",
        score: 91,
        decision: "file",
        styleTested: "single_story_operator_angle",
        competitorReference: null,
        whyThisStyleWasChosen: "single_story_operator_angle",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        publishabilityStatus: "publishable",
        publishabilityReasons: ["publishability preflight passed for filing beat dev-tools"],
        competitivenessStatus: "valid_but_not_competitive",
        competitivenessReasons: [
          "editorial contract failed: headline is artifact-led instead of human-news-led"
        ],
        competitorCoverage: [],
        reasons: ["technically valid but not slot-winning"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/not-competitive.json")
      }
    ]);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
    assert.ok(
      filingQueue.items[0].reasons.includes("hard-blocked from signable queue because editorial competitiveness contract did not pass")
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
