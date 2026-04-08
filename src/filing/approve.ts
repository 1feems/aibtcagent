import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recordCandidateApprovalDecision, upsertCandidateHistoryFromReadyArtifact } from "./candidate-history.js";
import { appendFilingReadyArtifact } from "./filing-ready-append.js";
import { filingGateIssuesToBlockers, validateFilingGate } from "./filing-gate-validator.js";
import { transitionLifecycleToApproval } from "./lifecycle.js";
import { evaluateSignalGuard } from "./signal-guard.js";
import { evaluateCandidateSignability, readOperatorSignabilityState } from "./signability.js";
import { buildHelperReadySignalPackage, parseCanonicalSignalPayload } from "./signal-contract.js";
import { readFilingQueue, saveFilingQueue, type FilingQueueSnapshot } from "./queue.js";
import { getPacificReportDate } from "../utils/report-date.js";

interface ApproveConfig {
  reportDate: string;
  candidateId: string;
  decision: "approve" | "reject";
  reviewedBy: string;
  approvalNote: string;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function resolveSourcePath(root: string, sourcePath: string): string {
  return sourcePath.startsWith("/") ? sourcePath : resolve(root, sourcePath);
}

function parseArgs(argv: string[]): ApproveConfig {
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
  const reportDate = parsed.get("date") ?? getPacificReportDate(now);
  const candidateId = parsed.get("candidate");
  const decision = parsed.get("decision");

  if (!candidateId) {
    throw new Error("Missing required --candidate <candidate-id>");
  }

  if (decision !== "approve" && decision !== "reject") {
    throw new Error("Missing required --decision approve|reject");
  }

  const approvalNote = parsed.get("approval-note")?.trim() ?? "";
  if (approvalNote.length === 0) {
    throw new Error("Missing required --approval-note <short rationale>");
  }

  return {
    reportDate,
    candidateId,
    decision,
    reviewedBy: parsed.get("reviewed-by") ?? "human",
    approvalNote
  };
}


export async function applyHumanDecision(
  config: ApproveConfig,
  baseDir?: string
): Promise<{ queuePath: string; readyArtifactPath: string | null }> {
  if (config.approvalNote.trim().length === 0) {
    throw new Error("Approval decision requires a non-empty approvalNote");
  }

  const queue = await readFilingQueue(config.reportDate, baseDir);
  const item = queue.items.find((entry) => entry.candidateId === config.candidateId);

  if (!item) {
    throw new Error(`Candidate ${config.candidateId} not found in filing queue for ${config.reportDate}`);
  }

  if (config.decision === "approve" && item.queueStatus !== "awaiting_human_approval") {
    throw new Error(
      `Candidate ${config.candidateId} is not signable in the filing queue (current status: ${item.queueStatus})`
    );
  }

  let readyArtifactPath: string | null = null;
  const reviewedAt = new Date().toISOString();

  if (config.decision === "approve") {
    const preflight = await readOperatorSignabilityState(baseDir);
    const signability = evaluateCandidateSignability(item.beat, preflight);
    if (signability.status !== "ready") {
      throw new Error(
        `Candidate ${config.candidateId} failed operator signability gates: ${signability.reasons.join("; ")}`
      );
    }

    const root = baseDir ?? process.cwd();
    const rawSubmission = await readJsonFile<unknown>(resolveSourcePath(root, item.sourcePath)).catch(() => null);

    // Gate check — must pass before canonical parsing or guard evaluation.
    // A signal without explicit Q1–Q4 gate evidence is a draft, never ready.
    const gateValidation = validateFilingGate(rawSubmission);
    if (gateValidation.issues.length > 0) {
      const blockers = filingGateIssuesToBlockers(gateValidation.issues);
      throw new Error(
        `Candidate ${config.candidateId} failed filing gate validation and cannot be approved: ${blockers.join("; ")}`
      );
    }

    const { payload, issues } = parseCanonicalSignalPayload(rawSubmission);
    if (!payload?.headline || !payload.analysis || issues.length > 0) {
      throw new Error(
        `Candidate ${config.candidateId} failed canonical payload validation and cannot pass the final signal guard: ${issues.map((issue) => issue.reason).join("; ")}`
      );
    }

    // Cross-check gate headline against canonical headline.
    if (payload.headline && gateValidation.gate && gateValidation.gate.headline !== payload.headline) {
      throw new Error(
        `Candidate ${config.candidateId} has a filing_gate headline mismatch: gate records "${gateValidation.gate.headline}" but canonical payload has "${payload.headline}" — the gate was run against a different signal`
      );
    }

    const guard = await evaluateSignalGuard({
      reportDate: config.reportDate,
      headline: payload.headline,
      beat_slug: payload.beat_slug || item.beat,
      body: payload.analysis,
      sources: payload.sources.map((source) => ({ url: source.url, title: source.title })),
      enforceWinnerBar: true,
      model_disclosure: {
        tools_used: [],
        derivation_steps: payload.disclosure ? [payload.disclosure] : []
      }
    }, baseDir);
    if (!guard.ok) {
      throw new Error(
        `Candidate ${config.candidateId} failed final signal guard: ${guard.blockers.join("; ")}`
      );
    }

    item.queueStatus = "approved_for_filing";
    item.lifecycle = transitionLifecycleToApproval("approve");
    readyArtifactPath = await appendFilingReadyArtifact(
      {
        reportDate: config.reportDate,
        candidateId: item.candidateId,
        reviewedBy: config.reviewedBy,
        reviewedAt,
        lifecycle: item.lifecycle,
        approvalReasons: item.reasons,
        operatorRationale: config.approvalNote,
        sourcePath: item.sourcePath,
        rawSubmission,
        canonicalSignal: payload,
        sendPackage: buildHelperReadySignalPackage(payload)
      },
      baseDir
    );
    await recordCandidateApprovalDecision(
      item.candidateId,
      {
        decision: "approve",
        reviewedBy: config.reviewedBy,
        reviewedAt,
        lifecycleState: item.lifecycle.state,
        reasons: item.reasons,
        operatorRationale: config.approvalNote,
        readyArtifactPath
      },
      baseDir
    );
    await upsertCandidateHistoryFromReadyArtifact(readyArtifactPath, baseDir);
  } else {
    item.queueStatus = "rejected";
    item.lifecycle = transitionLifecycleToApproval("reject");
    await recordCandidateApprovalDecision(
      item.candidateId,
      {
        decision: "reject",
        reviewedBy: config.reviewedBy,
        reviewedAt,
        lifecycleState: item.lifecycle.state,
        reasons: item.reasons,
        operatorRationale: config.approvalNote,
        readyArtifactPath: null
      },
      baseDir
    );
  }

  const updatedQueue: FilingQueueSnapshot = {
    ...queue,
    generatedAt: new Date().toISOString(),
    topCandidateId:
      config.decision === "approve"
        ? item.candidateId
        : queue.items.find((entry) => entry.queueStatus === "awaiting_human_approval" && entry.candidateId !== item.candidateId)?.candidateId ?? null
  };

  const queuePath = await saveFilingQueue(updatedQueue, baseDir);
  return { queuePath, readyArtifactPath };
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const result = await applyHumanDecision(config);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
