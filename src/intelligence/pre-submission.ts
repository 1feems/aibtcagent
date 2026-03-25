import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { PreSubmissionChecks, PreSubmissionIntelligence } from "../types/index.js";

export interface PreSubmissionRawInput {
  dailyBriefChecked: boolean;
  activityFeedChecked: boolean;
  leaderboardChecked: boolean;
  reputationChecked: boolean;
  inboxChecked: boolean;
  agentStatusChecked: boolean;
  notes: string[];
  checkedAt: string;
}

export function buildPreSubmissionChecks(raw: PreSubmissionRawInput): PreSubmissionChecks {
  return {
    dailyBriefChecked: raw.dailyBriefChecked,
    activityFeedChecked: raw.activityFeedChecked,
    leaderboardChecked: raw.leaderboardChecked,
    reputationChecked: raw.reputationChecked,
    inboxChecked: raw.inboxChecked,
    agentStatusChecked: raw.agentStatusChecked
  };
}

export function buildPreSubmissionIntelligence(
  raw: PreSubmissionRawInput
): PreSubmissionIntelligence {
  return {
    checks: buildPreSubmissionChecks(raw),
    notes: raw.notes,
    checkedAt: raw.checkedAt
  };
}

export async function readPreSubmissionFixture(filePath: string): Promise<PreSubmissionRawInput> {
  const absolutePath = resolve(process.cwd(), filePath);
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw) as PreSubmissionRawInput;
}

export async function persistPreSubmissionIntelligence(
  filePath: string,
  intelligence: PreSubmissionIntelligence
): Promise<void> {
  const absolutePath = resolve(process.cwd(), filePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(intelligence, null, 2));
}
