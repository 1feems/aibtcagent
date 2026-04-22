import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { getPacificReportDate } from "../utils/report-date.js";
import { parseCanonicalSignalPayload, type CanonicalSignalPayload } from "./signal-contract.js";
import {
  extractMetricAnchors,
  extractStoryAnchors,
  hasExactHeadlineAnchor,
  hasTemplateAnalysis
} from "./template-rules.js";

interface SignalGuardFiledSignalRecord {
  signalId?: string | null;
  headline?: string | null;
  beat?: string | null;
  resolved?: boolean;
  outcome?: string;
}

export interface SourceRef {
  url?: string;
  title?: string;
}

export interface ModelDisclosurePayload {
  tools_used?: string[];
  derivation_steps?: string[];
}

export interface SignalGuardPayload {
  reportDate?: string | null;
  headline?: string | null;
  beat_slug?: string | null;
  body?: string | null;
  sources?: SourceRef[] | null;
  model_disclosure?: ModelDisclosurePayload | null;
  enforceWinnerBar?: boolean | null;
}

export interface SignalGuardDiagnostic {
  code: string;
  layer:
    | "duplicate"
    | "editor_guidance"
    | "fact_check"
    | "helper_mismatch"
    | "format_mismatch"
    | "stale_memory";
  status: "pass" | "reject" | "skip";
  message: string;
}

export interface SignalGuardResult {
  ok: boolean;
  reportDate: string;
  blockers: string[];
  checks: Record<string, string>;
  diagnostics: SignalGuardDiagnostic[];
  briefMatch: string | null;
  priorBriefMatches: Array<{ date: string; line: string }>;
  approvedNotInBriefMatches: Array<{ date: string; headline: string }>;
  filedMatch: {
    signalId: string | null;
    headline: string | null;
    outcome: string | null;
    resolved: boolean | null;
  } | null;
}

interface GuardCheckOutcome {
  ok: boolean;
  blocker?: string;
  diagnostic: SignalGuardDiagnostic;
  value: string;
}

interface EditorialMemorySnapshot {
  generatedAt?: string;
  currentCycle?: {
    reportDate?: string | null;
  };
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`'".,/:;!?()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  const stopwords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "in", "into", "is", "it",
    "its", "of", "on", "or", "so", "than", "that", "the", "their", "this", "to", "up", "with"
  ]);

  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token));
}

function computeTokenOverlap(a: string, b: string): { overlapCount: number; overlapRatio: number } {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  const sharedTokens = [...tokensA].filter((token) => tokensB.has(token));
  const denominator = Math.max(tokensA.size, tokensB.size, 1);
  return { overlapCount: sharedTokens.length, overlapRatio: sharedTokens.length / denominator };
}

function isLikelySameStory(a: string, b: string): boolean {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true;
  const overlap = computeTokenOverlap(normalizedA, normalizedB);
  const hasNumberAnchor = /\d/.test(normalizedA) && /\d/.test(normalizedB);
  return overlap.overlapCount >= 5 && (overlap.overlapRatio >= 0.5 || hasNumberAnchor);
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function normalizeRepoSourceDomain(domain: string): string {
  return domain.replace(/^www\./, "").toLowerCase();
}

function isHomepageLevelSource(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return true;

  if (/^\/[^/]+\/[^/]+$/.test(path) && normalizeRepoSourceDomain(parsed.hostname) === "github.com") {
    return true;
  }

  return false;
}

function hasRepositoryRootSource(sources: SourceRef[]): boolean {
  return sources.some((source) => {
    const url = source.url?.trim() ?? "";
    return url.length > 0 && isHomepageLevelSource(url);
  });
}

function isProjectControlledSource(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }

  const domain = normalizeRepoSourceDomain(parsed.hostname);
  const path = parsed.pathname.toLowerCase();

  if ([
    "aibtc.com",
    "aibtc.news",
    "api.hiro.so",
    "hiro.so",
    "docs.hiro.so",
    "docs.stacks.co",
    "docs.stacks.xyz",
    "localhost",
    "127.0.0.1"
  ].some((pattern) => domain === pattern || domain.endsWith(`.${pattern}`))) {
    return true;
  }

  if (domain === "github.com" || domain === "raw.githubusercontent.com") {
    return [
      "/aibtcdev/",
      "/stacks-network/",
      "/hirosystems/",
      "/stx-labs/",
      "/trust-machines/"
    ].some((prefix) => path.startsWith(prefix));
  }

  return false;
}

function hasIndependentExternalSource(sources: SourceRef[]): boolean {
  return sources.some((source) => {
    const rawUrl = source.url?.trim();
    if (!rawUrl) return false;
    return !isProjectControlledSource(rawUrl);
  });
}

function isQuantumBeat(beatSlug: string | null | undefined): boolean {
  return (beatSlug ?? "").trim().toLowerCase() === "quantum";
}

function isDiscussionThreadSource(url: string): boolean {
  return /delvingbitcoin\.org\/|gnusha\.org\/pi\/bitcoindev\/|lists\.linuxfoundation\.org\/|groups\.google\.com\//i.test(url);
}

function isGithubPullSource(url: string): boolean {
  return /github\.com\/[^/]+\/[^/]+\/pull\/\d+/i.test(url);
}

function isClosedPullRequestProof(payload: SignalGuardPayload): boolean {
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const pullSources = sources.filter((source) => isGithubPullSource(source.url?.trim() ?? ""));
  if (pullSources.length === 0) return false;
  const text = `${payload.headline ?? ""} ${payload.body ?? ""} ${pullSources.map((source) => source.title ?? "").join(" ")}`;
  return /\bclosed\b/i.test(text);
}

function isQuantumStateArtifact(url: string): boolean {
  return /github\.com\/[^/]+\/[^/]+\/commit\/[0-9a-f]{7,}/i.test(url) ||
    /github\.com\/[^/]+\/[^/]+\/releases\/tag\//i.test(url) ||
    /github\.com\/[^/]+\/[^/]+\/blob\/.+/i.test(url) ||
    /raw\.githubusercontent\.com\//i.test(url) ||
    /\/bip-\d+(\.mediawiki|\.md)?$/i.test(url);
}

function isDiscussionOnlyQuantumSourceSet(sources: SourceRef[]): boolean {
  const urls = sources.map((source) => source.url?.trim()).filter(Boolean) as string[];
  return urls.length > 0 && urls.every((url) => isDiscussionThreadSource(url));
}

function isPullOnlyQuantumSourceSet(sources: SourceRef[]): boolean {
  const urls = sources.map((source) => source.url?.trim()).filter(Boolean) as string[];
  return urls.some((url) => isGithubPullSource(url)) &&
    !urls.some((url) => isQuantumStateArtifact(url));
}

function hasLogicalPhysicalQubitDistinction(text: string): boolean {
  return /\blogical\b|\bphysical\b/i.test(text);
}

function isAibtcNativeQuantumAngle(text: string): boolean {
  return /\baibtc\b|\bagent(?:s|ic)?\b|\bx402\b|\bmcp\b|\bnostr\b|\berc-8004\b|\bidentity registry\b|\binbox\b|\bsponsor relay\b/i.test(text);
}

function isSaturatedQuantumCluster(text: string): boolean {
  return /\bbip-360\b|\bbip360\b|\bbip-361\b|\bbip361\b|\bnist\b|\bfips\b|\bgoogle\b|\bimplementation\b|\bexposure\b/i.test(text);
}

function normalizeSourceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString().toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

async function loadSameDaySourceUrls(root: string, reportDate: string): Promise<Set<string>> {
  const urls = new Set<string>();
  const readyDir = resolve(root, "data/filing-ready", reportDate);
  const entries = await readdir(readyDir).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [] as string[];
    throw error;
  });
  await Promise.all(entries.filter((entry) => entry.endsWith(".json")).map(async (entry) => {
    try {
      const parsed = JSON.parse(await readFile(resolve(readyDir, entry), "utf8")) as { sources?: SourceRef[] };
      for (const source of parsed.sources ?? []) {
        const url = source.url?.trim();
        if (url) urls.add(normalizeSourceUrl(url));
      }
    } catch {
      // Ignore malformed old artifacts while guarding the current payload.
    }
  }));
  return urls;
}

function stripNonMetricAnchors(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b(?:pr|issue|topic|thread|discussion|block|height|tx|transaction|endpoint|error|version)\s*#?\d+\b/gi, " ")
    .replace(/`\s*#?\d+\s*`/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b(?:v)?\d+\.\d+(?:\.\d+)?\b/gi, " ")
    .replace(/\b\d+\s*-\s*(?:step|phase)\b/gi, " ");
}

