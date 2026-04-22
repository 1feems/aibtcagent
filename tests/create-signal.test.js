import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createSignalArtifact } from "../dist/prep/create-signal.js";
import { validateArtifact } from "../dist/filing/validate-artifact.js";

const REPORT_DATE = "2026-04-15";

async function seedCreateSignalState(root) {
  await mkdir(resolve(root, "data/state"), { recursive: true });
  await mkdir(resolve(root, "data/briefs"), { recursive: true });
  await mkdir(resolve(root, "docs/beat-editors"), { recursive: true });
  await mkdir(resolve(root, "data/state/signal-learning-briefs"), { recursive: true });
  await mkdir(resolve(root, "data/state/outcome-boards"), { recursive: true });
  await writeFile(
    resolve(root, "data/state/signal-history.json"),
    JSON.stringify({ version: 1, updatedAt: "2026-04-15T00:00:00Z", entries: [{
      signalId: "sig-quantum-1",
      candidateId: null,
      headline: "PR #1895 context: arXiv 2603.28846v2 keeps <1200 logical qubits while NIST FIPS 204 is final",
      beat: "quantum",
      storyShape: "pr-1895-context",
      filedAt: "2026-04-17T09:27:28.493Z",
      reportDate: "2026-04-17",
      outcome: "rejected",
      resolvedAt: "2026-04-17T12:25:28Z",
      feedbackLabels: ["rejected_editorial"],
      note: "Rejected per Zen Rocket quantum editor standards: source_verification: github pul #1895 is closed (closed). Refile after addressing each failed gate.",
      satsEarned: null
    }] }),
    "utf8"
  );
  await writeFile(
    resolve(root, "data/state/brief-examples.json"),
    JSON.stringify({
      recentWinners: [{
        headline: "AIBTC /api/leaderboard shows 882 agents and 545,326 check-ins",
        beat: "aibtc-network"
      }],
      recentLosses: []
    }),
    "utf8"
  );
  await writeFile(
    resolve(root, "data/briefs/shared-context.json"),
    JSON.stringify({
      dates: {
        "2026-04-14": {
          briefTitles: [{ title: "AIBTC /api/leaderboard shows 882 agents and 545,326 check-ins" }]
        }
      }
    }),
    "utf8"
  );
  await writeFile(
    resolve(root, "data/briefs/2026-04-15.md"),
    "# Brief Artifact: 2026-04-15\n\n- AIBTC /api/leaderboard shows 882 agents and 545,326 check-ins\n",
    "utf8"
  );
  await writeFile(
    resolve(root, "data/state/helper-errors.jsonl"),
    JSON.stringify({
      recordedAt: "2026-04-15T01:00:00Z",
      stage: "signal_guard",
      helperCategory: "payload_issue",
      message: "Template issue: Headline must include an exact anchor such as a PR, issue, version, endpoint, error code, block height, or hard metric."
    }) + "\n",
    "utf8"
  );
  await writeFile(
    resolve(root, "docs/beat-editors/aibtc-network-skill.md"),
    "# AIBTC Network Beat Editor\n\nUse claim, evidence, implication and cite concrete operator consequences.\n",
    "utf8"
  );
  await writeFile(
    resolve(root, "data/state/signal-learning-briefs/2026-04-15.json"),
    JSON.stringify({
      kind: "signal_learning_brief",
      reportDate: "2026-04-15",
      generatedAt: "2026-04-15T02:00:00Z",
      sourcePaths: [],
      latestBrief: {
        path: resolve(root, "data/briefs/2026-04-15.md"),
        headlineSample: "AIBTC /api/leaderboard shows 882 agents and 545,326 check-ins"
      },
      winnerReview: {
        headlines: ["AIBTC /api/leaderboard shows 882 agents and 545,326 check-ins"],
        patterns: ["short-form"],
        tags: ["broad_package"],
        lessons: ["Recent winner shape to emulate: \"AIBTC /api/leaderboard shows 882 agents and 545,326 check-ins\""]
      },
      rejectionReview: {
        headlines: ["PR #1895 context: arXiv 2603.28846v2 keeps <1200 logical qubits while NIST FIPS 204 is final"],
        tags: ["rejected_editorial"],
        lessons: ["Recent rejection shape to avoid: \"PR #1895 context: arXiv 2603.28846v2 keeps <1200 logical qubits while NIST FIPS 204 is final\""]
      },
      approvedNotInBriefReview: {
        headlines: ["approved miss"],
        tags: ["thin_implication"],
        lessons: ["Approved-not-in-brief miss to learn from: \"approved miss\""]
      },
      helperErrorReview: {
        messages: ["Template issue: Headline must include an exact anchor such as a PR, issue, version, endpoint, error code, block height, or hard metric."],
        lessons: ["Recent helper failure to avoid repeating: Template issue: Headline must include an exact anchor such as a PR, issue, version, endpoint, error code, block height, or hard metric."]
      },
      draftingDirectives: ["Draft only stories with an exact anchor, reproducible source proof, and a direct operator consequence."]
    }),
    "utf8"
  );
  await writeFile(
    resolve(root, "data/state/outcome-boards/2026-04-15.json"),
    JSON.stringify({
      kind: "daily_outcome_board",
      reportDate: "2026-04-15",
      generatedAt: "2026-04-15T02:05:00Z",
      openBeats: ["quantum", "bitcoin-macro"],
      crowdedBeats: ["aibtc-network"],
      duplicateClusters: [{ anchor: "pr-1895-context", count: 2, source: "test" }],
      recentRejectionReasons: ["rejected_editorial"],
      latestBriefWinnerShape: "AIBTC /api/leaderboard shows 882 agents and 545,326 check-ins",
      helperFailures: ["Template issue: Headline must include an exact anchor such as a PR, issue, version, endpoint, error code, block height, or hard metric."],
      sourcePaths: ["data/state/signal-learning-briefs/2026-04-15.json", "data/state/helper-errors.jsonl"]
    }),
    "utf8"
  );
}

