import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveLiveReadyArtifactPath, type FilingReadyArtifact } from "./artifacts.js";
import { validatePublisherReadySubmission } from "./publisher-validation.js";

const SUBMISSION_INTENT_PATTERNS = [
  /give me the json/i,
  /is this sendable/i,
  /fix helper error/i,
  /mark as sent/i,
  /fill the signal template/i,
  /prepare submission/i
];

export interface RepoModeIntentResult {
  repoModeRequired: boolean;
  matchedPattern: string | null;
}

export interface RepoModeResolution {
  ok: boolean;
  reason: string | null;
  artifactPath: string | null;
  artifact: FilingReadyArtifact | null;
}

export function detectRepoModeIntent(text: string): RepoModeIntentResult {
  const matched = SUBMISSION_INTENT_PATTERNS.find((pattern) => pattern.test(text));
  return {
    repoModeRequired: Boolean(matched),
    matchedPattern: matched ? matched.source : null
  };
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function resolveRepoModeSubmission(
  reportDate: string,
  candidateId: string,
  baseDir?: string
): Promise<RepoModeResolution> {
  const artifactPath = resolve(
    resolveLiveReadyArtifactPath(reportDate, candidateId, baseDir ?? process.cwd())
  );

  let artifact: FilingReadyArtifact;
  try {
    artifact = await readJsonFile<FilingReadyArtifact>(artifactPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        ok: false,
        reason: `repo mode requires a filing-ready artifact at data/filing-ready/${reportDate}/${candidateId}.json`,
        artifactPath,
        artifact: null
      };
    }
    throw error;
  }

  if (artifact.intendedUse && artifact.intendedUse !== "live") {
    return {
      ok: false,
      reason: "repo mode blocked: helper-test artifacts are not sendable",
      artifactPath,
      artifact
    };
  }

  const validation = validatePublisherReadySubmission(artifact.submission);
  if (!validation.valid) {
    return {
      ok: false,
      reason: `repo mode blocked: ${validation.reasons.join("; ")}`,
      artifactPath,
      artifact
    };
  }

  return {
    ok: true,
    reason: null,
    artifactPath,
    artifact
  };
}
