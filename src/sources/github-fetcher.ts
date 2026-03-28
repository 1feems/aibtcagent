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

function extractSummary(release: GithubRelease, repoName: string): string {
  const body = release.body ?? "";
  const clean = stripMarkdown(body);
  const firstSentence = clean.split(/[.!?]\s+/)[0]?.trim() ?? "";
  const base = firstSentence.length > 30 ? firstSentence : clean.slice(0, 160).trim();
  return `${repoName} ships ${release.tag_name} — ${base || "new release"}`.slice(0, 280);
}

function extractSignificance(release: GithubRelease, version: string, repoName: string): string {
  const body = release.body ?? "";
  const bullets = body.match(/^[-*]\s+.+/gm) ?? [];
  const top = bullets
    .slice(0, 3)
    .map((b) => b.replace(/^[-*]\s+/, "").trim())
    .filter((b) => b.length > 5);

  if (top.length > 0) {
    return `${version} adds: ${top.join("; ")}`.slice(0, 280);
  }

  const clean = stripMarkdown(body).slice(0, 200).trim();
  return clean.length > 20
    ? clean
    : `${repoName} ${version} — review release notes for agent-relevant changes`;
}

function extractCausalTrigger(release: GithubRelease, repoName: string): string {
  const date = release.published_at?.slice(0, 10) ?? "unknown date";
  return `${repoName} released ${release.tag_name} on ${date}`.slice(0, 280);
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
