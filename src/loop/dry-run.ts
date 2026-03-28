import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildPreSubmissionIntelligence } from "../intelligence/index.js";
import {
  buildSubmissionPayload,
  serializeSubmissionPayload
} from "../newsroom/index.js";
import { generateAndSaveDailyOptimizationSnapshot } from "./index.js";
import { generateAndSaveDailyReport } from "../reporting/index.js";
import {
  runGeneralNewsLane,
  runProtocolUpdateLane,
  type GeneralNewsRawEvent,
  type ProtocolUpdateRawEvent
} from "../signals/index.js";
import {
  logAcceptedSubmission,
  logDetectedCandidate,
  logRejectedCandidate
} from "../storage/index.js";
import { validateSubject } from "../validation/index.js";

interface DryRunConfig {
  rawPath: string;
  preSubmissionPath: string;
  generatedAt: string;
  reportDate: string;
  outputDir: string;
}

interface DryRunSummary {
  kind: "dry_run_summary";
  generatedAt: string;
  reportDate: string;
  rawPath: string;
  preSubmissionPath: string;
  candidateId: string;
  submissionStatus: "submit" | "reject";
  serializedSubmissionPath: string;
  reportMarkdownPath: string;
  reportJsonPath: string;
  optimizationPath: string;
}

function parseArgs(argv: string[]): DryRunConfig {
  const defaults = {
    rawPath: "data/fixtures/protocol-update-raw.json",
    preSubmissionPath: "data/fixtures/pre-submission-intelligence.json",
    generatedAt: new Date().toISOString()
  };
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      continue;
    }

    parsed.set(token.slice(2), next);
    index += 1;
  }

  const generatedAt = parsed.get("generated-at") ?? defaults.generatedAt;
  const reportDate = parsed.get("report-date") ?? generatedAt.slice(0, 10);

  return {
    rawPath: parsed.get("raw") ?? defaults.rawPath,
    preSubmissionPath: parsed.get("pre") ?? defaults.preSubmissionPath,
    generatedAt,
    reportDate,
    outputDir: parsed.get("output-dir") ?? `data/dry-runs/${reportDate}`
  };
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const absolutePath = resolve(process.cwd(), filePath);
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJsonFile(filePath: string, data: unknown): Promise<string> {
  const absolutePath = resolve(process.cwd(), filePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(data, null, 2), "utf8");
  return absolutePath;
}

function isGeneralNewsRawEvent(
  value: ProtocolUpdateRawEvent | GeneralNewsRawEvent
): value is GeneralNewsRawEvent {
  return "sourcePublication" in value && "articleUrl" in value;
}

export async function runDryRun(config: DryRunConfig): Promise<DryRunSummary> {
  const rawEvent = await readJsonFile<ProtocolUpdateRawEvent | GeneralNewsRawEvent>(config.rawPath);
  const preSubmissionRaw = await readJsonFile<Parameters<typeof buildPreSubmissionIntelligence>[0]>(
    config.preSubmissionPath
  );
  const subject = isGeneralNewsRawEvent(rawEvent)
    ? runGeneralNewsLane(rawEvent).subject
    : runProtocolUpdateLane(rawEvent).subject;
  const validation = validateSubject(subject);
  const intelligence = buildPreSubmissionIntelligence({
    ...preSubmissionRaw,
    checkedAt: config.generatedAt
  });
  const payload = buildSubmissionPayload(subject, validation, intelligence, config.generatedAt);

  await logDetectedCandidate(subject.candidate, config.generatedAt);

  if (payload.submissionDecision.status === "submit") {
    await logAcceptedSubmission(subject.candidate.candidateId, payload, config.generatedAt);
  } else {
    await logRejectedCandidate(
      subject.candidate.candidateId,
      payload.submissionDecision.rejectionReasons,
      config.generatedAt
    );
  }

  const serializedSubmissionPath = await writeJsonFile(
    `${config.outputDir}/${subject.candidate.candidateId}-submission.json`,
    serializeSubmissionPayload(payload)
  );
  const { savedTo: reportMarkdownPath, savedJsonTo: reportJsonPath } =
    await generateAndSaveDailyReport(config.reportDate, config.generatedAt);
  const { savedTo: optimizationPath } = await generateAndSaveDailyOptimizationSnapshot(
    config.reportDate,
    config.generatedAt
  );

  const summary: DryRunSummary = {
    kind: "dry_run_summary",
    generatedAt: config.generatedAt,
    reportDate: config.reportDate,
    rawPath: resolve(process.cwd(), config.rawPath),
    preSubmissionPath: resolve(process.cwd(), config.preSubmissionPath),
    candidateId: subject.candidate.candidateId,
    submissionStatus: payload.submissionDecision.status,
    serializedSubmissionPath,
    reportMarkdownPath,
    reportJsonPath,
    optimizationPath
  };

  await writeJsonFile(`${config.outputDir}/dry-run-summary.json`, summary);
  return summary;
}

async function main(): Promise<void> {
  const summary = await runDryRun(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
