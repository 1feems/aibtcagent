// ── Filing gate validator regression tests ───────────────────────────────────
//
// Verifies that validateFilingGate() hard-blocks any signal that:
//   1. Lacks Q1–Q4 pass (a failed check is itself a hard-block)
//   2. Lacks an exact headline anchor (PR#, version, metric, error code, path)
//   3. Lacks a directive in the template block
//   4. Lacks the testedAgainst field
//   5. Duplicates an existing story shape (winnerCheck.duplicateCheck = duplicate_found)
//   6. Is missing structured template fields (freeform note instead of object)
//   7. Includes disallowed drift language in analysis or template fields
//
// Also verifies that a fully-valid artifact passes with no issues.

import test from "node:test";
import assert from "node:assert/strict";
import {
  validateFilingGate,
  filingGateIssuesToBlockers
} from "../dist/filing/filing-gate-validator.js";

// ── shared base fixture ───────────────────────────────────────────────────────
// Returns a deep-cloned, fully-valid source artifact each call so individual
// tests can mutate their copy without affecting others.

function makeValidArtifact(overrides = {}) {
  return {
    headline:   "PR #101 restores sBTC payment routing after relay writeback failures",
    analysis:   "Claim: PR #101 fixes the relay writeback path that stalled queued agent settlements. Evidence: GitHub PR #101 shows the writeback bug and the merged fix restoring the routing path. Implication: Agents and operators can submit queued payments without manual fallback. Directive: update relay config to enable the restored sBTC routing path from PR #101.",
    sources:    [{ url: "https://github.com/example/project/pull/101", title: "Primary proof" }],
    disclosure: "claude-sonnet-4-6, GitHub review of PR #101, live fetch of relay endpoint /api/relay/status",
    filing_gate: {
      reportDate:    "2026-04-07",
      beat:          "infrastructure",
      headline:      "PR #101 restores sBTC payment routing after relay writeback failures",
      templateUsed:  "general-news-v1",
      testedAgainst: "2026-04-07 brief, filed-signals.json, 2-day prior brief window",
      template: {
        claim:       "PR #101 restores sBTC payment routing blocked by relay writeback failures.",
        evidence:    "GitHub PR #101 shows the writeback bug fix merged into the relay routing path.",
        implication: "Agents and operators can now submit queued payments without manual fallback routing.",
        directive:   "Update relay configuration to re-enable the sBTC routing path from PR #101."
      },
      q1: {
        result:    "pass",
        rationale: "The headline names AI agent operators using sBTC payment routing on Stacks L2.",
        testedAt:  "2026-04-07T14:30:00Z"
      },
      q2: {
        result:    "pass",
        rationale: "Disclosure names claude-sonnet-4-6 and cites GitHub PR #101 and relay endpoint directly.",
        testedAt:  "2026-04-07T14:30:00Z"
      },
      q3: {
        result:    "pass",
        rationale: "PR #101 is merged — this is a durable shipped development, not speculative.",
        testedAt:  "2026-04-07T14:30:00Z"
      },
      q4: {
        result:    "pass",
        rationale: "Restoring payment routing has a direct measurable consequence for operator settlements.",
        testedAt:  "2026-04-07T14:30:00Z"
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
      },
      contextAudit: {
        briefReview: {
          result: "pass",
          rationale: "Reviewed data/briefs/2026-04-07.md before drafting and checked the latest brief title for infrastructure fit.",
          contextLoaded: true,
          complianceVerified: true
        },
        beatEditorReview: {
          result: "pass",
          rationale: "Reviewed docs/beat-editors/aibtc-network-skill.md beat editor guidance before drafting.",
          contextLoaded: true,
          complianceVerified: true
        },
        helperErrorsReview: {
          result: "pass",
          rationale: "Reviewed data/state/helper-errors.jsonl and checked the latest template issue before emitting helper-ready JSON.",
          contextLoaded: true,
          complianceVerified: true
        },
        outcomeReview: {
          result: "pass",
          rationale: "Reviewed data/state/signal-history.json and approvals outcome records before drafting this filing candidate.",
          contextLoaded: true,
          complianceVerified: true
        },
        publisherNotesReview: {
          result: "pass",
          rationale: "Reviewed same-beat publisher feedback and rejection notes in signal-history.json before drafting.",
          contextLoaded: true,
          complianceVerified: true
        }
      }
    },
    ...overrides
  };
}

