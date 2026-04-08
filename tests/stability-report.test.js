import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  generateDailyStabilityReport,
  saveDailyStabilityReport
} from "../dist/ops/index.js";

test("stability report summarizes top-pick quality and operator-role recommendation", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-stability-"));

  try {
    await mkdir(resolve(tempDir, "data/queues"), { recursive: true });
    await mkdir(resolve(tempDir, "data/outcomes/approvals"), { recursive: true });
    await mkdir(resolve(tempDir, "data/training"), { recursive: true });
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });

    await writeFile(
      resolve(tempDir, "data/queues/2026-03-28.json"),
      JSON.stringify({
        reportDate: "2026-03-28",
        candidates: [
          { candidateId: "cand-a", score: 81, decision: "file", headline: "A", reasons: [] }
        ]
      }),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/queues/2026-03-29.json"),
      JSON.stringify({
        reportDate: "2026-03-29",
        candidates: [
          { candidateId: "cand-b", score: 84, decision: "file", headline: "B", reasons: [] }
        ]
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/outcomes/approvals/cand-a.json"),
      JSON.stringify({
        kind: "approval_outcome",
        recordedAt: "2026-03-28T12:00:00Z",
        candidateId: "cand-a",
        approved: true,
        published: true,
        note: "approved"
      }),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/outcomes/approvals/cand-b.json"),
      JSON.stringify({
        kind: "approval_outcome",
        recordedAt: "2026-03-29T12:00:00Z",
        candidateId: "cand-b",
        approved: false,
        published: false,
        note: "rejected"
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/training/approved-not-in-brief.jsonl"),
      `${JSON.stringify({ reason_tags: ["approved_live_outcome"] })}\n`,
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/training/in-brief.jsonl"),
      `${JSON.stringify({ reason_tags: ["published_live_outcome", "brief_slot_winner"] })}\n`,
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/state/agent-runtime.json"),
      JSON.stringify({
        kind: "agent_runtime_history",
        updatedAt: "2026-03-29T06:15:00Z",
        runs: [
          { reportDate: "2026-03-29", eventName: "schedule" },
          { reportDate: "2026-03-28", eventName: "schedule" }
        ]
      }),
      "utf8"
    );

    const report = await generateDailyStabilityReport("2026-03-29", tempDir);
    assert.equal(report.breakdown.length, 2);
    assert.equal(report.reportDate, "2026-03-29");
    assert.equal(report.evidence.analyzedDays, 2);
    assert.equal(report.scheduler.consecutiveDailyRuns, 2);
    assert.equal(report.totals.approvalRate, 0.5);
    assert.equal(report.totals.publicationRate, 0.5);
    assert.equal(report.totals.falsePositiveTopPickRate, 0.5);
    assert.equal(report.recommendation.roleMode, "manual_coaching");
    assert.match(report.recommendation.reasons.join(" "), /Need at least 5 analyzed days/);

    const paths = await saveDailyStabilityReport(report, tempDir);
    const saved = JSON.parse(await readFile(paths.jsonPath, "utf8"));
    assert.equal(saved.kind, "daily_stability_report");
    const markdown = await readFile(paths.markdownPath, "utf8");
    assert.match(markdown, /Approval rate: 0.5/);
    assert.match(markdown, /Scheduler consecutive daily runs: 2/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
