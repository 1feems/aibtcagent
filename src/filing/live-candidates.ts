import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFilingQueue, type FilingQueueItem } from "./queue.js";
import {
  resolveLiveReadyArtifactPath,
  type FilingReadyArtifact,
  type FilingReadyArtifactSubmission
} from "./artifacts.js";
import { validatePublisherReadySubmission } from "./publisher-validation.js";

export interface LiveCandidateEntry {
  candidateId: string;
  headline: string;
  dek: string | null;
  lede: string | null;
  whyItMatters: string | null;
  proofSummary: string | null;
  beat: string;
  filingBeatSlug: string;
  score: number;
  queueStatus: FilingQueueItem["queueStatus"];
  dispatchStatus: "queued" | "sent";
  sourcePath: string;
  artifactPath: string | null;
  reasons: string[];
}

export interface LiveCandidateSlate {
  kind: "live_candidate_slate";
  reportDate: string;
  generatedAt: string;
  topCandidateId: string | null;
  candidates: LiveCandidateEntry[];
  notes: string[];
}

function parseArgs(argv: string[]): { reportDate: string } {
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
  return {
    reportDate: parsed.get("date") ?? now.slice(0, 10)
  };
}

function resolveLiveSlatePath(reportDate: string, baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), `data/live-candidates/${reportDate}.json`);
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

async function loadSubmissionForQueueItem(
  reportDate: string,
  item: FilingQueueItem,
  baseDir?: string
): Promise<{
  submission: FilingReadyArtifactSubmission | null;
  artifactPath: string | null;
  artifactIntendedUse: FilingReadyArtifact["intendedUse"] | null;
}> {
  if (item.queueStatus === "approved_for_filing" || item.queueStatus === "filed") {
    const artifactPath = resolveLiveReadyArtifactPath(reportDate, item.candidateId, baseDir);
    const artifact = await readJsonOrNull<FilingReadyArtifact>(artifactPath);
    return {
      submission: artifact?.submission ?? null,
      artifactPath: artifact ? artifactPath : null,
      artifactIntendedUse: artifact?.intendedUse ?? null
    };
  }

  if (!item.sourcePath) {
    return {
      submission: null,
      artifactPath: null,
      artifactIntendedUse: null
    };
  }

  const source = await readJsonOrNull<FilingReadyArtifactSubmission>(item.sourcePath);
  return {
    submission: source,
    artifactPath: null,
    artifactIntendedUse: null
  };
}

export async function generateLiveCandidateSlate(
  reportDate: string,
  baseDir?: string
): Promise<LiveCandidateSlate> {
  let queue = null;
  try {
    queue = await readFilingQueue(reportDate, baseDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  if (!queue) {
    return {
      kind: "live_candidate_slate",
      reportDate,
      generatedAt: new Date().toISOString(),
      topCandidateId: null,
      candidates: [],
      notes: ["No filing queue exists for this report date yet."]
    };
  }

  const liveQueueItems = queue.items.filter((item) =>
    item.queueStatus === "approved_for_filing" || item.queueStatus === "filed"
  );

  const candidates: LiveCandidateEntry[] = [];
  const notes: string[] = [];

  for (const item of liveQueueItems) {
    const { submission, artifactPath, artifactIntendedUse } = await loadSubmissionForQueueItem(reportDate, item, baseDir);
    if (!submission) {
      notes.push(`Excluded ${item.candidateId}: live candidate source payload is missing.`);
      continue;
    }

    if (!artifactPath) {
      notes.push(`Excluded ${item.candidateId}: live send slate requires a filing-ready artifact.`);
      continue;
    }

    if (artifactIntendedUse && artifactIntendedUse !== "live") {
      notes.push(`Excluded ${item.candidateId}: helper-test artifacts cannot appear in the live send slate.`);
      continue;
    }

    const validation = validatePublisherReadySubmission(submission);
    if (!validation.valid) {
      notes.push(`Excluded ${item.candidateId}: ${validation.reasons.join("; ")}`);
      continue;
    }

    candidates.push({
      candidateId: item.candidateId,
      headline: submission.headline?.trim() ?? item.headline,
      dek: submission.article_preview?.dek?.trim() ?? null,
      lede: submission.article_preview?.lede?.trim() ?? null,
      whyItMatters: submission.article_preview?.why_it_matters?.trim() ?? null,
      proofSummary: submission.article_preview?.proof_summary?.trim() ?? null,
      beat: item.beat,
      filingBeatSlug: (item as FilingQueueItem & { filingBeatSlug?: string }).filingBeatSlug ?? item.beat,
      score: item.score,
      queueStatus: item.queueStatus,
      dispatchStatus: item.queueStatus === "filed" ? "sent" : "queued",
      sourcePath: item.sourcePath,
      artifactPath,
      reasons: item.reasons
    });
  }

  return {
    kind: "live_candidate_slate",
    reportDate,
    generatedAt: new Date().toISOString(),
    topCandidateId: candidates[0]?.candidateId ?? null,
    candidates,
    notes:
      notes.length > 0
        ? notes
        : [
            "Live candidate slate generated from filing-ready entries that passed publisher-style validation.",
            "This file should contain only signals intended to be sent or already sent.",
            "Operational dispatch statuses are limited to queued or sent."
          ]
  };
}

export async function saveLiveCandidateSlate(
  slate: LiveCandidateSlate,
  baseDir?: string
): Promise<string> {
  const filePath = resolveLiveSlatePath(slate.reportDate, baseDir);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(slate, null, 2) + "\n", "utf8");
  return filePath;
}

export async function readLiveCandidateSlate(
  reportDate: string,
  baseDir?: string
): Promise<LiveCandidateSlate | null> {
  return readJsonOrNull<LiveCandidateSlate>(resolveLiveSlatePath(reportDate, baseDir));
}

async function main(): Promise<void> {
  const { reportDate } = parseArgs(process.argv.slice(2));
  const slate = await generateLiveCandidateSlate(reportDate);
  const path = await saveLiveCandidateSlate(slate);
  const lines = [
    `live-candidate-slate ${reportDate}`,
    `path: ${path}`,
    `count: ${slate.candidates.length}`
  ];

  for (const candidate of slate.candidates) {
    lines.push("");
    lines.push(`${candidate.headline}`);
    if (candidate.dek) lines.push(candidate.dek);
    if (candidate.lede) lines.push(candidate.lede);
    if (candidate.whyItMatters) lines.push(`Why it matters: ${candidate.whyItMatters}`);
    if (candidate.proofSummary) lines.push(`Proof: ${candidate.proofSummary}`);
    lines.push(`Candidate: ${candidate.candidateId} | Beat: ${candidate.beat} | Score: ${candidate.score}`);
  }

  if (slate.notes.length > 0) {
    lines.push("");
    lines.push("notes:");
    for (const note of slate.notes) {
      lines.push(`- ${note}`);
    }
  }

  process.stdout.write(lines.join("\n") + "\n");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
