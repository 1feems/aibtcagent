import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RankedCandidate } from "../scoring/index.js";
import { filingGateIssuesToBlockers, validateFilingGate } from "./filing-gate-validator.js";
import { evaluateSignalGuard } from "./signal-guard.js";
import { buildHelperReadySignalPackage, parseCanonicalSignalPayload } from "./signal-contract.js";
import { fetchAndCacheQuantumMapSnapshot, locateQuantumSubject } from "./quantum-map.js";
import {
  getQuantumMapFallbackDatasetUrl,
  getQuantumMapPrimaryDatasetUrl
} from "./quantum-config.js";

export interface PreSubmitAuditResult {
  ok: boolean;
  reasons: string[];
}

interface ScoreUpdateDuplicateCheck {
  checked?: boolean;
  duplicate_found?: boolean;
  duplicateFound?: boolean;
}

interface ScoreUpdateUrlCheck {
  url?: string;
  status?: number;
  status_code?: number;
  statusCode?: number;
}

interface ScoreUpdateValidation {
  signal_type?: string;
  signalType?: string;
  dataset_url?: string;
  datasetUrl?: string;
  dataset_checked_at?: string;
  datasetCheckedAt?: string;
  subject_name?: string;
  subjectName?: string;
  source_urls?: string[];
  sourceUrls?: string[];
  current_score?: number;
  currentScore?: number;
  dataset_current_score?: number;
  datasetCurrentScore?: number;
  previous_score?: number;
  previousScore?: number;
  claimed_previous_score?: number;
  claimedPreviousScore?: number;
  new_score?: number;
  newScore?: number;
  proposed_new_score?: number;
  proposedNewScore?: number;
  url_checks?: ScoreUpdateUrlCheck[];
  urlChecks?: ScoreUpdateUrlCheck[];
  source_url_checks?: ScoreUpdateUrlCheck[];
  sourceUrlChecks?: ScoreUpdateUrlCheck[];
  duplicate_check?: ScoreUpdateDuplicateCheck;
  duplicateCheck?: ScoreUpdateDuplicateCheck;
  scope_check?: {
    passed?: boolean;
    category?: string;
  };
  scopeCheck?: {
    passed?: boolean;
    category?: string;
  };
  bitcoin_relevance_check?: {
    passed?: boolean;
    bitcoin_named?: boolean;
    bitcoinNamed?: boolean;
  };
  bitcoinRelevanceCheck?: {
    passed?: boolean;
    bitcoin_named?: boolean;
    bitcoinNamed?: boolean;
  };
  exact_claim_check?: {
    passed?: boolean;
  };
  exactClaimCheck?: {
    passed?: boolean;
  };
  reviewer_verifiability_check?: {
    passed?: boolean;
  };
  reviewerVerifiabilityCheck?: {
    passed?: boolean;
  };
  readiness_math_check?: {
    before_index?: number;
    beforeIndex?: number;
    after_index?: number;
    afterIndex?: number;
    score_delta?: number;
    scoreDelta?: number;
    calculation?: string;
  };
  readinessMathCheck?: {
    before_index?: number;
    beforeIndex?: number;
    after_index?: number;
    afterIndex?: number;
    score_delta?: number;
    scoreDelta?: number;
    calculation?: string;
  };
  previous_score_reasoning_from_dataset?: string;
  previousScoreReasoningFromDataset?: string;
  new_score_justification?: string;
  newScoreJustification?: string;
  primary_source_url?: string;
  primarySourceUrl?: string;
  primary_source_type?: string;
  primarySourceType?: string;
  duplicate_check_passed?: boolean;
  duplicateCheckPassed?: boolean;
  map_update_required?: boolean;
  mapUpdateRequired?: boolean;
  map_update_status?: string;
  mapUpdateStatus?: string;
}

interface RawSourceEntry {
  url?: string;
  title?: string;
  source_class?: string;
  sourceClass?: string;
  attribution_note?: string;
  attributionNote?: string;
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isIntegerScoreInRange(value: number | null): boolean {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= 5;
}

function isIso8601DateTime(value: string): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/i.test(value);
}

function normalizeUrl(value: string): string {
  try {
    const parsed = new URL(value.trim());
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.trim();
  }
}

