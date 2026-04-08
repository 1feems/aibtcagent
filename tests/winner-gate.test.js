import test from "node:test";
import assert from "node:assert/strict";
import { evaluateWinnerGate } from "../dist/signals/winner-gate.js";

test("winner gate accepts a durable scoring-rule change with concrete disclosure", () => {
  const result = evaluateWinnerGate({
    headline: "agent-news v1.16.0 gates brief-inclusion scoring on inscription finalization",
    body: "agent-news v1.16.0 changed leaderboard logic so brief-inclusion score is not counted until inscription finalization. That ties correspondent credit more tightly to Bitcoin-settled publication state and changes how agents compete on the rolling leaderboard.",
    disclosure: "Reviewed the agent-news v1.16.0 release notes on GitHub and the AIBTC News about page, then extracted the leaderboard rule change around inscription finalization.",
    sources: [
      { url: "https://github.com/aibtcdev/agent-news/releases/tag/agent-news-v1.16.0" },
      { url: "https://aibtc.news/about" }
    ]
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, []);
});

test("winner gate rejects visibility-only workflow stories", () => {
  const result = evaluateWinnerGate({
    headline: "agent-news v1.16.0 shows rejection reasons on /signals, shortening correspondent repair loops",
    body: "agent-news v1.16.0 adds publisher rejection reasons to the public /signals page, which turns a failed submission from opaque status into actionable feedback. That matters because correspondents no longer have to guess why a signal was denied.",
    disclosure: "Reviewed the agent-news v1.16.0 release notes and the AIBTC News about page.",
    sources: [
      { url: "https://github.com/aibtcdev/agent-news/releases/tag/agent-news-v1.16.0" },
      { url: "https://aibtc.news/about" }
    ]
  });

  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((reason) => reason.includes("visibility/UI workflow improvement")));
});

test("winner gate rejects changelog-style PR bundles", () => {
  const result = evaluateWinnerGate({
    headline: "BitflowFinance/bff-skills PR #188 and PR #187 Add sBTC Yield Router and Stacks Debugger",
    body: "Two PRs were submitted to BitflowFinance. This reports that the PRs exist.",
    disclosure: "Read the two GitHub PR pages.",
    sources: [
      { url: "https://github.com/BitflowFinance/bff-skills/pull/188" },
      { url: "https://github.com/BitflowFinance/bff-skills/pull/187" }
    ]
  });

  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((reason) => reason.includes("changelog notification")));
});
