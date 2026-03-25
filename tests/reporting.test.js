import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildPreSubmissionIntelligence } from "../dist/intelligence/index.js";
import { buildSubmissionPayload } from "../dist/newsroom/index.js";
import { generateAndSaveDailyReport } from "../dist/reporting/index.js";
import { runProtocolUpdateLane } from "../dist/signals/index.js";
import {
  logAcceptedSubmission,
  logApprovalOutcome,
  logDetectedCandidate,
  logLeaderboardObservation,
  logRejectedCandidate,
  logRewardOutcome
} from "../dist/storage/index.js";
import { validateSubject } from "../dist/validation/index.js";

function createSubject(id, detectedAt, summarySuffix) {
  return runProtocolUpdateLane({
    id,
    detectedAt,
    chain: "stacks",
    contractAddress: `SP11WK0Y2549AKAPDNRKYXGWCHVPJJK2DFX547KGR.${id}`,
    deployTxHash: `0xdeploy-${id}`,
    firstInteractionTxHash: `0xinteract-${id}`,
    blockHeight: 182450,
    summary: `Protocol update ${summarySuffix}`,
    significance: "a live protocol launch is visible onchain before public dashboards catch up",
    causalTrigger: "its deployment was followed by a first funding and interaction transaction",
    usesDashboardAsPrimarySource: false,
    likelyDuplicate: false,
    sourceUrls: {
      rpc: `https://example.invalid/v2/transactions/${id}`,
      explorer: `https://explorer.hiro.so/txid/${id}`
    }
  }).subject;
}

