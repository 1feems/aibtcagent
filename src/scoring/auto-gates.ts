import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const FRESHNESS_BLOCK_HOURS = 6;

const AGGREGATOR_DOMAINS = new Set([
  "coingecko.com",
  "coinmarketcap.com",
  "defillama.com",
  "llama.fi",
  "glassnode.com",
  "messari.io",
  "nansen.ai",
  "dune.com",
  "token.unlocks.app",
  "santiment.net",
  "cryptoquant.com",
  "artemis.xyz",
]);

const DUPLICATE_FLAGGED_THRESHOLD = 0.5;
const DUPLICATE_PENDING_THRESHOLD = 0.3;

export interface AutoGateResult {
  freshnessStatus: "clear" | "risk_unresolved" | "unknown";
  duplicateStatus: "clear" | "pending" | "flagged";
  duplicateMatchHeadline: string | null;
  dashboardContaminated: boolean;
}

interface LiveSignal {
  headline: string;
}

function sanitizeCandidateId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function extractDomain(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function jaccardSimilarity(a: string, b: string): number {
  const normalize = (s: string): Set<string> =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
  const wordsA = normalize(a);
  const wordsB = normalize(b);
  let intersectionSize = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersectionSize += 1;
  }
  const unionSize = wordsA.size + wordsB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

async function readDetectedAt(candidateId: string, baseDir: string): Promise<string | null> {
  const filePath = resolve(baseDir, `data/logs/candidates/${sanitizeCandidateId(candidateId)}.json`);
  try {
    const record = JSON.parse(await readFile(filePath, "utf8")) as { recordedAt?: string };
    return record.recordedAt ?? null;
  } catch {
    return null;
  }
}

export async function fetchLiveSignals(): Promise<LiveSignal[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);
  try {
    const response = await fetch("https://aibtc.news/api/signals", {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    const items: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray((data as Record<string, unknown>)?.signals)
        ? (data as Record<string, unknown[]>).signals
        : [];
    return items.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const headline = (item as Record<string, unknown>).headline;
      if (typeof headline !== "string" || headline.length === 0) return [];
      return [{ headline }];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function checkDashboardContamination(sourceUrls: string[]): boolean {
  const domains = sourceUrls
    .map((url) => extractDomain(url))
    .filter((d): d is string => d !== null);
  return domains.length > 0 && domains.every((d) => AGGREGATOR_DOMAINS.has(d));
}

function checkDuplicateStatus(
  headline: string,
  liveSignals: LiveSignal[]
): { status: "clear" | "pending" | "flagged"; matchHeadline: string | null } {
  if (liveSignals.length === 0) {
    return { status: "clear", matchHeadline: null };
  }
  let best = 0;
  let bestHeadline: string | null = null;
  for (const signal of liveSignals) {
    const score = jaccardSimilarity(headline, signal.headline);
    if (score > best) {
      best = score;
      bestHeadline = signal.headline;
    }
  }
  if (best >= DUPLICATE_FLAGGED_THRESHOLD) {
    return { status: "flagged", matchHeadline: bestHeadline };
  }
  if (best >= DUPLICATE_PENDING_THRESHOLD) {
    return { status: "pending", matchHeadline: bestHeadline };
  }
  return { status: "clear", matchHeadline: null };
}

export async function runAutoGates(
  candidateId: string,
  headline: string,
  sourceUrls: string[],
  runAt: string,
  baseDir: string,
  liveSignals: LiveSignal[]
): Promise<AutoGateResult> {
  const detectedAt = await readDetectedAt(candidateId, baseDir);

  let freshnessStatus: AutoGateResult["freshnessStatus"] = "unknown";
  if (detectedAt !== null) {
    const ageHours =
      (new Date(runAt).getTime() - new Date(detectedAt).getTime()) / (1000 * 60 * 60);
    freshnessStatus = ageHours > FRESHNESS_BLOCK_HOURS ? "risk_unresolved" : "clear";
  }

  const dashboardContaminated = checkDashboardContamination(sourceUrls);
  const { status: duplicateStatus, matchHeadline: duplicateMatchHeadline } =
    checkDuplicateStatus(headline, liveSignals);

  return { freshnessStatus, duplicateStatus, duplicateMatchHeadline, dashboardContaminated };
}
