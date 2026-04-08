// ── Filing-ready append helper tests ─────────────────────────────────────────
//
// Verifies that appendFilingReadyArtifact():
//   1. Writes a valid artifact to the expected path with an appendedVia stamp.
//   2. Throws FilingReadyValidationError (and writes NO file) when the gate fails.
//   3. Throws FilingReadyConflictError (and does NOT overwrite) when the target
//      path already exists.
//
// Tests use os.tmpdir() as baseDir so they never touch data/filing-ready/.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  appendFilingReadyArtifact,
  FilingReadyValidationError,
  FilingReadyConflictError
} from "../dist/filing/filing-ready-append.js";

// ── shared fixtures ───────────────────────────────────────────────────────────

const REPORT_DATE = "2026-04-08";
const CANDIDATE_ID = "test-candidate-001";

function makeValidArtifact(overrides = {}) {
  return {
    headline:   "PR #101 restores sBTC payment routing after relay writeback failures",
    analysis:   "Claim: PR #101 fixes the relay writeback path that stalled queued agent settlements. Evidence: GitHub PR #101 shows the writeback bug and the merged fix restoring the routing path. Implication: Agents and operators can submit queued payments without manual fallback. Directive: update relay config to enable the restored sBTC routing path from PR #101.",
    sources:    [{ url: "https://github.com/example/project/pull/101", title: "Primary proof" }],
    disclosure: "claude-sonnet-4-6, GitHub review of PR #101, live fetch of relay endpoint /api/relay/status",
    filing_gate: {
      reportDate:    REPORT_DATE,
      beat:          "infrastructure",
      headline:      "PR #101 restores sBTC payment routing after relay writeback failures",
      templateUsed:  "general-news-v1",
      testedAgainst: "2026-04-08 brief, filed-signals.json, 2-day prior brief window",
      template: {
        claim:       "PR #101 restores sBTC payment routing blocked by relay writeback failures.",
        evidence:    "GitHub PR #101 shows the writeback bug fix merged into the relay routing path.",
        implication: "Agents and operators can now submit queued payments without manual fallback routing.",
        directive:   "Update relay configuration to re-enable the sBTC routing path from PR #101."
      },
      q1: {
        result:    "pass",
        rationale: "The headline names AI agent operators using sBTC payment routing on Stacks L2.",
        testedAt:  "2026-04-08T14:30:00Z"
      },
      q2: {
        result:    "pass",
        rationale: "Disclosure names claude-sonnet-4-6 and cites GitHub PR #101 and relay endpoint directly.",
        testedAt:  "2026-04-08T14:30:00Z"
      },
      q3: {
        result:    "pass",
        rationale: "PR #101 is merged — this is a durable shipped development, not speculative.",
        testedAt:  "2026-04-08T14:30:00Z"
      },
      q4: {
        result:    "pass",
        rationale: "Restoring payment routing has a direct measurable consequence for operator settlements.",
        testedAt:  "2026-04-08T14:30:00Z"
      },
      winnerCheck: {
        sharedContext: {
          result:    "pass",
          rationale: "Checked shared-context.json — infrastructure relay beat is active and matches this signal type."
        },
        briefExamples: {
          result:    "pass",
          rationale: "Checked brief-examples.json — relay routing fix matches the brief example pattern for infrastructure beats."
        },
        signalHistory: {
          result:    "pass",
          rationale: "Checked signal-history.json — no prior headline matches PR #101 relay routing fix."
        },
        duplicateCheck: {
          result:    "no_duplicate",
          rationale: "Compared headline keywords against filed-signals.json and signal-history.json — no duplicate story shape found."
        },
        losingPattern: {
          result:    "no_match",
          rationale: "Checked losing patterns: beat_cap, approved_not_in_brief, too_narrow, external_news_no_aibtc_angle — none apply."
        },
        winnerPattern: {
          result:    "matches",
          rationale: "Matches winner pattern from shared-context.json: infrastructure relay fix with operator consequence in headline."
        },
        framingStrength: {
          result:    "pass",
          rationale: "Comparable to winning headline 'PR #98 fixes relay timeout that stalled 40% of agent payouts' from same beat."
        }
      }
    },
    ...overrides
  };
}

