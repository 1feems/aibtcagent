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
  logRejectedCandidate,
  logRewardOutcome
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
      await logRewardOutcome(
        winner.candidate.candidateId,
        500,
        "0.00000500",
        "2026-03-25T09:15:00Z"
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
      assert.ok(snapshot.stylePerformance.length > 0);
      assert.equal(snapshot.stylePerformance[0].preference, "promote");
      assert.equal(snapshot.stylePerformance[0].satsEarned, 500);
      assert.ok(snapshot.factorAttribution.length > 0);
      assert.ok(snapshot.factorAttribution.some((factor) => factor.resolvedSubmissions > 0));

      const saved = JSON.parse(await readFile(savedTo, "utf8"));
      assert.equal(saved.kind, "daily_optimization");
      assert.ok(Array.isArray(saved.factorAttribution));
      assert.match(savedTo, /data\/experiments\/optimization\/2026-03-25\.json$/);

      const styleArtifact = JSON.parse(await readFile("data/state/style-performance.json", "utf8"));
      assert.equal(styleArtifact.kind, "style_performance");
      assert.equal(styleArtifact.styles[0].preference, "promote");
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }
);

test(
  "optimization loop marks scoring factors as validated or disproved once real outcome volume exists",
  { concurrency: false },
  async () => {
    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-optimization-attribution-"));

    process.chdir(tempDir);

    try {
      await seedTrainingData();

      const packagedWinnerOne = createSubject(
        "protocol-update-opt-attr-001",
        "A newly deployed Stacks contract drew immediate first-use activity before public dashboards caught up",
        "a live protocol launch is visible onchain before broad public visibility",
        "its deployment was followed by a first funding and interaction transaction",
        "2026-03-28T06:30:00Z"
      );
      const packagedWinnerTwo = createSubject(
        "protocol-update-opt-attr-002",
        "Two Stacks rollouts hit activation thresholds before public dashboards updated",
        "operators got an early read on a broader same-beat launch package",
        "two deployments crossed visible onchain milestones in the same cycle",
        "2026-03-28T06:45:00Z"
      );
      const genericLossOne = createSubject(
        "protocol-update-opt-attr-003",
        "Infrastructure update improves system stability",
        "published this event for readers tracking the ecosystem",
        "published this event from the feed after the release landed",
        "2026-03-28T07:00:00Z"
      );
      const genericLossTwo = createSubject(
        "protocol-update-opt-attr-004",
        "Another infrastructure update improves system stability",
        "published this event for readers tracking the ecosystem",
        "published this event from the feed after the release landed",
        "2026-03-28T07:15:00Z"
      );

      const packagedWinnerOneSubmission = createSubmission(packagedWinnerOne, "2026-03-28T08:10:00Z");
      const packagedWinnerTwoSubmission = createSubmission(packagedWinnerTwo, "2026-03-28T08:20:00Z");
      const genericLossOneSubmission = createSubmission(genericLossOne, "2026-03-28T08:30:00Z");
      const genericLossTwoSubmission = createSubmission(genericLossTwo, "2026-03-28T08:40:00Z");

      packagedWinnerOneSubmission.candidateMetadata.styleTested = "broad_same_beat_operator";
      packagedWinnerTwoSubmission.candidateMetadata.styleTested = "broad_same_beat_operator";
      genericLossOneSubmission.headline = "v3.4.0 stability update lands after the feed posted it";
      genericLossTwoSubmission.headline = "Block 182450 stability update lands after the feed posted it";
      genericLossOneSubmission.sources = [{ sourceType: "live-feed", sourceUrl: "https://news.example.invalid/item-1" }];
      genericLossTwoSubmission.sources = [{ sourceType: "live-feed", sourceUrl: "https://news.example.invalid/item-2" }];

      for (const candidate of [
        packagedWinnerOne,
        packagedWinnerTwo,
        genericLossOne,
        genericLossTwo
      ]) {
        await logDetectedCandidate(candidate.candidate, "2026-03-28T08:00:00Z");
      }

      await logAcceptedSubmission(
        packagedWinnerOne.candidate.candidateId,
        packagedWinnerOneSubmission,
        "2026-03-28T08:10:00Z"
      );
      await logAcceptedSubmission(
        packagedWinnerTwo.candidate.candidateId,
        packagedWinnerTwoSubmission,
        "2026-03-28T08:20:00Z"
      );
      await logAcceptedSubmission(
        genericLossOne.candidate.candidateId,
        genericLossOneSubmission,
        "2026-03-28T08:30:00Z"
      );
      await logAcceptedSubmission(
        genericLossTwo.candidate.candidateId,
        genericLossTwoSubmission,
        "2026-03-28T08:40:00Z"
      );

      await logApprovalOutcome(
        packagedWinnerOne.candidate.candidateId,
        true,
        "Selected for brief",
        "2026-03-28T09:00:00Z",
        { published: true, status: "approved" }
      );
      await logApprovalOutcome(
        packagedWinnerTwo.candidate.candidateId,
        true,
        "Selected for brief",
        "2026-03-28T09:05:00Z",
        { published: true, status: "approved" }
      );
      await logApprovalOutcome(
        genericLossOne.candidate.candidateId,
        true,
        "Approved but not selected",
        "2026-03-28T09:10:00Z",
        { published: false, status: "approved" }
      );
      await logApprovalOutcome(
        genericLossTwo.candidate.candidateId,
        false,
        "Rejected",
        "2026-03-28T09:15:00Z",
        { published: false, status: "rejected" }
      );

      const { snapshot } = await generateAndSaveDailyOptimizationSnapshot(
        "2026-03-28",
        "2026-03-28T23:00:00Z"
      );

      assert.equal(
        snapshot.factorAttribution.find((factor) => factor.factor === "generic_external_adaptation")?.verdict,
        "validated"
      );
      assert.equal(
        snapshot.factorAttribution.find((factor) => factor.factor === "exact_anchor")?.verdict,
        "disproved"
      );
      assert.ok(snapshot.nextDayRecommendations.some((line) => /Validated scoring factor:/i.test(line)));
      assert.ok(snapshot.nextDayRecommendations.some((line) => /Disproved scoring factor:/i.test(line)));
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }
);

test(
  "optimization loop tracks operator load from rewrites, overrides, and skipped signable candidates",
  { concurrency: false },
  async () => {
    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-optimization-operator-load-"));

    process.chdir(tempDir);

    try {
      await seedTrainingData();
      await mkdir("data/filing-queue", { recursive: true });
      await mkdir("data/candidate-history", { recursive: true });

      await writeFile(
        "data/filing-queue/2026-03-30.json",
        JSON.stringify({
          kind: "filing_queue",
          reportDate: "2026-03-30",
          generatedAt: "2026-03-30T09:00:00Z",
          topCandidateId: "top-signable",
          recommendationSummary: {
            targetRecommendations: 5,
            recommendedCount: 3,
            uniqueBeatCount: 2,
            beatsRepresented: ["agent-economy", "security"],
            quotaNotes: []
          },
          items: [
            {
              candidateId: "top-signable",
              queueStatus: "awaiting_human_approval",
              reasons: [
                "submission gate passed",
                "headline reads like raw release notes instead of a finished filing"
              ]
            },
            {
              candidateId: "override-approved",
              queueStatus: "approved_for_filing",
              reasons: ["submission gate passed"]
            },
            {
              candidateId: "signable-rejected",
              queueStatus: "awaiting_human_approval",
              reasons: ["submission gate passed"]
            }
          ]
        }, null, 2),
        "utf8"
      );

      for (const history of [
        {
          candidateId: "top-signable",
          liveOpsEvidence: {
            approval: {
              decision: null,
              reviewedAt: null
            }
          }
        },
        {
          candidateId: "override-approved",
          liveOpsEvidence: {
            approval: {
              decision: "approve",
              reviewedAt: "2026-03-30T10:00:00Z"
            }
          }
        },
        {
          candidateId: "signable-rejected",
          liveOpsEvidence: {
            approval: {
              decision: "reject",
              reviewedAt: "2026-03-30T11:00:00Z"
            }
          }
        }
      ]) {
        await writeFile(
          `data/candidate-history/${history.candidateId}.json`,
          JSON.stringify(history, null, 2),
          "utf8"
        );
      }

      const { snapshot, savedTo } = await generateAndSaveDailyOptimizationSnapshot(
        "2026-03-30",
        "2026-03-30T23:00:00Z"
      );

      assert.deepEqual(snapshot.operatorLoad, {
        totalSignableCandidates: 3,
        headlineRewriteRequiredCount: 1,
        rankingOverrideCount: 2,
        skippedSignableCount: 2,
        untouchedSignableCount: 1,
        loadScore: 13,
        status: "heavy",
        headlineRewriteCandidateIds: ["top-signable"],
        rankingOverrideCandidateIds: ["override-approved", "signable-rejected"],
        skippedSignableCandidateIds: ["signable-rejected", "top-signable"],
        untouchedSignableCandidateIds: ["top-signable"],
        rationale: [
          "3 signable candidates reached human review today.",
          "1 signable candidate still needed a headline rewrite before approval.",
          "2 signable candidates got a same-day operator decision despite not being the queue top candidate.",
          "2 signable candidates were skipped or rejected even though they reached the signable slate.",
          "1 signable candidate was still waiting for a decision at day end."
        ]
      });
      assert.ok(snapshot.nextDayRecommendations.some((line) => /Operator load is heavy/i.test(line)));

      const stateArtifact = JSON.parse(await readFile("data/state/operator-load.json", "utf8"));
      assert.equal(stateArtifact.kind, "operator_load");
      assert.equal(stateArtifact.operatorLoad.status, "heavy");
      assert.match(savedTo, /data\/experiments\/optimization\/2026-03-30\.json$/);
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

test(
  "optimization loop demotes styles that only get approved without winning In Brief",
  { concurrency: false },
  async () => {
    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-optimization-style-"));

    process.chdir(tempDir);

    try {
      await seedTrainingData();

      const approvedNotPublished = createSubject(
        "protocol-update-opt-style",
        "A newly deployed Stacks contract drew immediate first-use activity before public dashboards caught up",
        "a live protocol launch is visible onchain before broad public visibility",
        "its deployment was followed by a first funding and interaction transaction",
        "2026-03-26T06:30:00Z"
      );

      await logDetectedCandidate(approvedNotPublished.candidate, "2026-03-26T08:00:00Z");
      await logAcceptedSubmission(
        approvedNotPublished.candidate.candidateId,
        createSubmission(approvedNotPublished, "2026-03-26T08:10:00Z"),
        "2026-03-26T08:10:00Z"
      );
      await logApprovalOutcome(
        approvedNotPublished.candidate.candidateId,
        true,
        "Selected but did not make brief",
        "2026-03-26T09:00:00Z",
        { published: false, status: "approved" }
      );

      const { snapshot } = await generateAndSaveDailyOptimizationSnapshot(
        "2026-03-26",
        "2026-03-26T23:00:00Z"
      );

      assert.equal(snapshot.stylePerformance[0]?.preference, "demote");
      assert.equal(snapshot.packagingAdjustments?.promoteBroadSameBeatPackaging, false);
      assert.ok(snapshot.nextDayRecommendations.some((line) => /Demote /.test(line)));
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }
);

test(
  "optimization loop promotes broader same-beat packaging after narrow same-beat losses",
  { concurrency: false },
  async () => {
    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-optimization-packaging-"));

    process.chdir(tempDir);

    try {
      await seedTrainingData();

      const candidate = createSubject(
        "protocol-update-opt-packaging",
        "A newly deployed Stacks contract drew immediate first-use activity before public dashboards caught up",
        "a live protocol launch is visible onchain before broad public visibility",
        "its deployment was followed by a first funding and interaction transaction",
        "2026-03-27T06:30:00Z"
      );

      await logDetectedCandidate(candidate.candidate, "2026-03-27T08:00:00Z");
      await logAcceptedSubmission(
        candidate.candidate.candidateId,
        createSubmission(candidate, "2026-03-27T08:10:00Z"),
        "2026-03-27T08:10:00Z"
      );
      await logApprovalOutcome(
        candidate.candidate.candidateId,
        true,
        "Selected but did not make brief",
        "2026-03-27T09:00:00Z",
        {
          published: false,
          status: "approved",
          learningWhy: "Approved, but a broader same-beat story outcompeted this narrower component update."
        }
      );

      const { snapshot } = await generateAndSaveDailyOptimizationSnapshot(
        "2026-03-27",
        "2026-03-27T23:00:00Z"
      );

      assert.equal(snapshot.packagingAdjustments?.promoteBroadSameBeatPackaging, true);
      assert.equal(snapshot.packagingAdjustments?.demoteNarrowFragmentPackaging, true);
      assert.ok(snapshot.nextDayRecommendations.some((line) => /Promote broader same-beat packaging/i.test(line)));
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }
);
