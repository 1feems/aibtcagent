import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  generateDailyCompetitorReview,
  saveDailyCompetitorReview
} from "../dist/ops/index.js";

test("competitor review outputs who won, style used, what to copy, and what to stop doing", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-competitor-review-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/experiments/optimization"), { recursive: true });

    await writeFile(
      resolve(tempDir, "data/state/brief-winners-2026-03-29.json"),
      JSON.stringify({
        kind: "brief_winner_snapshot",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T23:00:00Z",
        winners: [
          {
            agent: "Royal Wolf",
            appearances: 2,
            beats: ["Distribution", "Onboarding"],
            headlines: [
              "3 of 5 New AIBTC Agents Register via Auto Referral Batch",
              "3 AIBTC Agents Broadcast Claim Codes on X in 1 Day"
            ]
          }
        ]
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/state/top_5_competitor_styles.json"),
      JSON.stringify({
        kind: "top_competitor_styles",
        reportDate: "2026-03-29",
        updatedAt: "2026-03-29T23:00:00Z",
        competitors: [
          {
            agent: "Royal Wolf",
            wins: 5,
            beats: ["Distribution", "Onboarding"],
            sameDayMultiWins: 2,
            commonSourceDomains: [{ domain: "aibtc.com", count: 4 }],
            styleLabel: "cross_beat_operator_packaging",
            styleReason: "Repeated same-day multi-wins across multiple beats suggest broader packaging."
          }
        ]
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/experiments/optimization/2026-03-29.json"),
      JSON.stringify({
        kind: "daily_optimization",
        reportDate: "2026-03-29",
        generatedAt: "2026-03-29T23:00:00Z",
        successMetrics: {
          targetInBriefWins: 5,
          inBriefWins: 1,
          satsEarned: 500,
          btcRewards: ["0.00000500"],
          targetMet: false,
          successDefinition: "Success means getting paid and landing In Brief; approvals alone do not count."
        },
        beatPreferences: [],
        rejectionThreshold: { mode: "standard", drivers: [] },
        duplicateLossPatterns: [],
        winningHeadlinePatterns: [],
        trainingWinningTags: [],
        trainingRejectionTags: [],
        stylePerformance: [
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
        packagingAdjustments: {
          promoteBroadSameBeatPackaging: true,
          demoteNarrowFragmentPackaging: true,
          rationale: ["Recent losses went to broader same-beat packaging."]
        },
        beatCrowding: [],
        competitorIntel: {
          topAgents: [],
          topSourceDomains: [],
          ownedBeats: ["Onboarding"],
          recommendations: ["Study Royal Wolf; same-day multi-win packaging is beating narrower stories."]
        },
        topCandidatePerformance: {
          recentTopCandidates: [],
          approvalRate: null,
          publicationRate: null,
          commonFailurePatterns: ["top candidates are still losing to broader same-beat competitors"],
          recommendations: []
        },
        nextDayRecommendations: []
      }),
      "utf8"
    );

    const { review, profiles } = await generateDailyCompetitorReview(
      "2026-03-29",
      "2026-03-29T23:10:00Z",
      tempDir
    );

    assert.equal(review.whoWonToday[0].agent, "Royal Wolf");
    assert.equal(review.stylesUsed[0].styleLabel, "cross_beat_operator_packaging");
    assert.ok(review.copyTomorrow.some((line) => /Study Royal Wolf/i.test(line)));
    assert.ok(review.copyTomorrow.some((line) => /Copy the cross_beat_operator_packaging shape/i.test(line)));
    assert.ok(review.stopDoing.some((line) => /Stop filing narrow same-beat fragments/i.test(line)));
    assert.ok(review.stopDoing.some((line) => /Stop leaning on single_story_operator_angle/i.test(line)));

    const savedPaths = await saveDailyCompetitorReview(review, profiles, tempDir);
    const saved = JSON.parse(await readFile(savedPaths.jsonPath, "utf8"));
    assert.equal(saved.kind, "daily_competitor_review");
    const markdown = await readFile(savedPaths.markdownPath, "utf8");
    assert.match(markdown, /Who Won Today/);
    assert.match(markdown, /What Style They Used/);
    assert.match(markdown, /What To Copy Tomorrow/);
    assert.match(markdown, /What To Stop Doing/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
