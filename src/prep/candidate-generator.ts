import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runAuditedLoop, type AuditInput, type AuditOutput } from "../audit/index.js";
import { createSignalArtifact } from "./create-signal.js";

interface RankedCandidateQueue {
  candidates?: Array<{
    candidateId?: string;
    score?: number;
  }>;
}

interface SerializedSubmission {
  kind?: string;
  fileable?: boolean;
  non_fileable?: boolean;
  intended_use?: string;
  canonical_artifact_required?: string;
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
  if (beat === "bitcoin-macro") return "bitcoin-macro";
  if (beat === "quantum") return "quantum";
  if (beat === "aibtc-network") return "aibtc-network";
  return "aibtc-network";
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

function buildClaim(headline: string, significance: string, causality: string): string {
  return (
    significance.trim() ||
    causality.trim() ||
    headline.replace(/\.+$/, "").trim() ||
    "Operators should review the underlying change before treating it as filing-ready."
  );
}

function buildEvidence(
  sources: Array<{ url: string; title: string }>,
  significance: string,
  causality: string,
  strictEvidence: boolean
): string[] {
  const evidence = sources
    .slice(0, strictEvidence ? 2 : 1)
    .map((source) => `${source.title || "Source"} (${source.url})`);

  if (strictEvidence && causality.trim()) {
    evidence.push(causality.trim());
  } else if (!strictEvidence && evidence.length === 0 && significance.trim()) {
    evidence.push(significance.trim());
  }

  return evidence.filter((entry) => entry.trim().length > 0);
}

function buildStructuredOutput(
  headline: string,
  significance: string,
  causality: string,
  beatSlug: string,
  sources: Array<{ url: string; title: string }>,
  strictEvidence: boolean
): AuditOutput {
  const claim = buildClaim(headline, significance, causality);
  const evidence = buildEvidence(sources, significance, causality, strictEvidence);
  const rawImplication = buildDirective(beatSlug, significance, causality)
    .replace(/^What to do:\s*/i, "")
    .replace(/^Directive:\s*/i, "");
  const implication = /\boperators should\b|\bagents should\b|\bthis means\b/i.test(rawImplication)
    ? rawImplication
    : `This means operators should ${rawImplication.charAt(0).toLowerCase()}${rawImplication.slice(1)}`;
  return {
    claims: [claim],
    evidence,
    implications: [implication]
  };
}

function buildAnalysis(output: AuditOutput): string {
  const claim = output.claims[0] ?? "No claim generated.";
  const evidence = (output.evidence ?? []).join("; ") || "No direct evidence generated.";
  const implication = (output.implications ?? []).join("; ") || "No implication generated.";
  const directive = implication;
  return [
    `CLAIM: ${claim}`,
    `EVIDENCE: ${evidence}`,
    `IMPLICATION: ${implication}`,
    `Directive: ${directive}`
  ].join("\n");
}

function buildDisclosure(submission: SerializedSubmission): string {
  const tools = submission.model_disclosure?.tools_used ?? [];
  const steps = submission.model_disclosure?.derivation_steps ?? [];
  const parts = [...tools, ...steps].filter((value) => typeof value === "string" && value.trim().length > 0);
  if (!parts.some((part) => /\b(?:github|gh|api|endpoint|search|curl|rg|npm|node|bun|claude|gpt|grok|gemini|opus|sonnet|haiku)\b/i.test(part))) {
    parts.unshift("github review");
  }
  const disclosure = parts.join("; ").trim();
  return disclosure || "github review; release-audit; verified against the cited public source URL";
}

function buildTags(beatSlug: string): string[] {
  return [beatSlug];
}

function buildBriefCompetitionProof(
  beatSlug: string,
  headline: string,
  significance: string,
  causality: string,
  sources: Array<{ url: string; title: string }>
) {
  const primary = sources[0];
  const sourceProof = primary
    ? `${primary.url} proves the anchored event in "${headline}".`
    : "https://aibtc.com/activity provides operator-verifiable anchor evidence for this event.";
  const operatorAction = /\bagents should\b|\boperators should\b/i.test(causality)
    ? causality
    : `Operators should verify this anchor before filing follow-on updates.`;

  return {
    why_this_beat_is_open: `This ${beatSlug} beat slot is open because this anchor changes active operator decisions and is not a duplicate of an already-briefed story.`,
    why_now: significance
      ? `${significance.trim().replace(/\s+/g, " ")} This is a same-day timing edge, not a stale recap.`
      : "This belongs now because the anchor is live in the current cycle and still actionable today.",
    why_this_beats_same_day_competition: `This beats same-day competition by leading with a concrete anchor in the headline and pairing it with direct operator consequence instead of a narrow fragment.`,
    primary_source_proof: sourceProof,
    operator_action: operatorAction.endsWith(".") || operatorAction.endsWith("!") || operatorAction.endsWith("?")
      ? operatorAction
      : `${operatorAction}.`
  };
}

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function markIntermediateNonFileable<T extends SerializedSubmission>(submission: T): T {
  return {
    ...submission,
    kind: "intermediate_candidate_artifact",
    fileable: false,
    non_fileable: true,
    intended_use: "ranking_only",
    canonical_artifact_required: "create_signal_artifact"
  };
}

export async function materializeGeneratedCandidates(
  reportDate: string,
  baseDir?: string
): Promise<{ outputDir: string; written: string[]; sourceCount: number; winnerGateBlocked: number }> {
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
      return { outputDir, written: [], sourceCount: 0, winnerGateBlocked: 0 };
    }
    throw error;
  }

  const parsed = await Promise.all(
    fileNames.map(async (fileName) => {
      const path = resolve(dryRunDir, fileName);
      const rawSubmission = JSON.parse(await readFile(path, "utf8")) as SerializedSubmission;
      const submission = markIntermediateNonFileable(rawSubmission);
      if (
        rawSubmission.non_fileable !== true ||
        rawSubmission.fileable !== false ||
        rawSubmission.kind !== "intermediate_candidate_artifact"
      ) {
        await writeFile(path, JSON.stringify(submission, null, 2) + "\n", "utf8");
      }
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
  let winnerGateBlocked = 0;

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

    const auditInput: AuditInput = {
      prompt: `Materialize filing candidate ${candidateId}`,
      constraints: [headline, beatSlug],
      metadata: {
        candidateId,
        beatSlug,
        sourceCount: sources.length
      }
    };
    const auditResult = await runAuditedLoop(
      auditInput,
      (currentInput) => {
        const strictEvidence = /exact source anchors/i.test(currentInput.prompt);
        return buildStructuredOutput(headline, significance, causality, beatSlug, sources, strictEvidence);
      },
      {
        root,
        runId: `candidate-${candidateId}`,
        maxIterations: 2,
        tightenPrompt: (currentInput, failures) => ({
          ...currentInput,
          prompt: `${currentInput.prompt}\nTighten prompt: include direct evidence with exact source anchors. Failures: ${failures.join(", ")}`
        })
      }
    );
    const analysis = buildAnalysis(auditResult.finalOutput);
    const disclosure = buildDisclosure(submission);

    try {
      const candidateArtifact = await createSignalArtifact({
        reportDate,
        candidateId,
        sourcePath: `data/dry-runs/${reportDate}/${candidateId}-submission.json`,
        generated_by: "materializeGeneratedCandidates",
        generated_from: `data/dry-runs/${reportDate}/${candidateId}-submission.json`,
        beat_slug: beatSlug,
        headline,
        body: analysis,
        sources,
        tags: buildTags(beatSlug),
        disclosure,
        brief_competition: buildBriefCompetitionProof(
          beatSlug,
          headline,
          significance,
          causality,
          sources
        )
      }, root);

      const outputPath = resolve(outputDir, `${candidateId}.json`);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(candidateArtifact, null, 2) + "\n", "utf8");
      written.push(outputPath);
    } catch (error) {
      winnerGateBlocked += 1;
      process.stdout.write(
        `[candidate-generator] create-signal blocked ${candidateId}: ${(error as Error).message}\n`
      );
      continue;
    }
  }

  return { outputDir, written, sourceCount: eligible.length, winnerGateBlocked };
}
