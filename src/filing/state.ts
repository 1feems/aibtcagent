import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { markCandidateFiled } from "./candidate-history.js";
import { readFilingQueue, saveFilingQueue, type FilingQueueSnapshot } from "./queue.js";
import { markCandidateSent } from "./staggered-dispatch.js";
import { resolveLiveReadyArtifactPath, type FilingReadyArtifact } from "./artifacts.js";

export interface FiledSignalRecord {
  signalId: string;
  candidateId: string | null;
  headline: string | null;
  beat: string | null;
  filedAt: string | null;
  resolved: boolean;
  brief_included?: boolean;
  approved?: boolean;
  cap_blocked?: boolean;
}

export interface FiledSignalsState {
  filedSignals: FiledSignalRecord[];
  approved_corrections?: number;
}

export interface RecordFiledSignalConfig {
  reportDate?: string;
  candidateId: string;
  signalId: string;
  filedAt?: string;
  readyArtifactPath?: string;
  headline?: string | null;
  beat?: string | null;
  apiResponse?: unknown;
}

export interface FiledSignalReceipt {
  kind: "filed_signal_receipt";
  reportDate: string;
  candidateId: string;
  signalId: string;
  filedAt: string;
  headline: string | null;
  beat: string | null;
  readyArtifactPath: string;
  statePath: string;
  queuePath: string | null;
  apiResponse: unknown;
}

function resolveStatePath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/filed-signals.json");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function readFiledSignalsState(baseDir?: string): Promise<FiledSignalsState> {
  const filePath = resolveStatePath(baseDir);

  try {
    return await readJson<FiledSignalsState>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { filedSignals: [], approved_corrections: 0 };
    }

    throw error;
  }
}

export async function saveFiledSignalsState(
  state: FiledSignalsState,
  baseDir?: string
): Promise<string> {
  const filePath = resolveStatePath(baseDir);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2) + "\n", "utf8");
  return filePath;
}

export async function incrementApprovedCorrections(baseDir?: string): Promise<number> {
  const state = await readFiledSignalsState(baseDir);
  const next = (state.approved_corrections ?? 0) + 1;
  state.approved_corrections = next;
  await saveFiledSignalsState(state, baseDir);
  return next;
}

async function readReadyArtifact(
  reportDate: string,
  candidateId: string,
  readyArtifactPath?: string,
  baseDir?: string
): Promise<{ path: string; artifact: FilingReadyArtifact }> {
  const path =
    readyArtifactPath ??
    resolveLiveReadyArtifactPath(reportDate, candidateId, baseDir);
  const artifact = await readJson<FilingReadyArtifact>(path);
  if (artifact.intendedUse === "helper_test") {
    throw new Error(`Candidate ${candidateId} was stored as helper_test and cannot be recorded as a live filed signal.`);
  }
  return { path, artifact };
}

async function updateQueueStatus(
  reportDate: string,
  candidateId: string,
  baseDir?: string
): Promise<string | null> {
  try {
    const queue = await readFilingQueue(reportDate, baseDir);
    const item = queue.items.find((entry) => entry.candidateId === candidateId);
    if (!item) {
      return null;
    }

    item.queueStatus = "filed";
    const nextAwaiting = queue.items.find((entry) => entry.queueStatus === "awaiting_human_approval");
    const updatedQueue: FilingQueueSnapshot = {
      ...queue,
      generatedAt: new Date().toISOString(),
      topCandidateId: nextAwaiting?.candidateId ?? null
    };
    return await saveFilingQueue(updatedQueue, baseDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function recordFiledSignal(
  config: RecordFiledSignalConfig,
  baseDir?: string
): Promise<{
  receiptPath: string;
  statePath: string;
  queuePath: string | null;
  receipt: FiledSignalReceipt;
}> {
  const root = resolve(baseDir ?? process.cwd());
  const reportDate =
    config.reportDate ??
    new Date(config.filedAt ?? new Date().toISOString()).toISOString().slice(0, 10);
  const filedAt = config.filedAt ?? new Date().toISOString();
  const { path: artifactPath, artifact } = await readReadyArtifact(
    reportDate,
    config.candidateId,
    config.readyArtifactPath,
    root
  );

  const headline = config.headline ?? artifact.submission?.headline ?? null;
  const beat = config.beat ?? artifact.submission?.candidate_signal?.beat ?? null;
  const state = await readFiledSignalsState(root);
  const existingIndex = state.filedSignals.findIndex((entry) =>
    entry.signalId === config.signalId ||
    (entry.candidateId !== null && entry.candidateId === config.candidateId)
  );

  const entry: FiledSignalRecord = {
    signalId: config.signalId,
    candidateId: config.candidateId,
    headline,
    beat,
    filedAt,
    resolved: false
  };

  if (existingIndex >= 0) {
    state.filedSignals[existingIndex] = entry;
  } else {
    state.filedSignals.push(entry);
  }

  const statePath = await saveFiledSignalsState(state, root);
  const queuePath = await updateQueueStatus(reportDate, config.candidateId, root);
  await markCandidateSent(
    reportDate,
    config.candidateId,
    {
      now: filedAt,
      signalId: config.signalId
    },
    root
  ).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  });
  await markCandidateFiled(config.candidateId, config.signalId, filedAt, root);

  const receipt: FiledSignalReceipt = {
    kind: "filed_signal_receipt",
    reportDate,
    candidateId: config.candidateId,
    signalId: config.signalId,
    filedAt,
    headline,
    beat,
    readyArtifactPath: artifactPath,
    statePath,
    queuePath,
    apiResponse: config.apiResponse ?? null
  };

  const receiptPath = resolve(root, `data/filing-results/${reportDate}/${config.candidateId}.json`);
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");

  return { receiptPath, statePath, queuePath, receipt };
}
