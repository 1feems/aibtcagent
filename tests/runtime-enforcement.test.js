import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildSignalReport, runSignalJob } from "../dist/prep/signal-job.js";
import { loadSignalTemplate, hasTemplateAnalysis } from "../dist/filing/template-rules.js";

function makeMemoryFiles(root) {
  return Promise.all([
    mkdir(resolve(root, "data/state"), { recursive: true }),
    writeFile(
      resolve(root, "data/state/objective-memory.json"),
      JSON.stringify({
        mainKpi: "brief wins",
        payoutModel: { briefInclusionSats: 30000, weeklyTop3PrizesSats: [200000, 100000, 50000] },
        leaderboardFormula: { formula: "x", weights: {} },
        cadenceLimits: { maxSignalsPerDay: 6, maxSignalsPerBeatPerMinutes: 60 },
        currentStanding: { gapToTop3: null },
        pressureNotes: []
      }),
      "utf8"
    ),
    writeFile(
      resolve(root, "data/state/editorial-memory.json"),
      JSON.stringify({
        editorialTemplate: { readTodayBriefFirst: true },
        rejectionPolicy: {
          rejectedFeedbackIsOperatingInstruction: true,
          repairAndResubmitByDefault: true
        },
        currentCycle: {
          reportDate: "2026-04-08",
          winnersToday: [],
          lossesToday: [],
          valueCreatingPatterns: [],
          sourcePatternsThatPassed: []
        },
        focusAreas: [],
        preFilingChecks: []
      }),
      "utf8"
    ),
    writeFile(
      resolve(root, "data/state/competition-memory.json"),
      JSON.stringify({
        crowdingNotes: [],
        beatOwners: [],
        crowdedBeats: [],
        winningStoryShapes: []
      }),
      "utf8"
    ),
    writeFile(
      resolve(root, "data/state/brief-examples.json"),
      JSON.stringify({
        recentWinners: [],
        recentLosses: []
      }),
      "utf8"
    ),
    writeFile(resolve(root, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8"),
    writeFile(resolve(root, "data/state/signal-history.json"), JSON.stringify({ version: 1, updatedAt: "2026-04-08T00:00:00Z", entries: [] }), "utf8"),
    writeFile(resolve(root, "data/briefs/shared-context.json"), JSON.stringify({ dates: {} }), "utf8")
  ]);
}

test("buildSignalReport shows only accepted numbered slots and rejected appendix", async () => {
  const report = buildSignalReport({
    reportDate: "2026-04-08",
    generatedAt: "2026-04-08T01:00:00Z",
    targetCount: 6,
    priorReference: "none",
    accepted: [
      { accepted: true, artifactPath: "a.json", submission: { headline: "A", analysis: "B", sources: [], tags: [] }, preDraftAccepted: true, preDraftScore: 12, preDraftReasons: [], reasons: [], guard: null, briefWinGate: null, beatSaturation: null },
      { accepted: true, artifactPath: "b.json", submission: { headline: "C", analysis: "D", sources: [], tags: [] }, preDraftAccepted: true, preDraftScore: 12, preDraftReasons: [], reasons: [], guard: null, briefWinGate: null, beatSaturation: null }
    ],
    rejected: [
      { fileName: "bad-1.json", reasons: ["reason one", "reason two"] },
      { fileName: "bad-2.json", reasons: ["reason one", "reason two"] }
    ],
    dailyReportRelative: "data/reports/daily/2026-04-08.md",
    briefRelative: "data/briefs/2026-04-08.md",
    objectiveMemoryRelative: "data/state/objective-memory.json",
    editorialMemoryRelative: "data/state/editorial-memory.json",
    competitionMemoryRelative: "data/state/competition-memory.json",
    briefExamplesRelative: "data/state/brief-examples.json",
    objectiveMemory: {
      mainKpi: "brief wins",
      payoutModel: { briefInclusionSats: 30000, weeklyTop3PrizesSats: [200000, 100000, 50000] },
      leaderboardFormula: { formula: "x" },
      cadenceLimits: { maxSignalsPerDay: 6, maxSignalsPerBeatPerMinutes: 60 },
      currentStanding: { gapToTop3: null },
      pressureNotes: []
    },
    editorialMemory: {
      editorialTemplate: { readTodayBriefFirst: true },
      rejectionPolicy: { rejectedFeedbackIsOperatingInstruction: true, repairAndResubmitByDefault: true },
      currentCycle: { reportDate: "2026-04-08", winnersToday: [], lossesToday: [], valueCreatingPatterns: [], sourcePatternsThatPassed: [] },
      focusAreas: [],
      preFilingChecks: []
    },
    competitionMemory: { crowdingNotes: [], beatOwners: [], crowdedBeats: [], winningStoryShapes: [] },
    briefExamplesMemory: { recentWinners: [], recentLosses: [] }
  });

  assert.match(report, /## Candidate 1/);
  assert.match(report, /## Candidate 2/);
  assert.match(report, /## Candidate 3\n- Status: slot_empty/);
  assert.match(report, /## Rejected candidates \(not actionable\)/);
  assert.doesNotMatch(report, /## Candidate 3\n- Headline: NOT GENERATED/);
});

test("loadSignalTemplate reads signal-template.json", async () => {
  const template = await loadSignalTemplate("/Users/feems/Desktop/aibtcagent-workspace/aibtcagent");
  assert.ok(Array.isArray(template._analysis_rules));
  assert.ok(Array.isArray(template._tags_rules));
  assert.ok(Array.isArray(template._disclosure_rules));
  assert.ok(Array.isArray(template._headline_rules));
});

test("Framework B analysis is recognized by shared template rules", async () => {
  const text = [
    "What changed: Relay PR #301 changes nonce recovery flow.",
    "What it means: 18 sponsored payments can remain blocked if operators do not review the release.",
    "What to do: verify the new recovery path and monitor settlement after deploy."
  ].join("\n");
  assert.equal(hasTemplateAnalysis(text), true);
});

test("runSignalJob rejects too many tags and vague headline without exact anchor", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-runtime-enforcement-"));

  try {
    await mkdir(resolve(tempDir, "data/reports/daily"), { recursive: true });
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/manual-submissions/2026-04-08"), { recursive: true });
    await makeMemoryFiles(tempDir);

    await writeFile(resolve(tempDir, "data/reports/daily/2026-04-08.md"), "# Daily Report: 2026-04-08\n", "utf8");
    await writeFile(resolve(tempDir, "data/reports/daily/2026-04-08.json"), JSON.stringify({ kind: "daily_prep_handoff", reportDate: "2026-04-08" }), "utf8");
    await writeFile(resolve(tempDir, "data/briefs/2026-04-08.md"), "# Brief\n", "utf8");
    await writeFile(
      resolve(tempDir, "data/manual-submissions/2026-04-08/bad.json"),
      JSON.stringify({
        status: "in_queue",
        beat_slug: "infrastructure",
        headline: "recent relay update causes payment failures",
        analysis: "CLAIM: relay changed.\nEVIDENCE: PR #301 updated nonce recovery.\nIMPLICATION: 18 payments can stall.\nDirective: verify the release before deploy.",
        sources: [{ url: "https://github.com/aibtcdev/x402-sponsor-relay/pull/301", title: "PR #301" }],
        tags: ["infrastructure", "security", "deal-flow"],
        disclosure: "claude-sonnet-4-6; github review of PR #301; verified release notes"
      }, null, 2),
      "utf8"
    );

    const result = await runSignalJob("2026-04-08", "2026-04-08T01:00:00Z", tempDir);
    assert.equal(result.skipped, true);
    const report = await readFile(resolve(tempDir, "data/reports/signals/2026-04-08.md"), "utf8");
    assert.match(report, /too many tags/i);
    assert.match(report, /Q2 fast-check failed/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
