import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  buildNormalizedSignalPayload,
  findRecoveredSignal,
  getHelperErrorLogPath,
  inferFilingStatus,
  isBeatClaimUrl,
  isTerminalDuplicateOutcome,
  recordHelperError,
  toLiveSignal
} from "../dist/filing/helper-server.js";

async function seedLoopAnalysis(root, reportDate = "2026-04-20") {
  await mkdir(resolve(root, "logs"), { recursive: true });
  await mkdir(resolve(root, "data/briefs"), { recursive: true });
  await mkdir(resolve(root, "data/state/signal-learning-briefs"), { recursive: true });
  await writeFile(
    resolve(root, `data/state/signal-learning-briefs/${reportDate}.json`),
    JSON.stringify({
      kind: "signal_learning_brief",
      reportDate,
      generatedAt: `${reportDate}T05:00:00Z`,
      sourcePaths: [],
      latestBrief: { path: resolve(root, `data/briefs/${reportDate}.md`), headlineSample: "sample brief" },
      winnerReview: { headlines: ["winner"], patterns: ["short-form"], tags: ["broad_package"], lessons: ["winner lesson"] },
      rejectionReview: { headlines: ["loss"], tags: ["stat_dump"], lessons: ["loss lesson"] },
      approvedNotInBriefReview: { headlines: ["approved miss"], tags: ["thin_implication"], lessons: ["approved miss lesson"] },
      helperErrorReview: { messages: ["helper issue"], lessons: ["helper lesson"] },
      draftingDirectives: ["Draft only stories with an exact anchor, reproducible source proof, and a direct operator consequence."]
    }),
    "utf8"
  );
  await writeFile(
    resolve(root, `logs/signal-loop-analysis-${reportDate}.json`),
    JSON.stringify({
      reportDate,
      generatedAt: `${reportDate}T05:00:00Z`,
      reviewedInputs: {
        signalHistory: { path: resolve(root, "data/state/signal-history.json"), available: true, detail: "reviewed signal history", reviewMode: "loaded_only" },
        editorialMemory: { path: resolve(root, "data/state/editorial-memory.json"), available: true, detail: "reviewed editorial memory", reviewMode: "loaded_only" },
        outcomeFeedbackMemory: { path: resolve(root, "data/state/outcome-feedback-memory.json"), available: true, detail: "reviewed outcome feedback", reviewMode: "loaded_only" },
        helperErrors: { path: resolve(root, "data/state/helper-errors.jsonl"), available: true, detail: "reviewed helper errors", reviewMode: "loaded_only" },
        latestBrief: { path: resolve(root, `data/briefs/${reportDate}.md`), available: true, detail: "reviewed latest brief", reviewMode: "loaded_only" },
        distilledLearningBrief: { path: resolve(root, `data/state/signal-learning-briefs/${reportDate}.json`), available: true, detail: "reviewed distilled learning brief", reviewMode: "loaded_only" },
        beatEditorGuidance: [{ path: resolve(root, "docs/beat-editors/quantum-zen-rocket.md"), available: true, detail: "reviewed beat editor guidance", reviewMode: "loaded_only" }]
      }
    }),
    "utf8"
  );
}

test("helper server normalizes body-only signal input into canonical analysis output", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-helper-normalize-"));
  await seedLoopAnalysis(tempDir);
  const normalized = buildNormalizedSignalPayload(
    {
      beat_slug: "quantum",
      headline: "PR #1895 keeps BIP-360 vector audit open after 2 failing cases",
      body: "CLAIM: Example. EVIDENCE: Example. IMPLICATION: Example.",
      sources: [{ url: "https://github.com/bitcoin/bips/pull/1895", title: "PR #1895" }],
      tags: ["quantum"],
      disclosure: "claude-sonnet-4-6, github review",
      workflow_context: { reportDate: "2026-04-20" }
    },
    "bc1qtestaddress",
    tempDir
  );

  assert.equal(normalized.ok, true);
  // Both body and analysis must be present — the API reads `body` to populate its `content` field.
  // Sending analysis-only causes content: null in the live feed (regression: signal ef5d5bf9).
  assert.equal(normalized.upstreamPayload.body, "CLAIM: Example. EVIDENCE: Example. IMPLICATION: Example.");
  assert.equal(normalized.upstreamPayload.analysis, "CLAIM: Example. EVIDENCE: Example. IMPLICATION: Example.");
  assert.equal(normalized.upstreamPayload.content, undefined);
});

