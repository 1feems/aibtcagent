import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseCanonicalSignalPayload } from "./signal-contract.js";
import { filingGateIssuesToBlockers, validateFilingGate } from "./filing-gate-validator.js";
import { hasExactHeadlineAnchor, hasTemplateAnalysis, isDocumentationSignal } from "./template-rules.js";

export interface ArtifactValidationIssue {
  code: string;
  field: string;
  reason: string;
}

export interface ArtifactValidationResult {
  ok: boolean;
  issues: ArtifactValidationIssue[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isLikelyCompleteHeadline(headline: string): boolean {
  const trimmed = headline.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;
  if (!/[a-z0-9)]$/i.test(trimmed)) return false;
  const bannedEndings = [
    "operators onboarding new",
    "agents should review expo",
    "operators onboarding",
    "review expo"
  ];
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return !bannedEndings.some((ending) => normalized.endsWith(ending));
}

function readRawSources(root: Record<string, unknown>): unknown[] {
  const record = asRecord(root.sendPackage) ?? root;
  return Array.isArray(record.sources) ? record.sources : [];
}

function validateSourceObjects(root: Record<string, unknown>, issues: ArtifactValidationIssue[]): void {
  const sources = readRawSources(root);
  if (sources.length === 0) {
    issues.push({
      code: "artifact_missing_sources",
      field: "sources",
      reason: "artifact must include at least one source object"
    });
    return;
  }

  for (const [index, source] of sources.entries()) {
    if (typeof source === "string") {
      issues.push({
        code: "artifact_source_string_not_allowed",
        field: `sources[${index}]`,
        reason: "sources must be {url,title} objects; plain string sources are not allowed in canonical artifacts"
      });
      continue;
    }

    const record = asRecord(source);
    if (!record) {
      issues.push({
        code: "artifact_source_invalid",
        field: `sources[${index}]`,
        reason: "source entry must be an object with url and title"
      });
      continue;
    }

    const url = readString(record.url) || readString(record.source_url);
    const title = readString(record.title) || readString(record.source_name);
    if (!url) {
      issues.push({
        code: "artifact_source_missing_url",
        field: `sources[${index}].url`,
        reason: "source object must include a non-empty url"
      });
    }
    if (!title) {
      issues.push({
        code: "artifact_source_missing_title",
        field: `sources[${index}].title`,
        reason: "source object must include a non-empty title"
      });
    }
  }
}

export function validateArtifact(input: unknown): ArtifactValidationResult {
  const issues: ArtifactValidationIssue[] = [];
  const root = asRecord(input);

  if (!root) {
    return {
      ok: false,
      issues: [{
        code: "artifact_not_object",
        field: "",
        reason: "artifact must be a JSON object"
      }]
    };
  }

  if (root.non_fileable === true || root.fileable === false) {
    issues.push({
      code: "artifact_non_fileable_intermediate",
      field: root.non_fileable === true ? "non_fileable" : "fileable",
      reason: "intermediate candidate artifacts are ranking inputs only; run create-signal to produce a create_signal_artifact before queuing or filing"
    });
  }

  const { payload, issues: payloadIssues } = parseCanonicalSignalPayload(root);
  for (const issue of payloadIssues) {
    issues.push({
      code: issue.code,
      field: "payload",
      reason: issue.reason
    });
  }

  const record = asRecord(root.sendPackage) ?? root;
  const body = readString(record.body);
  const analysis = readString(record.analysis);
  if (!body) {
    issues.push({
      code: "artifact_missing_body_field",
      field: "body",
      reason: "canonical artifacts must include a non-empty body field"
    });
  }
  if (body && analysis && body !== analysis) {
    issues.push({
      code: "artifact_body_analysis_mismatch",
      field: "analysis",
      reason: "analysis must match body exactly at canonical artifact boundaries"
    });
  }

  validateSourceObjects(root, issues);

  if (payload?.headline) {
    if (!hasExactHeadlineAnchor(payload.headline)) {
      issues.push({
        code: "artifact_headline_missing_anchor",
        field: "headline",
        reason: "headline must contain an exact anchor before the artifact can be treated as filing-ready"
      });
    }
    if (!isLikelyCompleteHeadline(payload.headline)) {
      issues.push({
        code: "artifact_headline_incomplete",
        field: "headline",
        reason: "headline is truncated, malformed, or exceeds the max length"
      });
    }

    const narrativeForDocCheck = body || analysis || "";
    if (isDocumentationSignal(payload.headline, narrativeForDocCheck)) {
      issues.push({
        code: "artifact_documentation_signal",
        field: "headline",
        reason: "signal describes platform behavior or filing mechanics without a live-event anchor; not filing-ready — anchor to a merged PR#, shipped version, HTTP error incident, or on-chain event"
      });
    }
  }

  const narrative = body || analysis || payload?.analysis || "";
  if (narrative && !hasTemplateAnalysis(narrative)) {
    issues.push({
      code: "artifact_body_missing_template",
      field: body ? "body" : "analysis",
      reason: "body must use an approved template structure before the artifact can be filed"
    });
  }

  const gateResult = validateFilingGate(root);
  for (const issue of gateResult.issues) {
    issues.push({
      code: issue.code,
      field: issue.field,
      reason: issue.reason
    });
  }

  if (payload && gateResult.gate) {
    if (gateResult.gate.headline !== payload.headline) {
      issues.push({
        code: "artifact_gate_headline_mismatch",
        field: "filing_gate.headline",
        reason: "filing_gate.headline must match the canonical artifact headline exactly"
      });
    }
    if (gateResult.gate.beat !== payload.beat_slug) {
      issues.push({
        code: "artifact_gate_beat_mismatch",
        field: "filing_gate.beat",
        reason: "filing_gate.beat must match the canonical artifact beat_slug exactly"
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

export function artifactIssuesToBlockers(issues: ArtifactValidationIssue[]): string[] {
  const gateIssues = issues.filter((issue) => issue.field === "filing_gate" || issue.field.startsWith("filing_gate."));
  const blockers = gateIssues.length > 0
    ? filingGateIssuesToBlockers(gateIssues.map((issue) => ({
      code: issue.code,
      field: issue.field,
      reason: issue.reason
    })))
    : [];

  const generic = issues
    .filter((issue) => issue.field !== "filing_gate" && !issue.field.startsWith("filing_gate."))
    .map((issue) => `hard-blocked from signable queue because artifact validation failed (${issue.code}): ${issue.reason}`);

  return [...blockers, ...generic];
}

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    process.stderr.write("Usage: npm run validate-artifact -- <file>\n");
    process.exitCode = 1;
    return;
  }

  const { readFile } = await import("node:fs/promises");
  const artifact = JSON.parse(await readFile(resolve(process.cwd(), filePath), "utf8")) as unknown;
  const result = validateArtifact(artifact);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
