import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readFiledSignalsState } from "./state.js";
import { generateLiveCandidateSlate } from "./live-candidates.js";
import { resolveLiveReadyArtifactPath, type FilingReadyArtifact } from "./artifacts.js";

export type DispatchCandidateStatus =
  | "ready_now"
  | "scheduled"
  | "awaiting_signature"
  | "signed_ready"
  | "sent"
  | "failed"
  | "skipped"
  | "cancelled";

export type DispatchQueueStatus = "active" | "paused" | "completed" | "cancelled";

interface DispatchHistoryEntry {
  event:
    | "staged"
    | "signature_requested"
    | "signed"
    | "sent"
    | "failed"
    | "skipped"
    | "paused"
    | "resumed"
    | "cancelled";
  at: string;
  note?: string | null;
  signalId?: string | null;
}

export interface DispatchQueueItem {
  candidateId: string;
  headline: string | null;
  beat: string | null;
  artifactPath: string;
  status: DispatchCandidateStatus;
  dispatchOrder: number;
  scheduledFor: string | null;
  signedAt: string | null;
  sentAt: string | null;
  signalId: string | null;
  failureReason: string | null;
  skipReason: string | null;
  history: DispatchHistoryEntry[];
}

export interface StaggeredDispatchQueueState {
  kind: "staggered_dispatch_queue";
  reportDate: string;
  createdAt: string;
  updatedAt: string;
  queueStatus: DispatchQueueStatus;
  dispatchIntervalMinutes: number;
  beatSpacingMinutes: number;
  dailyLimit: number;
  nextDueCandidateId: string | null;
  nextDueAt: string | null;
  items: DispatchQueueItem[];
}

interface QueueTimingContext {
  sentTodayCount: number;
  lastDispatchAt: string | null;
  lastBeatDispatchAt: Map<string, string>;
}

const DISPATCH_INTERVAL_MINUTES = 70;
const BEAT_SPACING_MINUTES = 60;
const DAILY_LIMIT = 6;
const TERMINAL_STATUSES = new Set<DispatchCandidateStatus>(["sent", "skipped", "cancelled"]);

function resolveDispatchStatePath(reportDate: string, baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), `data/state/staggered-dispatch-${reportDate}.json`);
}

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(Date.parse(timestamp) + minutes * 60_000).toISOString();
}

