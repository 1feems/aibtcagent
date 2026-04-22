import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { evaluateSignalGuard } from "../dist/filing/index.js";

test("signal guard stops at duplicate checks before later editorial gates", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });

    await writeFile(
      resolve(tempDir, "data/briefs/2026-04-03.md"),
      "# Brief Artifact: 2026-04-03\n\n- PR #431 adds circuit-breaker checks as nonce-timeout losses expose false-healthy relay reads\n",
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/state/filed-signals.json"),
      JSON.stringify({
        filedSignals: [
          {
            signalId: "sig-431",
            headline: "PR #431 adds circuit-breaker checks as nonce-timeout losses expose false-healthy relay reads",
            beat: "aibtc-network",
            filedAt: "2026-04-03T01:00:00Z",
            resolved: true
          }
        ]
      }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-03",
      headline: "PR #431 adds circuit-breaker checks as nonce-timeout losses expose false-healthy relay reads",
      beat_slug: "aibtc-network",
      body: "",
      sources: [],
      model_disclosure: { tools_used: [], derivation_steps: [] }
    }, tempDir);

    assert.equal(result.ok, false);
    assert.match(result.blockers[0], /already present|too close to already-filed/i);
    assert.equal(result.checks.currentBrief, "reject");
    assert.equal(result.checks.editorGuidance, "skipped_due_to_duplicate");
    assert.equal(result.checks.factCheckerSourceVerification, "skipped_due_to_duplicate");
    assert.equal(result.checks.winnerBar, "skipped_due_to_duplicate");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard passes a well-formed CLAIM / EVIDENCE / IMPLICATION body", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-07",
      headline: "Stacks relay sponsor nonce gap patched in PR #512",
      beat_slug: "aibtc-network",
      body: "Claim: PR #512 patches a nonce-gap bug in the Stacks sponsor relay that caused silently dropped transactions.\nEvidence: PR #512 adds a fill-gap call before broadcast; block 851234 shows 0 silent drops after merge.\nImplication: Operators can avoid continued transaction loss once the fix is applied.\nDirective: update sponsor relay deployments immediately and verify gap-fill before the next production run.",
      sources: [
        { url: "https://github.com/aibtcdev/sponsor-relay/pull/512", title: "PR #512" }
      ],
      model_disclosure: { tools_used: [], derivation_steps: [] }
    }, tempDir);

    const structureBlocker = result.blockers.find((b) => /CLAIM \/ EVIDENCE \/ IMPLICATION/.test(b));
    assert.equal(structureBlocker, undefined, `Expected no structure blocker but got: ${structureBlocker}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard accepts CLAIM / EVIDENCE / IMPLICATION without a Directive line", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-07",
      headline: "PR #2102 and PR #2103 leave BIP-360 vectors stale on 2026-02-15",
      beat_slug: "quantum",
      body: "CLAIM: BIP-360's published P2MR vectors still reflect two unresolved correctness bugs.\nEVIDENCE: On February 15, 2026, bitcoin/bips PR #2102 and PR #2103 documented the mismatched vector fields while bip-0360.mediawiki still shows the old values.\nIMPLICATION: AI agents and Bitcoin or sBTC operators can derive invalid signing paths from the canonical spec until the vectors are corrected.",
      sources: [
        { url: "https://github.com/bitcoin/bips/pull/2102", title: "PR #2102" },
        { url: "https://github.com/bitcoin/bips/pull/2103", title: "PR #2103" }
      ],
      model_disclosure: { tools_used: [], derivation_steps: [] }
    }, tempDir);

    const structureBlocker = result.blockers.find((b) => /signal template|Template check failed/.test(b));
    assert.equal(structureBlocker, undefined, `Expected no structure blocker but got: ${structureBlocker}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard rejects a free-form analysis missing the approved template frameworks", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-07",
      headline: "Stacks relay sponsor nonce gap patched in PR #512",
      beat_slug: "aibtc-network",
      body: "The Stacks relay sponsor had a nonce gap bug that has now been fixed. This is important for operators.",
      sources: [
        { url: "https://github.com/aibtcdev/sponsor-relay/pull/512", title: "PR #512" }
      ],
      model_disclosure: { tools_used: [], derivation_steps: [] }
    }, tempDir);

    assert.equal(result.ok, false);
    const structureBlocker = result.blockers.find((b) => /signal template/.test(b));
    assert.ok(structureBlocker, "Expected a structure blocker but none was found");
    assert.match(
      structureBlocker,
      /analysis must follow the signal template — missing CLAIM:, EVIDENCE:, IMPLICATION:/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard reports publisher, fact-check, and format diagnostics with explicit layers", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-03T01:00:00.000Z", currentCycle: { reportDate: "2026-04-03" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-03",
      headline: "AIBTC inbox routing update changes settlement handling after security incident",
      beat_slug: "aibtc-network",
      body: "Claim: AIBTC inbox routing update changes settlement handling after security incident.\nEvidence: Block 851200 shows settlement failures after routing change; PR #431 references the incident.\nImplication: Operators should check inbox payment paths and update relay configs to avoid settlement gaps.",
      sources: [
        { url: "https://github.com/aibtcdev/landing-page/releases/tag/v1.37.0", title: "Primary release note" }
      ],
      model_disclosure: {
        tools_used: [],
        derivation_steps: ["used AI"]
      }
    }, tempDir);

    assert.equal(result.ok, false);
    assert.match(result.checks.editorGuidance, /reject|pass|skipped_due_to_duplicate|enforced_by_create_signal_and_beat_editor/);
    assert.match(result.checks.factCheckerSourceVerification, /reject|skipped_due_to_duplicate/);
    assert.match(result.checks.helperPayloadContract, /pass|skipped_due_to_duplicate/);
    assert.ok(result.diagnostics.some((entry) => entry.layer === "fact_check" && entry.code === "fact_check_source_verification"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard blocks quantum discussion-thread-only source sets before filing", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-19T03:00:00.000Z", currentCycle: { reportDate: "2026-04-19" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-19",
      headline: "Delving `#2419` proposes 2-step commit-reveal path for Bitcoin PQ migration",
      beat_slug: "quantum",
      body: "CLAIM: A Delving Bitcoin proposal posted on April 15 introduces a two-step commit-reveal path for post-quantum Bitcoin migration.\nEVIDENCE: The post says coins would first publish a commitment, then later reveal a PQ public key and signature material.\nIMPLICATION: Wallet tooling may need commit-state support before any cutoff design hardens into a migration path.",
      sources: [
        { url: "https://delvingbitcoin.org/t/commit-reveal-for-pq-migration/2419", title: "Delving Bitcoin - Commit-Reveal for PQ Migration" }
      ],
      disclosure: "gpt-5",
      model_disclosure: { tools_used: [], derivation_steps: [] }
    }, tempDir);

    assert.equal(result.checks.factCheckerSourceVerification, "reject");
    assert.ok(
      result.blockers.some((entry) => /discussion-thread sources/i.test(entry)),
      `Expected discussion-thread-only quantum filing to fail source verification, got: ${result.blockers.join(" | ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard blocks quantum PR-page-only source sets before filing", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-19T03:00:00.000Z", currentCycle: { reportDate: "2026-04-19" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-19",
      headline: "PR #1895 merged BIP-361 on Apr 14 while BIP-360 vector fixes in PR #2102/#2103 remain open",
      beat_slug: "quantum",
      body: "CLAIM: Bitcoin’s post-quantum migration policy moved forward with BIP-361 merge, while two BIP-360 vector-correction PRs are still unresolved.\nEVIDENCE: bitcoin/bips PR #1895 shows merged on April 14; PR #2102 and PR #2103 remain open.\nIMPLICATION: Operators should not assume policy progress means implementation readiness.",
      sources: [
        { url: "https://github.com/bitcoin/bips/pull/1895", title: "bitcoin/bips PR #1895" },
        { url: "https://github.com/bitcoin/bips/pull/2102", title: "bitcoin/bips PR #2102" },
        { url: "https://github.com/bitcoin/bips/pull/2103", title: "bitcoin/bips PR #2103" }
      ],
      disclosure: "gpt-5",
      model_disclosure: { tools_used: [], derivation_steps: [] }
    }, tempDir);

    assert.equal(result.checks.factCheckerSourceVerification, "reject");
    assert.ok(
      result.blockers.some((entry) => /PR pages without a commit, release, or spec artifact/i.test(entry)),
      `Expected PR-only quantum filing to fail source verification, got: ${result.blockers.join(" | ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard blocks quantum qubit-count filings that omit logical-vs-physical distinction", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-20T03:00:00.000Z", currentCycle: { reportDate: "2026-04-20" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-20",
      headline: "ArXiv 2603.28627 says 10,000 qubits move Bitcoin ECC risk closer",
      beat_slug: "quantum",
      body: "CLAIM: ArXiv 2603.28627 says 10,000 qubits move Bitcoin ECC risk closer.\nEVIDENCE: https://arxiv.org/abs/2603.28627 describes a resource estimate for breaking elliptic-curve cryptography with a 10,000-qubit threshold.\nIMPLICATION: Bitcoin operators should monitor the paper before assuming the old million-qubit benchmark still holds.",
      sources: [
        { url: "https://arxiv.org/abs/2603.28627", title: "arXiv 2603.28627" }
      ],
      model_disclosure: { tools_used: ["gpt-5.4"], derivation_steps: ["reviewed arXiv"] }
    }, tempDir);

    assert.equal(result.checks.factCheckerSourceVerification, "reject");
    assert.ok(
      result.blockers.some((entry) => /logical from physical qubits/i.test(entry)),
      `Expected qubit distinction blocker, got: ${result.blockers.join(" | ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard blocks saturated quantum clusters without an AIBTC-native operator angle", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-20T03:00:00.000Z", currentCycle: { reportDate: "2026-04-20" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-20",
      headline: "BIP-361 sets 160k-block Bitcoin migration window for legacy ECDSA exposure",
      beat_slug: "quantum",
      body: "CLAIM: BIP-361 sets a 160k-block migration window for legacy Bitcoin ECDSA exposure.\nEVIDENCE: https://github.com/bitcoin/bips/blob/master/bip-0361.mediawiki describes the phase window and migration path for legacy signatures.\nIMPLICATION: Wallet teams should monitor migration timing and fee windows before enforcement phases begin.",
      sources: [
        { url: "https://github.com/bitcoin/bips/blob/master/bip-0361.mediawiki", title: "BIP-361 mediawiki" }
      ],
      model_disclosure: { tools_used: ["gpt-5.4"], derivation_steps: ["reviewed BIP spec"] }
    }, tempDir);

    assert.equal(result.checks.factCheckerSourceVerification, "reject");
    assert.ok(
      result.blockers.some((entry) => /AIBTC-native operator angle/i.test(entry)),
      `Expected saturated-cluster blocker, got: ${result.blockers.join(" | ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard blocks metric-heavy claims that rely on homepage-level or bare repository-root sources", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-20T03:00:00.000Z", currentCycle: { reportDate: "2026-04-20" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-20",
      headline: "SHRIMPS keeps Bitcoin PQ signatures near 2.5 KB across 2^10 devices",
      beat_slug: "quantum",
      body: "CLAIM: Jonas Nick's SHRIMPS proposal keeps Bitcoin PQ signatures near 2.5 KB across 2^10 backup devices.\nEVIDENCE: https://delvingbitcoin.org/t/shrimps-2-5-kb-post-quantum-signatures-across-multiple-stateful-devices/2355 cites ~2564-byte signatures, while https://github.com/sphincs/sphincsplus is used for the 7,856-byte SPHINCS+ comparison.\nIMPLICATION: Bitcoin wallet operators should compare backup-device PQ signature sizes before hard-coding full-size fallback assumptions.",
      sources: [
        { url: "https://delvingbitcoin.org/t/shrimps-2-5-kb-post-quantum-signatures-across-multiple-stateful-devices/2355", title: "Delving Bitcoin - SHRIMPS" },
        { url: "https://github.com/sphincs/sphincsplus", title: "sphincsplus repository root" }
      ],
      model_disclosure: { tools_used: ["gpt-5.4"], derivation_steps: ["reviewed sources"] }
    }, tempDir);

    assert.equal(result.checks.factCheckerSourceVerification, "reject");
    assert.ok(
      result.blockers.some((entry) => /homepage-level or bare repository-root sources/i.test(entry)),
      `Expected homepage-level metric source blocker, got: ${result.blockers.join(" | ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard blocks likely truncated bodies near the API size limit", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-20T03:00:00.000Z", currentCycle: { reportDate: "2026-04-20" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const filler = " Operators should monitor mining concentration alongside fee quotes";
    const body = [
      "CLAIM: The latest 24h mining distribution shows concentrated block production despite a 1 sat/vB fee floor.",
      "EVIDENCE: mempool.space endpoints show the top pools mining most recent blocks while fee quotes stay pinned at 1 sat/vB.",
      `IMPLICATION:${filler.repeat(20)}`
    ].join("\n");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-20",
      headline: "Top-4 pools control 70.6% of 160 blocks while fees hold at 1 sat/vB",
      beat_slug: "bitcoin-macro",
      body,
      sources: [
        { url: "https://mempool.space/api/v1/mining/pools/24h", title: "mempool.space 24h pools" },
        { url: "https://mempool.space/api/v1/fees/recommended", title: "mempool.space fee quotes" }
      ],
      model_disclosure: { tools_used: ["gpt-5.4"], derivation_steps: ["reviewed mempool endpoints"] }
    }, tempDir);

    assert.equal(result.checks.helperPayloadContract, "pass");
    assert.ok(
      result.blockers.some((entry) => /body is above 900 characters|body appears truncated near the submission limit/i.test(entry)),
      `Expected truncation blocker, got: ${result.blockers.join(" | ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard blocks closed PRs as proof of shipped changes", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-21T03:00:00.000Z", currentCycle: { reportDate: "2026-04-21" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-21",
      headline: "PR #755 closes relay payout fix after 42 failed sBTC settlements",
      beat_slug: "aibtc-network",
      body: "CLAIM: PR #755 closes a relay payout fix after 42 failed sBTC settlements.\nEVIDENCE: https://github.com/aibtcdev/sponsor-relay/pull/755 is closed and references the 42 settlement failures.\nIMPLICATION: Operators should not treat closed PR #755 as shipped payout protection without a merged commit or release.",
      sources: [{ url: "https://github.com/aibtcdev/sponsor-relay/pull/755", title: "closed PR #755" }],
      model_disclosure: { tools_used: ["gpt-5.4"], derivation_steps: ["reviewed GitHub PR #755"] }
    }, tempDir);

    assert.equal(result.ok, false);
    assert.ok(
      result.blockers.some((entry) => /Closed PR pages cannot be used as proof/i.test(entry)),
      `Expected closed PR blocker, got: ${result.blockers.join(" | ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard blocks stale status-only open PR updates without a fresh verification window", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-21T03:00:00.000Z", currentCycle: { reportDate: "2026-04-21" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-21",
      headline: "PR #2103 leafVersion control-byte fix remains open in BIP-360 review queue",
      beat_slug: "quantum",
      body: "CLAIM: BIP-360 control-byte handling remains unresolved in public review because PR #2103 is still open.\nEVIDENCE: PR #2103 is open with update timestamp 2026-04-14T22:00:36Z and the canonical draft remains at bip-0360.mediawiki.\nIMPLICATION: AIBTC operators should treat control-byte validation as provisional until merge.",
      sources: [
        { url: "https://github.com/bitcoin/bips/pull/2103", title: "bitcoin/bips PR #2103" },
        { url: "https://github.com/bitcoin/bips/blob/master/bip-0360.mediawiki", title: "BIP-360 draft text" }
      ],
      model_disclosure: { tools_used: ["gpt-5.4"], derivation_steps: ["reviewed GitHub PR #2103"] }
    }, tempDir);

    assert.equal(result.ok, false);
    assert.ok(
      result.blockers.some((entry) => /stale status-only PR\/issue update/i.test(entry)),
      `Expected stale status-only blocker, got: ${result.blockers.join(" | ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard blocks duplicate same-day source clusters", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/filing-ready/2026-04-21"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-21T03:00:00.000Z", currentCycle: { reportDate: "2026-04-21" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(
      resolve(tempDir, "data/filing-ready/2026-04-21/existing.json"),
      JSON.stringify({ sources: [{ url: "https://mempool.space/api/v1/fees/recommended", title: "fees" }] }),
      "utf8"
    );

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-21",
      headline: "Mempool fee floor holds at 1 sat/vB across 144 blocks",
      beat_slug: "bitcoin-macro",
      body: "CLAIM: Mempool fee floor holds at 1 sat/vB across 144 blocks.\nEVIDENCE: https://mempool.space/api/v1/fees/recommended returns 1 sat/vB while recent block samples cover 144 blocks.\nIMPLICATION: Operators should avoid overpaying automated Bitcoin settlement transactions until fee pressure changes.",
      sources: [{ url: "https://mempool.space/api/v1/fees/recommended", title: "mempool.space fee quotes" }],
      model_disclosure: { tools_used: ["gpt-5.4"], derivation_steps: ["reviewed mempool endpoint"] }
    }, tempDir);

    assert.equal(result.ok, false);
    assert.ok(
      result.blockers.some((entry) => /Duplicate same-day source cluster/i.test(entry)),
      `Expected duplicate source cluster blocker, got: ${result.blockers.join(" | ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
