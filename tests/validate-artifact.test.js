import test from "node:test";
import assert from "node:assert/strict";
import { validateArtifact } from "../dist/filing/validate-artifact.js";

const REPORT_DATE = "2026-04-08";

function makeValidArtifact(overrides = {}) {
  const body = [
    "CLAIM: PR #101 fixes the relay writeback path that stalled queued agent settlements.",
    "EVIDENCE: GitHub PR #101 shows the writeback bug and the merged fix restoring the routing path.",
    "IMPLICATION: Agents and operators can submit queued sBTC payments without manual fallback.",
    "Directive: update relay config to enable the restored sBTC routing path from PR #101."
  ].join("\n");

  return {
    kind: "create_signal_artifact",
    status: "in_queue",
    reportDate: REPORT_DATE,
    candidateId: "test-candidate-001",
    sourcePath: "data/dry-runs/2026-04-08/test-candidate-001-submission.json",
    beat_slug: "aibtc-network",
    headline: "PR #101 restores sBTC payment routing after relay writeback failures",
    body,
    analysis: body,
    sources: [{ url: "https://github.com/example/project/pull/101", title: "Primary proof" }],
    tags: ["aibtc-network"],
    disclosure: "claude-sonnet-4-6, GitHub review of PR #101, live fetch of relay endpoint /api/relay/status",
    filing_gate: {
      reportDate: REPORT_DATE,
      beat: "aibtc-network",
      headline: "PR #101 restores sBTC payment routing after relay writeback failures",
      templateUsed: "signal-template-v1",
      testedAgainst: "data/state/editorial-memory.json, data/state/signal-history.json, data/state/brief-examples.json, data/briefs/shared-context.json",
      template: {
        claim: "PR #101 fixes the relay writeback path that stalled queued agent settlements.",
        evidence: "GitHub PR #101 shows the writeback bug and the merged fix restoring the routing path.",
        implication: "Agents and operators can submit queued sBTC payments without manual fallback.",
        directive: "Update relay config to enable the restored sBTC routing path from PR #101."
      },
      q1: {
        result: "pass",
        rationale: "The headline and body name agents, operators, sBTC, and payment routing.",
        testedAt: "2026-04-08T14:30:00Z"
      },
      q2: {
        result: "pass",
        rationale: "Disclosure names claude-sonnet-4-6, GitHub PR #101, and relay endpoint /api/relay/status.",
        testedAt: "2026-04-08T14:30:00Z"
      },
      q3: {
        result: "pass",
        rationale: "The artifact describes a merged PR #101 relay fix, not a speculative draft.",
        testedAt: "2026-04-08T14:30:00Z"
      },
      q4: {
        result: "pass",
        rationale: "Restored sBTC payment routing gives operators a measurable settlement consequence.",
        testedAt: "2026-04-08T14:30:00Z"
      },
      winnerCheck: {
        sharedContext: {
          result: "pass",
          rationale: "Checked data/briefs/shared-context.json and compared against brief title 'Relay fix restores agent payouts'."
        },
        briefExamples: {
          result: "pass",
          rationale: "Checked data/state/brief-examples.json and compared to brief example 'PR #98 restores relay routing'."
        },
        signalHistory: {
          result: "pass",
          rationale: "Checked data/state/signal-history.json across 14 filed entries before creating this artifact."
        },
        duplicateCheck: {
          result: "no_duplicate",
          rationale: "Compared against data/state/signal-history.json and found no duplicate story shape."
        },
        losingPattern: {
          result: "no_match",
          rationale: "Checked losing patterns in data/state/brief-examples.json and found no approved_not_in_brief overlap."
        },
        winnerPattern: {
          result: "matches",
          rationale: "Matches same-beat winner pattern from data/state/brief-examples.json: 'PR #98 restores relay routing'."
        },
        framingStrength: {
          result: "pass",
          rationale: "Compared headline framing against 'PR #98 restores relay routing' and preserved an exact anchor."
        }
      }
    },
    ...overrides
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("validateArtifact accepts canonical create-signal artifacts", () => {
  const result = validateArtifact(makeValidArtifact());
  assert.equal(result.ok, true, result.issues.map((issue) => issue.reason).join("; "));
});

test("validateArtifact rejects weak headlines without exact anchors", () => {
  const artifact = clone(makeValidArtifact());
  artifact.headline = "Relay routing is improved for agent operators";
  artifact.filing_gate.headline = artifact.headline;
  const result = validateArtifact(artifact);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "artifact_headline_missing_anchor"));
});

test("validateArtifact rejects Q1 failures", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.q1.result = "fail";
  artifact.filing_gate.q1.rationale = "The signal does not connect AI-native actors to Bitcoin operator flow.";
  const result = validateArtifact(artifact);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "gate_q1_failed"));
});

test("validateArtifact rejects plain string sources", () => {
  const artifact = clone(makeValidArtifact());
  artifact.sources = ["https://github.com/example/project/pull/101"];
  const result = validateArtifact(artifact);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "artifact_source_string_not_allowed"));
});

test("validateArtifact rejects explicitly non-fileable intermediate candidates", () => {
  const artifact = clone(makeValidArtifact());
  artifact.kind = "intermediate_candidate_artifact";
  artifact.non_fileable = true;
  artifact.fileable = false;
  artifact.intended_use = "ranking_only";
  const result = validateArtifact(artifact);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "artifact_non_fileable_intermediate"));
});
