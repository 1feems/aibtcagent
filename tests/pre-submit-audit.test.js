import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runPreSubmitAudit } from "../dist/filing/index.js";

function makeSubmissionArtifact(headline, beat = "infrastructure") {
  return {
    beat_slug: beat,
    headline,
    analysis: "PR #101 restores sBTC payment routing after relay writeback failures blocked queued agent settlements. AIBTC operators can submit queued AI agent payments again without manual fallback routing, which means failed Bitcoin-denominated settlement work can now reach broadcast and payout accounting instead of stalling in the relay path.",
    sources: [
      { url: "https://github.com/example/project/pull/101", title: "Primary proof" },
      { url: "https://www.npmjs.com/package/@stacks/transactions", title: "Independent external verifier" }
    ],
    tags: [beat, "test"],
    disclosure: "claude-opus-4, GitHub review of PR #101, npm package reference check, and manual rewrite to make the operator payout consequence explicit"
  };
}

function makeScoreUpdateArtifact(baseUrl, overrides = {}) {
  return {
    beat_slug: "quantum",
    signal_type: "score_update_signal",
    headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
    analysis: "Claim: the developer map baseline for Neha Narula was 1 and her April 3, 2026 post moves her to 4. Evidence: the live API endpoint at /data.json records her prior score as 1, her post quantifies a 5% Bitcoin failure scenario by 2030, and the readiness index changes from 23 to 24 when the score-4 and voiced-developer counts update. Implication: this means agents should use the dataset ledger before ranking, brief-selection, and payout-facing filing decisions, because a guessed baseline turns a valid Bitcoin quantum-risk update into an invalid state-transition claim.",
    sources: [
      { url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", title: "Primary post" },
      { url: "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/", title: "Supporting source" }
    ],
    tags: ["quantum", "developer-map", "score-update"],
    disclosure: `gpt-5 codex, live fetch of ${baseUrl}/data.json, live verification of source URLs, and duplicate-check before drafting`,
    ...overrides
  };
}

function makeQuantumTechnicalMilestoneArtifact(overrides = {}) {
  return {
    beat_slug: "quantum",
    signal_type: "quantum_signal",
    headline: "March 27 PR #360 thread: SHRIMPS cuts Bitcoin PQ wallet signatures to 2.5KB",
    analysis: "Claim: on March 27 Jonas Nick introduced SHRIMPS, a Bitcoin post-quantum signature design for multi-device wallets. Evidence: the Delving Bitcoin thread reports ~2.5KB signatures and ties the work to PR #360 in the Bitcoin upgrade discussion. Implication: this means Bitcoin wallet agents and operators should track a more deployable post-quantum signing path, because smaller signatures lower transaction-signing, recovery, and routing overhead in multi-device wallet systems they use to move BTC safely.",
    sources: [
      {
        url: "https://delvingbitcoin.org/t/shrimps-hash-based-pq-signatures/1234",
        title: "Jonas Nick — SHRIMPS",
        source_class: "delving_bitcoin"
      },
      {
        url: "https://github.com/bitcoin/bips/pull/360",
        title: "BIP-360 discussion",
        source_class: "bip_repository"
      }
    ],
    tags: ["quantum", "pq-signatures", "bitcoin"],
    disclosure: "gpt-5 codex, live fetch of the Delving Bitcoin thread, and no prior quantum filing matched this technical milestone",
    pre_signal_validation: {
      dataset_url: "https://quantum-power-map.p-d07.workers.dev/data.json",
      dataset_checked_at: "2026-04-06T09:00:00Z",
      subject_name: "Jonas Nick",
      source_urls: [
        "https://delvingbitcoin.org/t/shrimps-hash-based-pq-signatures/1234",
        "https://github.com/bitcoin/bips/pull/360"
      ],
      url_checks: [
        {
          url: "https://delvingbitcoin.org/t/shrimps-hash-based-pq-signatures/1234",
          status: 200
        },
        {
          url: "https://github.com/bitcoin/bips/pull/360",
          status: 200
        }
      ],
      duplicate_check: {
        checked: true,
        duplicate_found: false
      },
      scope_check: {
        passed: true,
        category: "technical_milestone"
      },
      bitcoin_relevance_check: {
        passed: true,
        bitcoin_named: true
      },
      exact_claim_check: {
        passed: true
      },
      reviewer_verifiability_check: {
        passed: true
      }
    },
    ...overrides
  };
}

function makeOutOfScopeQuantumArtifact(overrides = {}) {
  return {
    beat_slug: "quantum",
    signal_type: "quantum_signal",
    headline: "Google reaches 1000 qubits in new lab processor test",
    analysis: "Claim: Google announced a 1000-qubit processor on April 4. Evidence: the company blog says coherence times improved in lab testing. Implication: quantum hardware continues to improve quickly.",
    sources: [
      {
        url: "https://research.google/blog/1000-qubit-processor/",
        title: "Google Research blog",
        source_class: "developer_blog"
      }
    ],
    tags: ["quantum"],
    disclosure: "gpt-5 codex, source read from Google Research blog",
    ...overrides
  };
}

async function withHttpFixture(handler, fn) {
  const server = createServer(handler);
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolvePromise, rejectPromise) =>
      server.close((error) => (error ? rejectPromise(error) : resolvePromise()))
    );
  }
}

