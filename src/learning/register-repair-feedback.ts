import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { registerRepairFeedback, syncRuntimeMemory } from "./index.js";

interface RegisterRepairArgs {
  signalId: string;
  candidateId?: string | null;
  originalBeat?: string | null;
  feedbackMessage: string;
}

function parseArgs(argv: string[]): RegisterRepairArgs {
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

  const signalId = parsed.get("signal-id");
  const feedbackMessage = parsed.get("feedback");

  if (!signalId) {
    throw new Error("Missing required --signal-id <signal-id>");
  }

  if (!feedbackMessage || feedbackMessage.trim().length === 0) {
    throw new Error("Missing required --feedback <publisher rejection message>");
  }

  return {
    signalId,
    candidateId: parsed.get("candidate") ?? null,
    originalBeat: parsed.get("original-beat") ?? null,
    feedbackMessage
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await registerRepairFeedback(args);
  const sync = await syncRuntimeMemory("register-repair-feedback");
  process.stdout.write(`${JSON.stringify({ ...result, sync }, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
