import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  refreshBriefExamplesMemory,
  refreshCompetitionMemory,
  refreshObjectiveMemory
} from "./context-memory.js";
import { refreshBuildPlanMemory, getBuildPlanMemoryPath } from "./build-plan-memory.js";
import { refreshEditorialMemory } from "./editorial-memory.js";
import { refreshOutcomeFeedbackMemory } from "./outcome-feedback.js";
import { readRepairMemory } from "./repair-memory.js";

export interface MemoryIndex {
  generatedAt: string;
  authorityOrder: Array<{
    rank: number;
    path: string;
    role: string;
  }>;
  refreshSource: string;
}

export interface RuntimeMemorySyncResult {
  buildPlanMemoryPath: string;
  objectiveMemoryPath: string;
  editorialMemoryPath: string;
  competitionMemoryPath: string;
  briefExamplesMemoryPath: string;
  outcomeFeedbackMemoryPath: string;
  leaderboardMemoryPath: string;
  repairMemoryPath: string;
  memoryIndexPath: string;
}

function getMemoryIndexPath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/memory-index.json");
}

async function writeMemoryIndex(refreshSource: string, baseDir?: string): Promise<string> {
  const root = resolve(baseDir ?? process.cwd());
  const index: MemoryIndex = {
    generatedAt: new Date().toISOString(),
    refreshSource,
    authorityOrder: [
      {
        rank: 1,
        path: "data/state/objective-memory.json",
        role: "objective economics, payout, leaderboard, streak, and slot-pressure context"
      },
      {
        rank: 2,
        path: "data/state/editorial-memory.json",
        role: "editorial context plus Publisher and Fact-Checker hard gates"
      },
      {
        rank: 3,
        path: "data/state/competition-memory.json",
        role: "crowded beats, beat owners, winning story shapes, and converting source patterns"
      },
      {
        rank: 4,
        path: "data/state/brief-examples.json",
        role: "recent winners, recent losses, and side-by-side examples of what good looks like"
      },
      {
        rank: 5,
        path: "data/state/outcome-feedback-memory.json",
        role: "normalized machine labels from publisher outcomes feeding the context layers"
      },
      {
        rank: 6,
        path: "data/state/leaderboard-memory.json",
        role: "raw leaderboard snapshot referenced by objective-memory"
      },
      {
        rank: 7,
        path: "data/state/repairable-candidates.json",
        role: "repair contracts for fix-and-resubmit signals"
      },
      {
        rank: 8,
        path: "data/state/filed-signals.json",
        role: "filing history state used to compile runtime memory"
      },
      {
        rank: 9,
        path: "data/outcomes/",
        role: "raw real-world outcome records used to compile runtime memory"
      },
      {
        rank: 10,
        path: "data/training/",
        role: "training examples derived from outcomes"
      },
      {
        rank: 11,
        path: "memory/learnings.md",
        role: "human-readable rendered archive, not the runtime authority"
      }
    ]
  };

  const outputPath = getMemoryIndexPath(root);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return outputPath;
}

export async function syncRuntimeMemory(refreshSource: string, baseDir?: string): Promise<RuntimeMemorySyncResult> {
  const root = resolve(baseDir ?? process.cwd());
  await Promise.all([
    refreshBuildPlanMemory(root),
    refreshOutcomeFeedbackMemory(root),
    refreshObjectiveMemory(root),
    refreshCompetitionMemory(root),
    refreshBriefExamplesMemory(root)
  ]);
  await refreshEditorialMemory(root);
  const repairMemoryPath = resolve(root, "data/state/repairable-candidates.json");
  await readRepairMemory(root);
  const memoryIndexPath = await writeMemoryIndex(refreshSource, root);

  return {
    buildPlanMemoryPath: getBuildPlanMemoryPath(root),
    objectiveMemoryPath: resolve(root, "data/state/objective-memory.json"),
    editorialMemoryPath: resolve(root, "data/state/editorial-memory.json"),
    competitionMemoryPath: resolve(root, "data/state/competition-memory.json"),
    briefExamplesMemoryPath: resolve(root, "data/state/brief-examples.json"),
    outcomeFeedbackMemoryPath: resolve(root, "data/state/outcome-feedback-memory.json"),
    leaderboardMemoryPath: resolve(root, "data/state/leaderboard-memory.json"),
    repairMemoryPath,
    memoryIndexPath
  };
}
