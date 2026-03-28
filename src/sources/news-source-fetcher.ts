import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { GeneralNewsRawEvent } from "../signals/index.js";

interface NewsFeedConfig {
  id: string;
  name: string;
  url: string;
  format: "rss" | "html";
  publication: string;
  defaultBeat: string;
  includeKeywords?: string[];
  excludeKeywords?: string[];
}

interface ApiSnapshotConfig {
  id: string;
  name: string;
  url: string;
  beat: string;
  format: "json" | "html" | "text";
}

interface MonitoredSourcesConfig {
  lookbackHours: number;
  newsFeeds: NewsFeedConfig[];
  apiSnapshots: ApiSnapshotConfig[];
}

interface FetchedSourceState {
  processedItems: string[];
}

interface ParsedFeedItem {
  key: string;
  title: string;
  link: string;
  publishedAt: string | null;
  description: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stripTags(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripTags(match[1]) : "";
}

function readAtomLink(block: string): string {
  const hrefMatch = block.match(/<link[^>]+href="([^"]+)"/i);
  return hrefMatch ? hrefMatch[1] : "";
}

function readHtmlLinks(html: string, baseUrl: string): ParsedFeedItem[] {
  const matches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const base = new URL(baseUrl);
  const items: ParsedFeedItem[] = [];

  for (const match of matches) {
    const href = match[1];
    const text = stripTags(match[2]);
    if (!href || text.length < 25) {
      continue;
    }
    const absolute = href.startsWith("http") ? href : new URL(href, base).toString();
    items.push({
      key: absolute,
      title: text,
      link: absolute,
      publishedAt: null,
      description: ""
    });
  }

  return items;
}

function parseFeedItems(config: NewsFeedConfig, raw: string): ParsedFeedItem[] {
  if (config.format === "html") {
    return readHtmlLinks(raw, config.url);
  }

  const itemBlocks = raw.includes("<item")
    ? [...raw.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0])
    : [...raw.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);

  return itemBlocks.map((block) => {
    const title = readTag(block, "title");
    const link = readTag(block, "link") || readAtomLink(block);
    const guid = readTag(block, "guid");
    const publishedAt =
      readTag(block, "pubDate") ||
      readTag(block, "published") ||
      readTag(block, "updated") ||
      null;
    const description =
      readTag(block, "description") ||
      readTag(block, "summary") ||
      readTag(block, "content");

    return {
      key: guid || link || `${title}-${publishedAt ?? "unknown"}`,
      title,
      link,
      publishedAt,
      description
    };
  });
}

