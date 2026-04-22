/**
 * Correction hunter — zero-token daily loop.
 *
 * Scans recent aibtc.news signals for verifiable factual errors using
 * deterministic regex/math checks (no LLM). Writes correction candidates to
 * data/corrections/pending/YYYY-MM-DD.json for operator review.
 *
 * Quota: hard-capped at MAX_DAILY (3) found candidates per calendar day.
 * Fast-exit if quota is already exhausted — costs one file read, nothing else.
 *
 * Run standalone:
 *   bun run src/corrections/correction-hunter.ts [YYYY-MM-DD]
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = "https://aibtc.news/api";
const MEMPOOL_PRICE_URL = "https://mempool.space/api/v1/prices";
const STACKS_INFO_URL = "https://api.mainnet.hiro.so/v2/info";
const QUOTA_PATH = "data/state/correction-quota.json";
const PENDING_DIR = "data/corrections/pending";
const MAX_DAILY = 3;
const BTC_PRICE_TOLERANCE = 0.02; // 2% — matches SKILL.md threshold
const MAX_CORRECTION_CHARS = 500;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CorrectionQuota {
  date: string;
  filedCount: number;
  filedSignalIds: string[];
  scannedSignalIds: string[];
}

interface RawSignal {
  id?: unknown;
  beat?: unknown;
  beat_slug?: unknown;
  status?: unknown;
  headline?: unknown;
  analysis?: unknown;
  body?: unknown;
  content?: unknown;
  sources?: unknown;
  correspondent?: unknown;
  agent?: unknown;
  submitted_at?: unknown;
  created_at?: unknown;
}

interface Signal {
  id: string;
  beat: string;
  headline: string;
  analysis: string;
  correspondent: string;
  submitted_at: string;
}

export interface CorrectionCandidate {
  signalId: string;
  correspondent: string;
  errorType: "stale_btc_price" | "future_block_height" | "supply_cap_violation";
  content: string; // ≤ 500 chars, ready to POST
  detectedAt: string;
}

export interface CorrectionHunterResult {
  scanned: number;
  candidates: CorrectionCandidate[];
  autoFiled: number;
  quota: CorrectionQuota;
}

// ── Quota ─────────────────────────────────────────────────────────────────────

async function loadQuota(today: string): Promise<CorrectionQuota> {
  try {
    const raw = JSON.parse(
      await readFile(resolve(process.cwd(), QUOTA_PATH), "utf8")
    ) as CorrectionQuota;
    if (raw.date === today) return raw;
  } catch { /* ENOENT or parse error — fresh day */ }
  return { date: today, filedCount: 0, filedSignalIds: [], scannedSignalIds: [] };
}

async function saveQuota(quota: CorrectionQuota): Promise<void> {
  await mkdir(resolve(process.cwd(), "data/state"), { recursive: true });
  await writeFile(
    resolve(process.cwd(), QUOTA_PATH),
    JSON.stringify(quota, null, 2) + "\n",
    "utf8"
  );
}

// ── API fetches (parallel, cheap) ─────────────────────────────────────────────

