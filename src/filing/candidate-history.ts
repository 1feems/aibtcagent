import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

interface SerializedSource {
  source_name?: string;
  source_url?: string;
  source_role?: string;
}

interface FilingReadyArtifact {
  kind: "filing_ready_submission";
  reportDate: string;
  candidateId: string;
  reviewedBy: string;
  reviewedAt: string;
  sourcePath: string;
  submission?: {
    headline?: string;
    candidate_signal?: {
      beat?: string;
    };
    candidate_metadata?: {
      style_tested?: string;
      competitor_reference?: string | null;
      why_this_style_was_chosen?: string;
      duplicate_status?: "clear" | "pending" | "flagged";
      freshness_status?: "clear" | "risk_unresolved" | "unknown";
    };
    sources?: SerializedSource[];
  };
}

export interface CandidateHistoryRecord {
  kind: "candidate_history";
  reportDate: string;
  candidateId: string;
  headline: string | null;
  beat: string | null;
  sourcePath: string | null;
  sourceSummary: Array<{
    name: string;
    url: string;
    role: string;
    domain: string;
  }>;
  sourceDomains: string[];
  candidateMetadata: {
    styleTested: string | null;
    competitorReference: string | null;
    whyThisStyleWasChosen: string | null;
    duplicateStatus: "clear" | "pending" | "flagged" | null;
    freshnessStatus: "clear" | "risk_unresolved" | "unknown" | null;
  };
  review: {
    reviewedBy: string | null;
    reviewedAt: string | null;
    readyArtifactPath: string | null;
  };
  filing: {
    signalId: string | null;
    filedAt: string | null;
  };
  outcome: {
    status: "approved" | "rejected" | "submitted" | "unknown" | null;
    approved: boolean | null;
    publishedInBrief: boolean | null;
    success: boolean | null;
    failureMode: "not_in_brief" | "rejected" | "pending" | "unknown" | null;
    recordedAt: string | null;
    note: string | null;
    learningWhy: string | null;
  };
}

function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function resolveHistoryJsonPath(candidateId: string, baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), `data/candidate-history/${candidateId}.json`);
}

function resolveHistoryMarkdownPath(candidateId: string, baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), `data/candidate-history/${candidateId}.md`);
}

function renderMarkdown(record: CandidateHistoryRecord): string {
  return [
    `# Candidate History: ${record.candidateId}`,
    "",
    `Report date: ${record.reportDate}`,
    `Headline: ${record.headline ?? "n/a"}`,
    `Beat: ${record.beat ?? "n/a"}`,
    `Style tested: ${record.candidateMetadata.styleTested ?? "n/a"}`,
    `Competitor reference: ${record.candidateMetadata.competitorReference ?? "n/a"}`,
    `Duplicate status: ${record.candidateMetadata.duplicateStatus ?? "n/a"}`,
    `Freshness status: ${record.candidateMetadata.freshnessStatus ?? "n/a"}`,
    `Reviewed by: ${record.review.reviewedBy ?? "n/a"}`,
    `Reviewed at: ${record.review.reviewedAt ?? "n/a"}`,
    `Signal ID: ${record.filing.signalId ?? "not filed yet"}`,
    `Filed at: ${record.filing.filedAt ?? "not filed yet"}`,
    `Outcome status: ${record.outcome.status ?? "unknown"}`,
    `Approved: ${record.outcome.approved === null ? "unknown" : String(record.outcome.approved)}`,
    `Published in Brief: ${record.outcome.publishedInBrief === null ? "unknown" : String(record.outcome.publishedInBrief)}`,
    `Success: ${record.outcome.success === null ? "unknown" : String(record.outcome.success)}`,
    `Failure mode: ${record.outcome.failureMode ?? "n/a"}`,
    "",
    "## Sources",
    ...(record.sourceSummary.length === 0
      ? ["- No sources captured."]
      : record.sourceSummary.map((source) => `- [${source.role}] ${source.name} — ${source.domain} — ${source.url}`)),
    "",
    "## Notes",
    `- Why this style was chosen: ${record.candidateMetadata.whyThisStyleWasChosen ?? "n/a"}`,
    `- Source path: ${record.sourcePath ?? "n/a"}`,
    `- Ready artifact: ${record.review.readyArtifactPath ?? "n/a"}`,
    `- Outcome note: ${record.outcome.note ?? "n/a"}`,
    `- Learning why: ${record.outcome.learningWhy ?? "n/a"}`,
    ""
  ].join("\n");
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

async function saveCandidateHistory(record: CandidateHistoryRecord, baseDir?: string): Promise<string> {
  const jsonPath = resolveHistoryJsonPath(record.candidateId, baseDir);
  const markdownPath = resolveHistoryMarkdownPath(record.candidateId, baseDir);
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(record, null, 2) + "\n", "utf8");
  await writeFile(markdownPath, renderMarkdown(record), "utf8");
  return jsonPath;
}

