// ── Filing-ready append helper ────────────────────────────────────────────────
//
// Single trusted write path for data/filing-ready/.
//
// RULES enforced by this module:
//   1. Every entry MUST pass validateFilingGate() before it is written.
//      The helper throws FilingReadyValidationError if the gate fails.
//   2. Existing entries are never overwritten (append-only).
//      The helper throws FilingReadyConflictError if the target already exists.
//   3. Every written file carries appendedVia: "filing-ready-append" so audits
//      can confirm the entry came through this path and not a direct writeFile.
//
// All code that writes to data/filing-ready/ MUST call
// appendFilingReadyArtifact() — direct writeFile calls to that directory
// bypass the validation contract.

import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { filingGateIssuesToBlockers, validateFilingGate } from "./filing-gate-validator.js";
import type { CandidateLifecycle } from "./lifecycle.js";

// ── public types ──────────────────────────────────────────────────────────────

export interface FilingReadyAppendOptions {
  reportDate: string;
  candidateId: string;
  reviewedBy: string;
  reviewedAt: string;
  lifecycle: CandidateLifecycle;
  approvalReasons: string[];
  operatorRationale: string;
  sourcePath: string;
  /** Raw source artifact — validated by this helper before writing. */
  rawSubmission: unknown;
  /** Parsed canonical signal payload (pre-computed by caller). */
  canonicalSignal: unknown;
  /** Helper-ready send package (pre-computed by caller, may be null). */
  sendPackage: unknown;
}

export interface FilingReadyEntry {
  kind: "filing_ready_submission";
  reportDate: string;
  candidateId: string;
  reviewedBy: string;
  reviewedAt: string;
  /** Provenance stamp — present on every entry written through this helper. */
  appendedVia: "filing-ready-append";
  lifecycle: CandidateLifecycle;
  approvalEvidence: {
    decision: "approve";
    reasons: string[];
    operatorRationale: string;
  };
  sourcePath: string;
  canonicalSignal: unknown;
  submission: unknown;
  sendPackage: unknown;
}

// ── error classes ─────────────────────────────────────────────────────────────

export class FilingReadyValidationError extends Error {
  readonly blockers: string[];

  constructor(candidateId: string, blockers: string[]) {
    super(
      `Candidate ${candidateId} failed filing-ready gate validation and cannot be appended: ${blockers.join("; ")}`
    );
    this.name = "FilingReadyValidationError";
    this.blockers = blockers;
  }
}

export class FilingReadyConflictError extends Error {
  readonly targetPath: string;

  constructor(candidateId: string, targetPath: string) {
    super(
      `Candidate ${candidateId} already has a filing-ready entry at ${targetPath} — ` +
      `the filing-ready list is append-only and existing entries must not be overwritten`
    );
    this.name = "FilingReadyConflictError";
    this.targetPath = targetPath;
  }
}

// ── internal helpers ──────────────────────────────────────────────────────────

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * The single trusted write path for data/filing-ready/.
 *
 * Steps (in order — all must pass before the file is written):
 *   1. Validate `options.rawSubmission` through `validateFilingGate`.
 *      Throws `FilingReadyValidationError` on any gate failure.
 *   2. Check that the target path does not already exist.
 *      Throws `FilingReadyConflictError` if it does.
 *   3. Write the entry with an `appendedVia: "filing-ready-append"` stamp.
 *
 * Returns the absolute path of the written file.
 */
export async function appendFilingReadyArtifact(
  options: FilingReadyAppendOptions,
  baseDir?: string
): Promise<string> {
  // ── step 1: gate validation — hard block before any I/O ───────────────────
  const gateResult = validateFilingGate(options.rawSubmission);
  if (gateResult.issues.length > 0) {
    throw new FilingReadyValidationError(
      options.candidateId,
      filingGateIssuesToBlockers(gateResult.issues)
    );
  }

  const root = baseDir ?? process.cwd();
  const targetPath = resolve(
    root,
    `data/filing-ready/${options.reportDate}/${options.candidateId}.json`
  );

  // ── step 2: append-only guard — refuse to overwrite an existing entry ──────
  if (await pathExists(targetPath)) {
    throw new FilingReadyConflictError(options.candidateId, targetPath);
  }

  // ── step 3: write with provenance stamp ───────────────────────────────────
  const entry: FilingReadyEntry = {
    kind: "filing_ready_submission",
    reportDate: options.reportDate,
    candidateId: options.candidateId,
    reviewedBy: options.reviewedBy,
    reviewedAt: options.reviewedAt,
    appendedVia: "filing-ready-append",
    lifecycle: options.lifecycle,
    approvalEvidence: {
      decision: "approve",
      reasons: options.approvalReasons,
      operatorRationale: options.operatorRationale
    },
    sourcePath: options.sourcePath,
    canonicalSignal: options.canonicalSignal,
    submission: options.rawSubmission,
    sendPackage: options.sendPackage
  };

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(entry, null, 2), "utf8");
  return targetPath;
}
