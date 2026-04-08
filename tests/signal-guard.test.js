import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { evaluateSignalGuard } from "../dist/filing/index.js";

test("signal guard stops at duplicate checks before later editorial gates", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });

    await writeFile(
      resolve(tempDir, "data/briefs/2026-04-03.md"),
      "# Brief Artifact: 2026-04-03\n\n- PR #431 adds circuit-breaker checks as nonce-timeout losses expose false-healthy relay reads\n",
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/state/filed-signals.json"),
      JSON.stringify({
        filedSignals: [
          {
            signalId: "sig-431",
            headline: "PR #431 adds circuit-breaker checks as nonce-timeout losses expose false-healthy relay reads",
            beat: "governance",
            filedAt: "2026-04-03T01:00:00Z",
            resolved: true
          }
        ]
      }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-03",
      headline: "PR #431 adds circuit-breaker checks as nonce-timeout losses expose false-healthy relay reads",
      beat_slug: "governance",
      body: "",
      sources: [],
      model_disclosure: { tools_used: [], derivation_steps: [] }
    }, tempDir);

    assert.equal(result.ok, false);
    assert.match(result.blockers[0], /already present|too close to already-filed/i);
    assert.equal(result.checks.currentBrief, "reject");
    assert.equal(result.checks.directOperatorConsequence, "skipped_due_to_duplicate");
    assert.equal(result.checks.missionAlignment, "skipped_due_to_duplicate");
    assert.equal(result.checks.valueCreating, "skipped_due_to_duplicate");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard passes a well-formed CLAIM / EVIDENCE / IMPLICATION body", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-07",
      headline: "Stacks relay sponsor nonce gap patched in PR #512",
      beat_slug: "infrastructure",
      body: "Claim: PR #512 patches a nonce-gap bug in the Stacks sponsor relay that caused silently dropped transactions.\nEvidence: PR #512 adds a fill-gap call before broadcast; block 851234 shows 0 silent drops after merge.\nImplication: Operators can avoid continued transaction loss once the fix is applied.\nDirective: update sponsor relay deployments immediately and verify gap-fill before the next production run.",
      sources: [
        { url: "https://github.com/aibtcdev/sponsor-relay/pull/512", title: "PR #512" }
      ],
      model_disclosure: { tools_used: [], derivation_steps: [] }
    }, tempDir);

    const structureBlocker = result.blockers.find((b) => /CLAIM \/ EVIDENCE \/ IMPLICATION/.test(b));
    assert.equal(structureBlocker, undefined, `Expected no structure blocker but got: ${structureBlocker}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard rejects a free-form analysis missing the approved template frameworks", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-07",
      headline: "Stacks relay sponsor nonce gap patched in PR #512",
      beat_slug: "infrastructure",
      body: "The Stacks relay sponsor had a nonce gap bug that has now been fixed. This is important for operators.",
      sources: [
        { url: "https://github.com/aibtcdev/sponsor-relay/pull/512", title: "PR #512" }
      ],
      model_disclosure: { tools_used: [], derivation_steps: [] }
    }, tempDir);

    assert.equal(result.ok, false);
    const structureBlocker = result.blockers.find((b) => /signal template/.test(b));
    assert.ok(structureBlocker, "Expected a structure blocker but none was found");
    assert.match(
      structureBlocker,
      /analysis must follow the signal template — use CLAIM \/ EVIDENCE \/ IMPLICATION \/ Directive or What changed \/ What it means \/ What to do/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signal guard reports publisher, fact-check, and format diagnostics with explicit layers", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-guard-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/editorial-memory.json"),
      JSON.stringify({ generatedAt: "2026-04-03T01:00:00.000Z", currentCycle: { reportDate: "2026-04-03" } }),
      "utf8"
    );
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-03",
      headline: "AIBTC inbox routing update changes settlement handling after security incident",
      beat_slug: "infrastructure",
      body: "Claim: AIBTC inbox routing update changes settlement handling after security incident.\nEvidence: Block 851200 shows settlement failures after routing change; PR #431 references the incident.\nImplication: Operators should check inbox payment paths and update relay configs to avoid settlement gaps.",
      sources: [
        { url: "https://github.com/aibtcdev/landing-page/releases/tag/v1.37.0", title: "Primary release note" }
      ],
      model_disclosure: {
        tools_used: [],
        derivation_steps: ["used AI"]
      }
    }, tempDir);

    assert.equal(result.ok, false);
    assert.match(result.checks.publisherQ2, /reject|skipped_due_to_duplicate/);
    assert.match(result.checks.factCheckerSourceVerification, /reject|skipped_due_to_duplicate/);
    assert.match(result.checks.helperPayloadContract, /pass|skipped_due_to_duplicate/);
    assert.ok(result.diagnostics.some((entry) => entry.layer === "publisher_q2"));
    assert.ok(result.diagnostics.some((entry) => entry.layer === "fact_check" && entry.code === "fact_check_source_verification"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