function latestIso(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function compareNullableIso(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return Date.parse(left) - Date.parse(right);
}

function buildHistoryEntry(
  event: DispatchHistoryEntry["event"],
  at: string,
  note?: string | null,
  signalId?: string | null
): DispatchHistoryEntry {
  return { event, at, note: note ?? null, signalId: signalId ?? null };
}

function pushHistory(
  item: DispatchQueueItem,
  event: DispatchHistoryEntry["event"],
  at: string,
  note?: string | null,
  signalId?: string | null
): DispatchQueueItem {
  const last = item.history[item.history.length - 1];
  if (last?.event === event && last?.at === at && (last?.note ?? null) === (note ?? null) && (last?.signalId ?? null) === (signalId ?? null)) {
    return item;
  }

  return {
    ...item,
    history: [...item.history, buildHistoryEntry(event, at, note, signalId)]
  };
}

function sortByDispatchOrder(items: DispatchQueueItem[]): DispatchQueueItem[] {
  return [...items].sort((left, right) => left.dispatchOrder - right.dispatchOrder);
}

async function readApprovedArtifacts(
  reportDate: string,
  baseDir?: string
): Promise<Array<{ artifactPath: string; artifact: FilingReadyArtifact }>> {
  const root = resolve(baseDir ?? process.cwd());
  const liveSlate = await generateLiveCandidateSlate(reportDate, root);
  const approvedCandidates = liveSlate.candidates.filter(
    (candidate) => candidate.queueStatus === "approved_for_filing" || candidate.queueStatus === "filed"
  );

  return Promise.all(
    approvedCandidates.map(async (candidate) => {
      const artifactPath = resolveLiveReadyArtifactPath(reportDate, candidate.candidateId, root);
      return {
        artifactPath,
        artifact: JSON.parse(await readFile(artifactPath, "utf8")) as FilingReadyArtifact
      };
    })
  );
}

async function buildTimingContext(
  reportDate: string,
  items: DispatchQueueItem[],
  baseDir?: string
): Promise<QueueTimingContext> {
  const filedSignalsState = await readFiledSignalsState(baseDir);
  let sentTodayCount = 0;
  let lastDispatchAt: string | null = null;
  const lastBeatDispatchAt = new Map<string, string>();
  const seenDispatchKeys = new Set<string>();

  for (const entry of filedSignalsState.filedSignals) {
    if (!entry.filedAt || entry.filedAt.slice(0, 10) !== reportDate) {
      continue;
    }

    const dispatchKey = entry.candidateId ?? entry.signalId;
    if (!seenDispatchKeys.has(dispatchKey)) {
      sentTodayCount += 1;
      seenDispatchKeys.add(dispatchKey);
    }
    lastDispatchAt = latestIso(lastDispatchAt, entry.filedAt);
    if (entry.beat) {
      lastBeatDispatchAt.set(entry.beat, latestIso(lastBeatDispatchAt.get(entry.beat) ?? null, entry.filedAt) ?? entry.filedAt);
    }
  }

  for (const item of items) {
    if (item.status !== "sent" || !item.sentAt) {
      continue;
    }

    const dispatchKey = item.candidateId || item.signalId || item.artifactPath;
    if (!seenDispatchKeys.has(dispatchKey)) {
      sentTodayCount += 1;
      seenDispatchKeys.add(dispatchKey);
    }
    lastDispatchAt = latestIso(lastDispatchAt, item.sentAt);
    if (item.beat) {
      lastBeatDispatchAt.set(item.beat, latestIso(lastBeatDispatchAt.get(item.beat) ?? null, item.sentAt) ?? item.sentAt);
    }
  }

  return { sentTodayCount, lastDispatchAt, lastBeatDispatchAt };
}

function nextEligibleDueAt(
  item: DispatchQueueItem,
  now: string,
  timing: QueueTimingContext
): string {
  let dueAt = timing.lastDispatchAt
    ? addMinutes(timing.lastDispatchAt, DISPATCH_INTERVAL_MINUTES)
    : now;

  if (item.beat) {
    const lastBeatDispatch = timing.lastBeatDispatchAt.get(item.beat) ?? null;
    if (lastBeatDispatch) {
      const beatDueAt = addMinutes(lastBeatDispatch, BEAT_SPACING_MINUTES);
      if (Date.parse(beatDueAt) > Date.parse(dueAt)) {
        dueAt = beatDueAt;
      }
    }
  }

  return dueAt;
}

function mergeArtifactsIntoQueue(
  reportDate: string,
  now: string,
  existing: StaggeredDispatchQueueState | null,
  artifacts: Array<{ artifactPath: string; artifact: FilingReadyArtifact }>,
  sentByCandidateId: Map<string, { signalId: string; filedAt: string | null; beat: string | null }>
): StaggeredDispatchQueueState {
  const existingItems = new Map((existing?.items ?? []).map((item) => [item.candidateId, item]));
  const nextItems: DispatchQueueItem[] = [];

  for (const [index, entry] of artifacts.entries()) {
    const existingItem = existingItems.get(entry.artifact.candidateId) ?? null;
    const sentEntry = sentByCandidateId.get(entry.artifact.candidateId) ?? null;
    const baseItem: DispatchQueueItem = existingItem
      ? {
          ...existingItem,
          headline: entry.artifact.submission?.headline ?? existingItem.headline,
          beat: entry.artifact.submission?.candidate_signal?.beat ?? existingItem.beat,
          artifactPath: entry.artifactPath,
          dispatchOrder: index + 1
        }
      : {
          candidateId: entry.artifact.candidateId,
          headline: entry.artifact.submission?.headline ?? null,
          beat: entry.artifact.submission?.candidate_signal?.beat ?? null,
          artifactPath: entry.artifactPath,
          status: sentEntry ? "sent" : "scheduled",
          dispatchOrder: index + 1,
          scheduledFor: null,
          signedAt: null,
          sentAt: sentEntry?.filedAt ?? null,
          signalId: sentEntry?.signalId ?? null,
          failureReason: null,
          skipReason: null,
          history: [buildHistoryEntry("staged", now)]
        };

    const merged =
      sentEntry && baseItem.status !== "sent"
        ? pushHistory(
            {
              ...baseItem,
              status: "sent",
              sentAt: sentEntry.filedAt ?? now,
              signalId: sentEntry.signalId,
              scheduledFor: baseItem.sentAt ?? sentEntry.filedAt ?? now
            },
            "sent",
            sentEntry.filedAt ?? now,
            null,
            sentEntry.signalId
          )
        : baseItem;

    nextItems.push(merged);
  }

  for (const item of existing?.items ?? []) {
    if (nextItems.some((entry) => entry.candidateId === item.candidateId) || TERMINAL_STATUSES.has(item.status)) {
      continue;
    }

    nextItems.push(
      pushHistory(
        {
          ...item,
          status: "cancelled",
          scheduledFor: null
        },
        "cancelled",
        now,
        "Ready artifact no longer exists in data/filing-ready."
      )
    );
  }

  return {
    kind: "staggered_dispatch_queue",
    reportDate,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    queueStatus: existing?.queueStatus ?? "active",
    dispatchIntervalMinutes: DISPATCH_INTERVAL_MINUTES,
    beatSpacingMinutes: BEAT_SPACING_MINUTES,
    dailyLimit: DAILY_LIMIT,
    nextDueCandidateId: existing?.nextDueCandidateId ?? null,
    nextDueAt: existing?.nextDueAt ?? null,
    items: sortByDispatchOrder(nextItems)
  };
}

export async function readDispatchQueue(
  reportDate: string,
  baseDir?: string
): Promise<StaggeredDispatchQueueState | null> {
  return readJsonOrNull<StaggeredDispatchQueueState>(resolveDispatchStatePath(reportDate, baseDir));
}

export async function saveDispatchQueue(
  queue: StaggeredDispatchQueueState,
  baseDir?: string
): Promise<string> {
  const filePath = resolveDispatchStatePath(queue.reportDate, baseDir);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(queue, null, 2) + "\n", "utf8");
  return filePath;
}

