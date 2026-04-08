import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { DailyCompetitorReview, DailyOptimizationSnapshot } from "../types/index.js";
import { fetchCompetitorProfiles, type CompetitorProfile } from "../brief/winner-tracker.js";

interface BriefWinnerSnapshot {
  winners?: Array<{
    agent: string;
    appearances: number;
    beats: string[];
    headlines: string[];
  }>;
}

interface TopCompetitorStylesSnapshot {
  competitors?: Array<{
    agent: string;
    wins: number;
    beats: string[];
    sameDayMultiWins: number;
    commonSourceDomains: Array<{ domain: string; count: number }>;
    styleLabel: string;
    styleReason: string;
  }>;
}

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function buildCopyTomorrow(
  winnerSnapshot: BriefWinnerSnapshot | null,
  competitorStyles: TopCompetitorStylesSnapshot | null,
  optimization: DailyOptimizationSnapshot | null
): string[] {
  const copyTomorrow: string[] = [];
  const topWinner = winnerSnapshot?.winners?.[0] ?? null;
  const topStyle = competitorStyles?.competitors?.[0] ?? null;
  const topCompetitorRecommendation = optimization?.competitorIntel?.recommendations?.[0] ?? null;

  if (topWinner) {
    copyTomorrow.push(
      `Study ${topWinner.agent}: ${topWinner.appearances} same-day win${topWinner.appearances === 1 ? "" : "s"} across ${topWinner.beats.join(", ")}.`
    );
  }

  if (topStyle) {
    copyTomorrow.push(
      `Copy the ${topStyle.styleLabel} shape when it fits: ${topStyle.styleReason}`
    );
  }

  if (topCompetitorRecommendation) {
    copyTomorrow.push(topCompetitorRecommendation);
  }

  if (optimization?.packagingAdjustments?.promoteBroadSameBeatPackaging) {
    copyTomorrow.push("Favor broader same-beat packaging when the lane is crowded and the winner is taking the slot with a bigger story shape.");
  }

  if (copyTomorrow.length === 0) {
    copyTomorrow.push("Competitor data is thin today; keep collecting winner examples before making a large style change.");
  }

  return copyTomorrow;
}

function buildStopDoing(
  winnerSnapshot: BriefWinnerSnapshot | null,
  optimization: DailyOptimizationSnapshot | null
): string[] {
  const stopDoing: string[] = [];
  const repeatWinner = winnerSnapshot?.winners?.find((winner) => winner.appearances > 1) ?? null;
  const demotedStyle = optimization?.stylePerformance?.find((style) => style.preference === "demote") ?? null;

  if (repeatWinner) {
    stopDoing.push(
      `Stop filing narrow same-beat fragments into lanes ${repeatWinner.agent} is already winning repeatedly unless our package is broader or more operationally urgent.`
    );
  }

  if (optimization?.packagingAdjustments?.demoteNarrowFragmentPackaging) {
    stopDoing.push("Stop shipping narrow component-only updates when recent misses show the brief slot is going to broader same-beat packaging.");
  }

  if (demotedStyle) {
    stopDoing.push(`Stop leaning on ${demotedStyle.style} as a default until it proves it can convert into real In Brief wins.`);
  }

  const topFailurePattern = optimization?.topCandidatePerformance?.commonFailurePatterns?.[0] ?? null;
  if (topFailurePattern) {
    stopDoing.push(`Stop repeating the recent top-candidate failure mode: ${topFailurePattern}.`);
  }

  if (stopDoing.length === 0) {
    stopDoing.push("No dominant competitor-loss pattern is recorded yet; keep reviewing daily brief winners for sharper stop-doing rules.");
  }

  return stopDoing;
}

function renderTrackedCompetitorSection(profiles: CompetitorProfile[]): string[] {
  if (profiles.length === 0) {
    return ["- No tracked competitor data available."];
  }
  return profiles.flatMap((profile) => {
    const beatList = profile.beatsWon.length > 0
      ? profile.beatsWon.map((b) => `${b.beat}(${b.count})`).join(", ")
      : "unknown";
    const rate = profile.totalSignals > 0
      ? `${profile.publishedCount}/${profile.totalSignals} published (${profile.publicationRate}%)`
      : "no data";
    const lines = [
      `- **${profile.name}** (${profile.twitter}): ${rate}`,
      `  - Beats won: ${beatList}`,
    ];
    if (profile.topHeadlines.length > 0) {
      lines.push(`  - Published headlines:`);
      for (const headline of profile.topHeadlines) {
        lines.push(`    - "${headline}"`);
      }
    }
    if (profile.sourceDomains.length > 0) {
      lines.push(`  - Source domains: ${profile.sourceDomains.map((d) => `${d.domain}(${d.count})`).join(", ")}`);
    }
    lines.push(`  - Notes: ${profile.notes}`);
    return lines;
  });
}