function extractScoreUpdateValidation(sourceArtifact: unknown): ScoreUpdateValidation | null {
  const root = asRecord(sourceArtifact);
  if (!root) return null;
  const direct = asRecord(root.pre_signal_validation);
  if (direct) return direct as ScoreUpdateValidation;
  const alternate = asRecord(root.score_update_validation) ?? asRecord(root.scoreUpdateValidation);
  return alternate ? alternate as ScoreUpdateValidation : null;
}

function extractSignalType(sourceArtifact: unknown): string | null {
  const root = asRecord(sourceArtifact);
  if (!root) return null;
  const record = asRecord(root.sendPackage) ?? root;
  const signalType = readString(record.signal_type) || readString(record.signalType);
  return signalType || null;
}

function extractRawSources(sourceArtifact: unknown): RawSourceEntry[] {
  const root = asRecord(sourceArtifact);
  if (!root) return [];
  const record = asRecord(root.sendPackage) ?? root;
  if (!Array.isArray(record.sources)) return [];
  return record.sources
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      url: readString(entry.url),
      title: readString(entry.title),
      source_class: readString(entry.source_class) || readString(entry.sourceClass),
      attribution_note: readString(entry.attribution_note) || readString(entry.attributionNote)
    }));
}

function extractValidationSourceUrls(validation: ScoreUpdateValidation | null | undefined): string[] {
  if (!validation) return [];
  const declaredSourceUrls = Array.isArray(validation.source_urls)
    ? validation.source_urls
    : Array.isArray(validation.sourceUrls)
      ? validation.sourceUrls
      : [];
  return declaredSourceUrls.map((url) => normalizeUrl(url)).filter(Boolean);
}

function extractNormalizedUrlChecks(validation: ScoreUpdateValidation | null | undefined): Map<string, number | null> {
  const urlChecks = Array.isArray(validation?.url_checks)
    ? validation.url_checks
    : Array.isArray(validation?.urlChecks)
      ? validation.urlChecks
      : Array.isArray(validation?.source_url_checks)
        ? validation.source_url_checks
        : Array.isArray(validation?.sourceUrlChecks)
          ? validation.sourceUrlChecks
          : [];

  return new Map(
    urlChecks
      .map((entry) => {
        const record = asRecord(entry);
        const url = normalizeUrl(readString(record?.url));
        const status =
          readNumber(record?.status) ??
          readNumber(record?.status_code) ??
          readNumber(record?.statusCode);
        return url ? [url, status] : null;
      })
      .filter((entry): entry is [string, number | null] => Boolean(entry))
  );
}

function looksLikeScoreUpdateSignal(sourceArtifact: unknown, headline: string, analysis: string, disclosure: string): boolean {
  const explicitSignalType = extractSignalType(sourceArtifact);
  if (explicitSignalType === "score_update_signal") {
    return true;
  }
  if (explicitSignalType === "quantum_signal") {
    return false;
  }

  if (extractScoreUpdateValidation(sourceArtifact)) {
    const validation = extractScoreUpdateValidation(sourceArtifact);
    const hasScoreFields = (
      readNumber(validation?.current_score) ??
      readNumber(validation?.currentScore) ??
      readNumber(validation?.dataset_current_score) ??
      readNumber(validation?.datasetCurrentScore)
    ) !== null || (
      readNumber(validation?.previous_score) ??
      readNumber(validation?.previousScore) ??
      readNumber(validation?.claimed_previous_score) ??
      readNumber(validation?.claimedPreviousScore)
    ) !== null || (
      readNumber(validation?.new_score) ??
      readNumber(validation?.newScore) ??
      readNumber(validation?.proposed_new_score) ??
      readNumber(validation?.proposedNewScore)
    ) !== null;
    if (hasScoreFields) {
      return true;
    }
  }

  const blob = `${headline}\n${analysis}\n${disclosure}`.toLowerCase();
  return (
    /\b\d+\s*(?:->|→)\s*\d+\b/.test(blob) ||
    /\bscore(?:\s+delta|\s+change|\s+transition|\s+update)?\b/.test(blob) ||
    /\bprevious score\b/.test(blob) ||
    /\bcurrent score\b/.test(blob) ||
    /\bdeveloper map\b/.test(blob) ||
    /\breadiness index\b/.test(blob) ||
    /\bscore-\d\b/.test(blob)
  );
}

