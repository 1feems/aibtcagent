import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readBriefWinnerSnapshot } from "../brief/index.js";

interface ApprovalOutcomeRecord {
  recordedAt?: string;
  candidateId: string;
  signalId?: string | null;
  approved: boolean;
  published?: boolean;
  note: string | null;
}

interface AcceptedSubmissionRecord {
  candidateId: string;
  recordedAt?: string;
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
    same_day_competition_known: boolean;
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

function inferHeadlineSpecificity(headline: string): number {
  if (/\d/.test(headline) && headline.length >= 70) {
    return 5;
  }
  if (headline.length >= 45) {
    return 4;
  }
  return 3;
}

function inferOperatorConsequence(headline: string, note: string | null): number {
  const combined = `${headline} ${note ?? ""}`.toLowerCase();
  if (/\bqueue|nonce|window|upgrade|security|degraded|fails?|payment\b/.test(combined)) {
    return 5;
  }
  if (/\blaunch|release|deploy|ship|publish\b/.test(combined)) {
    return 4;
  }
  return 3;
}

function inferStrengths(outcome: ApprovalOutcomeRecord, submission: AcceptedSubmissionRecord): string[] {
  const strengths: string[] = [];
  if (outcome.published) {
    strengths.push("Converted all the way into a published brief win.");
  } else if (outcome.approved) {
    strengths.push("Strong enough to pass approval review.");
  }

  if (/\d/.test(submission.submission.headline)) {
    strengths.push("Headline carries concrete numbers or version anchors.");
  }

  if (/\bqueue|nonce|window|security|upgrade|payment|degraded\b/i.test(submission.submission.headline)) {
    strengths.push("Headline names an operator-relevant mechanism or consequence.");
  }

  return strengths.length > 0 ? strengths : ["Auto-labeled from a resolved live outcome."];
}

function inferWeaknesses(
  outcome: ApprovalOutcomeRecord,
  submission: AcceptedSubmissionRecord,
  lostToBroaderSameBeatStory: boolean
): string[] {
  const weaknesses: string[] = [];

  if (!outcome.approved) {
    weaknesses.push("Rejected by live editorial outcome.");
  }
  if (outcome.approved && !outcome.published) {
    weaknesses.push("Did not convert into a published brief win.");
  }
  if (lostToBroaderSameBeatStory) {
    weaknesses.push("Another same-day winner occupied the beat slot.");
  }
  if (hasRawReleaseShape(submission.submission.headline)) {
    weaknesses.push("Headline still reads too much like a raw release note.");
  }

  return weaknesses;
}

function hasRawReleaseShape(headline: string): boolean {
  return /\bbug fixes?\b|#\d+|\bv\d+\.\d+\.\d+\b/i.test(headline);
}

function inferReasonTags(
  outcome: ApprovalOutcomeRecord,
  submission: AcceptedSubmissionRecord,
  lostToBroaderSameBeatStory: boolean
): string[] {
  const tags = new Set<string>(["auto_labeled"]);

  tags.add(outcome.approved ? "approved_live_outcome" : "rejected_live_outcome");
  if (outcome.published) {
    tags.add("published_live_outcome");
    tags.add("brief_slot_winner");
  } else if (outcome.approved) {
    tags.add("passed_editorial_not_slot_quality");
  }
  if (lostToBroaderSameBeatStory) {
    tags.add("lost_to_broader_same_beat_story");
  }
  if (/\d/.test(submission.submission.headline)) {
    tags.add("exact_number_or_version_anchor");
  }
  if (/\bqueue|nonce|window|security|upgrade|payment|degraded\b/i.test(submission.submission.headline)) {
    tags.add("operator_implication_present");
  }
  if (hasRawReleaseShape(submission.submission.headline)) {
    tags.add("release_note_shape");
  }

  return [...tags];
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
  submission: AcceptedSubmissionRecord,
  briefSnapshot: Awaited<ReturnType<typeof readBriefWinnerSnapshot>>
): { targetFile: string; entry: TrainingEntry } {
  const beat = submission.submission.candidateSignal.beat;
  const headline = submission.submission.headline;
  const sameDayCompetitionKnown = briefSnapshot !== null;
  const lostToBroaderSameBeatStory =
    sameDayCompetitionKnown &&
    !outcome.published &&
    briefSnapshot.occupiedBeats.includes(beat);
  const specificity = inferHeadlineSpecificity(headline);
  const operatorConsequence = inferOperatorConsequence(headline, outcome.note);
  const strengths = inferStrengths(outcome, submission);
  const weaknesses = inferWeaknesses(outcome, submission, lostToBroaderSameBeatStory);
  const reasonTags = inferReasonTags(outcome, submission, lostToBroaderSameBeatStory);

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
        strengths,
        weaknesses,
        reason_tags: reasonTags,
        fact_checker: {
          exact_claim_supported: true,
          source_match: true,
          number_verifiable: true,
          causality_supported: true,
          operator_implication_supported: true
        },
        brief_competition: {
          same_day_competition_known: sameDayCompetitionKnown,
          broadest_story_on_beat: true,
          lost_to_broader_same_beat_story: false
        },
        scores: {
          specificity,
          breadth: 4,
          operator_consequence: operatorConsequence,
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
        strengths,
        weaknesses,
        reason_tags: reasonTags,
        fact_checker: {
          exact_claim_supported: true,
          source_match: true,
          number_verifiable: true,
          causality_supported: true,
          operator_implication_supported: true
        },
        brief_competition: {
          same_day_competition_known: sameDayCompetitionKnown,
          broadest_story_on_beat: !lostToBroaderSameBeatStory,
          lost_to_broader_same_beat_story: lostToBroaderSameBeatStory
        },
        scores: {
          specificity,
          breadth: lostToBroaderSameBeatStory ? 3 : 4,
          operator_consequence: operatorConsequence,
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
      strengths,
      weaknesses,
      reason_tags: reasonTags,
      fact_checker: {
        exact_claim_supported: true,
        source_match: true,
        number_verifiable: true,
        causality_supported: true,
        operator_implication_supported: true
      },
      brief_competition: {
        same_day_competition_known: sameDayCompetitionKnown,
        broadest_story_on_beat: false,
        lost_to_broader_same_beat_story: lostToBroaderSameBeatStory
      },
      scores: {
        specificity: Math.max(2, specificity - 1),
        breadth: 3,
        operator_consequence: Math.max(2, operatorConsequence - 1),
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
      const outcomeDate = outcome.recordedAt?.slice(0, 10) ?? submission.recordedAt?.slice(0, 10) ?? null;
      const briefSnapshot =
        outcomeDate === null ? null : await readBriefWinnerSnapshot(outcomeDate, root);
      const { targetFile, entry } = buildEntry(outcome, submission, briefSnapshot);
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