async function withQuantumMapEnv(baseUrl, fn) {
  const previousPrimary = process.env.AIBTC_QUANTUM_MAP_PRIMARY_URL;
  const previousFallback = process.env.AIBTC_QUANTUM_MAP_FALLBACK_URL;
  process.env.AIBTC_QUANTUM_MAP_PRIMARY_URL = `${baseUrl}/data.json`;
  process.env.AIBTC_QUANTUM_MAP_FALLBACK_URL = `${baseUrl}/fallback-data.json`;

  try {
    return await fn();
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
  }
}

test("pre-submit audit blocks candidates missing from the dated signal report", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(resolve(tempDir, "missing-report.json"), JSON.stringify(makeSubmissionArtifact("Audit candidate")), "utf8");

    const result = await runPreSubmitAudit("2026-03-28", {
      candidateId: "audit-candidate",
      beat: "infrastructure",
      headline: "Audit candidate",
      score: 92,
      obviousBriefWinner: true,
      decision: "file",
      lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
      styleTested: "release_operator_consequence",
      competitorReference: null,
      whyThisStyleWasChosen: "release_operator_consequence",
      duplicateStatus: "clear",
      freshnessStatus: "clear",
      competitorCoverage: [],
      reasons: [],
      sourcePath: resolve(tempDir, "missing-report.json")
    }, tempDir);

    assert.equal(result.ok, false);
    assert.ok(result.reasons.some((reason) => /dated signal report does not include this headline/i.test(reason)));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("pre-submit audit passes a repo-backed candidate with report presence and final guard pass", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(resolve(tempDir, "ready.json"), JSON.stringify(makeSubmissionArtifact("PR #101 restores payment routing")), "utf8");
    await writeFile(
      resolve(tempDir, "data/reports/signals/2026-03-28.md"),
      "# Signal Report: 2026-03-28\n\n- Headline: PR #101 restores payment routing\n",
      "utf8"
    );

    const result = await runPreSubmitAudit("2026-03-28", {
      candidateId: "audit-candidate",
      beat: "infrastructure",
      headline: "PR #101 restores payment routing",
      score: 92,
      obviousBriefWinner: true,
      decision: "file",
      lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
      styleTested: "release_operator_consequence",
      competitorReference: null,
      whyThisStyleWasChosen: "release_operator_consequence",
      duplicateStatus: "clear",
      freshnessStatus: "clear",
      competitorCoverage: [],
      reasons: [],
      sourcePath: resolve(tempDir, "ready.json")
    }, tempDir);

    assert.equal(result.ok, true);
    assert.deepEqual(result.reasons, []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("pre-submit audit hard-blocks score-update signals that skip pre-signal validation metadata", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact("http://127.0.0.1:9")), "utf8");
    await writeFile(
      resolve(tempDir, "data/reports/signals/2026-04-04.md"),
      "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n",
      "utf8"
    );

    const result = await runPreSubmitAudit("2026-04-04", {
      candidateId: "narula-score-update",
      beat: "quantum",
      headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
      score: 94,
      obviousBriefWinner: true,
      decision: "file",
      lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
      styleTested: "score_transition_claim_evidence_implication",
      competitorReference: null,
      whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
      duplicateStatus: "clear",
      freshnessStatus: "clear",
      competitorCoverage: [],
      reasons: [],
      sourcePath: resolve(tempDir, "score-update.json")
    }, tempDir);

    assert.equal(result.ok, false);
    assert.ok(result.reasons.some((reason) => /score-update signals require pre_signal_validation/i.test(reason)));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("pre-submit audit passes score-update signals only when live baseline, 200 sources, and duplicate check all pass", { concurrency: false }, async () => {
  await withHttpFixture((req, res) => {
    if (req.url === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        developers: [
          { name: "Neha Narula", score: 1 }
        ]
      }));
      return;
    }

    if (req.url === "/narula-post" || req.url === "/google-paper") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  }, async (baseUrl) => {
    await withQuantumMapEnv(baseUrl, async () => {
      const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));

      try {
        await mkdir(resolve(tempDir, "data/state"), { recursive: true });
        await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
        await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
        await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
        await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact(baseUrl, {
          pre_signal_validation: {
            dataset_url: `${baseUrl}/data.json`,
            subject_name: "Neha Narula",
            current_score: 1,
            previous_score: 1,
          new_score: 4,
          url_checks: [
            {
              url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
              status: 200
              },
              {
                url: "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/",
                status: 200
              }
            ],
            duplicate_check: {
              checked: true,
              duplicate_found: false
            },
            scope_check: {
              passed: true,
              category: "developer_stance_change"
            },
            bitcoin_relevance_check: {
              passed: true,
              bitcoin_named: true
            },
            exact_claim_check: {
              passed: true
            },
            reviewer_verifiability_check: {
              passed: true
            },
            readiness_math_check: {
              before_index: 23,
              after_index: 26,
              score_delta: 3,
              calculation: "Readiness Index moved from 23 to 26 after the 1 -> 4 score change was incorporated."
            },
            dataset_checked_at: "2026-04-04T12:00:00Z",
            source_urls: [
              "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
              "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/"
            ],
            previous_score_reasoning_from_dataset: "Score 1 — no known public quantum statement recorded in the map before April 3.",
            new_score_justification: "The April 3 post explicitly quantifies Bitcoin's quantum failure risk and calls for immediate work, which is proactive rather than no-view.",
            primary_source_url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
            primary_source_type: "developer_blog",
            duplicate_check_passed: true,
            map_update_required: true,
            map_update_status: "pending"
          }
        })), "utf8");
        await writeFile(
          resolve(tempDir, "data/reports/signals/2026-04-04.md"),
          "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n",
          "utf8"
        );

        const result = await runPreSubmitAudit("2026-04-04", {
          candidateId: "narula-score-update",
          beat: "quantum",
          headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
          score: 94,
          obviousBriefWinner: true,
          decision: "file",
          lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
          styleTested: "score_transition_claim_evidence_implication",
          competitorReference: null,
          whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
          duplicateStatus: "clear",
          freshnessStatus: "clear",
          competitorCoverage: [],
          reasons: [],
          sourcePath: resolve(tempDir, "score-update.json")
        }, tempDir);

        assert.equal(result.ok, true, JSON.stringify(result.reasons));
        assert.deepEqual(result.reasons, []);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});