export async function createDispatchQueue(
  reportDate: string,
  options: { now?: string } = {},
  baseDir?: string
): Promise<StaggeredDispatchQueueState> {
  const now = options.now ?? new Date().toISOString();
  const [existing, artifacts, filedSignals] = await Promise.all([
    readDispatchQueue(reportDate, baseDir),
    readApprovedArtifacts(reportDate, baseDir),
    readFiledSignalsState(baseDir)
  ]);

  const sentByCandidateId = new Map(
    filedSignals.filedSignals
      .filter((entry) => entry.candidateId !== null && entry.filedAt?.slice(0, 10) === reportDate)
      .map((entry) => [
        entry.candidateId as string,
        { signalId: entry.signalId, filedAt: entry.filedAt, beat: entry.beat }
      ])
  );

  const queue = mergeArtifactsIntoQueue(reportDate, now, existing, artifacts, sentByCandidateId);
  await saveDispatchQueue(queue, baseDir);
  return queue;
}

export async function advanceDispatchQueue(
  reportDate: string,
  options: { now?: string } = {},
  baseDir?: string
): Promise<StaggeredDispatchQueueState> {
  const now = options.now ?? new Date().toISOString();
  const queue = await createDispatchQueue(reportDate, { now }, baseDir);

  if (queue.queueStatus === "paused" || queue.queueStatus === "cancelled") {
    const pausedQueue: StaggeredDispatchQueueState = {
      ...queue,
      updatedAt: now,
      nextDueCandidateId: null,
      nextDueAt: null,
      items: queue.items.map((item) =>
        item.status === "ready_now" || item.status === "awaiting_signature"
          ? { ...item, status: "scheduled" as DispatchCandidateStatus, scheduledFor: item.scheduledFor ?? now }
          : item
      )
    };
    await saveDispatchQueue(pausedQueue, baseDir);
    return pausedQueue;
  }

  const items = sortByDispatchOrder(queue.items).map((item) => ({ ...item }));
  const timing = await buildTimingContext(reportDate, items, baseDir);
  let sentTodayCount = timing.sentTodayCount;
  let nextDueCandidateId: string | null = null;
  let nextDueAt: string | null = null;
  let activeItemLocked = false;

  const nextItems: DispatchQueueItem[] = items.map((item) => {
    if (item.status === "sent" || item.status === "skipped" || item.status === "cancelled") {
      return item;
    }

    if (item.status === "failed") {
      return item;
    }

    if (sentTodayCount >= queue.dailyLimit) {
      return {
        ...item,
        status: (item.status === "signed_ready" ? "signed_ready" : "scheduled") as DispatchCandidateStatus,
        scheduledFor: null
      };
    }

    if (item.status === "signed_ready") {
      if (!activeItemLocked) {
        nextDueCandidateId = item.candidateId;
        nextDueAt = item.signedAt ?? now;
        activeItemLocked = true;
        return { ...item, scheduledFor: item.signedAt ?? now };
      }

      return { ...item, status: "scheduled" as DispatchCandidateStatus, scheduledFor: null };
    }

    if (activeItemLocked) {
      return { ...item, status: "scheduled" as DispatchCandidateStatus, scheduledFor: null };
    }

    const dueAt = nextEligibleDueAt(item, now, timing);
    const dueNow = Date.parse(dueAt) <= Date.parse(now);
    nextDueCandidateId = item.candidateId;
    nextDueAt = dueAt;
    activeItemLocked = true;

    return {
      ...item,
      status: (dueNow ? "ready_now" : "scheduled") as DispatchCandidateStatus,
      scheduledFor: dueAt
    };
  });

  const pendingItems = nextItems.filter((item) => !TERMINAL_STATUSES.has(item.status) && item.status !== "failed");
  const completed =
    pendingItems.length === 0 ||
    nextItems.every((item) => TERMINAL_STATUSES.has(item.status) || item.status === "failed");

  const nextQueue: StaggeredDispatchQueueState = {
    ...queue,
    updatedAt: now,
    queueStatus: completed ? "completed" : "active",
    nextDueCandidateId: sentTodayCount >= queue.dailyLimit ? null : nextDueCandidateId,
    nextDueAt: sentTodayCount >= queue.dailyLimit ? null : nextDueAt,
    items: nextItems
  };

  await saveDispatchQueue(nextQueue, baseDir);
  return nextQueue;
}

