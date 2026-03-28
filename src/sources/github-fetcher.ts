import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ProtocolUpdateRawEvent } from "../signals/index.js";

// ── config types ──────────────────────────────────────────────────────────────

interface RepoConfig {
  owner: string;
  repo: string;
  beat: string;
}

interface MonitoredReposConfig {
  repos: RepoConfig[];
  lookbackHours: number;
}

interface FetchedReleasesState {
  processedReleases: string[]; // "{owner}/{repo}:{tag_name}"
}

// ── GitHub API types ──────────────────────────────────────────────────────────

interface GithubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const HIGH_SIGNAL_KEYWORDS = [
  "mandatory",
  "breaking",
  "security",
  "exploit",
  "vulnerability",
  "fix",
  "nonce",
  "queue",
  "relay",
  "signer",
  "consensus",
  "activation",
  "migration",
  "wallet",
  "payment",
  "settlement",
  "stuck",
  "outage",
  "health",
  "circuit breaker",
  "api",
  "deploy"
];

const LOW_SIGNAL_KEYWORDS = [
  "readme",
  "docs",
  "documentation",
  "typo",
  "lint",
  "test",
  "ci",
  "chore",
  "refactor"
];

function releaseKey(owner: string, repo: string, tag: string): string {
  return `${owner}/${repo}:${tag}`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\r?\n{2,}/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : value.slice(0, length).trim();
}

function parseBullets(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => stripMarkdown(line.replace(/^[-*]\s+/, "")))
    .filter((line) => line.length > 8);
}

function includesAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function isWeakRelease(release: GithubRelease): boolean {
  const combined = stripMarkdown(
    [release.name ?? "", release.body ?? "", release.tag_name].filter(Boolean).join(" ")
  ).toLowerCase();

  const hasHighSignal = includesAny(combined, HIGH_SIGNAL_KEYWORDS);
  const hasOnlyLowSignal = includesAny(combined, LOW_SIGNAL_KEYWORDS) && !hasHighSignal;
  const body = stripMarkdown(release.body ?? "");

  if (hasOnlyLowSignal) {
    return true;
  }

  if (body.length < 40 && !hasHighSignal) {
    return true;
  }

  if (!hasHighSignal && !/\b\d[\d.,]*\b/.test(combined)) {
    return true;
  }

  return false;
}

function inferOperatorConsequence(release: GithubRelease, repoName: string): string {
  const combined = stripMarkdown([release.name ?? "", release.body ?? ""].join(" "));
  const normalized = combined.toLowerCase();

  if (normalized.includes("mandatory") || normalized.includes("activation")) {
    return "operators should upgrade before the activation window or risk breakage";
  }
  if (normalized.includes("nonce") || normalized.includes("queue")) {
    return "agents should review transaction ordering and retry behavior before the old flow burns nonce slots";
  }
  if (normalized.includes("security") || normalized.includes("vulnerability") || normalized.includes("exploit")) {
    return "operators should patch exposed deployments before the security issue reaches production";
  }
  if (normalized.includes("wallet") || normalized.includes("signer")) {
    return "operators should review wallet and signer changes before the release reaches live workflows";
  }
  if (normalized.includes("api")) {
    return "integrators should review API changes before the release breaks dependent tooling";
  }
  if (normalized.includes("health") || normalized.includes("outage") || normalized.includes("circuit breaker")) {
    return "operators should review reliability changes before the next failure mode hits production";
  }

  return `${repoName} changed in a way operators may need to review before their next production run`;
}

function extractSummary(release: GithubRelease, repoName: string): string {
  const title = stripMarkdown(release.name ?? release.tag_name);
  const bullets = parseBullets(release.body ?? "");
  const keyChange = bullets.find((bullet) => includesAny(bullet, HIGH_SIGNAL_KEYWORDS)) ?? bullets[0] ?? "";
  const cleanTitle = title.length > 8 ? title : release.tag_name;

  if (keyChange) {
    return truncate(`${repoName} ships ${cleanTitle} — ${keyChange}`, 280);
  }

  const body = stripMarkdown(release.body ?? "");
  const firstSentence = body.split(/[.!?]\s+/)[0]?.trim() ?? "";
  const base = firstSentence.length > 25 ? firstSentence : body;
  return truncate(`${repoName} ships ${cleanTitle} — ${base || "new release"}`, 280);
}

