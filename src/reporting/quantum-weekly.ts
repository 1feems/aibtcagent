import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateAndSaveQuantumWeeklySynthesis } from "./quantum-weekly-synthesis.js";
import { getPacificReportDate } from "../utils/report-date.js";

function parseArgs(argv: string[]): { date: string } {
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.set(key, "true");
      continue;
    }
    parsed.set(key, next);
    index += 1;
  }

  const now = new Date().toISOString();
  return {
    date: parsed.get("date") ?? getPacificReportDate(now)
  };
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const { paths } = await generateAndSaveQuantumWeeklySynthesis(config.date);
  process.stdout.write(`${JSON.stringify(paths, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
