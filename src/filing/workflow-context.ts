import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ReviewedInput {
  path: string;
  available: boolean;
  detail: string;
  reviewMode: "loaded_only" | "compliance_verified";
}

interface SignalLoopAnalysisReport {
  reportDate: string;
  generatedAt: string;
  reviewedInputs: {
    signalHistory: ReviewedInput;
    editorialMemory: ReviewedInput;
    outcomeFeedbackMemory: ReviewedInput;
    helperErrors: ReviewedInput;
    latestBrief: ReviewedInput;
    distilledLearningBrief: ReviewedInput;
    beatEditorGuidance: ReviewedInput[];
  };
}

export interface HelperWorkflowContext {
  reportDate: string;
  analysisPath: string;
  analysisGeneratedAt: string;
  reviewedInputs: {
    signalHistoryPath: string;
    editorialMemoryPath: string;
    outcomeFeedbackPath: string;
    helperErrorsPath: string;
    latestBriefPath: string;
    distilledLearningBriefPath: string;
    beatEditorGuidancePaths: string[];
  };
}

export interface WorkflowContextIssue {
  code: string;
  reason: string;
}

export interface WorkflowContextValidationResult {
  ok: boolean;
  context: HelperWorkflowContext | null;
  issues: WorkflowContextIssue[];
}

function readReviewedInput(
  value: unknown,
  field: string,
  issues: WorkflowContextIssue[]
): ReviewedInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push({
      code: "workflow_context_missing_review",
      reason: `${field} is missing from signal-loop-analysis and cannot prove the loop reviewed that context`
    });
    return null;
  }

  const record = value as Record<string, unknown>;
  const path = typeof record.path === "string" ? record.path.trim() : "";
  const available = record.available === true;
  const detail = typeof record.detail === "string" ? record.detail.trim() : "";
  const reviewMode = record.reviewMode === "loaded_only" || record.reviewMode === "compliance_verified"
    ? record.reviewMode
    : null;

  if (!path) {
    issues.push({
      code: "workflow_context_missing_review_path",
      reason: `${field}.path is missing from signal-loop-analysis`
    });
  }
  if (!available) {
    issues.push({
      code: "workflow_context_review_unavailable",
      reason: `${field} was not marked available in signal-loop-analysis`
    });
  }
  if (!detail) {
    issues.push({
      code: "workflow_context_missing_review_detail",
      reason: `${field}.detail is blank in signal-loop-analysis`
    });
  }
  if (!reviewMode) {
    issues.push({
      code: "workflow_context_missing_review_mode",
      reason: `${field}.reviewMode must be "loaded_only" or "compliance_verified" in signal-loop-analysis`
    });
  }

  if (!path || !available || !detail || !reviewMode) {
    return null;
  }

  return { path, available, detail, reviewMode };
}

export function validateSignalLoopWorkflowContext(
  reportDate: string,
  baseDir = process.cwd()
): WorkflowContextValidationResult {
  const issues: WorkflowContextIssue[] = [];
  const normalizedDate = reportDate.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return {
      ok: false,
      context: null,
      issues: [{
        code: "workflow_context_invalid_report_date",
        reason: `reportDate must be YYYY-MM-DD, got ${JSON.stringify(reportDate)}`
      }]
    };
  }

  const analysisPath = resolve(baseDir, "logs", `signal-loop-analysis-${normalizedDate}.json`);
  if (!existsSync(analysisPath)) {
    return {
      ok: false,
      context: null,
      issues: [{
        code: "workflow_context_missing_analysis",
        reason: `signal loop analysis artifact is missing: ${analysisPath}`
      }]
    };
  }

  let report: SignalLoopAnalysisReport;
  try {
    report = JSON.parse(readFileSync(analysisPath, "utf8")) as SignalLoopAnalysisReport;
  } catch (error) {
    return {
      ok: false,
      context: null,
      issues: [{
        code: "workflow_context_analysis_parse_failed",
        reason: `signal loop analysis artifact could not be parsed: ${(error as Error).message}`
      }]
    };
  }

  if (report.reportDate !== normalizedDate) {
    issues.push({
      code: "workflow_context_report_date_mismatch",
      reason: `signal-loop-analysis reportDate (${JSON.stringify(report.reportDate)}) does not match payload reportDate (${JSON.stringify(normalizedDate)})`
    });
  }

  const signalHistory = readReviewedInput(report.reviewedInputs?.signalHistory, "reviewedInputs.signalHistory", issues);
  const editorialMemory = readReviewedInput(report.reviewedInputs?.editorialMemory, "reviewedInputs.editorialMemory", issues);
  const outcomeFeedbackMemory = readReviewedInput(report.reviewedInputs?.outcomeFeedbackMemory, "reviewedInputs.outcomeFeedbackMemory", issues);
  const helperErrors = readReviewedInput(report.reviewedInputs?.helperErrors, "reviewedInputs.helperErrors", issues);
  const latestBrief = readReviewedInput(report.reviewedInputs?.latestBrief, "reviewedInputs.latestBrief", issues);
  const distilledLearningBrief = readReviewedInput(report.reviewedInputs?.distilledLearningBrief, "reviewedInputs.distilledLearningBrief", issues);

  const beatEditorGuidanceRaw = Array.isArray(report.reviewedInputs?.beatEditorGuidance)
    ? report.reviewedInputs.beatEditorGuidance
    : [];
  if (beatEditorGuidanceRaw.length === 0) {
    issues.push({
      code: "workflow_context_missing_beat_editor_guidance",
      reason: "signal-loop-analysis must record at least one beat editor guidance review before helper-ready JSON is emitted"
    });
  }

  const beatEditorGuidance = beatEditorGuidanceRaw
    .map((entry, index) => readReviewedInput(entry, `reviewedInputs.beatEditorGuidance[${index}]`, issues))
    .filter((entry): entry is ReviewedInput => Boolean(entry));

  if (issues.length > 0) {
    return { ok: false, context: null, issues };
  }

  return {
    ok: true,
    context: {
      reportDate: normalizedDate,
      analysisPath,
      analysisGeneratedAt: report.generatedAt,
      reviewedInputs: {
        signalHistoryPath: signalHistory!.path,
        editorialMemoryPath: editorialMemory!.path,
        outcomeFeedbackPath: outcomeFeedbackMemory!.path,
        helperErrorsPath: helperErrors!.path,
        latestBriefPath: latestBrief!.path,
        distilledLearningBriefPath: distilledLearningBrief!.path,
        beatEditorGuidancePaths: beatEditorGuidance.map((entry) => entry.path)
      }
    },
    issues: []
  };
}