export async function markCandidateSigned(
  reportDate: string,
  candidateId: string,
  options: { now?: string } = {},
  baseDir?: string
): Promise<StaggeredDispatchQueueState> {
  const now = options.now ?? new Date().toISOString();
  const queue = await advanceDispatchQueue(reportDate, { now }, baseDir);
  const items = queue.items.map((item) => {
    if (item.candidateId !== candidateId) {
      return item;
    }

    if (item.status !== "ready_now" && item.status !== "awaiting_signature") {
      throw new Error(`Candidate ${candidateId} cannot be marked signed from status ${item.status}.`);
    }

    return pushHistory(
      {
        ...item,
        status: "signed_ready",
        signedAt: now,
        scheduledFor: item.scheduledFor ?? now,
        failureReason: null
      },
      "signed",
      now
    );
  });

  const nextQueue: StaggeredDispatchQueueState = {
    ...queue,
    updatedAt: now,
    nextDueCandidateId: candidateId,
    nextDueAt: now,
    items
  };
  await saveDispatchQueue(nextQueue, baseDir);
  return nextQueue;
}

export async function markCandidateSent(
  reportDate: string,
  candidateId: string,
  options: { now?: string; signalId?: string | null } = {},
  baseDir?: string
): Promise<StaggeredDispatchQueueState> {
  const now = options.now ?? new Date().toISOString();
  const queue = await advanceDispatchQueue(reportDate, { now }, baseDir);

  const items = queue.items.map((item) => {
    if (item.candidateId !== candidateId) {
      return item;
    }

    if (item.status === "sent") {
      return {
        ...item,
        sentAt: item.sentAt ?? now,
        signalId: item.signalId ?? options.signalId ?? null,
        scheduledFor: item.scheduledFor ?? item.sentAt ?? now
      };
    }

    if (!["ready_now", "awaiting_signature", "signed_ready", "scheduled", "cancelled"].includes(item.status)) {
      throw new Error(`Candidate ${candidateId} cannot be marked sent from status ${item.status}.`);
    }

    return pushHistory(
      {
        ...item,
        status: "sent",
        sentAt: now,
        signalId: options.signalId ?? item.signalId,
        scheduledFor: now,
        failureReason: null
      },
      "sent",
      now,
      null,
      options.signalId ?? item.signalId
    );
  });

  const nextQueue = await saveAndReadvance({
    ...queue,
    updatedAt: now,
    items
  }, now, baseDir);
  return nextQueue;
}

