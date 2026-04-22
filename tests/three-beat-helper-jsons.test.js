import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createChatSignalPackage } from "../dist/filing/chat-signal.js";
import { buildNormalizedSignalPayload } from "../dist/filing/helper-server.js";

const REPORT_DATE = "2026-04-15";
const BTC_ADDRESS = "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv";

async function seedState(root) {
  await mkdir(resolve(root, "data/state"), { recursive: true });
  await mkdir(resolve(root, "data/briefs"), { recursive: true });
  await mkdir(resolve(root, "logs"), { recursive: true });
  await mkdir(resolve(root, "docs/beat-editors"), { recursive: true });
  await mkdir(resolve(root, "data/state/signal-learning-briefs"), { recursive: true });
  await mkdir(resolve(root, "data/state/outcome-boards"), { recursive: true });
  await writeFile(
    resolve(root, "data/state/signal-history.json"),
    JSON.stringify({ version: 1, updatedAt: "2026-04-15T00:00:00Z", entries: [] }),
    "utf8"
  );
  await writeFile(
    resolve(root, "data/state/editorial-memory.json"),
    JSON.stringify({
      currentCycle: { reportDate: REPORT_DATE },
      preFilingChecks: [
        { id: "evidence-anchor-required", rule: "Metric claims need explicit evidence anchors." },
        { id: "body-required", rule: "Body is required." },
        { id: "anchor-in-headline-required", rule: "Exact anchor must be in headline." },
        { id: "sources-must-be-url-title-objects", rule: "Sources must be objects." }
      ]
    }),
    "utf8"
  );
  await writeFile(
    resolve(root, "data/state/brief-examples.json"),
    JSON.stringify({
      recentWinners: [
        { headline: "AIBTC /api/leaderboard shows 882 agents and 545,326 check-ins", beat: "aibtc-network" },
        { headline: "Bitcoin fees hold at 2 sat/vB while 882 agents choose settlement timing", beat: "bitcoin-macro" },
        { headline: "PR #1895 keeps BIP-360 vector audit open after 2 failing cases", beat: "quantum" }
      ],
      recentLosses: []
    }),
    "utf8"
  );
  await writeFile(
    resolve(root, "data/briefs/shared-context.json"),
    JSON.stringify({
      dates: {
        "2026-04-14": {
          briefTitles: [
            { title: "AIBTC /api/leaderboard shows 882 agents and 545,326 check-ins" }
          ]
        }
      }
    }),
    "utf8"
  );
  await writeFile(resolve(root, "data/briefs/2026-04-15.md"), "- sample brief\n", "utf8");
  await writeFile(resolve(root, "data/state/editorial-memory.json"), JSON.stringify({ ok: true }), "utf8");
  await writeFile(resolve(root, "data/state/outcome-feedback-memory.json"), JSON.stringify({ ok: true }), "utf8");
  await writeFile(resolve(root, "data/state/helper-errors.jsonl"), `${JSON.stringify({ message: "reviewed helper errors" })}\n`, "utf8");
  await writeFile(resolve(root, "docs/beat-editors/aibtc-network-skill.md"), "# guidance\n", "utf8");
  await writeFile(resolve(root, "docs/beat-editors/bitcoin-macro-ivory-coda.md"), "# guidance\n", "utf8");
  await writeFile(resolve(root, "docs/beat-editors/quantum-zen-rocket.md"), "# guidance\n", "utf8");
  await writeFile(
    resolve(root, "data/state/signal-learning-briefs/2026-04-15.json"),
    JSON.stringify({
      kind: "signal_learning_brief",
      reportDate: "2026-04-15",
      generatedAt: "2026-04-15T05:00:00Z",
      sourcePaths: [],
      latestBrief: { path: resolve(root, "data/briefs/2026-04-15.md"), headlineSample: "sample brief" },
      winnerReview: { headlines: ["winner"], patterns: ["short-form"], tags: ["broad_package"], lessons: ["winner lesson"] },
      rejectionReview: { headlines: ["loss"], tags: ["stat_dump"], lessons: ["loss lesson"] },
      approvedNotInBriefReview: { headlines: ["approved miss"], tags: ["thin_implication"], lessons: ["approved miss lesson"] },
      helperErrorReview: { messages: ["helper issue"], lessons: ["helper lesson"] },
      draftingDirectives: ["Draft only stories with an exact anchor, reproducible source proof, and a direct operator consequence."]
    }),
    "utf8"
  );
  await writeFile(
    resolve(root, "data/state/outcome-boards/2026-04-15.json"),
    JSON.stringify({
      kind: "daily_outcome_board",
      reportDate: "2026-04-15",
      generatedAt: "2026-04-15T05:00:00Z",
      openBeats: ["aibtc-network", "bitcoin-macro", "quantum"],
      crowdedBeats: [],
      duplicateClusters: [],
      recentRejectionReasons: [],
      latestBriefWinnerShape: "AIBTC /api/leaderboard shows 882 agents and 545,326 check-ins",
      helperFailures: [],
      sourcePaths: []
    }),
    "utf8"
  );
  await writeFile(
    resolve(root, "logs/signal-loop-analysis-2026-04-15.json"),
    JSON.stringify({
      reportDate: "2026-04-15",
      generatedAt: "2026-04-15T05:00:00Z",
      reviewedInputs: {
        signalHistory: { path: resolve(root, "data/state/signal-history.json"), available: true, detail: "reviewed signal history", reviewMode: "loaded_only" },
        editorialMemory: { path: resolve(root, "data/state/editorial-memory.json"), available: true, detail: "reviewed editorial memory", reviewMode: "loaded_only" },
        outcomeFeedbackMemory: { path: resolve(root, "data/state/outcome-feedback-memory.json"), available: true, detail: "reviewed outcome feedback", reviewMode: "loaded_only" },
        helperErrors: { path: resolve(root, "data/state/helper-errors.jsonl"), available: true, detail: "reviewed helper errors", reviewMode: "loaded_only" },
        latestBrief: { path: resolve(root, "data/briefs/2026-04-15.md"), available: true, detail: "reviewed latest brief", reviewMode: "loaded_only" },
        distilledLearningBrief: { path: resolve(root, "data/state/signal-learning-briefs/2026-04-15.json"), available: true, detail: "reviewed learning brief", reviewMode: "loaded_only" },
        beatEditorGuidance: [{ path: resolve(root, "docs/beat-editors/aibtc-network-skill.md"), available: true, detail: "reviewed beat guidance", reviewMode: "loaded_only" }]
      }
    }),
    "utf8"
  );
}

