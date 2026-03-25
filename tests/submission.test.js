import test from "node:test";
import assert from "node:assert/strict";
import { buildPreSubmissionIntelligence } from "../dist/intelligence/index.js";
import { runProtocolUpdateLane } from "../dist/signals/index.js";
import {
  buildSubmissionDecision,
  buildSubmissionPayload,
  serializeSubmissionPayload
} from "../dist/newsroom/index.js";
import { validateSubject } from "../dist/validation/index.js";

function createPreSubmission() {
  return buildPreSubmissionIntelligence({
    dailyBriefChecked: true,
    activityFeedChecked: true,
    leaderboardChecked: true,
    reputationChecked: true,
    inboxChecked: true,
    agentStatusChecked: true,
    notes: ["All pre-submission checks passed."],
    checkedAt: "2026-03-25T07:00:00Z"
  });
}

function createRawProtocolEvent() {
  return {
    id: "protocol-update-001",
    detectedAt: "2026-03-25T06:30:00Z",
    chain: "stacks",
    contractAddress: "SP11WK0Y2549AKAPDNRKYXGWCHVPJJK2DFX547KGR.protocol-v1",
    deployTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    firstInteractionTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    blockHeight: 182450,
    summary: "A newly deployed Stacks contract drew immediate first-use activity",
    significance: "a live protocol launch before public dashboards catch up",
    causalTrigger: "its deployment was followed by a first funding and interaction transaction",
    usesDashboardAsPrimarySource: false,
    likelyDuplicate: false,
    firstInteractionQueryResult: "first interaction confirmed by protocol-update-deploy-and-first-use query",
    sourceUrls: {
      rpc: "https://example.invalid/v2/transactions/0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      explorer: "https://explorer.hiro.so/txid/0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    }
  };
}

test("submission decision submits valid signals", () => {
  const subject = runProtocolUpdateLane(createRawProtocolEvent()).subject;
  const validation = validateSubject(subject);

  const decision = buildSubmissionDecision(validation, createPreSubmission());

  assert.equal(decision.status, "submit");
  assert.deepEqual(decision.rejectionReasons, []);
});

test("submission decision rejects invalid signals", () => {
  const subject = runProtocolUpdateLane(createRawProtocolEvent()).subject;
  subject.candidate.likelyDuplicate = true;
  const validation = validateSubject(subject);

  const decision = buildSubmissionDecision(validation, createPreSubmission());

  assert.equal(decision.status, "reject");
  assert.equal(decision.rejectionReasons.includes("likely_duplicate"), true);
});

test("submission payload preserves proof, sources, and disclosure", () => {
  const subject = runProtocolUpdateLane(createRawProtocolEvent()).subject;
  const validation = validateSubject(subject);
  const payload = buildSubmissionPayload(
    subject,
    validation,
    createPreSubmission(),
    "2026-03-25T07:05:00Z"
  );

  assert.equal(payload.headline, subject.headline);
  assert.equal(payload.proof.length > 0, true);
  assert.equal(payload.sources.length > 0, true);
  assert.equal(payload.modelDisclosure.toolsUsed.length > 0, true);
  assert.equal(payload.submissionDecision.status, "submit");
});

test("submission decision rejects when pre-submission checks are incomplete", () => {
  const subject = runProtocolUpdateLane(createRawProtocolEvent()).subject;
  const validation = validateSubject(subject);
  const incomplete = buildPreSubmissionIntelligence({
    dailyBriefChecked: false,
    activityFeedChecked: true,
    leaderboardChecked: true,
    reputationChecked: true,
    inboxChecked: true,
    agentStatusChecked: true,
    notes: [],
    checkedAt: "2026-03-25T07:00:00Z"
  });

  const decision = buildSubmissionDecision(validation, incomplete);

  assert.equal(decision.status, "reject");
  assert.equal(decision.rejectionReasons.includes("daily_brief_not_checked"), true);
});

test("submission payload can be serialized to schema-compatible snake_case", () => {
  const subject = runProtocolUpdateLane(createRawProtocolEvent()).subject;
  const validation = validateSubject(subject);
  const payload = buildSubmissionPayload(
    subject,
    validation,
    createPreSubmission(),
    "2026-03-25T07:05:00Z"
  );

  const serialized = serializeSubmissionPayload(payload);

  assert.equal("model_disclosure" in serialized, true);
  assert.equal("generated_at" in serialized, true);
  assert.equal("tx_hash" in serialized.proof[0], true);
  assert.equal("tools_used" in serialized.model_disclosure, true);
});
