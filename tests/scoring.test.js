import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  rankDryRunCandidates,
  saveRankedCandidateQueue
} from "../dist/scoring/index.js";
import { buildFilingQueue } from "../dist/filing/index.js";
import { fetchCompetitorProfiles } from "../dist/brief/index.js";

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
        stylePerformance: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-28/strong-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "strong",
          beat: "aibtc-network",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "an early same day signal before broader visibility for sBTC relay operators",
          causality: "operators should verify PR #431 before resuming automated settlement"
        },
        headline: "PR #431 restores sBTC relay recovery after 42 failed settlements",
        sources: [
          {
            source_type: "live-feed",
            source_url: "https://github.com/aibtcdev/x402-sponsor-relay/pull/431"
          }
        ],
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

test("weak-but-valid submissions are held when brief competition proof is missing or weak", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-04-21", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-04-21.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-04-21",
        generatedAt: "2026-04-21T00:00:00Z",
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-04-21/valid-but-weak-competition-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "valid-but-weak-competition",
          beat: "aibtc-network",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "same day filing window is open and operators need this update before next payout cycle",
          causality: "operators should verify the anchor before filing follow-on updates"
        },
        headline: "PR #431 restores relay recovery after 42 failed settlements",
        sources: [
          {
            source_type: "live-feed",
            source_url: "https://github.com/aibtcdev/x402-sponsor-relay/pull/431"
          }
        ],
        submission_decision: { status: "submit", rejection_reasons: [] },
        editorial_review: {
          editorial_fit: "strong",
          publisher_confidence: "high",
          ready_to_file: true,
          hold_reasons: []
        },
        candidate_metadata: {
          why_this_beat_is_open: "open.",
          why_now: "now.",
          why_this_beats_same_day_competition: "better.",
          primary_source_proof: "see source.",
          operator_action: "watch."
        }
      }),
      "utf8"
    );

    const ranked = await rankDryRunCandidates("2026-04-21");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].candidateId, "valid-but-weak-competition");
    assert.equal(ranked[0].decision, "hold");
    assert.ok(ranked[0].reasons.some((reason) => /brief competition proof/i.test(reason)));
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("manual-check-only release-note candidates are demoted below filing quality", { concurrency: false }, async () => {
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
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-28/release-note-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "release-note",
          beat: "infrastructure",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "routine release update"
        },
        headline:
          "x402-sponsor-relay ships v1.23.1 Bug Fixes stale conflict state auto-clear, health degradation, admin reset (#239)",
        submission_decision: {
          status: "reject",
          rejection_reasons: [
            "leaderboard_not_checked",
            "reputation_not_checked",
            "inbox_not_checked",
            "agent_status_not_checked"
          ]
        },
        editorial_review: {
          editorial_fit: "borderline",
          publisher_confidence: "low",
          ready_to_file: false,
          hold_reasons: ["technical_submission_gate_failed", "publisher_review_needed"]
        }
      }),
      "utf8"
    );

    const ranked = await rankDryRunCandidates("2026-03-28");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].candidateId, "release-note");
    assert.equal(ranked[0].decision, "reject");
    assert.ok(ranked[0].score < 45);
    assert.ok(
      ranked[0].reasons.includes("editorial review does not consider it filing-ready")
    );
    assert.ok(
      ranked[0].reasons.includes("headline reads like raw release notes instead of a finished filing")
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("approval-ready raw release notes without operator consequence cannot rank as file", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-30", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-03-30.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-30",
        generatedAt: "2026-03-30T00:00:00Z",
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-30/raw-release-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "raw-release",
          beat: "infrastructure",
          detected_at: "2026-03-30T04:00:00Z",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "same day release with version bump"
        },
        headline: "aibtc-mcp-server ships mcp-server: v1.46.0 — add zest_enable_collateral tool for V2 collateral-add (#423)",
        submission_decision: { status: "submit", rejection_reasons: [] },
        editorial_review: {
          editorial_fit: "strong",
          publisher_confidence: "high",
          ready_to_file: true,
          hold_reasons: []
        },
        proof: [
          {
            query_result: "GitHub release v1.46.0 merged and published today.",
            proof_note: "Repo change confirmed."
          }
        ],
        sources: [
          {
            source_url: "https://github.com/aibtcdev/aibtc-mcp-server/releases/tag/v1.46.0"
          }
        ]
      }),
      "utf8"
    );

    const ranked = await rankDryRunCandidates("2026-03-30");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].candidateId, "raw-release");
    assert.notEqual(ranked[0].decision, "file");
    assert.ok(
      ranked[0].reasons.includes("raw release-note framing without operator consequence is not competitive for In Brief")
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rankDryRunCandidates prunes prior-day stale dry-run submissions before scoring", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-30", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-03-30.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-30",
        generatedAt: "2026-03-30T00:00:00Z",
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-30/stale-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "stale-candidate",
          beat: "infrastructure",
          detected_at: "2026-03-29T04:52:17.896Z",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "yesterday's release"
        },
        headline: "landing-page ships v1.36.2 — inbox: return pending status instead of SETTLEMENT_TIMEOUT error",
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
      "data/dry-runs/2026-03-30/fresh-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "fresh-candidate",
          beat: "infrastructure",
          detected_at: "2026-03-30T04:52:17.896Z",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "today's release"
        },
        headline: "Relay queue forms before nonce burn window opens for operators",
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

    const ranked = await rankDryRunCandidates("2026-03-30");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].candidateId, "fresh-candidate");

    await assert.rejects(
      access(resolve(tempDir, "data/dry-runs/2026-03-30/stale-submission.json"))
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("candidate queue prefers source and beat patterns that match brief winners", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });
    await mkdir("data/state", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-03-29.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T00:00:00Z",
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/state/brief-agent-behavior.json",
      JSON.stringify({
        kind: "brief_agent_behavior",
        updatedAt: "2026-03-29T00:00:00Z",
        agents: [
          {
            agent: "Royal Wolf",
            wins: 5,
            beats: ["Onboarding", "Distribution"],
            sameDayMultiWins: 2,
            commonSourceDomains: [{ domain: "aibtc.com", count: 4 }]
          },
          {
            agent: "News Hawk",
            wins: 3,
            beats: ["Onboarding"],
            sameDayMultiWins: 1,
            commonSourceDomains: [{ domain: "aibtc.news", count: 3 }]
          }
        ],
        commonSourceDomains: [
          { domain: "aibtc.com", count: 6 },
          { domain: "aibtc.news", count: 4 }
        ]
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-29/pattern-match-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "pattern-match",
          beat: "Infrastructure",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "same day operator impact before broader visibility"
        },
        headline: "Infrastructure queue pressure rises before broader operator response",
        sources: [
          {
            source_url: "https://aibtc.com/api/heartbeat"
          }
        ],
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
      "data/dry-runs/2026-03-29/crowded-beat-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "crowded-beat",
          beat: "Onboarding",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "same day operator impact before broader visibility"
        },
        headline: "Onboarding story lands after routine ecosystem chatter",
        sources: [
          {
            source_url: "https://example.com/operator-note"
          }
        ],
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

    const ranked = await rankDryRunCandidates("2026-03-29");
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].candidateId, "pattern-match");
    assert.equal(ranked[1].candidateId, "crowded-beat");
    assert.ok(
      ranked[0].reasons.some((reason) => reason.includes("sources match domains that have recently won the brief"))
    );
    assert.ok(
      ranked[1].reasons.some((reason) => reason.includes("actively owned by repeat-winning agents"))
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("fetchCompetitorProfiles starts all tracked competitor history requests in parallel and rank preserves coverage", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const originalFetch = global.fetch;
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-30", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });
    await mkdir("data/config", { recursive: true });

    await writeFile(
      "data/config/tracked-competitors.json",
      JSON.stringify({
        trackedAgents: [
          { name: "Elegant Orb", btcAddress: "orb-address" },
          { name: "Thin Teal", btcAddress: "teal-address" },
          { name: "Dual Cougar", btcAddress: "cougar-address" },
          { name: "Secret Mars", btcAddress: "mars-address" }
        ],
        fetchLimitPerAgent: 25
      }),
      "utf8"
    );

    await writeFile(
      "data/experiments/optimization/2026-03-30.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-30",
        generatedAt: "2026-03-30T00:00:00Z",
        beatPreferences: [],
        beatCrowding: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: [],
        packagingAdjustments: {
          promoteBroadSameBeatPackaging: false,
          demoteNarrowFragmentPackaging: false
        }
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-30/competitor-covered-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "competitor-covered",
          beat: "security",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "an early same day signal before broader visibility"
        },
        headline: "OpenClaw remote code execution hits 40K deployments before most operators patch exposed agents",
        sources: [
          {
            source_url: "https://www.chainalysis.com/blog/test-incident/"
          }
        ],
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

    let fetchCalls = 0;
    let gateReleased = false;
    let releaseGate;
    const gate = new Promise((resolveGate) => {
      releaseGate = () => {
        gateReleased = true;
        resolveGate();
      };
    });

    global.fetch = async (url) => {
      fetchCalls += 1;
      const rawUrl = String(url);

      if (rawUrl.includes("aibtc.news/api/signals?status=brief_included")) {
        await gate;
        return {
          ok: true,
          json: async () => ({
            signals: [
              {
                headline: "OpenClaw remote code execution hits 40K deployments before operators patch exposed agents",
                agent_name: "Elegant Orb",
                beat: "security",
                brief_included_at: "2026-03-30T00:00:00Z"
              },
              {
                headline: "OpenClaw remote code execution exposes 40K agent deployments before teams patch",
                agent_name: "Thin Teal",
                beat: "security",
                brief_included_at: "2026-03-30T00:00:00Z"
              }
            ]
          })
        };
      }

      if (rawUrl.includes("aibtc.news/api/signals?agent=")) {
        await gate;
        const address = decodeURIComponent(rawUrl.split("agent=")[1].split("&")[0]);
        const headlinesByAddress = {
          "orb-address": [
            { headline: "OpenClaw remote code execution hits 40K deployments before operators patch exposed agents", beat: "security" }
          ],
          "teal-address": [
            { headline: "OpenClaw remote code execution exposes 40K agent deployments before teams patch", beat: "security" }
          ],
          "cougar-address": [
            { headline: "Bitcoin outflows accelerate before traders de-risk risk assets", beat: "agent-trading" }
          ],
          "mars-address": [
            { headline: "Wallet agents rebalance after new x402 yield path opens", beat: "bitcoin-yield" }
          ]
        };
        return {
          ok: true,
          json: async () => ({ signals: headlinesByAddress[address] ?? [] })
        };
      }

      if (rawUrl === "https://aibtc.news/api/signals") {
        await gate;
        return { ok: true, json: async () => ({ signals: [] }) };
      }

      throw new Error(`Unexpected fetch URL in test: ${rawUrl}`);
    };

    const profilesPromise = fetchCompetitorProfiles(tempDir);
    for (let attempt = 0; attempt < 20 && fetchCalls === 0; attempt += 1) {
      await new Promise((resolveNow) => setTimeout(resolveNow, 5));
    }
    assert.equal(gateReleased, false);
    assert.equal(fetchCalls, 5);

    releaseGate();
    const profiles = await profilesPromise;
    assert.equal(profiles.length, 4);
    assert.deepEqual(profiles.map((profile) => profile.name), [
      "Elegant Orb",
      "Thin Teal",
      "Dual Cougar",
      "Secret Mars"
    ]);

    global.fetch = async (url) => {
      const rawUrl = String(url);

      if (rawUrl.includes("aibtc.news/api/signals?status=brief_included")) {
        return {
          ok: true,
          json: async () => ({
            signals: [
              {
                headline: "OpenClaw remote code execution hits 40K deployments before operators patch exposed agents",
                agent_name: "Elegant Orb",
                beat: "security",
                brief_included_at: "2026-03-30T00:00:00Z"
              },
              {
                headline: "OpenClaw remote code execution exposes 40K agent deployments before teams patch",
                agent_name: "Thin Teal",
                beat: "security",
                brief_included_at: "2026-03-30T00:00:00Z"
              }
            ]
          })
        };
      }

      if (rawUrl.includes("aibtc.news/api/signals?agent=")) {
        const address = decodeURIComponent(rawUrl.split("agent=")[1].split("&")[0]);
        const headlinesByAddress = {
          "orb-address": [
            { headline: "OpenClaw remote code execution hits 40K deployments before operators patch exposed agents", beat: "security" }
          ],
          "teal-address": [
            { headline: "OpenClaw remote code execution exposes 40K agent deployments before teams patch", beat: "security" }
          ],
          "cougar-address": [
            { headline: "Bitcoin outflows accelerate before traders de-risk risk assets", beat: "agent-trading" }
          ],
          "mars-address": [
            { headline: "Wallet agents rebalance after new x402 yield path opens", beat: "bitcoin-yield" }
          ]
        };
        return {
          ok: true,
          json: async () => ({ signals: headlinesByAddress[address] ?? [] })
        };
      }

      if (rawUrl === "https://aibtc.news/api/signals") {
        return { ok: true, json: async () => ({ signals: [] }) };
      }

      throw new Error(`Unexpected fetch URL in test: ${rawUrl}`);
    };

    const ranked = await rankDryRunCandidates("2026-03-30");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].competitorCoverage.length, 2);
    assert.ok(
      ranked[0].reasons.includes("story validated: 2 tracked competitors also covering this (Elegant Orb, Thin Teal) — strong brief candidate, ensure angle is differentiated")
    );

    const filingQueue = await buildFilingQueue("2026-03-30", ranked);
    assert.equal(filingQueue.items[0].competitorCoverage.length, 2);
    assert.equal(filingQueue.items[0].competitorCoverage[0].name, "Elegant Orb");
    assert.equal(typeof filingQueue.items[0].competitorCoverage[0].similarity, "number");
  } finally {
    global.fetch = originalFetch;
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("approval-ready candidate gets unique-pick advantage when tracked competitors are absent", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const originalFetch = global.fetch;
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-30", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });
    await mkdir("data/config", { recursive: true });

    await writeFile(
      "data/config/tracked-competitors.json",
      JSON.stringify({
        trackedAgents: [
          { name: "Elegant Orb", btcAddress: "orb-address" },
          { name: "Thin Teal", btcAddress: "teal-address" },
          { name: "Dual Cougar", btcAddress: "cougar-address" },
          { name: "Secret Mars", btcAddress: "mars-address" }
        ]
      }),
      "utf8"
    );

    await writeFile(
      "data/experiments/optimization/2026-03-30.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-30",
        generatedAt: "2026-03-30T00:00:00Z",
        beatPreferences: [],
        beatCrowding: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: [],
        packagingAdjustments: {
          promoteBroadSameBeatPackaging: false,
          demoteNarrowFragmentPackaging: false
        }
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-30/unique-pick-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "unique-pick",
          beat: "security",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "an early same day signal before broader visibility"
        },
        headline: "Named exploit prints $23M before exchanges update risk controls",
        sources: [
          {
            source_url: "https://rekt.news/example"
          }
        ],
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

    global.fetch = async (url) => {
      const rawUrl = String(url);
      if (rawUrl.includes("aibtc.news/api/signals")) {
        return { ok: true, json: async () => ({ signals: [] }) };
      }
      throw new Error(`Unexpected fetch URL in test: ${rawUrl}`);
    };

    const ranked = await rankDryRunCandidates("2026-03-30");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].competitorCoverage.length, 0);
    assert.ok(ranked[0].reasons.includes("no tracked competitors on this story — unique pick advantage"));
  } finally {
    global.fetch = originalFetch;
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("brief-win boosts do not outrank a cleaner approval candidate below the approval floor", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });
    await mkdir("data/state", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-03-29.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T00:00:00Z",
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/state/brief-agent-behavior.json",
      JSON.stringify({
        kind: "brief_agent_behavior",
        updatedAt: "2026-03-29T00:00:00Z",
        agents: [
          {
            agent: "Royal Wolf",
            wins: 5,
            beats: ["Onboarding"],
            sameDayMultiWins: 2,
            commonSourceDomains: [{ domain: "aibtc.com", count: 4 }]
          }
        ],
        commonSourceDomains: [{ domain: "aibtc.com", count: 6 }]
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-29/clean-approval-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "clean-approval",
          beat: "Infrastructure",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "same day operator impact before broader visibility"
        },
        headline: "Infrastructure bottleneck appears before operators widen mitigations",
        sources: [
          {
            source_url: "https://example.org/report"
          }
        ],
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
      "data/dry-runs/2026-03-29/brief-shaped-but-not-ready-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "brief-shaped-but-not-ready",
          beat: "Onboarding",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "same day operator impact before broader visibility"
        },
        headline: "Onboarding surge appears before the network catches up",
        sources: [
          {
            source_url: "https://aibtc.com/api/agents"
          }
        ],
        submission_decision: { status: "submit", rejection_reasons: [] },
        editorial_review: {
          editorial_fit: "borderline",
          publisher_confidence: "low",
          ready_to_file: true,
          hold_reasons: ["publisher_review_needed"]
        }
      }),
      "utf8"
    );

    const ranked = await rankDryRunCandidates("2026-03-29");
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].candidateId, "clean-approval");
    assert.equal(ranked[1].candidateId, "brief-shaped-but-not-ready");
    assert.ok(
      ranked[1].reasons.includes(
        "brief-win pattern signals were observed but ignored because the candidate has not cleared the approval-quality floor"
      )
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("historical brief strategy seeds boost candidates that match saved winning patterns", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });
    await mkdir("data/brief-history", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-03-29.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T00:00:00Z",
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/brief-history/top-correspondent-strategy.json",
      JSON.stringify({
        kind: "historical_brief_seed",
        label: "top_correspondent_strategy_patterns",
        notes: [
          "Infrastructure, security, onboarding, agent economy, and agent trading dominated March 23 to March 28 brief slots.",
          "The strongest winning shape is release or PR plus operator consequence.",
          "Another strong winning shape is leaderboard, registry, or API data plus a structural pattern such as saturation or bottlenecks.",
          "Top correspondents consistently anchor headlines and leads with exact numbers, versions, thresholds, blocks, PR numbers, release tags, counts, or timing windows."
        ]
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-29/historical-pattern-match-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "historical-pattern-match",
          beat: "Infrastructure",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "PR #325 exposes a queue bottleneck and agents should upgrade before broader failure spreads"
        },
        headline: "PR #325 exposes 2 infrastructure queue bottlenecks before operators widen mitigations",
        sources: [
          {
            source_url: "https://github.com/aibtcdev/agent-news/pull/325"
          }
        ],
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

    const ranked = await rankDryRunCandidates("2026-03-29");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].candidateId, "historical-pattern-match");
    assert.ok(
      ranked[0].reasons.some((reason) => reason.includes("historical brief-winning lanes"))
    );
    assert.ok(
      ranked[0].reasons.some((reason) => reason.includes("historical release-plus-operator-consequence winning shape"))
    );
    assert.ok(
      ranked[0].reasons.some((reason) => reason.includes("historical structural-pattern winning shape"))
    );
    assert.ok(
      ranked[0].reasons.some((reason) => reason.includes("exact numeric or version anchors"))
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("paired releases prefer the broader primary upgrade story over the companion artifact", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-03-29.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T00:00:00Z",
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-29/stacks-core-3-4-0-0-0-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "stacks-core-3-4-0-0-0",
          beat: "infrastructure",
          summary: "Required Stacks node upgrade before activation at Bitcoin block 943,333.",
          causality: "stacks-core published 3.4.0.0.0 and operators must upgrade before block 943,333 or require genesis sync",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "required upgrade before Bitcoin block 943,333"
        },
        headline: "stacks-core ships 3.4.0.0.0 before activation at Bitcoin block 943,333",
        proof: [
          {
            query_result: "This is a required upgrade. Activation is estimated for April 2, 2026 around 2000 UTC, or Bitcoin block 943,333."
          }
        ],
        sources: [
          {
            source_type: "documentation",
            source_url: "https://github.com/stacks-network/stacks-core/releases/tag/3.4.0.0.0"
          }
        ],
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
      "data/dry-runs/2026-03-29/stacks-core-signer-3-4-0-0-0-0-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "stacks-core-signer-3-4-0-0-0-0",
          beat: "infrastructure",
          summary: "Companion signer release for the same activation block 943,333.",
          causality: "stacks-core published signer-3.4.0.0.0.0 before block 943,333",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "required upgrade before Bitcoin block 943,333"
        },
        headline: "stacks-core ships signer-3.4.0.0.0.0 before activation at Bitcoin block 943,333",
        proof: [
          {
            query_result: "This is a required upgrade. Activation is estimated for April 2, 2026 around 2000 UTC, or Bitcoin block 943,333."
          }
        ],
        sources: [
          {
            source_type: "documentation",
            source_url: "https://github.com/stacks-network/stacks-core/releases/tag/signer-3.4.0.0.0.0"
          }
        ],
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

    const ranked = await rankDryRunCandidates("2026-03-29");
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].candidateId, "stacks-core-3-4-0-0-0");
    assert.ok(
      ranked[0].reasons.includes("paired-release cluster detected; this is the broader primary release story")
    );
    assert.ok(
      ranked[1].reasons.includes(
        "paired-release cluster detected; this companion release is better folded into the broader primary story"
      )
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("generic live-feed stories are penalized below filing-ready operator releases", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-03-29.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T00:00:00Z",
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-29/operator-release-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "operator-release",
          beat: "infrastructure",
          summary: "Required upgrade before the next settlement window.",
          causality: "release landed and operators should upgrade before the next settlement window",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "operators should upgrade before the next settlement window"
        },
        headline: "Infrastructure release lands before the next settlement window",
        proof: [
          {
            query_result: "This is a required upgrade before the next settlement window."
          }
        ],
        sources: [
          {
            source_type: "documentation",
            source_url: "https://github.com/aibtcdev/agent-news/releases/tag/v1.18.0"
          }
        ],
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
      "data/dry-runs/2026-03-29/generic-live-feed-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "generic-live-feed",
          beat: "security",
          summary: "Large external incident was published.",
          causality: "Example publication published this event on 2026-03-29",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "Large external incident was published."
        },
        headline: "External security incident lands in the news cycle",
        sources: [
          {
            source_type: "live-feed",
            source_url: "https://example.com/security-incident"
          }
        ],
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

    const ranked = await rankDryRunCandidates("2026-03-29");
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].candidateId, "operator-release");
    assert.ok(
      ranked[1].reasons.includes("external story still reads descriptive rather than like a filing-ready operator signal")
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("style performance promotion outranks demoted styles", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-style-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-03-29.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T00:00:00Z",
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [
          {
            style: "release_operator_consequence",
            submissions: 2,
            resolvedSubmissions: 2,
            approvals: 2,
            inBriefWins: 1,
            approvalRate: 1,
            briefIncludedRate: 0.5,
            satsEarned: 500,
            preference: "promote",
            rationale: "Winning style"
          },
          {
            style: "single_story_operator_angle",
            submissions: 2,
            resolvedSubmissions: 2,
            approvals: 1,
            inBriefWins: 0,
            approvalRate: 0.5,
            briefIncludedRate: 0,
            satsEarned: 0,
            preference: "demote",
            rationale: "Approved but not winning"
          }
        ],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-29/promoted-style-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "promoted-style",
          beat: "infrastructure",
          summary: "Required upgrade before the next settlement window.",
          causality: "release landed and operators should upgrade before the next settlement window",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "operators should upgrade before the next settlement window"
        },
        headline: "Infrastructure release lands before the next settlement window",
        sources: [
          {
            source_type: "documentation",
            source_url: "https://github.com/aibtcdev/agent-news/releases/tag/v1.18.0"
          }
        ],
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
      "data/dry-runs/2026-03-29/demoted-style-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "demoted-style",
          beat: "infrastructure",
          summary: "Operator update published.",
          causality: "change landed",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "operator update is visible"
        },
        headline: "Operator update lands",
        sources: [
          {
            source_type: "documentation",
            source_url: "https://example.com/update"
          }
        ],
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

    const ranked = await rankDryRunCandidates("2026-03-29");
    assert.equal(ranked[0].candidateId, "promoted-style");
    assert.ok(ranked[0].reasons.includes("style release_operator_consequence is converting into In Brief and is currently promoted"));
    assert.ok(ranked[1].reasons.includes("style single_story_operator_angle is underperforming against the real KPI and is currently demoted"));
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("packaging adjustments promote broader same-beat stories over narrow crowded fragments", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-scoring-packaging-"));
  process.chdir(tempDir);

  try {
    await mkdir("data/dry-runs/2026-03-29", { recursive: true });
    await mkdir("data/experiments/optimization", { recursive: true });
    await mkdir("data/state", { recursive: true });

    await writeFile(
      "data/experiments/optimization/2026-03-29.json",
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T00:00:00Z",
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [],
        packagingAdjustments: {
          promoteBroadSameBeatPackaging: true,
          demoteNarrowFragmentPackaging: true,
          rationale: ["Recent losses went to broader same-beat packaging."]
        },
        beatCrowding: [{ beat: "Onboarding", crowdingScore: 60, publishedConversionRate: 0.1, duplicateLosses: 2 }],
        nextDayRecommendations: []
      }),
      "utf8"
    );

    await writeFile(
      "data/state/brief-agent-behavior.json",
      JSON.stringify({
        kind: "brief_agent_behavior",
        updatedAt: "2026-03-29T00:00:00Z",
        agents: [
          {
            agent: "Royal Wolf",
            wins: 5,
            beats: ["Onboarding"],
            sameDayMultiWins: 2,
            commonSourceDomains: [{ domain: "aibtc.com", count: 4 }]
          }
        ],
        commonSourceDomains: [{ domain: "aibtc.com", count: 6 }]
      }),
      "utf8"
    );

    await writeFile(
      "data/dry-runs/2026-03-29/broad-package-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "broad-package",
          beat: "Onboarding",
          summary: "Two onboarding cohorts moved in one cycle.",
          causality: "operators should respond because two onboarding cohorts moved in one cycle",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "same day operator impact before broader visibility"
        },
        headline: "2 onboarding cohorts move together and operators should respond before queues widen",
        sources: [{ source_url: "https://aibtc.com/api/agents" }],
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
      "data/dry-runs/2026-03-29/narrow-fragment-submission.json",
      JSON.stringify({
        candidate_signal: {
          candidate_id: "narrow-fragment",
          beat: "Onboarding",
          summary: "One onboarding metric changed.",
          causality: "change landed",
          likely_duplicate: false,
          uses_dashboard_as_primary_source: false,
          significance: "same day operator impact before broader visibility"
        },
        headline: "Onboarding metric changes",
        sources: [{ source_url: "https://example.com/update" }],
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

    const ranked = await rankDryRunCandidates("2026-03-29");
    assert.equal(ranked[0].candidateId, "broad-package");
    assert.ok(ranked[0].reasons.includes("recent loss memory says broader same-beat packaging should be promoted"));
    assert.ok(ranked[1].reasons.includes("recent loss memory says narrow same-beat fragments should be demoted in crowded lanes"));
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
