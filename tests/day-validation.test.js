import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateDayValidationReport } from "../dist/ops/index.js";

test("day validation replay confirms April 2 stayed usable and April 3 now has explicit trusted-slate outcomes", { concurrency: false }, async () => {
  const { outputPath, summary } = await generateDayValidationReport(
    "/Users/feems/Desktop/aibtcagent-workspace/aibtcagent"
  );

  assert.equal(summary.april2.submittedCount >= 5, true);
  assert.equal(summary.april3.leaderboardNotCheckedCount, 15);
  assert.equal(summary.april3.sendReadyCount >= 1, true);
  assert.equal(summary.april3.blockedReadyCount >= 1, true);
  assert.equal(summary.conclusion.april2StillWorks, true);
  assert.equal(summary.conclusion.april3NoLongerOpaque, true);

  const report = await readFile(resolve(outputPath), "utf8");
  assert.match(report, /April 2 still works: yes/i);
  assert.match(report, /April 3 no longer collapses into opaque over-rejection: yes/i);
});
