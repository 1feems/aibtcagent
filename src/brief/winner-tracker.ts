import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const API_BASE = "https://aibtc.news/api";

interface TrackedAgent {
  name: string;
  btcAddress: string;
  btcAddressPartial?: string;
  twitter?: string;
  notes?: string;
}

interface TrackedCompetitorsConfig {
  trackedAgents: TrackedAgent[];
  fetchLimitPerAgent?: number;
}

export interface CompetitorProfile {
  name: string;
  btcAddress: string;
  twitter: string;
  totalSignals: number;
  publishedCount: number;
  publicationRate: number;
  beatsWon: Array<{ beat: string; count: number }>;
  topHeadlines: string[];
  recentHeadlines: string[];
  sourceDomains: Array<{ domain: string; count: number }>;
  notes: string;
}

interface ApiSignal {
  id?: string;
  signal_id?: string;
  signalId?: string;
  headline?: string;
  beat?: string;
  beat_slug?: string;
  approved_at?: string;
  approvedAt?: string;
  brief_included_at?: string | null;
  briefIncludedAt?: string | null;
  published_at?: string | null;
  publishedAt?: string | null;
  agent_name?: string | null;
  agentName?: string | null;
  correspondent?: string | null;
  author?: string | null;
  btc_address?: string | null;
  btcAddress?: string | null;
  address?: string | null;
}

export interface BriefWinnerSignal {
  signalId: string | null;
  headline: string;
  beat: string;
  publishedAt: string | null;
  approvedAt: string | null;
  agent: string;
}

export interface BriefWinnerSnapshot {
  kind: "brief_winner_snapshot";
  reportDate: string;
  generatedAt: string;
  occupiedBeats: string[];
  repeatWinners: Array<{
    agent: string;
    appearances: number;
    beats: string[];
  }>;
  winners: Array<{
    agent: string;
    appearances: number;
    beats: string[];
    headlines: string[];
  }>;
  publishedSignals: BriefWinnerSignal[];
  approvedNotInBrief: BriefWinnerSignal[];
}

function isPublished(signal: ApiSignal): boolean {
  return Boolean(
    signal.brief_included_at ?? signal.briefIncludedAt ?? signal.published_at ?? signal.publishedAt
  );
}

function extractSignalId(signal: ApiSignal): string | null {
  return signal.id ?? signal.signal_id ?? signal.signalId ?? null;
}

function getPublishedAt(signal: ApiSignal): string | null {
  return (
    signal.brief_included_at ??
    signal.briefIncludedAt ??
    signal.published_at ??
    signal.publishedAt ??
    null
  );
}

function getApprovedAt(signal: ApiSignal): string | null {
  return signal.approved_at ?? signal.approvedAt ?? null;
}

function pickAgentLabel(signal: ApiSignal): string {
  return (
    signal.agent_name ??
    signal.agentName ??
    signal.correspondent ??
    signal.author ??
    signal.btc_address ??
    signal.btcAddress ??
    signal.address ??
    "unknown"
  );
}

function buildSignalSnapshot(signal: ApiSignal): BriefWinnerSignal {
  return {
    signalId: extractSignalId(signal),
    headline: signal.headline ?? "unknown",
    beat: signal.beat ?? signal.beat_slug ?? "unknown",
    publishedAt: getPublishedAt(signal),
    approvedAt: getApprovedAt(signal),
    agent: pickAgentLabel(signal)
  };
}

function matchesReportDate(timestamp: string | null, reportDate: string): boolean {
  return timestamp !== null && timestamp.slice(0, 10) === reportDate;
}

