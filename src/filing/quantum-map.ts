import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  getQuantumMapFallbackDatasetUrl,
  getQuantumMapLocalDatasetPath,
  getQuantumMapPrimaryDatasetUrl
} from "./quantum-config.js";

type JsonRecord = Record<string, unknown>;

export interface QuantumMapDeveloperEntry {
  name: string;
  quantum_urgency_score: number | null;
  summary: string;
  key_source: string | null;
  sources: string[];
}

export interface QuantumMapDataset {
  metadata?: JsonRecord;
  developers: QuantumMapDeveloperEntry[];
  [key: string]: unknown;
}

export interface QuantumMapSnapshotSummary {
  datasetUrl: string;
  fetchedAt: string;
  source: "primary_live" | "fallback_live" | "local_file" | "cached_state";
  metadataDate: string | null;
  metadataVersion: string | null;
  totalAssessed: number | null;
  metadataVoiced: number | null;
  metadataSilent: number | null;
  metadataCoverageScore: number | null;
  metadataWeightedSum: number | null;
  metadataVoicedUrgency: number | null;
  metadataCompositeScore: number | null;
  derivedScoreDistribution: Record<string, number>;
  derivedVoicedByScore: number;
  derivedVoicedBySources: number;
  derivedSilentByScore: number;
  derivedWeightedSum: number;
  derivedCoverageScore: number;
  derivedVoicedUrgency: number;
  derivedCompositeScore: number;
  reconciliation: {
    metadataMatchesDerivedScoreVoiced: boolean | null;
    metadataMatchesDerivedWeightedSum: boolean | null;
    metadataMatchesDerivedComposite: boolean | null;
    mismatchCodes: string[];
  };
}

export interface QuantumMapSnapshot {
  summary: QuantumMapSnapshotSummary;
  dataset: QuantumMapDataset;
}

export interface QuantumTrackedSignal {
  candidateId: string | null;
  signalId: string | null;
  reportDate: string;
  filedAt: string | null;
  headline: string | null;
  beat: string | null;
  signalType: string | null;
  subjectName: string | null;
  previousScore: number | null;
  newScore: number | null;
  primarySourceUrl: string | null;
  sourceUrls: string[];
  mapUpdateStatus: string | null;
  status: "pending" | "accepted" | "rejected";
}

export interface QuantumScoreChangeRecord {
  developerName: string;
  previousScore: number;
  newScore: number;
  scoreDelta: number;
  sourceUrl: string | null;
  candidateId: string | null;
  signalId: string | null;
  reportDate: string;
  filedAt: string | null;
  mapUpdateStatus: string | null;
}

export interface QuantumTrackerState {
  kind: "quantum_tracker_state";
  updatedAt: string;
  latestSnapshot: QuantumMapSnapshot | null;
  snapshotHistory: QuantumMapSnapshotSummary[];
  trackedSignals: QuantumTrackedSignal[];
  scoreChanges: QuantumScoreChangeRecord[];
}

interface FetchQuantumMapOptions {
  preferredUrl?: string | null;
  fetchedAt?: string;
  baseDir?: string;
}

interface TrackQuantumFiledSignalInput {
  reportDate: string;
  candidateId: string | null;
  signalId: string | null;
  filedAt: string | null;
  headline: string | null;
  beat: string | null;
  sourceArtifact: unknown;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveTrackerStatePath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/quantum-tracker.json");
}

function normalizeDataset(input: unknown): QuantumMapDataset {
  const root = asRecord(input) ?? {};
  const developers = Array.isArray(root.developers)
    ? root.developers.map((entry) => {
      const record = asRecord(entry) ?? {};
      const rawSources = Array.isArray(record.sources)
        ? record.sources.map((source) => readString(source)).filter(Boolean)
        : [];
      return {
        name: readString(record.name),
        quantum_urgency_score:
          readNumber(record.quantum_urgency_score) ??
          readNumber(record.quantumUrgencyScore) ??
          readNumber(record.score) ??
          readNumber(record.current_score) ??
          readNumber(record.currentScore) ??
          readNumber(record.dataset_current_score) ??
          readNumber(record.datasetCurrentScore),
        summary: readString(record.summary),
        key_source: readString(record.key_source) || readString(record.keySource) || null,
        sources: rawSources
      };
    })
    : [];

  return {
    ...root,
    developers
  };
}

