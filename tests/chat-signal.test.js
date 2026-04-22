import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createChatSignalPackage } from "../dist/filing/chat-signal.js";

async function seedCreateSignalState(root) {
  await mkdir(resolve(root, "data/state"), { recursive: true });
  await mkdir(resolve(root, "data/briefs"), { recursive: true });
  await mkdir(resolve(root, "logs"), { recursive: true });
  await mkdir(resolve(root, "data/state/outcome-boards"), { recursive: true });
  await writeFile(
    resolve(root, "data/state/signal-history.json"),
    JSON.stringify({ version: 1, updatedAt: "2026-04-15T00:00:00Z", entries: [] }),
    "utf8"
  );
  await writeFile(
    resolve(root, "data/state/brief-examples.json"),
    JSON.stringify({
      recentWinners: [{
        headline: "PR #98 restores relay routing for sBTC agent payouts",
        beat: "infrastructure"
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
          briefTitles: [{ title: "PR #98 restores relay routing for sBTC agent payouts" }]
        }
      }
    }),
    "utf8"
  );
  await writeFile(
    resolve(root, "logs/signal-loop-analysis-2026-04-15.json"),
    JSON.stringify({
      reportDate: "2026-04-15",
      generatedAt: "2026-04-15T05:00:00Z",
      reviewedInputs: {
        signalHistory: {
          path: resolve(root, "data/state/signal-history.json"),
          available: true,
          detail: "reviewed signal history",
          reviewMode: "loaded_only"
        },
        editorialMemory: {
          path: resolve(root, "data/state/editorial-memory.json"),
          available: true,
          detail: "reviewed editorial memory",
          reviewMode: "loaded_only"
        },
        outcomeFeedbackMemory: {
          path: resolve(root, "data/state/outcome-feedback-memory.json"),
          available: true,
          detail: "reviewed outcome feedback memory",
          reviewMode: "loaded_only"
        },
        helperErrors: {
          path: resolve(root, "data/state/helper-errors.jsonl"),
          available: true,
          detail: "reviewed helper errors",
          reviewMode: "loaded_only"
        },
        latestBrief: {
          path: resolve(root, "data/briefs/2026-04-14.md"),
          available: true,
          detail: "reviewed latest brief",
          reviewMode: "loaded_only"
        },
        distilledLearningBrief: {
          path: resolve(root, "data/state/signal-learning-briefs/2026-04-15.json"),
          available: true,
          detail: "reviewed distilled learning brief",
          reviewMode: "loaded_only"
        },
        beatEditorGuidance: [{
          path: resolve(root, "docs/beat-editors/aibtc-network-skill.md"),
          available: true,
          detail: "reviewed aibtc-network beat guidance",
          reviewMode: "loaded_only"
        }]
      }
    }),
    "utf8"
  );
  await mkdir(resolve(root, "docs/beat-editors"), { recursive: true });
  await mkdir(resolve(root, "data/state/signal-learning-briefs"), { recursive: true });
  await writeFile(resolve(root, "docs/beat-editors/aibtc-network-skill.md"), "# guidance\n", "utf8");
  await writeFile(resolve(root, "data/state/editorial-memory.json"), JSON.stringify({ ok: true }), "utf8");
  await writeFile(resolve(root, "data/state/outcome-feedback-memory.json"), JSON.stringify({ ok: true }), "utf8");
  await writeFile(resolve(root, "data/state/helper-errors.jsonl"), `${JSON.stringify({ message: "reviewed helper errors" })}\n`, "utf8");
  await writeFile(resolve(root, "data/briefs/2026-04-14.md"), "- prior brief\n", "utf8");
  await writeFile(
    resolve(root, "data/state/signal-learning-briefs/2026-04-15.json"),
    JSON.stringify({
      kind: "signal_learning_brief",
      reportDate: "2026-04-15",
      generatedAt: "2026-04-15T05:00:00Z",
      sourcePaths: [],
      latestBrief: { path: resolve(root, "data/briefs/2026-04-14.md"), headlineSample: "prior brief" },
      winnerReview: { headlines: ["winner"], patterns: ["short-form"], tags: ["broad_package"], lessons: ["Recent winner shape to emulate: \"winner\""] },
      rejectionReview: { headlines: ["loss"], tags: ["stat_dump"], lessons: ["Recent rejection shape to avoid: \"loss\""] },
      approvedNotInBriefReview: { headlines: ["approved miss"], tags: ["thin_implication"], lessons: ["Approved-not-in-brief miss to learn from: \"approved miss\""] },
      helperErrorReview: { messages: ["reviewed helper errors"], lessons: ["Recent helper failure to avoid repeating: reviewed helper errors"] },
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
      openBeats: ["aibtc-network", "quantum", "bitcoin-macro"],
      crowdedBeats: [],
      duplicateClusters: [],
      recentRejectionReasons: [],
      latestBriefWinnerShape: "PR #98 restores relay routing for sBTC agent payouts",
      helperFailures: [],
      sourcePaths: []
    }),
    "utf8"
  );
}

