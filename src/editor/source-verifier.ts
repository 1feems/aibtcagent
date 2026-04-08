// ── Live source verification for infrastructure beat (P23) ────────────────────
// Reuses github-fetcher.ts patterns; adds relay health + Hiro API checks.

const RELAY_HEALTH_URL = "https://relay.aibtc.dev/health";
const HIRO_STATUS_URL = "https://status.hiro.so/api/v2/summary.json";
const HIRO_API_BASE = "https://api.mainnet.hiro.so";

const FETCH_TIMEOUT_MS = 8000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type VerificationStatus = "verified" | "unverified" | "inconclusive";

export interface VerificationResult {
  status: VerificationStatus;
  evidence: string;
  checkedAt: string;
}

interface RelayHealthPayload {
  healthy?: boolean;
  nonce_gap?: number;
  pending_txs?: number;
  recovery_state?: string;
  stuck_txs?: number;
  [key: string]: unknown;
}

interface HiroStatusComponent {
  name?: string;
  status?: string;
  description?: string;
}

interface HiroStatusSummary {
  components?: HiroStatusComponent[];
  status?: { indicator?: string; description?: string };
}

interface GithubPR {
  state?: string;
  merged?: boolean;
  merged_at?: string | null;
  title?: string;
  html_url?: string;
  base?: { repo?: { default_branch?: string } };
}

interface GithubRelease {
  tag_name?: string;
  published_at?: string | null;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
}

// ── Timeout fetch ─────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => { controller.abort(); }, timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
  } finally {
    clearTimeout(id);
  }
}

// ── Relay health check ────────────────────────────────────────────────────────

export async function checkRelayHealth(): Promise<VerificationResult> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetchWithTimeout(RELAY_HEALTH_URL);
    if (!response.ok) {
      return {
        status: "inconclusive",
        evidence: `Relay health endpoint returned HTTP ${response.status}`,
        checkedAt
      };
    }

    const data = await response.json() as RelayHealthPayload;
    const nonceGap = data.nonce_gap ?? 0;
    const pendingTxs = data.pending_txs ?? 0;
    const stuckTxs = data.stuck_txs ?? 0;
    const recoveryState = data.recovery_state ?? "";
    const topLevelHealthy = data.healthy ?? true;

    // Never trust healthy boolean alone — inspect underlying fields
    const hasRealProblems =
      nonceGap > 0 || stuckTxs > 0 || recoveryState === "recovering" || !topLevelHealthy;

    const summary = [
      `healthy=${topLevelHealthy}`,
      `nonce_gap=${nonceGap}`,
      `pending_txs=${pendingTxs}`,
      `stuck_txs=${stuckTxs}`,
      recoveryState ? `recovery_state=${recoveryState}` : null
    ].filter(Boolean).join(", ");

    if (hasRealProblems) {
      return {
        status: "verified",
        evidence: `Relay shows degradation despite healthy flag: ${summary}`,
        checkedAt
      };
    }

    return {
      status: "verified",
      evidence: `Relay healthy: ${summary}`,
      checkedAt
    };
  } catch (err) {
    return {
      status: "inconclusive",
      evidence: `Could not reach relay health endpoint: ${(err as Error).message}`,
      checkedAt
    };
  }
}

// ── Hiro API status check ─────────────────────────────────────────────────────

export async function checkHiroApiStatus(): Promise<VerificationResult> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetchWithTimeout(HIRO_STATUS_URL);
    if (!response.ok) {
      return {
        status: "inconclusive",
        evidence: `Hiro status endpoint returned HTTP ${response.status}`,
        checkedAt
      };
    }

    const data = await response.json() as HiroStatusSummary;
    const overallIndicator = data.status?.indicator ?? "unknown";
    const degradedComponents = (data.components ?? [])
      .filter((c) => c.status && c.status !== "operational")
      .map((c) => `${c.name ?? "unknown"}: ${c.status}`)
      .slice(0, 5);

    if (degradedComponents.length > 0) {
      return {
        status: "verified",
        evidence: `Hiro API degraded — ${degradedComponents.join("; ")} (overall: ${overallIndicator})`,
        checkedAt
      };
    }

    return {
      status: "verified",
      evidence: `Hiro API operational (indicator: ${overallIndicator})`,
      checkedAt
    };
  } catch (err) {
    return {
      status: "inconclusive",
      evidence: `Could not reach Hiro status page: ${(err as Error).message}`,
      checkedAt
    };
  }
}

// ── GitHub PR verification ────────────────────────────────────────────────────

export async function verifyGithubPR(
  owner: string,
  repo: string,
  prNumber: number,
  token?: string
): Promise<VerificationResult> {
  const checkedAt = new Date().toISOString();
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const response = await fetchWithTimeout(url);
    if (response.status === 404) {
      return { status: "unverified", evidence: `PR #${prNumber} not found in ${owner}/${repo}`, checkedAt };
    }
    if (!response.ok) {
      return { status: "inconclusive", evidence: `GitHub API ${response.status} for ${owner}/${repo}#${prNumber}`, checkedAt };
    }

    const pr = await response.json() as GithubPR;
    const state = pr.state ?? "unknown";
    const merged = pr.merged ?? false;
    const mergedAt = pr.merged_at ?? null;

    if (merged && mergedAt) {
      return {
        status: "verified",
        evidence: `PR #${prNumber} merged on ${mergedAt.slice(0, 10)} in ${owner}/${repo} (state: ${state})`,
        checkedAt
      };
    }

    return {
      status: "verified",
      evidence: `PR #${prNumber} exists in ${owner}/${repo}, state: ${state}, merged: ${merged}`,
      checkedAt
    };
  } catch (err) {
    return {
      status: "inconclusive",
      evidence: `GitHub fetch failed for ${owner}/${repo}#${prNumber}: ${(err as Error).message}`,
      checkedAt
    };
  }
}