function makeAppendOptions(artifact, overrides = {}) {
  return {
    reportDate:       REPORT_DATE,
    candidateId:      CANDIDATE_ID,
    reviewedBy:       "human",
    reviewedAt:       "2026-04-08T15:00:00Z",
    lifecycle: {
      contract:        "source_to_signing_v1",
      phase:           "approval",
      state:           "approved_for_filing",
      summary:         "Candidate has human approval and is ready for manual wallet signing.",
      blockingReasons: []
    },
    approvalReasons:  ["cleared all gate checks"],
    operatorRationale: "Relay fix is confirmed merged and operators are unblocked.",
    sourcePath:       "data/my-signals/test-candidate-001.json",
    rawSubmission:    artifact,
    canonicalSignal:  { headline: artifact.headline, analysis: artifact.analysis },
    sendPackage:      null,
    ...overrides
  };
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Create an isolated temp base dir for each test group to avoid cross-test
// pollution.  We clean it up after the test completes.
async function withTempDir(fn) {
  const base = join(tmpdir(), `filing-ready-append-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(base, { recursive: true });
  try {
    await fn(base);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

// ── 1. happy path ─────────────────────────────────────────────────────────────

test("appendFilingReadyArtifact — valid artifact writes to expected path", async () => {
  await withTempDir(async (base) => {
    const artifact = makeValidArtifact();
    const options  = makeAppendOptions(artifact);

    const writtenPath = await appendFilingReadyArtifact(options, base);

    const expectedPath = resolve(base, `data/filing-ready/${REPORT_DATE}/${CANDIDATE_ID}.json`);
    assert.equal(writtenPath, expectedPath, "returned path must match expected location");

    // File must exist and be valid JSON.
    const raw = await readFile(writtenPath, "utf8");
    const entry = JSON.parse(raw);
    assert.equal(entry.kind, "filing_ready_submission");
    assert.equal(entry.reportDate, REPORT_DATE);
    assert.equal(entry.candidateId, CANDIDATE_ID);
  });
});

test("appendFilingReadyArtifact — written file carries appendedVia stamp", async () => {
  await withTempDir(async (base) => {
    const artifact = makeValidArtifact();
    const options  = makeAppendOptions(artifact);

    const writtenPath = await appendFilingReadyArtifact(options, base);
    const entry = JSON.parse(await readFile(writtenPath, "utf8"));

    assert.equal(
      entry.appendedVia,
      "filing-ready-append",
      "appendedVia must be 'filing-ready-append' on every written entry"
    );
  });
});

// ── 2. gate failure → validation error, no file written ──────────────────────

test("appendFilingReadyArtifact — missing filing_gate throws FilingReadyValidationError", async () => {
  await withTempDir(async (base) => {
    const artifact = clone(makeValidArtifact());
    delete artifact.filing_gate;

    const options = makeAppendOptions(artifact);

    await assert.rejects(
      () => appendFilingReadyArtifact(options, base),
      (err) => {
        assert.equal(err.name, "FilingReadyValidationError", "error must be FilingReadyValidationError");
        assert.ok(
          Array.isArray(err.blockers) && err.blockers.length > 0,
          "error must carry non-empty blockers array"
        );
        return true;
      }
    );

    // The file must NOT have been written.
    const expectedPath = resolve(base, `data/filing-ready/${REPORT_DATE}/${CANDIDATE_ID}.json`);
    await assert.rejects(
      () => readFile(expectedPath, "utf8"),
      { code: "ENOENT" },
      "file must not exist after a validation failure"
    );
  });
});

test("appendFilingReadyArtifact — Q1 fail throws FilingReadyValidationError and writes no file", async () => {
  await withTempDir(async (base) => {
    const artifact = clone(makeValidArtifact());
    artifact.filing_gate.q1.result = "fail";
    artifact.filing_gate.q1.rationale = "The signal does not name an AI-native actor explicitly in the headline.";

    const options = makeAppendOptions(artifact);

    await assert.rejects(
      () => appendFilingReadyArtifact(options, base),
      (err) => {
        assert.equal(err.name, "FilingReadyValidationError");
        assert.ok(err.blockers.some((b) => b.includes("gate_q1_failed")));
        return true;
      }
    );

    const expectedPath = resolve(base, `data/filing-ready/${REPORT_DATE}/${CANDIDATE_ID}.json`);
    await assert.rejects(() => readFile(expectedPath, "utf8"), { code: "ENOENT" });
  });
});

test("appendFilingReadyArtifact — drift language in analysis throws FilingReadyValidationError and writes no file", async () => {
  await withTempDir(async (base) => {
    const artifact = clone(makeValidArtifact());
    artifact.analysis = "This is a rough draft of the signal covering PR #101 routing fix.";

    const options = makeAppendOptions(artifact);

    await assert.rejects(
      () => appendFilingReadyArtifact(options, base),
      (err) => {
        assert.equal(err.name, "FilingReadyValidationError");
        assert.ok(err.blockers.some((b) => b.includes("gate_draft_language")));
        return true;
      }
    );

    const expectedPath = resolve(base, `data/filing-ready/${REPORT_DATE}/${CANDIDATE_ID}.json`);
    await assert.rejects(() => readFile(expectedPath, "utf8"), { code: "ENOENT" });
  });
});

// ── 3. append-only guard → conflict error, no overwrite ──────────────────────

test("appendFilingReadyArtifact — existing file throws FilingReadyConflictError", async () => {
  await withTempDir(async (base) => {
    const artifact = makeValidArtifact();
    const options  = makeAppendOptions(artifact);

    // Write once successfully.
    await appendFilingReadyArtifact(options, base);

    // A second append attempt must be rejected.
    await assert.rejects(
      () => appendFilingReadyArtifact(options, base),
      (err) => {
        assert.equal(err.name, "FilingReadyConflictError", "error must be FilingReadyConflictError");
        assert.ok(
          typeof err.targetPath === "string" && err.targetPath.length > 0,
          "error must carry the targetPath that already exists"
        );
        return true;
      }
    );
  });
});

test("appendFilingReadyArtifact — conflict guard does not overwrite existing content", async () => {
  await withTempDir(async (base) => {
    const artifact = makeValidArtifact();
    const options  = makeAppendOptions(artifact);

    // Write once successfully.
    const writtenPath = await appendFilingReadyArtifact(options, base);
    const originalContent = await readFile(writtenPath, "utf8");

    // Attempt a second append with different operatorRationale.
    const options2 = makeAppendOptions(artifact, { operatorRationale: "SHOULD NOT APPEAR IN FILE" });
    await assert.rejects(() => appendFilingReadyArtifact(options2, base));

    // Content must be unchanged.
    const contentAfter = await readFile(writtenPath, "utf8");
    assert.equal(contentAfter, originalContent, "existing file content must be unchanged after a conflict");
  });
});

// ── 4. FilingReadyValidationError carries blocker strings ─────────────────────

test("appendFilingReadyArtifact — validation error blockers match filing-gate format", async () => {
  await withTempDir(async (base) => {
    const artifact = clone(makeValidArtifact());
    delete artifact.filing_gate;

    const options = makeAppendOptions(artifact);

    let caught = null;
    try {
      await appendFilingReadyArtifact(options, base);
    } catch (err) {
      caught = err;
    }

    assert.ok(caught !== null, "expected an error to be thrown");
    assert.equal(caught.name, "FilingReadyValidationError");
    for (const blocker of caught.blockers) {
      assert.match(
        blocker,
        /hard-blocked from signable queue because filing gate check failed/,
        "each blocker must follow the standard hard-block format"
      );
    }
  });
});
