import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

interface RuntimeHistoryEntry {
  reportDate: string;
  generatedAt: string;
  eventName: string | null;
  runId: string | null;
  runAttempt: string | null;
  repository: string | null;
  refName: string | null;
  actor: string | null;
  runtime: {
    walletActionsRequireHumanSignature: boolean;
    secondSourcingPassTriggered: boolean;
    initialStrongCandidates: number;
    finalStrongCandidates: number;
  };
  reports: {
    queuePath: string;
    filingQueuePath: string;
    operatorSummaryPath: string;
    stabilityReportPath: string;
    competitorReviewPath?: string | null;
    failureMemoCount?: number | null;
  };
}

interface RuntimeHistoryState {
  kind: "agent_runtime_history";
  updatedAt: string;
  runs: RuntimeHistoryEntry[];
}

export async function appendRuntimeHistory(
  entry: Omit<RuntimeHistoryEntry, "eventName" | "runId" | "runAttempt" | "repository" | "refName" | "actor">,
  baseDir?: string
): Promise<string> {
  const root = resolve(baseDir ?? process.cwd());
  const filePath = resolve(root, "data/state/agent-runtime.json");
  let state: RuntimeHistoryState = {
    kind: "agent_runtime_history",
    updatedAt: entry.generatedAt,
    runs: []
  };

  try {
    state = JSON.parse(await readFile(filePath, "utf8")) as RuntimeHistoryState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  state.updatedAt = entry.generatedAt;
  state.runs = [
    {
      ...entry,
      eventName: process.env.GITHUB_EVENT_NAME ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      repository: process.env.GITHUB_REPOSITORY ?? null,
      refName: process.env.GITHUB_REF_NAME ?? null,
      actor: process.env.GITHUB_ACTOR ?? null
    },
    ...state.runs.filter((run) =>
      !(run.reportDate === entry.reportDate && run.runId === (process.env.GITHUB_RUN_ID ?? null))
    )
  ].slice(0, 30);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
  return filePath;
}
