import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  loadBriefExamplesMemory,
  loadCompetitionMemory,
  loadEditorialMemory,
  loadObjectiveMemory
} from "../learning/index.js";

export interface DailyStrategySnapshot {
  kind: "daily_strategy_snapshot";
  reportDate: string;
  generatedAt: string;
  sourceDocs: string[];
  priorities: string[];
  sourceLanes: string[];
  competitionRules: string[];
  antiPatterns: string[];
  historicalNotes: string[];
  editorialRules: string[];
}

export async function buildDailyStrategySnapshot(
  reportDate: string,
  generatedAt: string,
  baseDir?: string
): Promise<DailyStrategySnapshot> {
  const [objective, editorial, competition, briefExamples, optimizationModule] = await Promise.all([
    loadObjectiveMemory(baseDir),
    loadEditorialMemory(baseDir),
    loadCompetitionMemory(baseDir),
    loadBriefExamplesMemory(baseDir),
    import("../loop/optimization.js")
  ]);
  const optimization = await optimizationModule.readDailyOptimizationSnapshot(reportDate, { baseDir });

  return {
    kind: "daily_strategy_snapshot",
    reportDate,
    generatedAt,
    sourceDocs: unique([
      ...objective.sourcePaths,
      editorial.sourcePath,
      ...competition.sourcePaths,
      ...briefExamples.sourcePaths
    ]),
    priorities: unique([
      objective.mainKpi,
      ...objective.pressureNotes,
      ...editorial.qualityBar,
      ...editorial.focusAreas.map((entry) => `${entry.label}: ${entry.action}`)
    ]).slice(0, 8),
    sourceLanes: unique([
      ...competition.convertingSourcePatterns,
      ...editorial.factCheckerGate.standards,
      ...(optimization?.editorialLearnings?.sourcingRules ?? [])
    ]).slice(0, 10),
    competitionRules: unique([
      ...competition.crowdingNotes,
      ...competition.crowdedBeats.map((entry) => `${entry.beat}: ${entry.reasons[0] ?? "crowded lane"}`),
      ...competition.beatOwners.slice(0, 3).map((entry) => `${entry.agent} is winning ${entry.beats.join(", ")}`),
      ...(optimization?.editorialLearnings?.competitionRules ?? []),
      ...(optimization?.editorialLearnings?.specializationRules ?? []),
      ...(optimization?.editorialLearnings?.timingRules ?? [])
    ]).slice(0, 8),
    antiPatterns: unique([
      ...briefExamples.recentLosses.map((entry) => entry.whyItLost),
      ...editorial.preFilingChecks.map((entry) => entry.rule)
    ]).slice(0, 8),
    historicalNotes: unique([
      ...briefExamples.recentWinners.map((entry) => `${entry.headline} — ${entry.whyItWorked}`),
      ...briefExamples.repairedPatternsThatLaterWorked,
      ...(optimization?.editorialLearnings?.structuralRules ?? [])
    ]).slice(0, 8),
    editorialRules: unique([
      ...(optimization?.editorialLearnings?.structuralRules ?? []),
      ...(optimization?.editorialLearnings?.sourcingRules ?? []),
      ...(optimization?.editorialLearnings?.timingRules ?? []),
      ...(optimization?.editorialLearnings?.specializationRules ?? []),
      ...(optimization?.editorialLearnings?.competitionRules ?? [])
    ]).slice(0, 12)
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function buildStrategyNotes(snapshot: DailyStrategySnapshot): string[] {
  const notes: string[] = [];

  if (snapshot.priorities[0]) {
    notes.push(`Daily strategy priority: ${snapshot.priorities[0]}`);
  }
  if (snapshot.competitionRules[0]) {
    notes.push(`Competition rule: ${snapshot.competitionRules[0]}`);
  }
  if (snapshot.sourceLanes[0]) {
    notes.push(`Source lane to favor: ${snapshot.sourceLanes[0]}`);
  }
  if (snapshot.antiPatterns[0]) {
    notes.push(`Avoid this pattern: ${snapshot.antiPatterns[0]}`);
  }
  if (snapshot.historicalNotes[0]) {
    notes.push(`Historical brief pattern: ${snapshot.historicalNotes[0]}`);
  }
  if (snapshot.editorialRules[0]) {
    notes.push(`Editorial learning: ${snapshot.editorialRules[0]}`);
  }

  return notes;
}

export async function saveDailyStrategySnapshot(
  snapshot: DailyStrategySnapshot,
  baseDir?: string
): Promise<string> {
  const filePath = resolve(
    baseDir ?? process.cwd(),
    `data/reports/strategy/${snapshot.reportDate}.json`
  );
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  return filePath;
}