// Deep-clone so tests can mutate freely
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── helper ────────────────────────────────────────────────────────────────────

function issueCode(result, code) {
  return result.issues.some((i) => i.code === code);
}

function blockerContains(result, substring) {
  const blockers = filingGateIssuesToBlockers(result.issues);
  return blockers.some((b) => b.includes(substring));
}

// ── 0. baseline: fully-valid artifact passes ──────────────────────────────────

test("filing gate validator — valid artifact passes with no issues", () => {
  const artifact = makeValidArtifact();
  const result = validateFilingGate(artifact);

  assert.deepEqual(result.issues, [], `Expected no issues, got: ${JSON.stringify(result.issues, null, 2)}`);
  assert.ok(result.gate !== null, "gate should be non-null for a valid artifact");
  assert.equal(result.gate.reportDate, "2026-04-07");
  assert.equal(result.gate.beat, "infrastructure");
});

// ── 1. Lacks Q1–Q4 pass ───────────────────────────────────────────────────────

test("filing gate validator — Q1 result=fail is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.q1.result = "fail";
  artifact.filing_gate.q1.rationale = "The signal does not name an AI-native actor explicitly in the headline.";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null, "gate must be null when Q1 fails");
  assert.ok(issueCode(result, "gate_q1_failed"), `Expected gate_q1_failed, got codes: ${result.issues.map(i=>i.code)}`);
  assert.ok(blockerContains(result, "gate_q1_failed"), "blocker string must reference gate_q1_failed");
});

test("filing gate validator — Q2 result=fail is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.q2.result = "fail";
  artifact.filing_gate.q2.rationale = "Disclosure only says 'used AI' without naming a specific model or tool.";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(issueCode(result, "gate_q2_failed"), `Expected gate_q2_failed, got: ${result.issues.map(i=>i.code)}`);
});

test("filing gate validator — Q3 result=fail is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.q3.result = "fail";
  artifact.filing_gate.q3.rationale = "The described change is still proposed, not merged or deployed.";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(issueCode(result, "gate_q3_failed"), `Expected gate_q3_failed, got: ${result.issues.map(i=>i.code)}`);
});

test("filing gate validator — Q4 result=fail is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.q4.result = "fail";
  artifact.filing_gate.q4.rationale = "Signal only raises awareness, no measurable operator consequence stated.";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(issueCode(result, "gate_q4_failed"), `Expected gate_q4_failed, got: ${result.issues.map(i=>i.code)}`);
});

test("filing gate validator — missing Q1 block is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate.q1;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(issueCode(result, "gate_q1_missing"), `Expected gate_q1_missing, got: ${result.issues.map(i=>i.code)}`);
});

test("filing gate validator — Q check with trivial rationale is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.q1.rationale = "yes";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(issueCode(result, "gate_q1_trivial_rationale"), `Expected gate_q1_trivial_rationale, got: ${result.issues.map(i=>i.code)}`);
});

test("filing gate validator — Q check missing testedAt is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate.q2.testedAt;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(issueCode(result, "gate_q2_missing_tested_at"), `Expected gate_q2_missing_tested_at, got: ${result.issues.map(i=>i.code)}`);
});

// ── 2. Lacks exact headline anchor ───────────────────────────────────────────

test("filing gate validator — headline with no anchor is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  const anchorlessHeadline = "Relay routing has been restored and operators can now submit payments again";
  artifact.filing_gate.headline = anchorlessHeadline;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_headline_no_anchor"),
    `Expected gate_headline_no_anchor, got: ${result.issues.map(i=>i.code)}`
  );
  assert.ok(blockerContains(result, "gate_headline_no_anchor"));
});

