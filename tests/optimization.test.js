import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildPreSubmissionIntelligence } from "../dist/intelligence/index.js";
import { generateAndSaveDailyOptimizationSnapshot } from "../dist/loop/index.js";
import { buildSubmissionPayload } from "../dist/newsroom/index.js";
import { runProtocolUpdateLane } from "../dist/signals/index.js";
import {
  logAcceptedSubmission,
  logApprovalOutcome,
  logDetectedCandidate,
  logRejectedCandidate
} from "../dist/storage/index.js";
import { validateSubject } from "../dist/validation/index.js";

function createSubject(id, summary, significance, causality, detectedAt) {
  return runProtocolUpdateLane({
    id,
    detectedAt,
    chain: "stacks",
    contractAddress: `SP11WK0Y2549AKAPDNRKYXGWCHVPJJK2DFX547KGR.${id}`,
    deployTxHash: `0x${"a".repeat(64)}`,
    firstInteractionTxHash: `0x${"b".repeat(64)}`,
    blockHeight: 182450,
    summary,
    significance,
    causalTrigger: causality,
    usesDashboardAsPrimarySource: false,
    likelyDuplicate: false,
    sourceUrls: {
      rpc: `https://example.invalid/v2/transactions/${id}`,
      explorer: `https://explorer.hiro.so/txid/${id}`
    }
  }).subject;
}

function createSubmission(subject, generatedAt) {
  const validation = validateSubject(subject);
  const preSubmission = buildPreSubmissionIntelligence({
    dailyBriefChecked: true,
    activityFeedChecked: true,
    leaderboardChecked: true,
    reputationChecked: true,
    inboxChecked: true,
    agentStatusChecked: true,
    notes: ["All checks passed."],
    checkedAt: generatedAt
  });

  return buildSubmissionPayload(subject, validation, preSubmission, generatedAt);
}

async function seedTrainingData() {
  await mkdir("data/training", { recursive: true });
  await writeFile(
    "data/training/in-brief.jsonl",
    `${JSON.stringify({
      label: "in_brief",
      headline: "x402 relay ships before competitors adjust — nonce failures no longer burn retries",
      reason_tags: ["broader_same_beat_story", "publication_ready"]
    })}\n`,
    "utf8"
  );
  await writeFile(
    "data/training/rejected.jsonl",
    `${JSON.stringify({
      label: "rejected",
      headline: "Infrastructure update improves system stability",
      reason_tags: ["not_article_shaped", "missing_concrete_specificity"]
    })}\n`,
    "utf8"
  );
}

