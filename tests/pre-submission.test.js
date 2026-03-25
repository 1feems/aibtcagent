import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildPreSubmissionChecks,
  buildPreSubmissionIntelligence,
  persistPreSubmissionIntelligence,
  readPreSubmissionFixture
} from "../dist/intelligence/index.js";

test("pre-submission intelligence builds all required checks", async () => {
  const raw = await readPreSubmissionFixture("data/fixtures/pre-submission-intelligence.json");
  const checks = buildPreSubmissionChecks(raw);

  assert.equal(checks.dailyBriefChecked, true);
  assert.equal(checks.activityFeedChecked, true);
  assert.equal(checks.leaderboardChecked, true);
  assert.equal(checks.reputationChecked, true);
  assert.equal(checks.inboxChecked, true);
  assert.equal(checks.agentStatusChecked, true);
});

test("pre-submission intelligence persists results to state", async () => {
  const raw = await readPreSubmissionFixture("data/fixtures/pre-submission-intelligence.json");
  const intelligence = buildPreSubmissionIntelligence(raw);
  const targetPath = "data/state/test-pre-submission-output.json";

  await persistPreSubmissionIntelligence(targetPath, intelligence);

  const saved = await readFile(resolve(process.cwd(), targetPath), "utf8");
  const parsed = JSON.parse(saved);

  assert.equal(parsed.checks.inboxChecked, true);
  assert.equal(Array.isArray(parsed.notes), true);
});