test("filing gate validator — headline with a version number passes anchor check", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.headline = "v2.3.1 relay update restores sBTC payment routing after writeback failures";

  const result = validateFilingGate(artifact);

  assert.ok(!issueCode(result, "gate_headline_no_anchor"), "version anchor should satisfy the check");
});

test("filing gate validator — headline with a metric passes anchor check", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.headline = "42 agent settlements unblocked after relay writeback failure is patched";

  const result = validateFilingGate(artifact);

  assert.ok(!issueCode(result, "gate_headline_no_anchor"), "count metric should satisfy the check");
});

test("filing gate validator — headline with an API path passes anchor check", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.headline = "GET /api/relay/status now returns healthy after writeback fix is deployed";

  const result = validateFilingGate(artifact);

  assert.ok(!issueCode(result, "gate_headline_no_anchor"), "API path should satisfy the check");
});

// ── 3. Lacks a directive ─────────────────────────────────────────────────────

test("filing gate validator — missing template.directive is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate.template.directive;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_template_missing_directive"),
    `Expected gate_template_missing_directive, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — missing contextAudit is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate.contextAudit;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_context_audit_missing"),
    `Expected gate_context_audit_missing, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — trivially short directive is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.template.directive = "update";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_template_trivial_directive"),
    `Expected gate_template_trivial_directive, got: ${result.issues.map(i=>i.code)}`
  );
});

// ── 4. Lacks tested-against fields ───────────────────────────────────────────

test("filing gate validator — empty testedAgainst is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.testedAgainst = "";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_missing_tested_against"),
    `Expected gate_missing_tested_against, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — missing testedAgainst key is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate.testedAgainst;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_missing_tested_against"),
    `Expected gate_missing_tested_against, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — Q check testedAt with wrong format is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.q3.testedAt = "2026-04-07"; // date-only, missing time

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_q3_invalid_tested_at"),
    `Expected gate_q3_invalid_tested_at, got: ${result.issues.map(i=>i.code)}`
  );
});

// ── 5. Duplicates an existing story shape ────────────────────────────────────

test("filing gate validator — winnerCheck duplicateCheck=duplicate_found is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.winnerCheck.duplicateCheck.result = "duplicate_found";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_winner_duplicate_check_failed"),
    `Expected gate_winner_duplicate_check_failed, got: ${result.issues.map(i=>i.code)}`
  );
  assert.ok(blockerContains(result, "duplicate_found"), "blocker message must name the duplicate_found result");
});

test("filing gate validator — missing winnerCheck block is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate.winnerCheck;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_winner_check_missing"),
    `Expected gate_winner_check_missing, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — winnerPattern=no_match is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.winnerCheck.winnerPattern.result = "no_match";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_winner_pattern_match_failed"),
    `Expected gate_winner_pattern_match_failed, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — losingPattern=match_found is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.winnerCheck.losingPattern.result = "match_found";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_winner_losing_pattern_failed"),
    `Expected gate_winner_losing_pattern_failed, got: ${result.issues.map(i=>i.code)}`
  );
});

// ── 6. Missing structured template fields ────────────────────────────────────

