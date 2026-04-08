import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { getPacificReportDate } from "../utils/report-date.js";
import { parseCanonicalSignalPayload, type CanonicalSignalPayload } from "./signal-contract.js";
import {
  hasConcreteDisclosureAnchors,
  hasExactHeadlineAnchor,
  hasTemplateAnalysis,
  hasTerminalDirective,
  hasVagueDisclosure
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
    | "publisher_q1"
    | "publisher_q2"
    | "publisher_q3"
    | "publisher_q4"
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

function hasDirectOperatorConsequence(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return [
    "agent", "agents", "operator", "operators", "publisher", "publishers", "correspondent", "correspondents",
    "relay", "relays", "node", "nodes", "filing", "brief", "payout", "settlement", "homepage", "ranking",
    "priority", "payment", "payments", "inbox"
  ].some((term) => normalized.includes(term));
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

function isMetricHeavyClaim(text: string): boolean {
  return /\b\d+(?:\.\d+)?%|\b\d[\d,]*(?:\+|x)?\b/.test(text.toLowerCase());
}

function hasMissionAlignment(text: string): boolean {
  const normalized = normalizeText(text);
  const bitcoinRail = /\bbitcoin\b|\bbtc\b|\bsbtc\b|\bstacks\b|\bstx\b|\bx402\b|\binscription\b|\bordinal\b/i.test(normalized);
  const aiOrNetworkActor = /\bai\b|\bagent\b|\bagents\b|\boperator\b|\boperators\b|\bapp\b|\bapps\b|\bcorrespondent\b|\bcorrespondents\b|\baibtc\b/i.test(normalized);
  const economicOrOperationalUse = /\buse\b|\bearn\b|\btransact\b|\bpayment\b|\bpayments\b|\bpayout\b|\bpayouts\b|\bsettlement\b|\bbrief\b|\branking\b|\binbox\b|\btransaction\b|\btransactions\b|\bindexable\b|\bblock production\b/i.test(normalized);
  return bitcoinRail && aiOrNetworkActor && economicOrOperationalUse;
}

function isInscribableNews(text: string): boolean {
  const normalized = normalizeText(text);
  const speculative = /\bsources say\b|\breportedly\b|\ballegedly\b|\brumored\b|\bcould soon\b|\bmay be planning\b|\bexpected to\b|\bunconfirmed\b/.test(normalized);
  const hasDevelopment = /\bissue\s+#\d+\b|\bpr\s+#\d+\b|\brelease\b|\bships\b|\bshipped\b|\bfix(?:es|ed)?\b|\bpatch(?:es|ed)?\b|\badds?\b|\brestores?\b|\breplaces?\b|\bactivates?\b|\bratifies?\b|\bshows\b|\blive\b|\blaunch(?:es|ed)?\b|\bopens?\b|\bcut(?:s)?\b/i.test(text);
  return !speculative && hasDevelopment;
}

function isValueCreating(text: string): boolean {
  const normalized = normalizeText(text);
  return /\bthis means\b|\bimplication\b|\bmatters because\b|\boperators need\b|\bagents should\b|\boperators should\b|\bwhich means\b|\bas a result\b|\bso that\b|\bchanges\b|\blowers\b|\bdelays\b|\benables\b|\bturns\b/i.test(normalized);
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

function extractStoryAnchors(text: string): string[] {
  return [...new Set([
    ...text.matchAll(/\bissue\s+#\d+\b/gi),
    ...text.matchAll(/\bpr\s+#\d+\b/gi),
    ...text.matchAll(/\bcve-\d{4}-\d+\b/gi),
    ...text.matchAll(/\bv\d+\.\d+(?:\.\d+)*(?:\.\d+)?\b/gi)
  ].map((match) => normalizeText(match[0])))];
}

function extractMetricAnchors(text: string): string[] {
  return [...new Set([
    ...text.matchAll(/\$\d[\d,]*(?:\.\d+)?/g),
    ...text.matchAll(/\b\d+(?:\.\d+)?%/g),
    ...text.matchAll(/\b\d+\s*(?:hours?|days?|cycles?|agents?|signals?|slots?)\b/gi),
    ...text.matchAll(/\b\d{2,}\s*sats?\b/gi)
  ].map((match) => normalizeText(match[0])))];
}

function hasVerifiableSources(sources: SourceRef[]): boolean {
  if (sources.length === 0) return false;
  return sources.every((source) => {
    const url = source.url?.trim() ?? "";
    const title = source.title?.trim() ?? "";
    if (!url || !title) return false;
    if (/twitter\.com|x\.com|medium\.com|substack\.com|coindesk\.com|cointelegraph\.com/i.test(url)) return false;
    return /https?:\/\/.+/.test(url) &&
      (/github\.com|\/api\/|explorer\.|releases\/tag\/|issues\/\d+|pull\/\d+|bip-\d+|docs\./i.test(url));
  });
}

function hasAnchorCollision(candidateText: string, contextText: string): boolean {
  const candidateAnchors = extractStoryAnchors(candidateText);
  if (candidateAnchors.length === 0) return false;
  const contextAnchors = extractStoryAnchors(contextText);
  const sharedAnchors = candidateAnchors.filter((anchor) => contextAnchors.includes(anchor));
  if (sharedAnchors.length === 0) return false;
  const candidateMetrics = extractMetricAnchors(candidateText);
  const contextMetrics = extractMetricAnchors(contextText);
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

function evaluatePublisherChecks(payload: CanonicalSignalPayload): GuardCheckOutcome[] {
  const combinedText = `${payload.headline} ${payload.analysis}`;
  const disclosure = payload.disclosure;

  return [
    {
      ok: hasMissionAlignment(combinedText),
      blocker: "Fails publisher Q1 mission-aligned test; broaden to show how AI agents use, earn, transact with, or govern Bitcoin or sBTC",
      value: hasMissionAlignment(combinedText) ? "pass" : "reject",
      diagnostic: {
        code: "publisher_q1_mission_alignment",
        layer: "publisher_q1",
        status: hasMissionAlignment(combinedText) ? "pass" : "reject",
        message: hasMissionAlignment(combinedText)
          ? "Publisher Q1 passed"
          : "Publisher Q1 failed: the signal does not clearly connect AI-native actors to Bitcoin, sBTC, Stacks, or x402 activity"
      }
    },
    {
      ok: !hasVagueDisclosure(disclosure) && hasConcreteDisclosureAnchors(disclosure),
      blocker: "Fails publisher Q2 replicable test; disclosure must name the specific model, endpoints, URLs, issues, PRs, releases, or queries used",
      value: !hasVagueDisclosure(disclosure) && hasConcreteDisclosureAnchors(disclosure) ? "pass" : "reject",
      diagnostic: {
        code: "publisher_q2_replicable",
        layer: "publisher_q2",
        status: !hasVagueDisclosure(disclosure) && hasConcreteDisclosureAnchors(disclosure) ? "pass" : "reject",
        message: !hasVagueDisclosure(disclosure) && hasConcreteDisclosureAnchors(disclosure)
          ? "Publisher Q2 passed"
          : "Publisher Q2 failed: disclosure is empty, vague, or not reproducible enough"
      }
    },
    {
      ok: isInscribableNews(combinedText),
      blocker: "Fails publisher Q3 inscribable test; speculative or stable-baseline framing is not suitable for permanent record",
      value: isInscribableNews(combinedText) ? "pass" : "reject",
      diagnostic: {
        code: "publisher_q3_inscribable",
        layer: "publisher_q3",
        status: isInscribableNews(combinedText) ? "pass" : "reject",
        message: isInscribableNews(combinedText)
          ? "Publisher Q3 passed"
          : "Publisher Q3 failed: the signal reads as speculative, baseline-only, or not like a durable development"
      }
    },
    {
      ok: isValueCreating(payload.analysis) && hasDirectOperatorConsequence(combinedText),
      blocker: "Fails publisher Q4 value-creating test; add a measurable operator, payout, settlement, routing, identity, or security consequence",
      value: isValueCreating(payload.analysis) && hasDirectOperatorConsequence(combinedText) ? "pass" : "reject",
      diagnostic: {
        code: "publisher_q4_value_creating",
        layer: "publisher_q4",
        status: isValueCreating(payload.analysis) && hasDirectOperatorConsequence(combinedText) ? "pass" : "reject",
        message: isValueCreating(payload.analysis) && hasDirectOperatorConsequence(combinedText)
          ? "Publisher Q4 passed"
          : "Publisher Q4 failed: the signal does not land a measurable AI-native economy consequence"
      }
    }
  ];
}

function evaluateTemplateChecks(payload: CanonicalSignalPayload): GuardCheckOutcome[] {
  const analysis = payload.analysis ?? "";
  const headline = payload.headline ?? "";

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
      ok: hasTemplateAnalysis(analysis) && hasTerminalDirective(analysis),
      blocker: "Template check failed: analysis must use CLAIM/EVIDENCE/IMPLICATION/Directive or What changed/What it means/What to do, and it must end with an operator directive",
      value: hasTemplateAnalysis(analysis) && hasTerminalDirective(analysis) ? "pass" : "reject",
      diagnostic: {
        code: "template_analysis_framework",
        layer: "format_mismatch",
        status: hasTemplateAnalysis(analysis) && hasTerminalDirective(analysis) ? "pass" : "reject",
        message: hasTemplateAnalysis(analysis) && hasTerminalDirective(analysis)
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
    }
  ];
}

function evaluateFactCheckerChecks(payload: CanonicalSignalPayload): GuardCheckOutcome[] {
  const combinedText = `${payload.headline} ${payload.analysis}`;
  const claimTypes = detectClaimTypes(combinedText);
  const needsIndependentVerifier = claimTypes.includes("price") || claimTypes.includes("security");
  const needsNumericAnchor = claimTypes.some((type) => ["price", "payout", "block_height", "count"].includes(type));
  const primaryPlatformEvidencePass =
    !needsIndependentVerifier &&
    payload.sources.length >= 2 &&
    hasStructuredPrimaryAnchor(payload.sources);
  const sourceVerificationPass =
    payload.sources.length > 0 &&
    (!isCircularSourcing(payload.sources) || primaryPlatformEvidencePass) &&
    (!needsIndependentVerifier || hasIndependentExternalSource(payload.sources)) &&
    (!(isMetricHeavyClaim(combinedText) && allSourcesFromSameOrg(payload.sources) && !primaryPlatformEvidencePass));
  const claimVerificationPass =
    (!needsNumericAnchor || /\d/.test(combinedText)) &&
    (!claimTypes.includes("security") || payload.sources.length >= 2) &&
    (!claimTypes.includes("routing_settlement") || hasStructuredPrimaryAnchor(payload.sources));

  const sourceVerificationMessage = !payload.sources.length
    ? "Fact-check source verification failed: no sources were provided"
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
      directOperatorConsequence: "skipped_due_to_duplicate",
      missionAlignment: "skipped_due_to_duplicate",
      publisherQ1: "skipped_due_to_duplicate",
      publisherQ2: "skipped_due_to_duplicate",
      publisherQ3: "skipped_due_to_duplicate",
      publisherQ4: "skipped_due_to_duplicate",
      metricSourcing: "skipped_due_to_duplicate",
      factCheckerSourceVerification: "skipped_due_to_duplicate",
      factCheckerClaimVerification: "skipped_due_to_duplicate",
      vagueDisclosure: "skipped_due_to_duplicate",
      inscribable: "skipped_due_to_duplicate",
      valueCreating: "skipped_due_to_duplicate",
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

function hasStructuredAnalysis(text: string): boolean {
  const lower = text.toLowerCase();
  const hasClaim = /\bclaim\s*:/.test(lower);
  const hasEvidence = /\bevidence\s*:/.test(lower) &&
    /(#\d+|0x[0-9a-f]+|block\s*\d{6,}|\d[\d,]+\s*sats|\d[\d,.]+\s*stx|arxiv|cve-\d)/i.test(text);
  const hasImplication = /\bimplication\s*:/.test(lower) &&
    /\b(update|upgrade|avoid|redeploy|watch|pause|check|migrate|monitor)\b/i.test(text);
  return hasClaim && hasEvidence && hasImplication;
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
  const [briefText, filedState, priorBriefMatches, approvedNotInBriefMatches, editorialMemory, repairMemory] = await Promise.all([
    readFile(briefPath, "utf8").catch(() => ""),
    readJsonIfExists<{ filedSignals?: SignalGuardFiledSignalRecord[] }>(filedPath),
    loadRecentBriefMatches(reportDate, headline, 2, root),
    loadRecentApprovedNotInBriefMatches(reportDate, headline, 2, root),
    readJsonIfExists<EditorialMemorySnapshot>(resolve(root, "data/state/editorial-memory.json")),
    readJsonIfExists<{ contracts?: Array<{ feedbackMessage?: string; signalId?: string | null }> }>(
      resolve(root, "data/state/repairable-candidates.json")
    )
  ]);
  const briefLines = briefText.split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter((line) => line.length >= 20);
  const briefMatch = briefLines.find((line) => isLikelySameStory(headline, line)) ?? null;
  const filedMatch = (filedState?.filedSignals ?? []).find((entry) => entry.headline ? isLikelySameStory(headline, entry.headline) : false) ?? null;

  const blockers: string[] = [];
  const diagnostics: SignalGuardDiagnostic[] = [];
  if (body && !hasTemplateAnalysis(body)) {
    blockers.push("analysis must follow the signal template — use CLAIM / EVIDENCE / IMPLICATION / Directive or What changed / What it means / What to do");
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

  if (blockers.length > 0) {
    diagnostics.push(
      {
        code: "publisher_q1_mission_alignment",
        layer: "publisher_q1",
        status: "skip",
        message: "Skipped because duplicate-first gate already failed"
      },
      {
        code: "publisher_q2_replicable",
        layer: "publisher_q2",
        status: "skip",
        message: "Skipped because duplicate-first gate already failed"
      },
      {
        code: "publisher_q3_inscribable",
        layer: "publisher_q3",
        status: "skip",
        message: "Skipped because duplicate-first gate already failed"
      },
      {
        code: "publisher_q4_value_creating",
        layer: "publisher_q4",
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
      },
      {
        code: "stale_editorial_memory_cycle",
        layer: "stale_memory",
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
  outcomes.push(evaluateMemoryFreshness(editorialMemory, reportDate));

  if (canonical) {
    outcomes.push(...evaluatePublisherChecks(canonical));
    outcomes.push(...evaluateTemplateChecks(canonical));
    outcomes.push(...evaluateFactCheckerChecks(canonical));
  }

  for (const outcome of outcomes) {
    diagnostics.push(outcome.diagnostic);
    if (!outcome.ok && outcome.blocker) {
      blockers.push(outcome.blocker);
    }
  }

  const disclosure = [...(payload.model_disclosure?.tools_used ?? []), ...(payload.model_disclosure?.derivation_steps ?? [])].join(" ");

  const missionAlignment = hasMissionAlignment(`${headline} ${body}`);
  const replicable = !hasVagueDisclosure(disclosure) && hasConcreteDisclosureAnchors(disclosure);
  const inscribable = isInscribableNews(`${headline} ${body}`);
  const valueCreating = canonical ? isValueCreating(canonical.analysis) && hasDirectOperatorConsequence(`${headline} ${body}`) : false;
  const factCheckerSourceVerification = canonical ? evaluateFactCheckerChecks(canonical)[0] : null;
  const factCheckerClaimVerification = canonical ? evaluateFactCheckerChecks(canonical)[1] : null;
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
      directOperatorConsequence: hasDirectOperatorConsequence(`${headline} ${body}`) ? "pass" : "reject",
      missionAlignment: missionAlignment ? "pass" : "reject",
      publisherQ1: missionAlignment ? "pass" : "reject",
      publisherQ2: replicable ? "pass" : "reject",
      publisherQ3: inscribable ? "pass" : "reject",
      publisherQ4: valueCreating ? "pass" : "reject",
      metricSourcing: isMetricHeavyClaim(`${headline} ${body}`) && sources.length > 0 && allSourcesFromSameOrg(sources) ? "reject_or_rewrite" : "pass",
      factCheckerSourceVerification: factCheckerSourceVerification?.value ?? "reject",
      factCheckerClaimVerification: factCheckerClaimVerification?.value ?? "reject",
      vagueDisclosure: replicable ? "pass" : "reject",
      inscribable: inscribable ? "pass" : "reject",
      valueCreating: valueCreating ? "pass" : "reject",
      circularSourcing: isCircularSourcing(sources) ? "reject" : "pass",
      helperPayloadContract: formatCheck.value,
      editorialMemoryFreshness: freshnessCheck.value,
      winnerBar: hasExactHeadlineAnchor(headline) && hasTemplateAnalysis(body) && hasTerminalDirective(body) && hasVerifiableSources(sources) ? "pass" : "reject"
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