// Regression test for signal ef5d5bf9-e326-4409-9f3e-a08a3afdff95
// "BIP-360 P2MR Vectors Still Reflect PR #2102 and PR #2103 Unmerged Fixes"
// Root cause: upstream payload only contained `analysis`, not `body`.
// The AIBTC API reads `body` to populate the stored `content` field — omitting it causes content: null.
test("upstream payload always contains body — regression for content:null (ef5d5bf9)", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-helper-body-"));
  await seedLoopAnalysis(tempDir);
  const analysisText =
    "CLAIM: PR #2102 and PR #2103 fix vectors for BIP-360 P2MR but remain unmerged. " +
    "EVIDENCE: Both PRs are open with no merge commit as of the signal date. " +
    "IMPLICATION: P2MR implementors relying on the current repo vectors will build against incorrect test data.";

  const normalized = buildNormalizedSignalPayload(
    {
      beat_slug: "quantum",
      headline: "BIP-360 P2MR Vectors Still Reflect PR #2102 and PR #2103 Unmerged Fixes",
      analysis: analysisText,
      sources: [
        { url: "https://github.com/bitcoin/bips/pull/2102", title: "PR #2102" },
        { url: "https://github.com/bitcoin/bips/pull/2103", title: "PR #2103" }
      ],
      tags: ["quantum", "bip-360"],
      disclosure: "claude-sonnet-4-6, github review",
      workflow_context: { reportDate: "2026-04-20" }
    },
    "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv",
    tempDir
  );

  assert.equal(normalized.ok, true, "payload must parse without issues");

  // body must equal analysis — never undefined, never null, never empty
  assert.equal(
    typeof normalized.upstreamPayload.body,
    "string",
    "body must be a string so AIBTC can populate content"
  );
  assert.ok(normalized.upstreamPayload.body.length > 0, "body must not be empty");
  assert.equal(
    normalized.upstreamPayload.body,
    normalized.upstreamPayload.analysis,
    "body and analysis must carry the same text"
  );

  // content must never be set by us — the API owns that field
  assert.equal(normalized.upstreamPayload.content, undefined, "content must not be set in the outgoing payload");
});

test("helper normalization fails closed when workflow_context is missing", () => {
  const normalized = buildNormalizedSignalPayload(
    {
      beat_slug: "quantum",
      headline: "PR #1895 keeps BIP-360 vector audit open after 2 failing cases",
      body: "CLAIM: Example. EVIDENCE: Example. IMPLICATION: Example.",
      sources: [{ url: "https://github.com/bitcoin/bips/pull/1895", title: "PR #1895" }],
      tags: ["quantum"],
      disclosure: "claude-sonnet-4-6, github review"
    },
    "bc1qtestaddress"
  );

  assert.equal(normalized.ok, false);
  assert.match(JSON.stringify(normalized.issues), /workflow_context/i);
});

test("helper normalization rejects CLAIM/EVIDENCE/IMPLICATION sections without terminal punctuation", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-helper-punctuation-"));
  await seedLoopAnalysis(tempDir);
  const normalized = buildNormalizedSignalPayload(
    {
      beat_slug: "quantum",
      headline: "PR #1895 keeps BIP-360 vector audit open after 2 failing cases",
      body: "CLAIM: PR #1895 keeps two vectors unresolved EVIDENCE: https://github.com/bitcoin/bips/pull/1895 confirms two unresolved vectors IMPLICATION: Operators should monitor PR #1895 before production use",
      sources: [{ url: "https://github.com/bitcoin/bips/pull/1895", title: "PR #1895" }],
      tags: ["quantum"],
      disclosure: "claude-sonnet-4-6, github review",
      workflow_context: { reportDate: "2026-04-20" }
    },
    "bc1qtestaddress",
    tempDir
  );

  assert.equal(normalized.ok, false);
  assert.match(JSON.stringify(normalized.issues), /terminal punctuation/i);
});

