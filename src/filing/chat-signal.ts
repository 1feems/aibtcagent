import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createSignalArtifact, type CreateSignalInput } from "../prep/create-signal.js";
import { buildHelperReadySignalPackage, type HelperReadySignalPackage } from "./signal-contract.js";
import { validateArtifact } from "./validate-artifact.js";

export interface ChatSignalResult {
  validation: {
    ok: true;
    issues: [];
  };
  helperReady: HelperReadySignalPackage;
}

function usage(): string {
  return [
    "Usage: npm run chat-signal -- --input <create-signal-input.json>",
    "",
    "The input must match CreateSignalInput. The command returns only a validated helper-ready signal package."
  ].join("\n");
}

function parseArgs(argv: string[]): { inputPath: string | null } {
  const inputIndex = argv.findIndex((arg) => arg === "--input" || arg === "-i");
  if (inputIndex >= 0) {
    return { inputPath: argv[inputIndex + 1] ?? null };
  }
  return { inputPath: null };
}

export async function createChatSignalPackage(
  input: CreateSignalInput,
  baseDir = process.cwd()
): Promise<ChatSignalResult> {
  const artifact = await createSignalArtifact(input, baseDir);
  const validation = validateArtifact(artifact);
  if (!validation.ok) {
    throw new Error(`chat-signal refused invalid artifact: ${validation.issues.map((issue) => `${issue.code}: ${issue.reason}`).join("; ")}`);
  }

  return {
    validation: {
      ok: true,
      issues: []
    },
    helperReady: buildHelperReadySignalPackage(artifact, undefined, {
      reportDate: artifact.reportDate,
      baseDir
    })
  };
}

async function main(): Promise<void> {
  const { inputPath } = parseArgs(process.argv.slice(2));
  if (!inputPath) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
    return;
  }

  const absoluteInputPath = resolve(process.cwd(), inputPath);
  const input = JSON.parse(await readFile(absoluteInputPath, "utf8")) as CreateSignalInput;
  const result = await createChatSignalPackage(input, process.cwd());
  process.stdout.write(`${JSON.stringify(result.helperReady.json, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
