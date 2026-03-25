import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildPreSubmissionIntelligence } from "../dist/intelligence/index.js";
import { buildSubmissionPayload } from "../dist/newsroom/index.js";
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

function createSubject() {
  return runProtocolUpdateLane({
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

test("memory layer logs detected candidates", async () => {
  const subject = createSubject();
  await logDetectedCandidate(subject.candidate, "2026-03-25T08:00:00Z");

  const saved = await readFile(
    resolve(process.cwd(), "data/logs/candidates/protocol-update-001.json"),
    "utf8"
  );
  const parsed = JSON.parse(saved);

  assert.equal(parsed.kind, "candidate");
  assert.equal(parsed.candidate.candidateId, "protocol-update-001");
});

test("memory layer refuses to overwrite an existing candidate log", async () => {
  const subject = createSubject();

  await assert.rejects(
    () => logDetectedCandidate(subject.candidate, "2026-03-25T08:00:00Z"),
    /Refusing to overwrite existing log file/
  );
});

test("memory layer logs rejections and reasons", async () => {
  await logRejectedCandidate(
    "protocol-update-001",
    ["likely_duplicate"],
    "2026-03-25T08:01:00Z"
  );

  const saved = await readFile(
    resolve(process.cwd(), "data/logs/rejections/protocol-update-001.json"),
    "utf8"
  );
  const parsed = JSON.parse(saved);

  assert.equal(parsed.kind, "rejection");
  assert.equal(parsed.reasons[0], "likely_duplicate");
});

test("memory layer logs accepted submissions", async () => {
  await logAcceptedSubmission(
    "protocol-update-001",
    createSubmissionPayload(),
    "2026-03-25T08:02:00Z"
  );

  const saved = await readFile(
    resolve(process.cwd(), "data/logs/accepted/protocol-update-001.json"),
    "utf8"
  );
  const parsed = JSON.parse(saved);

  assert.equal(parsed.kind, "accepted_submission");
  assert.equal(parsed.submission.headline.length > 0, true);
});

test("memory layer logs approval outcomes", async () => {
  await logApprovalOutcome(
    "protocol-update-001",
    true,
    "Selected for brief",
    "2026-03-25T08:03:00Z"
  );

  const saved = await readFile(
    resolve(process.cwd(), "data/outcomes/approvals/protocol-update-001.json"),
    "utf8"
  );
  const parsed = JSON.parse(saved);

  assert.equal(parsed.kind, "approval_outcome");
  assert.equal(parsed.approved, true);
});

test("memory layer logs sats and BTC outcomes", async () => {
  await logRewardOutcome("protocol-update-001", 500, "$20 BTC", "2026-03-25T08:04:00Z");

  const saved = await readFile(
    resolve(process.cwd(), "data/outcomes/rewards/protocol-update-001.json"),
    "utf8"
  );
  const parsed = JSON.parse(saved);

  assert.equal(parsed.kind, "reward_outcome");
  assert.equal(parsed.satsEarned, 500);
  assert.equal(parsed.btcRewardEarned, "$20 BTC");
});

test("memory layer logs leaderboard and beat observations", async () => {
  await logLeaderboardObservation(
    "protocol-updates",
    "up_2",
    ["Beat remained less crowded than deal-flow."],
    "2026-03-25T08:05:00Z"
  );

  const saved = await readFile(
    resolve(
      process.cwd(),
      "data/logs/leaderboard/protocol-updates-2026-03-25T08-05-00Z.json"
    ),
    "utf8"
  );
  const parsed = JSON.parse(saved);

  assert.equal(parsed.kind, "leaderboard_observation");
  assert.equal(parsed.beat, "protocol-updates");
});