function makeInput(overrides = {}) {
  const body = [
    "CLAIM: /api/leaderboard shows 882 Bitcoin agents and 545,326 cumulative check-ins.",
    "EVIDENCE: https://aibtc.com/api/leaderboard returned distribution.total=882, activeAgents=206, and totalCheckIns=545326.",
    "IMPLICATION: Operators should use check-in density as a measurable Bitcoin-agent routing signal before choosing collaborators.",
    "Directive: monitor /api/leaderboard before outreach or filing decisions."
  ].join("\n");

  return {
    reportDate: REPORT_DATE,
    candidateId: "aibtc-network-leaderboard-882",
    sourcePath: "live:https://aibtc.com/api/leaderboard",
    generated_by: "create-signal-test",
    generated_from: "live AIBTC API",
    beat_slug: "aibtc-network",
    headline: "AIBTC /api/leaderboard shows 882 agents, 545,326 check-ins",
    body,
    disclosure: "gpt-5.4; curl GET https://aibtc.com/api/leaderboard; verified distribution.total, activeAgents, and totalCheckIns fields from live JSON.",
    sources: [{
      url: "https://aibtc.com/api/leaderboard",
      title: "AIBTC Leaderboard API"
    }],
    tags: ["aibtc-network", "governance"],
    brief_competition: {
      why_this_beat_is_open: "This beat slot is open because same-day leaderboard coverage is crowded and only concrete operator-routing angles clear the brief threshold.",
      why_now: "This matters now because the 2026-04-15 leaderboard snapshot is live and operators are making same-day collaboration and routing decisions.",
      why_this_beats_same_day_competition: "This beats same-day competition by pairing the exact 882/545,326 anchor with an explicit operator action instead of a thin summary fragment.",
      primary_source_proof: "https://aibtc.com/api/leaderboard returned distribution.total=882 and totalCheckIns=545326, which is the primary reproducible source anchor.",
      operator_action: "Operators should verify the live leaderboard snapshot before selecting routing or collaboration targets."
    },
    ...overrides
  };
}