function isMetricHeavyClaim(text: string): boolean {
  const normalized = stripNonMetricAnchors(text.toLowerCase());
  return /\b\d+(?:\.\d+)?%/.test(normalized) ||
    /(?:\$|~)\s?\d/.test(normalized) ||
    /\b\d[\d,]*(?:\.\d+)?(?:\+|x)?\s?(?:btc|stx|sbtc|sat|sats|qubits?|blocks?|days?|hours?|weeks?|months?|years?|txs?|transactions?|channels?|nodes?|agents?|addresses?|outputs?|wallets?|ms|kb|mb|gb|tb|mvb|vb|sigs?|signatures?)\b/.test(normalized) ||
    /\b\d[\d,]{3,}\b/.test(normalized);
}

function isCircularSourcing(sources: SourceRef[]): boolean {
  if (sources.length === 0) return false;
  const urls = sources.map((s) => s.url?.trim()).filter(Boolean) as string[];
  if (urls.length === 0) return true;
  return !urls.some((url) => !isProjectControlledSource(url));
}

function allSourcesFromSameOrg(sources: SourceRef[]): boolean {
  const domains = [...new Set(
    sources.map((source) => extractDomain(source.url ?? ""))
      .filter((domain): domain is string => Boolean(domain))
      .map((domain) => domain.split(".").slice(-2).join("."))
  )];
  return domains.length === 1 && domains[0].length > 0;
}

function hasVerifiableSources(sources: SourceRef[]): boolean {
  if (sources.length === 0) return false;
  return sources.every((source) => {
    const url = source.url?.trim() ?? "";
    const title = source.title?.trim() ?? "";
    if (!url || !title) return false;
    if (/twitter\.com|x\.com|medium\.com|substack\.com|coindesk\.com|cointelegraph\.com/i.test(url)) return false;
    if (/arxiv\.org\/abs\/\d{4}\.\d{4,5}(v\d+)?/i.test(url)) return true;
    if (/eprint\.iacr\.org\/\d{4}\/\d+/i.test(url)) return true;
    if (/nist\.gov\/.+/i.test(url)) return true;
    if (/research\.ibm\.com\/.+/i.test(url)) return true;
    if (/quantumai\.google\/.+|research\.google\/.+/i.test(url)) return true;
    if (/gnusha\.org\/pi\/bitcoindev\/.+/i.test(url)) return true;
    if (/delvingbitcoin\.org\/.+/i.test(url)) return true;
    return /https?:\/\/.+/.test(url) &&
      (/github\.com|\/api\/|explorer\.|releases\/tag\/|issues\/\d+|pull\/\d+|bip-\d+|docs\./i.test(url));
  });
}

