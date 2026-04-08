export interface CanonicalSignalSource {
  url: string;
  title: string;
}

export interface CanonicalSignalPayload {
  beat_slug: string;
  headline: string;
  analysis: string;
  sources: CanonicalSignalSource[];
  tags: string[];
  disclosure: string;
}

export interface CanonicalPayloadIssue {
  code: string;
  reason: string;
}

export interface HelperReadySignalPackage {
  btc_address: string;
  headline: string;
  analysis: string;
  sources: CanonicalSignalSource[];
  tags: string[];
  disclosure: string;
  json: {
    btc_address: string;
    headline: string;
    analysis: string;
    sources: CanonicalSignalSource[];
    tags: string[];
    disclosure: string;
  };
  helperPath: string;
  helperUrl: string;
}

const DEFAULT_FILING_BTC_ADDRESS =
  process.env.AIBTC_BITCOIN_ADDRESS ?? "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv";

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
  const analysis = readString(record.analysis) || readString(record.body);
  const sources = Array.isArray(record.sources)
    ? record.sources.map((entry) => normalizeSource(entry)).filter((entry): entry is CanonicalSignalSource => Boolean(entry))
    : [];
  const tags = normalizeTags(record.tags);
  const disclosure = normalizeDisclosure(record);

  const payload: CanonicalSignalPayload = {
    beat_slug: beatSlug,
    headline,
    analysis,
    sources,
    tags,
    disclosure
  };

  const issues: CanonicalPayloadIssue[] = [];
  if (!payload.beat_slug) issues.push({ code: "format_missing_beat_slug", reason: "Canonical signal payload is missing beat_slug" });
  if (!payload.headline) issues.push({ code: "format_missing_headline", reason: "Canonical signal payload is missing headline" });
  if (!payload.analysis) issues.push({ code: "format_missing_analysis", reason: "Canonical signal payload is missing analysis" });
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
  btcAddress = DEFAULT_FILING_BTC_ADDRESS
): HelperReadySignalPackage {
  const normalizedAddress = btcAddress.trim() || DEFAULT_FILING_BTC_ADDRESS;
  const normalizedSources = payload.sources.map((source) => ({
    url: source.url,
    title: source.title
  }));

  return {
    btc_address: normalizedAddress,
    headline: payload.headline,
    analysis: payload.analysis,
    sources: normalizedSources,
    tags: [...payload.tags],
    disclosure: payload.disclosure,
    json: {
      btc_address: normalizedAddress,
      headline: payload.headline,
      analysis: payload.analysis,
      sources: normalizedSources,
      tags: [...payload.tags],
      disclosure: payload.disclosure
    },
    helperPath: "tools/xverse-register/file-signal.html",
    helperUrl: "http://127.0.0.1:4173/tools/xverse-register/file-signal.html"
  };
}