test("createSignalArtifact emits the canonical filing artifact contract", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    const artifact = await createSignalArtifact(makeInput(), tempDir);
    assert.equal(artifact.kind, "create_signal_artifact");
    assert.equal(artifact.status, "in_queue");
    assert.equal(artifact.body, artifact.analysis);
    assert.equal(artifact.filing_gate.headline, artifact.headline);
    assert.equal(artifact.filing_gate.beat, artifact.beat_slug);
    assert.equal(artifact.filing_gate.q1.result, "pass");
    assert.equal(artifact.filing_gate.q2.result, "pass");
    assert.equal(artifact.filing_gate.q3.result, "pass");
    assert.equal(artifact.filing_gate.q4.result, "pass");
    assert.equal(artifact.filing_gate.contextAudit.briefReview.result, "pass");
    assert.equal(artifact.filing_gate.contextAudit.beatEditorReview.result, "pass");
    assert.equal(artifact.filing_gate.contextAudit.helperErrorsReview.result, "pass");
    assert.equal(artifact.filing_gate.contextAudit.outcomeReview.result, "pass");
    assert.equal(validateArtifact(artifact).ok, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact rejects anchorless headlines before artifact creation", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        headline: "Relay recovery improves for sBTC agent settlements"
      }), tempDir),
      /headline must include an exact anchor/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact rejects every beat outside the accepted three", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        beat_slug: "infrastructure",
        tags: ["infrastructure"]
      }), tempDir),
      /Accepted beats: quantum, aibtc-network, bitcoin-macro/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact rejects documentation signals before anchor/gate checks", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    // Headline describes how the API works — not a live event.
    // This is the exact failure mode: API path passes hasExactHeadlineAnchor
    // but the signal is documentation, not news.
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        headline: "AIBTC POST /api/signals uses BIP-137 signature for authentication",
      body: [
        "CLAIM: POST /api/signals uses BIP-137 signed payloads for all requests.",
        "EVIDENCE: https://docs.aibtc.com/api/signals confirms BIP-137 signature is required in the request header.",
        "IMPLICATION: Agents should sign all POST /api/signals requests with BIP-137 before filing.",
        "Directive: sign all POST /api/signals requests with BIP-137."
      ].join("\n")
      }), tempDir),
      /Verdict: hold \/ not filing_ready/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact allows documentation-pattern headline anchored to a live event", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    // Same pattern ("must include") but anchored to a real shipped change (PR #189).
    // Fresh-event marker in headline unblocks the documentation check.
    const artifact = await createSignalArtifact(makeInput({
      headline: "POST /api/signals v2.1 must include BIP-137 header after PR #189 merge",
      body: [
        "CLAIM: PR #189 shipped BIP-137 security enforcement on the Stacks-based POST /api/signals endpoint in v2.1.",
        "EVIDENCE: https://github.com/aibtcdev/api/pull/189 shows the merged auth middleware; release notes confirm v2.1 deployment on Stacks mainnet.",
        "IMPLICATION: Agents should update BIP-137 signing logic before block 943,333 or infrastructure security checks will block settlements with HTTP 401 rejections.",
        "Directive: update signing logic before block 943,333 to avoid HTTP 401 blocked settlements."
      ].join("\n"),
      sources: [{ url: "https://github.com/aibtcdev/api/pull/189", title: "PR #189 BIP-137 auth enforcement" }],
      disclosure: "claude-sonnet-4-6; GitHub review of PR #189; release notes cross-check"
    }), tempDir);
    assert.equal(artifact.kind, "create_signal_artifact");
    assert.equal(artifact.status, "in_queue");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact rejects incomplete bodies before artifact validation", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        body: "/api/leaderboard shows 882 Bitcoin agents and 545,326 check-ins."
      }), tempDir),
      /body must include non-empty CLAIM, EVIDENCE, and IMPLICATION lines/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact rejects evidence that does not cite an exact source URL", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        body: [
          "CLAIM: /api/leaderboard shows 882 Bitcoin agents and 545,326 cumulative check-ins.",
          "EVIDENCE: The AIBTC leaderboard API returned distribution.total=882, activeAgents=206, and totalCheckIns=545326.",
          "IMPLICATION: Operators should use check-in density as a measurable Bitcoin-agent routing signal before choosing collaborators.",
          "Directive: monitor /api/leaderboard before outreach or filing decisions."
        ].join("\n")
      }), tempDir),
      /EVIDENCE must include at least one exact source URL/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact rejects bodies above the safe truncation threshold before filing", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    const overlongEvidence = "EVIDENCE: https://aibtc.com/api/leaderboard returned distribution.total=882, activeAgents=206, and totalCheckIns=545326; this extra note keeps the body under the hard 1000-character max but pushes it into the soft truncation zone where submitted signals can still lose their tail. The same snapshot reminds operators that helper-safe copy is not enough if the stored body gets clipped after the API accepts the post.";
    const overlongImplication = "IMPLICATION: Operators should treat near-limit body length as a packaging risk because a clipped stored body can erase the final action sentence after submit, weaken the operator consequence, and leave a valid signal looking incomplete in the live queue.";
    const overlongDirective = "Directive: monitor /api/leaderboard before outreach or filing decisions, shorten this directive first when trimming is needed, and prefer a shorter stored body over a longer helper-safe one whenever the copy approaches the live clipping range.";
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        body: [
          "CLAIM: /api/leaderboard shows 882 Bitcoin agents and 545,326 cumulative check-ins.",
          overlongEvidence,
          overlongImplication,
          overlongDirective
        ].join("\n")
      }), tempDir),
      /keep filing bodies at or below 900 characters to avoid live API truncation, and shorten the Directive line first/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact rejects bodies near the 1000-character cap before filing", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    const baseBody = [
      "CLAIM: /api/leaderboard shows 882 Bitcoin agents and 545,326 cumulative check-ins.",
      "EVIDENCE: https://aibtc.com/api/leaderboard returned distribution.total=882 and totalCheckIns=545326.",
      "IMPLICATION: Operators should verify the same-day snapshot before routing decisions.",
      "Directive: trim this line first when body length approaches storage limits."
    ].join("\n");
    const targetLength = 960;
    const filler = "x".repeat(Math.max(0, targetLength - baseBody.length));
    const almostCapBody = `${baseBody}${filler}`;
    assert.ok(almostCapBody.length > 900 && almostCapBody.length < 1000);

    await assert.rejects(
      () => createSignalArtifact(makeInput({ body: almostCapBody }), tempDir),
      /keep filing bodies at or below 900 characters/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact rejects template sections without terminal punctuation", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        body: [
          "CLAIM: /api/leaderboard shows 882 Bitcoin agents and 545,326 cumulative check-ins",
          "EVIDENCE: https://aibtc.com/api/leaderboard returned distribution.total=882, activeAgents=206, and totalCheckIns=545326",
          "IMPLICATION: Operators should use check-in density as a measurable Bitcoin-agent routing signal before choosing collaborators",
          "Directive: monitor /api/leaderboard before outreach or filing decisions."
        ].join("\n")
      }), tempDir),
      /CLAIM must end with terminal punctuation|EVIDENCE must end with terminal punctuation|IMPLICATION must end with terminal punctuation/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact blocks missing brief competition proof fields", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        brief_competition: {
          why_this_beat_is_open: "",
          why_now: "",
          why_this_beats_same_day_competition: "",
          primary_source_proof: "",
          operator_action: ""
        }
      }), tempDir),
      /brief_competition\.(why_this_beat_is_open|why_now|why_this_beats_same_day_competition|primary_source_proof|operator_action) is required/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact blocks weak brief competition proof answers", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        brief_competition: {
          why_this_beat_is_open: "Open beat.",
          why_now: "Now.",
          why_this_beats_same_day_competition: "Better.",
          primary_source_proof: "See source.",
          operator_action: "Do stuff."
        }
      }), tempDir),
      /brief competition proof|too short|must include/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact enforces promoted editorial memory pre-filing checks", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({
        currentCycle: { reportDate: "2026-04-14" },
        preFilingChecks: [{
          id: "cycle-date-freshness-before-helper",
          rule: "Before running helper, check editorial-memory.json currentCycle.reportDate matches today's date."
        }]
      }),
      "utf8"
    );

    await assert.rejects(
      () => createSignalArtifact(makeInput(), tempDir),
      /currentCycle\.reportDate is 2026-04-14, behind 2026-04-15/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact refuses to draft without the distilled learning brief", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await rm(resolve(tempDir, "data/state/signal-learning-briefs/2026-04-15.json"), { force: true });

    await assert.rejects(
      () => createSignalArtifact(makeInput(), tempDir),
      /distilled learning artifact missing/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact refuses to draft without today's outcome board", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await rm(resolve(tempDir, "data/state/outcome-boards/2026-04-15.json"), { force: true });

    await assert.rejects(
      () => createSignalArtifact(makeInput(), tempDir),
      /outcome board is mandatory before drafting/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact rejects missing source title objects through artifact validation", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        sources: [{ url: "https://aibtc.com/api/leaderboard", title: "" }]
      }), tempDir),
      /every source must include non-empty title and http\/https url/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact applies the quantum publisher guide before artifact creation", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        beat_slug: "quantum",
        headline: "PR #1895 keeps BIP-360 vector audit open after 2 failing cases",
        body: [
          "CLAIM: PR #1895 still leaves two BIP-360 vector failures unresolved for Bitcoin.",
          "EVIDENCE: https://github.com/bitcoin/bips/pull/1895 documents the two failing vector cases.",
          "IMPLICATION: Quantum operators should monitor PR #1895 before treating the vectors as settlement-safe.",
          "Directive: verify PR #1895 before relying on BIP-360 vector readiness."
        ].join("\n"),
        sources: [{ url: "https://github.com/bitcoin/bips/pull/1895", title: "PR #1895 BIP-360 vectors" }],
        tags: ["quantum"]
      }), tempDir),
      /quantum beat editor guidance requires explicit signal_type/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact blocks quantum discussion-thread-only source sets before helper-ready packaging", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        beat_slug: "quantum",
        tags: ["quantum", "wallets"],
        signal_type: "quantum_signal",
        headline: "Issue #2419 proposes commit-reveal path for Bitcoin PQ migration",
        body: [
          "CLAIM: Issue #2419 proposes a commit-reveal path for post-quantum Bitcoin migration.",
          "EVIDENCE: In https://delvingbitcoin.org/t/commit-reveal-for-pq-migration/2419, the proposal says coins would first publish a commitment and later reveal PQ key material.",
          "IMPLICATION: Bitcoin wallet operators should monitor commit-reveal migration design before any cutoff path hardens into a BIP.",
          "Directive: verify whether wallet tooling can track prior migration commitments per UTXO."
        ].join("\n"),
        sources: [{
          url: "https://delvingbitcoin.org/t/commit-reveal-for-pq-migration/2419",
          title: "Delving Bitcoin - Commit-Reveal for PQ Migration"
        }],
        disclosure: "gpt-5; reviewed beat guidance and helper errors before drafting."
      }), tempDir),
      /quantum harness blocks proposal-thread-only source sets before filing/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact blocks saturated quantum clusters unless the angle is AIBTC-native", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        beat_slug: "quantum",
        tags: ["quantum", "bitcoin"],
        signal_type: "quantum_signal",
        headline: "Issue #361 sets 160k-block Bitcoin migration window for legacy ECDSA exposure",
        body: [
          "CLAIM: BIP-361 sets a 160k-block migration window for legacy Bitcoin ECDSA exposure.",
          "EVIDENCE: https://github.com/bitcoin/bips/blob/master/bip-0361.mediawiki describes the phase window and migration path for legacy signatures.",
          "IMPLICATION: Bitcoin operators should monitor migration timing and fee windows before enforcement phases begin.",
          "Directive: review BIP-361 timelines before planning wallet migration work."
        ].join("\n"),
        sources: [{
          url: "https://github.com/bitcoin/bips/blob/master/bip-0361.mediawiki",
          title: "BIP-361 mediawiki"
        }],
        disclosure: "gpt-5; GitHub spec review and repo loop checks."
      }), tempDir),
      /quantum harness blocks saturated clusters/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact blocks metric-heavy claims that rely on homepage-level or bare repository-root sources", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        beat_slug: "quantum",
        tags: ["quantum", "bitcoin"],
        signal_type: "quantum_signal",
        headline: "Issue #2355 keeps Bitcoin PQ signatures near 2.5 KB across 2^10 devices",
        body: [
          "CLAIM: Issue #2355 keeps Bitcoin PQ signatures near 2.5 KB across 2^10 devices.",
          "EVIDENCE: https://delvingbitcoin.org/t/shrimps-2-5-kb-post-quantum-signatures-across-multiple-stateful-devices/2355 cites ~2564-byte signatures, while https://github.com/sphincs/sphincsplus is used for the 7,856-byte SPHINCS+ comparison.",
          "IMPLICATION: Bitcoin wallet operators should compare recovery-device quantum signature sizes before hard-coding full-size fallback assumptions.",
          "Directive: verify every cited quantum signature figure against an exact artifact page."
        ].join("\n"),
        sources: [
          { url: "https://delvingbitcoin.org/t/shrimps-2-5-kb-post-quantum-signatures-across-multiple-stateful-devices/2355", title: "Delving Bitcoin - SHRIMPS" },
          { url: "https://github.com/sphincs/sphincsplus", title: "sphincsplus repository root" }
        ],
        disclosure: "gpt-5.4; reviewed Delving Bitcoin and the sphincsplus repository root."
      }), tempDir),
      /metric-driven claims cannot rely on homepage-level or bare repository-root sources/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact blocks closed PRs as proof of shipped changes", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        headline: "PR #755 closes relay payout fix after 42 failed sBTC settlements",
        body: [
          "CLAIM: PR #755 closes a relay payout fix after 42 failed sBTC settlements.",
          "EVIDENCE: https://github.com/aibtcdev/sponsor-relay/pull/755 is closed and references the 42 settlement failures.",
          "IMPLICATION: Operators should not treat closed PR #755 as shipped payout protection without a merged commit or release.",
          "Directive: wait for a release or commit before filing the relay payout fix."
        ].join("\n"),
        sources: [{ url: "https://github.com/aibtcdev/sponsor-relay/pull/755", title: "closed PR #755" }],
        disclosure: "gpt-5.4; reviewed closed GitHub PR #755."
      }), tempDir),
      /closed PR pages cannot be used as proof/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact blocks duplicate same-day source clusters", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await mkdir(resolve(tempDir, "data/filing-ready/2026-04-15"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/filing-ready/2026-04-15/existing.json"),
      JSON.stringify({
        sources: [{ url: "https://aibtc.com/api/leaderboard", title: "AIBTC Leaderboard API" }]
      }),
      "utf8"
    );

    await assert.rejects(
      () => createSignalArtifact(makeInput(), tempDir),
      /duplicate same-day source cluster already exists/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createSignalArtifact blocks quantum filings with weak explicit quantum-keyword density", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-create-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    await assert.rejects(
      () => createSignalArtifact(makeInput({
        beat_slug: "quantum",
        tags: ["quantum", "bitcoin"],
        signal_type: "quantum_signal",
        headline: "`bip-p2q.md` Splits AIBTC Wallet Path After 36+ bitcoindev Messages",
        body: [
          "CLAIM: https://github.com/casey/bips/blob/280fb529b27949b42721bfbf5f255e67b9a1103b/bip-p2q.md shows Bitcoin's path splitting between two migration tracks.",
          "EVIDENCE: https://gnusha.org/pi/bitcoindev/c7df3994-948b-4b3b-a8fa-c91e780cadfd@mattcorallo.com/T/#t shows 36+ messages by Apr. 19; https://github.com/casey/bips/blob/280fb529b27949b42721bfbf5f255e67b9a1103b/bip-p2q.md defines one path; https://gnusha.org/pi/bitcoindev/c7df3994-948b-4b3b-a8fa-c91e780cadfd@mattcorallo.com/ records Matt Corallo's Apr. 19 note backing a separate output type plus flagged-P2TR.",
          "IMPLICATION: AIBTC wallet and custody agents should track both paths separately, because Bitcoin address handling and recovery logic may not converge on one standard.",
          "Directive: monitor both paths separately."
        ].join("\n"),
        sources: [
          { url: "https://gnusha.org/pi/bitcoindev/c7df3994-948b-4b3b-a8fa-c91e780cadfd@mattcorallo.com/T/#t", title: "bitcoindev thread: In defense of a PQ output type" },
          { url: "https://gnusha.org/pi/bitcoindev/c7df3994-948b-4b3b-a8fa-c91e780cadfd@mattcorallo.com/", title: "Matt Corallo Apr. 19 reply on PQ-only output type plus flagged-P2TR" },
          { url: "https://github.com/casey/bips/blob/280fb529b27949b42721bfbf5f255e67b9a1103b/bip-p2q.md", title: "P2Q SegWit v3 proposal text" }
        ],
        disclosure: "gpt-5.4; reviewed gnusha and the linked bip-p2q.md proposal."
      }), tempDir),
      /requires at least 3 explicit quantum keywords/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
