// P30 — Multi-beat expansion
// Audits which beats have been filed on, identifies coverage gaps,
// and recommends adjacent beats where crossover signals exist.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FiledSignalRecord } from "../filing/state.js";

// Known platform beats (from aibtc.news/api/beats)
// Top agents cover 11–12; brief has 12 slots
const KNOWN_BEATS = [
  "infrastructure",
  "quantum",
  "agent-skills",
  "agent-economy",
  "governance",
  "security",
  "defi",
  "nfts",
  "runes",
  "ordinals",
  "sbtc",
  "stacking",
  "market"
] as const;

type KnownBeat = (typeof KNOWN_BEATS)[number];

// Adjacent beats where infrastructure signals have crossover potential
const ADJACENT_BEATS: Record<string, string[]> = {
  "infrastructure": ["agent-skills", "agent-economy", "security", "quantum"],
  "quantum": ["infrastructure", "security"],
  "agent-skills": ["infrastructure", "agent-economy"],
  "agent-economy": ["infrastructure", "agent-skills", "governance"],
  "governance": ["agent-economy", "sbtc", "stacking"],
  "security": ["infrastructure", "agent-skills", "quantum"],
  "defi": ["sbtc", "stacking", "agent-economy"],
  "sbtc": ["stacking", "defi", "governance"],
  "stacking": ["sbtc", "defi", "governance"],
  "runes": ["ordinals", "market"],
  "ordinals": ["runes", "market"],
  "nfts": ["ordinals", "market"],
  "market": ["defi", "sbtc", "runes"]
};

const MIN_BEATS_PER_WEEK = 3;
const TARGET_BEATS_PER_WEEK = 11;

interface FiledSignalsState {
  filedSignals: FiledSignalRecord[];
}

interface ObjectiveMemoryForBeatCoverage {
  specialistMode?: boolean;
  targetBeats?: string[];
  targetBeatsPerWeek?: number;
}

// ── Analysis ──────────────────────────────────────────────────────────────────

function getWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export interface BeatCoverageAnalysis {
  coveredBeats: string[];
  uncoveredBeats: string[];
  recentWeekBeats: string[];    // beats filed this calendar week
  recentWeekMeetsMin: boolean;  // >= MIN_BEATS_PER_WEEK
  gapToTarget: number;          // TARGET - recent week coverage
  minTarget: number;
  targetBeatsPerWeek: number;
  focusBeats: string[];
  specialistMode: boolean;
  adjacentOpportunities: Array<{ beat: string; adjacentTo: string[]; reason: string }>;
  recommendation: string;
}

