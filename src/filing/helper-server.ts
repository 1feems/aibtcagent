import { createServer, type IncomingMessage } from "node:http";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recordFiledSignal } from "./state.js";
import { advanceDispatchQueue, markCandidateSigned } from "./staggered-dispatch.js";
import { resolveLiveReadyArtifactPath } from "./artifacts.js";
import { detectRepoModeIntent, resolveRepoModeSubmission } from "./repo-mode.js";
import { evaluateSignalGuard } from "./signal-guard.js";
import { parseCanonicalSignalPayload } from "./signal-contract.js";
import {
  generateOperatorSignabilityPreflight,
  saveOperatorSignabilityPreflight
} from "./preflight.js";
import { refreshEditorialMemory } from "../learning/editorial-memory.js";
import { validateSignalLoopWorkflowContext } from "./workflow-context.js";
function getUtcReportDate(input: string | Date = new Date()): string {
  const value = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(value.getTime())) {
    throw new Error(`Invalid date input: ${String(input)}`);
  }
  return value.toISOString().slice(0, 10);
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const UPSTREAM_SUBMIT_TIMEOUT_MS = 90_000;
const AIBTC_API_BASE = "https://aibtc.news/api";

type LiveSignal = {
  id: string;
  headline: string;
  created_at: string;
  beat: string;
  status: string;
};

type FilingStatusResult = {
  ok: boolean;
  source: "live-signal-feed";
  checkedAt: string;
  btcAddress: string;
  canFileSignal: boolean;
  waitMinutes: number;
  cooldownEndsAt: string | null;
  latestSignal: LiveSignal | null;
};

type HelperErrorRecord = {
  recordedAt: string;
  stage:
    | "request_validation"
    | "cooldown_precheck"
    | "payload_normalization"
    | "signal_guard"
    | "upstream_response"
    | "upstream_fetch"
    | "handler_exception";
  helperCategory: "payload_issue" | "cooldown_issue" | "beat_issue" | "timeout_issue" | "server_issue";
  message: string;
  details?: unknown;
  apiUrl?: string | null;
  btcAddress?: string | null;
  beatSlug?: string | null;
  headline?: string | null;
  status?: number | null;
};

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

async function serveStatic(pathname: string): Promise<{ status: number; body: Buffer; contentType: string }> {
  if (pathname === "/favicon.ico" || pathname === "/tools/xverse-register/favicon.ico") {
    return {
      status: 204,
      body: Buffer.alloc(0),
      contentType: "image/x-icon"
    };
  }

  const root = resolve(process.cwd(), "tools/xverse-register");
  const relativePath = pathname === "/" ? "/index.html" : pathname.replace(/^\/tools\/xverse-register/, "") || "/index.html";
  const safePath = normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath.startsWith("/") ? safePath.slice(1) : safePath);
  const body = await readFile(filePath);
  const contentType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
  return { status: 200, body, contentType };
}

function parseSignalArray(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj?.signals)) return obj.signals as Array<Record<string, unknown>>;
  return [];
}

function normalizeHeadline(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toLiveSignal(raw: Record<string, unknown>): LiveSignal {
  return {
    id: String(raw.id ?? raw.signal_id ?? raw.signalId ?? ""),
    headline: String(raw.headline ?? ""),
    created_at: String(raw.created_at ?? raw.submitted_at ?? raw.submittedAt ?? raw.timestamp ?? ""),
    beat: String(raw.beat ?? raw.beat_slug ?? ""),
    status: String(raw.status ?? "")
  };
}

async function fetchRecentSignalsForAgent(agent: string): Promise<LiveSignal[]> {
  const url = `${AIBTC_API_BASE}/signals?agent=${encodeURIComponent(agent)}&limit=20`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`AIBTC recent-signal lookup failed with HTTP ${response.status}`);
  }
  const body = await response.json() as unknown;
  return parseSignalArray(body).map((item) => toLiveSignal(item));
}

