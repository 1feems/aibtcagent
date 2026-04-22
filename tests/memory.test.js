import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildPreSubmissionIntelligence } from "../dist/intelligence/index.js";
import { buildSubmissionPayload } from "../dist/newsroom/index.js";
import { runInfrastructureLane } from "../dist/signals/index.js";
import {
  logAcceptedSubmission,
  logApprovalOutcome,
  logDetectedCandidate,
  logLeaderboardObservation,
  logRejectedCandidate,
  logRewardOutcome
} from "../dist/storage/index.js";
import { validateSubject } from "../dist/validation/index.js";

function createSubject() {
  return runInfrastructureLane({
    id: "protocol-update-001",
    detectedAt: "2026-03-25T06:30:00Z",
    chain: "stacks",
    contractAddress: "SP11WK0Y2549AKAPDNRKYXGWCHVPJJK2DFX547KGR.protocol-v1",
    deployTxHash: "0xdeploy123",
    firstInteractionTxHash: "0xinteract456",
    blockHeight: 182450,
    summary: "A newly deployed Stacks contract drew immediate first-use activity",
    significance: "a live protocol launch is visible onchain before public dashboards catch up",
    causalTrigger: "its deployment was followed by a first funding and interaction transaction",
    sourceUrls: {
      rpc: "https://example.invalid/v2/transactions/0xinteract456",
      explorer: "https://explorer.hiro.so/txid/0xinteract456"
    }
  }).subject;
}

function createSubmissionPayload() {
  const subject = createSubject();
  const validation = validateSubject(subject);
  const preSubmission = buildPreSubmissionIntelligence({
    dailyBriefChecked: true,
    activityFeedChecked: true,
    leaderboardChecked: true,
    reputationChecked: true,
    inboxChecked: true,
    agentStatusChecked: true,
    notes: ["All checks passed."],
    checkedAt: "2026-03-25T07:00:00Z"
  });

  return buildSubmissionPayload(subject, validation, preSubmission, "2026-03-25T07:05:00Z");
}

test("memory layer writes records without touching repo state", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-memory-"));

  process.chdir(tempDir);

  try {
    const subject = createSubject();
    await logDetectedCandidate(subject.candidate, "2026-03-25T08:00:00Z");

    const candidateSaved = await readFile(
      resolve(process.cwd(), "data/logs/candidates/protocol-update-001.json"),
      "utf8"
    );
    const candidateParsed = JSON.parse(candidateSaved);

    assert.equal(candidateParsed.kind, "candidate");
    assert.equal(candidateParsed.candidate.candidateId, "protocol-update-001");

    await assert.rejects(
      () => logDetectedCandidate(subject.candidate, "2026-03-25T08:00:00Z"),
      /Refusing to overwrite existing log file/
    );

    await logRejectedCandidate(
      "protocol-update-001",
      ["likely_duplicate"],
      "2026-03-25T08:01:00Z"
    );

    const rejectionSaved = await readFile(
      resolve(process.cwd(), "data/logs/rejections/protocol-update-001.json"),
      "utf8"
    );
    const rejectionParsed = JSON.parse(rejectionSaved);

    assert.equal(rejectionParsed.kind, "rejection");
    assert.equal(rejectionParsed.reasons[0], "likely_duplicate");

    await logAcceptedSubmission(
      "protocol-update-001",
      createSubmissionPayload(),
      "2026-03-25T08:02:00Z"
    );

    const acceptedSaved = await readFile(
      resolve(process.cwd(), "data/logs/accepted/protocol-update-001.json"),
      "utf8"
    );
    const acceptedParsed = JSON.parse(acceptedSaved);

    assert.equal(acceptedParsed.kind, "accepted_submission");
    assert.equal(acceptedParsed.submission.headline.length > 0, true);

    await logApprovalOutcome(
      "protocol-update-001",
      true,
      "Selected for brief",
      "2026-03-25T08:03:00Z",
      { published: true, status: "approved", signalId: "signal-123" }
    );

    const approvalSaved = await readFile(
      resolve(process.cwd(), "data/outcomes/approvals/protocol-update-001.json"),
      "utf8"
    );
    const approvalParsed = JSON.parse(approvalSaved);

    assert.equal(approvalParsed.kind, "approval_outcome");
    assert.equal(approvalParsed.approved, true);
    assert.equal(approvalParsed.published, true);
    assert.equal(approvalParsed.status, "approved");
    assert.equal(approvalParsed.signalId, "signal-123");

    await logRewardOutcome("protocol-update-001", 500, "$20 BTC", "2026-03-25T08:04:00Z");

    const rewardSaved = await readFile(
      resolve(process.cwd(), "data/outcomes/rewards/protocol-update-001.json"),
      "utf8"
    );
    const rewardParsed = JSON.parse(rewardSaved);

    assert.equal(rewardParsed.kind, "reward_outcome");
    assert.equal(rewardParsed.satsEarned, 500);
    assert.equal(rewardParsed.btcRewardEarned, "$20 BTC");

    await logLeaderboardObservation(
      "infrastructure",
      "up_2",
      ["Beat remained less crowded than deal-flow."],
      "2026-03-25T08:05:00Z"
    );

    const leaderboardSaved = await readFile(
      resolve(
        process.cwd(),
        "data/logs/leaderboard/infrastructure-2026-03-25T08-05-00Z.json"
      ),
      "utf8"
    );
    const leaderboardParsed = JSON.parse(leaderboardSaved);

    assert.equal(leaderboardParsed.kind, "leaderboard_observation");
    assert.equal(leaderboardParsed.beat, "infrastructure");
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
