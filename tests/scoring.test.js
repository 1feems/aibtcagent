import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  rankDryRunCandidates,
  saveRankedCandidateQueue
} from "../dist/scoring/index.js";

test("candidate queue ranks stronger submissions above weak ones", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-28", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-03-28.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-28",
        generatedAt: "2026-03-28T00:00:00Z",
        beatPreferences: [
          {
            beat: "infrastructure",
            detections: 1,
            submissions: 1,
            approvals: 1,
            published: 1,
            duplicateLosses: 0,
            approvalRate: 1,
            publicationRate: 1,
            preference: "increase",
            rationale: "Published wins landed."
          }
        ],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-28/strong-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "strong",
          beat: "infrastructure",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "an early same day signal before broader visibility"
        },
        headline: "Strong infrastructure story before competitors catch up",
        submission_decision: { status: "submit", rejection_reasons: [] },
        editorial_review: {
          editorial_fit: "strong",
          publisher_confidence: "high",
          ready_to_file: true,
          hold_reasons: []
        }
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-28/weak-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "weak",
          beat: "infrastructure",
          likely_duplicate: true,
          uses_dashboard_as_primary_source: true,
          significance: "routine update"
        },
        headline: "Weak dashboard update",
        submission_decision: { status: "reject", rejection_reasons: ["proof_missing"] },
        editorial_review: {
          editorial_fit: "weak",
          publisher_confidence: "low",
          ready_to_file: false,
          hold_reasons: ["publisher_gate_failed"]
        }
      }),
      "utf8"
    );

    const ranked = await rankDryRunCandidates("2026-03-28");
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].candidateId, "strong");
    assert.equal(ranked[0].decision, "file");
    assert.equal(ranked[1].candidateId, "weak");
    assert.equal(ranked[1].decision, "reject");

    const queuePath = await saveRankedCandidateQueue("2026-03-28", ranked);
    const queue = JSON.parse(await readFile(queuePath, "utf8"));
    assert.equal(queue.kind, "ranked_candidate_queue");
    assert.equal(queue.candidates[0].candidateId, "strong");
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
