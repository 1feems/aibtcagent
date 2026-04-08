import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { reviewSignal } from "../../dist/editor/review-engine.js";

const NOW = "2026-04-06T12:00:00Z";
const FIXTURES_DIR = resolve(process.cwd(), "data/editor/fixtures");

async function loadFixture(name) {
  const path = resolve(FIXTURES_DIR, `${name}.json`);
  return JSON.parse(await readFile(path, "utf8"));
}

// ── Approve: well-sourced, specific, operationally important ──────────────────

test("approve-strong: known-approve signal produces recommendation: approve with score >= 80", async () => {
  const signal = await loadFixture("approve-strong");
  const annotation = reviewSignal(signal, NOW);
  assert.equal(annotation.recommendation, "approve", `expected approve, got ${annotation.recommendation} (score=${annotation.score})`);
  assert.ok(annotation.score >= 80, `expected score >= 80, got ${annotation.score}`);
  assert.equal(annotation.beat_relevance, "core");
});

// ── Reject: PR title as sole evidence ────────────────────────────────────────

test("reject-pr-title: PR-title-only signal produces recommendation: reject", async () => {
  const signal = await loadFixture("reject-pr-title");
  const annotation = reviewSignal(signal, NOW);
  assert.equal(annotation.recommendation, "reject", `expected reject, got ${annotation.recommendation} (score=${annotation.score})`);
  const hasPrBiasFlag = annotation.factcheck.flagged.some((f) => f.includes("pr_title_bias"));
  assert.ok(hasPrBiasFlag, `expected pr_title_bias in flagged, got: ${JSON.stringify(annotation.factcheck.flagged)}`);
});

// ── Off-beat: price action / DeFi / governance signal ────────────────────────

test("off-beat: off-beat signal produces beat_relevance: off-beat and recommendation: reject", async () => {
  const signal = await loadFixture("off-beat");
  const annotation = reviewSignal(signal, NOW);
  assert.equal(annotation.beat_relevance, "off-beat", `expected off-beat, got ${annotation.beat_relevance}`);
  assert.equal(annotation.recommendation, "reject", `expected reject for off-beat, got ${annotation.recommendation}`);
  assert.ok(annotation.score <= 55, `off-beat cap should be <=55, got ${annotation.score}`);
});

// ── Revise: merged but not deployed ──────────────────────────────────────────

test("revise: merged-not-deployed signal produces recommendation: revise, score <= 75", async () => {
  const signal = await loadFixture("revise-merged-not-deployed");
  const annotation = reviewSignal(signal, NOW);
  assert.equal(annotation.recommendation, "revise", `expected revise, got ${annotation.recommendation} (score=${annotation.score})`);
  assert.ok(annotation.score <= 75, `unverified deployment cap should be <=75, got ${annotation.score}`);
  const hasDeployFlag = annotation.factcheck.flagged.some((f) => f.includes("unverified_deployment"));
  assert.ok(hasDeployFlag, `expected unverified_deployment in flagged, got: ${JSON.stringify(annotation.factcheck.flagged)}`);
});

// ── Score caps ────────────────────────────────────────────────────────────────

test("cap: signal with no Tier 1 source is capped at 60", () => {
  const signal = {
    id: "test-no-tier1",
    beat: "infrastructure",
    status: "submitted",
    headline: "Relay is healthy today.",
    analysis: "A relay report was posted to Twitter showing the relay has no nonce gaps.",
    sources: [{ url: "https://x.com/someone/status/123456789" }],
    correspondent: "bc1qtestaddr",
    submitted_at: NOW
  };
  const annotation = reviewSignal(signal, NOW);
  assert.ok(annotation.score <= 60, `no-tier1 cap should be <=60, got ${annotation.score}`);
  const hasNoTier1Flag = annotation.factcheck.flagged.some((f) => f.includes("No Tier 1 source"));
  assert.ok(hasNoTier1Flag, `expected No Tier 1 source in flagged, got: ${JSON.stringify(annotation.factcheck.flagged)}`);
});

test("cap: off-beat signal is capped at 55", () => {
  const signal = {
    id: "test-off-beat-cap",
    beat: "infrastructure",
    status: "submitted",
    headline: "New NFT collection launched on Stacks with 10,000 items.",
    analysis: "Community NFT mint opened today on gamma.io. 3,500 units sold in first hour. Floor price 50 STX.",
    sources: [{ url: "https://gamma.io/collections/new-collection" }],
    correspondent: "bc1qtestaddr",
    submitted_at: NOW
  };
  const annotation = reviewSignal(signal, NOW);
  assert.ok(annotation.score <= 55, `off-beat cap should be <=55, got ${annotation.score}`);
});

// ── Already-reviewed skip (memory-level, no double submission) ────────────────
// This is tested at the submit-review level; here we just confirm review engine
// returns a valid annotation for every signal it receives.

test("review engine produces valid annotation structure", () => {
  const signal = {
    id: "test-structure-check",
    beat: "infrastructure",
    status: "submitted",
    headline: "Stacks mainnet block production resumed after 4-minute gap on 2026-04-05.",
    analysis: "Block #190,222 was produced at 14:23 UTC after a 4-minute gap starting at 14:19 UTC. Chain explorer at explorer.hiro.so confirms block timestamps. Signer network recovered without intervention.",
    sources: [{ url: "https://explorer.hiro.so/block/190222?chain=mainnet" }],
    correspondent: "bc1qtestaddr",
    submitted_at: NOW
  };
  const annotation = reviewSignal(signal, NOW);

  assert.ok(typeof annotation.signal_id === "string");
  assert.ok(typeof annotation.score === "number");
  assert.ok(annotation.score >= 0 && annotation.score <= 100);
  assert.ok(["approve", "revise", "reject"].includes(annotation.recommendation));
  assert.ok(["core", "tangential", "off-beat"].includes(annotation.beat_relevance));
  assert.ok(["low", "medium", "high"].includes(annotation.confidence));
  assert.ok(Array.isArray(annotation.factcheck.verified));
  assert.ok(Array.isArray(annotation.factcheck.flagged));
  assert.ok(Array.isArray(annotation.factcheck.sources_checked));
  assert.ok(typeof annotation.scoreBreakdown.verification === "number");
  assert.ok(annotation.scoreBreakdown.verification <= 40);
  assert.ok(annotation.scoreBreakdown.operationalImpact <= 30);
  assert.ok(annotation.scoreBreakdown.sourceQuality <= 20);
  assert.ok(annotation.scoreBreakdown.clarityActionability <= 10);
});

// ── Testnet-only signal → reject ──────────────────────────────────────────────

test("testnet-only signal is rejected", () => {
  const signal = {
    id: "test-testnet-only",
    beat: "infrastructure",
    status: "submitted",
    headline: "New contract deployed on Stacks testnet for relay simulation testing.",
    analysis: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRCBLQWQ.relay-sim-v2 was deployed to testnet at block 12345. Devnet health endpoint returns nonce_gap=0. Testing purposes only.",
    sources: [{ url: "https://explorer.hiro.so/txid/0xabc?chain=testnet" }],
    correspondent: "bc1qtestaddr",
    submitted_at: NOW
  };
  // Note: malformed JSON in sources url — test still covers the logic path
  const annotation = reviewSignal(signal, NOW);
  assert.equal(annotation.recommendation, "reject");
  const hasTestnetFlag = annotation.factcheck.flagged.some((f) => f.includes("testnet_only"));
  assert.ok(hasTestnetFlag, `expected testnet_only flag, got: ${JSON.stringify(annotation.factcheck.flagged)}`);
});
