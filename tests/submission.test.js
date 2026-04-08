import test from "node:test";
import assert from "node:assert/strict";
import { buildPreSubmissionIntelligence } from "../dist/intelligence/index.js";
import { runGeneralNewsLane, runProtocolUpdateLane } from "../dist/signals/index.js";
import {
  buildEditorialReview,
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

function createReleaseProtocolEvent() {
  return {
    id: "protocol-update-release-001",
    detectedAt: "2026-03-25T18:00:00Z",
    chain: "github",
    summary: "x402 relay v1.22.0 doubles sponsor pool to 10 wallets",
    significance:
      "agents get 2x concurrent payment capacity from a versioned relay release before the change is broadly framed as a release signal",
    causalTrigger:
      "the relay was hitting nonce contention at 5 wallets under concurrent agent load",
    usesDashboardAsPrimarySource: false,
    likelyDuplicate: false,
    versionNumber: "x402-sponsor-relay-v1.22.0",
    releaseDate: "2026-03-24T19:12:39Z",
    changelogEntry: "increase sponsor wallet pool from 5 to 10",
    sourceUrls: {
      release:
        "https://github.com/aibtcdev/x402-sponsor-relay/releases/tag/x402-sponsor-relay-v1.22.0",
      compare:
        "https://github.com/aibtcdev/x402-sponsor-relay/compare/x402-sponsor-relay-v1.21.1...x402-sponsor-relay-v1.22.0"
    }
  };
}

function createGeneralNewsEvent() {
  return {
    id: "general-news-001",
    detectedAt: "2026-03-28T12:00:00Z",
    beat: "security",
    sourcePublication: "Chainalysis",
    articleUrl: "https://www.chainalysis.com/blog/test-incident/",
    publishedAt: "2026-03-28T11:30:00Z",
    namedEntity: "OpenClaw",
    hardNumber: "$2.7M",
    summary: "OpenClaw exposed 40K+ instances to remote code execution",
    significance: "The security issue matters because a named agent framework now has a measurable exposure window before most operators patch exposed deployments",
    causalTrigger: "A published security writeup tied exposed deployments to a concrete remote code execution path",
    agentConsequence: "Agents should patch exposed deployments and review wallet or credential handling before the exploit pattern spreads",
    proofUrl: "https://www.chainalysis.com/blog/test-incident/",
    proofNote: "The linked writeup names the affected software, exposure count, and exploit path",
    usesDashboardAsPrimarySource: false,
    likelyDuplicate: false
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

  assert.equal(payload.candidateSignal.candidateId, "protocol-update-001");
  assert.equal(payload.headline, subject.headline);
  assert.equal(payload.proof.length > 0, true);
  assert.equal(payload.sources.length > 0, true);
  assert.equal(payload.modelDisclosure.toolsUsed.length > 0, true);
  assert.equal(payload.submissionDecision.status, "submit");
  assert.equal(payload.editorialReview.readyToFile, true);
  assert.equal(payload.editorialReview.publisher.status, "pass");
  assert.equal(payload.articlePreview.audience, "human");
  assert.equal(payload.articlePreview.title.length > 0, true);
  assert.equal(
    payload.articlePreview.proofSummary.includes(
      "SP11WK0Y2549AKAPDNRKYXGWCHVPJJK2DFX547KGR.protocol-v1"
    ),
    true
  );
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

test("submission decision does not hard-reject when non-editorial telemetry checks are unavailable", () => {
  const subject = runProtocolUpdateLane(createRawProtocolEvent()).subject;
  const validation = validateSubject(subject);
  const incomplete = buildPreSubmissionIntelligence({
    dailyBriefChecked: true,
    activityFeedChecked: true,
    leaderboardChecked: false,
    reputationChecked: false,
    inboxChecked: false,
    agentStatusChecked: false,
    notes: [],
    checkedAt: "2026-03-25T07:00:00Z"
  });

  const decision = buildSubmissionDecision(validation, incomplete);

  assert.equal(decision.status, "submit");
  assert.deepEqual(decision.rejectionReasons, []);
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

  assert.equal("candidate_signal" in serialized, true);
  assert.equal("model_disclosure" in serialized, true);
  assert.equal("generated_at" in serialized, true);
  assert.equal("tx_hash" in serialized.proof[0], true);
  assert.equal("tools_used" in serialized.model_disclosure, true);
  assert.equal("editorial_review" in serialized, true);
  assert.equal(serialized.editorial_review.ready_to_file, true);
  assert.equal("article_preview" in serialized, true);
  assert.equal(serialized.article_preview.audience, "human");
});

test("editorial review can hold a technically valid candidate for publisher caution", () => {
  const subject = runProtocolUpdateLane(createRawProtocolEvent()).subject;
  subject.candidate.significance = "the contract is now visible onchain";
  const validation = validateSubject(subject);
  const submissionDecision = buildSubmissionDecision(validation, createPreSubmission());
  const editorialReview = buildEditorialReview(
    subject,
    validation,
    createPreSubmission(),
    submissionDecision
  );

  assert.equal(submissionDecision.status, "submit");
  assert.equal(editorialReview.publisher.status, "warn");
  assert.equal(editorialReview.readyToFile, false);
  assert.equal(editorialReview.holdReasons.includes("publisher_review_needed"), true);
});

test("submission payload supports versioned release-style protocol updates", () => {
  const subject = runProtocolUpdateLane(createReleaseProtocolEvent()).subject;
  const validation = validateSubject(subject);
  const payload = buildSubmissionPayload(
    subject,
    validation,
    createPreSubmission(),
    "2026-03-25T18:05:00Z"
  );

  assert.equal(payload.submissionDecision.status, "submit");
  assert.equal(payload.editorialReview.readyToFile, true);
  assert.equal(payload.articlePreview.proofSummary.includes("x402-sponsor-relay-v1.22.0"), true);
});

test("submission payload supports general-news candidates from feeds and reports", () => {
  const subject = runGeneralNewsLane(createGeneralNewsEvent()).subject;
  const validation = validateSubject(subject);
  const payload = buildSubmissionPayload(
    subject,
    validation,
    createPreSubmission(),
    "2026-03-28T12:05:00Z"
  );

  assert.equal(payload.submissionDecision.status, "submit");
  assert.equal(payload.editorialReview.protocol.status, "pass");
  assert.equal(payload.editorialReview.readyToFile, true);
  assert.equal(payload.sources[0].sourceRole, "primary-proof");
  assert.equal(payload.articlePreview.proofSummary.includes("Chainalysis"), true);
});
