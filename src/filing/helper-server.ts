import { createServer, type IncomingMessage } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeUnsignedContractCall, noneCV, Pc, principalCV, uintCV } from "@stacks/transactions";
import { generateOperatorSignabilityPreflight, recordHelperWalletSession, saveOperatorSignabilityPreflight } from "./preflight.js";
import { recordFiledSignal } from "./state.js";
import { evaluateSignalGuard } from "./signal-guard.js";
import { getPacificReportDate } from "../utils/report-date.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

interface FiledSignalRecord {
  signalId?: string | null;
  headline?: string | null;
  beat?: string | null;
  resolved?: boolean;
  outcome?: string;
}

interface SourceRef {
  url?: string;
  title?: string;
}

interface ModelDisclosurePayload {
  tools_used?: string[];
  derivation_steps?: string[];
}

function normalizeGuardReportDate(input?: string | null): string {
  const pacificToday = getPacificReportDate();
  const requested = input?.trim();
  if (!requested) return pacificToday;
  return requested > pacificToday ? pacificToday : requested;
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

function computeTokenOverlap(a: string, b: string): {
  overlapCount: number;
  overlapRatio: number;
} {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  const sharedTokens = [...tokensA].filter((token) => tokensB.has(token));
  const denominator = Math.max(tokensA.size, tokensB.size, 1);
  return {
    overlapCount: sharedTokens.length,
    overlapRatio: sharedTokens.length / denominator
  };
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
    "agent",
    "agents",
    "operator",
    "operators",
    "publisher",
    "publishers",
    "correspondent",
    "correspondents",
    "relay",
    "relays",
    "node",
    "nodes",
    "filing",
    "brief",
    "payout",
    "settlement",
    "homepage",
    "ranking",
    "priority",
    "payment",
    "payments",
    "inbox"
  ].some((term) => normalized.includes(term));
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isMetricHeavyClaim(text: string): boolean {
  const normalized = text.toLowerCase();
  return /\b\d+(?:\.\d+)?%|\b\d[\d,]*(?:\+|x)?\b/.test(normalized);
}

function hasVagueDisclosure(body: string): boolean {
  const lower = body.toLowerCase();
  return [
    "used ai", "my own analysis", "various sources", "internal data",
    "used llm", "ai generated", "model output", "my analysis"
  ].some((pattern) => lower.includes(pattern));
}

function hasConcreteDisclosureAnchors(disclosure: string): boolean {
  if (disclosure.trim().length < 24) return false;
  return (
    /\b(?:claude|gpt|grok|gemini|opus|sonnet|haiku)\b/i.test(disclosure) ||
    /\b(?:curl|rg|npm|node|bun|gh|api|endpoint|query|search)\b/i.test(disclosure) ||
    /\/api\/|https?:\/\/|github\.com|issue\s+#\d+|pr\s+#\d+|release/i.test(disclosure)
  );
}

function hasMissionAlignment(text: string): boolean {
  const normalized = normalizeText(text);
  const bitcoinRail =
    /\bbitcoin\b|\bbtc\b|\bsbtc\b|\bstacks\b|\bstx\b|\bx402\b|\binscription\b|\bordinal\b/i.test(normalized);
  const aiOrNetworkActor =
    /\bai\b|\bagent\b|\bagents\b|\boperator\b|\boperators\b|\bapp\b|\bapps\b|\bcorrespondent\b|\bcorrespondents\b|\baibtc\b/i.test(normalized);
  const economicOrOperationalUse =
    /\buse\b|\bearn\b|\btransact\b|\bpayment\b|\bpayments\b|\bpayout\b|\bpayouts\b|\bsettlement\b|\bbrief\b|\branking\b|\binbox\b|\btransaction\b|\btransactions\b|\bindexable\b|\bblock production\b/i.test(normalized);

  return bitcoinRail && aiOrNetworkActor && economicOrOperationalUse;
}

function isInscribableNews(text: string): boolean {
  const normalized = normalizeText(text);
  const speculative =
    /\bsources say\b|\breportedly\b|\ballegedly\b|\brumored\b|\bcould soon\b|\bmay be planning\b|\bexpected to\b|\bunconfirmed\b/.test(normalized);
  const hasDevelopment =
    /\bissue\s+#\d+\b|\bpr\s+#\d+\b|\brelease\b|\bships\b|\bshipped\b|\bfix(?:es|ed)?\b|\bpatch(?:es|ed)?\b|\badds?\b|\brestores?\b|\breplaces?\b|\bactivates?\b|\bratifies?\b|\bshows\b|\blive\b|\blaunch(?:es|ed)?\b|\bopens?\b|\bcut(?:s)?\b/i.test(text);

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
  const internalPatterns = ["aibtc.com", "aibtc.news", "localhost", "127.0.0.1"];
  return urls.every((url) => internalPatterns.some((pattern) => url.includes(pattern)));
}

function allSourcesFromSameOrg(sources: SourceRef[]): boolean {
  const domains = [...new Set(
    sources
      .map((source) => extractDomain(source.url ?? ""))
      .filter((domain): domain is string => Boolean(domain))
      .map((domain) => domain.split(".").slice(-2).join("."))
  )];

  return domains.length === 1 && domains[0].length > 0;
}

function extractStoryAnchors(text: string): string[] {
  const matches = [
    ...text.matchAll(/\bissue\s+#\d+\b/gi),
    ...text.matchAll(/\bpr\s+#\d+\b/gi),
    ...text.matchAll(/\bcve-\d{4}-\d+\b/gi),
    ...text.matchAll(/\bv\d+\.\d+(?:\.\d+)*(?:\.\d+)?\b/gi)
  ].map((match) => normalizeText(match[0]));

  return [...new Set(matches)];
}

function extractMetricAnchors(text: string): string[] {
  const matches = [
    ...text.matchAll(/\$\d[\d,]*(?:\.\d+)?/g),
    ...text.matchAll(/\b\d+(?:\.\d+)?%/g),
    ...text.matchAll(/\b\d+\s*(?:hours?|days?|cycles?|agents?|signals?|slots?)\b/gi),
    ...text.matchAll(/\b\d{2,}\s*sats?\b/gi)
  ].map((match) => normalizeText(match[0]));

  return [...new Set(matches)];
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
    return names
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
      .map((name) => name.replace(/\.md$/, ""))
      .sort();
  } catch {
    return [];
  }
}

async function loadRecentBriefMatches(reportDate: string, headline: string, limit = 2): Promise<Array<{ date: string; line: string }>> {
  const briefDir = resolve(process.cwd(), "data/briefs");
  const dates = await listMarkdownDates(briefDir);
  const priorDates = dates.filter((date) => date < reportDate).slice(-limit).reverse();
  const matches: Array<{ date: string; line: string }> = [];

  for (const date of priorDates) {
    const briefText = await readFile(resolve(briefDir, `${date}.md`), "utf8").catch(() => "");
    const lines = briefText
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length >= 20);
    const match = lines.find((line) => isLikelySameStory(headline, line));
    if (match) {
      matches.push({ date, line: match });
    }
  }

  return matches;
}

async function loadRecentApprovedNotInBriefMatches(reportDate: string, headline: string, limit = 2): Promise<Array<{ date: string; headline: string }>> {
  const reportDir = resolve(process.cwd(), "data/reports/daily");
  const dates = await listMarkdownDates(reportDir);
  const priorDates = dates.filter((date) => date < reportDate).slice(-limit).reverse();
  const matches: Array<{ date: string; headline: string }> = [];

  for (const date of priorDates) {
    const reportText = await readFile(resolve(reportDir, `${date}.md`), "utf8").catch(() => "");
    let currentHeadline: string | null = null;
    let currentStatus: string | null = null;

    for (const rawLine of reportText.split("\n")) {
      const line = rawLine.trim();
      if (line.startsWith("headline: ")) {
        currentHeadline = line.slice("headline: ".length).trim();
      } else if (line.startsWith("status: ")) {
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

function matchedFailureReason(entry: FiledSignalRecord | null, headline: string): string | null {
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
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function parseArgs(argv: string[]): { port: number } {
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.set(key, "true");
      continue;
    }

    parsed.set(key, next);
    index += 1;
  }

  return {
    port: Number(parsed.get("port") ?? "4173")
  };
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function proxyJsonRequest(
  targetUrl: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {}
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: string;
}> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal
    });

    const body = await response.text();
    const headers: Record<string, string> = {};
    for (const [key, value] of response.headers.entries()) {
      headers[key] = value;
    }

    return {
      status: response.status,
      headers,
      body
    };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      const timeoutSeconds = Math.round(timeoutMs / 1000);
      throw new Error(
        `Upstream request to ${targetUrl} timed out after ${timeoutSeconds}s. ` +
        "The helper aborted the slow request before AIBTC returned a response."
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function serveStatic(pathname: string): Promise<{ status: number; body: Buffer; contentType: string }> {
  const root = resolve(process.cwd(), "tools/xverse-register");
  const relativePath = pathname === "/" ? "/index.html" : pathname.replace(/^\/tools\/xverse-register/, "") || "/index.html";
  const safePath = normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath.startsWith("/") ? safePath.slice(1) : safePath);
  const body = await readFile(filePath);
  const contentType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
  return { status: 200, body, contentType };
}

async function syncEditorialMemoryCycleDate(): Promise<void> {
  const memPath = resolve(process.cwd(), "data/state/editorial-memory.json");
  try {
    const raw = await readFile(memPath, "utf8");
    const mem = JSON.parse(raw) as { currentCycle?: { reportDate?: string } };
    const today = getPacificReportDate();
    const current = mem?.currentCycle?.reportDate;
    if (current && current < today) {
      mem.currentCycle!.reportDate = today;
      await writeFile(memPath, JSON.stringify(mem, null, 2), "utf8");
      process.stdout.write(
        `[filing-helper] WARN: editorial-memory currentCycle.reportDate was ${current}, auto-corrected to ${today}\n`
      );
    }
  } catch {
    // Non-fatal — missing or malformed editorial-memory.json; skip silently
  }
}

export async function startFilingHelperServer(port: number): Promise<void> {
  const serverStartedAt = new Date().toISOString();
  await mkdir(resolve(process.cwd(), "data/filing-results"), { recursive: true });
  await syncEditorialMemoryCycleDate();

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

      if (req.method === "GET" && url.pathname === "/api/local/filing-ready") {
        const reportDate = url.searchParams.get("date");
        const candidateId = url.searchParams.get("candidate");

        if (!reportDate || !candidateId) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify(
              {
                error: "Missing required date and candidate query params."
              },
              null,
              2
            )
          );
          return;
        }

        const artifactPath = resolve(
          process.cwd(),
          `data/filing-ready/${reportDate}/${candidateId}.json`
        );
        const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as unknown;

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ artifactPath, artifact }, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/filed-signal") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          reportDate?: string;
          candidateId: string;
          signalId: string;
          filedAt?: string;
          headline?: string | null;
          beat?: string | null;
          apiResponse?: unknown;
        };

        const result = await recordFiledSignal({
          reportDate: payload.reportDate,
          candidateId: payload.candidateId,
          signalId: payload.signalId,
          filedAt: payload.filedAt,
          headline: payload.headline,
          beat: payload.beat,
          apiResponse: payload.apiResponse
        });

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/signal-guard") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          reportDate?: string | null;
          headline?: string | null;
          beat_slug?: string | null;
          body?: string | null;
          sources?: SourceRef[] | null;
          model_disclosure?: ModelDisclosurePayload | null;
          enforceWinnerBar?: boolean | null;
        };

        const guard = await evaluateSignalGuard({
          ...payload,
          reportDate: normalizeGuardReportDate(payload.reportDate),
          enforceWinnerBar: payload.enforceWinnerBar ?? true
        });

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(guard, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/signal-submit") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          apiUrl?: string | null;
          headers?: Record<string, string> | null;
          payload?: unknown;
        };

        const apiUrl = payload.apiUrl?.trim() || "https://aibtc.news/api/signals";
        const upstream = await proxyJsonRequest(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(payload.headers ?? {})
          },
          body: JSON.stringify(payload.payload ?? {}),
          timeoutMs: 40_000
        });

        let parsedBody: unknown = null;
        try {
          parsedBody = upstream.body ? JSON.parse(upstream.body) : null;
        } catch {
          parsedBody = upstream.body;
        }

        res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify(
            {
              status: upstream.status,
              ok: upstream.status >= 200 && upstream.status < 300,
              headers: upstream.headers,
              body: parsedBody
            },
            null,
            2
          )
        );
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/signing-preflight/session") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          activeWalletAddress?: string | null;
          walletProviderReady?: boolean;
          helperPath?: string | null;
        };

        const sessionPath = await recordHelperWalletSession({
          activeWalletAddress: payload.activeWalletAddress ?? null,
          walletProviderReady: payload.walletProviderReady ?? false,
          helperPath: payload.helperPath ?? null
        });

        const state = await generateOperatorSignabilityPreflight({
          reportDate: null,
          candidateId: null
        });
        const preflightPath = await saveOperatorSignabilityPreflight(state);

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ sessionPath, preflightPath, state }, null, 2));
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/local/signing-preflight") {
        const reportDate = url.searchParams.get("date");
        const candidateId = url.searchParams.get("candidate");
        const state = await generateOperatorSignabilityPreflight({
          reportDate,
          candidateId
        });
        const preflightPath = await saveOperatorSignabilityPreflight(state);

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ preflightPath, state }, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/inbox/probe") {
        const raw = await readRequestBody(req);
        const upstream = await proxyJsonRequest(
          "https://aibtc.com/api/inbox/bc1qyu22hyqr406pus0g9jmfytk4ss5z8qsje74l76",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: raw
          }
        );

        res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify(
            {
              status: upstream.status,
              headers: upstream.headers,
              body: upstream.body ? JSON.parse(upstream.body) : null
            },
            null,
            2
          )
        );
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/inbox/send") {
        const raw = await readRequestBody(req);
        const paymentSignature = req.headers["payment-signature"];
        const upstream = await proxyJsonRequest(
          "https://aibtc.com/api/inbox/bc1qyu22hyqr406pus0g9jmfytk4ss5z8qsje74l76",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(typeof paymentSignature === "string"
                ? { "payment-signature": paymentSignature }
                : {})
            },
            body: raw
          }
        );

        res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify(
            {
              status: upstream.status,
              headers: upstream.headers,
              body: upstream.body ? JSON.parse(upstream.body) : null
            },
            null,
            2
          )
        );
        return;
      }

      // ── Editor review queue ───────────────────────────────────────────────
      // P22: Human-assisted BIP-137 POST flow for editor annotations.
      // The operator loads /api/local/editor-review/queue in the browser (Xverse
      // available), signs the payload with their BTC address, and the result is
      // forwarded to POST /api/signals/{id}/corrections on aibtc.news.

      if (req.method === "GET" && url.pathname === "/api/local/editor-review/queue") {
        const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
        const { readFile: fsReadFile } = await import("node:fs/promises");
        const { resolve: fsResolve } = await import("node:path");
        let annotations: unknown[] = [];
        try {
          const queuePath = fsResolve(process.cwd(), `data/editor/submitted/${date}.json`);
          annotations = JSON.parse(await fsReadFile(queuePath, "utf8")) as unknown[];
        } catch { /* no pending annotations */ }
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ date, count: annotations.length, annotations }, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/editor-review/submit") {
        // Payload: { signalId, annotationPayload, btcAddress, signature? }
        // The browser extension provides the BTC address; signature is optional until
        // BIP-137 auth lands on the aibtc.news corrections endpoint.
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          signalId: string;
          btcAddress: string;
          annotationPayload: Record<string, unknown>;
          signature?: string;
        };

        if (!payload.signalId || !payload.btcAddress || !payload.annotationPayload) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Missing signalId, btcAddress, or annotationPayload." }, null, 2));
          return;
        }

        const NEWS_API_BASE = "https://aibtc.news/api";
        const upstream = await fetch(`${NEWS_API_BASE}/signals/${payload.signalId}/corrections`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(payload.signature ? { "X-BTC-Signature": payload.signature } : {}),
            "X-BTC-Address": payload.btcAddress
          },
          body: JSON.stringify({
            ...payload.annotationPayload,
            type: "editorial_review"
          })
        });

        const upstreamBody = await upstream.text().catch(() => "");
        res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
        res.end(upstreamBody || JSON.stringify({ status: upstream.status }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/local/hiro/account") {
        const address = url.searchParams.get("address");
        if (!address) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Missing address query param." }, null, 2));
          return;
        }

        const upstream = await proxyJsonRequest(`https://api.hiro.so/v2/accounts/${address}?proof=0`);
        res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
        res.end(upstream.body);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/inbox/build-payment") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          publicKey?: string;
          stxAddress?: string;
          paymentChallenge?: {
            accepts?: Array<{
              amount: string;
              asset: string;
              payTo: string;
            }>;
          };
        };

        const publicKey = payload.publicKey?.trim();
        const stxAddress = payload.stxAddress?.trim();
        const accept = payload.paymentChallenge?.accepts?.[0];

        if (!publicKey || !stxAddress || !accept) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify(
              {
                error: "Missing publicKey, stxAddress, or paymentChallenge.accepts[0]."
              },
              null,
              2
            )
          );
          return;
        }

        const account = await proxyJsonRequest(`https://api.hiro.so/v2/accounts/${stxAddress}?proof=0`);
        const accountPayload = account.body ? JSON.parse(account.body) as { nonce?: number | string } : {};
        const nonce = BigInt(accountPayload.nonce ?? 0);
        const amount = BigInt(accept.amount);
        const [contractAddress, contractName = "sbtc-token"] = accept.asset.split(".");

        const transaction = await makeUnsignedContractCall({
          publicKey,
          contractAddress,
          contractName,
          functionName: "transfer",
          functionArgs: [
            uintCV(amount),
            principalCV(stxAddress),
            principalCV(accept.payTo),
            noneCV()
          ],
          fee: 0n,
          nonce,
          sponsored: true,
          postConditions: [
            Pc.principal(stxAddress)
              .willSendEq(amount)
              .ft(accept.asset as `${string}.${string}`, contractName)
          ],
          postConditionMode: "deny"
        });

        const txHex = Buffer.from(transaction.serialize()).toString("hex");

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify(
            {
              txHex,
              nonce: nonce.toString(),
              amount: amount.toString(),
              contractAddress,
              contractName
            },
            null,
            2
          )
        );
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/local/health") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, startedAt: serverStartedAt, pacificDate: getPacificReportDate(), pid: process.pid, port }, null, 2));
        return;
      }

      const { status, body, contentType } = await serveStatic(url.pathname);
      res.writeHead(status, { "Content-Type": contentType });
      res.end(body);
    } catch (error) {
      const status = (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify(
          {
            error: (error as Error).message
          },
          null,
          2
        )
      );
    }
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        rejectPromise(
          new Error(
            `[filing-helper] Port ${port} is already in use — a stale helper process is still running.\n` +
            `Kill it first: lsof -ti tcp:${port} | xargs kill -9\n` +
            `Then restart: npm run filing-helper`
          )
        );
      } else {
        rejectPromise(err);
      }
    });
    server.listen(port, "127.0.0.1", () => resolvePromise());
  });

  process.stdout.write(
    `[filing-helper] serving Xverse helper at http://127.0.0.1:${port}/tools/xverse-register/file-signal.html\n`
  );
}

async function main(): Promise<void> {
  const { port } = parseArgs(process.argv.slice(2));
  await startFilingHelperServer(port);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
