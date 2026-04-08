import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type FeedbackLabel =
  | "brief_included"
  | "approved_not_in_brief"
  | "headline_truncated"
  | "body_missing"
  | "duplicate_story_shape"
  | "missing_timestamped_evidence"
  | "beat_cap"
  | "publisher_feedback_required"
  | "repair_and_resubmit"
  | "too_early_unshipped_code"
  | "pending_outcome"
  | "rejected_editorial"
  | "q1_fail_implied_agent_angle"
  | "q3_fail_not_inscribable"
  | "q4_fail_no_operator_consequence"
  | "source_fail_internal_only"
  | "disclosure_fail_vague";

interface ApprovalOutcomeRecord {
  kind: "approval_outcome";
  recordedAt: string;
  signalId?: string | null;
  candidateId: string | null;
  approved: boolean;
  published?: boolean;
  success?: boolean;
  failureMode?: "not_in_brief" | "rejected" | "pending" | "unknown" | null;
  status?: "approved" | "rejected" | "submitted" | "unknown";
  note: string | null;
  learningWhy?: string | null;
  feedbackLabels?: FeedbackLabel[];
}

export interface OutcomeFeedbackMemory {
  generatedAt: string;
  sourceDir: string;
  outcomeCount: number;
  labelCounts: Record<FeedbackLabel, number>;
  repeatedLabels: Array<{
    label: FeedbackLabel;
    count: number;
    candidateIds: string[];
    signalIds: string[];
  }>;
}

const ALL_FEEDBACK_LABELS: FeedbackLabel[] = [
  "brief_included",
  "approved_not_in_brief",
  "headline_truncated",
  "body_missing",
  "duplicate_story_shape",
  "missing_timestamped_evidence",
  "beat_cap",
  "publisher_feedback_required",
  "repair_and_resubmit",
  "too_early_unshipped_code",
  "pending_outcome",
  "rejected_editorial",
  "q1_fail_implied_agent_angle",
  "q3_fail_not_inscribable",
  "q4_fail_no_operator_consequence",
  "source_fail_internal_only",
  "disclosure_fail_vague"
];

export function inferFeedbackLabels(input: {
  approved: boolean;
  published: boolean;
  failureMode: "not_in_brief" | "rejected" | "pending" | "unknown" | null;
  note: string | null;
  learningWhy: string | null;
}): FeedbackLabel[] {
  const labels = new Set<FeedbackLabel>();
  const text = `${input.note ?? ""} ${input.learningWhy ?? ""}`.toLowerCase();

  if (input.approved && input.published) {
    labels.add("brief_included");
  }
  if (input.failureMode === "not_in_brief") {
    labels.add("approved_not_in_brief");
  }
  if (input.failureMode === "rejected") {
    labels.add("rejected_editorial");
  }
  if (input.failureMode === "pending") {
    labels.add("pending_outcome");
  }
  if (/\bheadline\b|\btruncated\b|\bcuts off mid-thought\b|\bincomplete\b/.test(text)) {
    labels.add("headline_truncated");
  }
  if (/\bbody\b|\bheadline-only\b|\bnull\b|\bpayload\b/.test(text)) {
    labels.add("body_missing");
  }
  if (/\bduplicate\b|\bsame story shape\b|\balready in today'?s brief\b|\balready printed\b/.test(text)) {
    labels.add("duplicate_story_shape");
  }
  if (/\btimestamp\b|\bsnapshot\b|\bverifiable\b|\bevidence\b|\bproof\b|\bmetric\b|\bfabricated\b/.test(text)) {
    labels.add("missing_timestamped_evidence");
  }
  if (/\bbeat cap\b|\bdaily cap\b|\bdaily signal limit\b|\b4\/4\b|\bslot\b/.test(text)) {
    labels.add("beat_cap");
  }
  if (/\bpublisher feedback\b|\bflagged parts\b|\brejected by editorial review\b/.test(text)) {
    labels.add("publisher_feedback_required");
  }
  if (/\brepair\b|\bresubmit\b/.test(text)) {
    labels.add("repair_and_resubmit");
  }
  if (/\bdo not merge\b|\bunshipped\b|\btoo early\b|\bpremature\b/.test(text)) {
    labels.add("too_early_unshipped_code");
  }
  if (/\bq1\b|\bmission-aligned test\b|\bnot mission-aligned\b|\bimplied an ai-agent angle\b/.test(text)) {
    labels.add("q1_fail_implied_agent_angle");
  }
  if (/\bq3\b|\binscribable\b|\bstable-baseline\b|\bspeculative\b|\bpermanent record\b/.test(text)) {
    labels.add("q3_fail_not_inscribable");
  }
  if (/\bq4\b|\bvalue-creating test\b|\boperator consequence\b|\bcorrespondent action\b|\bnot strong enough for the desired bar\b/.test(text)) {
    labels.add("q4_fail_no_operator_consequence");
  }
  if (/\binternal or agent-oracle-only\b|\bindependent external verifier\b|\bcircular sourcing\b|\bone organization as evidence\b/.test(text)) {
    labels.add("source_fail_internal_only");
  }
  if (/\bvague disclosure\b|\bdisclosure is not concrete enough\b|\bdisclosure must name\b/.test(text)) {
    labels.add("disclosure_fail_vague");
  }

  return [...labels];
}