test("beat-claim URLs stay outside signal validation path", () => {
  assert.equal(isBeatClaimUrl("https://aibtc.news/api/beats"), true);
  assert.equal(isBeatClaimUrl("https://aibtc.news/api/signals"), false);
});

test("cooldown pre-check reports waitMinutes when latest signal is inside the filing window", () => {
  const now = new Date("2026-04-12T10:00:00.000Z");
  const status = inferFilingStatus(
    "bc1qcooldown",
    [
      {
        id: "sig-1",
        headline: "Quantum signal",
        created_at: "2026-04-12T09:31:00.000Z",
        beat: "quantum",
        status: "submitted"
      }
    ],
    now
  );

  assert.equal(status.canFileSignal, false);
  assert.equal(status.waitMinutes, 31);
  assert.equal(status.cooldownEndsAt, "2026-04-12T10:31:00.000Z");
});

test("live signal parsing accepts timestamp field for cooldown checks", () => {
  const now = new Date("2026-04-12T16:10:00.000Z");
  const parsed = toLiveSignal({
    id: "sig-live",
    headline: "Live feed signal",
    timestamp: "2026-04-12T15:54:18.941Z",
    beat: "quantum",
    status: "submitted"
  });

  assert.equal(parsed.created_at, "2026-04-12T15:54:18.941Z");

  const status = inferFilingStatus("bc1qtimestamp", [parsed], now);
  assert.equal(status.canFileSignal, false);
  assert.equal(status.waitMinutes, 45);
});

test("recovery lookup matches live-feed signals that only expose timestamp", () => {
  const recovered = findRecoveredSignal(
    [
      toLiveSignal({
        id: "ef5d5bf9-e326-4409-9f3e-a08a3afdff95",
        headline: "BIP-360 P2MR Vectors Still Reflect PR #2102 and PR #2103 Unmerged Fixes",
        timestamp: "2026-04-12T15:54:18.941Z",
        beat: "quantum",
        status: "submitted"
      })
    ],
    {
      headline: "BIP-360 P2MR Vectors Still Reflect PR #2102 and PR #2103 Unmerged Fixes",
      since: "2026-04-12T15:53:00.000Z",
      beat: "quantum"
    }
  );

  assert.equal(recovered?.id, "ef5d5bf9-e326-4409-9f3e-a08a3afdff95");
});

test("duplicate or already-exists outcomes are terminal", () => {
  assert.equal(isTerminalDuplicateOutcome({ error: "Signal already exists for this headline" }), true);
  assert.equal(isTerminalDuplicateOutcome({ body: { message: "duplicate filing" } }), true);
  assert.equal(isTerminalDuplicateOutcome({ ok: false, error: "timeout" }), false);
});

test("helper error logger appends timestamped records to data/state/helper-errors.jsonl", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-helper-errors-"));
  const logPath = await recordHelperError(
    {
      stage: "payload_normalization",
      helperCategory: "payload_issue",
      message: "Signal template is incomplete. Add the missing labels: EVIDENCE:, IMPLICATION:",
      details: { missingLabels: ["EVIDENCE:", "IMPLICATION:"] },
      headline: "x402 relay signal",
      beatSlug: "aibtc-network",
      status: 400
    },
    tempDir
  );

  assert.equal(logPath, getHelperErrorLogPath(tempDir));
  const lines = (await readFile(logPath, "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]);
  assert.equal(record.stage, "payload_normalization");
  assert.equal(record.helperCategory, "payload_issue");
  assert.equal(record.status, 400);
  assert.deepEqual(record.details.missingLabels, ["EVIDENCE:", "IMPLICATION:"]);
  assert.match(record.recordedAt, /^\d{4}-\d{2}-\d{2}T/);
});
