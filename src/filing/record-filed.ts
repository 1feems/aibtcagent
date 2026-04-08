import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { recordFiledSignal } from "./state.js";

interface RecordFiledArgs {
  reportDate?: string;
  candidateId: string;
  signalId: string;
  filedAt?: string;
  readyArtifactPath?: string;
}

function parseArgs(argv: string[]): RecordFiledArgs {
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.set(key, "true");
      continue;
    }

    parsed.set(key, next);
    index += 1;
  }

  const candidateId = parsed.get("candidate");
  const signalId = parsed.get("signal-id");

  if (!candidateId) {
    throw new Error("Missing required --candidate <candidate-id>");
  }

  if (!signalId) {
    throw new Error("Missing required --signal-id <signal-id>");
  }

  return {
    reportDate: parsed.get("date"),
    candidateId,
    signalId,
    filedAt: parsed.get("filed-at"),
    readyArtifactPath: parsed.get("artifact")
  };
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const result = await recordFiledSignal(config);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
