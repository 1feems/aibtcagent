import test from "node:test";
import assert from "node:assert/strict";
import { checkBriefWinShape } from "../dist/scoring/brief-win-gate.js";
import { formatSaturationWarning } from "../dist/scoring/beat-saturation.js";
import { analyzeConversion } from "../dist/scoring/conversion-tracker.js";
import { getCapBlockedQueue } from "../dist/filing/cap-blocked-queue.js";
import { analyzeBeatCoverage } from "../dist/scoring/beat-coverage.js";
import { tmpdir } from "node:os";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ── P28: Brief-win shape gate ──────────────────────────────────────────────────

test("P28: pass when all three attributes present", () => {
  const result = checkBriefWinShape(
    "Hiro API v7.3 retires endpoint used by 1,200 agents — first breaking change in 18 months",
    "GET /extended/v1 returns 410 Gone as of block 190,000. Unlike prior deprecations, this endpoint has no redirect. Agents using this path directly will break. Implication: agents should migrate to /extended/v2 before block 190,000 or face silent failures."
  );
  assert.ok(result.checks.operatorConsequence, "should detect operator consequence");
  assert.ok(result.checks.exactNumber, "should detect exact number");
  assert.ok(result.checks.displacementFraming, "should detect displacement framing");
  assert.equal(result.pass, true);
  assert.equal(result.demotionReason, null);
});

test("P28: demote when operator consequence is missing", () => {
  const result = checkBriefWinShape(
    "Hiro API endpoint deprecated",
    "The endpoint was deprecated in version 7.3. Sources confirm the change in the changelog. Block 190,000 is the cutoff."
  );
  assert.equal(result.checks.operatorConsequence, false);
  assert.ok(!result.pass);
  assert.ok(result.missingAttributes.some((m) => m.includes("explicit_operator_consequence")));
});

test("P28: demote when exact number missing from opening", () => {
  const result = checkBriefWinShape(
    "Relay nonce-gap incident resolved",
    "The relay experienced a nonce-gap incident last night. Recovery was completed. Agents should monitor their pending transaction queues. Unlike last week's incident, this one was self-healing."
  );
  assert.equal(result.checks.exactNumber, false);
  assert.ok(!result.pass);
  assert.ok(result.missingAttributes.some((m) => m.includes("exact_number")));
});

test("P28: demote when displacement framing missing", () => {
  const result = checkBriefWinShape(
    "Stacks block production at 9.8 minute average on 2026-04-06",
    "Block 190,222 confirms average block time of 9.8 minutes over the last 100 blocks. Agents should account for longer confirmation windows. Operators should review timeout settings."
  );
  // has number + consequence but no displacement
  assert.equal(result.checks.displacementFraming, false);
  assert.ok(!result.pass);
  assert.ok(result.missingAttributes.some((m) => m.includes("displacement_framing")));
});

test("P28: all three missing → demotionReason mentions 3 attributes", () => {
  const result = checkBriefWinShape(
    "Something happened today",
    "A thing occurred. It was notable. The community is aware."
  );
  assert.equal(result.pass, false);
  assert.equal(result.missingAttributes.length, 3);
  assert.ok(result.demotionReason?.includes("3/3"));
});

// ── P27: Beat saturation formatter ────────────────────────────────────────────

test("P27: clear saturation produces empty warning string", () => {
  const result = { beat: "infrastructure", approvedCount: 1, saturationLevel: "clear", blockingReason: null, displacementRequired: false };
  assert.equal(formatSaturationWarning(result), "");
});

test("P27: blocked saturation produces block message", () => {
  const result = {
    beat: "infrastructure",
    approvedCount: 5,
    saturationLevel: "blocked",
    blockingReason: "Beat \"infrastructure\" has 5 approved signals this cycle — brief slot near-zero.",
    displacementRequired: true
  };
  const msg = formatSaturationWarning(result);
  assert.ok(msg.startsWith("beat_saturation_block:"));
});

test("P27: warning saturation produces warning message", () => {
  const result = {
    beat: "defi",
    approvedCount: 3,
    saturationLevel: "warning",
    blockingReason: "Beat \"defi\" has 3 approved signals this cycle.",
    displacementRequired: false
  };
  const msg = formatSaturationWarning(result);
  assert.ok(msg.startsWith("beat_saturation_warning:"));
});

// ── P26: Conversion tracker (empty state) ─────────────────────────────────────

test("P26: analyzeConversion returns zero counts when no state file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aibtc-test-"));
  await mkdir(join(dir, "data/state"), { recursive: true });
  // No filed-signals.json — should not throw
  const result = await analyzeConversion(dir);
  assert.equal(result.totalFiled, 0);
  assert.equal(result.totalApproved, 0);
  assert.equal(result.totalBriefIncluded, 0);
  assert.equal(result.conversionRate, 0);
});

