import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { markCandidateFiled } from "./candidate-history.js";
import { transitionLifecycleToFiled } from "./lifecycle.js";
import { trackQuantumFiledSignal } from "./quantum-map.js";
import { readFilingQueue, saveFilingQueue, type FilingQueueSnapshot } from "./queue.js";
import { appendSignalHistory } from "./signal-history.js";
import { syncRuntimeMemory } from "../learning/index.js";
import { getPacificReportDate } from "../utils/report-date.js";

export interface FiledSignalRecord {
  signalId: string;
  candidateId: string | null;
  headline: string | null;
  beat: string | null;
  filedAt: string | null;
  resolved: boolean;
  // P26: brief conversion tracking
  brief_included?: boolean;   // true = published in the brief (real KPI win)
  approved?: boolean;         // true = editorially approved, regardless of brief
  // P29: cap-blocked queue
  cap_blocked?: boolean;      // true = approved but beat cap prevented brief inclusion
}

export interface FiledSignalsState {
  filedSignals: FiledSignalRecord[];
  // P35: fact-checker corrections approved by the publisher (worth 15 leaderboard pts each)
  approved_corrections?: number;
}

interface FilingReadyArtifact {
  kind: "filing_ready_submission";
  reportDate: string;
  candidateId: string;
  reviewedBy: string;
  reviewedAt: string;
  sourcePath: string;
  canonicalSignal?: {
    beat_slug?: string;
  };
  submission?: {
    headline?: string;
    candidate_signal?: {
      beat?: string;
    };
    [key: string]: unknown;
  };
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
      return { filedSignals: [] };
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
  state.approved_corrections = (state.approved_corrections ?? 0) + 1;
  await saveFiledSignalsState(state, baseDir);
  return state.approved_corrections;
}

async function readReadyArtifact(
  reportDate: string,
  candidateId: string,
  readyArtifactPath?: string,
  baseDir?: string
): Promise<{ path: string; artifact: FilingReadyArtifact }> {
  const path =
    readyArtifactPath ??
    resolve(baseDir ?? process.cwd(), `data/filing-ready/${reportDate}/${candidateId}.json`);
  return {
    path,
    artifact: await readJson<FilingReadyArtifact>(path)
  };
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
    item.lifecycle = transitionLifecycleToFiled();
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
    getPacificReportDate(config.filedAt ?? new Date().toISOString());
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

  // canonical signal history — one entry per signal, outcome updated later by checker
  await appendSignalHistory(
    { signalId: config.signalId, candidateId: config.candidateId, headline, beat, filedAt, reportDate },
    root
  );

  const queuePath = await updateQueueStatus(reportDate, config.candidateId, root);
  await markCandidateFiled(config.candidateId, config.signalId, filedAt, root);
  await trackQuantumFiledSignal({
    reportDate,
    candidateId: config.candidateId,
    signalId: config.signalId,
    filedAt,
    headline,
    beat: beat ?? artifact.canonicalSignal?.beat_slug ?? null,
    sourceArtifact: artifact.submission ?? null
  }, root);
  await syncRuntimeMemory("record-filed-signal", root);

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