export async function analyzeBeatCoverage(
  reportDate: string,
  baseDir?: string
): Promise<BeatCoverageAnalysis> {
  const path = resolve(baseDir ?? process.cwd(), "data/state/filed-signals.json");
  const objectivePath = resolve(baseDir ?? process.cwd(), "data/state/objective-memory.json");
  let records: FiledSignalRecord[] = [];
  let objectiveMemory: ObjectiveMemoryForBeatCoverage | null = null;
  try {
    const state = JSON.parse(await readFile(path, "utf8")) as FiledSignalsState;
    records = state.filedSignals ?? [];
  } catch { /* no state */ }
  try {
    objectiveMemory = JSON.parse(await readFile(objectivePath, "utf8")) as ObjectiveMemoryForBeatCoverage;
  } catch { /* no objective memory */ }

  const weekStart = getWeekStart(reportDate);
  const weekEnd = reportDate;
  const focusBeats = (objectiveMemory?.targetBeats ?? [])
    .map((beat) => beat.trim().toLowerCase())
    .filter((beat): beat is KnownBeat => KNOWN_BEATS.includes(beat as KnownBeat));
  const specialistMode = objectiveMemory?.specialistMode === true && focusBeats.length > 0;
  const minTarget = specialistMode
    ? Math.max(1, objectiveMemory?.targetBeatsPerWeek ?? focusBeats.length)
    : MIN_BEATS_PER_WEEK;
  const targetBeatsPerWeek = specialistMode
    ? Math.max(minTarget, objectiveMemory?.targetBeatsPerWeek ?? focusBeats.length)
    : TARGET_BEATS_PER_WEEK;

  // All-time covered beats
  const coveredBeats = [...new Set(
    records
      .map((r) => r.beat)
      .filter((b): b is string => !!b)
  )];

  // This week's beats
  const recentWeekBeats = [...new Set(
    records
      .filter((r) => {
        if (!r.filedAt) return false;
        const d = r.filedAt.slice(0, 10);
        return d >= weekStart && d <= weekEnd;
      })
      .map((r) => r.beat)
      .filter((b): b is string => !!b)
  )];

  const uncoveredBeats = KNOWN_BEATS.filter((b) => !coveredBeats.includes(b));
  const recentWeekMeetsMin = recentWeekBeats.length >= minTarget;
  const gapToTarget = Math.max(0, targetBeatsPerWeek - recentWeekBeats.length);

  // Find adjacent opportunities from primary covered beats
  const primaryBeats = focusBeats.length > 0 ? focusBeats : coveredBeats.slice(0, 3);
  const adjacentOpportunities: Array<{ beat: string; adjacentTo: string[]; reason: string }> = [];

  for (const beat of KNOWN_BEATS) {
    if (recentWeekBeats.includes(beat)) continue;
    const adjacentToCovered = primaryBeats.filter(
      (p) => ADJACENT_BEATS[p]?.includes(beat) || ADJACENT_BEATS[beat]?.includes(p)
    );
    if (adjacentToCovered.length > 0) {
      adjacentOpportunities.push({
        beat,
        adjacentTo: adjacentToCovered,
        reason: `Adjacent to ${adjacentToCovered.join(", ")} — crossover signals likely exist`
      });
    }
  }

  const recommendation = recentWeekBeats.length >= targetBeatsPerWeek
    ? specialistMode
      ? `Focused coverage on track: ${recentWeekBeats.length}/${targetBeatsPerWeek} target beats this week across ${focusBeats.join(", ")}`
      : `Good coverage: ${recentWeekBeats.length} beats this week — maintain diversification`
    : recentWeekMeetsMin
      ? specialistMode
        ? `Specialist coverage is active (${recentWeekBeats.length}/${minTarget}) with ${gapToTarget} focused beat slot(s) left this week. Priority: ${focusBeats.filter((beat) => !recentWeekBeats.includes(beat)).join(", ") || adjacentOpportunities.slice(0, 2).map((o) => o.beat).join(", ")}`
        : `Coverage meets minimum (${recentWeekBeats.length}/${minTarget}) but gap to top-agent pace: ${gapToTarget} more beats. Priority: ${adjacentOpportunities.slice(0, 2).map((o) => o.beat).join(", ")}`
      : specialistMode
        ? `FOCUS GAP: only ${recentWeekBeats.length}/${minTarget} target beats filed this week. File on ${focusBeats.filter((beat) => !recentWeekBeats.includes(beat)).join(", ") || "the remaining focus beats"} before expanding elsewhere`
        : `BELOW MINIMUM: only ${recentWeekBeats.length}/${minTarget} beats this week. File on at least ${minTarget - recentWeekBeats.length} more beats before end of week`;

  return {
    coveredBeats,
    uncoveredBeats,
    recentWeekBeats,
    recentWeekMeetsMin,
    gapToTarget,
    minTarget,
    targetBeatsPerWeek,
    focusBeats,
    specialistMode,
    adjacentOpportunities: adjacentOpportunities.slice(0, 4),
    recommendation
  };
}

export function formatBeatCoverageSection(analysis: BeatCoverageAnalysis): string {
  const lines: string[] = [
    `- This-week beats: ${analysis.recentWeekBeats.length > 0 ? analysis.recentWeekBeats.join(", ") : "none filed yet"}`,
    `- Min target: ${analysis.minTarget}/week | Strategic target: ${analysis.targetBeatsPerWeek}/week | Gap: ${analysis.gapToTarget}`,
    `- Focus beats: ${analysis.focusBeats.length > 0 ? analysis.focusBeats.join(", ") : "none configured"}`,
    `- All-time covered: ${analysis.coveredBeats.length} beats`,
    `- Untouched platform beats: ${analysis.uncoveredBeats.length > 0 ? analysis.uncoveredBeats.join(", ") : "none"}`,
    `- Recommendation: ${analysis.recommendation}`
  ];

  if (analysis.adjacentOpportunities.length > 0) {
    lines.push("- Adjacent expansion targets:");
    for (const opp of analysis.adjacentOpportunities) {
      lines.push(`  - ${opp.beat}: ${opp.reason}`);
    }
  }

  return lines.join("\n");
}
