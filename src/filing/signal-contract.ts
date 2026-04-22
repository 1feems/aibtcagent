export interface CanonicalSignalSource {
  url: string;
  title: string;
}

export interface CanonicalSignalPayload {
  beat_slug: string;
  headline: string;
  body: string;
  analysis: string;
  sources: CanonicalSignalSource[];
  tags: string[];
  disclosure: string;
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

export interface CanonicalPayloadIssue {
  code: string;
  reason: string;
}

export interface HelperReadySignalPackage {
  btc_address: string;
  beat_slug: string;
  headline: string;
  body: string;
  analysis: string;
  sources: CanonicalSignalSource[];
  tags: string[];
  disclosure: string;
  workflow_context: HelperWorkflowContext;
  json: {
    btc_address: string;
    beat_slug: string;
    headline: string;
    body: string;
    analysis: string;
    sources: CanonicalSignalSource[];
    tags: string[];
    disclosure: string;
    workflow_context: HelperWorkflowContext;
  };
  helperPath: string;
  helperUrl: string;
}

export interface FirstSubmissionIssue {
  code: string;
  reason: string;
}

export const ALLOWED_SIGNAL_BEATS = ["quantum", "aibtc-network", "bitcoin-macro"] as const;

export type AllowedSignalBeat = (typeof ALLOWED_SIGNAL_BEATS)[number];

const DEFAULT_FILING_BTC_ADDRESS =
  process.env.AIBTC_BITCOIN_ADDRESS ?? "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv";

import { validateSignalLoopWorkflowContext } from "./workflow-context.js";

export function isAllowedSignalBeat(value: string): value is AllowedSignalBeat {
  return (ALLOWED_SIGNAL_BEATS as readonly string[]).includes(value.trim().toLowerCase());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSource(entry: unknown): CanonicalSignalSource | null {
  if (typeof entry === "string") {
    const value = entry.trim();
    return value ? { url: value, title: value } : null;
  }

  const record = asRecord(entry);
  if (!record) return null;
  const url = readString(record.url) || readString(record.source_url);
  const title = readString(record.title) || readString(record.source_name) || url;
  if (!url) return null;
  return { url, title: title || url };
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => readString(entry))
    .filter((entry) => entry.length > 0);
}

function normalizeDisclosure(record: Record<string, unknown>): string {
  const direct = readString(record.disclosure);
  if (direct) return direct;

  const modelDisclosure = asRecord(record.model_disclosure);
  if (!modelDisclosure) return "";

  const tools = Array.isArray(modelDisclosure.tools_used)
    ? modelDisclosure.tools_used.map((entry) => readString(entry)).filter(Boolean)
    : [];
  const steps = Array.isArray(modelDisclosure.derivation_steps)
    ? modelDisclosure.derivation_steps.map((entry) => readString(entry)).filter(Boolean)
    : [];

  return [...tools, ...steps].join("; ").trim();
}

function extractBodySection(body: string, label: "CLAIM" | "EVIDENCE" | "IMPLICATION"): string {
  const pattern = new RegExp(`(?:^|\\s)${label}:\\s*([\\s\\S]*?)(?=\\s(?:CLAIM|EVIDENCE|IMPLICATION|Directive|What to do):|$)`, "i");
  return pattern.exec(body)?.[1]?.trim() ?? "";
}

function hasConcreteAnchor(text: string): boolean {
  return /\bissue\s+#\d+\b|\bpr\s+#\d+\b|\bbounty\s+#\d+\b|\bcve-\d{4}-\d+\b|\bv\d+\.\d+(?:\.\d+)*\b|\bblock\s+\d[\d,]*\b|0x[0-9a-f]{8,}|\bhttps?:\/\/\S+|\bhttp\s+\d{3}\b|\b\d+(?:\.\d+)?%|\b\d[\d,.]*\s*(?:sats?|stx|sbtc|btc|agents?|signals?|slots?|txs?|hours?|days?)\b/i.test(text);
}

function hasOperatorAction(text: string): boolean {
  return /\b(?:agents?|operators?|correspondents?)\s+should\b|\b(?:verify|monitor|update|patch|redeploy|pause|avoid|resume|check|rotate|audit|review)\b/i.test(text);
}

function hasConcreteDisclosure(disclosure: string): boolean {
  return /\bhttps?:\/\/\S+|\b(?:github|api|endpoint|query|curl|release|issue|pr|block|tx|model|gpt|claude|gemini)\b/i.test(disclosure);
}

function hasTerminalPunctuation(text: string): boolean {
  return /[.!?]$/.test(text.trim());
}

export function validateFirstSubmissionPayload(payload: CanonicalSignalPayload): FirstSubmissionIssue[] {
  const issues: FirstSubmissionIssue[] = [];
  const claim = extractBodySection(payload.body, "CLAIM");
  const evidence = extractBodySection(payload.body, "EVIDENCE");
  const implication = extractBodySection(payload.body, "IMPLICATION");
  const sourceUrls = payload.sources.map((source) => source.url.trim()).filter(Boolean);

  if (payload.body.length > 1000) {
    issues.push({
      code: "first_submission_body_too_long",
      reason: `body is ${payload.body.length} characters; live signal body must be 1000 characters or less`
    });
  }
  if (!isAllowedSignalBeat(payload.beat_slug)) {
    issues.push({
      code: "first_submission_beat_not_allowed",
      reason: `beat_slug must be one of: ${ALLOWED_SIGNAL_BEATS.join(", ")}`
    });
  }
  if (!payload.headline.trim()) {
    issues.push({
      code: "first_submission_headline_missing",
      reason: "headline is required"
    });
  } else {
    if (payload.headline.trim().length > 120) {
      issues.push({
        code: "first_submission_headline_too_long",
        reason: "headline must be 120 characters or fewer"
      });
    }
    if (payload.headline.trim().endsWith(".")) {
      issues.push({
        code: "first_submission_headline_trailing_period",
        reason: "headline must not end with a period"
      });
    }
  }
  if (!claim || !evidence || !implication) {
    issues.push({
      code: "first_submission_missing_template",
      reason: "body must include non-empty CLAIM, EVIDENCE, and IMPLICATION sections before helper-ready JSON is emitted"
    });
  }
  if (claim && !hasTerminalPunctuation(claim)) {
    issues.push({
      code: "first_submission_claim_missing_terminal_punctuation",
      reason: "CLAIM must end with terminal punctuation."
    });
  }
  if (evidence && !hasTerminalPunctuation(evidence)) {
    issues.push({
      code: "first_submission_evidence_missing_terminal_punctuation",
      reason: "EVIDENCE must end with terminal punctuation."
    });
  }
  if (implication && !hasTerminalPunctuation(implication)) {
    issues.push({
      code: "first_submission_implication_missing_terminal_punctuation",
      reason: "IMPLICATION must end with terminal punctuation."
    });
  }
  if (claim && !hasConcreteAnchor(`${payload.headline} ${claim}`)) {
    issues.push({
      code: "first_submission_claim_missing_anchor",
      reason: "CLAIM must include or inherit a concrete anchor such as a PR, issue, version, block, tx, percentage, amount, or HTTP code"
    });
  }
  if (evidence && !/\bhttps?:\/\/\S+/i.test(evidence)) {
    issues.push({
      code: "first_submission_evidence_missing_url",
      reason: "EVIDENCE must include an exact source URL, not just a source name"
    });
  }
  if (evidence && !hasConcreteAnchor(evidence)) {
    issues.push({
      code: "first_submission_evidence_missing_anchor",
      reason: "EVIDENCE must include a concrete data point or event anchor"
    });
  }
  if (
    evidence &&
    sourceUrls.length > 0 &&
    !sourceUrls.some((url) => evidence.includes(url))
  ) {
    issues.push({
      code: "first_submission_evidence_source_mismatch",
      reason: "EVIDENCE must cite one of the payload source URLs so the publisher can reproduce the claim"
    });
  }
  if (implication && !hasOperatorAction(implication)) {
    issues.push({
      code: "first_submission_implication_missing_action",
      reason: "IMPLICATION must name an operator or agent action such as verify, monitor, update, pause, or resume"
    });
  }
  if (!hasConcreteDisclosure(payload.disclosure)) {
    issues.push({
      code: "first_submission_disclosure_not_replicable",
      reason: "disclosure must name concrete tools, model, query, endpoint, URL, issue, PR, release, block, or transaction anchors"
    });
  }
  if (!payload.tags.map((tag) => tag.toLowerCase()).includes(payload.beat_slug.toLowerCase())) {
    issues.push({
      code: "first_submission_missing_primary_beat_tag",
      reason: "tags must include beat_slug as a primary tag"
    });
  }
  const invalidSource = payload.sources.find(
    (source) => !/^https?:\/\//i.test(source.url.trim()) || !source.title.trim()
  );
  if (invalidSource) {
    issues.push({
      code: "first_submission_source_invalid",
      reason: "every source must include non-empty title and http/https url"
    });
  }

  return issues;
}

export function parseCanonicalSignalPayload(input: unknown): {
  payload: CanonicalSignalPayload | null;
  issues: CanonicalPayloadIssue[];
} {
  const root = asRecord(input);
  if (!root) {
    return {
      payload: null,
      issues: [{ code: "format_not_object", reason: "Signal payload is not a JSON object" }]
    };
  }

  const record = asRecord(root.sendPackage) ?? root;
  const beatSlug = readString(record.beat_slug) || readString(record.beat);
  const headline = readString(record.headline);
  const body = readString(record.body) || readString(record.analysis);
  const sources = Array.isArray(record.sources)
    ? record.sources.map((entry) => normalizeSource(entry)).filter((entry): entry is CanonicalSignalSource => Boolean(entry))
    : [];
  const tags = normalizeTags(record.tags);
  const disclosure = normalizeDisclosure(record);

  const payload: CanonicalSignalPayload = {
    beat_slug: beatSlug,
    headline,
    body,
    analysis: body,
    sources,
    tags,
    disclosure
  };

  const issues: CanonicalPayloadIssue[] = [];
  if (!payload.beat_slug) issues.push({ code: "format_missing_beat_slug", reason: "Canonical signal payload is missing beat_slug" });
  if (payload.beat_slug && !isAllowedSignalBeat(payload.beat_slug)) {
    issues.push({
      code: "format_beat_slug_not_allowed",
      reason: `Canonical signal payload beat_slug must be one of: ${ALLOWED_SIGNAL_BEATS.join(", ")}`
    });
  }
  if (!payload.headline) issues.push({ code: "format_missing_headline", reason: "Canonical signal payload is missing headline" });
  if (!payload.body) issues.push({ code: "format_missing_body", reason: "Canonical signal payload is missing body" });
  if (sources.length === 0) issues.push({ code: "format_missing_sources", reason: "Canonical signal payload is missing sources" });
  if (tags.length === 0) issues.push({ code: "format_missing_tags", reason: "Canonical signal payload is missing tags" });
  if (!payload.disclosure) issues.push({ code: "format_missing_disclosure", reason: "Canonical signal payload is missing disclosure" });

  return {
    payload,
    issues
  };
}

export function buildHelperReadySignalPackage(
  payload: CanonicalSignalPayload,
  btcAddress = DEFAULT_FILING_BTC_ADDRESS,
  options: { reportDate?: string; baseDir?: string } = {}
): HelperReadySignalPackage {
  const firstSubmissionIssues = validateFirstSubmissionPayload(payload);
  if (firstSubmissionIssues.length > 0) {
    throw new Error(
      `helper-ready signal refused first-submission-incomplete payload: ${firstSubmissionIssues.map((issue) => `${issue.code}: ${issue.reason}`).join("; ")}`
    );
  }

  const reportDate = options.reportDate?.trim();
  if (!reportDate) {
    throw new Error("helper-ready signal refused missing reportDate: run signal-loop first and pass the dated loop context into buildHelperReadySignalPackage");
  }

  const workflowContext = validateSignalLoopWorkflowContext(reportDate, options.baseDir ?? process.cwd());
  if (!workflowContext.ok || !workflowContext.context) {
    throw new Error(
      `helper-ready signal refused missing loop context: ${workflowContext.issues.map((issue) => `${issue.code}: ${issue.reason}`).join("; ")}`
    );
  }

  const normalizedAddress = btcAddress.trim() || DEFAULT_FILING_BTC_ADDRESS;
  const normalizedSources = payload.sources.map((source) => ({
    url: source.url,
    title: source.title
  }));

  return {
    btc_address: normalizedAddress,
    beat_slug: payload.beat_slug,
    headline: payload.headline,
    body: payload.body,
    analysis: payload.body,
    sources: normalizedSources,
    tags: [...payload.tags],
    disclosure: payload.disclosure,
    workflow_context: workflowContext.context,
    json: {
      btc_address: normalizedAddress,
      beat_slug: payload.beat_slug,
      headline: payload.headline,
      body: payload.body,
      analysis: payload.body,
      sources: normalizedSources,
      tags: [...payload.tags],
      disclosure: payload.disclosure,
      workflow_context: workflowContext.context
    },
    helperPath: "tools/xverse-register/file-signal.html",
    helperUrl: "http://127.0.0.1:4173/tools/xverse-register/file-signal.html"
  };
}