function makeInputs() {
  return [
    {
      reportDate: REPORT_DATE,
      candidateId: "aibtc-network-leaderboard-882",
      sourcePath: "generated:three-beat-helper-jsons",
      generated_by: "three-beat-helper-jsons-test",
      generated_from: "fixture",
      beat_slug: "aibtc-network",
      headline: "AIBTC /api/leaderboard shows 882 agents, 545,326 check-ins",
      body: [
        "CLAIM: /api/leaderboard shows 882 Bitcoin agents and 545,326 cumulative check-ins.",
        "EVIDENCE: https://aibtc.com/api/leaderboard returned distribution.total=882, activeAgents=206, and totalCheckIns=545326.",
        "IMPLICATION: Operators should use check-in density as a measurable Bitcoin-agent routing signal before choosing collaborators.",
        "Directive: monitor /api/leaderboard before outreach or filing decisions."
      ].join("\n"),
      disclosure: "gpt-5.4; curl GET https://aibtc.com/api/leaderboard; verified distribution.total, activeAgents, and totalCheckIns fields from live-style JSON.",
      sources: [{ url: "https://aibtc.com/api/leaderboard", title: "AIBTC Leaderboard API" }],
      tags: ["aibtc-network", "infrastructure"],
      brief_competition: {
        why_this_beat_is_open: "This beat slot is open because same-day network stories need hard anchors and clear operator consequence to win brief selection.",
        why_now: "This matters now because the 2026-04-15 leaderboard snapshot is live and informs same-day routing and partnership decisions.",
        why_this_beats_same_day_competition: "This beats same-day competition by leading with exact 882/545,326 proof and an explicit operator action line.",
        primary_source_proof: "https://aibtc.com/api/leaderboard returned distribution.total=882 and totalCheckIns=545326 as the exact primary source proof.",
        operator_action: "Operators should verify the live leaderboard snapshot before outreach or filing decisions."
      }
    },
    {
      reportDate: REPORT_DATE,
      candidateId: "bitcoin-macro-fees-2satvb",
      sourcePath: "generated:three-beat-helper-jsons",
      generated_by: "three-beat-helper-jsons-test",
      generated_from: "fixture",
      beat_slug: "bitcoin-macro",
      headline: "Bitcoin fees hold at 2 sat/vB while 882 agents choose settlement timing",
      body: [
        "CLAIM: Bitcoin fastest fees held at 2 sat/vB while the AIBTC network had 882 agents making settlement timing decisions.",
        "EVIDENCE: https://mempool.space/api/v1/fees/recommended returned fastestFee=2 and https://aibtc.com/api/leaderboard returned distribution.total=882.",
        "IMPLICATION: Operators should monitor fee pressure and batch low-urgency Bitcoin and sBTC-related settlement work while fees stay low.",
        "Directive: monitor mempool.space fees before scheduling non-urgent settlement flows."
      ].join("\n"),
      disclosure: "gpt-5.4; curl GET https://mempool.space/api/v1/fees/recommended and https://aibtc.com/api/leaderboard; verified fastestFee and distribution.total fields.",
      sources: [
        { url: "https://mempool.space/api/v1/fees/recommended", title: "mempool.space recommended fees" },
        { url: "https://aibtc.com/api/leaderboard", title: "AIBTC leaderboard agent count" }
      ],
      tags: ["bitcoin-macro", "fee-market"],
      brief_competition: {
        why_this_beat_is_open: "This beat slot is open because fee-window stories only convert when they include exact timing and execution consequences for operators.",
        why_now: "This matters now because fee conditions are live in the current cycle and influence immediate settlement scheduling.",
        why_this_beats_same_day_competition: "This beats same-day competition by combining 2 sat/vB fee pressure with the 882-agent anchor in one broader operator package.",
        primary_source_proof: "https://mempool.space/api/v1/fees/recommended returned fastestFee=2 and https://aibtc.com/api/leaderboard returned distribution.total=882.",
        operator_action: "Operators should monitor fee pressure and batch non-urgent settlement tasks while the low-fee window remains open."
      }
    },
    {
      reportDate: REPORT_DATE,
      candidateId: "quantum-pr-1895",
      sourcePath: "generated:three-beat-helper-jsons",
      generated_by: "three-beat-helper-jsons-test",
      generated_from: "fixture",
      beat_slug: "quantum",
      signal_type: "quantum_signal",
      headline: "PR #1895 keeps BIP-360 audit open after 2 failing Bitcoin ECDSA vectors",
      body: [
        "CLAIM: PR #1895 still leaves two BIP-360 vector failures unresolved for Bitcoin ECDSA migration.",
        "EVIDENCE: https://github.com/bitcoin/bips/pull/1895 documents the two failing vector cases and https://github.com/bitcoin/bips/blob/master/bip-0360.mediawiki tracks the state artifact.",
        "IMPLICATION: AIBTC quantum operators should monitor PR #1895 because Bitcoin quantum-readiness remains unsettled until those vectors close.",
        "Directive: verify PR #1895 before relying on BIP-360 vector readiness."
      ].join("\n"),
      disclosure: "gpt-5.4; GitHub review of https://github.com/bitcoin/bips/pull/1895 and https://github.com/bitcoin/bips/blob/master/bip-0360.mediawiki; AIBTC agent quantum monitor context",
      sources: [
        { url: "https://github.com/bitcoin/bips/pull/1895", title: "PR #1895 BIP-360 vectors" },
        { url: "https://github.com/bitcoin/bips/blob/master/bip-0360.mediawiki", title: "BIP-360 state artifact" }
      ],
      tags: ["quantum"],
      brief_competition: {
        why_this_beat_is_open: "This beat slot is open because quantum stories only win when the anchor is concrete and directly changes operator risk handling.",
        why_now: "This matters now because PR #1895 is active in the current cycle and operators need same-day visibility on unresolved vector risk.",
        why_this_beats_same_day_competition: "This beats same-day competition by anchoring to PR #1895 and two unresolved failures with an explicit operator consequence.",
        primary_source_proof: "https://github.com/bitcoin/bips/pull/1895 documents the two unresolved BIP-360 vector failures as the primary source proof.",
        operator_action: "Operators should verify PR #1895 status before treating BIP-360 vectors as settlement-safe."
      }
    }
  ];
}

test("three target beats produce helper-ready signal JSONs accepted by helper normalization", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-three-beat-helper-jsons-"));
  try {
    await seedState(tempDir);
    const results = [];

    for (const input of makeInputs()) {
      const result = await createChatSignalPackage(input, tempDir);
      const helperJson = result.helperReady.json;
      const normalized = buildNormalizedSignalPayload(helperJson, BTC_ADDRESS, tempDir);

      assert.equal(
        normalized.ok,
        true,
        `${input.beat_slug} helper normalization should pass: ${JSON.stringify(normalized.issues ?? [])}`
      );
      assert.equal(normalized.upstreamPayload.beat_slug, input.beat_slug);
      assert.equal(normalized.upstreamPayload.body, helperJson.body);
      assert.equal(normalized.upstreamPayload.analysis, helperJson.body);
      assert.ok(normalized.upstreamPayload.sources.every((source) => source.url && source.title));

      results.push({ beat: input.beat_slug, helperJson });
    }

    assert.deepEqual(results.map((entry) => entry.beat).sort(), ["aibtc-network", "bitcoin-macro", "quantum"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