export async function readBriefWinnerSnapshot(
  reportDate: string,
  baseDir?: string
): Promise<BriefWinnerSnapshot | null> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/state/brief-winners-${reportDate}.json`);

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as BriefWinnerSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function fetchSignalPage(url: string): Promise<ApiSignal[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return [];
    const data = (await response.json()) as unknown;
    return Array.isArray(data)
      ? (data as ApiSignal[])
      : Array.isArray((data as Record<string, unknown>)?.signals)
        ? ((data as Record<string, unknown[]>).signals as ApiSignal[])
        : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export async function fetchCompetitorProfiles(baseDir?: string): Promise<CompetitorProfile[]> {
  const configPath = resolve(baseDir ?? process.cwd(), "data/config/tracked-competitors.json");
  let config: TrackedCompetitorsConfig;
  try {
    config = JSON.parse(await readFile(configPath, "utf8")) as TrackedCompetitorsConfig;
  } catch {
    return [];
  }

  const limit = config.fetchLimitPerAgent ?? 100;
  const briefIncludedPromise = fetchSignalPage(
    `${API_BASE}/signals?status=brief_included&limit=200`
  );

  return Promise.all(
    config.trackedAgents.map(async (agent) => {
      const [byAddress, briefIncluded] = await Promise.all([
        fetchSignalPage(`${API_BASE}/signals?agent=${encodeURIComponent(agent.btcAddress)}&limit=${limit}`),
        briefIncludedPromise
      ]);

      const nameNorm = agent.name.toLowerCase();
      const allAgentSignals = byAddress.length > 0
        ? byAddress
        : briefIncluded.filter((signal) =>
            pickAgentLabel(signal).toLowerCase().includes(nameNorm)
          );

      const agentPublished = briefIncluded.filter((signal) => {
        const label = pickAgentLabel(signal).toLowerCase();
        return label.includes(nameNorm) ||
          signal.btc_address === agent.btcAddress ||
          signal.btcAddress === agent.btcAddress ||
          signal.address === agent.btcAddress;
      });

      const totalSignals = allAgentSignals.length;
      const publishedSignals =
        agentPublished.length > 0 ? agentPublished : allAgentSignals.filter(isPublished);
      const publishedCount = publishedSignals.length;
      const publicationRate = totalSignals > 0
        ? Math.round((publishedCount / totalSignals) * 100)
        : 0;

      const beatCounts = new Map<string, number>();
      for (const signal of publishedSignals) {
        const beat = signal.beat ?? signal.beat_slug ?? "unknown";
        beatCounts.set(beat, (beatCounts.get(beat) ?? 0) + 1);
      }
      const beatsWon = [...beatCounts.entries()]
        .map(([beat, count]) => ({ beat, count }))
        .sort((a, b) => b.count - a.count);

      const topHeadlines = publishedSignals
        .map((signal) => signal.headline ?? "")
        .filter(Boolean)
        .slice(0, 5);

      const recentHeadlines = allAgentSignals
        .map((signal) => signal.headline ?? "")
        .filter(Boolean)
        .slice(0, 30);

      const domainCounts = new Map<string, number>();
      for (const signal of allAgentSignals) {
        const sources = (signal as Record<string, unknown>).sources as Array<{ source_url?: string }> | undefined;
        for (const source of sources ?? []) {
          if (source.source_url) {
            const domain = extractDomain(source.source_url);
            domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
          }
        }
      }
      const sourceDomains = [...domainCounts.entries()]
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        name: agent.name,
        btcAddress: agent.btcAddress,
        twitter: agent.twitter ?? "",
        totalSignals,
        publishedCount,
        publicationRate,
        beatsWon,
        topHeadlines,
        recentHeadlines,
        sourceDomains,
        notes: agent.notes ?? ""
      } satisfies CompetitorProfile;
    })
  );
}

export async function trackBriefWinners(
  reportDate: string,
  baseDir?: string
): Promise<string> {
  // Fetch both approved and brief_included to catch published signals under either status
  const [approvedItems, briefItems] = await Promise.all([
    fetchSignalPage(`${API_BASE}/signals?status=approved&limit=200`),
    fetchSignalPage(`${API_BASE}/signals?status=brief_included&limit=200`)
  ]);

  // Merge, deduplicating by signal id
  const seen = new Set<string>();
  const items: ApiSignal[] = [];
  for (const signal of [...briefItems, ...approvedItems]) {
    const id = extractSignalId(signal) ?? `${signal.headline}-${signal.approved_at}`;
    if (id && !seen.has(id)) {
      seen.add(id);
      items.push(signal);
    }
  }

  if (items.length === 0) {
    throw new Error(`brief winner fetch returned no signals`);
  }

  const published = items.filter((signal) => isPublished(signal));
  const publishedToday = published.filter((signal) => matchesReportDate(getPublishedAt(signal), reportDate));
  const approvedTodayNotInBrief = items.filter((signal) =>
    matchesReportDate(getApprovedAt(signal), reportDate) && !isPublished(signal)
  );
  const byAgent = new Map<
    string,
    {
      appearances: number;
      beats: string[];
      headlines: string[];
    }
  >();

  for (const signal of publishedToday) {
    const agent = pickAgentLabel(signal);
    const current = byAgent.get(agent) ?? { appearances: 0, beats: [], headlines: [] };
    current.appearances += 1;
    current.beats.push(signal.beat ?? signal.beat_slug ?? "unknown");
    current.headlines.push(signal.headline ?? "unknown");
    byAgent.set(agent, current);
  }

  const filePath = resolve(baseDir ?? process.cwd(), `data/state/brief-winners-${reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  const snapshot: BriefWinnerSnapshot = {
    kind: "brief_winner_snapshot",
    reportDate,
    generatedAt: new Date().toISOString(),
    occupiedBeats: [...new Set(publishedToday.map((signal) => signal.beat ?? signal.beat_slug ?? "unknown"))].sort(),
    repeatWinners: [...byAgent.entries()]
      .map(([agent, value]) => ({
        agent,
        appearances: value.appearances,
        beats: [...new Set(value.beats)].sort()
      }))
      .filter((winner) => winner.appearances > 1)
      .sort((left, right) => right.appearances - left.appearances || left.agent.localeCompare(right.agent)),
    winners: [...byAgent.entries()]
      .map(([agent, value]) => ({
        agent,
        appearances: value.appearances,
        beats: [...new Set(value.beats)].sort(),
        headlines: value.headlines
      }))
      .sort((left, right) => right.appearances - left.appearances || left.agent.localeCompare(right.agent)),
    publishedSignals: publishedToday.map(buildSignalSnapshot),
    approvedNotInBrief: approvedTodayNotInBrief.map(buildSignalSnapshot)
  };

  await writeFile(
    filePath,
    JSON.stringify(snapshot, null, 2),
    "utf8"
  );
  return filePath;
}
