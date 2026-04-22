import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  writeSignalLoopAnalysisReport,
  writeSignalLoopPlanReport,
  writeSignalLoopResearchReport
} from "../dist/agent/run-signal-loop.js";
import { writeSignalLearningBrief } from "../dist/learning/signal-learning-brief.js";
import { writeDailyOutcomeBoard } from "../dist/ops/outcome-board.js";

test("writeSignalLoopAnalysisReport records helper errors, latest brief, and beat editor guidance before create-signal", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-loop-analysis-"));

  try {
    await Promise.all([
      mkdir(resolve(tempDir, "data/state"), { recursive: true }),
      mkdir(resolve(tempDir, "data/briefs"), { recursive: true }),
      mkdir(resolve(tempDir, "docs/beat-editors"), { recursive: true }),
      mkdir(resolve(tempDir, "data/training"), { recursive: true })
    ]);

    await Promise.all([
      writeFile(
        resolve(tempDir, "data/state/signal-history.json"),
        JSON.stringify({ version: 1, updatedAt: "2026-04-19T00:00:00Z", entries: [] }),
        "utf8"
      ),
      writeFile(
        resolve(tempDir, "data/state/editorial-memory.json"),
        JSON.stringify({ preFilingChecks: [{ id: "headline_anchor", rule: "Anchor in headline" }] }),
        "utf8"
      ),
      writeFile(
        resolve(tempDir, "data/state/outcome-feedback-memory.json"),
        JSON.stringify({ repeatedLabels: ["duplicate_cluster"] }),
        "utf8"
      ),
      writeFile(
        resolve(tempDir, "data/state/helper-errors.jsonl"),
        `${JSON.stringify({ message: "Template issue: headline must include an exact anchor" })}\n`,
        "utf8"
      ),
      writeFile(
        resolve(tempDir, "data/briefs/2026-04-19.md"),
        "- Quantum\n- Issue #2419 proposes commit-reveal path for Bitcoin PQ migration\n",
        "utf8"
      ),
      writeFile(
        resolve(tempDir, "data/state/brief-examples.json"),
        JSON.stringify({
          recentWinners: [{ headline: "Issue #2419 proposes commit-reveal path for Bitcoin PQ migration", beat: "quantum" }],
          recentLosses: [{ headline: "Raw stat dump", beat: "quantum" }]
        }),
        "utf8"
      ),
      writeFile(resolve(tempDir, "data/training/in-brief.jsonl"), JSON.stringify({ headline: "winner", reason_tags: ["broad_package"] }) + "\n", "utf8"),
      writeFile(resolve(tempDir, "data/training/rejected.jsonl"), JSON.stringify({ headline: "loss", reason_tags: ["stat_dump"] }) + "\n", "utf8"),
      writeFile(resolve(tempDir, "data/training/approved-not-in-brief.jsonl"), JSON.stringify({ headline: "approved miss", reason_tags: ["thin_implication"] }) + "\n", "utf8"),
      writeFile(
        resolve(tempDir, "docs/beat-editors/quantum-zen-rocket.md"),
        "# Quantum\nUse exact anchors in the headline.\n",
        "utf8"
      )
    ]);

    await writeSignalLearningBrief("2026-04-19", "2026-04-19T04:24:18.616Z", tempDir);

    const outputPath = await writeSignalLoopAnalysisReport(
      "2026-04-19",
      "2026-04-19T04:24:18.616Z",
      tempDir
    );

    const report = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(report.skill, "analyze-signal-outcomes");
    assert.equal(report.reviewedInputs.helperErrors.available, true);
    assert.match(report.reviewedInputs.helperErrors.detail, /headline must include an exact anchor/i);
    assert.equal(report.reviewedInputs.latestBrief.available, true);
    assert.match(report.reviewedInputs.latestBrief.path, /2026-04-19\.md$/);
    assert.equal(report.reviewedInputs.distilledLearningBrief.available, true);
    assert.match(report.reviewedInputs.distilledLearningBrief.path, /signal-learning-briefs\/2026-04-19\.json$/);
    assert.equal(report.reviewedInputs.beatEditorGuidance.length, 1);
    assert.equal(report.reviewedInputs.beatEditorGuidance[0].available, true);
    assert.match(report.reviewedInputs.beatEditorGuidance[0].path, /quantum-zen-rocket\.md$/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("writeDailyOutcomeBoard stores the mandatory operating board fields", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-outcome-board-"));

  try {
    await Promise.all([
      mkdir(resolve(tempDir, "data/state/signal-learning-briefs"), { recursive: true }),
      mkdir(resolve(tempDir, "data/state"), { recursive: true }),
      mkdir(resolve(tempDir, "data/briefs"), { recursive: true })
    ]);
    await Promise.all([
      writeFile(
        resolve(tempDir, "data/state/signal-learning-briefs/2026-04-21.json"),
        JSON.stringify({
          kind: "signal_learning_brief",
          reportDate: "2026-04-21",
          generatedAt: "2026-04-21T04:24:18.616Z",
          sourcePaths: [],
          latestBrief: { path: "data/briefs/2026-04-21.md", headlineSample: "winner" },
          winnerReview: { headlines: ["winner"], patterns: ["metric + operator consequence"], tags: [], lessons: [] },
          rejectionReview: { headlines: ["BIP-361 repeats the same cluster"], tags: ["duplicate_story_shape"], lessons: [] },
          approvedNotInBriefReview: { headlines: [], tags: [], lessons: [] },
          helperErrorReview: { messages: ["body missing"], lessons: [] },
          draftingDirectives: ["draft only with a board"]
        }),
        "utf8"
      ),
      writeFile(
        resolve(tempDir, "data/state/signal-history.json"),
        JSON.stringify({
          version: 1,
          updatedAt: "2026-04-21T00:00:00Z",
          entries: [
            {
              signalId: "sig-1",
              candidateId: null,
              headline: "BIP-361 repeats the same cluster",
              beat: "quantum",
              storyShape: "bip-361-repeats-same-cluster",
              filedAt: "2026-04-21T01:00:00Z",
              reportDate: "2026-04-21",
              outcome: "rejected",
              resolvedAt: "2026-04-21T02:00:00Z",
              feedbackLabels: ["duplicate_story_shape"],
              note: "duplicate same-day source cluster",
              satsEarned: null
            },
            {
              signalId: "sig-2",
              candidateId: null,
              headline: "BIP-361 repeats the same cluster again",
              beat: "quantum",
              storyShape: "bip-361-repeats-same-cluster",
              filedAt: "2026-04-21T01:30:00Z",
              reportDate: "2026-04-21",
              outcome: "rejected",
              resolvedAt: "2026-04-21T02:30:00Z",
              feedbackLabels: ["duplicate_story_shape"],
              note: "duplicate same-day source cluster",
              satsEarned: null
            }
          ]
        }),
        "utf8"
      ),
      writeFile(resolve(tempDir, "data/state/helper-errors.jsonl"), JSON.stringify({ message: "helper failure" }) + "\n", "utf8"),
      writeFile(resolve(tempDir, "data/briefs/2026-04-21.md"), "- Quantum winner shape\n", "utf8")
    ]);

    const { board, statePath, logPath } = await writeDailyOutcomeBoard(
      "2026-04-21",
      "2026-04-21T04:24:18.616Z",
      tempDir
    );

    assert.equal(board.kind, "daily_outcome_board");
    assert.deepEqual(board.crowdedBeats, ["quantum"]);
    assert.ok(board.openBeats.includes("aibtc-network"));
    assert.ok(board.duplicateClusters.length > 0);
    assert.ok(board.recentRejectionReasons.includes("duplicate_story_shape"));
    assert.equal(board.latestBriefWinnerShape, "metric + operator consequence");
    assert.ok(board.helperFailures.includes("helper failure"));
    assert.match(statePath, /data\/state\/outcome-boards\/2026-04-21\.json$/);
    assert.match(logPath, /logs\/outcome-board-2026-04-21\.json$/);
    assert.equal(JSON.parse(await readFile(statePath, "utf8")).kind, "daily_outcome_board");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("writeSignalLoopResearchReport and writeSignalLoopPlanReport encode the next action when no strong candidates survive", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-loop-plan-"));

  try {
    const researchOutput = await writeSignalLoopResearchReport(
      "2026-04-20",
      "2026-04-20T04:24:18.616Z",
      {
        items: [
          { queueStatus: "on_hold" },
          { queueStatus: "rejected" }
        ]
      },
      2,
      null,
      tempDir
    );

    const research = JSON.parse(await readFile(researchOutput.outputPath, "utf8"));
    assert.equal(research.phase, "research");
    assert.equal(research.verdict, "source_exhausted");
    assert.equal(research.candidateCounts.strong, 0);
    assert.equal(research.candidateCounts.onHold, 1);

    const planOutput = await writeSignalLoopPlanReport(
      "2026-04-20",
      "2026-04-20T04:24:18.616Z",
      researchOutput.report,
      tempDir
    );

    const plan = JSON.parse(await readFile(planOutput.outputPath, "utf8"));
    assert.equal(plan.phase, "plan");
    assert.equal(plan.chosenAction, "write_manual_candidate");
    assert.match(plan.nextOperatorAction, /data\/manual-submissions/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