function deriveScoreDistribution(developers: QuantumMapDeveloperEntry[]): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const developer of developers) {
    const score = developer.quantum_urgency_score;
    if (score === null) continue;
    distribution[String(score)] = (distribution[String(score)] ?? 0) + 1;
  }

  return distribution;
}

function roundWhole(value: number): number {
  return Math.round(value);
}

export function summarizeQuantumMap(datasetInput: unknown, datasetUrl: string, fetchedAt: string, source: QuantumMapSnapshotSummary["source"]): QuantumMapSnapshot {
  const dataset = normalizeDataset(datasetInput);
  const metadata = asRecord(dataset.metadata) ?? {};
  const readiness = asRecord(metadata.quantum_readiness_index) ?? {};
  const voicedUrgency = asRecord(readiness.voiced_urgency) ?? {};
  const coverage = asRecord(readiness.coverage) ?? {};
  const composite = asRecord(readiness.composite_readiness) ?? {};

  const scoreDistribution = deriveScoreDistribution(dataset.developers);
  const derivedVoicedByScore = dataset.developers.filter((developer) => (developer.quantum_urgency_score ?? 0) > 1).length;
  const derivedVoicedBySources = dataset.developers.filter((developer) =>
    Boolean(developer.key_source) || developer.sources.length > 0
  ).length;
  const derivedWeightedSum = dataset.developers.reduce((sum, developer) => {
    const score = developer.quantum_urgency_score ?? 0;
    return score > 1 ? sum + score : sum;
  }, 0);
  const totalAssessed =
    readNumber(metadata.total_assessed) ??
    (dataset.developers.length > 0 ? dataset.developers.length : null);
  const safeTotal = totalAssessed ?? dataset.developers.length;
  const derivedCoverageScore = safeTotal > 0
    ? roundWhole((derivedVoicedByScore / safeTotal) * 100)
    : 0;
  const derivedVoicedUrgency = derivedVoicedByScore > 0
    ? roundWhole((derivedWeightedSum / (derivedVoicedByScore * 5)) * 100)
    : 0;
  const derivedCompositeScore = safeTotal > 0
    ? roundWhole(derivedVoicedUrgency * (derivedVoicedByScore / safeTotal))
    : 0;

  const metadataVoiced = readNumber(coverage.voiced);
  const metadataWeightedSum = readNumber(voicedUrgency.weighted_sum) ?? readNumber(voicedUrgency.weightedSum);
  const metadataCompositeScore = readNumber(composite.score);

  const mismatchCodes: string[] = [];
  if (metadataVoiced !== null && metadataVoiced !== derivedVoicedByScore) {
    mismatchCodes.push("voiced_count_mismatch");
  }
  if (metadataWeightedSum !== null && metadataWeightedSum !== derivedWeightedSum) {
    mismatchCodes.push("weighted_sum_mismatch");
  }
  if (metadataCompositeScore !== null && metadataCompositeScore !== derivedCompositeScore) {
    mismatchCodes.push("composite_score_mismatch");
  }

  return {
    dataset,
    summary: {
      datasetUrl,
      fetchedAt,
      source,
      metadataDate: readString(metadata.date) || null,
      metadataVersion: readString(metadata.version) || null,
      totalAssessed,
      metadataVoiced,
      metadataSilent: readNumber(coverage.silent),
      metadataCoverageScore: readNumber(coverage.score),
      metadataWeightedSum,
      metadataVoicedUrgency: readNumber(voicedUrgency.score),
      metadataCompositeScore,
      derivedScoreDistribution: scoreDistribution,
      derivedVoicedByScore,
      derivedVoicedBySources,
      derivedSilentByScore: Math.max((safeTotal || 0) - derivedVoicedByScore, 0),
      derivedWeightedSum,
      derivedCoverageScore,
      derivedVoicedUrgency,
      derivedCompositeScore,
      reconciliation: {
        metadataMatchesDerivedScoreVoiced: metadataVoiced === null ? null : metadataVoiced === derivedVoicedByScore,
        metadataMatchesDerivedWeightedSum: metadataWeightedSum === null ? null : metadataWeightedSum === derivedWeightedSum,
        metadataMatchesDerivedComposite: metadataCompositeScore === null ? null : metadataCompositeScore === derivedCompositeScore,
        mismatchCodes
      }
    }
  };
}

