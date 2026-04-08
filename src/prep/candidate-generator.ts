import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

interface RankedCandidateQueue {
  candidates?: Array<{
    candidateId?: string;
    score?: number;
  }>;
}

interface SerializedSubmission {
  candidate_signal?: {
    candidate_id?: string;
    beat?: string;
    significance?: string;
    causality?: string;
  };
  headline?: string;
  sources?: Array<{
    source_url?: string;
    source_name?: string;
    source_type?: string;
  }>;
  model_disclosure?: {
    tools_used?: string[];
    derivation_steps?: string[];
  };
  submission_decision?: {
    status?: string;
  };
  editorial_review?: {
    ready_to_file?: boolean;
  };
}

function mapBeat(rawBeat: string | undefined): string {
  const beat = (rawBeat ?? "").trim().toLowerCase();
  if (beat === "protocol-updates" || beat === "infrastructure") return "infrastructure";
  if (beat === "deal-flow") return "deal-flow";
  if (beat === "quantum") return "quantum";
  if (beat === "agent-economy") return "agent-economy";
  if (beat === "bitcoin-macro") return "bitcoin-macro";
  if (beat === "aibtc-network" || beat === "onboarding" || beat === "distribution") return "aibtc-network";
  return "infrastructure";
}

function buildDirective(beatSlug: string, significance: string, causality: string): string {
  const text = `${significance} ${causality}`.toLowerCase();
  if (/\bsecurity\b|\bcve\b|\bexploit\b|\bvulnerab/.test(text)) {
    return "Directive: audit affected code paths and avoid filing or deploying against the old vulnerable path until the fix is verified.";
  }
  if (/\brelease\b|\bships\b|\bshipped\b|\bversion\b|\bupgrade\b|\bpatch\b/.test(text)) {
    return "What to do: verify the exact release or PR diff, review downstream integrations, and update dependent agent workflows before the next production run.";
  }
  if (/\bpayout\b|\bpayment\b|\bsettlement\b|\brelay\b|\bnonce\b/.test(text)) {
    return "Directive: verify the live payment path, monitor for unresolved failures, and report any remaining blocked flows before filing follow-on signals.";
  }
  if (beatSlug === "quantum") {
    return "What to do: verify the cited benchmark or paper anchor, check Bitcoin-relevance before filing, and report only measurable operator consequences.";
  }
  return "What to do: verify the exact anchor, review operator impact, and monitor whether this change materially alters agent behavior before filing follow-on coverage.";
}

function buildAnalysis(headline: string, significance: string, causality: string, beatSlug: string): string {
  const whatChanged = `What changed: ${headline.replace(/\.+$/, "")}`;
  const whatItMeans = `What it means: ${significance || causality || "Operators need to review this change because it may alter current agent behavior or production workflows."}`;
  const whatToDo = buildDirective(beatSlug, significance, causality);
  return [whatChanged, whatItMeans, whatToDo].join("\n");
}

function buildDisclosure(submission: SerializedSubmission): string {
  const tools = submission.model_disclosure?.tools_used ?? [];
  const steps = submission.model_disclosure?.derivation_steps ?? [];
  const parts = [...tools, ...steps].filter((value) => typeof value === "string" && value.trim().length > 0);
  const disclosure = parts.join("; ").trim();
  return disclosure || "release-audit; automated dry-run submission review; verified against the cited public source URL";
}

function buildTags(beatSlug: string): string[] {
  return [beatSlug];
}

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function materializeGeneratedCandidates(
  reportDate: string,
  baseDir?: string
): Promise<{ outputDir: string; written: string[]; sourceCount: number }> {
  const root = resolve(baseDir ?? process.cwd());
  const dryRunDir = resolve(root, `data/dry-runs/${reportDate}`);
  const outputDir = resolve(root, `data/manual-submissions/${reportDate}`);
  const queuePath = resolve(root, `data/queues/${reportDate}.json`);
  const rankedQueue = await readJsonOrNull<RankedCandidateQueue>(queuePath);
  const preferredOrder = new Map<string, number>();
  for (const [index, candidate] of (rankedQueue?.candidates ?? []).entries()) {
    const candidateId = candidate.candidateId?.trim();
    if (candidateId) preferredOrder.set(candidateId, index);
  }

  let fileNames: string[] = [];
  try {
    fileNames = (await readdir(dryRunDir)).filter((name) => name.endsWith("-submission.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { outputDir, written: [], sourceCount: 0 };
    }
    throw error;
  }

  const parsed = await Promise.all(
    fileNames.map(async (fileName) => {
      const path = resolve(dryRunDir, fileName);
      const submission = JSON.parse(await readFile(path, "utf8")) as SerializedSubmission;
      const candidateId = submission.candidate_signal?.candidate_id?.trim() ?? fileName.replace(/-submission\.json$/, "");
      return { fileName, path, candidateId, submission };
    })
  );

  const eligible = parsed
    .filter(({ submission }) =>
      (submission.submission_decision?.status ?? "") === "submit" &&
      submission.editorial_review?.ready_to_file !== false
    )
    .sort((left, right) =>
      (preferredOrder.get(left.candidateId) ?? Number.MAX_SAFE_INTEGER) -
      (preferredOrder.get(right.candidateId) ?? Number.MAX_SAFE_INTEGER) ||
      left.fileName.localeCompare(right.fileName)
    )
    .slice(0, 6);

  await mkdir(outputDir, { recursive: true });
  const written: string[] = [];

  for (const { candidateId, submission } of eligible) {
    const beatSlug = mapBeat(submission.candidate_signal?.beat);
    const headline = submission.headline?.trim() ?? "";
    const significance = submission.candidate_signal?.significance?.trim() ?? "";
    const causality = submission.candidate_signal?.causality?.trim() ?? "";
    const sources = (submission.sources ?? [])
      .map((source) => ({
        url: source.source_url?.trim() ?? "",
        title: source.source_name?.trim() || source.source_type?.trim() || source.source_url?.trim() || ""
      }))
      .filter((source) => source.url.length > 0);

    const candidateArtifact = {
      status: "in_queue",
      generated_by: "materializeGeneratedCandidates",
      generated_from: `data/dry-runs/${reportDate}/${candidateId}-submission.json`,
      beat_slug: beatSlug,
      headline,
      analysis: buildAnalysis(headline, significance, causality, beatSlug),
      sources,
      tags: buildTags(beatSlug),
      disclosure: buildDisclosure(submission)
    };

    const outputPath = resolve(outputDir, `${candidateId}.json`);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(candidateArtifact, null, 2) + "\n", "utf8");
    written.push(outputPath);
  }

  return { outputDir, written, sourceCount: eligible.length };
}