test("P26: analyzeConversion tracks brief_included vs approved", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aibtc-test-"));
  await mkdir(join(dir, "data/state"), { recursive: true });
  const state = {
    filedSignals: [
      { signalId: "s1", candidateId: null, headline: "Signal 1", beat: "infrastructure", filedAt: "2026-04-05T10:00:00Z", resolved: true, approved: true, brief_included: true },
      { signalId: "s2", candidateId: null, headline: "Signal 2", beat: "infrastructure", filedAt: "2026-04-05T11:00:00Z", resolved: true, approved: true, brief_included: false },
      { signalId: "s3", candidateId: null, headline: "Signal 3", beat: "defi", filedAt: "2026-04-05T12:00:00Z", resolved: true, approved: false, brief_included: false }
    ]
  };
  await writeFile(join(dir, "data/state/filed-signals.json"), JSON.stringify(state));
  const result = await analyzeConversion(dir);
  assert.equal(result.totalFiled, 3);
  assert.equal(result.totalApproved, 2);
  assert.equal(result.totalBriefIncluded, 1);
  assert.equal(result.approvedNotInBrief, 1);
  assert.ok(Math.abs(result.conversionRate - 0.5) < 0.001, `expected 0.5 conversion rate, got ${result.conversionRate}`);
});

// ── P29: Cap-blocked queue ─────────────────────────────────────────────────────

test("P29: getCapBlockedQueue returns empty for no state", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aibtc-test-"));
  await mkdir(join(dir, "data/state"), { recursive: true });
  const entries = await getCapBlockedQueue(dir);
  assert.deepEqual(entries, []);
});

test("P29: getCapBlockedQueue returns explicit cap_blocked entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aibtc-test-"));
  await mkdir(join(dir, "data/state"), { recursive: true });
  const state = {
    filedSignals: [
      { signalId: "cap1", candidateId: null, headline: "Cap blocked signal", beat: "infrastructure", filedAt: "2026-04-05T14:00:00Z", resolved: true, approved: true, brief_included: false, cap_blocked: true }
    ]
  };
  await writeFile(join(dir, "data/state/filed-signals.json"), JSON.stringify(state));
  const entries = await getCapBlockedQueue(dir);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].signalId, "cap1");
  assert.equal(entries[0].isExplicitlyFlagged, true);
});

// ── P30: Beat coverage ────────────────────────────────────────────────────────

test("P30: below minimum beats triggers warning", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aibtc-test-"));
  await mkdir(join(dir, "data/state"), { recursive: true });
  const state = {
    filedSignals: [
      { signalId: "x1", candidateId: null, headline: "Infra signal", beat: "infrastructure", filedAt: "2026-04-06T09:00:00Z", resolved: false },
      { signalId: "x2", candidateId: null, headline: "DeFi signal", beat: "defi", filedAt: "2026-04-06T10:00:00Z", resolved: false }
    ]
  };
  await writeFile(join(dir, "data/state/filed-signals.json"), JSON.stringify(state));
  const result = await analyzeBeatCoverage("2026-04-06", dir);
  assert.ok(result.recentWeekBeats.length >= 2);
  assert.ok(!result.recentWeekMeetsMin || result.recentWeekBeats.length >= 3, "should flag below min if < 3 beats this week");
  assert.ok(result.recommendation.length > 0);
});

test("P30: reports untouched beats", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aibtc-test-"));
  await mkdir(join(dir, "data/state"), { recursive: true });
  const state = { filedSignals: [] };
  await writeFile(join(dir, "data/state/filed-signals.json"), JSON.stringify(state));
  const result = await analyzeBeatCoverage("2026-04-06", dir);
  assert.ok(result.uncoveredBeats.length > 0, "should list untouched beats");
  assert.ok(result.coveredBeats.length === 0, "no beats covered with empty state");
});

test("P30: identifies adjacent expansion opportunities", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aibtc-test-"));
  await mkdir(join(dir, "data/state"), { recursive: true });
  const state = {
    filedSignals: [
      { signalId: "inf1", candidateId: null, headline: "Infra", beat: "infrastructure", filedAt: "2026-04-01T10:00:00Z", resolved: true }
    ]
  };
  await writeFile(join(dir, "data/state/filed-signals.json"), JSON.stringify(state));
  const result = await analyzeBeatCoverage("2026-04-06", dir);
  // infrastructure has adjacents: agent-skills, agent-economy, security
  assert.ok(result.adjacentOpportunities.length > 0, "should find adjacent opportunities from infrastructure coverage");
  const beats = result.adjacentOpportunities.map((o) => o.beat);
  const expectedAdjacents = ["agent-skills", "agent-economy", "security"];
  const hasExpected = expectedAdjacents.some((b) => beats.includes(b));
  assert.ok(hasExpected, `expected adjacent beats from infrastructure, got: ${beats.join(", ")}`);
});