function hasAnchorCollision(candidateText: string, contextText: string): boolean {
  const candidateAnchors = extractStoryAnchors(candidateText).map(normalizeText);
  if (candidateAnchors.length === 0) return false;
  const contextAnchors = extractStoryAnchors(contextText).map(normalizeText);
  const sharedAnchors = candidateAnchors.filter((anchor) => contextAnchors.includes(anchor));
  if (sharedAnchors.length === 0) return false;
  const candidateMetrics = extractMetricAnchors(candidateText).map(normalizeText);
  const contextMetrics = extractMetricAnchors(contextText).map(normalizeText);
  const sharedMetrics = candidateMetrics.filter((metric) => contextMetrics.includes(metric));
  return sharedMetrics.length > 0 || isLikelySameStory(candidateText, contextText);
}

async function listMarkdownDates(dirPath: string): Promise<string[]> {
  try {
    const names = await readdir(dirPath);
    return names.filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name)).map((name) => name.replace(/\.md$/, "")).sort();
  } catch {
    return [];
  }
}

async function loadRecentBriefMatches(reportDate: string, headline: string, limit = 2, baseDir?: string): Promise<Array<{ date: string; line: string }>> {
  const briefDir = resolve(baseDir ?? process.cwd(), "data/briefs");
  const dates = await listMarkdownDates(briefDir);
  const priorDates = dates.filter((date) => date < reportDate).slice(-limit).reverse();
  const matches: Array<{ date: string; line: string }> = [];
  for (const date of priorDates) {
    const briefText = await readFile(resolve(briefDir, `${date}.md`), "utf8").catch(() => "");
    const lines = briefText.split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter((line) => line.length >= 20);
    const match = lines.find((line) => isLikelySameStory(headline, line));
    if (match) matches.push({ date, line: match });
  }
  return matches;
}

async function loadRecentApprovedNotInBriefMatches(reportDate: string, headline: string, limit = 2, baseDir?: string): Promise<Array<{ date: string; headline: string }>> {
  const reportDir = resolve(baseDir ?? process.cwd(), "data/reports/daily");
  const dates = await listMarkdownDates(reportDir);
  const priorDates = dates.filter((date) => date < reportDate).slice(-limit).reverse();
  const matches: Array<{ date: string; headline: string }> = [];
  for (const date of priorDates) {
    const reportText = await readFile(resolve(reportDir, `${date}.md`), "utf8").catch(() => "");
    let currentHeadline: string | null = null;
    let currentStatus: string | null = null;
    for (const rawLine of reportText.split("\n")) {
      const line = rawLine.trim();
      if (line.startsWith("headline: ")) currentHeadline = line.slice("headline: ".length).trim();
      else if (line.startsWith("status: ")) {
        currentStatus = line.slice("status: ".length).trim();
        if (currentStatus === "approved_not_in_brief" && currentHeadline && isLikelySameStory(headline, currentHeadline)) {
          matches.push({ date, headline: currentHeadline });
        }
      } else if (line.startsWith("- signal_id: ")) {
        currentHeadline = null;
        currentStatus = null;
      }
    }
  }
  return matches;
}