test("pre-submit audit hard-blocks score-updates when proposed_new_score equals claimed_previous_score", { concurrency: false }, async () => {
  await withHttpFixture((req, res) => {
    if (req.url === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ developers: [{ name: "Neha Narula", score: 1 }] }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  }, async (baseUrl) => {
    await withQuantumMapEnv(baseUrl, async () => {
      const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
      try {
        await mkdir(resolve(tempDir, "data/state"), { recursive: true });
        await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
        await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
        await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
        await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact(baseUrl, {
          pre_signal_validation: {
            dataset_url: `${baseUrl}/data.json`,
            dataset_checked_at: "2026-04-04T12:00:00Z",
            subject_name: "Neha Narula",
            dataset_current_score: 1,
            claimed_previous_score: 1,
            proposed_new_score: 1,
            source_urls: [
              "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
              "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/"
            ],
            url_checks: [
              { url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", status: 200 },
              { url: "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/", status: 200 }
            ],
            duplicate_check: { checked: true, duplicate_found: false },
            duplicate_check_passed: true,
            previous_score_reasoning_from_dataset: "Score 1 baseline.",
            new_score_justification: "Still trying to update.",
            primary_source_url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
            primary_source_type: "developer_blog",
            map_update_required: true,
            map_update_status: "pending"
          }
        })), "utf8");
        await writeFile(resolve(tempDir, "data/reports/signals/2026-04-04.md"), "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n", "utf8");
        const result = await runPreSubmitAudit("2026-04-04", {
          candidateId: "narula-score-update",
          beat: "quantum",
          headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
          score: 94,
          obviousBriefWinner: true,
          decision: "file",
          lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
          styleTested: "score_transition_claim_evidence_implication",
          competitorReference: null,
          whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
          duplicateStatus: "clear",
          freshnessStatus: "clear",
          competitorCoverage: [],
          reasons: [],
          sourcePath: resolve(tempDir, "score-update.json")
        }, tempDir);
        assert.equal(result.ok, false);
        assert.ok(result.reasons.some((reason) => /must differ/i.test(reason)));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});

test("pre-submit audit hard-blocks score-updates with secondary primary_source_type", { concurrency: false }, async () => {
  await withHttpFixture((req, res) => {
    if (req.url === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ developers: [{ name: "Neha Narula", score: 1 }] }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  }, async (baseUrl) => {
    await withQuantumMapEnv(baseUrl, async () => {
      const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
      try {
        await mkdir(resolve(tempDir, "data/state"), { recursive: true });
        await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
        await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
        await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
        await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact(baseUrl, {
          pre_signal_validation: {
            dataset_url: `${baseUrl}/data.json`,
            dataset_checked_at: "2026-04-04T12:00:00Z",
            subject_name: "Neha Narula",
            dataset_current_score: 1,
            claimed_previous_score: 1,
            proposed_new_score: 4,
            source_urls: ["https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html"],
            url_checks: [{ url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", status: 200 }],
            duplicate_check: { checked: true, duplicate_found: false },
            duplicate_check_passed: true,
            previous_score_reasoning_from_dataset: "Score 1 baseline.",
            new_score_justification: "Justification.",
            primary_source_url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
            primary_source_type: "secondary",
            map_update_required: true,
            map_update_status: "pending"
          }
        })), "utf8");
        await writeFile(resolve(tempDir, "data/reports/signals/2026-04-04.md"), "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n", "utf8");
        const result = await runPreSubmitAudit("2026-04-04", {
          candidateId: "narula-score-update",
          beat: "quantum",
          headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
          score: 94,
          obviousBriefWinner: true,
          decision: "file",
          lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
          styleTested: "score_transition_claim_evidence_implication",
          competitorReference: null,
          whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
          duplicateStatus: "clear",
          freshnessStatus: "clear",
          competitorCoverage: [],
          reasons: [],
          sourcePath: resolve(tempDir, "score-update.json")
        }, tempDir);
        assert.equal(result.ok, false);
        assert.ok(result.reasons.some((reason) => /cannot be secondary/i.test(reason)));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});

test("pre-submit audit hard-blocks score-updates with non-ISO dataset_checked_at", { concurrency: false }, async () => {
  await withHttpFixture((req, res) => {
    if (req.url === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ developers: [{ name: "Neha Narula", score: 1 }] }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  }, async (baseUrl) => {
    await withQuantumMapEnv(baseUrl, async () => {
      const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
      try {
        await mkdir(resolve(tempDir, "data/state"), { recursive: true });
        await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
        await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
        await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
        await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact(baseUrl, {
          pre_signal_validation: {
            dataset_url: `${baseUrl}/data.json`,
            dataset_checked_at: "2026-04-04 12:00:00",
            subject_name: "Neha Narula",
            dataset_current_score: 1,
            claimed_previous_score: 1,
            proposed_new_score: 4,
            source_urls: ["https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html"],
            url_checks: [{ url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", status: 200 }],
            duplicate_check: { checked: true, duplicate_found: false },
            duplicate_check_passed: true,
            previous_score_reasoning_from_dataset: "Score 1 baseline.",
            new_score_justification: "Justification.",
            primary_source_url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
            primary_source_type: "developer_blog",
            map_update_required: true,
            map_update_status: "pending"
          }
        })), "utf8");
        await writeFile(resolve(tempDir, "data/reports/signals/2026-04-04.md"), "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n", "utf8");
        const result = await runPreSubmitAudit("2026-04-04", {
          candidateId: "narula-score-update",
          beat: "quantum",
          headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
          score: 94,
          obviousBriefWinner: true,
          decision: "file",
          lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
          styleTested: "score_transition_claim_evidence_implication",
          competitorReference: null,
          whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
          duplicateStatus: "clear",
          freshnessStatus: "clear",
          competitorCoverage: [],
          reasons: [],
          sourcePath: resolve(tempDir, "score-update.json")
        }, tempDir);
        assert.equal(result.ok, false);
        assert.ok(result.reasons.some((reason) => /dataset_checked_at must be an ISO-8601 UTC datetime/i.test(reason)), JSON.stringify(result.reasons));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});

test("pre-submit audit hard-blocks score-updates when duplicate_check_passed disagrees with duplicate_check", { concurrency: false }, async () => {
  await withHttpFixture((req, res) => {
    if (req.url === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ developers: [{ name: "Neha Narula", score: 1 }] }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  }, async (baseUrl) => {
    await withQuantumMapEnv(baseUrl, async () => {
      const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
      try {
        await mkdir(resolve(tempDir, "data/state"), { recursive: true });
        await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
        await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
        await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
        await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact(baseUrl, {
          pre_signal_validation: {
            dataset_url: `${baseUrl}/data.json`,
            dataset_checked_at: "2026-04-04T12:00:00Z",
            subject_name: "Neha Narula",
            dataset_current_score: 1,
            claimed_previous_score: 1,
            proposed_new_score: 4,
            source_urls: [
              "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
              "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/"
            ],
            url_checks: [
              { url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", status: 200 },
              { url: "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/", status: 200 }
            ],
            duplicate_check: { checked: true, duplicate_found: true },
            duplicate_check_passed: true,
            previous_score_reasoning_from_dataset: "Score 1 baseline.",
            new_score_justification: "Justification.",
            primary_source_url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
            primary_source_type: "developer_blog",
            map_update_required: true,
            map_update_status: "pending"
          }
        })), "utf8");
        await writeFile(resolve(tempDir, "data/reports/signals/2026-04-04.md"), "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n", "utf8");
        const result = await runPreSubmitAudit("2026-04-04", {
          candidateId: "narula-score-update",
          beat: "quantum",
          headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
          score: 94,
          obviousBriefWinner: true,
          decision: "file",
          lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
          styleTested: "score_transition_claim_evidence_implication",
          competitorReference: null,
          whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
          duplicateStatus: "clear",
          freshnessStatus: "clear",
          competitorCoverage: [],
          reasons: [],
          sourcePath: resolve(tempDir, "score-update.json")
        }, tempDir);
        assert.equal(result.ok, false);
        assert.ok(result.reasons.some((reason) => /duplicate_check_passed must match duplicate_check/i.test(reason)), JSON.stringify(result.reasons));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});

test("pre-submit audit hard-blocks score-update signals when scope_check is absent or failed", { concurrency: false }, async () => {
  await withHttpFixture((req, res) => {
    if (req.url === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ developers: [{ name: "Neha Narula", score: 1 }] }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  }, async (baseUrl) => {
    await withQuantumMapEnv(baseUrl, async () => {
      const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
      try {
        await mkdir(resolve(tempDir, "data/state"), { recursive: true });
        await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
        await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
        await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
        await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact(baseUrl, {
          pre_signal_validation: {
            dataset_url: `${baseUrl}/data.json`,
            dataset_checked_at: "2026-04-04T12:00:00Z",
            subject_name: "Neha Narula",
            dataset_current_score: 1,
            claimed_previous_score: 1,
            proposed_new_score: 4,
            source_urls: [
              "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
              "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/"
            ],
            url_checks: [
              { url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", status: 200 },
              { url: "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/", status: 200 }
            ],
            duplicate_check: { checked: true, duplicate_found: false },
            duplicate_check_passed: true,
            scope_check: { passed: false, category: "developer_stance_change" },
            bitcoin_relevance_check: { passed: true, bitcoin_named: true },
            exact_claim_check: { passed: true },
            reviewer_verifiability_check: { passed: true },
            previous_score_reasoning_from_dataset: "Score 1 baseline.",
            new_score_justification: "Justification.",
            primary_source_url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
            primary_source_type: "developer_blog",
            map_update_required: true,
            map_update_status: "pending"
          }
        })), "utf8");
        await writeFile(resolve(tempDir, "data/reports/signals/2026-04-04.md"), "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n", "utf8");
        const result = await runPreSubmitAudit("2026-04-04", {
          candidateId: "narula-score-update",
          beat: "quantum",
          headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
          score: 94,
          obviousBriefWinner: true,
          decision: "file",
          lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
          styleTested: "score_transition_claim_evidence_implication",
          competitorReference: null,
          whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
          duplicateStatus: "clear",
          freshnessStatus: "clear",
          competitorCoverage: [],
          reasons: [],
          sourcePath: resolve(tempDir, "score-update.json")
        }, tempDir);
        assert.equal(result.ok, false);
        assert.ok(result.reasons.some((reason) => /beat scope check/i.test(reason)), JSON.stringify(result.reasons));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});

test("pre-submit audit hard-blocks score-update signals when bitcoin_relevance_check fails", { concurrency: false }, async () => {
  await withHttpFixture((req, res) => {
    if (req.url === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ developers: [{ name: "Neha Narula", score: 1 }] }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  }, async (baseUrl) => {
    await withQuantumMapEnv(baseUrl, async () => {
      const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
      try {
        await mkdir(resolve(tempDir, "data/state"), { recursive: true });
        await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
        await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
        await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
        await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact(baseUrl, {
          pre_signal_validation: {
            dataset_url: `${baseUrl}/data.json`,
            dataset_checked_at: "2026-04-04T12:00:00Z",
            subject_name: "Neha Narula",
            dataset_current_score: 1,
            claimed_previous_score: 1,
            proposed_new_score: 4,
            source_urls: [
              "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
              "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/"
            ],
            url_checks: [
              { url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", status: 200 },
              { url: "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/", status: 200 }
            ],
            duplicate_check: { checked: true, duplicate_found: false },
            duplicate_check_passed: true,
            scope_check: { passed: true, category: "developer_stance_change" },
            bitcoin_relevance_check: { passed: false, bitcoin_named: false },
            exact_claim_check: { passed: true },
            reviewer_verifiability_check: { passed: true },
            previous_score_reasoning_from_dataset: "Score 1 baseline.",
            new_score_justification: "Justification.",
            primary_source_url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
            primary_source_type: "developer_blog",
            map_update_required: true,
            map_update_status: "pending"
          }
        })), "utf8");
        await writeFile(resolve(tempDir, "data/reports/signals/2026-04-04.md"), "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n", "utf8");
        const result = await runPreSubmitAudit("2026-04-04", {
          candidateId: "narula-score-update",
          beat: "quantum",
          headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
          score: 94,
          obviousBriefWinner: true,
          decision: "file",
          lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
          styleTested: "score_transition_claim_evidence_implication",
          competitorReference: null,
          whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
          duplicateStatus: "clear",
          freshnessStatus: "clear",
          competitorCoverage: [],
          reasons: [],
          sourcePath: resolve(tempDir, "score-update.json")
        }, tempDir);
        assert.equal(result.ok, false);
        assert.ok(result.reasons.some((reason) => /Bitcoin relevance check/i.test(reason)), JSON.stringify(result.reasons));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});

test("pre-submit audit hard-blocks score-update signals when exact_claim_check or reviewer_verifiability_check fails", { concurrency: false }, async () => {
  await withHttpFixture((req, res) => {
    if (req.url === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ developers: [{ name: "Neha Narula", score: 1 }] }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  }, async (baseUrl) => {
    await withQuantumMapEnv(baseUrl, async () => {
      const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
      try {
        await mkdir(resolve(tempDir, "data/state"), { recursive: true });
        await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
        await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
        await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
        await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact(baseUrl, {
          pre_signal_validation: {
            dataset_url: `${baseUrl}/data.json`,
            dataset_checked_at: "2026-04-04T12:00:00Z",
            subject_name: "Neha Narula",
            dataset_current_score: 1,
            claimed_previous_score: 1,
            proposed_new_score: 4,
            source_urls: [
              "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
              "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/"
            ],
            url_checks: [
              { url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", status: 200 },
              { url: "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/", status: 200 }
            ],
            duplicate_check: { checked: true, duplicate_found: false },
            duplicate_check_passed: true,
            scope_check: { passed: true, category: "developer_stance_change" },
            bitcoin_relevance_check: { passed: true, bitcoin_named: true },
            exact_claim_check: { passed: false },
            reviewer_verifiability_check: { passed: false },
            previous_score_reasoning_from_dataset: "Score 1 baseline.",
            new_score_justification: "Justification.",
            primary_source_url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
            primary_source_type: "developer_blog",
            map_update_required: true,
            map_update_status: "pending"
          }
        })), "utf8");
        await writeFile(resolve(tempDir, "data/reports/signals/2026-04-04.md"), "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n", "utf8");
        const result = await runPreSubmitAudit("2026-04-04", {
          candidateId: "narula-score-update",
          beat: "quantum",
          headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
          score: 94,
          obviousBriefWinner: true,
          decision: "file",
          lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
          styleTested: "score_transition_claim_evidence_implication",
          competitorReference: null,
          whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
          duplicateStatus: "clear",
          freshnessStatus: "clear",
          competitorCoverage: [],
          reasons: [],
          sourcePath: resolve(tempDir, "score-update.json")
        }, tempDir);
        assert.equal(result.ok, false);
        assert.ok(result.reasons.some((reason) => /exact claim/i.test(reason)), JSON.stringify(result.reasons));
        assert.ok(result.reasons.some((reason) => /reviewer verifiability/i.test(reason)), JSON.stringify(result.reasons));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});

test("pre-submit audit hard-blocks score-updates when payload sources diverge from pre_signal_validation.source_urls", { concurrency: false }, async () => {
  await withHttpFixture((req, res) => {
    if (req.url === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ developers: [{ name: "Neha Narula", score: 1 }] }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  }, async (baseUrl) => {
    await withQuantumMapEnv(baseUrl, async () => {
      const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
      try {
        await mkdir(resolve(tempDir, "data/state"), { recursive: true });
        await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
        await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
        await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
        await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact(baseUrl, {
          pre_signal_validation: {
            dataset_url: `${baseUrl}/data.json`,
            dataset_checked_at: "2026-04-04T12:00:00Z",
            subject_name: "Neha Narula",
            dataset_current_score: 1,
            claimed_previous_score: 1,
            proposed_new_score: 4,
            source_urls: ["https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html"],
            url_checks: [
              { url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", status: 200 },
              { url: "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/", status: 200 }
            ],
            duplicate_check: { checked: true, duplicate_found: false },
            duplicate_check_passed: true,
            previous_score_reasoning_from_dataset: "Score 1 baseline.",
            new_score_justification: "Justification.",
            primary_source_url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
            primary_source_type: "developer_blog",
            map_update_required: true,
            map_update_status: "pending"
          }
        })), "utf8");
        await writeFile(resolve(tempDir, "data/reports/signals/2026-04-04.md"), "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n", "utf8");
        const result = await runPreSubmitAudit("2026-04-04", {
          candidateId: "narula-score-update",
          beat: "quantum",
          headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
          score: 94,
          obviousBriefWinner: true,
          decision: "file",
          lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
          styleTested: "score_transition_claim_evidence_implication",
          competitorReference: null,
          whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
          duplicateStatus: "clear",
          freshnessStatus: "clear",
          competitorCoverage: [],
          reasons: [],
          sourcePath: resolve(tempDir, "score-update.json")
        }, tempDir);
        assert.equal(result.ok, false);
        assert.ok(result.reasons.some((reason) => /payload source URL .* missing from pre_signal_validation\.source_urls/i.test(reason)), JSON.stringify(result.reasons));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});

test("pre-submit audit hard-blocks quantum signals missing the quantum tag", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(resolve(tempDir, "quantum-no-tag.json"), JSON.stringify(makeQuantumTechnicalMilestoneArtifact({
      tags: ["bitcoin", "pq-signatures"]
    })), "utf8");
    await writeFile(resolve(tempDir, "data/reports/signals/2026-04-06.md"), "# Signal Report: 2026-04-06\n\n- Headline: March 27 PR #360 thread: SHRIMPS cuts Bitcoin PQ wallet signatures to 2.5KB\n", "utf8");
    const result = await runPreSubmitAudit("2026-04-06", {
      candidateId: "quantum-no-tag",
      beat: "quantum",
      headline: "March 27 PR #360 thread: SHRIMPS cuts Bitcoin PQ wallet signatures to 2.5KB",
      score: 91,
      obviousBriefWinner: true,
      decision: "file",
      lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
      styleTested: "technical_milestone_claim_evidence_implication",
      competitorReference: null,
      whyThisStyleWasChosen: "technical_milestone_claim_evidence_implication",
      duplicateStatus: "clear",
      freshnessStatus: "clear",
      competitorCoverage: [],
      reasons: [],
      sourcePath: resolve(tempDir, "quantum-no-tag.json")
    }, tempDir);
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some((reason) => /quantum tag/i.test(reason)));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("pre-submit audit hard-blocks quantum signals when readiness math does not reconcile", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(resolve(tempDir, "quantum-bad-math.json"), JSON.stringify(makeQuantumTechnicalMilestoneArtifact({
      analysis: "Claim: on March 27 Jonas Nick introduced SHRIMPS, a Bitcoin post-quantum signature design for multi-device wallets. Evidence: the Delving Bitcoin thread reports ~2.5KB signatures and ties the work to PR #360 in the Bitcoin upgrade discussion. Implication: this means Bitcoin wallet agents should revise readiness index tracking because the readiness index changes from 23 to 99 when the score delta is only 1.",
      pre_signal_validation: {
        dataset_url: "https://quantum-power-map.p-d07.workers.dev/data.json",
        dataset_checked_at: "2026-04-06T09:00:00Z",
        subject_name: "Jonas Nick",
        source_urls: [
          "https://delvingbitcoin.org/t/shrimps-hash-based-pq-signatures/1234",
          "https://github.com/bitcoin/bips/pull/360"
        ],
        url_checks: [
          {
            url: "https://delvingbitcoin.org/t/shrimps-hash-based-pq-signatures/1234",
            status: 200
          },
          {
            url: "https://github.com/bitcoin/bips/pull/360",
            status: 200
          }
        ],
        duplicate_check: {
          checked: true,
          duplicate_found: false
        },
        scope_check: {
          passed: true,
          category: "technical_milestone"
        },
        bitcoin_relevance_check: {
          passed: true,
          bitcoin_named: true
        },
        exact_claim_check: {
          passed: true
        },
        reviewer_verifiability_check: {
          passed: true
        },
        readiness_math_check: {
          before_index: 23,
          after_index: 99,
          score_delta: 1,
          calculation: "Readiness Index moved from 23 to 99 after a +1 score delta."
        }
      }
    })), "utf8");
    await writeFile(resolve(tempDir, "data/reports/signals/2026-04-06.md"), "# Signal Report: 2026-04-06\n\n- Headline: March 27 PR #360 thread: SHRIMPS cuts Bitcoin PQ wallet signatures to 2.5KB\n", "utf8");
    const result = await runPreSubmitAudit("2026-04-06", {
      candidateId: "quantum-bad-math",
      beat: "quantum",
      headline: "March 27 PR #360 thread: SHRIMPS cuts Bitcoin PQ wallet signatures to 2.5KB",
      score: 91,
      obviousBriefWinner: true,
      decision: "file",
      lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
      styleTested: "technical_milestone_claim_evidence_implication",
      competitorReference: null,
      whyThisStyleWasChosen: "technical_milestone_claim_evidence_implication",
      duplicateStatus: "clear",
      freshnessStatus: "clear",
      competitorCoverage: [],
      reasons: [],
      sourcePath: resolve(tempDir, "quantum-bad-math.json")
    }, tempDir);
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some((reason) => /readiness math check does not reconcile/i.test(reason)), JSON.stringify(result.reasons));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("pre-submit audit hard-blocks quantum signals when payload sources diverge from pre_signal_validation.source_urls", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(resolve(tempDir, "quantum-source-mismatch.json"), JSON.stringify(makeQuantumTechnicalMilestoneArtifact({
      pre_signal_validation: {
        dataset_url: "https://quantum-power-map.p-d07.workers.dev/data.json",
        dataset_checked_at: "2026-04-06T09:00:00Z",
        subject_name: "Jonas Nick",
        source_urls: [
          "https://delvingbitcoin.org/t/shrimps-hash-based-pq-signatures/1234"
        ],
        url_checks: [
          {
            url: "https://delvingbitcoin.org/t/shrimps-hash-based-pq-signatures/1234",
            status: 200
          },
          {
            url: "https://github.com/bitcoin/bips/pull/360",
            status: 200
          }
        ],
        duplicate_check: {
          checked: true,
          duplicate_found: false
        },
        scope_check: {
          passed: true,
          category: "technical_milestone"
        },
        bitcoin_relevance_check: {
          passed: true,
          bitcoin_named: true
        },
        exact_claim_check: {
          passed: true
        },
        reviewer_verifiability_check: {
          passed: true
        }
      }
    })), "utf8");
    await writeFile(resolve(tempDir, "data/reports/signals/2026-04-06.md"), "# Signal Report: 2026-04-06\n\n- Headline: March 27 PR #360 thread: SHRIMPS cuts Bitcoin PQ wallet signatures to 2.5KB\n", "utf8");
    const result = await runPreSubmitAudit("2026-04-06", {
      candidateId: "quantum-source-mismatch",
      beat: "quantum",
      headline: "March 27 PR #360 thread: SHRIMPS cuts Bitcoin PQ wallet signatures to 2.5KB",
      score: 91,
      obviousBriefWinner: true,
      decision: "file",
      lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
      styleTested: "technical_milestone_claim_evidence_implication",
      competitorReference: null,
      whyThisStyleWasChosen: "technical_milestone_claim_evidence_implication",
      duplicateStatus: "clear",
      freshnessStatus: "clear",
      competitorCoverage: [],
      reasons: [],
      sourcePath: resolve(tempDir, "quantum-source-mismatch.json")
    }, tempDir);
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some((reason) => /payload source URL .* missing from pre_signal_validation\.source_urls/i.test(reason)), JSON.stringify(result.reasons));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("pre-submit audit passes valid non-score quantum technical milestone signals", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(resolve(tempDir, "quantum-valid.json"), JSON.stringify(makeQuantumTechnicalMilestoneArtifact()), "utf8");
    await writeFile(
      resolve(tempDir, "data/reports/signals/2026-04-06.md"),
      "# Signal Report: 2026-04-06\n\n- Headline: March 27 PR #360 thread: SHRIMPS cuts Bitcoin PQ wallet signatures to 2.5KB\n",
      "utf8"
    );

    const result = await runPreSubmitAudit("2026-04-06", {
      candidateId: "quantum-tech-milestone",
      beat: "quantum",
      headline: "March 27 PR #360 thread: SHRIMPS cuts Bitcoin PQ wallet signatures to 2.5KB",
      score: 91,
      obviousBriefWinner: true,
      decision: "file",
      lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
      styleTested: "technical_milestone_claim_evidence_implication",
      competitorReference: null,
      whyThisStyleWasChosen: "technical_milestone_claim_evidence_implication",
      duplicateStatus: "clear",
      freshnessStatus: "clear",
      competitorCoverage: [],
      reasons: [],
      sourcePath: resolve(tempDir, "quantum-valid.json")
    }, tempDir);

    assert.equal(result.ok, true, JSON.stringify(result.reasons));
    assert.deepEqual(result.reasons, []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("pre-submit audit hard-blocks out-of-scope quantum signals without Bitcoin relevance", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await writeFile(resolve(tempDir, "quantum-invalid.json"), JSON.stringify(makeOutOfScopeQuantumArtifact()), "utf8");
    await writeFile(
      resolve(tempDir, "data/reports/signals/2026-04-06.md"),
      "# Signal Report: 2026-04-06\n\n- Headline: Google reaches 1000 qubits in new lab processor test\n",
      "utf8"
    );

    const result = await runPreSubmitAudit("2026-04-06", {
      candidateId: "quantum-out-of-scope",
      beat: "quantum",
      headline: "Google reaches 1000 qubits in new lab processor test",
      score: 64,
      obviousBriefWinner: false,
      decision: "file",
      lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
      styleTested: "out_of_scope_quantum_story",
      competitorReference: null,
      whyThisStyleWasChosen: "out_of_scope_quantum_story",
      duplicateStatus: "clear",
      freshnessStatus: "clear",
      competitorCoverage: [],
      reasons: [],
      sourcePath: resolve(tempDir, "quantum-invalid.json")
    }, tempDir);

    assert.equal(result.ok, false);
    assert.ok(result.reasons.some((reason) => /Bitcoin link|Bitcoin relevance/i.test(reason)));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("pre-submit audit does not route non-quantum beat signals with signal_type set through the quantum audit", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    // infrastructure beat signal with an arbitrary signal_type field set — should not trigger quantum audit
    const artifact = {
      ...makeSubmissionArtifact("PR #101 restores payment routing", "infrastructure"),
      signal_type: "infrastructure_update"
    };
    await writeFile(resolve(tempDir, "infra-with-type.json"), JSON.stringify(artifact), "utf8");
    await writeFile(
      resolve(tempDir, "data/reports/signals/2026-03-28.md"),
      "# Signal Report: 2026-03-28\n\n- Headline: PR #101 restores payment routing\n",
      "utf8"
    );
    const result = await runPreSubmitAudit("2026-03-28", {
      candidateId: "infra-with-type",
      beat: "infrastructure",
      headline: "PR #101 restores payment routing",
      score: 92,
      obviousBriefWinner: true,
      decision: "file",
      lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
      styleTested: "release_operator_consequence",
      competitorReference: null,
      whyThisStyleWasChosen: "release_operator_consequence",
      duplicateStatus: "clear",
      freshnessStatus: "clear",
      competitorCoverage: [],
      reasons: [],
      sourcePath: resolve(tempDir, "infra-with-type.json")
    }, tempDir);
    // must not be blocked by quantum-audit rules (beat_slug check, quantum tag check, etc.)
    assert.ok(
      !result.reasons.some((reason) => /beat_slug quantum|quantum tag|quantum signal/i.test(reason)),
      `non-quantum signal was incorrectly routed through quantum audit: ${JSON.stringify(result.reasons)}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("pre-submit audit hard-blocks score-update signals when scope_check is entirely absent from pre_signal_validation", { concurrency: false }, async () => {
  await withHttpFixture((req, res) => {
    if (req.url === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ developers: [{ name: "Neha Narula", score: 1 }] }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  }, async (baseUrl) => {
    await withQuantumMapEnv(baseUrl, async () => {
      const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-pre-submit-"));
      try {
        await mkdir(resolve(tempDir, "data/state"), { recursive: true });
        await mkdir(resolve(tempDir, "data/reports/signals"), { recursive: true });
        await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
        await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
        await writeFile(resolve(tempDir, "score-update.json"), JSON.stringify(makeScoreUpdateArtifact(baseUrl, {
          pre_signal_validation: {
            dataset_url: `${baseUrl}/data.json`,
            dataset_checked_at: "2026-04-04T12:00:00Z",
            subject_name: "Neha Narula",
            dataset_current_score: 1,
            claimed_previous_score: 1,
            proposed_new_score: 4,
            source_urls: [
              "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
              "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/"
            ],
            url_checks: [
              { url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", status: 200 },
              { url: "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/", status: 200 }
            ],
            duplicate_check: { checked: true, duplicate_found: false },
            duplicate_check_passed: true,
            // scope_check intentionally omitted
            bitcoin_relevance_check: { passed: true, bitcoin_named: true },
            exact_claim_check: { passed: true },
            reviewer_verifiability_check: { passed: true },
            previous_score_reasoning_from_dataset: "Score 1 baseline.",
            new_score_justification: "Justification.",
            primary_source_url: "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
            primary_source_type: "developer_blog",
            map_update_required: true,
            map_update_status: "pending"
          }
        })), "utf8");
        await writeFile(resolve(tempDir, "data/reports/signals/2026-04-04.md"), "# Signal Report: 2026-04-04\n\n- Headline: Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030\n", "utf8");
        const result = await runPreSubmitAudit("2026-04-04", {
          candidateId: "narula-score-update",
          beat: "quantum",
          headline: "Narula's April 3 post moves developer-map score 1 -> 4 and puts Bitcoin quantum failure risk at 5% by 2030",
          score: 94,
          obviousBriefWinner: true,
          decision: "file",
          lifecycle: { contract: "source_to_signing_v1", phase: "scoring", state: "scored_for_filing", summary: "", blockingReasons: [] },
          styleTested: "score_transition_claim_evidence_implication",
          competitorReference: null,
          whyThisStyleWasChosen: "score_transition_claim_evidence_implication",
          duplicateStatus: "clear",
          freshnessStatus: "clear",
          competitorCoverage: [],
          reasons: [],
          sourcePath: resolve(tempDir, "score-update.json")
        }, tempDir);
        assert.equal(result.ok, false);
        assert.ok(result.reasons.some((reason) => /beat scope check/i.test(reason)), JSON.stringify(result.reasons));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
