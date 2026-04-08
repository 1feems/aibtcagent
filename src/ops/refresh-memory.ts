import { syncRuntimeMemory } from "../learning/index.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function runRefreshMemory(refreshSource = "github-memory-refresh"): Promise<void> {
  const result = await syncRuntimeMemory(refreshSource);
  process.stdout.write(`[refresh-memory] build plan memory: ${result.buildPlanMemoryPath}\n`);
  process.stdout.write(`[refresh-memory] objective memory: ${result.objectiveMemoryPath}\n`);
  process.stdout.write(`[refresh-memory] editorial memory: ${result.editorialMemoryPath}\n`);
  process.stdout.write(`[refresh-memory] competition memory: ${result.competitionMemoryPath}\n`);
  process.stdout.write(`[refresh-memory] brief examples: ${result.briefExamplesMemoryPath}\n`);
  process.stdout.write(`[refresh-memory] outcome feedback: ${result.outcomeFeedbackMemoryPath}\n`);
  process.stdout.write(`[refresh-memory] memory index: ${result.memoryIndexPath}\n`);
}

async function main(): Promise<void> {
  await runRefreshMemory(process.argv[2] ?? "github-memory-refresh");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