export async function skipCandidate(
  reportDate: string,
  candidateId: string,
  options: { now?: string; reason?: string } = {},
  baseDir?: string
): Promise<StaggeredDispatchQueueState> {
  const now = options.now ?? new Date().toISOString();
  const queue = await advanceDispatchQueue(reportDate, { now }, baseDir);

  const items = queue.items.map((item) =>
    item.candidateId === candidateId
      ? pushHistory(
          {
            ...item,
            status: "skipped",
            scheduledFor: null,
            skipReason: options.reason ?? "Skipped by operator."
          },
          "skipped",
          now,
          options.reason ?? "Skipped by operator."
        )
      : item
  );

  return saveAndReadvance({ ...queue, updatedAt: now, items }, now, baseDir);
}

export async function pauseDispatchQueue(
  reportDate: string,
  options: { now?: string; reason?: string } = {},
  baseDir?: string
): Promise<StaggeredDispatchQueueState> {
  const now = options.now ?? new Date().toISOString();
  const queue = await advanceDispatchQueue(reportDate, { now }, baseDir);
  const previouslyDueCandidateId = queue.nextDueCandidateId;
  const nextQueue: StaggeredDispatchQueueState = {
    ...queue,
    updatedAt: now,
    queueStatus: "paused",
    nextDueCandidateId: null,
    nextDueAt: null,
    items: queue.items.map((item) =>
      item.status === "ready_now" || item.status === "awaiting_signature"
        ? { ...item, status: "scheduled", scheduledFor: item.scheduledFor ?? now }
        : item
    )
  };

  const withHistory = {
    ...nextQueue,
    items: nextQueue.items.map((item) =>
      item.candidateId === previouslyDueCandidateId
        ? pushHistory(item, "paused", now, options.reason ?? "Paused by operator.")
        : item
    )
  };

  await saveDispatchQueue(withHistory, baseDir);
  return withHistory;
}

export async function resumeDispatchQueue(
  reportDate: string,
  options: { now?: string } = {},
  baseDir?: string
): Promise<StaggeredDispatchQueueState> {
  const now = options.now ?? new Date().toISOString();
  const existing = await readDispatchQueue(reportDate, baseDir);
  if (!existing) {
    return advanceDispatchQueue(reportDate, { now }, baseDir);
  }

  const queue: StaggeredDispatchQueueState = {
    ...existing,
    updatedAt: now,
    queueStatus: "active",
    items: existing.items
  };

  await saveDispatchQueue(queue, baseDir);
  return advanceDispatchQueue(reportDate, { now }, baseDir);
}

async function saveAndReadvance(
  queue: StaggeredDispatchQueueState,
  now: string,
  baseDir?: string
): Promise<StaggeredDispatchQueueState> {
  await saveDispatchQueue(queue, baseDir);
  return advanceDispatchQueue(queue.reportDate, { now }, baseDir);
}

export function getNextDueDispatchCandidate(
  queue: StaggeredDispatchQueueState | null
): DispatchQueueItem | null {
  if (!queue) {
    return null;
  }

  const nextById = queue.nextDueCandidateId
    ? queue.items.find((item) => item.candidateId === queue.nextDueCandidateId) ?? null
    : null;
  if (nextById) {
    return nextById;
  }

  const sorted = sortByDispatchOrder(queue.items)
    .filter((item) => !TERMINAL_STATUSES.has(item.status) && item.status !== "failed")
    .sort((left, right) => compareNullableIso(left.scheduledFor, right.scheduledFor));

  return sorted[0] ?? null;
}