function inferFilingStatus(agent: string, signals: LiveSignal[], now = new Date()): FilingStatusResult {
  const latestSignal = [...signals]
    .filter((signal) => signal.id && signal.created_at)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;

  if (!latestSignal) {
    return {
      ok: true,
      source: "live-signal-feed",
      checkedAt: now.toISOString(),
      btcAddress: agent,
      canFileSignal: true,
      waitMinutes: 0,
      cooldownEndsAt: null,
      latestSignal: null
    };
  }

  const latestCreatedAt = Date.parse(latestSignal.created_at);
  const cooldownMs = 60 * 60 * 1000;
  const remainingMs = Math.max(0, latestCreatedAt + cooldownMs - now.getTime());
  const waitMinutes = Math.ceil(remainingMs / 60_000);

  return {
    ok: true,
    source: "live-signal-feed",
    checkedAt: now.toISOString(),
    btcAddress: agent,
    canFileSignal: waitMinutes === 0,
    waitMinutes,
    cooldownEndsAt: waitMinutes > 0 ? new Date(latestCreatedAt + cooldownMs).toISOString() : null,
    latestSignal
  };
}

async function checkNewsStatus(agent: string): Promise<FilingStatusResult> {
  const signals = await fetchRecentSignalsForAgent(agent);
  return inferFilingStatus(agent, signals);
}

function getHelperErrorLogPath(root = process.cwd()): string {
  return resolve(root, "data/state/helper-errors.jsonl");
}

async function recordHelperError(entry: Omit<HelperErrorRecord, "recordedAt">, root = process.cwd()): Promise<string> {
  const logPath = getHelperErrorLogPath(root);
  await mkdir(resolve(root, "data/state"), { recursive: true });
  await appendFile(logPath, JSON.stringify({
    recordedAt: new Date().toISOString(),
    ...entry
  }) + "\n", "utf8");
  return logPath;
}

function buildNormalizedSignalPayload(rawPayload: unknown, btcAddress: string, baseDir = process.cwd()) {
  const { payload, issues } = parseCanonicalSignalPayload(rawPayload);
  const root = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
    ? rawPayload as Record<string, unknown>
    : null;
  const workflowContext = root && root.workflow_context && typeof root.workflow_context === "object" && !Array.isArray(root.workflow_context)
    ? root.workflow_context as Record<string, unknown>
    : null;
  const workflowReportDate = workflowContext && typeof workflowContext.reportDate === "string"
    ? workflowContext.reportDate.trim()
    : "";

  if (!workflowReportDate) {
    issues.push({
      code: "format_missing_workflow_context",
      reason: "helper-ready payload is missing workflow_context.reportDate — run signal-loop and regenerate the JSON through the repo helper path"
    });
  } else {
    const workflowValidation = validateSignalLoopWorkflowContext(workflowReportDate, baseDir);
    if (!workflowValidation.ok) {
      issues.push(...workflowValidation.issues.map((issue) => ({
        code: issue.code,
        reason: issue.reason
      })));
    }
  }

  if (!payload) {
    return { ok: false as const, issues };
  }
  if (issues.length > 0) {
    return { ok: false as const, issues };
  }

  const extractSection = (label: "CLAIM" | "EVIDENCE" | "IMPLICATION") => {
    const pattern = new RegExp(`(?:^|\\s)${label}:\\s*([\\s\\S]*?)(?=\\s(?:CLAIM|EVIDENCE|IMPLICATION|Directive|What to do):|$)`, "i");
    return pattern.exec(payload.body)?.[1]?.trim() ?? "";
  };
  const hasTerminalPunctuation = (text: string): boolean => /[.!?]$/.test(text.trim());
  const emptySections = (["CLAIM", "EVIDENCE", "IMPLICATION"] as const).filter((label) => extractSection(label) === "");
  if (emptySections.length > 0) {
    return {
      ok: false as const,
      issues: [{
        code: "format_incomplete_template_sections",
        reason: `Signal body must include non-empty sections for: ${emptySections.join(", ")}`
      }]
    };
  }
  const punctuationFailures = (["CLAIM", "EVIDENCE", "IMPLICATION"] as const).filter((label) => {
    const section = extractSection(label);
    return section.length > 0 && !hasTerminalPunctuation(section);
  });
  if (punctuationFailures.length > 0) {
    return {
      ok: false as const,
      issues: [{
        code: "format_missing_terminal_punctuation",
        reason: `Signal body sections must end with terminal punctuation: ${punctuationFailures.join(", ")}`
      }]
    };
  }

  const body = payload.body.trim();
  return {
    ok: true as const,
    canonical: payload,
    upstreamPayload: {
      btc_address: btcAddress.trim(),
      beat_slug: payload.beat_slug,
      headline: payload.headline,
      body,
      analysis: body,
      sources: payload.sources,
      tags: payload.tags,
      disclosure: payload.disclosure
    }
  };
}