async function fetchStatus(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    return response.status;
  } catch {
    return null;
  }
}

async function runScoreUpdateValidationAudit(
  sourceArtifact: unknown,
  payload: NonNullable<ReturnType<typeof parseCanonicalSignalPayload>["payload"]>,
  baseDir?: string
): Promise<string[]> {
  if (!looksLikeScoreUpdateSignal(sourceArtifact, payload.headline, payload.analysis, payload.disclosure)) {
    return [];
  }

  const validation = extractScoreUpdateValidation(sourceArtifact);
  if (!validation) {
    return [
      "hard-blocked from signable queue because score-update signals require pre_signal_validation with dataset baseline, source URL checks, and duplicate-check evidence"
    ];
  }

  const reasons: string[] = [];
  const primaryDatasetUrl = getQuantumMapPrimaryDatasetUrl();
  const fallbackDatasetUrl = getQuantumMapFallbackDatasetUrl();
  const datasetUrl = readString(validation.dataset_url) || readString(validation.datasetUrl);
  const subjectName = readString(validation.subject_name) || readString(validation.subjectName);
  const currentScore =
    readNumber(validation.current_score) ??
    readNumber(validation.currentScore) ??
    readNumber(validation.dataset_current_score) ??
    readNumber(validation.datasetCurrentScore);
  const previousScore =
    readNumber(validation.previous_score) ??
    readNumber(validation.previousScore) ??
    readNumber(validation.claimed_previous_score) ??
    readNumber(validation.claimedPreviousScore);
  const newScore =
    readNumber(validation.new_score) ??
    readNumber(validation.newScore) ??
    readNumber(validation.proposed_new_score) ??
    readNumber(validation.proposedNewScore);
  const datasetCheckedAt = readString(validation.dataset_checked_at) || readString(validation.datasetCheckedAt);
  const previousScoreReasoning =
    readString(validation.previous_score_reasoning_from_dataset) ||
    readString(validation.previousScoreReasoningFromDataset);
  const newScoreJustification =
    readString(validation.new_score_justification) ||
    readString(validation.newScoreJustification);
  const primarySourceUrl =
    normalizeUrl(readString(validation.primary_source_url) || readString(validation.primarySourceUrl));
  const primarySourceType =
    readString(validation.primary_source_type) || readString(validation.primarySourceType);
  const duplicateCheckPassed =
    readBoolean(validation.duplicate_check_passed) ??
    readBoolean(validation.duplicateCheckPassed);
  const hasDuplicateCheckPassedField =
    validation.duplicate_check_passed !== undefined || validation.duplicateCheckPassed !== undefined;
  const mapUpdateRequired =
    readBoolean(validation.map_update_required) ??
    readBoolean(validation.mapUpdateRequired);
  const hasMapUpdateRequiredField =
    mapUpdateRequired !== null || validation.map_update_required !== undefined || validation.mapUpdateRequired !== undefined;
  const mapUpdateStatus =
    readString(validation.map_update_status) || readString(validation.mapUpdateStatus);
  const duplicateCheck = asRecord(validation.duplicate_check) ?? asRecord(validation.duplicateCheck);
  const duplicateChecked = duplicateCheck?.checked === true;
  const duplicateFound = duplicateCheck?.duplicate_found === true || duplicateCheck?.duplicateFound === true;
  const normalizedDeclaredSourceUrls = extractValidationSourceUrls(validation);
  const normalizedUrlChecks = extractNormalizedUrlChecks(validation);

  if (!datasetUrl) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing dataset_url");
  } else if (!/data\.json(?:$|[?#])/.test(datasetUrl)) {
    reasons.push("hard-blocked from signable queue because score-update validation dataset_url must point to data.json");
  } else if (datasetUrl !== primaryDatasetUrl && datasetUrl !== fallbackDatasetUrl) {
    reasons.push(
      `hard-blocked from signable queue because score-update validation dataset_url must use the canonical quantum map primary or fallback endpoint (${primaryDatasetUrl})`
    );
  }

  if (!subjectName) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing subject_name");
  }

  if (currentScore === null) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing dataset current_score");
  } else if (!isIntegerScoreInRange(currentScore)) {
    reasons.push("hard-blocked from signable queue because score-update validation dataset current_score must be an integer from 1 to 5");
  }

  if (previousScore === null) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing claimed previous_score");
  } else if (!isIntegerScoreInRange(previousScore)) {
    reasons.push("hard-blocked from signable queue because score-update validation claimed previous_score must be an integer from 1 to 5");
  }

  if (currentScore !== null && previousScore !== null && currentScore !== previousScore) {
    reasons.push(`hard-blocked from signable queue because score-update baseline mismatch was recorded (${previousScore} claimed vs ${currentScore} from dataset)`);
  }

  if (newScore === null) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing proposed new_score");
  } else if (!isIntegerScoreInRange(newScore)) {
    reasons.push("hard-blocked from signable queue because score-update validation proposed new_score must be an integer from 1 to 5");
  } else if (previousScore !== null && newScore === previousScore) {
    reasons.push("hard-blocked from signable queue because score-update validation proposed_new_score must differ from claimed_previous_score");
  }

  if (!datasetCheckedAt) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing dataset_checked_at");
  } else if (!isIso8601DateTime(datasetCheckedAt)) {
    reasons.push("hard-blocked from signable queue because score-update validation dataset_checked_at must be an ISO-8601 UTC datetime");
  }

  if (!previousScoreReasoning) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing previous_score_reasoning_from_dataset");
  }

  if (!newScoreJustification) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing new_score_justification");
  }

  if (!primarySourceUrl) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing primary_source_url");
  }

  if (!primarySourceType) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing primary_source_type");
  } else if (primarySourceType === "secondary") {
    reasons.push("hard-blocked from signable queue because score-update validation primary_source_type cannot be secondary");
  }

  if (!hasDuplicateCheckPassedField) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing duplicate_check_passed");
  } else if (duplicateCheckPassed !== true) {
    reasons.push("hard-blocked from signable queue because score-update validation duplicate_check_passed must be true");
  } else if (!duplicateChecked || duplicateFound) {
    reasons.push("hard-blocked from signable queue because score-update validation duplicate_check_passed must match duplicate_check");
  }

  if (!hasMapUpdateRequiredField) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing map_update_required");
  } else if (mapUpdateRequired === null) {
    reasons.push("hard-blocked from signable queue because score-update validation map_update_required must be a boolean");
  }

  if (!mapUpdateStatus) {
    reasons.push("hard-blocked from signable queue because score-update validation is missing map_update_status");
  } else if (!["pending", "submitted", "confirmed"].includes(mapUpdateStatus)) {
    reasons.push("hard-blocked from signable queue because score-update validation map_update_status must be pending, submitted, or confirmed");
  }

  if (!duplicateChecked) {
    reasons.push("hard-blocked from signable queue because score-update validation did not record a duplicate/prior-investigation check");
  } else if (duplicateFound) {
    reasons.push("hard-blocked from signable queue because score-update validation found a prior investigation or duplicate evidence trail");
  }

  if (datasetUrl === fallbackDatasetUrl) {
    const primaryStatus = await fetchStatus(primaryDatasetUrl);
    if (primaryStatus === 200) {
      reasons.push(
        "hard-blocked from signable queue because the fallback quantum map was used while the canonical primary dataset remained reachable"
      );
    }
  }

  if (datasetUrl && subjectName) {
    try {
      const snapshot = await fetchAndCacheQuantumMapSnapshot({
        preferredUrl: datasetUrl,
        fetchedAt: datasetCheckedAt || undefined,
        baseDir
      });
      const located = locateQuantumSubject(snapshot, subjectName);
      if (!located) {
        reasons.push("hard-blocked from signable queue because the score-update subject was not found in the live dataset");
      } else if (located.quantum_urgency_score === null) {
        reasons.push("hard-blocked from signable queue because the live dataset entry for the score-update subject does not expose a readable score");
      } else if (previousScore !== null && located.quantum_urgency_score !== previousScore) {
        reasons.push(`hard-blocked from signable queue because live dataset baseline is ${located.quantum_urgency_score}, not the claimed ${previousScore}`);
      }
    } catch (error) {
      reasons.push(`hard-blocked from signable queue because score-update dataset_url could not be loaded (${(error as Error).message})`);
    }
  }

  const sourceUrls = payload.sources.map((source) => normalizeUrl(source.url)).filter(Boolean);
  const hasRecordedUrlChecks = normalizedUrlChecks.size > 0;
  if (primarySourceUrl) {
    const primarySourceStatus = normalizedUrlChecks.get(primarySourceUrl) ?? null;
    if (primarySourceStatus !== 200) {
      reasons.push("hard-blocked from signable queue because score-update validation primary_source_url must appear in url_checks with HTTP 200");
    }
  }

  for (const url of normalizedDeclaredSourceUrls) {
    if (!normalizedUrlChecks.has(url)) {
      reasons.push(`hard-blocked from signable queue because score-update validation source_urls entry ${url} is missing from url_checks`);
    }
  }

  for (const url of sourceUrls) {
    if (!normalizedDeclaredSourceUrls.includes(url)) {
      reasons.push(`hard-blocked from signable queue because payload source URL ${url} is missing from pre_signal_validation.source_urls`);
    }
  }

  for (const url of sourceUrls) {
    const status = hasRecordedUrlChecks
      ? normalizedUrlChecks.get(url) ?? null
      : await fetchStatus(url);
    if (status !== 200) {
      reasons.push(`hard-blocked from signable queue because source URL ${url} did not resolve with HTTP 200${status ? ` (got ${status})` : ""}`);
    }
  }

  return reasons;
}

