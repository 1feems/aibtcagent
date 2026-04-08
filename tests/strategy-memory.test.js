import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  buildDailyStrategySnapshot,
  saveDailyStrategySnapshot
} from "../dist/intelligence/index.js";
import {
  refreshBriefExamplesMemory,
  refreshCompetitionMemory,
  refreshEditorialMemory,
  refreshObjectiveMemory
} from "../dist/learning/index.js";

test("daily strategy snapshot is built from layered runtime memories", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-strategy-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/training"), { recursive: true });
    await mkdir(resolve(tempDir, "memory"), { recursive: true });

    await writeFile(
      resolve(tempDir, "memory/learnings.md"),
      [
        "## General",
        "- 2026-04-03: next: block raw stat dumps without a direct operator consequence",
        "- 2026-04-03: loss: duplicate same-day angle lost because the roster already had the stronger package"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/state/leaderboard-memory.json"),
      JSON.stringify({
        capturedAt: "2026-04-03T23:59:59.000-07:00",
        captureSource: "test",
        self: {
          rank: 12,
          score: 320,
          streak: "5d",
          earned: "60000 sats"
        },
        comparisons: {
          gapToTopThreeScore: 90,
          gapToTopSixScore: 40
        }
      }),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/state/brief-agent-behavior.json"),
      JSON.stringify({
        updatedAt: "2026-04-03T20:00:00Z",
        agents: [
          { agent: "Prime Spoke", wins: 4, beats: ["Infrastructure"], sameDayMultiWins: 1 }
        ],
        commonSourceDomains: [{ domain: "github.com", count: 4 }]
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
            headline: "PR #1 ships a tiny fix",
            agent: "abc",
            status: "Rejected",
            timestamp: "today",
            tags: ["infrastructure"],
            reason: "Infrastructure beat is at cap (4). Duplicate coverage and does not clear the bar for displacement."
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
        repeatWinners: [{ agent: "Prime Spoke", appearances: 2, beats: ["Infrastructure"] }],
        winners: [{ agent: "Prime Spoke", appearances: 2, beats: ["Infrastructure"], headlines: ["Broad infrastructure package lands"] }],
        publishedSignals: [
          {
            signalId: "sig-1",
            headline: "Broad infrastructure package lands with operator consequence",
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
    await writeFile(
      resolve(tempDir, "data/state/repairable-candidates.json"),
      JSON.stringify({
        contracts: [
          { signalId: "sig-old", feedbackMessage: "Repair and resubmit with a second source and broader framing." }
        ]
      }),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/training/in-brief.jsonl"),
      JSON.stringify({
        headline: "Broad infrastructure package lands before activation",
        reason_tags: ["operator_consequence", "broad_package"]
      }) + "\n",
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/training/rejected.jsonl"),
      JSON.stringify({
        headline: "Tiny stat dump appears",
        reason_tags: ["stat_dump"]
      }) + "\n",
      "utf8"
    );

    await refreshObjectiveMemory(tempDir);
    await refreshCompetitionMemory(tempDir);
    await refreshBriefExamplesMemory(tempDir);
    await refreshEditorialMemory(tempDir);
    await mkdir(resolve(tempDir, "data/experiments/optimization"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/experiments/optimization/2026-04-03.json"),
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-04-03",
        generatedAt: "2026-04-03T21:00:00Z",
        successMetrics: {
          targetInBriefWins: 3,
          inBriefWins: 1,
          satsEarned: 30000,
          btcRewards: [],
          targetMet: false,
          successDefinition: "Optimize for In Brief wins and sats."
        },
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        factorAttribution: [],
        beatCrowding: [],
        competitorIntel: {
          topAgents: [],
          topSourceDomains: [],
          ownedBeats: [],
          recommendations: []
        },
        topCandidatePerformance: {
          recentTopCandidates: [],
          approvalRate: null,
          publicationRate: null,
          commonFailurePatterns: [],
          recommendations: []
        },
        editorialLearnings: {
          structuralRules: ["Keep winner shape explicit: CLAIM -> EVIDENCE -> IMPLICATION."],
          sourcingRules: ["Prefer GitHub PRs/issues/releases, live APIs, and on-chain proofs."],
          timingRules: ["Front-load the strongest candidates into the early UTC window when possible."],
          specializationRules: ["Bias toward one or two beats with the best publication profile."],
          competitionRules: ["When a beat is crowded, require broader packaging before filing."]
        },
        nextDayRecommendations: []
      }),
      "utf8"
    );

    const snapshot = await buildDailyStrategySnapshot("2026-04-03", "2026-04-03T21:00:00Z", tempDir);
    assert.equal(snapshot.reportDate, "2026-04-03");
    assert.ok(snapshot.priorities.some((line) => /Brief inclusion is the main KPI/i.test(line)));
    assert.ok(snapshot.competitionRules.some((line) => /Infrastructure/i.test(line)));
    assert.ok(snapshot.sourceLanes.some((line) => /github\.com/i.test(line) || /independent/i.test(line)));
    assert.ok(snapshot.antiPatterns.some((line) => /displacement/i.test(line) || /raw stat dumps/i.test(line)));
    assert.ok(snapshot.historicalNotes.some((line) => /Broad infrastructure package/i.test(line)));
    assert.ok(snapshot.editorialRules.some((line) => /CLAIM -> EVIDENCE -> IMPLICATION/i.test(line)));
    assert.ok(snapshot.competitionRules.some((line) => /early UTC window/i.test(line) || /broader packaging/i.test(line)));

    const savedPath = await saveDailyStrategySnapshot(snapshot, tempDir);
    const saved = JSON.parse(await readFile(savedPath, "utf8"));
    assert.equal(saved.kind, "daily_strategy_snapshot");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
