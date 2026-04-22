import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runAuditedSignalLoopPhase } from "../dist/agent/run-signal-loop.js";

test("runAuditedSignalLoopPhase retries once when the first audited pass produces no strong candidates", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signal-loop-audit-"));
  const originalCwd = process.cwd();
  let signalJobCalls = 0;
  let replenishCalls = 0;

  try {
    process.chdir(tempDir);
    const result = await runAuditedSignalLoopPhase(
      {
        reportDate: "2026-04-15",
        generatedAt: "2026-04-15T00:00:00Z"
      },
      {
        runSignalJobPhase: async (_reportDate, generatedAt) => {
          signalJobCalls += 1;
          return {
            skipped: false,
            outputPath: `data/reports/signals/${generatedAt}.md`
          };
        },
        replenishPhase: async () => {
          replenishCalls += 1;
          if (replenishCalls === 1) {
            return {
              filingQueue: { items: [{ queueStatus: "on_hold" }] },
              replenishmentPassesRun: 1
            };
          }
          return {
            filingQueue: { items: [{ queueStatus: "awaiting_human_approval" }] },
            replenishmentPassesRun: 2
          };
        }
      }
    );

    assert.equal(signalJobCalls, 2);
    assert.equal(replenishCalls, 2);
    assert.equal(result.strongCandidates, 1);
    const log = JSON.parse(await readFile(resolve(tempDir, "logs/signal-loop-2026-04-15.json"), "utf8"));
    assert.equal(log.iteration, 2);
    assert.equal(log.score >= 4, true);
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