function isBeatClaimUrl(apiUrl: string): boolean {
  try {
    const parsed = new URL(apiUrl);
    return parsed.pathname === "/api/beats";
  } catch {
    return /\/api\/beats\/?$/.test(apiUrl.trim());
  }
}

function isTerminalDuplicateOutcome(value: unknown): boolean {
  return /already exists|duplicate|already filed/i.test(JSON.stringify(value));
}

function findRecoveredSignal(signals: LiveSignal[], input: { headline: string; since: string; beat?: string | null }): LiveSignal | null {
  const targetHeadline = normalizeHeadline(input.headline);
  const sinceMillis = Date.parse(input.since);
  const targetBeat = (input.beat ?? "").trim().toLowerCase();

  return signals.find((signal) => {
    const createdMillis = Date.parse(signal.created_at);
    if (!Number.isFinite(createdMillis) || !Number.isFinite(sinceMillis) || createdMillis < sinceMillis) {
      return false;
    }
    if (targetBeat && signal.beat.trim().toLowerCase() !== targetBeat) {
      return false;
    }
    return normalizeHeadline(signal.headline) === targetHeadline;
  }) ?? null;
}

type HelperSyncState = {
  editorialMemory: {
    refreshed: boolean;
    reportDate: string | null;
  };
  signability: {
    refreshed: boolean;
    path: string | null;
    allowedBeats: string[];
    activeWalletAddress: string | null;
    requiredWalletAddress: string | null;
  } | null;
};

async function syncHelperState(input: {
  reportDate?: string | null;
  candidateId?: string | null;
}): Promise<HelperSyncState> {
  const today = getUtcReportDate();
  const editorialMemoryPath = resolve(process.cwd(), "data/state/editorial-memory.json");
  let editorialRefreshed = false;

  try {
    const existing = JSON.parse(await readFile(editorialMemoryPath, "utf8")) as {
      currentCycle?: { reportDate?: string | null };
    };
    const cycleDate = existing?.currentCycle?.reportDate?.trim() ?? null;
    if (!cycleDate || cycleDate < today) {
      await refreshEditorialMemory(process.cwd());
      editorialRefreshed = true;
    }
  } catch {
    await refreshEditorialMemory(process.cwd());
    editorialRefreshed = true;
  }

  const preflight = await generateOperatorSignabilityPreflight({
    reportDate: input.reportDate ?? null,
    candidateId: input.candidateId ?? null
  }, process.cwd());
  const signabilityPath = await saveOperatorSignabilityPreflight(preflight, process.cwd());

  return {
    editorialMemory: {
      refreshed: editorialRefreshed,
      reportDate: today
    },
    signability: {
      refreshed: true,
      path: signabilityPath,
      allowedBeats: preflight.allowedBeats ?? [],
      activeWalletAddress: preflight.activeWalletAddress ?? null,
      requiredWalletAddress: preflight.requiredWalletAddress ?? null
    }
  };
}

