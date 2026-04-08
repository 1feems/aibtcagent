import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  generateDailyOperatorSummary,
  saveDailyOperatorSummary
} from "../dist/ops/index.js";

test("operator summary explains the top candidate and day-over-day movement", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-operator-summary-"));

  try {
    await mkdir(resolve(tempDir, "data/reports/daily"), { recursive: true });
    await mkdir(resolve(tempDir, "data/queues"), { recursive: true });
    await mkdir(resolve(tempDir, "data/filing-queue"), { recursive: true });

    await writeFile(
      resolve(tempDir, "data/reports/daily/2026-03-28.json"),
      JSON.stringify({
        kind: "daily_report",
        reportDate: "2026-03-28",
        generatedAt: "2026-03-28T23:00:00Z",
        detections: {
          totalDetected: 1,
          totalSubmitted: 1,
          submissionConversionRate: 1,
          detectedCandidateIds: ["old"],
          submittedCandidateIds: ["old"],
          submittedHeadlines: ["Old story"],
          beats: ["infrastructure"]
        },
        rejections: { totalRejected: 0, rejectedCandidateIds: [], reasons: [] },
        approvalsAndRewards: {
          totalApprovals: 0,
          totalDeclines: 0,
          resolvedSubmissionCount: 0,
          pendingSubmissionCount: 1,
          sameDayResolvedApprovalRate: 0.2,
          approvalNotes: [],
          totalSatsEarned: 0,
          btcRewards: [],
          leaderboardChanges: []
        },
        narrative: { changed: [], improve: [] },
        optimization: {
          kind: "daily_optimization",
          reportDate: "2026-03-28",
          generatedAt: "2026-03-28T23:00:00Z",
          beatPreferences: [],
          rejectionThreshold: { mode: "tightened", drivers: [] },
          duplicateLossPatterns: [],
          winningHeadlinePatterns: [],
          trainingWinningTags: [],
          trainingRejectionTags: [],
          beatCrowding: [],
          operatorLoad: {
            totalSignableCandidates: 4,
            headlineRewriteRequiredCount: 2,
            rankingOverrideCount: 1,
            skippedSignableCount: 1,
            untouchedSignableCount: 1,
            loadScore: 8,
            status: "heavy",
            headlineRewriteCandidateIds: ["old"],
            rankingOverrideCandidateIds: ["old"],
            skippedSignableCandidateIds: ["old"],
            untouchedSignableCandidateIds: ["old"],
            rationale: ["Operator load was heavy yesterday."]
          },
          nextDayRecommendations: []
        },
        markdown: ""
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/reports/daily/2026-03-29.json"),
      JSON.stringify({
        kind: "daily_report",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T23:00:00Z",
        detections: {
          totalDetected: 2,
          totalSubmitted: 2,
          submissionConversionRate: 1,
          detectedCandidateIds: ["top"],
          submittedCandidateIds: ["top"],
          submittedHeadlines: ["Top story"],
          beats: ["infrastructure"]
        },
        rejections: { totalRejected: 0, rejectedCandidateIds: [], reasons: [] },
        approvalsAndRewards: {
          totalApprovals: 1,
          totalDeclines: 0,
          resolvedSubmissionCount: 1,
          pendingSubmissionCount: 0,
          sameDayResolvedApprovalRate: 1,
          approvalNotes: [],
          totalSatsEarned: 500,
          btcRewards: ["$20 BTC"],
          leaderboardChanges: ["up_1"]
        },
        narrative: { changed: [], improve: [] },
        optimization: {
          kind: "daily_optimization",
          reportDate: "2026-03-29",
          generatedAt: "2026-03-29T23:00:00Z",
          beatPreferences: [],
          rejectionThreshold: { mode: "standard", drivers: [] },
          duplicateLossPatterns: [],
          winningHeadlinePatterns: [],
          trainingWinningTags: [],
          trainingRejectionTags: [],
          beatCrowding: [],
          operatorLoad: {
            totalSignableCandidates: 3,
            headlineRewriteRequiredCount: 1,
            rankingOverrideCount: 0,
            skippedSignableCount: 0,
            untouchedSignableCount: 0,
            loadScore: 2,
            status: "light",
            headlineRewriteCandidateIds: ["top"],
            rankingOverrideCandidateIds: [],
            skippedSignableCandidateIds: [],
            untouchedSignableCandidateIds: [],
            rationale: ["3 signable candidates reached human review today."]
          },
          nextDayRecommendations: []
        },
        markdown: ""
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/queues/2026-03-29.json"),
      JSON.stringify({
        kind: "ranked_candidate_queue",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T23:00:00Z",
        candidates: [
          {
            candidateId: "top",
            score: 86,
            decision: "file",
            headline: "Top story",
            reasons: [
              "submission gate passed",
              "editorial review says ready to file",
              "beat Infrastructure matches the historical brief-winning lanes",
              "sources match domains that have recently won the brief (aibtc.com)"
            ],
            beat: "infrastructure",
            sourcePath: "/tmp/top.json"
          }
        ]
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/filing-queue/2026-03-29.json"),
      JSON.stringify({
        kind: "filing_queue",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T23:00:00Z",
        topCandidateId: "top",
        recommendationSummary: {
          targetRecommendations: 5,
          recommendedCount: 3,
          uniqueBeatCount: 3,
          beatsRepresented: ["distribution", "infrastructure", "security"],
          quotaNotes: ["Soft beat quota kept 3 beats represented in the recommendation slate."]
        },
        items: []
      }),
      "utf8"
    );

    const summary = await generateDailyOperatorSummary(
      "2026-03-29",
      "2026-03-29T23:10:00Z",
      tempDir
    );
    assert.equal(summary.topCandidate.candidateId, "top");
    assert.equal(summary.improving.status, "yes");
    assert.match(summary.changedFromYesterday.join(" "), /Strictness regime is standard/);
    assert.ok(summary.rationaleGroups.some((group) => group.label === "Approval Fit"));
    assert.ok(summary.rationaleGroups.some((group) => group.label === "Brief Fit"));
    assert.ok(summary.operatorBoundary.some((line) => /operator-only/i.test(line)));
    assert.ok(summary.queueGuidance.some((line) => /Recommendation slate: 3\/5 signable candidates/i.test(line)));
    assert.ok(summary.queueGuidance.some((line) => /Operator load: light \(2\)/i.test(line)));
    assert.ok(summary.workingLoop.some((line) => /Startup preflight: confirm this session is inside aibtcagent/i.test(line)));
    assert.ok(summary.workingLoop.some((line) => /Inspect data\/filing-queue\/2026-03-29\.json/.test(line)));
    assert.ok(summary.workingLoop.some((line) => /strategy memory only/i.test(line)));
    assert.ok(summary.workingLoop.some((line) => /source new stories instead of reusing yesterday's queue/i.test(line)));
    assert.ok(summary.workingLoop.some((line) => /approve-filing/.test(line)));
    assert.ok(summary.workingLoop.some((line) => /operator-signability\.json/.test(line)));
    assert.ok(summary.workingLoop.some((line) => /Do not let the agent submit or sign wallet actions directly/i.test(line)));
    assert.ok(summary.improving.reasons.some((line) => /Operator load eased from 8 to 2/i.test(line)));

    const paths = await saveDailyOperatorSummary(summary, tempDir);
    const saved = JSON.parse(await readFile(paths.jsonPath, "utf8"));
    assert.equal(saved.kind, "daily_operator_summary");
    assert.equal(Array.isArray(saved.workingLoop), true);
    const markdown = await readFile(paths.markdownPath, "utf8");
    assert.match(markdown, /Why It Ranked First/);
    assert.match(markdown, /Reason Groups/);
    assert.match(markdown, /Operator Boundary/);
    assert.match(markdown, /Queue Guidance/);
    assert.match(markdown, /Working Loop/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("operator summary makes fresh-sourcing requirements explicit when no candidate ranks", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-operator-summary-"));

  try {
    await mkdir(resolve(tempDir, "data/reports/daily"), { recursive: true });
    await mkdir(resolve(tempDir, "data/queues"), { recursive: true });
    await mkdir(resolve(tempDir, "data/filing-queue"), { recursive: true });

    await writeFile(
      resolve(tempDir, "data/reports/daily/2026-03-29.json"),
      JSON.stringify({
        kind: "daily_report",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T23:00:00Z",
        detections: {
          totalDetected: 0,
          totalSubmitted: 0,
          submissionConversionRate: null,
          detectedCandidateIds: [],
          submittedCandidateIds: [],
          submittedHeadlines: [],
          beats: []
        },
        rejections: { totalRejected: 0, rejectedCandidateIds: [], reasons: [] },
        approvalsAndRewards: {
          totalApprovals: 0,
          totalDeclines: 0,
          resolvedSubmissionCount: 0,
          pendingSubmissionCount: 0,
          sameDayResolvedApprovalRate: null,
          approvalNotes: [],
          totalSatsEarned: 0,
          btcRewards: [],
          leaderboardChanges: []
        },
        narrative: { changed: [], improve: [] },
        optimization: {
          kind: "daily_optimization",
          reportDate: "2026-03-29",
          generatedAt: "2026-03-29T23:00:00Z",
          beatPreferences: [],
          rejectionThreshold: { mode: "standard", drivers: [] },
          duplicateLossPatterns: [],
          winningHeadlinePatterns: [],
          trainingWinningTags: [],
          trainingRejectionTags: [],
          beatCrowding: [],
          nextDayRecommendations: []
        },
        markdown: ""
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/queues/2026-03-29.json"),
      JSON.stringify({
        kind: "ranked_candidate_queue",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T23:00:00Z",
        candidates: []
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/filing-queue/2026-03-29.json"),
      JSON.stringify({
        kind: "filing_queue",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T23:00:00Z",
        topCandidateId: null,
        recommendationSummary: {
          targetRecommendations: 5,
          recommendedCount: 0,
          uniqueBeatCount: 0,
          beatsRepresented: [],
          quotaNotes: ["Only 0 recommendations survived signable-quality and diversity review."]
        },
        items: []
      }),
      "utf8"
    );

    const summary = await generateDailyOperatorSummary(
      "2026-03-29",
      "2026-03-29T23:10:00Z",
      tempDir
    );

    assert.equal(summary.topCandidate.candidateId, null);
    assert.ok(summary.whyItRankedFirst.some((line) => /no fresh fetched candidate ranked/i.test(line)));
    assert.ok(summary.whyItRankedFirst.some((line) => /not filing candidates/i.test(line)));
    assert.ok(summary.whyItRankedFirst.some((line) => /source new stories/i.test(line)));
    assert.ok(summary.queueGuidance.some((line) => /0\/5 signable candidates/i.test(line)));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("operator summary prefers the filing-queue top candidate over a higher-scoring hold", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-operator-summary-"));

  try {
    await mkdir(resolve(tempDir, "data/reports/daily"), { recursive: true });
    await mkdir(resolve(tempDir, "data/queues"), { recursive: true });
    await mkdir(resolve(tempDir, "data/filing-queue"), { recursive: true });

    await writeFile(
      resolve(tempDir, "data/reports/daily/2026-03-30.json"),
      JSON.stringify({
        kind: "daily_report",
        reportDate: "2026-03-30",
        generatedAt: "2026-03-30T23:00:00Z",
        detections: {
          totalDetected: 2,
          totalSubmitted: 1,
          submissionConversionRate: 0.5,
          detectedCandidateIds: ["hold-story", "file-story"],
          submittedCandidateIds: ["file-story"],
          submittedHeadlines: ["File story"],
          beats: ["protocol-updates"]
        },
        rejections: { totalRejected: 0, rejectedCandidateIds: [], reasons: [] },
        approvalsAndRewards: {
          totalApprovals: 0,
          totalDeclines: 0,
          totalInBrief: 0,
          approvalNotInBriefCount: 0,
          resolvedSubmissionCount: 0,
          pendingSubmissionCount: 1,
          sameDayResolvedApprovalRate: null,
          sameDayResolvedInBriefRate: null,
          approvalNotes: [],
          failureNotes: [],
          totalSatsEarned: 0,
          btcRewards: [],
          leaderboardChanges: []
        },
        narrative: { changed: [], improve: [] },
        optimization: {
          kind: "daily_optimization",
          reportDate: "2026-03-30",
          generatedAt: "2026-03-30T23:00:00Z",
          beatPreferences: [],
          rejectionThreshold: { mode: "standard", drivers: [] },
          duplicateLossPatterns: [],
          winningHeadlinePatterns: [],
          trainingWinningTags: [],
          trainingRejectionTags: [],
          beatCrowding: [],
          nextDayRecommendations: []
        },
        markdown: ""
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/queues/2026-03-30.json"),
      JSON.stringify({
        kind: "ranked_candidate_queue",
        reportDate: "2026-03-30",
        generatedAt: "2026-03-30T23:00:00Z",
        candidates: [
          {
            candidateId: "hold-story",
            score: 99,
            decision: "hold",
            headline: "Hold story",
            reasons: ["freshness risk must be cleared before filing"]
          },
          {
            candidateId: "file-story",
            score: 95,
            decision: "file",
            headline: "File story",
            reasons: ["submission gate passed", "editorial review says ready to file"]
          }
        ]
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/filing-queue/2026-03-30.json"),
      JSON.stringify({
        kind: "filing_queue",
        reportDate: "2026-03-30",
        generatedAt: "2026-03-30T23:00:00Z",
        topCandidateId: "file-story",
        recommendationSummary: {
          targetRecommendations: 5,
          recommendedCount: 1,
          uniqueBeatCount: 1,
          beatsRepresented: ["protocol-updates"],
          quotaNotes: []
        },
        items: [
          {
            candidateId: "file-story",
            headline: "File story",
            beat: "protocol-updates",
            score: 95,
            duplicateStatus: "clear",
            freshnessStatus: "clear",
            queueStatus: "awaiting_human_approval",
            reasons: ["submission gate passed", "editorial review says ready to file"]
          }
        ]
      }),
      "utf8"
    );

    const summary = await generateDailyOperatorSummary(
      "2026-03-30",
      "2026-03-30T23:10:00Z",
      tempDir
    );

    assert.equal(summary.topCandidate.candidateId, "file-story");
    assert.equal(summary.topCandidate.decision, "file");
    assert.ok(summary.workingLoop.some((line) => /--candidate file-story/.test(line)));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
