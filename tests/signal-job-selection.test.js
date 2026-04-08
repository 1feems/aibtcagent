import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPreDraftPublisherFit,
  buildStructuralScreen,
  computePreDraftScore
} from "../dist/prep/signal-job.js";

test("pre-draft publisher-fit screen rejects weak non-mission-aligned candidate before deeper review", () => {
  const publisherFit = buildPreDraftPublisherFit(
    "Mysterious monitoring update lands",
    "A dashboard changed and the ecosystem may care soon.",
    "used ai and various sources"
  );

  assert.equal(publisherFit.missionAligned, false);
  assert.equal(publisherFit.replicable, false);
  assert.equal(publisherFit.inscribable, true);
  assert.equal(publisherFit.valueCreating, false);
});

test("structural screen recognizes winner-style anchor, implication, and actionability", () => {
  const structural = buildStructuralScreen(
    "PR #431 adds circuit-breaker checks as nonce-timeout losses expose false-healthy relay reads",
    "Claim: PR #431 adds circuit-breaker checks after nonce-timeout failures exposed a false-healthy relay state. Evidence: the change is tied to PR #431 and Issue #363 in x402-sponsor-relay. Implication: this means operators should verify relay-health recovery before retrying sponsored settlement flows."
  );

  assert.equal(structural.exactAnchor, true);
  assert.equal(structural.directOperatorConsequence, true);
  assert.equal(structural.claimEvidenceImplication, true);
  assert.equal(structural.actionLineViable, true);
  assert.equal(structural.displacementPotential, true);
});

test("pre-draft score rewards publisher-fit completeness and learned beat focus", () => {
  const publisherFit = buildPreDraftPublisherFit(
    "PR #431 adds circuit-breaker checks as nonce-timeout losses expose false-healthy relay reads",
    "Claim: PR #431 adds circuit-breaker checks after nonce-timeout failures exposed a false-healthy relay state. Evidence: the change is tied to PR #431 and Issue #363 in x402-sponsor-relay. Implication: this means operators should verify relay-health recovery before retrying sponsored settlement flows.",
    "claude-opus-4; https://github.com/aibtcdev/x402-sponsor-relay/pull/431; https://github.com/aibtcdev/x402-sponsor-relay/issues/363"
  );
  const structural = buildStructuralScreen(
    "PR #431 adds circuit-breaker checks as nonce-timeout losses expose false-healthy relay reads",
    "Claim: PR #431 adds circuit-breaker checks after nonce-timeout failures exposed a false-healthy relay state. Evidence: the change is tied to PR #431 and Issue #363 in x402-sponsor-relay. Implication: this means operators should verify relay-health recovery before retrying sponsored settlement flows."
  );

  const scored = computePreDraftScore(publisherFit, structural, "infrastructure", {
    primaryBeat: "infrastructure",
    secondaryBeat: "security",
    deprioritizedBeats: ["agent-economy", "distribution"]
  });

  assert.ok(scored.score >= 14);
  assert.ok(scored.reasons.includes("matches learned primary beat"));
});