export async function startFilingHelperServer(port: number): Promise<void> {
  await mkdir(resolve(process.cwd(), "data/filing-results"), { recursive: true });

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
          resolveLiveReadyArtifactPath(reportDate, candidateId, process.cwd())
        );

        let artifact: unknown;
        try {
          artifact = JSON.parse(await readFile(artifactPath, "utf8")) as unknown;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
            res.end(
              JSON.stringify(
                {
                  error:
                    `No repo filing-ready artifact exists at data/filing-ready/${reportDate}/${candidateId}.json. ` +
                    "If this was a manual draft, clear the stale date/candidate query params and paste or load a current payload instead."
                },
                null,
                2
              )
            );
            return;
          }
          throw error;
        }

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ artifactPath, artifact }, null, 2));
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/local/health") {
        const now = new Date();
        const utcNow = now.toISOString().replace("T", " ").replace("Z", " UTC");
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({
          ok: true,
          reportDateUtc: getUtcReportDate(now),
          utcNow,
          serverNowUtc: now.toISOString(),
          helperUrl: `http://127.0.0.1:${port}/tools/xverse-register/file-signal.html`
        }, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/helper-sync") {
        const raw = await readRequestBody(req);
        const payload = raw
          ? JSON.parse(raw) as { reportDate?: string | null; candidateId?: string | null }
          : {};
        const state = await syncHelperState(payload);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, state }, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/signing-preflight/session") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          activeWalletAddress?: string | null;
          walletProviderReady?: boolean;
          helperPath?: string | null;
        };

        const sessionPath = resolve(process.cwd(), "data/state/xverse-helper-session.json");
        await mkdir(resolve(process.cwd(), "data/state"), { recursive: true });
        const session = {
          kind: "xverse_helper_session",
          updatedAt: new Date().toISOString(),
          walletProviderReady: Boolean(payload.walletProviderReady),
          activeWalletAddress: payload.activeWalletAddress ?? null,
          lastHelperPath: payload.helperPath ?? null
        };
        await writeFile(sessionPath, JSON.stringify(session, null, 2) + "\n", "utf8");

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, sessionPath, session }, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/signal-guard") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          reportDate?: string;
          headline?: string;
          beat_slug?: string;
          body?: string;
          sources?: Array<{ url?: string; title?: string }>;
          model_disclosure?: {
            tools_used?: string[];
            derivation_steps?: string[];
          };
        };

        const guard = await evaluateSignalGuard({
          reportDate: payload.reportDate,
          headline: payload.headline,
          beat_slug: payload.beat_slug,
          body: payload.body,
          sources: payload.sources,
          model_disclosure: payload.model_disclosure
        }, process.cwd());

        res.writeHead(guard.ok ? 200 : 409, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(guard, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/signal-submit") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          apiUrl?: string;
          headers?: Record<string, string>;
          payload?: unknown;
        };

        if (!payload.apiUrl || !payload.headers || payload.payload === undefined) {
          await recordHelperError({
            stage: "request_validation",
            helperCategory: "payload_issue",
            message: "Missing required apiUrl, headers, or payload.",
            details: { hasApiUrl: Boolean(payload.apiUrl), hasHeaders: Boolean(payload.headers), hasPayload: payload.payload !== undefined },
            apiUrl: payload.apiUrl ?? null
          });
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Missing required apiUrl, headers, or payload." }, null, 2));
          return;
        }

      const btcAddress = String(
        payload.headers["X-BTC-Address"] ??
        payload.headers["x-btc-address"] ??
        ""
      ).trim();
        const isBeatClaim = isBeatClaimUrl(payload.apiUrl);
        let upstreamPayload = payload.payload;

        if (!isBeatClaim) {
          if (!btcAddress) {
            await recordHelperError({
              stage: "request_validation",
              helperCategory: "payload_issue",
              message: "Signal submission requires X-BTC-Address before payload normalization.",
              apiUrl: payload.apiUrl,
              beatSlug: typeof payload.payload === "object" && payload.payload
                ? String((payload.payload as Record<string, unknown>).beat_slug ?? "")
                : null,
              headline: typeof payload.payload === "object" && payload.payload
                ? String((payload.payload as Record<string, unknown>).headline ?? "")
                : null
            });
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({
              error: "Signal submission requires X-BTC-Address before payload normalization."
            }, null, 2));
            return;
          }

          const filingStatus = await checkNewsStatus(btcAddress);
          if (!filingStatus.canFileSignal) {
            await recordHelperError({
              stage: "cooldown_precheck",
              helperCategory: "cooldown_issue",
              message: `Cooldown active — wait ${filingStatus.waitMinutes} minute${filingStatus.waitMinutes === 1 ? "" : "s"} before filing another signal`,
              details: filingStatus,
              apiUrl: payload.apiUrl,
              btcAddress,
              status: 409
            });
            res.writeHead(409, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({
              status: 409,
              ok: false,
              body: {
                error: `Cooldown active — wait ${filingStatus.waitMinutes} minute${filingStatus.waitMinutes === 1 ? "" : "s"} before filing another signal`,
                code: "COOLDOWN_ACTIVE",
                waitMinutes: filingStatus.waitMinutes,
                cooldown: {
                  waitMinutes: filingStatus.waitMinutes,
                  cooldownEndsAt: filingStatus.cooldownEndsAt
                },
                statusCheck: filingStatus
              }
            }, null, 2));
            return;
          }

          const normalized = buildNormalizedSignalPayload(payload.payload, btcAddress, process.cwd());
          if (!normalized.ok) {
            const payloadRecord = payload.payload as Record<string, unknown> | null;
            await recordHelperError({
              stage: "payload_normalization",
              helperCategory: "payload_issue",
              message: "Signal payload does not match the canonical contract.",
              details: normalized.issues,
              apiUrl: payload.apiUrl,
              btcAddress,
              beatSlug: payloadRecord ? String(payloadRecord.beat_slug ?? "") : null,
              headline: payloadRecord ? String(payloadRecord.headline ?? "") : null,
              status: 400
            });
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({
              error: "Signal payload does not match the canonical contract.",
              issues: normalized.issues
            }, null, 2));
            return;
          }

          const guard = await evaluateSignalGuard({
            headline: normalized.canonical.headline,
            beat_slug: normalized.canonical.beat_slug,
            body: normalized.canonical.body,
            sources: normalized.canonical.sources,
            model_disclosure: {
              tools_used: [],
              derivation_steps: normalized.canonical.disclosure ? [normalized.canonical.disclosure] : []
            }
          }, process.cwd());

          if (!guard.ok) {
            await recordHelperError({
              stage: "signal_guard",
              helperCategory: "payload_issue",
              message: "Local signal guard blocked submission.",
              details: {
                blockers: guard.blockers,
                diagnostics: guard.diagnostics
              },
              apiUrl: payload.apiUrl,
              btcAddress,
              beatSlug: normalized.canonical.beat_slug,
              headline: normalized.canonical.headline,
              status: 409
            });
            res.writeHead(409, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({
              status: 409,
              ok: false,
              body: {
                error: "Local signal guard blocked submission.",
                blockers: guard.blockers,
                guard
              }
            }, null, 2));
            return;
          }

          upstreamPayload = normalized.upstreamPayload;
        }

        try {
          const upstream = await fetch(payload.apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...payload.headers
            },
            body: JSON.stringify(upstreamPayload),
            signal: AbortSignal.timeout(UPSTREAM_SUBMIT_TIMEOUT_MS)
          });

          const text = await upstream.text();
          let parsedBody: unknown = text;
          try {
            parsedBody = JSON.parse(text);
          } catch {
            // Keep raw text when upstream does not return JSON.
          }

          const duplicateDetected = isTerminalDuplicateOutcome(parsedBody);
          const helperCategory =
            upstream.status === 429
              ? "cooldown_issue"
              : duplicateDetected
                ? "payload_issue"
                : isBeatClaim
                  ? "beat_issue"
                  : "payload_issue";

          if (!upstream.ok) {
            const signalPayload = upstreamPayload as Record<string, unknown> | null;
            await recordHelperError({
              stage: "upstream_response",
              helperCategory,
              message: typeof parsedBody === "string"
                ? parsedBody
                : String((parsedBody as Record<string, unknown>)?.error ?? `Upstream returned HTTP ${upstream.status}`),
              details: parsedBody,
              apiUrl: payload.apiUrl,
              btcAddress: btcAddress || null,
              beatSlug: signalPayload ? String(signalPayload.beat_slug ?? "") : null,
              headline: signalPayload ? String(signalPayload.headline ?? "") : null,
              status: upstream.status
            });
          }

          res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            status: upstream.status,
            ok: upstream.ok,
            body: parsedBody,
            helperCategory,
            terminal: duplicateDetected
              ? {
                  terminal: true,
                  reason: "duplicate_or_already_exists"
                }
              : null
          }, null, 2));
          return;
        } catch (error) {
          const err = error as Error & { name?: string; cause?: unknown };
          const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
          const status = isTimeout ? 504 : 502;
          const signalPayload = upstreamPayload as Record<string, unknown> | null;
          await recordHelperError({
            stage: "upstream_fetch",
            helperCategory: isTimeout ? "timeout_issue" : "payload_issue",
            message: isTimeout
              ? `AIBTC submit timed out after ${Math.round(UPSTREAM_SUBMIT_TIMEOUT_MS / 1000)}s`
              : "AIBTC submit failed before a response was returned",
            details: {
              code: isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_FETCH_FAILED",
              errorName: err.name ?? null,
              errorMessage: err.message
            },
            apiUrl: payload.apiUrl,
            btcAddress: btcAddress || null,
            beatSlug: signalPayload ? String(signalPayload.beat_slug ?? "") : null,
            headline: signalPayload ? String(signalPayload.headline ?? "") : null,
            status
          });
          res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            status,
            ok: false,
            body: {
              error: isTimeout
                ? `AIBTC submit timed out after ${Math.round(UPSTREAM_SUBMIT_TIMEOUT_MS / 1000)}s`
                : "AIBTC submit failed before a response was returned",
              code: isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_FETCH_FAILED",
              details: err.message,
              helperNote: isTimeout
                ? "The request may still have reached AIBTC. Wait 5 seconds, recover by headline + address + since timestamp, and do not retry inside cooldown."
                : "The request failed before a response was returned. Verify on the signals feed before retrying to avoid duplicates."
            },
            helperCategory: isTimeout ? "timeout_issue" : "payload_issue"
          }, null, 2));
          return;
        }
      }

      if (req.method === "GET" && url.pathname === "/api/local/news-check-status") {
        const btcAddress = url.searchParams.get("btcAddress")?.trim();
        if (!btcAddress) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Missing required btcAddress query param." }, null, 2));
          return;
        }

        try {
          const statusResult = await checkNewsStatus(btcAddress);
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(statusResult, null, 2));
          return;
        } catch (error) {
          res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            ok: false,
            source: "live-signal-feed",
            btcAddress,
            error: (error as Error).message
          }, null, 2));
          return;
        }
      }

      if (req.method === "POST" && url.pathname === "/api/local/repo-mode/check") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          requestText?: string;
          reportDate?: string;
          candidateId?: string;
        };

        const intent = detectRepoModeIntent(payload.requestText ?? "");
        if (!intent.repoModeRequired) {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            repoModeRequired: false,
            matchedPattern: null,
            resolution: null
          }, null, 2));
          return;
        }

        if (!payload.reportDate || !payload.candidateId) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            error: "repo mode requires reportDate and candidateId for submission-intent requests",
            repoModeRequired: true,
            matchedPattern: intent.matchedPattern
          }, null, 2));
          return;
        }

        const resolution = await resolveRepoModeSubmission(
          payload.reportDate,
          payload.candidateId,
          process.cwd()
        );

        res.writeHead(resolution.ok ? 200 : 409, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({
          repoModeRequired: true,
          matchedPattern: intent.matchedPattern,
          resolution
        }, null, 2));
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/local/staggered-dispatch") {
        const reportDate = url.searchParams.get("date");
        if (!reportDate) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Missing required date query param." }, null, 2));
          return;
        }

        const queue = await advanceDispatchQueue(reportDate);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(queue, null, 2));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/local/staggered-dispatch/signed") {
        const raw = await readRequestBody(req);
        const payload = JSON.parse(raw) as {
          reportDate?: string;
          candidateId?: string;
          signedAt?: string;
        };

        if (!payload.reportDate || !payload.candidateId) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Missing required reportDate and candidateId." }, null, 2));
          return;
        }

        const queue = await markCandidateSigned(
          payload.reportDate,
          payload.candidateId,
          { now: payload.signedAt },
          process.cwd()
        );
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(queue, null, 2));
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

      if (req.method === "GET" && url.pathname === "/api/local/verify-signal") {
        const signalId = url.searchParams.get("id");
        if (!signalId) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Missing required id query param." }, null, 2));
          return;
        }

        const upstream = await fetch(`https://aibtc.news/api/signals/${encodeURIComponent(signalId)}`, {
          signal: AbortSignal.timeout(15_000)
        });
        const text = await upstream.text();
        let parsedBody: unknown = text;
        try { parsedBody = JSON.parse(text); } catch { /* keep raw text */ }

        res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({
          status: upstream.status,
          ok: upstream.ok,
          body: parsedBody
        }, null, 2));
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/local/recover-signal") {
        const agent = url.searchParams.get("agent");
        const headline = url.searchParams.get("headline");
        const since = url.searchParams.get("since");
        const beat = url.searchParams.get("beat");

        if (!agent || !headline || !since) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Missing required agent, headline, or since query param." }, null, 2));
          return;
        }

        try {
          const signals = await fetchRecentSignalsForAgent(agent);
          const match = findRecoveredSignal(signals, { headline, since, beat });
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            ok: true,
            found: Boolean(match),
            signal: match,
            checked: {
              agent,
              headline,
              since,
              beat: beat ?? null
            }
          }, null, 2));
          return;
        } catch (error) {
          res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            ok: false,
            error: (error as Error).message
          }, null, 2));
          return;
        }
      }

      const { status, body, contentType } = await serveStatic(url.pathname);
      res.writeHead(status, { "Content-Type": contentType });
      res.end(body);
    } catch (error) {
      const status = (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
      await recordHelperError({
        stage: "handler_exception",
        helperCategory: "server_issue",
        message: (error as Error).message,
        details: {
          code: (error as NodeJS.ErrnoException).code ?? null
        },
        status
      });
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

  await new Promise<void>((resolvePromise) => {
    server.listen(port, "127.0.0.1", () => resolvePromise());
  });

  process.stdout.write(
    `[filing-helper] serving Xverse helper at http://127.0.0.1:${port}/tools/xverse-register/file-signal.html\n`
  );
}

export {
  buildNormalizedSignalPayload,
  checkNewsStatus,
  findRecoveredSignal,
  getHelperErrorLogPath,
  inferFilingStatus,
  isBeatClaimUrl,
  isTerminalDuplicateOutcome,
  recordHelperError,
  toLiveSignal
};

async function main(): Promise<void> {
  const { port } = parseArgs(process.argv.slice(2));
  await startFilingHelperServer(port);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