async function fetchSignals(limit = 50): Promise<Signal[]> {
  try {
    const res = await fetch(`${API_BASE}/signals?limit=${limit}`, {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      process.stderr.write(`[correction-hunter] signals ${res.status}\n`);
      return [];
    }
    const data = await res.json() as unknown;
    const arr: unknown[] = Array.isArray(data)
      ? data
      : ((data as Record<string, unknown>).signals as unknown[] | undefined) ?? [];
    return arr
      .map((s) => {
        const r = s as RawSignal;
        return {
          id: String(r.id ?? ""),
          beat: String(r.beat ?? r.beat_slug ?? ""),
          headline: String(r.headline ?? ""),
          analysis: String(r.analysis ?? r.body ?? r.content ?? ""),
          correspondent: String(r.correspondent ?? r.agent ?? ""),
          submitted_at: String(r.submitted_at ?? r.created_at ?? "")
        };
      })
      .filter((s) => s.id);
  } catch (err) {
    process.stderr.write(`[correction-hunter] fetch error: ${(err as Error).message}\n`);
    return [];
  }
}

async function fetchLiveBtcPrice(): Promise<number | null> {
  try {
    const res = await fetch(MEMPOOL_PRICE_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const usd = data["USD"];
    return typeof usd === "number" ? usd : null;
  } catch { return null; }
}

async function fetchStacksBlockHeight(): Promise<number | null> {
  try {
    const res = await fetch(STACKS_INFO_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const h = data["stacks_tip_height"];
    return typeof h === "number" ? h : null;
  } catch { return null; }
}

// ── Claim extractors ──────────────────────────────────────────────────────────

/** Extract dollar price claims in the BTC range ($10k–$200k). */
function extractBtcPriceClaims(text: string): number[] {
  const out: number[] = [];
  // Full form: $74,038 or $74038
  for (const m of text.matchAll(/\$(\d{1,3}(?:,\d{3})+|\d{5,})/g)) {
    const v = parseInt(m[1].replace(/,/g, ""), 10);
    if (v >= 10_000 && v <= 200_000) out.push(v);
  }
  // Shorthand: $74k or $74.5k
  for (const m of text.matchAll(/\$(\d+(?:\.\d+)?)\s*k\b/gi)) {
    const v = parseFloat(m[1]) * 1_000;
    if (v >= 10_000 && v <= 200_000) out.push(v);
  }
  return out;
}

/** Extract Stacks mainnet block heights (5–7 digits near "block" keyword). */
function extractStacksBlockHeights(text: string): number[] {
  const out = new Set<number>();
  for (const m of text.matchAll(/\bblocks?\s+(?:#|height\s+)?(\d{5,7})\b/gi)) {
    out.add(parseInt(m[1], 10));
  }
  for (const m of text.matchAll(/\b(\d{5,7})\s+block/gi)) {
    out.add(parseInt(m[1], 10));
  }
  return [...out];
}

// ── Error checks (deterministic, no LLM) ─────────────────────────────────────

function checkSupplyCap(signal: Signal): CorrectionCandidate | null {
  const text = `${signal.headline} ${signal.analysis}`;
  // "X million BTC" where X > 21
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*million\s+BTC\b/gi)) {
    if (parseFloat(m[1]) > 21) {
      const content = `Supply cap error: signal claims ${m[1]} million BTC; Bitcoin's hard cap is 21 million. Source: Bitcoin protocol consensus rules.`;
      if (content.length <= MAX_CORRECTION_CHARS) {
        return { signalId: signal.id, correspondent: signal.correspondent, errorType: "supply_cap_violation", content, detectedAt: new Date().toISOString() };
      }
    }
  }
  // Raw number > 21,000,000 BTC
  for (const m of text.matchAll(/(\d{2,3}(?:,\d{3}){2,})\s+BTC\b/g)) {
    if (parseInt(m[1].replace(/,/g, ""), 10) > 21_000_000) {
      const content = `Supply cap error: signal claims ${m[1]} BTC; Bitcoin's hard cap is 21,000,000. Source: Bitcoin protocol consensus rules.`;
      if (content.length <= MAX_CORRECTION_CHARS) {
        return { signalId: signal.id, correspondent: signal.correspondent, errorType: "supply_cap_violation", content, detectedAt: new Date().toISOString() };
      }
    }
  }
  return null;
}

function checkBtcPrice(
  signal: Signal,
  livePrice: number | null
): CorrectionCandidate | null {
  if (!livePrice) return null;
  const claims = extractBtcPriceClaims(`${signal.headline} ${signal.analysis}`);
  for (const claimed of claims) {
    const deviation = Math.abs(claimed - livePrice) / livePrice;
    if (deviation > BTC_PRICE_TOLERANCE) {
      const pct = (deviation * 100).toFixed(1);
      const content = `Stale BTC price: signal states $${claimed.toLocaleString()}; mempool.space live price at review time: $${livePrice.toLocaleString()} (deviation ${pct}%, threshold 2%). Data appears from a prior price window.`;
      if (content.length <= MAX_CORRECTION_CHARS) {
        return { signalId: signal.id, correspondent: signal.correspondent, errorType: "stale_btc_price", content, detectedAt: new Date().toISOString() };
      }
    }
  }
  return null;
}

function checkBlockHeight(
  signal: Signal,
  currentHeight: number | null
): CorrectionCandidate | null {
  if (!currentHeight) return null;
  const heights = extractStacksBlockHeights(`${signal.headline} ${signal.analysis}`);
  for (const claimed of heights) {
    if (claimed > currentHeight + 100) {
      const content = `Future block height: signal references Stacks block ${claimed.toLocaleString()} but current mainnet height is ${currentHeight.toLocaleString()} (api.mainnet.hiro.so/v2/info). This block has not yet occurred.`;
      if (content.length <= MAX_CORRECTION_CHARS) {
        return { signalId: signal.id, correspondent: signal.correspondent, errorType: "future_block_height", content, detectedAt: new Date().toISOString() };
      }
    }
  }
  return null;
}

// ── Pending queue output ───────────────────────────────────────────────────────

async function savePending(candidates: CorrectionCandidate[], date: string): Promise<string> {
  const dir = resolve(process.cwd(), PENDING_DIR);
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, `${date}.json`);
  let existing: CorrectionCandidate[] = [];
  try { existing = JSON.parse(await readFile(path, "utf8")) as CorrectionCandidate[]; } catch { /* first write */ }
  await writeFile(path, JSON.stringify([...existing, ...candidates], null, 2) + "\n", "utf8");
  return path;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export async function runCorrectionHunter(
  date?: string
): Promise<CorrectionHunterResult> {
  const today = date ?? new Date().toISOString().slice(0, 10);
  const quota = await loadQuota(today);

  // Fast-exit — one file read, nothing else spent
  if (quota.filedCount >= MAX_DAILY) {
    process.stdout.write(`[correction-hunter] quota full (${quota.filedCount}/${MAX_DAILY}) — done\n`);
    return { scanned: 0, candidates: [], autoFiled: 0, quota };
  }

  const remaining = MAX_DAILY - quota.filedCount;
  process.stdout.write(`[correction-hunter] quota: ${quota.filedCount}/${MAX_DAILY} used, ${remaining} slot(s) open\n`);

  // Parallel fetch — one round-trip for signals, one for price, one for block height
  const [signals, livePrice, currentHeight] = await Promise.all([
    fetchSignals(50),
    fetchLiveBtcPrice(),
    fetchStacksBlockHeight()
  ]);

  process.stdout.write(
    `[correction-hunter] ${signals.length} signal(s) fetched | BTC $${livePrice?.toLocaleString() ?? "n/a"} | Stacks block ${currentHeight?.toLocaleString() ?? "n/a"}\n`
  );

  // Skip already-scanned signals
  const scannedSet = new Set(quota.scannedSignalIds);
  const toScan = signals.filter((s) => !scannedSet.has(s.id) && !quota.filedSignalIds.includes(s.id));
  process.stdout.write(`[correction-hunter] ${toScan.length} unscanned signal(s) to check\n`);

  const candidates: CorrectionCandidate[] = [];

  for (const signal of toScan) {
    if (candidates.length >= remaining) break;

    quota.scannedSignalIds.push(signal.id);

    // Priority order: supply cap first (cheapest), then price, then block height
    const flaw =
      checkSupplyCap(signal) ??
      checkBtcPrice(signal, livePrice) ??
      checkBlockHeight(signal, currentHeight);

    if (flaw) {
      candidates.push(flaw);
      process.stdout.write(`[correction-hunter] flaw [${flaw.errorType}] in ${signal.id}: ${signal.headline.slice(0, 70)}\n`);
    }
  }

  if (candidates.length > 0) {
    const pendingPath = await savePending(candidates, today);
    process.stdout.write(`[correction-hunter] ${candidates.length} candidate(s) written to ${pendingPath}\n`);
    process.stdout.write("[correction-hunter] queued for operator review; auto-file is intentionally disabled\n");

    // Update quota with found candidates (prevents re-scanning same signals)
    quota.filedCount += candidates.length;
    quota.filedSignalIds.push(...candidates.map((c) => c.signalId));
  }

  await saveQuota(quota);

  process.stdout.write(
    `[correction-hunter] done — ${candidates.length} flaw(s) found in ${toScan.length} scanned, 0 auto-filed\n`
  );

  return { scanned: toScan.length, candidates, autoFiled: 0, quota };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  await runCorrectionHunter(date);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
