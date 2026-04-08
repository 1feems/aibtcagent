import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { refreshEditorialMemory } from "../dist/learning/index.js";

test("editorial memory carries current-cycle winners, losses, and passing source patterns", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-editorial-memory-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/training"), { recursive: true });
    await mkdir(resolve(tempDir, "memory"), { recursive: true });

    await writeFile(resolve(tempDir, "memory/learnings.md"), "## General\n- next: keep lessons concrete\n", "utf8");
    await writeFile(
      resolve(tempDir, "data/state/brief-agent-behavior.json"),
      JSON.stringify({
        updatedAt: "2026-04-03T20:00:00Z",
        agents: [{ agent: "Prime Spoke", wins: 3, beats: ["Infrastructure"], sameDayMultiWins: 1 }],
        commonSourceDomains: [{ domain: "github.com", count: 3 }, { domain: "npmjs.com", count: 1 }]
      }),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/state/rejected-signals-2026-04-03.json"),
      JSON.stringify({
        kind: "rejected_signal_snapshot",
        reportDate: "2026-04-03",
        timezone: "America/Los_Angeles",
        capturedAt: "2026-04-03T23:59:59.000-07:00",
        captureSource: "test",
        scope: "partial",
        notes: [],
        headings: [],
        entries: [
          {
            beat: "Onboarding",
            headline: "Raw stat milestone loses the displacement bar",
            agent: "abc",
            status: "Rejected",
            timestamp: "today",
            tags: [],
            reason: "Daily roster is full and this is raw data without enough agent-actionable analysis."
          }
        ]
      }),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/state/brief-winners-2026-04-03.json"),
      JSON.stringify({
        kind: "brief_winner_snapshot",
        reportDate: "2026-04-03",
        generatedAt: "2026-04-03T20:00:00Z",
        occupiedBeats: ["Infrastructure", "Governance"],
        repeatWinners: [],
        winners: [],
        publishedSignals: [
          {
            signalId: "sig-1",
            headline: "Stacks 3.4 Hard Fork Live: Clarity 5 and New Post-Conditions Active at Burn Block 943,333",
            beat: "Infrastructure",
            publishedAt: "2026-04-03T19:00:00Z",
            approvedAt: "2026-04-03T18:00:00Z",
            agent: "Prime Spoke"
          }
        ],
        approvedNotInBrief: []
      }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(resolve(tempDir, "data/training/in-brief.jsonl"), JSON.stringify({ headline: "Broad package before activation", reason_tags: ["broad_package"] }) + "\n", "utf8");
    await writeFile(resolve(tempDir, "data/training/rejected.jsonl"), JSON.stringify({ headline: "Raw stat dump", reason_tags: ["stat_dump"] }) + "\n", "utf8");

    const memory = await refreshEditorialMemory(tempDir);

    assert.equal(memory.currentCycle.reportDate, "2026-04-03");
    assert.equal(memory.currentCycle.winnersToday.length, 1);
    assert.equal(memory.currentCycle.lossesToday.length, 1);
    assert.ok(memory.currentCycle.valueCreatingPatterns.some((entry) => /operator consequence/i.test(entry)));
    assert.ok(memory.currentCycle.sourcePatternsThatPassed.length > 0);
    assert.equal(memory.currentBrief.reportDate, "2026-04-03");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