function extractSignificance(release: GithubRelease, version: string, repoName: string): string {
  const bullets = parseBullets(release.body ?? "");
  const keyBullets = bullets.filter((bullet) => includesAny(bullet, HIGH_SIGNAL_KEYWORDS));
  const consequence = inferOperatorConsequence(release, repoName);

  if (keyBullets.length > 0) {
    return truncate(`${version} changes ${keyBullets.slice(0, 2).join("; ")} — ${consequence}`, 280);
  }

  const clean = stripMarkdown(release.body ?? "");
  if (clean.length > 20) {
    return truncate(`${clean} — ${consequence}`, 280);
  }

  return truncate(`${repoName} ${version} shipped and ${consequence}`, 280);
}

function extractCausalTrigger(release: GithubRelease, repoName: string): string {
  const date = release.published_at?.slice(0, 10) ?? "unknown date";
  const consequence = inferOperatorConsequence(release, repoName);
  return truncate(`${repoName} published ${release.tag_name} on ${date}, prompting review because ${consequence}`, 280);
}

function buildRawEvent(
  release: GithubRelease,
  config: RepoConfig,
  now: string
): ProtocolUpdateRawEvent {
  const { repo } = config;
  const version = release.tag_name;
  const releaseDate = release.published_at ?? now;
  const changelogEntry = (release.body ?? "").slice(0, 600).trim() || null;
  const proofNote = `GitHub release tag ${version} published ${releaseDate}. See ${release.html_url}`;

  return {
    id: `${repo}-${version}-${now.slice(0, 10)}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-"),
    detectedAt: now,
    chain: "github",
    summary: extractSummary(release, repo),
    significance: extractSignificance(release, version, repo),
    causalTrigger: extractCausalTrigger(release, repo),
    usesDashboardAsPrimarySource: false,
    likelyDuplicate: false,
    versionNumber: version,
    releaseDate,
    changelogEntry,
    proofNote,
    sourceUrls: {
      release: release.html_url
    }
  };
}

async function fetchReleases(
  owner: string,
  repo: string,
  token: string | undefined
): Promise<GithubRelease[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=20`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    process.stderr.write(
      `[fetcher] GitHub API ${response.status} for ${owner}/${repo}\n`
    );
    return [];
  }
  return response.json() as Promise<GithubRelease[]>;
}

async function readConfig(): Promise<MonitoredReposConfig> {
  const path = resolve(process.cwd(), "data/config/monitored-repos.json");
  return JSON.parse(await readFile(path, "utf8")) as MonitoredReposConfig;
}

async function readState(): Promise<FetchedReleasesState> {
  const path = resolve(process.cwd(), "data/state/fetched-releases.json");
  return JSON.parse(await readFile(path, "utf8")) as FetchedReleasesState;
}

async function writeState(state: FetchedReleasesState): Promise<void> {
  const path = resolve(process.cwd(), "data/state/fetched-releases.json");
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function saveRawEvent(event: ProtocolUpdateRawEvent): Promise<string> {
  const filePath = resolve(
    process.cwd(),
    `data/live-inputs/${event.id}.json`
  );
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(event, null, 2) + "\n", "utf8");
  return filePath;
}

// ── public API ────────────────────────────────────────────────────────────────

export async function fetchNewReleases(now: string): Promise<string[]> {
  const config = await readConfig();
  const state = await readState();
  const seen = new Set(state.processedReleases);
  const cutoff = new Date(Date.now() - config.lookbackHours * 60 * 60 * 1000);
  const token = process.env.GITHUB_TOKEN;

  const newPaths: string[] = [];

  for (const repoConfig of config.repos) {
    const { owner, repo } = repoConfig;
    process.stdout.write(`[fetcher] checking ${owner}/${repo}\n`);

    let releases: GithubRelease[];
    try {
      releases = await fetchReleases(owner, repo, token);
    } catch (error) {
      process.stderr.write(
        `[fetcher] failed to fetch ${owner}/${repo}: ${(error as Error).message}\n`
      );
      continue;
    }

    for (const release of releases) {
      if (release.draft || release.prerelease) continue;

      const key = releaseKey(owner, repo, release.tag_name);
      if (seen.has(key)) continue;

      const publishedAt = release.published_at ? new Date(release.published_at) : null;
      if (publishedAt && publishedAt < cutoff) {
        seen.add(key);
        continue;
      }

      if (isWeakRelease(release)) {
        seen.add(key);
        process.stdout.write(`[fetcher] skipping weak release: ${release.tag_name}\n`);
        continue;
      }

      const rawEvent = buildRawEvent(release, repoConfig, now);
      const savedPath = await saveRawEvent(rawEvent);
      seen.add(key);
      newPaths.push(savedPath);
      process.stdout.write(`[fetcher] new release: ${release.tag_name} → ${savedPath}\n`);
    }
  }

  state.processedReleases = [...seen];
  await writeState(state);

  process.stdout.write(`[fetcher] done — ${newPaths.length} new event(s)\n`);
  return newPaths;
}
