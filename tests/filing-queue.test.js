import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  applyHumanDecision,
  buildFilingQueue,
  saveFilingQueue
} from "../dist/filing/index.js";
import { saveRankedCandidateQueue } from "../dist/scoring/index.js";

async function writeOperatorPreflight(tempDir, overrides = {}) {
  await mkdir(resolve(tempDir, "data/state"), { recursive: true });
  await writeFile(
    resolve(tempDir, "data/state/operator-signability.json"),
    JSON.stringify(
      {
        kind: "operator_signability_preflight",
        checkedAt: "2026-03-28T09:00:00Z",
        walletProviderReady: true,
        payloadIntegrityReady: true,
        activeWalletAddress: "bc1q-ready",
        requiredWalletAddress: "bc1q-ready",
        allowedBeats: ["infrastructure", "security"],
        blockedBeats: [],
        notes: [],
        ...overrides
      },
      null,
      2
    ),
    "utf8"
  );
}

async function writeObjectiveMemory(tempDir, overrides = {}) {
  await mkdir(resolve(tempDir, "data/state"), { recursive: true });
  await writeFile(
    resolve(tempDir, "data/state/objective-memory.json"),
    JSON.stringify(
      {
        cadenceLimits: {
          maxSignalsPerDay: 6,
          maxSignalsPerBeatPerMinutes: 60
        },
        currentStanding: {
          streak: "7d",
          gapToTop3: 18
        },
        ...overrides
      },
      null,
      2
    ),
    "utf8"
  );
}

async function writeFiledSignals(tempDir, filedSignals) {
  await mkdir(resolve(tempDir, "data/state"), { recursive: true });
  await writeFile(
    resolve(tempDir, "data/state/filed-signals.json"),
    JSON.stringify({ filedSignals }, null, 2),
    "utf8"
  );
}

async function writeSignalReport(tempDir, reportDate, headlines) {
  await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
  await writeFile(
    resolve(tempDir, `data/reports/signals/${reportDate}.md`),
    [
      `# Signal Report: ${reportDate}`,
      "",
      ...headlines.map((headline) => `- Headline: ${headline}`)
    ].join("\n"),
    "utf8"
  );
}

function makeSubmissionArtifact(headline, beat = "infrastructure") {
  return {
    beat_slug: beat,
    headline,
    analysis: `${headline}. AIBTC operators can submit queued AI agent payments again without manual fallback routing, which means failed Bitcoin-denominated settlement work can now reach broadcast and payout accounting instead of stalling in the relay path.`,
    sources: [
      {
        url: "https://github.com/example/project/pull/101",
        title: `${headline} primary proof`
      },
      {
        url: "https://www.npmjs.com/package/@stacks/transactions",
        title: "Independent external verifier"
      }
    ],
    tags: [beat, "test"],
    disclosure: "claude-opus-4, GitHub review of PR #101, npm package reference check for transaction behavior, and manual rewrite to make the operator payout consequence explicit"
  };
}

function makeSignalHeadline(label) {
  return `PR #101 ${label} restores sBTC payment routing for queued agent settlements`;
}

