import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCausality,
  validateDisclosure,
  validateOneSentenceHeadline,
  validateProof,
  validateSubject,
  rejectDashboardPrimarySource,
  rejectDuplicate
} from "../dist/validation/index.js";

function createValidSubject() {
  return {
    candidate: {
      candidateId: "sig-1",
      detectedAt: "2026-03-25T00:00:00Z",
      beat: "protocol-updates",
      category: "protocol-change",
      summary: "A new contract launched",
      significance: "it may signal a live protocol",
      causality: "the deployment was followed by a funding transaction",
      detectionMethod: "mixed",
      usesDashboardAsPrimarySource: false,
      likelyDuplicate: false
    },
    headline:
      "A newly deployed contract drew immediate funding, signaling a live protocol launch before dashboards catch up.",
    proof: [
      {
        chain: "stacks",
        txHash: "0xabc123",
        contractAddress: "SP11.contract-v1",
        queryName: "deploy",
        queryResult: "confirmed",
        blockHeight: 123,
        proofNote: "deployment detected"
      }
    ],
    sources: [
      {
        sourceType: "rpc",
        sourceName: "Stacks RPC",
        sourceUrl: "https://example.invalid/rpc",
        sourceRole: "primary-proof"
      }
    ],
    modelDisclosure: {
      toolsUsed: ["query", "clarity-audit"],
      derivationSteps: ["Detected event.", "Verified it with onchain proof."]
    }
  };
}

test("one-sentence headline validator accepts a single sentence", () => {
  assert.equal(
    validateOneSentenceHeadline(
      "A newly deployed contract drew immediate funding, signaling a live protocol launch."
    ),
    true
  );
});

test("one-sentence headline validator rejects multiple sentences", () => {
  assert.equal(
    validateOneSentenceHeadline(
      "A newly deployed contract drew immediate funding. It may signal a live protocol launch."
    ),
    false
  );
});

test("proof validator rejects signals without usable proof", () => {
  const subject = createValidSubject();
  subject.proof = [
    {
      chain: "stacks",
      txHash: null,
      contractAddress: null,
      queryName: "deploy",
      queryResult: null,
      blockHeight: null,
      proofNote: null
    }
  ];

  assert.equal(validateProof(subject), false);
});

test("causality validator rejects missing causality", () => {
  const subject = createValidSubject();
  subject.candidate.causality = "   ";

  assert.equal(validateCausality(subject), false);
});

test("disclosure validator rejects missing sources", () => {
  const subject = createValidSubject();
  subject.sources = [];

  assert.equal(validateDisclosure(subject), false);
});

test("disclosure validator rejects missing model disclosure", () => {
  const subject = createValidSubject();
  subject.modelDisclosure = {
    toolsUsed: [],
    derivationSteps: []
  };

  assert.equal(validateDisclosure(subject), false);
});

test("dashboard rule rejects dashboard-primary signals", () => {
  const subject = createValidSubject();
  subject.candidate.usesDashboardAsPrimarySource = true;

  assert.equal(rejectDashboardPrimarySource(subject), false);
});

test("duplicate rule rejects likely duplicate signals", () => {
  const subject = createValidSubject();
  subject.candidate.likelyDuplicate = true;

  assert.equal(rejectDuplicate(subject), false);
});

test("validation engine accepts a fully valid signal", () => {
  const result = validateSubject(createValidSubject());

  assert.equal(result.passed, true);
  assert.equal(Object.values(result.checks).every(Boolean), true);
});

test("validation engine fails when any required rule fails", () => {
  const subject = createValidSubject();
  subject.candidate.likelyDuplicate = true;

  const result = validateSubject(subject);

  assert.equal(result.passed, false);
  assert.equal(result.checks.duplicateRejected, false);
});