async function fetchDataset(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

async function readLocalDataset(baseDir?: string): Promise<unknown | null> {
  const localPath = getQuantumMapLocalDatasetPath(baseDir);
  try {
    return JSON.parse(await readFile(localPath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function summarizeForHistory(snapshot: QuantumMapSnapshot): QuantumMapSnapshotSummary {
  return JSON.parse(JSON.stringify(snapshot.summary)) as QuantumMapSnapshotSummary;
}

function sameSnapshot(left: QuantumMapSnapshotSummary | null | undefined, right: QuantumMapSnapshotSummary): boolean {
  if (!left) return false;
  return (
    left.datasetUrl === right.datasetUrl &&
    left.metadataDate === right.metadataDate &&
    left.metadataVersion === right.metadataVersion &&
    left.metadataCompositeScore === right.metadataCompositeScore &&
    left.metadataVoiced === right.metadataVoiced &&
    left.derivedCompositeScore === right.derivedCompositeScore &&
    left.derivedVoicedByScore === right.derivedVoicedByScore &&
    left.derivedWeightedSum === right.derivedWeightedSum
  );
}

export async function readQuantumTrackerState(baseDir?: string): Promise<QuantumTrackerState> {
  const statePath = resolveTrackerStatePath(baseDir);
  try {
    return JSON.parse(await readFile(statePath, "utf8")) as QuantumTrackerState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        kind: "quantum_tracker_state",
        updatedAt: new Date(0).toISOString(),
        latestSnapshot: null,
        snapshotHistory: [],
        trackedSignals: [],
        scoreChanges: []
      };
    }
    throw error;
  }
}

export async function saveQuantumTrackerState(state: QuantumTrackerState, baseDir?: string): Promise<string> {
  const statePath = resolveTrackerStatePath(baseDir);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
  return statePath;
}

export async function fetchAndCacheQuantumMapSnapshot(options: FetchQuantumMapOptions = {}): Promise<QuantumMapSnapshot> {
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();
  const tracker = await readQuantumTrackerState(options.baseDir);
  const primaryUrl = getQuantumMapPrimaryDatasetUrl();
  const fallbackUrl = getQuantumMapFallbackDatasetUrl();
  const candidateUrls = [
    options.preferredUrl?.trim() || null,
    primaryUrl,
    fallbackUrl
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);

  for (const candidateUrl of candidateUrls) {
    const dataset = await fetchDataset(candidateUrl);
    if (!dataset) continue;
    const source: QuantumMapSnapshotSummary["source"] =
      candidateUrl === fallbackUrl ? "fallback_live" : "primary_live";
    const snapshot = summarizeQuantumMap(dataset, candidateUrl, fetchedAt, source);
    const nextState: QuantumTrackerState = {
      ...tracker,
      updatedAt: fetchedAt,
      latestSnapshot: snapshot,
      snapshotHistory: sameSnapshot(tracker.snapshotHistory[0], snapshot.summary)
        ? [
          summarizeForHistory(snapshot),
          ...tracker.snapshotHistory.slice(1, 19)
        ]
        : [
          summarizeForHistory(snapshot),
          ...tracker.snapshotHistory.slice(0, 19)
        ]
    };
    await saveQuantumTrackerState(nextState, options.baseDir);
    return snapshot;
  }

  const localDataset = await readLocalDataset(options.baseDir);
  if (localDataset) {
    const snapshot = summarizeQuantumMap(
      localDataset,
      getQuantumMapLocalDatasetPath(options.baseDir),
      fetchedAt,
      "local_file"
    );
    const nextState: QuantumTrackerState = {
      ...tracker,
      updatedAt: fetchedAt,
      latestSnapshot: snapshot,
      snapshotHistory: sameSnapshot(tracker.snapshotHistory[0], snapshot.summary)
        ? [
          summarizeForHistory(snapshot),
          ...tracker.snapshotHistory.slice(1, 19)
        ]
        : [
          summarizeForHistory(snapshot),
          ...tracker.snapshotHistory.slice(0, 19)
        ]
    };
    await saveQuantumTrackerState(nextState, options.baseDir);
    return snapshot;
  }

  if (tracker.latestSnapshot) {
    return {
      dataset: tracker.latestSnapshot.dataset,
      summary: {
        ...tracker.latestSnapshot.summary,
        fetchedAt,
        source: "cached_state"
      }
    };
  }

  throw new Error("Could not load quantum map dataset from primary URL, fallback URL, local file, or cached state");
}

export function locateQuantumSubject(snapshot: QuantumMapSnapshot, subjectName: string): QuantumMapDeveloperEntry | null {
  const target = normalizeName(subjectName);
  if (!target) return null;
  return snapshot.dataset.developers.find((developer) => normalizeName(developer.name) === target) ?? null;
}

function parseValidationRecord(sourceArtifact: unknown): JsonRecord | null {
  const root = asRecord(sourceArtifact);
  if (!root) return null;
  return asRecord(root.pre_signal_validation) ??
    asRecord(root.score_update_validation) ??
    asRecord(root.scoreUpdateValidation);
}

function extractSignalType(sourceArtifact: unknown): string | null {
  const root = asRecord(sourceArtifact);
  if (!root) return null;
  const record = asRecord(root.sendPackage) ?? root;
  const signalType = readString(record.signal_type) || readString(record.signalType);
  return signalType || null;
}

function extractSourceUrls(sourceArtifact: unknown, validation: JsonRecord | null): string[] {
  const validationUrls = Array.isArray(validation?.source_urls)
    ? validation.source_urls.map((url) => readString(url)).filter(Boolean)
    : Array.isArray(validation?.sourceUrls)
      ? validation.sourceUrls.map((url) => readString(url)).filter(Boolean)
      : [];
  if (validationUrls.length > 0) {
    return validationUrls;
  }

  const root = asRecord(sourceArtifact);
  const record = asRecord(root?.sendPackage) ?? root;
  if (!Array.isArray(record?.sources)) {
    return [];
  }
  return record.sources
    .map((entry) => {
      const item = asRecord(entry);
      return readString(item?.url);
    })
    .filter(Boolean);
}

function deriveTrackedStatus(signalId: string | null, candidateId: string | null, baseState: { filedSignals?: Array<JsonRecord> }): QuantumTrackedSignal["status"] {
  const entry = (baseState.filedSignals ?? []).find((item) => {
    const itemSignalId = readString(item.signalId);
    const itemCandidateId = readString(item.candidateId);
    return (signalId && itemSignalId === signalId) || (candidateId && itemCandidateId === candidateId);
  });
  const outcome = readString(entry?.outcome);
  const approved = entry?.approved === true || entry?.brief_included === true;

  if (approved || outcome === "approved" || outcome === "brief_included") {
    return "accepted";
  }
  if (outcome === "denied" || outcome === "rejected") {
    return "rejected";
  }
  return "pending";
}

export async function trackQuantumFiledSignal(input: TrackQuantumFiledSignalInput, baseDir?: string): Promise<string | null> {
  const signalType = extractSignalType(input.sourceArtifact);
  if (signalType !== "quantum_signal" && signalType !== "score_update_signal" && input.beat !== "quantum") {
    return null;
  }

  const tracker = await readQuantumTrackerState(baseDir);
  const filedSignalsStatePath = resolve(baseDir ?? process.cwd(), "data/state/filed-signals.json");
  let filedSignalsState: { filedSignals?: Array<JsonRecord> } = {};
  try {
    filedSignalsState = JSON.parse(await readFile(filedSignalsStatePath, "utf8")) as { filedSignals?: Array<JsonRecord> };
  } catch {
    filedSignalsState = {};
  }

  const validation = parseValidationRecord(input.sourceArtifact);
  const subjectName = readString(validation?.subject_name) || readString(validation?.subjectName) || null;
  const previousScore =
    readNumber(validation?.claimed_previous_score) ??
    readNumber(validation?.claimedPreviousScore) ??
    readNumber(validation?.previous_score) ??
    readNumber(validation?.previousScore);
  const newScore =
    readNumber(validation?.proposed_new_score) ??
    readNumber(validation?.proposedNewScore) ??
    readNumber(validation?.new_score) ??
    readNumber(validation?.newScore);
  const primarySourceUrl =
    readString(validation?.primary_source_url) ||
    readString(validation?.primarySourceUrl) ||
    null;
  const mapUpdateStatus =
    readString(validation?.map_update_status) ||
    readString(validation?.mapUpdateStatus) ||
    null;
  const trackedSignal: QuantumTrackedSignal = {
    candidateId: input.candidateId,
    signalId: input.signalId,
    reportDate: input.reportDate,
    filedAt: input.filedAt,
    headline: input.headline,
    beat: input.beat,
    signalType,
    subjectName,
    previousScore,
    newScore,
    primarySourceUrl,
    sourceUrls: extractSourceUrls(input.sourceArtifact, validation),
    mapUpdateStatus,
    status: deriveTrackedStatus(input.signalId, input.candidateId, filedSignalsState)
  };

  const signalIndex = tracker.trackedSignals.findIndex((entry) =>
    (trackedSignal.signalId && entry.signalId === trackedSignal.signalId) ||
    (trackedSignal.candidateId && entry.candidateId === trackedSignal.candidateId)
  );
  if (signalIndex >= 0) {
    tracker.trackedSignals[signalIndex] = trackedSignal;
  } else {
    tracker.trackedSignals.unshift(trackedSignal);
  }

  if (
    signalType === "score_update_signal" &&
    subjectName &&
    previousScore !== null &&
    newScore !== null &&
    previousScore !== newScore
  ) {
    const scoreChange: QuantumScoreChangeRecord = {
      developerName: subjectName,
      previousScore,
      newScore,
      scoreDelta: newScore - previousScore,
      sourceUrl: primarySourceUrl,
      candidateId: input.candidateId,
      signalId: input.signalId,
      reportDate: input.reportDate,
      filedAt: input.filedAt,
      mapUpdateStatus
    };
    const existingChangeIndex = tracker.scoreChanges.findIndex((entry) =>
      (scoreChange.signalId && entry.signalId === scoreChange.signalId) ||
      ((scoreChange.candidateId && entry.candidateId === scoreChange.candidateId) &&
        entry.developerName === scoreChange.developerName)
    );
    if (existingChangeIndex >= 0) {
      tracker.scoreChanges[existingChangeIndex] = scoreChange;
    } else {
      tracker.scoreChanges.unshift(scoreChange);
    }
  }

  tracker.updatedAt = new Date().toISOString();
  return saveQuantumTrackerState(tracker, baseDir);
}
