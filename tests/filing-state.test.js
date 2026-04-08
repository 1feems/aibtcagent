import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  applyHumanDecision,
  buildFilingQueue,
  markCandidateOutcome,
  recordFiledSignal,
  readCandidateHistory,
  saveFilingQueue,
  syncCandidateNextDayEvidence
} from "../dist/filing/index.js";
import { saveRankedCandidateQueue } from "../dist/scoring/index.js";

async function writeOperatorPreflight(tempDir) {
  await mkdir(resolve(tempDir, "data/state"), { recursive: true });
  await writeFile(
    resolve(tempDir, "data/state/operator-signability.json"),
    JSON.stringify(
      {
        kind: "operator_signability_preflight",
        checkedAt: "2026-03-29T09:00:00Z",
        walletProviderReady: true,
        payloadIntegrityReady: true,
        activeWalletAddress: "bc1q-ready",
        requiredWalletAddress: "bc1q-ready",
        allowedBeats: ["infrastructure", "security"],
        blockedBeats: [],
        notes: []
      },
      null,
      2
    ),
    "utf8"
  );
}

test("recordFiledSignal persists receipt, filed state, and queue status", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filed-state-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await writeFile(
      "data/dry-runs/2026-03-29/top-file-submission.json",
      JSON.stringify({
        candidate_signal: { beat: "infrastructure" },
        headline: "Top file candidate"
      }),
      "utf8"
    );

    const filingQueue = await buildFilingQueue("2026-03-29", [
      {
        candidateId: "top-file",
        beat: "infrastructure",
        headline: "Top file candidate",
        score: 82,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["best candidate"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-29/top-file-submission.json")
      }
    ]);
    await saveFilingQueue(filingQueue);
    await applyHumanDecision({
      reportDate: "2026-03-29",
      candidateId: "top-file",
      decision: "approve",
      reviewedBy: "operator",
      approvalNote: "Broad infrastructure change with immediate operator impact."
    });

    const result = await recordFiledSignal({
      reportDate: "2026-03-29",
      candidateId: "top-file",
      signalId: "signal-789",
      filedAt: "2026-03-29T12:00:00Z",
      apiResponse: { id: "signal-789", ok: true }
    });

    const state = JSON.parse(await readFile(result.statePath, "utf8"));
    assert.equal(state.filedSignals.length, 1);
    assert.equal(state.filedSignals[0].signalId, "signal-789");
    assert.equal(state.filedSignals[0].candidateId, "top-file");

    const receipt = JSON.parse(await readFile(result.receiptPath, "utf8"));
    assert.equal(receipt.kind, "filed_signal_receipt");
    assert.equal(receipt.signalId, "signal-789");

    const queue = JSON.parse(await readFile(result.queuePath, "utf8"));
    assert.equal(queue.items[0].queueStatus, "filed");
    assert.equal(queue.items[0].lifecycle.state, "filed");
    assert.equal(queue.topCandidateId, null);

    const history = await readCandidateHistory("top-file", tempDir);
    assert.ok(history);
    assert.equal(history.filing.signalId, "signal-789");
    assert.equal(history.sourceSummary.length, 0);
    assert.equal(history.liveOpsEvidence.signability.signable, true);
    assert.equal(history.liveOpsEvidence.approval.decision, "approve");
    assert.equal(
      history.liveOpsEvidence.approval.operatorRationale,
      "Broad infrastructure change with immediate operator impact."
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("candidate history tracks readable sources and in-brief outcome state", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filed-state-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await writeFile(
      "data/dry-runs/2026-03-29/source-rich-submission.json",
      JSON.stringify({
        candidate_signal: { beat: "security" },
        headline: "$137M Lost in Q1 2026 as Private Key Compromise Overtakes Smart Contract Bugs",
        sources: [
          {
            source_name: "Rekt News exploit analysis",
            source_url: "https://rekt.news/example-q1-2026-exploit-analysis",
            source_role: "primary-proof"
          },
          {
            source_name: "ALEX Docs",
            source_url: "https://docs.alexlab.co/security/oracles",
            source_role: "verification"
          }
        ]
      }),
      "utf8"
    );
    await writeFile(
      "data/dry-runs/2026-03-29/backup-security-submission.json",
      JSON.stringify({
        candidate_signal: { beat: "security" },
        headline: "Backup security candidate"
      }),
      "utf8"
    );

    const rankedCandidates = [
      {
        candidateId: "source-rich",
        beat: "security",
        headline: "$137M Lost in Q1 2026 as Private Key Compromise Overtakes Smart Contract Bugs",
        score: 84,
        decision: "file",
        styleTested: "single_story_operator_angle",
        competitorReference: null,
        whyThisStyleWasChosen: "single_story_operator_angle",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["best candidate"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-29/source-rich-submission.json")
      },
      {
        candidateId: "backup-security",
        beat: "infrastructure",
        headline: "Backup security candidate",
        score: 82,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["backup candidate was available"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-29/backup-security-submission.json")
      }
    ];
    await saveRankedCandidateQueue("2026-03-29", rankedCandidates, tempDir);
    const filingQueue = await buildFilingQueue("2026-03-29", rankedCandidates);
    await saveFilingQueue(filingQueue);
    await applyHumanDecision({
      reportDate: "2026-03-29",
      candidateId: "source-rich",
      decision: "approve",
      reviewedBy: "operator",
      approvalNote: "Same-day security framing is broad enough to win the beat."
    });

    await recordFiledSignal({
      reportDate: "2026-03-29",
      candidateId: "source-rich",
      signalId: "signal-999",
      filedAt: "2026-03-29T12:00:00Z",
      apiResponse: { id: "signal-999", ok: true }
    });

    await mkdir("data/state", { recursive: true });
    await writeFile(
      "data/state/brief-winners-2026-03-29.json",
      JSON.stringify({
        kind: "brief_winner_snapshot",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T19:00:00Z",
        occupiedBeats: ["security"],
        repeatWinners: [],
        winners: [
          {
            agent: "competitor-one",
            appearances: 1,
            beats: ["security"],
            headlines: ["Broader Security Story Wins the Slot"]
          }
        ],
        publishedSignals: [
          {
            signalId: "signal-competitor",
            headline: "Broader Security Story Wins the Slot",
            beat: "security",
            publishedAt: "2026-03-29T18:30:00Z",
            approvedAt: "2026-03-29T18:00:00Z",
            agent: "competitor-one"
          }
        ],
        approvedNotInBrief: []
      }),
      "utf8"
    );

    await markCandidateOutcome(
      "source-rich",
      {
        status: "approved",
        approved: true,
        publishedInBrief: false,
        recordedAt: "2026-03-29T18:00:00Z",
        note: "approved but not published in In Brief — failed outcome for the real KPI",
        learningWhy: "Approved, but a broader same-day security story would have been the better replacement."
      },
      tempDir
    );

    await mkdir("data/reports/daily", { recursive: true });
    await writeFile(
      "data/reports/daily/2026-03-30.json",
      JSON.stringify({
        reportDate: "2026-03-30",
        changedFromYesterday: [
          "In Brief wins moved from 0 to 1.",
          "Strictness regime is standard; yesterday it was tightened."
        ]
      }),
      "utf8"
    );
    await mkdir("data/experiments/optimization", { recursive: true });
    await writeFile(
      "data/experiments/optimization/2026-03-30.json",
      JSON.stringify({
        reportDate: "2026-03-30",
        nextDayRecommendations: [
          "Lean harder into security; it produced the strongest published outcome today."
        ],
        beatPreferences: [
          {
            beat: "security",
            preference: "increase",
            rationale: "Published wins landed."
          }
        ],
        stylePerformance: [
          {
            style: "single_story_operator_angle",
            preference: "promote",
            rationale: "Converted into In Brief."
          }
        ],
        packagingAdjustments: {
          promoteBroadSameBeatPackaging: false,
          demoteNarrowFragmentPackaging: false,
          rationale: ["Keep the current packaging approach steady."]
        },
        topCandidatePerformance: {
          commonFailurePatterns: []
        }
      }),
      "utf8"
    );

    const updatedCount = await syncCandidateNextDayEvidence("2026-03-30", tempDir);
    assert.equal(updatedCount, 2);

    const history = await readCandidateHistory("source-rich", tempDir);
    assert.ok(history);
    assert.equal(history.sourceSummary.length, 2);
    assert.equal(history.sourceSummary[0].domain, "rekt.news");
    assert.equal(history.outcome.publishedInBrief, false);
    assert.equal(history.liveOpsEvidence.nextDay.length, 1);
    assert.equal(history.liveOpsEvidence.nextDay[0].reportDate, "2026-03-30");
    assert.equal(history.liveOpsEvidence.replacementReview.replacementCandidateId, "backup-security");
    assert.equal(history.liveOpsEvidence.replacementReview.surfacedInTime, true);
    assert.equal(history.liveOpsEvidence.replacementReview.trigger, "lost_top_candidate");
    assert.equal(history.liveOpsEvidence.competitiveReplay.beatOccupied, true);
    assert.equal(history.liveOpsEvidence.competitiveReplay.ownCandidateWon, false);
    assert.equal(history.liveOpsEvidence.competitiveReplay.winnerHeadline, "Broader Security Story Wins the Slot");
    assert.ok(
      history.liveOpsEvidence.nextDay[0].loopChanges.some((line) => /Beat security is now increase/.test(line))
    );
    const replay = JSON.parse(
      await readFile(resolve(tempDir, "data/reports/competitive-replay/2026-03-29/source-rich.json"), "utf8")
    );
    assert.equal(replay.kind, "candidate_competitive_replay");
    assert.equal(replay.beatOccupied, true);
    assert.equal(replay.ownCandidateWon, false);
    assert.equal(replay.sameBeatPublishedSignals.length, 1);
    assert.equal(replay.winner.headline, "Broader Security Story Wins the Slot");
    const markdown = await readFile(resolve(tempDir, "data/candidate-history/source-rich.md"), "utf8");
    assert.match(markdown, /Rekt News exploit analysis/);
    assert.match(markdown, /Published in Brief: false/);
    assert.match(markdown, /Learning why: Approved, but a broader same-day security story would have been the better replacement\./);
    assert.match(markdown, /Operator rationale: Same-day security framing is broad enough to win the beat\./);
    assert.match(markdown, /Replacement candidate: backup-security/);
    assert.match(markdown, /Replay winner headline: Broader Security Story Wins the Slot/);
    assert.match(markdown, /Next-day recommendation: Lean harder into security/);
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