function createEmptyLabelCounts(): Record<FeedbackLabel, number> {
  return ALL_FEEDBACK_LABELS.reduce<Record<FeedbackLabel, number>>(
    (counts, label) => {
      counts[label] = 0;
      return counts;
    },
    {} as Record<FeedbackLabel, number>
  );
}

export function getOutcomeFeedbackMemoryPath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/outcome-feedback-memory.json");
}

export async function refreshOutcomeFeedbackMemory(baseDir?: string): Promise<OutcomeFeedbackMemory> {
  const root = resolve(baseDir ?? process.cwd());
  const approvalsDir = resolve(root, "data/outcomes/approvals");
  const labelCounts = createEmptyLabelCounts();
  let outcomeCount = 0;
  const repeated = new Map<
    FeedbackLabel,
    { count: number; candidateIds: Set<string>; signalIds: Set<string> }
  >();

  if (existsSync(approvalsDir)) {
    const files = (await readdir(approvalsDir)).filter((name) => name.endsWith(".json")).sort();
    for (const fileName of files) {
      const record = JSON.parse(
        await readFile(resolve(approvalsDir, fileName), "utf8")
      ) as ApprovalOutcomeRecord;
      outcomeCount += 1;
      const labels =
        record.feedbackLabels ??
        inferFeedbackLabels({
          approved: record.approved,
          published: record.published ?? false,
          failureMode: record.failureMode ?? null,
          note: record.note,
          learningWhy: record.learningWhy ?? null
        });

      for (const label of labels) {
        labelCounts[label] += 1;
        const current = repeated.get(label) ?? {
          count: 0,
          candidateIds: new Set<string>(),
          signalIds: new Set<string>()
        };
        current.count += 1;
        if (record.candidateId) current.candidateIds.add(record.candidateId);
        if (record.signalId) current.signalIds.add(record.signalId);
        repeated.set(label, current);
      }
    }
  }

  const memory: OutcomeFeedbackMemory = {
    generatedAt: new Date().toISOString(),
    sourceDir: approvalsDir,
    outcomeCount,
    labelCounts,
    repeatedLabels: [...repeated.entries()]
      .filter(([, value]) => value.count >= 2)
      .map(([label, value]) => ({
        label,
        count: value.count,
        candidateIds: [...value.candidateIds].sort(),
        signalIds: [...value.signalIds].sort()
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
  };

  const outputPath = getOutcomeFeedbackMemoryPath(root);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(memory, null, 2)}\n`, "utf8");
  return memory;
}