test("filing gate validator — freeform string template is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.template = "This signal covers PR #101 which fixes the relay routing issue.";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_template_freeform"),
    `Expected gate_template_freeform, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — template with only a note key is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.template = {
    note: "PR #101 restores routing — operators unblocked."
  };

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_template_note_not_structured"),
    `Expected gate_template_note_not_structured, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — missing template block is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate.template;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_template_missing"),
    `Expected gate_template_missing, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — missing template.claim is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate.template.claim;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_template_missing_claim"),
    `Expected gate_template_missing_claim, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — missing template.evidence is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate.template.evidence;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_template_missing_evidence"),
    `Expected gate_template_missing_evidence, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — missing template.implication is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate.template.implication;

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_template_missing_implication"),
    `Expected gate_template_missing_implication, got: ${result.issues.map(i=>i.code)}`
  );
});

// ── 7. Includes disallowed drift language ────────────────────────────────────

test("filing gate validator — 'draft' in analysis is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.analysis = "This is a rough draft of the signal covering PR #101 routing fix.";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  // Both "rough" and "draft" are disallowed; the first match wins
  const driftCodes = result.issues.filter(i => i.code === "gate_draft_language");
  assert.ok(driftCodes.length > 0, `Expected gate_draft_language in analysis, got: ${result.issues.map(i=>i.code)}`);
  assert.ok(driftCodes.some(i => i.field === "analysis"), "issue field must point to 'analysis'");
});

test("filing gate validator — 'placeholder' in template.claim is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.template.claim = "Placeholder claim for the PR #101 relay routing restoration.";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  const driftIssue = result.issues.find(i => i.code === "gate_draft_language" && i.field === "filing_gate.template.claim");
  assert.ok(driftIssue !== undefined, `Expected gate_draft_language on template.claim, got: ${JSON.stringify(result.issues)}`);
});

test("filing gate validator — 'probably' in template.directive is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.template.directive = "Operators should probably update relay config to use PR #101 routing.";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  const driftIssue = result.issues.find(i => i.code === "gate_draft_language" && i.field === "filing_gate.template.directive");
  assert.ok(driftIssue !== undefined, `Expected gate_draft_language on template.directive, got: ${JSON.stringify(result.issues)}`);
});

test("filing gate validator — 'todo' in template.implication is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.template.implication = "TODO: explain what this means for agent payouts and operator settlements.";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  const driftIssue = result.issues.find(i => i.code === "gate_draft_language" && i.field === "filing_gate.template.implication");
  assert.ok(driftIssue !== undefined, `Expected gate_draft_language on template.implication, got: ${JSON.stringify(result.issues)}`);
});

test("filing gate validator — 'speculative' in headline is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.filing_gate.headline = "PR #101 may offer speculative fix for sBTC relay writeback failures";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  const driftIssue = result.issues.find(i => i.code === "gate_draft_language" && i.field === "filing_gate.headline");
  assert.ok(driftIssue !== undefined, `Expected gate_draft_language on headline, got: ${JSON.stringify(result.issues)}`);
});

// ── 8. Missing filing_gate block entirely ────────────────────────────────────

test("filing gate validator — missing filing_gate block is a hard block", () => {
  const artifact = {
    headline:   "PR #101 restores sBTC payment routing",
    analysis:   "Analysis text covering the routing restoration.",
    sources:    [{ url: "https://github.com/example/project/pull/101" }],
    disclosure: "claude-sonnet-4-6, GitHub review of PR #101"
  };

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_block_missing"),
    `Expected gate_block_missing, got: ${result.issues.map(i=>i.code)}`
  );
});

// ── 9. Sources and disclosure checks ─────────────────────────────────────────

test("filing gate validator — no sources is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.sources = [];

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_sources_missing"),
    `Expected gate_sources_missing, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — non-http source URL is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.sources = [{ url: "github.com/example/project/pull/101" }];

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_sources_not_concrete"),
    `Expected gate_sources_not_concrete, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — vague disclosure ('used ai') is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.disclosure = "Used AI to analyze the routing issue and write the signal body.";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_disclosure_vague"),
    `Expected gate_disclosure_vague, got: ${result.issues.map(i=>i.code)}`
  );
});

test("filing gate validator — missing disclosure is a hard block", () => {
  const artifact = clone(makeValidArtifact());
  artifact.disclosure = "";

  const result = validateFilingGate(artifact);

  assert.ok(result.gate === null);
  assert.ok(
    issueCode(result, "gate_disclosure_missing"),
    `Expected gate_disclosure_missing, got: ${result.issues.map(i=>i.code)}`
  );
});

// ── 10. filingGateIssuesToBlockers format ─────────────────────────────────────

test("filingGateIssuesToBlockers — each issue becomes a hard-block string with code", () => {
  const artifact = clone(makeValidArtifact());
  delete artifact.filing_gate;

  const result = validateFilingGate(artifact);
  const blockers = filingGateIssuesToBlockers(result.issues);

  assert.ok(blockers.length > 0, "expected at least one blocker");
  for (const blocker of blockers) {
    assert.match(blocker, /hard-blocked from signable queue because filing gate check failed/);
  }
});

test("filing gate validator — metric claims cannot use homepage-level sources", () => {
  const artifact = clone(makeValidArtifact());
  artifact.headline = "Leaderboard shows 882 agents and 545,326 check-ins";
  artifact.analysis = "CLAIM: Leaderboard shows 882 agents and 545,326 check-ins. EVIDENCE: The project homepage reports the values. IMPLICATION: Operators should compare network density before routing.";
  artifact.sources = [{ url: "https://github.com/aibtcdev/aibtc", title: "repository root" }];

  const result = validateFilingGate(artifact);
  assert.ok(issueCode(result, "gate_homepage_metric_source"), `Expected gate_homepage_metric_source, got: ${result.issues.map(i=>i.code)}`);
});

test("filing gate validator — closed PRs cannot prove shipped changes", () => {
  const artifact = clone(makeValidArtifact());
  artifact.headline = "PR #755 closes relay payout fix after 42 failed sBTC settlements";
  artifact.analysis = "CLAIM: PR #755 closes a relay payout fix after 42 failed sBTC settlements. EVIDENCE: GitHub says PR #755 is closed. IMPLICATION: Operators should wait for merged state.";
  artifact.sources = [{ url: "https://github.com/aibtcdev/sponsor-relay/pull/755", title: "closed PR #755" }];

  const result = validateFilingGate(artifact);
  assert.ok(issueCode(result, "gate_closed_pr_as_proof"), `Expected gate_closed_pr_as_proof, got: ${result.issues.map(i=>i.code)}`);
});

test("filing gate validator — quantum proposal-thread-only and saturated clusters are hard blocks", () => {
  const artifact = clone(makeValidArtifact());
  artifact.beat_slug = "quantum";
  artifact.filing_gate.beat = "quantum";
  artifact.headline = "BIP-361 sets 160k-block Bitcoin migration window for legacy ECDSA exposure";
  artifact.analysis = "CLAIM: BIP-361 sets a 160k-block Bitcoin migration window for legacy ECDSA exposure. EVIDENCE: The proposal thread describes the migration window. IMPLICATION: Wallet teams should monitor migration timing.";
  artifact.sources = [{ url: "https://delvingbitcoin.org/t/commit-reveal-for-pq-migration/2419", title: "proposal thread" }];

  const result = validateFilingGate(artifact);
  assert.ok(issueCode(result, "gate_quantum_proposal_thread_only"), `Expected gate_quantum_proposal_thread_only, got: ${result.issues.map(i=>i.code)}`);
  assert.ok(issueCode(result, "gate_quantum_saturated_cluster"), `Expected gate_quantum_saturated_cluster, got: ${result.issues.map(i=>i.code)}`);
});

test("filing gate validator — duplicate source clusters and bodies above 900 chars are hard blocks", () => {
  const artifact = clone(makeValidArtifact());
  artifact.analysis = `${artifact.analysis} ${"extra operator detail".repeat(80)}`;
  artifact.sources = [
    { url: "https://mempool.space/api/v1/fees/recommended", title: "fees" },
    { url: "https://mempool.space/api/v1/fees/recommended#latest", title: "fees duplicate" }
  ];

  const result = validateFilingGate(artifact);
  assert.ok(issueCode(result, "gate_duplicate_same_day_source_cluster"), `Expected gate_duplicate_same_day_source_cluster, got: ${result.issues.map(i=>i.code)}`);
  assert.ok(issueCode(result, "gate_body_above_900_chars"), `Expected gate_body_above_900_chars, got: ${result.issues.map(i=>i.code)}`);
});
