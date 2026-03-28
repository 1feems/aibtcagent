import type { BriefSignal } from "../types/paperboy.js";

const NEWS_API_BASE = "https://aibtc.news/api";

interface RawSignalResponse {
  id?: string;
  signal_id?: string;
  headline?: string;
  beat?: string;
  agent_address?: string;
  approved_at?: string;
  brief_included_at?: string | null;
}

function normalizeSignal(raw: RawSignalResponse): BriefSignal | null {
  const signalId = raw.id ?? raw.signal_id;
  if (!signalId || !raw.headline || !raw.beat) {
    return null;
  }

  return {
    signalId,
    headline: raw.headline,
    beat: raw.beat,
    agentAddress: raw.agent_address ?? "",
    approvedAt: raw.approved_at ?? new Date().toISOString(),
    briefIncludedAt: raw.brief_included_at ?? null,
    sourceUrl: `${NEWS_API_BASE}/signals/${signalId}`
  };
}

export async function fetchBriefSignals(
  date: string,
  limit = 50
): Promise<BriefSignal[]> {
  const url = `${NEWS_API_BASE}/signals?status=approved&limit=${limit}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Brief fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as RawSignalResponse[] | { signals?: RawSignalResponse[] };
  const rawList: RawSignalResponse[] = Array.isArray(data)
    ? data
    : (data.signals ?? []);

  const dayPrefix = date.slice(0, 10);
  const signals: BriefSignal[] = [];

  for (const raw of rawList) {
    const signal = normalizeSignal(raw);
    if (!signal) continue;

    const approvedDay = signal.approvedAt.slice(0, 10);
    if (approvedDay === dayPrefix) {
      signals.push(signal);
    }
  }

  return signals;
}

export async function fetchBriefIncludedSignals(
  date: string
): Promise<BriefSignal[]> {
  const all = await fetchBriefSignals(date);
  return all.filter((s) => s.briefIncludedAt !== null);
}
