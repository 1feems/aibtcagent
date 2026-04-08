import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  refreshBriefExamplesMemory,
  refreshSnapshotMemory
} from "../dist/learning/index.js";

test("same-day approval outcomes feed brief examples and snapshot lessons automatically", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-outcome-ingestion-"));

  try {
    await mkdir(resolve(tempDir, "data/outcomes/approvals"), { recursive: true });
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/training"), { recursive: true });

    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(resolve(tempDir, "data/training/in-brief.jsonl"), JSON.stringify({ headline: "winner", reason_tags: ["broad_package"] }) + "\n", "utf8");
    await writeFile(resolve(tempDir, "data/training/rejected.jsonl"), JSON.stringify({ headline: "loss", reason_tags: ["stat_dump"] }) + "\n", "utf8");

    await writeFile(
      resolve(tempDir, "data/outcomes/approvals/published.json"),
      JSON.stringify({
        kind: "approval_outcome",
        recordedAt: "2026-04-04T02:00:00Z",
        approved: true,
        published: true,
        headline: "Published winner from outcomes",
        beat: "Governance",
        note: "Selected for brief"
      }),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/outcomes/approvals/rejected.json"),
      JSON.stringify({
        kind: "approval_outcome",
        recordedAt: "2026-04-04T03:00:00Z",
        approved: false,
        published: false,
        failureMode: "rejected",
        headline: "Rejected loser from outcomes",
        beat: "Security",
        note: "rejected by editorial review",
        learningWhy: "Rejected by editorial review for weak evidence."
      }),
      "utf8"
    );

    const examples = await refreshBriefExamplesMemory(tempDir);
    const snapshots = await refreshSnapshotMemory(tempDir);

    assert.ok(examples.recentWinners.some((entry) => entry.headline === "Published winner from outcomes"));
    assert.ok(examples.recentLosses.some((entry) => entry.headline === "Rejected loser from outcomes"));
    assert.ok(snapshots.lessons.some((lesson) => /made brief today/i.test(lesson.text)));
    assert.ok(snapshots.lessons.some((lesson) => /rejected by editorial review/i.test(lesson.text)));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