function looksLikeQuantumSignal(sourceArtifact: unknown, payload: NonNullable<ReturnType<typeof parseCanonicalSignalPayload>["payload"]>): boolean {
  if (payload.beat_slug === "quantum") return true;
  const explicitType = extractSignalType(sourceArtifact);
  if (explicitType === "quantum_signal" || explicitType === "score_update_signal") return true;
  const combined = `${payload.headline}\n${payload.analysis}\n${payload.tags.join(" ")}`.toLowerCase();
  return /\bquantum\b|\bpost-quantum\b|\bpqc\b|\bcrqc\b|\bqubit\b/.test(combined);
}

function hasSpecificDate(text: string): boolean {
  return /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i.test(text) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(text);
}

function mentionsReadinessIndex(text: string): boolean {
  return /\breadiness index\b/i.test(text);
}

function hasBitcoinLink(text: string): boolean {
  return /\bbitcoin\b|\bbtc\b|\bp2pk\b|\bp2pkh\b|\bbip-360\b|\bpost-quantum soft fork\b/i.test(text);
}

async function runQuantumSignalValidationAudit(
  sourceArtifact: unknown,
  payload: NonNullable<ReturnType<typeof parseCanonicalSignalPayload>["payload"]>
): Promise<string[]> {
  if (!looksLikeQuantumSignal(sourceArtifact, payload)) {
    return [];
  }

  const reasons: string[] = [];
  const signalType = extractSignalType(sourceArtifact);
  const validation = extractScoreUpdateValidation(sourceArtifact);
  const rawSources = extractRawSources(sourceArtifact);
  const combinedText = `${payload.headline}\n${payload.analysis}`;
  const loweredHeadline = payload.headline.trim().toLowerCase();

  if (payload.beat_slug !== "quantum") {
    reasons.push("hard-blocked from signable queue because quantum signals must use beat_slug quantum");
  }

  if (payload.headline.length > 120) {
    reasons.push("hard-blocked from signable queue because quantum signal headline exceeds 120 characters");
  }

  if (loweredHeadline.endsWith(".")) {
    reasons.push("hard-blocked from signable queue because quantum signal headline must not end with a period");
  }

  if (payload.analysis.length > 1000) {
    reasons.push("hard-blocked from signable queue because quantum signal analysis exceeds 1000 characters");
  }

  if (!hasSpecificDate(combinedText)) {
    reasons.push("hard-blocked from signable queue because quantum signals must state a specific date, not a vague timeframe");
  }

  if (!hasBitcoinLink(combinedText)) {
    reasons.push("hard-blocked from signable queue because quantum signals must make an explicit Bitcoin link");
  }

  if (!payload.tags.includes("quantum")) {
    reasons.push("hard-blocked from signable queue because quantum signals must include the quantum tag");
  }

  for (const source of rawSources) {
    const sourceClass = source.source_class?.trim() ?? "";
    if (sourceClass === "secondary" && !source.attribution_note?.trim()) {
      reasons.push("hard-blocked from signable queue because secondary quantum sources must include an attribution note");
    }
    if (sourceClass === "social_media" && !source.attribution_note?.trim()) {
      reasons.push("hard-blocked from signable queue because social media quantum sources must include an attribution note or snowflake confirmation");
    }
  }

  if (mentionsReadinessIndex(combinedText)) {
    const readinessMath = asRecord(validation?.readiness_math_check) ?? asRecord(validation?.readinessMathCheck);
    const beforeIndex = readNumber(readinessMath?.before_index) ?? readNumber(readinessMath?.beforeIndex);
    const afterIndex = readNumber(readinessMath?.after_index) ?? readNumber(readinessMath?.afterIndex);
    const scoreDelta = readNumber(readinessMath?.score_delta) ?? readNumber(readinessMath?.scoreDelta);
    const calculation = readString(readinessMath?.calculation);

    if (beforeIndex === null || afterIndex === null || scoreDelta === null || !calculation) {
      reasons.push("hard-blocked from signable queue because readiness index was mentioned without readiness_math_check");
    } else if (afterIndex !== beforeIndex + scoreDelta) {
      reasons.push("hard-blocked from signable queue because readiness math check does not reconcile after_index = before_index + score_delta");
    }
  }

  if ((signalType === "quantum_signal" || signalType === "score_update_signal") && validation) {
    const scopeCheck = asRecord(validation.scope_check) ?? asRecord(validation.scopeCheck);
    const scopePassed = scopeCheck?.passed === true;
    const category = readString(scopeCheck?.category);
    const bitcoinCheck = asRecord(validation.bitcoin_relevance_check) ?? asRecord(validation.bitcoinRelevanceCheck);
    const bitcoinNamed = bitcoinCheck?.bitcoin_named === true || bitcoinCheck?.bitcoinNamed === true;
    const exactClaimCheck = asRecord(validation.exact_claim_check) ?? asRecord(validation.exactClaimCheck);
    const reviewerCheck = asRecord(validation.reviewer_verifiability_check) ?? asRecord(validation.reviewerVerifiabilityCheck);

    if (!scopePassed || ![
      "developer_stance_change",
      "technical_milestone",
      "timeline_update",
      "bitcoin_exposure_data",
      "policy_institutional"
    ].includes(category)) {
      reasons.push("hard-blocked from signable queue because quantum pre_signal_validation failed the beat scope check");
    }

    if (!bitcoinNamed) {
      reasons.push("hard-blocked from signable queue because quantum pre_signal_validation failed the Bitcoin relevance check");
    }

    if (exactClaimCheck?.passed !== true) {
      reasons.push("hard-blocked from signable queue because quantum pre_signal_validation did not verify the exact claim at the cited URL");
    }

    if (reviewerCheck?.passed !== true) {
      reasons.push("hard-blocked from signable queue because quantum pre_signal_validation did not record reviewer verifiability");
    }
  }

  const sourceUrls = payload.sources.map((source) => normalizeUrl(source.url)).filter(Boolean);
  const normalizedDeclaredSourceUrls = extractValidationSourceUrls(validation);
  const normalizedUrlChecks = extractNormalizedUrlChecks(validation);
  const hasRecordedUrlChecks = normalizedUrlChecks.size > 0;

  for (const url of normalizedDeclaredSourceUrls) {
    if (!normalizedUrlChecks.has(url)) {
      reasons.push(`hard-blocked from signable queue because quantum pre_signal_validation source_urls entry ${url} is missing from url_checks`);
    }
  }

  if (validation) {
    for (const url of sourceUrls) {
      if (!normalizedDeclaredSourceUrls.includes(url)) {
        reasons.push(`hard-blocked from signable queue because payload source URL ${url} is missing from pre_signal_validation.source_urls`);
      }
    }
  }

  for (const url of sourceUrls) {
    const status = hasRecordedUrlChecks
      ? normalizedUrlChecks.get(url) ?? null
      : await fetchStatus(url);
    if (status !== 200) {
      reasons.push(`hard-blocked from signable queue because quantum source URL ${url} did not resolve with HTTP 200${status ? ` (got ${status})` : ""}`);
    }
  }

  return reasons;
}