test(
  "optimization loop adjusts beat preference, thresholds, and recommendations from outcomes",
  { concurrency: false },
  async () => {
    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-optimization-"));

    process.chdir(tempDir);

    try {
      await seedTrainingData();

      const winner = createSubject(
        "protocol-update-opt-001",
        "A newly deployed Stacks contract drew immediate first-use activity before public dashboards caught up",
        "a live protocol launch is visible onchain before broad public visibility",
        "its deployment was followed by a first funding and interaction transaction",
        "2026-03-25T06:30:00Z"
      );
      const duplicateLoss = createSubject(
        "protocol-update-opt-002",
        "A new Stacks protocol upgrade began attracting early contract calls",
        "an active launch can be seen before broad public distribution",
        "its deployment was followed by immediate first-use traffic",
        "2026-03-25T07:00:00Z"
      );

      await logDetectedCandidate(winner.candidate, "2026-03-25T08:00:00Z");
      await logDetectedCandidate(duplicateLoss.candidate, "2026-03-25T08:05:00Z");

      await logAcceptedSubmission(
        winner.candidate.candidateId,
        createSubmission(winner, "2026-03-25T08:10:00Z"),
        "2026-03-25T08:10:00Z"
      );

      await logApprovalOutcome(
        winner.candidate.candidateId,
        true,
        "Selected for brief",
        "2026-03-25T09:00:00Z",
        { published: true, status: "approved" }
      );

      await logRejectedCandidate(
        duplicateLoss.candidate.candidateId,
        ["likely_duplicate"],
        "2026-03-25T09:05:00Z"
      );

      const { snapshot, savedTo } = await generateAndSaveDailyOptimizationSnapshot(
        "2026-03-25",
        "2026-03-25T23:00:00Z"
      );

      assert.equal(snapshot.kind, "daily_optimization");
      assert.equal(snapshot.beatPreferences.length, 1);
      assert.equal(snapshot.beatPreferences[0].beat, "protocol-updates");
      assert.equal(snapshot.beatPreferences[0].preference, "decrease");
      assert.equal(snapshot.beatPreferences[0].published, 1);
      assert.equal(snapshot.beatPreferences[0].duplicateLosses, 1);
      assert.equal(snapshot.rejectionThreshold.mode, "tightened");
      assert.match(snapshot.rejectionThreshold.drivers[0], /tighten duplicate rejection/i);
      assert.deepEqual(snapshot.duplicateLossPatterns[0], {
        beat: "protocol-updates",
        count: 1,
        candidateIds: ["protocol-update-opt-002"]
      });
      assert.ok(snapshot.winningHeadlinePatterns.some((pattern) => pattern.pattern === "before-advantage"));
      assert.ok(snapshot.winningHeadlinePatterns.some((pattern) => pattern.pattern === "full-length"));
      assert.equal(
        snapshot.winningHeadlinePatterns.find((pattern) => pattern.pattern === "before-advantage")?.count,
        1
      );
      assert.ok(snapshot.nextDayRecommendations.some((line) => /protocol-updates/.test(line)));
      assert.ok(snapshot.nextDayRecommendations.some((line) => /headline/i.test(line)));
      assert.ok(snapshot.trainingWinningTags.length > 0);
      assert.ok(snapshot.trainingRejectionTags.length > 0);

      const saved = JSON.parse(await readFile(savedTo, "utf8"));
      assert.equal(saved.kind, "daily_optimization");
      assert.match(savedTo, /data\/experiments\/optimization\/2026-03-25\.json$/);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }
);

test(
  "optimization loop attributes cross-day approvals to the original beat without forced decrease",
  { concurrency: false },
  async () => {
    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-optimization-cross-day-"));

    process.chdir(tempDir);

    try {
      await seedTrainingData();

      const priorDayWinner = createSubject(
        "protocol-update-opt-previous",
        "A newly deployed Stacks contract drew immediate first-use activity before public dashboards caught up",
        "a live protocol launch is visible onchain before broad public visibility",
        "its deployment was followed by a first funding and interaction transaction",
        "2026-03-24T06:30:00Z"
      );
      const currentDayCandidate = createSubject(
        "protocol-update-opt-current",
        "A new Stacks protocol upgrade began attracting early contract calls",
        "an active launch can be seen before broad public distribution",
        "its deployment was followed by immediate first-use traffic",
        "2026-03-25T07:00:00Z"
      );

      await logDetectedCandidate(priorDayWinner.candidate, "2026-03-24T08:00:00Z");
      await logAcceptedSubmission(
        priorDayWinner.candidate.candidateId,
        createSubmission(priorDayWinner, "2026-03-24T08:10:00Z"),
        "2026-03-24T08:10:00Z"
      );
      await logDetectedCandidate(currentDayCandidate.candidate, "2026-03-25T08:05:00Z");
      await logApprovalOutcome(
        priorDayWinner.candidate.candidateId,
        true,
        "Selected for brief",
        "2026-03-25T09:00:00Z",
        { status: "approved" }
      );

      const { snapshot } = await generateAndSaveDailyOptimizationSnapshot(
        "2026-03-25",
        "2026-03-25T23:00:00Z"
      );

      assert.equal(snapshot.beatPreferences.length, 1);
      assert.equal(snapshot.beatPreferences[0].beat, "protocol-updates");
      assert.equal(snapshot.beatPreferences[0].approvals, 1);
      assert.equal(snapshot.beatPreferences[0].published, 0);
      assert.equal(snapshot.beatPreferences[0].preference, "hold");
      assert.equal(snapshot.beatPreferences[0].approvalRate, null);
      assert.equal(snapshot.beatPreferences[0].publicationRate, null);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }
);
