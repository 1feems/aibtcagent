import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFilingQueue, saveFilingQueue, type FilingQueueSnapshot } from "./queue.js";

interface ApproveConfig {
  reportDate: string;
  candidateId: string;
  decision: "approve" | "reject";
  reviewedBy: string;
}

function parseArgs(argv: string[]): ApproveConfig {
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

  const now = new Date().toISOString();
  const reportDate = parsed.get("date") ?? now.slice(0, 10);
  const candidateId = parsed.get("candidate");
  const decision = parsed.get("decision");

  if (!candidateId) {
    throw new Error("Missing required --candidate <candidate-id>");
  }

  if (decision !== "approve" && decision !== "reject") {
    throw new Error("Missing required --decision approve|reject");
  }

  return {
    reportDate,
    candidateId,
    decision,
    reviewedBy: parsed.get("reviewed-by") ?? "human"
  };
}

async function writeReadyArtifact(
  reportDate: string,
  candidateId: string,
  sourcePath: string,
  reviewedBy: string,
  baseDir?: string
): Promise<string> {
  const root = baseDir ?? process.cwd();
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as unknown;
  const targetPath = resolve(root, `data/filing-ready/${reportDate}/${candidateId}.json`);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(
    targetPath,
    JSON.stringify(
      {
        kind: "filing_ready_submission",
        reportDate,
        candidateId,
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        sourcePath,
        submission: source
      },
      null,
      2
    ),
    "utf8"
  );
  return targetPath;
}

export async function applyHumanDecision(
  config: ApproveConfig,
  baseDir?: string
): Promise<{ queuePath: string; readyArtifactPath: string | null }> {
  const queue = await readFilingQueue(config.reportDate, baseDir);
  const item = queue.items.find((entry) => entry.candidateId === config.candidateId);

  if (!item) {
    throw new Error(`Candidate ${config.candidateId} not found in filing queue for ${config.reportDate}`);
  }

  let readyArtifactPath: string | null = null;

  if (config.decision === "approve") {
    item.queueStatus = "approved_for_filing";
    readyArtifactPath = await writeReadyArtifact(
      config.reportDate,
      item.candidateId,
      item.sourcePath,
      config.reviewedBy,
      baseDir
    );
  } else {
    item.queueStatus = "rejected";
  }

  const updatedQueue: FilingQueueSnapshot = {
    ...queue,
    generatedAt: new Date().toISOString(),
    topCandidateId:
      config.decision === "approve"
        ? item.candidateId
        : queue.items.find((entry) => entry.queueStatus === "awaiting_human_approval" && entry.candidateId !== item.candidateId)?.candidateId ?? null
  };

  const queuePath = await saveFilingQueue(updatedQueue, baseDir);
  return { queuePath, readyArtifactPath };
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const result = await applyHumanDecision(config);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