test("filing queue promotes top file candidate and approval writes ready artifact", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    const topHeadline = makeSignalHeadline("top-file");
    await writeSignalReport(tempDir, "2026-03-28", [topHeadline, "Hold candidate"]);
    const rankedCandidates = [
      {
        candidateId: "top-file",
        beat: "infrastructure",
        headline: topHeadline,
        score: 84,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["best score"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/top-file-submission.json")
      },
      {
        candidateId: "hold-me",
        beat: "security",
        headline: "Hold candidate",
        score: 55,
        decision: "hold",
        styleTested: "single_story_operator_angle",
        competitorReference: null,
        whyThisStyleWasChosen: "single_story_operator_angle",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["needs more review"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/hold-me-submission.json")
      }
    ];

    await mkdir("data/dry-runs/2026-03-28", { recursive: true });
    await writeFile(
      "data/dry-runs/2026-03-28/top-file-submission.json",
      JSON.stringify(makeSubmissionArtifact(topHeadline)),
      "utf8"
    );
    await writeFile(
      "data/dry-runs/2026-03-28/hold-me-submission.json",
      JSON.stringify(makeSubmissionArtifact("Hold candidate", "security")),
      "utf8"
    );

    const filingQueue = await buildFilingQueue("2026-03-28", rankedCandidates);
    assert.equal(filingQueue.topCandidateId, "top-file");
    assert.equal(filingQueue.items[0].queueStatus, "awaiting_human_approval");
    assert.equal(filingQueue.items[0].lifecycle.state, "awaiting_human_approval");
    assert.equal(
      filingQueue.items.find((item) => item.candidateId === "hold-me")?.queueStatus,
      "on_hold"
    );
    assert.equal(
      filingQueue.items.find((item) => item.candidateId === "hold-me")?.lifecycle.state,
      "on_hold"
    );
    assert.equal(filingQueue.recommendationSummary.recommendedCount, 1);
    assert.equal(filingQueue.recommendationSummary.uniqueBeatCount, 1);

    await saveFilingQueue(filingQueue);
    const historyAfterQueue = JSON.parse(
      await readFile(resolve(tempDir, "data/candidate-history/top-file.json"), "utf8")
    );
    assert.equal(historyAfterQueue.liveOpsEvidence.signability.signable, true);
    assert.ok(historyAfterQueue.liveOpsEvidence.signability.reasons.includes("best score"));

    const result = await applyHumanDecision({
      reportDate: "2026-03-28",
      candidateId: "top-file",
      decision: "approve",
      reviewedBy: "operator",
      approvalNote: "Broader infrastructure risk with clean timing and strong operator consequence."
    });

    assert.ok(result.readyArtifactPath);
    const ready = JSON.parse(await readFile(result.readyArtifactPath, "utf8"));
    assert.equal(ready.kind, "filing_ready_submission");
    assert.equal(ready.candidateId, "top-file");
    assert.deepEqual(ready.approvalEvidence.reasons, ["best score"]);
    assert.equal(
      ready.approvalEvidence.operatorRationale,
      "Broader infrastructure risk with clean timing and strong operator consequence."
    );

    const updatedQueue = JSON.parse(await readFile(result.queuePath, "utf8"));
    assert.equal(updatedQueue.items[0].queueStatus, "approved_for_filing");
    assert.equal(updatedQueue.items[0].lifecycle.state, "approved_for_filing");

    const historyAfterApproval = JSON.parse(
      await readFile(resolve(tempDir, "data/candidate-history/top-file.json"), "utf8")
    );
    assert.equal(historyAfterApproval.liveOpsEvidence.approval.decision, "approve");
    assert.deepEqual(historyAfterApproval.liveOpsEvidence.approval.reasons, ["best score"]);
    assert.equal(
      historyAfterApproval.liveOpsEvidence.approval.operatorRationale,
      "Broader infrastructure risk with clean timing and strong operator consequence."
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue does not promote hold decisions into awaiting_human_approval", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "hold-only",
        beat: "infrastructure",
        headline: "Hold-only candidate",
        score: 92,
        decision: "hold",
        styleTested: "broad_same_beat_operator",
        competitorReference: null,
        whyThisStyleWasChosen: "broad_same_beat_operator",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["non-competitive release-note framing"],
        sourcePath: resolve(tempDir, "hold-only.json")
      }
    ]);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.recommendationSummary.recommendedCount, 0);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue applies soft beat quotas before using repeat beats", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    const infraOneHeadline = makeSignalHeadline("infra one");
    const infraTwoHeadline = makeSignalHeadline("infra two");
    const securityOneHeadline = makeSignalHeadline("security one");
    await writeSignalReport(tempDir, "2026-03-28", [infraOneHeadline, infraTwoHeadline, securityOneHeadline]);
    await writeFile("infra-1.json", JSON.stringify(makeSubmissionArtifact(infraOneHeadline)), "utf8");
    await writeFile("infra-2.json", JSON.stringify(makeSubmissionArtifact(infraTwoHeadline)), "utf8");
    await writeFile("security-1.json", JSON.stringify(makeSubmissionArtifact(securityOneHeadline, "security")), "utf8");
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "infra-1",
        beat: "infrastructure",
        headline: infraOneHeadline,
        score: 90,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        reasons: ["top score"],
        sourcePath: resolve(tempDir, "infra-1.json")
      },
      {
        candidateId: "infra-2",
        beat: "infrastructure",
        headline: infraTwoHeadline,
        score: 89,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        reasons: ["second infra"],
        sourcePath: resolve(tempDir, "infra-2.json")
      },
      {
        candidateId: "security-1",
        beat: "security",
        headline: securityOneHeadline,
        score: 88,
        decision: "file",
        styleTested: "single_story_operator_angle",
        competitorReference: null,
        whyThisStyleWasChosen: "single_story_operator_angle",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        reasons: ["security candidate"],
        sourcePath: resolve(tempDir, "security-1.json")
      }
    ]);

    const signable = filingQueue.items.filter((item) => item.queueStatus === "awaiting_human_approval");
    assert.deepEqual(signable.map((item) => item.candidateId), ["infra-1", "security-1", "infra-2"]);
    assert.ok(
      filingQueue.recommendationSummary.quotaNotes.some((line) => /Second-slot beat repeats were only used/.test(line))
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue hard-blocks unresolved duplicate risk from signable output", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "duplicate-risk",
        beat: "infrastructure",
        headline: "Duplicate-risk candidate",
        score: 90,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "pending",
        freshnessStatus: "clear",
        reasons: ["strong score but duplicate check still pending"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/duplicate-risk-submission.json")
      }
    ]);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
    assert.equal(filingQueue.items[0].lifecycle.state, "on_hold");
    assert.ok(
      filingQueue.items[0].reasons.includes("hard-blocked from signable queue because duplicate risk is unresolved")
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue hard-blocks unresolved freshness risk from signable output", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "freshness-risk",
        beat: "security",
        headline: "Freshness-risk candidate",
        score: 88,
        decision: "file",
        styleTested: "single_story_operator_angle",
        competitorReference: null,
        whyThisStyleWasChosen: "single_story_operator_angle",
        duplicateStatus: "clear",
        freshnessStatus: "risk_unresolved",
        reasons: ["strong score but freshness still unresolved"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/freshness-risk-submission.json")
      }
    ]);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
    assert.ok(
      filingQueue.items[0].reasons.includes("hard-blocked from signable queue because freshness risk is unresolved")
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue hard-blocks candidates when operator signability preflight is missing", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "missing-preflight",
        beat: "infrastructure",
        headline: "Missing preflight candidate",
        score: 91,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["best score"],
        sourcePath: resolve(tempDir, "missing-preflight.json")
      }
    ]);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
    assert.ok(
      filingQueue.items[0].reasons.includes("hard-blocked from signable queue because operator signability preflight is missing")
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue hard-blocks candidates on unconfirmed beat permission", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir, { allowedBeats: ["security"] });
    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "beat-blocked",
        beat: "deal-flow",
        headline: "Beat-blocked candidate",
        score: 91,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["best score"],
        sourcePath: resolve(tempDir, "beat-blocked.json")
      }
    ]);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
    assert.ok(
      filingQueue.items[0].reasons.includes("hard-blocked from signable queue because beat permission for deal-flow is not confirmed for this operator")
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("filing queue enforces daily filing cap and same-beat cooldown from repo state", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    await writeObjectiveMemory(tempDir);
    const now = new Date();
    const recentBeatTime = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
    const today = now.toISOString().slice(0, 10);
    const infraCapHeadline = makeSignalHeadline("infra cap test");
    await writeSignalReport(tempDir, today, [infraCapHeadline]);
    await writeFile("infra-cap-test.json", JSON.stringify(makeSubmissionArtifact(infraCapHeadline)), "utf8");

    await writeFiledSignals(tempDir, [
      {
        signalId: "recent-infra",
        headline: "Recent infra signal",
        beat: "infrastructure",
        filedAt: recentBeatTime,
        resolved: false
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        signalId: `filled-${index}`,
        headline: `Filled slot ${index}`,
        beat: "security",
        filedAt: `${today}T01:0${index}:00.000Z`,
        resolved: false
      }))
    ]);

    const filingQueue = await buildFilingQueue(today, [
      {
        candidateId: "infra-cap-test",
        beat: "infrastructure",
        headline: infraCapHeadline,
        score: 91,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["best score"],
        sourcePath: resolve(tempDir, "infra-cap-test.json")
      }
    ], tempDir);

    assert.equal(filingQueue.topCandidateId, null);
    assert.equal(filingQueue.items[0].queueStatus, "on_hold");
    assert.ok(
      filingQueue.items[0].reasons.some((reason) => /today's filing limit of 6 signals is already exhausted/i.test(reason))
    );
    assert.ok(
      filingQueue.items[0].reasons.some((reason) => /60-minute cooldown window/i.test(reason))
    );
    assert.ok(
      filingQueue.recommendationSummary.quotaNotes.some((note) => /Active streak: 7d/i.test(note))
    );
    assert.ok(
      filingQueue.recommendationSummary.quotaNotes.some((note) => /Gap to weekly top-3 line: 18/i.test(note))
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("approval refuses candidates when operator signability gates fail at approval time", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    const topHeadline = makeSignalHeadline("top-file");
    await writeSignalReport(tempDir, "2026-03-28", [topHeadline]);
    await mkdir("data/dry-runs/2026-03-28", { recursive: true });
    await writeFile(
      "data/dry-runs/2026-03-28/top-file-submission.json",
      JSON.stringify(makeSubmissionArtifact(topHeadline)),
      "utf8"
    );

    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "top-file",
        beat: "infrastructure",
        headline: topHeadline,
        score: 84,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["best score"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/top-file-submission.json")
      }
    ]);

    await saveFilingQueue(filingQueue);
    await writeOperatorPreflight(tempDir, { walletProviderReady: false });

    await assert.rejects(
      applyHumanDecision({
        reportDate: "2026-03-28",
        candidateId: "top-file",
        decision: "approve",
        reviewedBy: "operator",
        approvalNote: "Still the strongest candidate after manual review."
      }),
      /failed operator signability gates: .*wallet\/provider readiness is not confirmed/i
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("approval requires a non-empty operator rationale", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    const topHeadline = makeSignalHeadline("top-file");
    await writeSignalReport(tempDir, "2026-03-28", [topHeadline]);
    await mkdir("data/dry-runs/2026-03-28", { recursive: true });
    await writeFile(
      "data/dry-runs/2026-03-28/top-file-submission.json",
      JSON.stringify(makeSubmissionArtifact(topHeadline)),
      "utf8"
    );

    const filingQueue = await buildFilingQueue("2026-03-28", [
      {
        candidateId: "top-file",
        beat: "infrastructure",
        headline: topHeadline,
        score: 84,
        decision: "file",
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["best score"],
        sourcePath: resolve(tempDir, "data/dry-runs/2026-03-28/top-file-submission.json")
      }
    ]);

    await saveFilingQueue(filingQueue);

    await assert.rejects(
      applyHumanDecision({
        reportDate: "2026-03-28",
        candidateId: "top-file",
        decision: "approve",
        reviewedBy: "operator",
        approvalNote: "   "
      }),
      /non-empty approvalNote/i
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("held top candidate records the best surfaced replacement", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-filing-"));
  process.chdir(tempDir);

  try {
    await writeOperatorPreflight(tempDir);
    const heldTopHeadline = makeSignalHeadline("held top candidate");
    const backupHeadline = makeSignalHeadline("backup file candidate");
    await writeSignalReport(tempDir, "2026-03-28", [heldTopHeadline, backupHeadline]);
    await writeFile("held-top.json", JSON.stringify(makeSubmissionArtifact(heldTopHeadline)), "utf8");
    await writeFile("backup-file.json", JSON.stringify(makeSubmissionArtifact(backupHeadline, "security")), "utf8");
    const rankedCandidates = [
      {
        candidateId: "held-top",
        beat: "infrastructure",
        headline: heldTopHeadline,
        score: 95,
        decision: "hold",
        lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "held_after_scoring", summary: "", blockingReasons: ["needs manual review"] },
        styleTested: "release_operator_consequence",
        competitorReference: null,
        whyThisStyleWasChosen: "release_operator_consequence",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["needs manual review before filing"],
        sourcePath: resolve(tempDir, "held-top.json")
      },
      {
        candidateId: "backup-file",
        beat: "security",
        headline: backupHeadline,
        score: 88,
        decision: "file",
        lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
        styleTested: "single_story_operator_angle",
        competitorReference: null,
        whyThisStyleWasChosen: "single_story_operator_angle",
        duplicateStatus: "clear",
        freshnessStatus: "clear",
        competitorCoverage: [],
        reasons: ["clear backup option"],
        sourcePath: resolve(tempDir, "backup-file.json")
      }
    ];

    await saveRankedCandidateQueue("2026-03-28", rankedCandidates, tempDir);
    const filingQueue = await buildFilingQueue("2026-03-28", rankedCandidates, tempDir);
    await saveFilingQueue(filingQueue, tempDir);

    const history = JSON.parse(
      await readFile(resolve(tempDir, "data/candidate-history/held-top.json"), "utf8")
    );
    assert.equal(history.liveOpsEvidence.replacementReview.replacementCandidateId, "backup-file");
    assert.equal(history.liveOpsEvidence.replacementReview.surfacedInTime, true);
    assert.equal(history.liveOpsEvidence.replacementReview.trigger, "held_top_candidate");
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
