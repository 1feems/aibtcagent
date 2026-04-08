import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface BuildPlanMemory {
  generatedAt: string;
  sourcePath: string;
  currentPriorityOrder: string[];
  activeRules: string[];
  partialRules: string[];
  plannedRules: string[];
}

export function getBuildPlanMemoryPath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/build-plan-memory.json");
}

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`## ${heading}[\\s\\S]*?(?=\\n## |$)`, "i");
  return markdown.match(pattern)?.[0] ?? "";
}

function collectBullets(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export async function refreshBuildPlanMemory(baseDir?: string): Promise<BuildPlanMemory> {
  const root = resolve(baseDir ?? process.cwd());
  const sourcePath = resolve(root, "docs/build-plan.md");
  const markdown = await readFile(sourcePath, "utf8");

  const currentPrioritySection = extractSection(markdown, "Current Priority Order");
  const implementedSection = extractSection(markdown, "Current Coded State");
  const runtimeMemorySection = extractSection(markdown, "Current Runtime Memory and Rule Sources");

  const priorityMatches = [...markdown.matchAll(/### Priority [^\n]+/g)].map((match) => match[0].trim());
  const activeRules = unique([
    ...collectBullets(runtimeMemorySection),
    ...collectBullets(currentPrioritySection).slice(0, 12)
  ]).slice(0, 40);
  const partialRules = unique([
    ...implementedSection
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /\bpartial|partially|unfinished|not yet\b/i.test(line))
  ]).slice(0, 20);
  const plannedRules = unique([
    ...currentPrioritySection
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^- /.test(line))
      .map((line) => line.slice(2).trim()),
    ...markdown
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /\bnext real implementation step\b/i.test(line))
  ]).slice(0, 20);

  const memory: BuildPlanMemory = {
    generatedAt: new Date().toISOString(),
    sourcePath: "docs/build-plan.md",
    currentPriorityOrder: priorityMatches.slice(0, 20),
    activeRules,
    partialRules,
    plannedRules
  };

  const outputPath = getBuildPlanMemoryPath(root);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(memory, null, 2) + "\n", "utf8");
  return memory;
}

export async function loadBuildPlanMemory(baseDir?: string): Promise<BuildPlanMemory> {
  const outputPath = getBuildPlanMemoryPath(baseDir);
  try {
    return JSON.parse(await readFile(outputPath, "utf8")) as BuildPlanMemory;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return refreshBuildPlanMemory(baseDir);
    }
    throw error;
  }
}
