import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    deployTxHash: `0xdeploy-${id}`,
    firstInteractionTxHash: `0xinteract-${id}`,
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

test(
  "optimization loop adjusts beat preference, thresholds, and recommendations from outcomes",
  { concurrency: false },
  async () => {
    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-optimization-"));

    process.chdir(tempDir);

    try {
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
        "2026-03-25T09:00:00Z"
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
      assert.ok(snapshot.nextDayRecommendations.some((line) => /protocol-updates/.test(line)));
      assert.ok(snapshot.nextDayRecommendations.some((line) => /headline/i.test(line)));

      const saved = JSON.parse(await readFile(savedTo, "utf8"));
      assert.equal(saved.kind, "daily_optimization");
      assert.match(savedTo, /data\/experiments\/optimization\/2026-03-25\.json$/);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }
);
