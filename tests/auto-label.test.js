import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { autoLabelResolvedOutcomes } from "../dist/learning/index.js";

test("auto-labeler appends resolved outcomes into training memory", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-autolabel-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/outcomes/approvals", { recursive: true });
    await mkdir("data/logs/accepted", { recursive: true });

    await writeFile(
      "data/outcomes/approvals/example.json",
      JSON.stringify({
        kind: "approval_outcome",
        recordedAt: "2026-03-28T12:00:00Z",
        candidateId: "example-candidate",
        approved: true,
        published: true,
        note: "approved and published in compiled brief"
      }),
      "utf8"
    );

    await writeFile(
      "data/logs/accepted/example-candidate.json",
      JSON.stringify({
        kind: "accepted_submission",
        recordedAt: "2026-03-28T11:00:00Z",
        candidateId: "example-candidate",
        submission: {
          candidateSignal: {
            beat: "infrastructure"
          },
          headline: "Example candidate wins the brief"
        }
      }),
      "utf8"
    );

    const result = await autoLabelResolvedOutcomes();
    assert.equal(result.labeledCount, 1);

    const labeled = await readFile("data/training/in-brief.jsonl", "utf8");
    assert.match(labeled, /Example candidate wins the brief/);

    const state = JSON.parse(await readFile("data/state/auto-labeled-outcomes.json", "utf8"));
    assert.deepEqual(state.labeledCandidateIds, ["example-candidate"]);
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
