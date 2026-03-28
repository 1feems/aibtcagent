import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

interface ApprovalOutcomeRecord {
  candidateId: string;
  approved: boolean;
  published?: boolean;
  note: string | null;
}

interface AcceptedSubmissionRecord {
  candidateId: string;
  submission: {
    candidateSignal: {
      beat: string;
    };
    headline: string;
  };
}

interface AutoLabelState {
  labeledCandidateIds: string[];
}

interface TrainingEntry {
  label: "in_brief" | "approved_not_in_brief" | "rejected";
  beat: string;
  headline: string;
  source_context: {
    kind: "auto_labeled_live_outcome";
    scope: "aibtc_internal";
    proof_type: "live_outcome";
  };
  strengths: string[];
  weaknesses: string[];
  reason_tags: string[];
  fact_checker: {
    exact_claim_supported: true;
    source_match: true;
    number_verifiable: true;
    causality_supported: true;
    operator_implication_supported: true;
  };
  brief_competition: {
    same_day_competition_known: false;
    broadest_story_on_beat: boolean;
    lost_to_broader_same_beat_story: boolean;
  };
  scores: {
    specificity: number;
    breadth: number;
    operator_consequence: number;
    publication_readiness: number;
  };
  training_note: string;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readState(filePath: string): Promise<AutoLabelState> {
  try {
    return await readJson<AutoLabelState>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { labeledCandidateIds: [] };
    }

    throw error;
  }
}

async function appendJsonl(filePath: string, entry: TrainingEntry): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  let existing = "";

  try {
    existing = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await writeFile(filePath, `${existing}${prefix}${JSON.stringify(entry)}\n`, "utf8");
}

function buildEntry(
  outcome: ApprovalOutcomeRecord,
  submission: AcceptedSubmissionRecord
): { targetFile: string; entry: TrainingEntry } {
  const beat = submission.submission.candidateSignal.beat;
  const headline = submission.submission.headline;

  if (outcome.approved && outcome.published) {
    return {
      targetFile: "data/training/in-brief.jsonl",
      entry: {
        label: "in_brief",
        beat,
        headline,
        source_context: {
          kind: "auto_labeled_live_outcome",
          scope: "aibtc_internal",
          proof_type: "live_outcome"
        },
        strengths: ["Auto-labeled from a published live outcome."],
        weaknesses: [],
        reason_tags: ["published_live_outcome", "auto_labeled"],
        fact_checker: {
          exact_claim_supported: true,
          source_match: true,
          number_verifiable: true,
          causality_supported: true,
          operator_implication_supported: true
        },
        brief_competition: {
          same_day_competition_known: false,
          broadest_story_on_beat: true,
          lost_to_broader_same_beat_story: false
        },
        scores: {
          specificity: 4,
          breadth: 4,
          operator_consequence: 4,
          publication_readiness: 5
        },
        training_note: "Auto-labeled from live outcome because the signal was approved and published in the brief."
      }
    };
  }

  if (outcome.approved) {
    return {
      targetFile: "data/training/approved-not-in-brief.jsonl",
      entry: {
        label: "approved_not_in_brief",
        beat,
        headline,
        source_context: {
          kind: "auto_labeled_live_outcome",
          scope: "aibtc_internal",
          proof_type: "live_outcome"
        },
        strengths: ["Auto-labeled from an approved live outcome."],
        weaknesses: ["Did not convert into a published brief win."],
        reason_tags: ["approved_live_outcome", "passed_editorial_not_slot_quality", "auto_labeled"],
        fact_checker: {
          exact_claim_supported: true,
          source_match: true,
          number_verifiable: true,
          causality_supported: true,
          operator_implication_supported: true
        },
        brief_competition: {
          same_day_competition_known: false,
          broadest_story_on_beat: false,
          lost_to_broader_same_beat_story: false
        },
        scores: {
          specificity: 4,
          breadth: 3,
          operator_consequence: 4,
          publication_readiness: 4
        },
        training_note: "Auto-labeled from live outcome because the signal was approved but not published."
      }
    };
  }

  return {
    targetFile: "data/training/rejected.jsonl",
    entry: {
      label: "rejected",
      beat,
      headline,
      source_context: {
        kind: "auto_labeled_live_outcome",
        scope: "aibtc_internal",
        proof_type: "live_outcome"
      },
      strengths: [],
      weaknesses: ["Rejected by live editorial outcome."],
      reason_tags: ["rejected_live_outcome", "auto_labeled"],
      fact_checker: {
        exact_claim_supported: true,
        source_match: true,
        number_verifiable: true,
        causality_supported: true,
        operator_implication_supported: true
      },
      brief_competition: {
        same_day_competition_known: false,
        broadest_story_on_beat: false,
        lost_to_broader_same_beat_story: false
      },
      scores: {
        specificity: 3,
        breadth: 3,
        operator_consequence: 3,
        publication_readiness: 2
      },
      training_note: "Auto-labeled from live outcome because the signal was rejected."
    }
  };
}

export async function autoLabelResolvedOutcomes(baseDir?: string): Promise<{
  labeledCount: number;
  statePath: string;
}> {
  const root = resolve(baseDir ?? process.cwd());
  const approvalsDir = resolve(root, "data/outcomes/approvals");
  const acceptedDir = resolve(root, "data/logs/accepted");
  const statePath = resolve(root, "data/state/auto-labeled-outcomes.json");
  const state = await readState(statePath);
  const labeled = new Set(state.labeledCandidateIds);

  let approvalFiles: string[] = [];
  try {
    approvalFiles = await readdir(approvalsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { labeledCount: 0, statePath };
    }
    throw error;
  }

  let labeledCount = 0;

  for (const fileName of approvalFiles) {
    if (!fileName.endsWith(".json")) {
      continue;
    }

    const outcome = await readJson<ApprovalOutcomeRecord>(resolve(approvalsDir, fileName));
    if (!outcome.candidateId || labeled.has(outcome.candidateId)) {
      continue;
    }

    try {
      const submission = await readJson<AcceptedSubmissionRecord>(
        resolve(acceptedDir, `${outcome.candidateId}.json`)
      );
      const { targetFile, entry } = buildEntry(outcome, submission);
      await appendJsonl(resolve(root, targetFile), entry);
      labeled.add(outcome.candidateId);
      labeledCount += 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(
    statePath,
    JSON.stringify({ labeledCandidateIds: [...labeled].sort() }, null, 2),
    "utf8"
  );

  return { labeledCount, statePath };
}
