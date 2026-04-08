import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  refreshBriefExamplesMemory,
  refreshCompetitionMemory,
  refreshObjectiveMemory,
  syncRuntimeMemory
} from "../dist/learning/index.js";

test("runtime sync writes layered context memories and declares context-first authority", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-context-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/training"), { recursive: true });
    await mkdir(resolve(tempDir, "memory"), { recursive: true });

    await writeFile(resolve(tempDir, "memory/learnings.md"), "## General\n- next: keep lessons concrete\n", "utf8");
    await writeFile(
      resolve(tempDir, "data/state/leaderboard-memory.json"),
      JSON.stringify({
        capturedAt: "2026-04-03T23:59:59.000-07:00",
        captureSource: "test",
        self: { rank: 8, score: 410, streak: "7d", earned: "90000 sats" },
        comparisons: { gapToTopThreeScore: 30, gapToTopSixScore: 5 }
      }),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/state/brief-agent-behavior.json"),
      JSON.stringify({
        updatedAt: "2026-04-03T20:00:00Z",
        agents: [{ agent: "Prime Spoke", wins: 3, beats: ["Infrastructure"], sameDayMultiWins: 1 }],
        commonSourceDomains: [{ domain: "github.com", count: 3 }]
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
            beat: "Infrastructure",
            headline: "Small infra update",
            agent: "abc",
            status: "Rejected",
            timestamp: "today",
            tags: [],
            reason: "Infrastructure beat is at cap (4). Duplicate coverage."
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
        occupiedBeats: ["Infrastructure"],
        repeatWinners: [],
        winners: [],
        publishedSignals: [
          {
            signalId: "sig-1",
            headline: "Broad infrastructure package wins the brief",
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

    const objective = await refreshObjectiveMemory(tempDir);
    const competition = await refreshCompetitionMemory(tempDir);
    const examples = await refreshBriefExamplesMemory(tempDir);
    const sync = await syncRuntimeMemory("test-sync", tempDir);

    assert.equal(objective.payoutModel.briefInclusionSats, 30000);
    assert.ok(competition.crowdedBeats.some((entry) => entry.beat === "Infrastructure"));
    assert.ok(examples.recentWinners.some((entry) => /wins the brief/i.test(entry.headline)));
    assert.equal(sync.objectiveMemoryPath.endsWith("objective-memory.json"), true);
    assert.equal(sync.competitionMemoryPath.endsWith("competition-memory.json"), true);
    assert.equal(sync.briefExamplesMemoryPath.endsWith("brief-examples.json"), true);

    const memoryIndex = JSON.parse(await readFile(resolve(tempDir, "data/state/memory-index.json"), "utf8"));
    assert.equal(memoryIndex.authorityOrder[0].path, "data/state/objective-memory.json");
    assert.equal(memoryIndex.authorityOrder[1].path, "data/state/editorial-memory.json");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
