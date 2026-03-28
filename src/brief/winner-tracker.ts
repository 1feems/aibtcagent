import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const API_BASE = "https://aibtc.news/api";

interface ApiSignal {
  id?: string;
  headline?: string;
  beat?: string;
  beat_slug?: string;
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

function isPublished(signal: ApiSignal): boolean {
  return Boolean(
    signal.brief_included_at ?? signal.briefIncludedAt ?? signal.published_at ?? signal.publishedAt
  );
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

export async function trackBriefWinners(
  reportDate: string,
  baseDir?: string
): Promise<string> {
  const response = await fetch(`${API_BASE}/signals?status=approved&limit=200`);
  if (!response.ok) {
    throw new Error(`brief winner fetch failed with status ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  const items: ApiSignal[] = Array.isArray(data)
    ? (data as ApiSignal[])
    : Array.isArray((data as Record<string, unknown>)?.signals)
      ? ((data as Record<string, unknown[]>).signals as ApiSignal[])
      : [];

  const published = items.filter((signal) => isPublished(signal));
  const byAgent = new Map<
    string,
    {
      appearances: number;
      beats: string[];
      headlines: string[];
    }
  >();

  for (const signal of published) {
    const agent = pickAgentLabel(signal);
    const current = byAgent.get(agent) ?? { appearances: 0, beats: [], headlines: [] };
    current.appearances += 1;
    current.beats.push(signal.beat ?? signal.beat_slug ?? "unknown");
    current.headlines.push(signal.headline ?? "unknown");
    byAgent.set(agent, current);
  }

  const filePath = resolve(baseDir ?? process.cwd(), `data/state/brief-winners-${reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        kind: "brief_winner_snapshot",
        reportDate,
        generatedAt: new Date().toISOString(),
        winners: [...byAgent.entries()]
          .map(([agent, value]) => ({
            agent,
            appearances: value.appearances,
            beats: [...new Set(value.beats)].sort(),
            headlines: value.headlines
          }))
          .sort((left, right) => right.appearances - left.appearances || left.agent.localeCompare(right.agent))
      },
      null,
      2
    ),
    "utf8"
  );
  return filePath;
}