function renderMarkdown(review: DailyCompetitorReview, profiles: CompetitorProfile[]): string {
  return [
    `# Competitor Review: ${review.reportDate}`,
    "",
    `Generated at: ${review.generatedAt}`,
    "",
    "## Tracked Competitors (All-Time Profile)",
    ...renderTrackedCompetitorSection(profiles),
    "",
    "## Who Won Today",
    ...(review.whoWonToday.length === 0
      ? ["- No winner data was available for this report date."]
      : review.whoWonToday.map((winner) =>
          `- ${winner.agent}: ${winner.appearances} win(s) across ${winner.beats.join(", ")} — ${winner.headlines.join(" | ")}`
        )),
    "",
    "## What Style They Used",
    ...(review.stylesUsed.length === 0
      ? ["- No formalized competitor style labels were available."]
      : review.stylesUsed.map((style) =>
          `- ${style.agent}: ${style.styleLabel} — ${style.styleReason}`
        )),
    "",
    "## What To Copy Tomorrow",
    ...review.copyTomorrow.map((line) => `- ${line}`),
    "",
    "## What To Stop Doing",
    ...review.stopDoing.map((line) => `- ${line}`),
    ""
  ].join("\n");
}

export async function generateDailyCompetitorReview(
  reportDate: string,
  generatedAt: string,
  baseDir?: string
): Promise<{ review: DailyCompetitorReview; profiles: CompetitorProfile[] }> {
  const root = resolve(baseDir ?? process.cwd());
  const [winnerSnapshot, competitorStyles, optimization, profiles] = await Promise.all([
    readJsonOrNull<BriefWinnerSnapshot>(resolve(root, `data/state/brief-winners-${reportDate}.json`)),
    readJsonOrNull<TopCompetitorStylesSnapshot>(resolve(root, "data/state/top_5_competitor_styles.json")),
    readJsonOrNull<DailyOptimizationSnapshot>(resolve(root, `data/experiments/optimization/${reportDate}.json`)),
    fetchCompetitorProfiles(root)
  ]);

  const whoWonToday = (winnerSnapshot?.winners ?? [])
    .map((winner) => ({
      agent: winner.agent,
      appearances: winner.appearances,
      beats: winner.beats,
      headlines: winner.headlines
    }))
    .sort((left, right) => right.appearances - left.appearances || left.agent.localeCompare(right.agent));

  const stylesUsed = (competitorStyles?.competitors ?? [])
    .map((competitor) => ({
      agent: competitor.agent,
      styleLabel: competitor.styleLabel,
      styleReason: competitor.styleReason,
      beats: competitor.beats
    }))
    .sort((left, right) => left.agent.localeCompare(right.agent));

  const review: DailyCompetitorReview = {
    kind: "daily_competitor_review",
    reportDate,
    generatedAt,
    whoWonToday,
    stylesUsed,
    copyTomorrow: buildCopyTomorrow(winnerSnapshot, competitorStyles, optimization),
    stopDoing: buildStopDoing(winnerSnapshot, optimization)
  };
  return { review, profiles };
}

export async function saveDailyCompetitorReview(
  review: DailyCompetitorReview,
  profiles: CompetitorProfile[],
  baseDir?: string
): Promise<{ jsonPath: string; markdownPath: string }> {
  const root = resolve(baseDir ?? process.cwd());
  const jsonPath = resolve(root, `data/reports/competitor-review/${review.reportDate}.json`);
  const markdownPath = resolve(root, `data/reports/competitor-review/${review.reportDate}.md`);
  await mkdir(dirname(jsonPath), { recursive: true });
  const jsonPayload = { ...review, trackedCompetitorProfiles: profiles };
  await writeFile(jsonPath, JSON.stringify(jsonPayload, null, 2), "utf8");
  await writeFile(markdownPath, renderMarkdown(review, profiles), "utf8");
  return { jsonPath, markdownPath };
}