function extractHardNumber(text: string): string | null {
  const patterns = [
    /\$[\d,.]+(?:\s?(?:million|billion|trillion|M|B|T))?/i,
    /\bv?\d+\.\d+(?:\.\d+){0,3}\b/i,
    /\b\d+(?:\.\d+)?%\b/i,
    /\b\d[\d,]*(?:\.\d+)?\s?(?:BTC|STX|sBTC|sats?|sat\/vB|EH\/s|ZH\/s|wallets?|agents?|txs?|transactions?|blocks?|days?|hours?)\b/i,
    /\bblock\s+\d[\d,]*\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

function inferBeat(text: string, fallbackBeat: string): string {
  const normalized = text.toLowerCase();
  const mappings: Array<{ beat: string; keywords: string[] }> = [
    {
      beat: "security",
      keywords: ["exploit", "hack", "vulnerability", "malware", "breach", "ransomware", "audit", "cve", "seed phrase", "wallet drain"]
    },
    {
      beat: "deal-flow",
      keywords: ["series a", "funding", "raises", "closes", "ats", "sponsorship", "contract", "bounty", "custody", "marketplace"]
    },
    {
      beat: "agent-economy",
      keywords: ["x402", "agent payment", "wallet standard", "wallet layer", "agent economy", "micropayment", "commerce", "payment rail"]
    },
    {
      beat: "onboarding",
      keywords: ["leaderboard", "genesis", "check-in", "check in", "achievement", "referral", "registration", "onboarding"]
    },
    {
      beat: "agent-trading",
      keywords: ["trending", "token", "dex", "order book", "listing", "liquidity", "trading", "market cap", "boosts"]
    },
    {
      beat: "bitcoin-yield",
      keywords: ["tvl", "yield", "stacking", "stacks yield", "liquidation", "pool", "apr", "lending"]
    },
    {
      beat: "infrastructure",
      keywords: ["release", "upgrade", "api", "mcp", "relay", "node", "signer", "queue", "nonce", "deployment", "protocol", "wallet", "browserbase"]
    }
  ];

  for (const mapping of mappings) {
    if (mapping.keywords.some((keyword) => normalized.includes(keyword))) {
      return mapping.beat;
    }
  }

  return fallbackBeat;
}

function buildAgentConsequence(beat: string, text: string): string {
  const normalized = text.toLowerCase();

  if (beat === "security") {
    return "Agents should review exposure and mitigation steps before the threat pattern reaches their stack";
  }
  if (beat === "deal-flow") {
    return "Agents should track the capital or market-structure change because it can alter where real money flows next";
  }
  if (beat === "agent-economy") {
    return "Agents should reassess payment and wallet workflows because the agent economy rails just changed";
  }
  if (beat === "onboarding") {
    return "Agents should compare their own progression against the network baseline because the leaderboard signal changed";
  }
  if (beat === "agent-trading") {
    return "Trading agents should decide whether the new market split changes their positioning or screening logic";
  }
  if (beat === "bitcoin-yield") {
    return "Yield agents should reassess venue risk and capital allocation before the next rebalance";
  }
  if (normalized.includes("mandatory") || normalized.includes("must")) {
    return "Operators should act on the required upgrade before the deadline hits";
  }

  return "Operators should review the change now because it can affect reliability, deployment, or execution";
}

function buildSignificance(beat: string, text: string, hardNumber: string): string {
  const clean = stripTags(text);
  const firstSentence = clean.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (firstSentence && firstSentence.length >= 40) {
    return firstSentence.slice(0, 280);
  }

  if (beat === "security") {
    return `The security signal is notable because ${hardNumber} anchors a named threat that operators can act on now`.slice(0, 280);
  }
  if (beat === "deal-flow") {
    return `The deal-flow signal matters because ${hardNumber} points to a real capital or market-structure change, not just commentary`.slice(0, 280);
  }
  if (beat === "agent-economy") {
    return `The agent-economy signal matters because ${hardNumber} suggests agent payment or wallet infrastructure is maturing in public`.slice(0, 280);
  }

  return `The infrastructure signal matters because ${hardNumber} marks a concrete change operators may need to react to`.slice(0, 280);
}

function isLikelyPublisherValuable(beat: string, text: string, hardNumber: string | null): boolean {
  if (!hardNumber) {
    return false;
  }

  const normalized = text.toLowerCase();
  if (beat === "agent-skills") {
    return false;
  }
  if (
    normalized.includes("general availability") ||
    normalized.includes("supports mcp") ||
    normalized.includes("now supports") ||
    normalized.includes("documentation update")
  ) {
    return false;
  }

  const highSignalTerms = [
    "exploit",
    "hack",
    "breach",
    "mandatory",
    "deadline",
    "upgrade",
    "fix",
    "incident",
    "funding",
    "series",
    "raises",
    "queues",
    "nonce",
    "relay",
    "etf",
    "leaderboard",
    "yield",
    "tvl",
    "custody"
  ];

  return highSignalTerms.some((term) => normalized.includes(term));
}

function toIsoDate(value: string | null, fallbackNow: string): string {
  if (!value) {
    return fallbackNow;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallbackNow : new Date(parsed).toISOString();
}

function shouldIncludeFeedItem(
  config: NewsFeedConfig,
  item: ParsedFeedItem,
  seen: Set<string>,
  cutoff: Date
): boolean {
  if (!item.title || !item.link || seen.has(item.key)) {
    return false;
  }

  const combined = `${item.title} ${item.description}`.toLowerCase();
  if (config.includeKeywords && !config.includeKeywords.some((keyword) => combined.includes(keyword.toLowerCase()))) {
    return false;
  }
  if (config.excludeKeywords && config.excludeKeywords.some((keyword) => combined.includes(keyword.toLowerCase()))) {
    return false;
  }

  if (item.publishedAt) {
    const published = new Date(item.publishedAt);
    if (!Number.isNaN(published.getTime()) && published < cutoff) {
      return false;
    }
  }

  return true;
}

function buildNewsEvent(
  config: NewsFeedConfig,
  item: ParsedFeedItem,
  now: string
): GeneralNewsRawEvent | null {
  const combined = stripTags(`${item.title}. ${item.description}`);
  const beat = inferBeat(combined, config.defaultBeat);
  const hardNumber = extractHardNumber(combined);

  if (!isLikelyPublisherValuable(beat, combined, hardNumber)) {
    return null;
  }

  const publishedAt = toIsoDate(item.publishedAt, now);
  const summary = stripTags(item.title).slice(0, 220);
  const id = `${config.id}-${slugify(summary)}-${publishedAt.slice(0, 10)}`;

  return {
    id,
    detectedAt: now,
    beat,
    sourcePublication: config.publication,
    articleUrl: item.link,
    publishedAt,
    namedEntity: summary,
    hardNumber: hardNumber ?? publishedAt.slice(0, 10),
    summary,
    significance: buildSignificance(beat, combined, hardNumber ?? publishedAt.slice(0, 10)),
    causalTrigger: `${config.publication} published this event on ${publishedAt.slice(0, 10)}`.slice(0, 280),
    agentConsequence: buildAgentConsequence(beat, combined).slice(0, 280),
    proofUrl: item.link,
    proofNote: `${config.publication} published a directly linked item titled "${summary}" on ${publishedAt.slice(0, 10)}`.slice(0, 280),
    usesDashboardAsPrimarySource: false,
    likelyDuplicate: false
  };
}

async function readConfig(): Promise<MonitoredSourcesConfig> {
  const path = resolve(process.cwd(), "data/config/monitored-sources.json");
  return JSON.parse(await readFile(path, "utf8")) as MonitoredSourcesConfig;
}

async function readState(): Promise<FetchedSourceState> {
  const path = resolve(process.cwd(), "data/state/fetched-source-items.json");
  return JSON.parse(await readFile(path, "utf8")) as FetchedSourceState;
}

async function writeState(state: FetchedSourceState): Promise<void> {
  const path = resolve(process.cwd(), "data/state/fetched-source-items.json");
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function saveRawEvent(event: GeneralNewsRawEvent): Promise<string> {
  const filePath = resolve(process.cwd(), `data/live-inputs/${event.id}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(event, null, 2) + "\n", "utf8");
  return filePath;
}

async function saveSnapshot(
  config: ApiSnapshotConfig,
  now: string,
  body: string
): Promise<string> {
  const safeId = `${now.slice(0, 10)}-${config.id}`;
  const filePath = resolve(process.cwd(), `data/live-inputs/snapshots/${safeId}.json`);
  const parsedBody = config.format === "json" ? JSON.parse(body) : body;
  const payload = {
    kind: "api_snapshot",
    id: config.id,
    name: config.name,
    beat: config.beat,
    fetchedAt: now,
    sourceUrl: config.url,
    format: config.format,
    data: parsedBody
  };

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return filePath;
}

export async function fetchNewsFeedEvents(now: string): Promise<string[]> {
  const config = await readConfig();
  const state = await readState();
  const seen = new Set(state.processedItems);
  const cutoff = new Date(Date.now() - config.lookbackHours * 60 * 60 * 1000);
  const newPaths: string[] = [];

  for (const feed of config.newsFeeds) {
    process.stdout.write(`[sources] checking ${feed.name}\n`);

    let raw: string;
    try {
      const response = await fetch(feed.url);
      if (!response.ok) {
        process.stderr.write(`[sources] ${feed.name} returned ${response.status}\n`);
        continue;
      }
      raw = await response.text();
    } catch (error) {
      process.stderr.write(`[sources] failed to fetch ${feed.name}: ${(error as Error).message}\n`);
      continue;
    }

    const items = parseFeedItems(feed, raw);
    for (const item of items) {
      if (!shouldIncludeFeedItem(feed, item, seen, cutoff)) {
        continue;
      }

      const event = buildNewsEvent(feed, item, now);
      seen.add(item.key);
      if (!event) {
        continue;
      }

      const savedPath = await saveRawEvent(event);
      newPaths.push(savedPath);
      process.stdout.write(`[sources] new candidate: ${event.id}\n`);
    }
  }

  state.processedItems = [...seen].slice(-5000);
  await writeState(state);
  process.stdout.write(`[sources] done — ${newPaths.length} feed candidate(s)\n`);
  return newPaths;
}

export async function fetchApiSnapshots(now: string): Promise<string[]> {
  const config = await readConfig();
  const snapshotPaths: string[] = [];

  for (const api of config.apiSnapshots) {
    process.stdout.write(`[snapshots] fetching ${api.name}\n`);
    try {
      const response = await fetch(api.url);
      if (!response.ok) {
        process.stderr.write(`[snapshots] ${api.name} returned ${response.status}\n`);
        continue;
      }
      const body = await response.text();
      const savedPath = await saveSnapshot(api, now, body);
      snapshotPaths.push(savedPath);
    } catch (error) {
      process.stderr.write(`[snapshots] failed ${api.name}: ${(error as Error).message}\n`);
    }
  }

  process.stdout.write(`[snapshots] done — ${snapshotPaths.length} snapshot(s)\n`);
  return snapshotPaths;
}