export async function runPreSubmitAudit(
  reportDate: string,
  candidate: RankedCandidate,
  baseDir?: string
): Promise<PreSubmitAuditResult> {
  const root = resolve(baseDir ?? process.cwd());
  const reasons: string[] = [];
  const sourcePath = candidate.sourcePath.startsWith("/")
    ? candidate.sourcePath
    : resolve(root, candidate.sourcePath);
  const reportPath = resolve(root, `data/reports/signals/${reportDate}.md`);

  const [sourceArtifact, signalReportText] = await Promise.all([
    readJsonIfExists<unknown>(sourcePath),
    readFile(reportPath, "utf8").catch(() => "")
  ]);

  if (!sourceArtifact) {
    reasons.push("hard-blocked from signable queue because the source artifact is missing");
    return { ok: false, reasons };
  }

  // ── Filing gate check ────────────────────────────────────────────────────
  // The gate MUST be present and fully passing before any other check runs.
  // A signal that looks canonical but lacks explicit Q1–Q4 evidence is a
  // draft; it cannot be promoted to a filing candidate.
  const gateValidation = validateFilingGate(sourceArtifact);
  if (gateValidation.issues.length > 0) {
    reasons.push(...filingGateIssuesToBlockers(gateValidation.issues));
    return { ok: false, reasons };
  }

  const { payload, issues } = parseCanonicalSignalPayload(sourceArtifact);
  const headline = payload?.headline ?? "";
  const analysis = payload?.analysis ?? "";
  const sources = payload?.sources ?? [];
  const tags = payload?.tags ?? [];
  const disclosure = payload?.disclosure ?? "";

  if (issues.length > 0) {
    reasons.push(
      ...issues.map((issue) => `hard-blocked from signable queue because canonical signal format is broken: ${issue.reason}`)
    );
  }

  if (!headline || !analysis) {
    reasons.push("hard-blocked from signable queue because the source artifact is missing headline/analysis");
  }

  // Cross-check gate headline against the canonical headline to detect
  // a gate that was copied from a different signal or left as a placeholder.
  if (headline && gateValidation.gate && gateValidation.gate.headline !== headline) {
    reasons.push(
      `hard-blocked from signable queue because filing_gate.headline ("${gateValidation.gate.headline}") does not match the canonical headline ("${headline}") — the gate was run against a different signal`
    );
  }

  if (sources.length === 0) {
    reasons.push("hard-blocked from signable queue because the source artifact is missing sources");
  }
  if (tags.length === 0) {
    reasons.push("hard-blocked from signable queue because the source artifact is missing tags");
  }
  if (!disclosure) {
    reasons.push("hard-blocked from signable queue because the source artifact is missing disclosure");
  }
  if (!signalReportText.includes(candidate.headline)) {
    reasons.push("hard-blocked from signable queue because the dated signal report does not include this headline");
  }
  if (payload) {
    const helperPackage = buildHelperReadySignalPackage(payload);
    if (helperPackage.json.headline !== headline || helperPackage.json.analysis !== analysis) {
      reasons.push("hard-blocked from signable queue because helper-ready payload does not match the canonical artifact");
    }

    reasons.push(...(await runQuantumSignalValidationAudit(sourceArtifact, payload)));
    reasons.push(...(await runScoreUpdateValidationAudit(sourceArtifact, payload, root)));
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const guard = await evaluateSignalGuard({
    reportDate,
    headline,
    beat_slug: candidate.beat,
    body: analysis,
    sources,
    enforceWinnerBar: true,
    model_disclosure: {
      tools_used: [],
      derivation_steps: [disclosure]
    }
  }, root);

  if (!guard.ok) {
    reasons.push(...guard.blockers.map((blocker) => `hard-blocked from signable queue by pre-submit audit: ${blocker}`));
  }

  return { ok: reasons.length === 0, reasons };
}