function makeInput() {
  const body = [
    "CLAIM: /api/leaderboard shows 882 Bitcoin agents and 545,326 cumulative check-ins.",
    "EVIDENCE: https://aibtc.com/api/leaderboard returned distribution.total=882, activeAgents=206, and totalCheckIns=545326.",
    "IMPLICATION: Operators should use check-in density as a measurable identity and routing signal before choosing collaborators.",
    "Directive: monitor /api/leaderboard before outreach or filing decisions."
  ].join("\n");

  return {
    reportDate: "2026-04-15",
    candidateId: "aibtc-network-leaderboard-882",
    sourcePath: "live:https://aibtc.com/api/leaderboard",
    generated_by: "chat-signal-test",
    generated_from: "live AIBTC API",
    beat_slug: "aibtc-network",
    headline: "AIBTC /api/leaderboard shows 882 agents, 545,326 check-ins",
    body,
    disclosure: "gpt-5.4, curl GET https://aibtc.com/api/leaderboard, verified distribution.total, activeAgents, and totalCheckIns fields from live JSON.",
    sources: [{
      url: "https://aibtc.com/api/leaderboard",
      title: "AIBTC Leaderboard API proves distribution.total=882, activeAgents=206, and totalCheckIns=545326"
    }],
    tags: ["aibtc-network", "infrastructure"],
    brief_competition: {
      why_this_beat_is_open: "This beat slot is open because same-day leaderboard stories are crowded and only operator-directed angles with hard anchors survive brief selection.",
      why_now: "This matters now because the latest leaderboard snapshot is live in the current cycle and drives same-day operator collaboration choices.",
      why_this_beats_same_day_competition: "This beats same-day competition by pairing exact 882/545,326 proof with direct operator action rather than a descriptive fragment.",
      primary_source_proof: "https://aibtc.com/api/leaderboard returned distribution.total=882 and totalCheckIns=545326 as the exact primary source proof.",
      operator_action: "Operators should verify the latest leaderboard snapshot before routing collaboration and filing decisions."
    }
  };
}

test("createChatSignalPackage returns validated helper-ready JSON, not internal artifact shape", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-chat-signal-"));
  try {
    await seedCreateSignalState(tempDir);
    const result = await createChatSignalPackage(makeInput(), tempDir);
    const payload = result.helperReady.json;

    assert.equal(result.validation.ok, true);
    assert.equal(payload.btc_address, "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv");
    assert.equal(payload.beat_slug, "aibtc-network");
    assert.equal(payload.body, payload.analysis);
    assert.equal(payload.tags.length, 2);
    assert.equal(payload.sources[0].url, "https://aibtc.com/api/leaderboard");
    assert.equal(Object.hasOwn(payload, "kind"), false);
    assert.equal(Object.hasOwn(payload, "status"), false);
    assert.equal(Object.hasOwn(payload, "filing_gate"), false);
    assert.equal(Object.hasOwn(payload, "candidateId"), false);
    assert.equal(payload.workflow_context.reportDate, "2026-04-15");
    assert.match(payload.workflow_context.analysisPath, /signal-loop-analysis-2026-04-15\.json$/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createChatSignalPackage fails closed when loop analysis is missing", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-chat-signal-missing-loop-"));
  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/signal-history.json"),
      JSON.stringify({ version: 1, updatedAt: "2026-04-15T00:00:00Z", entries: [] }),
      "utf8"
    );

    await assert.rejects(
      () => createChatSignalPackage(makeInput(), tempDir),
      /missing loop context|signal loop analysis artifact is missing|distilled learning artifact missing|outcome board is mandatory/i
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
