import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type RepairRequirement =
  | "move_to_open_beat"
  | "add_timestamped_evidence"
  | "rewrite_or_remove_flagged_metrics";

export interface RepairContract {
  signalId: string;
  candidateId: string | null;
  recordedAt: string;
  originalBeat: string | null;
  feedbackMessage: string;
  flaggedMetrics: string[];
  requirements: RepairRequirement[];
  status: "open" | "verified";
}

export interface RepairMemoryState {
  contracts: RepairContract[];
}

export interface RepairVerificationResult {
  passed: boolean;
  reasons: string[];
}

function resolveRepairMemoryPath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/repairable-candidates.json");
}

function extractPercentMetrics(text: string): string[] {
  return [...new Set([...text.matchAll(/\b\d+(?:\.\d+)?%/g)].map((match) => match[0]))];
}

function inferRequirements(feedbackMessage: string): RepairRequirement[] {
  const text = feedbackMessage.toLowerCase();
  const requirements = new Set<RepairRequirement>();

  if (/\bopen slots?\b|\bbeat is at cap\b|\bbeat .*cap\b|\b4\/4\b|\bresubmit to a beat with open slots\b/.test(text)) {
    requirements.add("move_to_open_beat");
  }
  if (/\btimestamp\b|\btimestamps\b|\bsnapshot\b|\bsnapshots\b|\bverifiable data\b|\bverifiable .*timestamp/i.test(text)) {
    requirements.add("add_timestamped_evidence");
  }
  if (/\bfigures?\b|\bmetrics?\b|\b%\b/.test(text)) {
    requirements.add("rewrite_or_remove_flagged_metrics");
  }

  return [...requirements];
}

function hasTimestampedEvidence(analysis: string, sourceTitlesAndUrls: string[]): boolean {
  const text = `${analysis} ${sourceTitlesAndUrls.join(" ")}`;
  return (
    /\b\d{4}-\d{2}-\d{2}\b/.test(text) ||
    /\b\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/i.test(text) ||
    /\bas of\b|\bsnapshot\b|\btimestamp\b|\bdated\b/.test(text.toLowerCase())
  );
}

export async function readRepairMemory(baseDir?: string): Promise<RepairMemoryState> {
  const filePath = resolveRepairMemoryPath(baseDir);
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as RepairMemoryState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { contracts: [] };
    }
    throw error;
  }
}

export async function saveRepairMemory(state: RepairMemoryState, baseDir?: string): Promise<string> {
  const filePath = resolveRepairMemoryPath(baseDir);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return filePath;
}

export async function registerRepairFeedback(input: {
  signalId: string;
  candidateId?: string | null;
  originalBeat?: string | null;
  feedbackMessage: string;
  recordedAt?: string;
}, baseDir?: string): Promise<{ path: string; contract: RepairContract }> {
  const state = await readRepairMemory(baseDir);
  const contract: RepairContract = {
    signalId: input.signalId,
    candidateId: input.candidateId ?? null,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    originalBeat: input.originalBeat ?? null,
    feedbackMessage: input.feedbackMessage,
    flaggedMetrics: extractPercentMetrics(input.feedbackMessage),
    requirements: inferRequirements(input.feedbackMessage),
    status: "open"
  };

  const existingIndex = state.contracts.findIndex((entry) => entry.signalId === input.signalId);
  if (existingIndex >= 0) {
    state.contracts[existingIndex] = contract;
  } else {
    state.contracts.push(contract);
  }

  const path = await saveRepairMemory(state, baseDir);
  return { path, contract };
}

export function verifyRepairContract(
  contract: RepairContract,
  submission: {
    beat: string | null;
    analysis: string;
    sourceTitlesAndUrls: string[];
  }
): RepairVerificationResult {
  const reasons: string[] = [];

  if (contract.requirements.includes("move_to_open_beat") && contract.originalBeat && submission.beat === contract.originalBeat) {
    reasons.push(`repair contract requires a beat change away from '${contract.originalBeat}'`);
  }

  if (
    contract.requirements.includes("add_timestamped_evidence") &&
    !hasTimestampedEvidence(submission.analysis, submission.sourceTitlesAndUrls)
  ) {
    reasons.push("repair contract requires timestamped evidence or snapshot wording in the revised analysis/sources");
  }

  if (contract.requirements.includes("rewrite_or_remove_flagged_metrics") && contract.flaggedMetrics.length > 0) {
    const stillUsesFlaggedMetrics = contract.flaggedMetrics.filter((metric) => submission.analysis.includes(metric));
    if (stillUsesFlaggedMetrics.length > 0 && !hasTimestampedEvidence(submission.analysis, submission.sourceTitlesAndUrls)) {
      reasons.push(
        `repair contract flagged metrics still appear without dated evidence: ${stillUsesFlaggedMetrics.join(", ")}`
      );
    }
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
}
