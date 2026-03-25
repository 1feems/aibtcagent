import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHeadline,
  enforceConciseHeadline,
  MAX_HEADLINE_LENGTH
} from "../dist/signals/index.js";

function createCandidate(overrides = {}) {
  return {
    candidateId: "sig-2",
    detectedAt: "2026-03-25T00:00:00Z",
    beat: "protocol-updates",
    category: "protocol-change",
    summary: "A newly deployed Stacks contract drew whale-sized first-use funding",
    significance: "a live protocol launch is visible onchain before public dashboards catch up",
    causality: "its deployment was followed by an immediate funding transaction",
    detectionMethod: "mixed",
    usesDashboardAsPrimarySource: false,
    likelyDuplicate: false,
    ...overrides
  };
}

test("headline composer builds a one-line sentence", () => {
  const headline = buildHeadline(createCandidate());

  assert.equal(headline.endsWith("."), true);
  assert.equal(headline.includes("\n"), false);
});

test("headline composer enforces concise formatting", () => {
  const headline = buildHeadline(createCandidate());

  assert.equal(headline.length <= MAX_HEADLINE_LENGTH, true);
});

test("headline composer falls back to shorter variants when needed", () => {
  const headline = buildHeadline(
    createCandidate({
      summary:
        "A newly deployed Stacks contract with extensive launch metadata and multiple unusual deployment characteristics drew whale-sized first-use funding",
      significance:
        "a live protocol launch is visible onchain before public dashboards catch up and before the broader market has fully priced it in",
      causality:
        "its deployment was followed by an immediate whale-sized funding transaction and several supporting interactions in the same monitoring window"
    })
  );

  assert.equal(headline.length <= MAX_HEADLINE_LENGTH, true);
  assert.equal(headline.split(/[.!?]+/u).filter(Boolean).length, 1);
});

test("concise enforcement trims multiple sentences to one", () => {
  const headline = enforceConciseHeadline(
    "A new contract launched on Stacks. It may matter for traders.",
    MAX_HEADLINE_LENGTH
  );

  assert.equal(headline, "A new contract launched on Stacks.");
});

test("headline composer preserves version numbers within one sentence", () => {
  const headline = enforceConciseHeadline(
    "Protocol v2.0 launched on Stacks after a funding event.",
    MAX_HEADLINE_LENGTH
  );

  assert.equal(headline, "Protocol v2.0 launched on Stacks after a funding event.");
});