// ── GitHub release verification ───────────────────────────────────────────────

export async function verifyGithubRelease(
  owner: string,
  repo: string,
  tag: string,
  token?: string
): Promise<VerificationResult> {
  const checkedAt = new Date().toISOString();
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const response = await fetchWithTimeout(url);
    if (response.status === 404) {
      return { status: "unverified", evidence: `Release tag ${tag} not found in ${owner}/${repo}`, checkedAt };
    }
    if (!response.ok) {
      return { status: "inconclusive", evidence: `GitHub API ${response.status} for ${owner}/${repo}@${tag}`, checkedAt };
    }

    const release = await response.json() as GithubRelease;
    const publishedAt = release.published_at ?? "unknown";
    const isDraft = release.draft ?? false;
    const isPrerelease = release.prerelease ?? false;

    if (isDraft) {
      return {
        status: "unverified",
        evidence: `${tag} exists in ${owner}/${repo} but is a draft — not publicly released`,
        checkedAt
      };
    }

    return {
      status: "verified",
      evidence: `Release ${tag} published ${publishedAt.slice(0, 10)} in ${owner}/${repo}${isPrerelease ? " (prerelease)" : ""}`,
      checkedAt
    };
  } catch (err) {
    return {
      status: "inconclusive",
      evidence: `GitHub fetch failed for ${owner}/${repo}@${tag}: ${(err as Error).message}`,
      checkedAt
    };
  }
}

// ── Hiro endpoint availability check ─────────────────────────────────────────

export async function checkHiroEndpoint(path: string): Promise<VerificationResult> {
  const checkedAt = new Date().toISOString();
  const url = `${HIRO_API_BASE}${path}`;
  try {
    const response = await fetchWithTimeout(url);
    if (response.status === 301 || response.status === 302 || response.status === 308) {
      const location = response.headers.get("location") ?? "";
      return {
        status: "verified",
        evidence: `${path} redirects to ${location} (${response.status}) — likely deprecated`,
        checkedAt
      };
    }
    if (response.status === 404 || response.status === 410) {
      return {
        status: "verified",
        evidence: `${path} returns ${response.status} — endpoint removed or deprecated`,
        checkedAt
      };
    }
    if (response.ok) {
      return {
        status: "verified",
        evidence: `${path} returns ${response.status} — endpoint active`,
        checkedAt
      };
    }
    return {
      status: "inconclusive",
      evidence: `${path} returned HTTP ${response.status}`,
      checkedAt
    };
  } catch (err) {
    return {
      status: "inconclusive",
      evidence: `Could not reach ${url}: ${(err as Error).message}`,
      checkedAt
    };
  }
}

// ── Public claim verifier ─────────────────────────────────────────────────────

export interface InfraClaimVerification {
  claim: string;
  status: VerificationStatus;
  evidence: string;
  checkedAt: string;
}

/**
 * Verify an infrastructure claim against live state.
 * `sources` is the list of source URLs from the signal.
 */
export async function verifyInfrastructureClaim(
  claim: string,
  sources: string[]
): Promise<InfraClaimVerification> {
  const checkedAt = new Date().toISOString();

  // Detect relay health claim
  if (/relay.*health|relay.*incident|nonce.gap|stuck.tx|circuit.breaker/i.test(claim)) {
    const result = await checkRelayHealth();
    return { claim, ...result };
  }

  // Detect Hiro API deprecation/endpoint claim
  if (/hiro.api|hiro.*endpoint|extended\/v\d+\/address/i.test(claim)) {
    const pathMatch = claim.match(/\/extended\/[^\s"')]+/);
    if (pathMatch) {
      const result = await checkHiroEndpoint(pathMatch[0]);
      return { claim, ...result };
    }
    const statusResult = await checkHiroApiStatus();
    return { claim, ...statusResult };
  }

  // Detect GitHub PR claim
  const prMatch = claim.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i) ??
    sources.join(" ").match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  if (prMatch) {
    const [, owner, repo, prNumStr] = prMatch;
    const result = await verifyGithubPR(owner, repo, Number(prNumStr), process.env.GITHUB_TOKEN);
    return { claim, ...result };
  }

  // Detect GitHub release/tag claim
  const releaseMatch = claim.match(/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/([^\s"')]+)/i) ??
    sources.join(" ").match(/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/([^\s"')]+)/i);
  if (releaseMatch) {
    const [, owner, repo, tag] = releaseMatch;
    const result = await verifyGithubRelease(owner, repo, tag, process.env.GITHUB_TOKEN);
    return { claim, ...result };
  }

  return {
    claim,
    status: "inconclusive",
    evidence: "No automated verification path found for this claim — manual check required.",
    checkedAt
  };
}