function matchedFailureReason(entry: SignalGuardFiledSignalRecord | null, headline: string): string | null {
  if (!entry?.headline || !isLikelySameStory(headline, entry.headline)) return null;
  if (entry.outcome === "denied" || entry.outcome === "rejected") {
    return `Same story shape already failed as ${entry.outcome}; review publisher feedback and repair before resubmitting`;
  }
  return null;
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function detectClaimTypes(text: string): string[] {
  const normalized = text.toLowerCase();
  const claimTypes: string[] = [];
  if (/\bbtc\b|\bbitcoin\b/.test(normalized) && /\$\d|\bprice\b|\btrading at\b/.test(normalized)) claimTypes.push("price");
  if (/\bpayout\b|\bsats\b|\bsbtc\b|\breward\b/.test(normalized) && /\d/.test(normalized)) claimTypes.push("payout");
  if (/\bblock\b|\bheight\b/.test(normalized) && /\d/.test(normalized)) claimTypes.push("block_height");
  if (/\bwallet\b|\bagent\b|\bidentity\b|\bregistration\b/.test(normalized) && /\d/.test(normalized)) claimTypes.push("count");
  if (/\brouting\b|\bsettlement\b|\bnonce\b|\bpayment\b|\binbox\b|\broute\s+(?:payment|payments|settlement|tx|transaction|transactions|flow|flows)\b/.test(normalized)) {
    claimTypes.push("routing_settlement");
  }
  if (/\bcve-\d{4}-\d+\b|\bexploit\b|\bhack(?:ed|ers?)?\b|\bvulnerability\b|\bsecurity\b/.test(normalized)) claimTypes.push("security");
  return [...new Set(claimTypes)];
}

function hasStructuredPrimaryAnchor(sources: SourceRef[]): boolean {
  return sources.some((source) => {
    const url = source.url?.trim() ?? "";
    if (!url) return false;
    return /github\.com|\/api\/|release|issue|pull|docs\./i.test(url);
  });
}

function toUtcDateOnly(input: string): Date | null {
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = Date.parse(`${trimmed}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed);
}

function extractEvidenceDates(text: string): Date[] {
  const matches = text.match(/\b\d{4}-\d{2}-\d{2}(?:t\d{2}:\d{2}:\d{2}(?:\.\d+)?z)?\b/gi) ?? [];
  const parsed = matches
    .map((value) => {
      if (/t\d{2}:\d{2}:\d{2}/i.test(value)) {
        const ts = Date.parse(value);
        return Number.isFinite(ts) ? new Date(ts) : null;
      }
      return toUtcDateOnly(value);
    })
    .filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());
  return parsed;
}

function isStaleOpenStatusClaim(payload: CanonicalSignalPayload, reportDate: string): boolean {
  const report = toUtcDateOnly(reportDate);
  if (!report) return false;

  const combinedText = `${payload.headline} ${payload.analysis}`.toLowerCase();
  const hasPrOrIssueAnchor = /\b(?:pr|issue)\s*#\d+\b/.test(combinedText);
  const hasOpenStateLanguage =
    /\bopen\b|\bunmerged\b|\bnot merged\b|\bpending\b|\breview queue\b|\bawaiting merge\b/.test(combinedText);
  const hasPersistenceLanguage =
    /\bstill\b|\bremains?\b|\bcontinues?\b|\bas of\b/.test(combinedText);
  if (!hasPrOrIssueAnchor || !hasOpenStateLanguage || !hasPersistenceLanguage) {
    return false;
  }

  const evidenceDates = extractEvidenceDates(combinedText);
  if (evidenceDates.length === 0) return false;
  const freshestEvidence = evidenceDates[0];
  const ageMs = report.getTime() - freshestEvidence.getTime();
  if (ageMs <= 0) return false;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  const hasFreshWindowCue =
    /\blast\s*(?:24|48)\s*(?:h|hours)\b|\btoday\b|\byesterday\b/.test(combinedText);

  return ageDays > 3 && !hasFreshWindowCue;
}

function evaluateFormatMismatch(payload: SignalGuardPayload): GuardCheckOutcome {
  const { issues } = parseCanonicalSignalPayload({
    beat_slug: payload.beat_slug ?? "",
    headline: payload.headline ?? "",
    analysis: payload.body ?? "",
    sources: payload.sources ?? [],
    tags: ["helper-runtime"],
    disclosure: [
      ...(payload.model_disclosure?.tools_used ?? []),
      ...(payload.model_disclosure?.derivation_steps ?? [])
    ].join("; ")
  });

  if (issues.length === 0) {
    return {
      ok: true,
      value: "pass",
      diagnostic: {
        code: "format_payload_contract",
        layer: "format_mismatch",
        status: "pass",
        message: "Payload matches the canonical signal contract"
      }
    };
  }

  return {
    ok: false,
    blocker: issues.map((issue) => issue.reason).join("; "),
    value: "reject",
    diagnostic: {
      code: issues[0]?.code ?? "format_payload_contract",
      layer: "format_mismatch",
      status: "reject",
      message: issues.map((issue) => issue.reason).join("; ")
    }
  };
}

function evaluateMemoryFreshness(editorialMemory: EditorialMemorySnapshot | null, reportDate: string): GuardCheckOutcome {
  const cycleDate = editorialMemory?.currentCycle?.reportDate?.trim();
  if (cycleDate && cycleDate < reportDate) {
    return {
      ok: false,
      blocker: `Editorial memory is stale for ${reportDate}; current cycle is still ${cycleDate}`,
      value: "reject",
      diagnostic: {
        code: "stale_editorial_memory_cycle",
        layer: "stale_memory",
        status: "reject",
        message: `Editorial memory currentCycle.reportDate is ${cycleDate}, behind requested report date ${reportDate}`
      }
    };
  }

  return {
    ok: true,
    value: "pass",
    diagnostic: {
      code: "stale_editorial_memory_cycle",
      layer: "stale_memory",
      status: "pass",
      message: cycleDate ? `Editorial memory is current for ${cycleDate}` : "Editorial memory freshness not explicit, but no stale cycle mismatch was detected"
    }
  };
}

function evaluateTemplateChecks(payload: CanonicalSignalPayload): GuardCheckOutcome[] {
  const analysis = payload.analysis ?? "";
  const headline = payload.headline ?? "";
  const likelyTruncated =
    analysis.trim().length >= 950 &&
    !/[.!?]"?$/.test(analysis.trim());
  const overSoftLimit = analysis.trim().length > 900;

  return [
    {
      ok: hasExactHeadlineAnchor(headline),
      blocker: "Template check failed: headline must include an exact anchor such as a PR, issue, version, endpoint, error code, block height, or hard metric",
      value: hasExactHeadlineAnchor(headline) ? "pass" : "reject",
      diagnostic: {
        code: "template_headline_anchor",
        layer: "format_mismatch",
        status: hasExactHeadlineAnchor(headline) ? "pass" : "reject",
        message: hasExactHeadlineAnchor(headline)
          ? "Template headline anchor check passed"
          : "Template headline anchor check failed"
      }
    },
    {
      ok: hasTemplateAnalysis(analysis),
      blocker: "Template check failed: analysis must use CLAIM/EVIDENCE/IMPLICATION or What changed/What it means/What to do",
      value: hasTemplateAnalysis(analysis) ? "pass" : "reject",
      diagnostic: {
        code: "template_analysis_framework",
        layer: "format_mismatch",
        status: hasTemplateAnalysis(analysis) ? "pass" : "reject",
        message: hasTemplateAnalysis(analysis)
          ? "Template analysis framework check passed"
          : "Template analysis framework check failed"
      }
    },
    {
      ok: hasVerifiableSources(payload.sources),
      blocker: "Template check failed: sources must be primary and computationally verifiable — use live APIs, exact GitHub PR/issue/release URLs, explorer tx links, or spec docs",
      value: hasVerifiableSources(payload.sources) ? "pass" : "reject",
      diagnostic: {
        code: "template_source_verifiability",
        layer: "fact_check",
        status: hasVerifiableSources(payload.sources) ? "pass" : "reject",
        message: hasVerifiableSources(payload.sources)
          ? "Template source verifiability check passed"
          : "Template source verifiability check failed"
      }
    },
    {
      ok: !likelyTruncated && !overSoftLimit,
      blocker: overSoftLimit
        ? "Template check failed: body is above 900 characters — shorten it before filing so the live API does not clip the stored signal"
        : "Template check failed: body appears truncated near the submission limit — shorten it and end with complete terminal punctuation before filing",
      value: likelyTruncated || overSoftLimit ? "reject" : "pass",
      diagnostic: {
        code: "template_truncation_guard",
        layer: "format_mismatch",
        status: likelyTruncated || overSoftLimit ? "reject" : "pass",
        message: likelyTruncated || overSoftLimit
          ? "Template truncation guard failed"
          : "Template truncation guard passed"
      }
    }
  ];
}

function evaluateFactCheckerChecks(payload: CanonicalSignalPayload, reportDate: string): GuardCheckOutcome[] {
  const combinedText = `${payload.headline} ${payload.analysis}`;
  const claimTypes = detectClaimTypes(combinedText);
  const quantumBeat = isQuantumBeat(payload.beat_slug);
  const saturatedQuantum = quantumBeat && isSaturatedQuantumCluster(combinedText);
  const aibtcNativeQuantum = quantumBeat && isAibtcNativeQuantumAngle(combinedText);
  const missingQubitDistinction = quantumBeat && /\bqubits?\b/i.test(combinedText) && !hasLogicalPhysicalQubitDistinction(combinedText);
  const homepageLevelMetricSourceFailure = isMetricHeavyClaim(combinedText) && hasRepositoryRootSource(payload.sources);
  const needsIndependentVerifier = claimTypes.includes("price") || claimTypes.includes("security");
  const needsNumericAnchor = claimTypes.some((type) => ["price", "payout", "block_height", "count"].includes(type));
  const primaryPlatformEvidencePass =
    !needsIndependentVerifier &&
    payload.sources.length >= 2 &&
    hasStructuredPrimaryAnchor(payload.sources);
  const discussionOnlyQuantum = quantumBeat && isDiscussionOnlyQuantumSourceSet(payload.sources);
  const pullOnlyQuantum = quantumBeat && isPullOnlyQuantumSourceSet(payload.sources);
  const staleOpenStatusFailure = isStaleOpenStatusClaim(payload, reportDate);
  const sourceVerificationPass =
    payload.sources.length > 0 &&
    !discussionOnlyQuantum &&
    !pullOnlyQuantum &&
    !staleOpenStatusFailure &&
    !missingQubitDistinction &&
    !(saturatedQuantum && !aibtcNativeQuantum) &&
    !homepageLevelMetricSourceFailure &&
    (!isCircularSourcing(payload.sources) || primaryPlatformEvidencePass) &&
    (!needsIndependentVerifier || hasIndependentExternalSource(payload.sources)) &&
    (!(isMetricHeavyClaim(combinedText) && allSourcesFromSameOrg(payload.sources) && !primaryPlatformEvidencePass));
  const claimVerificationPass =
    (!needsNumericAnchor || /\d/.test(combinedText)) &&
    (!claimTypes.includes("security") || payload.sources.length >= 2) &&
    (!claimTypes.includes("routing_settlement") || hasStructuredPrimaryAnchor(payload.sources));

  const sourceVerificationMessage = !payload.sources.length
    ? "Fact-check source verification failed: no sources were provided"
    : discussionOnlyQuantum
      ? "Fact-check source verification failed: quantum filing relies only on discussion-thread sources without a maintainer-owned state artifact"
    : pullOnlyQuantum
      ? "Fact-check source verification failed: quantum filing uses PR pages without a commit, release, or spec artifact proving current implementation state"
    : staleOpenStatusFailure
      ? "Fact-check source verification failed: stale status-only PR/issue update — cite a fresh check (last 24-48h) or a new state change before filing"
    : missingQubitDistinction
      ? "Fact-check source verification failed: quantum filings that cite qubit counts must distinguish logical from physical qubits"
    : saturatedQuantum && !aibtcNativeQuantum
      ? "Fact-check source verification failed: saturated quantum clusters need a clearly AIBTC-native operator angle before filing"
    : homepageLevelMetricSourceFailure
      ? "Fact-check source verification failed: metric-heavy claims cannot rely on homepage-level or bare repository-root sources"
    : primaryPlatformEvidencePass
      ? "Fact-check source verification passed using structured primary platform evidence"
    : isCircularSourcing(payload.sources)
      ? "Fact-check source verification failed: sources are circular or project-only without verification anchor"
      : needsIndependentVerifier && !hasIndependentExternalSource(payload.sources)
        ? `Fact-check source verification failed: ${claimTypes.join(", ")} claims require an independent verifier`
        : isMetricHeavyClaim(combinedText) && allSourcesFromSameOrg(payload.sources)
          ? "Fact-check source verification failed: metric-heavy claim uses only one organization as evidence"
          : "Fact-check source verification passed";

  const claimVerificationMessage = needsNumericAnchor && !/\d/.test(combinedText)
    ? `Fact-check claim verification failed: ${claimTypes.join(", ")} claim needs an explicit hard number`
    : claimTypes.includes("security") && payload.sources.length < 2
      ? "Fact-check claim verification failed: security claims need both primary evidence and an independent confirmer"
      : claimTypes.includes("routing_settlement") && !hasStructuredPrimaryAnchor(payload.sources)
        ? "Fact-check claim verification failed: routing or settlement claim needs a reproducible primary anchor such as a release, issue, PR, or API path"
        : "Fact-check claim verification passed";

  return [
    {
      ok: sourceVerificationPass,
      blocker: sourceVerificationMessage,
      value: sourceVerificationPass ? "pass" : "reject",
      diagnostic: {
        code: "fact_check_source_verification",
        layer: "fact_check",
        status: sourceVerificationPass ? "pass" : "reject",
        message: sourceVerificationMessage
      }
    },
    {
      ok: claimVerificationPass,
      blocker: claimVerificationMessage,
      value: claimVerificationPass ? "pass" : "reject",
      diagnostic: {
        code: "fact_check_claim_verification",
        layer: "fact_check",
        status: claimVerificationPass ? "pass" : "reject",
        message: claimVerificationMessage
      }
    }
  ];
}

function buildDuplicateFirstResult(args: {
  reportDate: string;
  blockers: string[];
  diagnostics: SignalGuardDiagnostic[];
  briefMatch: string | null;
  priorBriefMatches: Array<{ date: string; line: string }>;
  approvedNotInBriefMatches: Array<{ date: string; headline: string }>;
  filedMatch: SignalGuardFiledSignalRecord | null;
}): SignalGuardResult {
  return {
    ok: false,
    reportDate: args.reportDate,
    blockers: args.blockers,
    checks: {
      currentBrief: args.briefMatch ? "reject" : "pass",
      priorBriefs: args.priorBriefMatches.length > 0 ? "reject" : "pass",
      priorApprovedNotInBrief: args.approvedNotInBriefMatches.length > 0 ? "reject_or_reframe" : "pass",
      priorMatchedRejection: args.filedMatch ? "repair_using_publisher_feedback" : "pass",
      editorGuidance: "skipped_due_to_duplicate",
      metricSourcing: "skipped_due_to_duplicate",
      factCheckerSourceVerification: "skipped_due_to_duplicate",
      factCheckerClaimVerification: "skipped_due_to_duplicate",
      circularSourcing: "skipped_due_to_duplicate",
      helperPayloadContract: "skipped_due_to_duplicate",
      editorialMemoryFreshness: "skipped_due_to_duplicate",
      winnerBar: "skipped_due_to_duplicate"
    },
    diagnostics: args.diagnostics,
    briefMatch: args.briefMatch,
    priorBriefMatches: args.priorBriefMatches,
    approvedNotInBriefMatches: args.approvedNotInBriefMatches,
    filedMatch: args.filedMatch ? {
      signalId: args.filedMatch.signalId ?? null,
      headline: args.filedMatch.headline ?? null,
      outcome: args.filedMatch.outcome ?? null,
      resolved: args.filedMatch.resolved ?? null
    } : null
  };
}

function getMissingFrameworkALabels(text: string): string[] {
  const required = ["CLAIM:", "EVIDENCE:", "IMPLICATION:"];
  return required.filter((label) => !new RegExp(`(^|\\n)${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text));
}

export async function evaluateSignalGuard(payload: SignalGuardPayload, baseDir?: string): Promise<SignalGuardResult> {
  const root = resolve(baseDir ?? process.cwd());
  const reportDate = payload.reportDate?.trim() || getPacificReportDate();
  const headline = payload.headline?.trim() || "";
  const body = payload.body?.trim() || "";
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const canonical = parseCanonicalSignalPayload({
    beat_slug: payload.beat_slug ?? "",
    headline,
    analysis: body,
    sources,
    tags: ["helper-runtime"],
    disclosure: [...(payload.model_disclosure?.tools_used ?? []), ...(payload.model_disclosure?.derivation_steps ?? [])].join("; ")
  }).payload;
  const briefPath = resolve(root, `data/briefs/${reportDate}.md`);
  const filedPath = resolve(root, "data/state/filed-signals.json");
  const [briefText, filedState, priorBriefMatches, approvedNotInBriefMatches, editorialMemory, repairMemory, sameDaySourceUrls] = await Promise.all([
    readFile(briefPath, "utf8").catch(() => ""),
    readJsonIfExists<{ filedSignals?: SignalGuardFiledSignalRecord[] }>(filedPath),
    loadRecentBriefMatches(reportDate, headline, 2, root),
    loadRecentApprovedNotInBriefMatches(reportDate, headline, 2, root),
    readJsonIfExists<EditorialMemorySnapshot>(resolve(root, "data/state/editorial-memory.json")),
    readJsonIfExists<{ contracts?: Array<{ feedbackMessage?: string; signalId?: string | null }> }>(
      resolve(root, "data/state/repairable-candidates.json")
    ),
    loadSameDaySourceUrls(root, reportDate)
  ]);
  const briefLines = briefText.split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter((line) => line.length >= 20);
  const briefMatch = briefLines.find((line) => isLikelySameStory(headline, line)) ?? null;
  const filedMatch = (filedState?.filedSignals ?? []).find((entry) => entry.headline ? isLikelySameStory(headline, entry.headline) : false) ?? null;

  const freshnessOutcome = evaluateMemoryFreshness(editorialMemory, reportDate);
  if (!freshnessOutcome.ok) {
    return {
      ok: false,
      reportDate,
      blockers: [freshnessOutcome.blocker!],
      checks: {
        currentBrief: "skipped_due_to_stale_memory",
        priorBriefs: "skipped_due_to_stale_memory",
        priorApprovedNotInBrief: "skipped_due_to_stale_memory",
        priorMatchedRejection: "skipped_due_to_stale_memory",
        editorGuidance: "skipped_due_to_stale_memory",
        metricSourcing: "skipped_due_to_stale_memory",
        factCheckerSourceVerification: "skipped_due_to_stale_memory",
        factCheckerClaimVerification: "skipped_due_to_stale_memory",
        circularSourcing: "skipped_due_to_stale_memory",
        helperPayloadContract: "skipped_due_to_stale_memory",
        editorialMemoryFreshness: "reject",
        winnerBar: "skipped_due_to_stale_memory"
      },
      diagnostics: [
        freshnessOutcome.diagnostic,
        { code: "editor_guidance_pipeline", layer: "editor_guidance", status: "skip", message: "Skipped due to stale editorial memory" },
        { code: "fact_check_source_verification", layer: "fact_check", status: "skip", message: "Skipped due to stale editorial memory" },
        { code: "fact_check_claim_verification", layer: "fact_check", status: "skip", message: "Skipped due to stale editorial memory" },
        { code: "format_payload_contract", layer: "format_mismatch", status: "skip", message: "Skipped due to stale editorial memory" }
      ],
      briefMatch: null,
      priorBriefMatches: [],
      approvedNotInBriefMatches: [],
      filedMatch: null
    };
  }

  const blockers: string[] = [];
  const diagnostics: SignalGuardDiagnostic[] = [];
  if (body && !hasTemplateAnalysis(body)) {
    const missingLabels = getMissingFrameworkALabels(body);
    blockers.push(
      missingLabels.length > 0
        ? `analysis must follow the signal template — missing ${missingLabels.join(", ")}`
        : "analysis must follow the signal template — use CLAIM / EVIDENCE / IMPLICATION / Directive or What changed / What it means / What to do"
    );
  }
  if (briefMatch) {
    blockers.push(`Headline looks already present in data/briefs/${reportDate}.md`);
    diagnostics.push({
      code: "duplicate_current_brief",
      layer: "duplicate",
      status: "reject",
      message: `Duplicate-first gate failed: same story shape already appears in data/briefs/${reportDate}.md`
    });
  }
  if (priorBriefMatches.length > 0) {
    blockers.push(`Headline looks too close to prior posted brief story shape in ${priorBriefMatches.map((match) => match.date).join(", ")}`);
    diagnostics.push({
      code: "duplicate_prior_brief",
      layer: "duplicate",
      status: "reject",
      message: `Duplicate-first gate failed: same story shape matches prior brief dates ${priorBriefMatches.map((match) => match.date).join(", ")}`
    });
  }
  if (filedMatch) {
    blockers.push(`Headline looks too close to already-filed signal ${filedMatch.signalId ?? "(unknown id)"}${filedMatch.outcome ? ` (${filedMatch.outcome})` : ""}`);
    diagnostics.push({
      code: "duplicate_filed_signal",
      layer: "duplicate",
      status: "reject",
      message: `Duplicate-first gate failed: same story shape matches already-filed signal ${filedMatch.signalId ?? "(unknown id)"}`
    });
  }
  if (approvedNotInBriefMatches.length > 0) {
    blockers.push(`Headline matches a prior approved_not_in_brief angle from ${approvedNotInBriefMatches.map((match) => match.date).join(", ")}; broaden or reframe before filing`);
    diagnostics.push({
      code: "duplicate_approved_not_in_brief",
      layer: "duplicate",
      status: "reject",
      message: `Duplicate-first gate failed: prior approved_not_in_brief angle already used on ${approvedNotInBriefMatches.map((match) => match.date).join(", ")}`
    });
  }
  const failureReason = matchedFailureReason(filedMatch, headline);
  if (failureReason && headline === (filedMatch?.headline ?? "")) {
    blockers.push(failureReason);
    diagnostics.push({
      code: "duplicate_prior_rejection_shape",
      layer: "duplicate",
      status: "reject",
      message: failureReason
    });
  }
  const candidateText = `${headline} ${body}`;
  if (hasAnchorCollision(candidateText, briefText)) {
    blockers.push(`Same story anchor already appears in data/briefs/${reportDate}.md`);
    diagnostics.push({
      code: "duplicate_brief_anchor_collision",
      layer: "duplicate",
      status: "reject",
      message: `Duplicate-first gate failed: story anchors already appear in data/briefs/${reportDate}.md`
    });
  }
  const editorialMemoryText = editorialMemory ? JSON.stringify(editorialMemory) : "";
  if (hasAnchorCollision(candidateText, editorialMemoryText)) {
    blockers.push("Same story anchor already appears in editorial memory or prior rejection context");
    diagnostics.push({
      code: "duplicate_editorial_memory_anchor_collision",
      layer: "duplicate",
      status: "reject",
      message: "Duplicate-first gate failed: story anchors already appear in editorial memory or prior rejection context"
    });
  }
  const repairCollision = (repairMemory?.contracts ?? []).find((contract) => typeof contract.feedbackMessage === "string" && hasAnchorCollision(candidateText, contract.feedbackMessage));
  if (repairCollision) {
    blockers.push(`Same story anchor already appears in repair memory${repairCollision.signalId ? ` for signal ${repairCollision.signalId}` : ""}`);
    diagnostics.push({
      code: "duplicate_repair_memory_anchor_collision",
      layer: "duplicate",
      status: "reject",
      message: `Duplicate-first gate failed: story anchors already appear in repair memory${repairCollision.signalId ? ` for signal ${repairCollision.signalId}` : ""}`
    });
  }
  const duplicateSameDaySourceUrls = sources
    .map((source) => normalizeSourceUrl(source.url?.trim() ?? ""))
    .filter((url) => url && sameDaySourceUrls.has(url));
  if (duplicateSameDaySourceUrls.length > 0) {
    blockers.push(`Duplicate same-day source cluster already exists for ${duplicateSameDaySourceUrls.join(", ")}; choose a materially different source cluster before filing`);
    diagnostics.push({
      code: "duplicate_same_day_source_cluster",
      layer: "duplicate",
      status: "reject",
      message: "Duplicate-first gate failed: source URL already appears in today's filing-ready artifacts"
    });
  }
  if (isClosedPullRequestProof(payload)) {
    blockers.push("Closed PR pages cannot be used as proof of a shipped change; cite a merged PR, commit, release, deployed endpoint, or durable spec artifact");
    diagnostics.push({
      code: "closed_pr_as_proof",
      layer: "fact_check",
      status: "reject",
      message: "Closed PR page used as proof without merged/shipped/released state evidence"
    });
  }

  if (blockers.length > 0) {
    diagnostics.push(
      {
        code: "editor_guidance_pipeline",
        layer: "editor_guidance",
        status: "skip",
        message: "Skipped because duplicate-first gate already failed"
      },
      {
        code: "fact_check_source_verification",
        layer: "fact_check",
        status: "skip",
        message: "Skipped because duplicate-first gate already failed"
      },
      {
        code: "fact_check_claim_verification",
        layer: "fact_check",
        status: "skip",
        message: "Skipped because duplicate-first gate already failed"
      },
      {
        code: "format_payload_contract",
        layer: "format_mismatch",
        status: "skip",
        message: "Skipped because duplicate-first gate already failed"
      }
    );
    return buildDuplicateFirstResult({
      reportDate,
      blockers,
      diagnostics,
      briefMatch,
      priorBriefMatches,
      approvedNotInBriefMatches,
      filedMatch
    });
  }

  const outcomes: GuardCheckOutcome[] = [];
  outcomes.push(evaluateFormatMismatch(payload));
  outcomes.push(freshnessOutcome);

  if (canonical) {
    outcomes.push(...evaluateTemplateChecks(canonical));
    outcomes.push(...evaluateFactCheckerChecks(canonical, reportDate));
  }

  for (const outcome of outcomes) {
    diagnostics.push(outcome.diagnostic);
    if (!outcome.ok && outcome.blocker) {
      blockers.push(outcome.blocker);
    }
  }
  const factCheckerOutcomes = canonical ? evaluateFactCheckerChecks(canonical, reportDate) : [];
  const factCheckerSourceVerification = factCheckerOutcomes[0] ?? null;
  const factCheckerClaimVerification = factCheckerOutcomes[1] ?? null;
  const formatCheck = outcomes[0];
  const freshnessCheck = outcomes[1];

  return {
    ok: blockers.length === 0,
    reportDate,
    blockers,
    checks: {
      currentBrief: briefMatch ? "reject" : "pass",
      priorBriefs: priorBriefMatches.length > 0 ? "reject" : "pass",
      priorApprovedNotInBrief: approvedNotInBriefMatches.length > 0 ? "reject_or_reframe" : "pass",
      priorMatchedRejection: failureReason ? "repair_using_publisher_feedback" : "pass",
      editorGuidance: "enforced_by_create_signal_and_beat_editor",
      metricSourcing: isMetricHeavyClaim(`${headline} ${body}`) && sources.length > 0 && allSourcesFromSameOrg(sources) ? "reject_or_rewrite" : "pass",
      factCheckerSourceVerification: factCheckerSourceVerification?.value ?? "reject",
      factCheckerClaimVerification: factCheckerClaimVerification?.value ?? "reject",
      circularSourcing: isCircularSourcing(sources) ? "reject" : "pass",
      helperPayloadContract: formatCheck.value,
      editorialMemoryFreshness: freshnessCheck.value,
      winnerBar: hasExactHeadlineAnchor(headline) && hasTemplateAnalysis(body) && hasVerifiableSources(sources) ? "pass" : "reject"
    },
    diagnostics,
    briefMatch,
    priorBriefMatches,
    approvedNotInBriefMatches,
    filedMatch: filedMatch ? {
      signalId: filedMatch.signalId ?? null,
      headline: filedMatch.headline ?? null,
      outcome: filedMatch.outcome ?? null,
      resolved: filedMatch.resolved ?? null
    } : null
  };
}
