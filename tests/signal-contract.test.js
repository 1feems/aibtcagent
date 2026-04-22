import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHelperReadySignalPackage,
  parseCanonicalSignalPayload,
  validateFirstSubmissionPayload
} from "../dist/filing/signal-contract.js";

test("canonical signal payload treats body as the canonical content field", () => {
  const { payload, issues } = parseCanonicalSignalPayload({
    beat_slug: "quantum",
    headline: "BIP-360 P2MR vectors still carry two unmerged test-vector bugs from Feb. 15 PRs",
    body: "CLAIM: PR #1895 leaves 2 BIP-360 vector failures unresolved. EVIDENCE: https://github.com/bitcoin/bips/pull/1895 documents the 2 failing cases. IMPLICATION: Quantum operators should monitor PR #1895 before treating the vectors as settlement-safe.",
    sources: [{ url: "https://github.com/bitcoin/bips/pull/1895", title: "PR #1895 review thread" }],
    tags: ["quantum"],
    disclosure: "gpt-5.4; GitHub review of https://github.com/bitcoin/bips/pull/1895"
  });

  assert.ok(payload);
  assert.equal(issues.length, 0);
  assert.match(payload.body, /^CLAIM:/);
});

test("helper-ready signal packages emit body in the live submission JSON", () => {
  const { payload } = parseCanonicalSignalPayload({
    beat_slug: "quantum",
    headline: "BIP-360 P2MR vectors still carry two unmerged test-vector bugs from Feb. 15 PRs",
    body: "CLAIM: PR #1895 leaves 2 BIP-360 vector failures unresolved. EVIDENCE: https://github.com/bitcoin/bips/pull/1895 documents the 2 failing cases. IMPLICATION: Quantum operators should monitor PR #1895 before treating the vectors as settlement-safe.",
    sources: [{ url: "https://github.com/bitcoin/bips/pull/1895", title: "PR #1895 review thread" }],
    tags: ["quantum"],
    disclosure: "gpt-5.4; GitHub review of https://github.com/bitcoin/bips/pull/1895"
  });

  assert.ok(payload);
  const helperPackage = buildHelperReadySignalPackage(payload);

  assert.equal(helperPackage.body, payload.body);
  assert.equal(helperPackage.beat_slug, "quantum");
  assert.equal(helperPackage.json.beat_slug, "quantum");
  assert.equal(helperPackage.json.body, helperPackage.body);
  assert.equal(helperPackage.json.analysis, helperPackage.body);
});

test("helper-ready quantum package preserves the live submission shape", () => {
  const { payload, issues } = parseCanonicalSignalPayload({
    beat_slug: "quantum",
    headline: "PR #1895 keeps BIP-360 vector audit open after 2 failing cases",
    body: "CLAIM: PR #1895 still leaves two BIP-360 vector failures unresolved. EVIDENCE: https://github.com/bitcoin/bips/pull/1895 and its review thread document the two failing cases. IMPLICATION: Quantum operators should not treat the current vectors as settlement-safe until the audit closes.",
    sources: [{ url: "https://github.com/bitcoin/bips/pull/1895", title: "PR #1895 review thread" }],
    tags: ["quantum"],
    disclosure: "claude-sonnet-4-6, github review of PR #1895"
  });

  assert.ok(payload);
  assert.equal(issues.length, 0);
  const helperPackage = buildHelperReadySignalPackage(payload);

  assert.deepEqual(helperPackage.json, {
    btc_address: helperPackage.btc_address,
    beat_slug: "quantum",
    headline: "PR #1895 keeps BIP-360 vector audit open after 2 failing cases",
    body: payload.body,
    analysis: payload.body,
    sources: [{ url: "https://github.com/bitcoin/bips/pull/1895", title: "PR #1895 review thread" }],
    tags: ["quantum"],
    disclosure: "claude-sonnet-4-6, github review of PR #1895"
  });
});

test("helper-ready package refuses first-submission payloads that omit evidence URLs", () => {
  const { payload, issues } = parseCanonicalSignalPayload({
    beat_slug: "quantum",
    headline: "PR #1895 keeps BIP-360 vector audit open after 2 failing cases",
    body: "CLAIM: PR #1895 still leaves two BIP-360 vector failures unresolved. EVIDENCE: PR #1895 and its review thread document the two failing cases. IMPLICATION: Quantum operators should monitor the audit before using the vectors.",
    sources: [{ url: "https://github.com/bitcoin/bips/pull/1895", title: "PR #1895 review thread" }],
    tags: ["quantum"],
    disclosure: "gpt-5.4; GitHub review of https://github.com/bitcoin/bips/pull/1895"
  });

  assert.ok(payload);
  assert.equal(issues.length, 0);
  assert.deepEqual(
    validateFirstSubmissionPayload(payload).map((issue) => issue.code),
    ["first_submission_evidence_missing_url", "first_submission_evidence_source_mismatch"]
  );
  assert.throws(
    () => buildHelperReadySignalPackage(payload),
    /first_submission_evidence_missing_url/
  );
});

test("canonical signal payload refuses beats outside the accepted three", () => {
  const result = parseCanonicalSignalPayload({
    beat_slug: "infrastructure",
    headline: "PR #431 restores sBTC relay recovery after Issue #363 nonce timeouts",
    body: [
      "CLAIM: PR #431 restores the sBTC relay recovery path that stalled queued agent settlements.",
      "EVIDENCE: https://github.com/aibtcdev/x402-sponsor-relay/pull/431 documents the merged patch and Issue #363 nonce-timeout failure mode.",
      "IMPLICATION: Operators should verify PR #431 before re-enabling automated sBTC relay settlement."
    ].join("\n"),
    sources: [{ url: "https://github.com/aibtcdev/x402-sponsor-relay/pull/431", title: "PR #431 relay recovery" }],
    tags: ["infrastructure"],
    disclosure: "gpt-5.4; GitHub review of PR #431 and Issue #363"
  });

  assert.ok(result.issues.some((issue) => issue.code === "format_beat_slug_not_allowed"));
});