export async function readCandidateHistory(
  candidateId: string,
  baseDir?: string
): Promise<CandidateHistoryRecord | null> {
  return readJsonOrNull<CandidateHistoryRecord>(resolveHistoryJsonPath(candidateId, baseDir));
}

export async function upsertCandidateHistoryFromReadyArtifact(
  readyArtifactPath: string,
  baseDir?: string
): Promise<string> {
  const artifact = JSON.parse(await readFile(readyArtifactPath, "utf8")) as FilingReadyArtifact;
  const existing = await readCandidateHistory(artifact.candidateId, baseDir);
  const sourceSummary = (artifact.submission?.sources ?? []).map((source) => ({
    name: source.source_name ?? "Unknown source",
    url: source.source_url ?? "",
    role: source.source_role ?? "unknown",
    domain: extractDomain(source.source_url ?? "")
  }));

  const record: CandidateHistoryRecord = {
    kind: "candidate_history",
    reportDate: artifact.reportDate,
    candidateId: artifact.candidateId,
    headline: artifact.submission?.headline ?? existing?.headline ?? null,
    beat: artifact.submission?.candidate_signal?.beat ?? existing?.beat ?? null,
    sourcePath: artifact.sourcePath ?? existing?.sourcePath ?? null,
    sourceSummary,
    sourceDomains: [...new Set(sourceSummary.map((source) => source.domain))].sort(),
    candidateMetadata: {
      styleTested: artifact.submission?.candidate_metadata?.style_tested ?? existing?.candidateMetadata?.styleTested ?? null,
      competitorReference: artifact.submission?.candidate_metadata?.competitor_reference ?? existing?.candidateMetadata?.competitorReference ?? null,
      whyThisStyleWasChosen: artifact.submission?.candidate_metadata?.why_this_style_was_chosen ?? existing?.candidateMetadata?.whyThisStyleWasChosen ?? null,
      duplicateStatus: artifact.submission?.candidate_metadata?.duplicate_status ?? existing?.candidateMetadata?.duplicateStatus ?? null,
      freshnessStatus: artifact.submission?.candidate_metadata?.freshness_status ?? existing?.candidateMetadata?.freshnessStatus ?? null
    },
    review: {
      reviewedBy: artifact.reviewedBy,
      reviewedAt: artifact.reviewedAt,
      readyArtifactPath
    },
    filing: existing?.filing ?? {
      signalId: null,
      filedAt: null
    },
    outcome: existing?.outcome ?? {
      status: null,
      approved: null,
      publishedInBrief: null,
      success: null,
      failureMode: null,
      recordedAt: null,
      note: null,
      learningWhy: null
    }
  };

  return saveCandidateHistory(record, baseDir);
}

export async function markCandidateFiled(
  candidateId: string,
  signalId: string,
  filedAt: string,
  baseDir?: string
): Promise<string | null> {
  const existing = await readCandidateHistory(candidateId, baseDir);
  if (!existing) {
    return null;
  }

  existing.filing.signalId = signalId;
  existing.filing.filedAt = filedAt;
  return saveCandidateHistory(existing, baseDir);
}

export async function markCandidateOutcome(
  candidateId: string,
  outcome: {
    status: "approved" | "rejected" | "submitted" | "unknown";
    approved: boolean;
    publishedInBrief: boolean;
    success: boolean;
    failureMode: "not_in_brief" | "rejected" | "pending" | "unknown" | null;
    recordedAt: string;
    note: string | null;
    learningWhy?: string | null;
  },
  baseDir?: string
): Promise<string | null> {
  const existing = await readCandidateHistory(candidateId, baseDir);
  if (!existing) {
    return null;
  }

  existing.outcome = {
    status: outcome.status,
    approved: outcome.approved,
    publishedInBrief: outcome.publishedInBrief,
    success: outcome.success,
    failureMode: outcome.failureMode,
    recordedAt: outcome.recordedAt,
    note: outcome.note,
    learningWhy: outcome.learningWhy ?? null
  };
  return saveCandidateHistory(existing, baseDir);
}
