import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  fetchAndCacheQuantumMapSnapshot,
  readQuantumTrackerState,
  saveQuantumTrackerState,
  trackQuantumFiledSignal
} from "../dist/filing/index.js";
import { generateQuantumWeeklySynthesis } from "../dist/reporting/index.js";

test("quantum map snapshot falls back to local dataset and records reconciliation mismatches", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-quantum-"));
  const previousPrimary = process.env.AIBTC_QUANTUM_MAP_PRIMARY_URL;
  const previousFallback = process.env.AIBTC_QUANTUM_MAP_FALLBACK_URL;
  const previousLocal = process.env.AIBTC_QUANTUM_MAP_LOCAL_DATASET_PATH;

  process.env.AIBTC_QUANTUM_MAP_PRIMARY_URL = "http://127.0.0.1:1/unreachable-primary.json";
  process.env.AIBTC_QUANTUM_MAP_FALLBACK_URL = "http://127.0.0.1:1/unreachable-fallback.json";
  process.env.AIBTC_QUANTUM_MAP_LOCAL_DATASET_PATH = resolve(tempDir, "local-data.json");

  try {
    await writeFile(
      resolve(tempDir, "local-data.json"),
      JSON.stringify({
        metadata: {
          date: "2026-04-06",
          version: "2.2",
          total_assessed: 2,
          quantum_readiness_index: {
            voiced_urgency: {
              score: 62,
              weighted_sum: 9
            },
            coverage: {
              score: 50,
              voiced: 1,
              silent: 1
            },
            composite_readiness: {
              score: 31
            }
          }
        },
        developers: [
          {
            name: "Neha Narula",
            quantum_urgency_score: 4,
            summary: "updated",
            key_source: "https://example.com/neha",
            sources: ["https://example.com/neha"]
          },
          {
            name: "Jonas Nick",
            quantum_urgency_score: 2,
            summary: "tracked",
            key_source: "https://example.com/jonas",
            sources: ["https://example.com/jonas"]
          }
        ]
      }, null, 2),
      "utf8"
    );

    const snapshot = await fetchAndCacheQuantumMapSnapshot({
      baseDir: tempDir,
      fetchedAt: "2026-04-06T00:00:00.000Z"
    });

    assert.equal(snapshot.summary.source, "local_file");
    assert.equal(snapshot.summary.derivedVoicedByScore, 2);
    assert.equal(snapshot.summary.derivedWeightedSum, 6);
    assert.equal(snapshot.summary.derivedCompositeScore, 60);
    assert.ok(snapshot.summary.reconciliation.mismatchCodes.includes("voiced_count_mismatch"));

    const tracker = await readQuantumTrackerState(tempDir);
    assert.equal(tracker.latestSnapshot?.summary.metadataVersion, "2.2");
    assert.equal(tracker.snapshotHistory.length, 1);
  } finally {
    if (previousPrimary === undefined) {
      delete process.env.AIBTC_QUANTUM_MAP_PRIMARY_URL;
    } else {
      process.env.AIBTC_QUANTUM_MAP_PRIMARY_URL = previousPrimary;
    }
    if (previousFallback === undefined) {
      delete process.env.AIBTC_QUANTUM_MAP_FALLBACK_URL;
    } else {
      process.env.AIBTC_QUANTUM_MAP_FALLBACK_URL = previousFallback;
    }
    if (previousLocal === undefined) {
      delete process.env.AIBTC_QUANTUM_MAP_LOCAL_DATASET_PATH;
    } else {
      process.env.AIBTC_QUANTUM_MAP_LOCAL_DATASET_PATH = previousLocal;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("weekly synthesis uses tracked quantum score updates and filed-signal outcomes", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-quantum-weekly-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(
      resolve(tempDir, "data/state/filed-signals.json"),
      JSON.stringify({
        filedSignals: [
          {
            signalId: "quantum-1",
            candidateId: "quantum-candidate-1",
            headline: "Neha Narula shifts to proactive quantum stance",
            beat: "quantum",
            filedAt: "2026-04-06T02:00:00.000Z",
            resolved: true,
            outcome: "approved"
          }
        ]
      }, null, 2),
      "utf8"
    );

    await saveQuantumTrackerState({
      kind: "quantum_tracker_state",
      updatedAt: "2026-04-06T03:00:00.000Z",
      latestSnapshot: {
        summary: {
          datasetUrl: "https://quantum-power-map.p-d07.workers.dev/data.json",
          fetchedAt: "2026-04-06T03:00:00.000Z",
          source: "cached_state",
          metadataDate: "2026-04-06",
          metadataVersion: "2.2",
          totalAssessed: 52,
          metadataVoiced: 23,
          metadataSilent: 29,
          metadataCoverageScore: 44,
          metadataWeightedSum: 71,
          metadataVoicedUrgency: 62,
          metadataCompositeScore: 27,
          derivedScoreDistribution: { "1": 31, "2": 9, "3": 4, "4": 5, "5": 3 },
          derivedVoicedByScore: 21,
          derivedVoicedBySources: 23,
          derivedSilentByScore: 31,
          derivedWeightedSum: 65,
          derivedCoverageScore: 40,
          derivedVoicedUrgency: 62,
          derivedCompositeScore: 25,
          reconciliation: {
            metadataMatchesDerivedScoreVoiced: false,
            metadataMatchesDerivedWeightedSum: false,
            metadataMatchesDerivedComposite: false,
            mismatchCodes: ["voiced_count_mismatch", "weighted_sum_mismatch", "composite_score_mismatch"]
          }
        },
        dataset: {
          metadata: {},
          developers: []
        }
      },
      snapshotHistory: [],
      trackedSignals: [],
      scoreChanges: []
    }, tempDir);

    await trackQuantumFiledSignal({
      reportDate: "2026-04-06",
      candidateId: "quantum-candidate-1",
      signalId: "quantum-1",
      filedAt: "2026-04-06T02:00:00.000Z",
      headline: "Neha Narula shifts to proactive quantum stance",
      beat: "quantum",
      sourceArtifact: {
        signal_type: "score_update_signal",
        pre_signal_validation: {
          subject_name: "Neha Narula",
          claimed_previous_score: 1,
          proposed_new_score: 4,
          primary_source_url: "https://nehanarula.org/post",
          source_urls: ["https://nehanarula.org/post"],
          map_update_status: "pending"
        }
      }
    }, tempDir);

    const synthesis = await generateQuantumWeeklySynthesis("2026-04-06", tempDir);

    assert.equal(synthesis.readinessIndex, 27);
    assert.equal(synthesis.trackedSignals.length, 1);
    assert.equal(synthesis.trackedSignals[0].status, "accepted");
    assert.equal(synthesis.dataUpdates.length, 1);
    assert.match(synthesis.markdown, /Neha Narula: score 1 → 4/);
    assert.match(synthesis.markdown, /Readiness Index: 27\/100/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
