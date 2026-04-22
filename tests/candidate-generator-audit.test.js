import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { materializeGeneratedCandidates } from "../dist/prep/candidate-generator.js";

test("materializeGeneratedCandidates emits canonical CLAIM/EVIDENCE/IMPLICATION analysis and audit log", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-candidate-audit-"));
  try {
    await mkdir(resolve(tempDir, "data/dry-runs/2026-04-15"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/dry-runs/2026-04-15/cand-1-submission.json"),
      JSON.stringify({
        candidate_signal: {
          candidate_id: "cand-1",
          beat: "infrastructure",
          significance: "PR #431 tightens relay recovery for operators.",
          causality: "Issue #363 documents the nonce-timeout failure mode."
        },
        headline: "PR #431 tightens relay recovery after Issue #363 exposed nonce-timeout failures",
        sources: [
          {
            source_url: "https://github.com/aibtcdev/x402-sponsor-relay/pull/431",
            source_name: "PR #431"
          }
        ],
        model_disclosure: {
          tools_used: ["query"],
          derivation_steps: ["reviewed PR #431"]
        },
        submission_decision: { status: "submit" },
        editorial_review: { ready_to_file: true }
      }, null, 2),
      "utf8"
    );

    const result = await materializeGeneratedCandidates("2026-04-15", tempDir);
    assert.equal(result.written.length, 1);
    const source = JSON.parse(await readFile(resolve(tempDir, "data/dry-runs/2026-04-15/cand-1-submission.json"), "utf8"));
    assert.equal(source.non_fileable, true);
    assert.equal(source.fileable, false);
    assert.equal(source.intended_use, "ranking_only");
    const artifact = JSON.parse(await readFile(result.written[0], "utf8"));
    assert.equal(artifact.kind, "create_signal_artifact");
    assert.equal(artifact.status, "in_queue");
    assert.match(artifact.analysis, /^CLAIM:/m);
    assert.match(artifact.analysis, /^EVIDENCE:/m);
    assert.match(artifact.analysis, /^IMPLICATION:/m);
    const log = JSON.parse(await readFile(resolve(tempDir, "logs/candidate-cand-1.json"), "utf8"));
    assert.equal(log.score >= 4, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