function createSubmissionPayload(id, detectedAt, summarySuffix, generatedAt) {
  const subject = createSubject(id, detectedAt, summarySuffix);
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
  "daily reporting summarizes detections, outcomes, and recommendations in markdown",
  { concurrency: false },
  async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-reporting-"));
    const originalCwd = process.cwd();

    try {
      await mkdir(resolve(tempDir, "data/logs"), { recursive: true });
      process.chdir(tempDir);
      const firstSubject = createSubject(
        "protocol-update-report-001",
        "2026-03-25T06:30:00Z",
        "alpha"
      );
      const secondSubject = createSubject(
        "protocol-update-report-002",
        "2026-03-25T07:10:00Z",
        "beta"
      );
      const thirdSubject = createSubject(
        "protocol-update-report-003",
        "2026-03-25T07:40:00Z",
        "gamma"
      );
      const fourthSubject = createSubject(
        "protocol-update-report-004",
        "2026-03-25T07:50:00Z",
        "delta"
      );
      const priorDaySubject = createSubject(
        "protocol-update-report-previous-day",
        "2026-03-24T06:30:00Z",
        "previous-day"
      );

      await logDetectedCandidate(firstSubject.candidate, "2026-03-25T08:00:00Z");
      await logDetectedCandidate(secondSubject.candidate, "2026-03-25T08:05:00Z");
      await logDetectedCandidate(thirdSubject.candidate, "2026-03-25T08:10:00Z");
      await logDetectedCandidate(fourthSubject.candidate, "2026-03-25T08:15:00Z");
      await logDetectedCandidate(priorDaySubject.candidate, "2026-03-24T08:00:00Z");

      await logRejectedCandidate(
        "protocol-update-report-002",
        ["likely_duplicate"],
        "2026-03-25T08:20:00Z"
      );
      await logRejectedCandidate(
        "protocol-update-report-004",
        ["likely_duplicate", "leaderboard_not_checked"],
        "2026-03-25T08:25:00Z"
      );

      await logAcceptedSubmission(
        "protocol-update-report-001",
        createSubmissionPayload(
          "protocol-update-report-001",
          "2026-03-25T06:30:00Z",
          "alpha",
          "2026-03-25T08:30:00Z"
        ),
        "2026-03-25T08:30:00Z"
      );
      await logAcceptedSubmission(
        "protocol-update-report-003",
        createSubmissionPayload(
          "protocol-update-report-003",
          "2026-03-25T07:40:00Z",
          "gamma",
          "2026-03-25T08:35:00Z"
        ),
        "2026-03-25T08:35:00Z"
      );

      await logApprovalOutcome(
        "protocol-update-report-001",
        true,
        "Selected for brief",
        "2026-03-25T09:00:00Z"
      );
      await logApprovalOutcome(
        "protocol-update-report-003",
        false,
        "Too similar to prior brief",
        "2026-03-25T09:05:00Z"
      );
      await logRewardOutcome(
        "protocol-update-report-001",
        500,
        "$20 BTC",
        "2026-03-25T09:10:00Z"
      );
      await logLeaderboardObservation(
        "protocol-updates",
        "up_2",
        ["Beat remained less crowded than deal-flow."],
        "2026-03-25T09:15:00Z"
      );

      const { report, savedTo, savedJsonTo } = await generateAndSaveDailyReport(
        "2026-03-25",
        "2026-03-25T23:00:00Z"
      );

      assert.equal(report.kind, "daily_report");
      assert.equal(report.detections.totalDetected, 4);
      assert.equal(report.detections.totalSubmitted, 2);
      assert.equal(report.detections.submissionConversionRate, 0.5);
      assert.deepEqual(report.detections.beats, ["protocol-updates"]);
      assert.equal(report.rejections.totalRejected, 2);
      assert.deepEqual(report.rejections.reasons[0], {
        reason: "likely_duplicate",
        count: 2
      });
      assert.equal(report.approvalsAndRewards.totalApprovals, 1);
      assert.equal(report.approvalsAndRewards.totalDeclines, 1);
      assert.equal(report.approvalsAndRewards.resolvedSubmissionCount, 2);
      assert.equal(report.approvalsAndRewards.pendingSubmissionCount, 0);
      assert.equal(report.approvalsAndRewards.sameDayResolvedApprovalRate, 0.5);
      assert.equal(report.approvalsAndRewards.totalSatsEarned, 500);
      assert.deepEqual(report.approvalsAndRewards.btcRewards, ["$20 BTC"]);
      assert.deepEqual(report.approvalsAndRewards.leaderboardChanges, ["up_2"]);
      assert.match(report.markdown, /## Detections and Submissions/);
      assert.match(report.markdown, /likely_duplicate: 2/);
      assert.match(report.markdown, /Total sats earned: 500/);
      assert.match(report.markdown, /\$20 BTC/);
      assert.match(report.markdown, /up_2/);
      assert.match(report.markdown, /Reduce likely_duplicate rejections/);
      assert.match(report.markdown, /## Next-Day Recommendations/);
      assert.ok(report.optimization.nextDayRecommendations.length > 0);
      assert.ok(report.optimization.duplicateLossPatterns.length > 0);

      const savedMarkdown = await readFile(savedTo, "utf8");
      assert.equal(savedMarkdown, report.markdown);
      const savedJson = JSON.parse(await readFile(savedJsonTo, "utf8"));
      assert.equal(savedJson.kind, "daily_report");
      assert.match(savedTo, /data\/reports\/daily\/2026-03-25\.md$/);
      assert.match(savedJsonTo, /data\/reports\/daily\/2026-03-25\.json$/);
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  }
);

test("daily reporting handles an empty first day without false warnings", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-reporting-empty-"));

  try {
    const { report, savedJsonTo } = await generateAndSaveDailyReport(
      "2026-03-25",
      "2026-03-25T23:00:00Z",
      { baseDir: tempDir }
    );

    assert.equal(report.detections.totalDetected, 0);
    assert.equal(report.detections.totalSubmitted, 0);
    assert.equal(report.detections.submissionConversionRate, null);
    assert.equal(report.approvalsAndRewards.sameDayResolvedApprovalRate, null);
    assert.match(report.markdown, /Submission conversion rate: n\/a/);
    assert.doesNotMatch(report.markdown, /Record a leaderboard observation each day/);
    assert.equal(JSON.parse(await readFile(savedJsonTo, "utf8")).kind, "daily_report");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
