import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { logLeaderboardObservation, logRewardOutcome } from "../storage/index.js";

const AIBTC_API_BASE = process.env.AIBTC_API_BASE ?? "https://aibtc.com/api";

interface InboxResponse {
  inbox?: {
    economics?: {
      satsReceived?: number;
      satsSent?: number;
      satsNet?: number;
    };
    totalCount?: number;
    receivedCount?: number;
    unreadCount?: number;
  };
}

interface AchievementsResponse {
  achievements?: Array<{
    id?: string;
    name?: string;
  }>;
  count?: number;
}

interface LeaderboardResponse {
  leaderboard?: Array<{
    btcAddress?: string;
    displayName?: string | null;
    rank?: number;
    score?: number;
  }>;
}

interface RewardSyncState {
  address: string;
  lastCheckedAt: string;
  lastSatsReceived: number;
  lastLeaderboardRank: number | null;
  lastLeaderboardScore: number | null;
  lastAchievementIds: string[];
}

export interface RewardSyncSummary {
  checkedAt: string;
  address: string;
  satsReceived: number;
  satsDelta: number;
  leaderboardRank: number | null;
  leaderboardScore: number | null;
  leaderboardMovement: string | null;
  newAchievements: string[];
}

function resolvePath(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

async function readJsonOrNull<T>(relativePath: string): Promise<T | null> {
  try {
    const raw = await readFile(resolvePath(relativePath), "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJson(relativePath: string, data: unknown): Promise<string> {
  const filePath = resolvePath(relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  return filePath;
}

async function fetchInbox(address: string): Promise<InboxResponse> {
  const response = await fetch(`${AIBTC_API_BASE}/inbox/${address}`);
  if (!response.ok) {
    throw new Error(`Inbox endpoint returned ${response.status}`);
  }
  return response.json() as Promise<InboxResponse>;
}

async function fetchAchievements(address: string): Promise<AchievementsResponse> {
  const response = await fetch(`${AIBTC_API_BASE}/achievements?btcAddress=${encodeURIComponent(address)}`);
  if (!response.ok) {
    throw new Error(`Achievements endpoint returned ${response.status}`);
  }
  return response.json() as Promise<AchievementsResponse>;
}

async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const response = await fetch(`${AIBTC_API_BASE}/leaderboard`);
  if (!response.ok) {
    throw new Error(`Leaderboard endpoint returned ${response.status}`);
  }
  return response.json() as Promise<LeaderboardResponse>;
}

function describeLeaderboardMovement(
  previousRank: number | null,
  currentRank: number | null,
  previousScore: number | null,
  currentScore: number | null
): string | null {
  if (currentRank === null && currentScore === null) {
    return null;
  }

  const notes: string[] = [];
  if (previousRank !== null && currentRank !== null && previousRank !== currentRank) {
    notes.push(
      currentRank < previousRank
        ? `rank improved from #${previousRank} to #${currentRank}`
        : `rank fell from #${previousRank} to #${currentRank}`
    );
  }

  if (previousScore !== null && currentScore !== null && previousScore !== currentScore) {
    notes.push(
      currentScore > previousScore
        ? `score increased from ${previousScore} to ${currentScore}`
        : `score fell from ${previousScore} to ${currentScore}`
    );
  }

  return notes.length > 0 ? notes.join("; ") : null;
}

export async function runRewardSync(
  address: string,
  checkedAt: string = new Date().toISOString()
): Promise<RewardSyncSummary> {
  const previousState = await readJsonOrNull<RewardSyncState>("data/state/reward-sync.json");
  const [inbox, achievements, leaderboard] = await Promise.all([
    fetchInbox(address),
    fetchAchievements(address),
    fetchLeaderboard()
  ]);

  const satsReceived = inbox.inbox?.economics?.satsReceived ?? 0;
  const previousSatsReceived =
    previousState?.address === address ? previousState.lastSatsReceived : 0;
  const satsDelta = Math.max(0, satsReceived - previousSatsReceived);

  const currentAgent =
    (leaderboard.leaderboard ?? []).find((entry) => entry.btcAddress === address) ?? null;
  const leaderboardRank = currentAgent?.rank ?? null;
  const leaderboardScore = currentAgent?.score ?? null;
  const previousRank =
    previousState?.address === address ? previousState.lastLeaderboardRank : null;
  const previousScore =
    previousState?.address === address ? previousState.lastLeaderboardScore : null;
  const leaderboardMovement = describeLeaderboardMovement(
    previousRank,
    leaderboardRank,
    previousScore,
    leaderboardScore
  );

  const achievementIds = (achievements.achievements ?? [])
    .map((achievement) => achievement.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .sort();
  const previousAchievementIds =
    previousState?.address === address ? previousState.lastAchievementIds : [];
  const newAchievements = achievementIds.filter((id) => !previousAchievementIds.includes(id));

  if (satsDelta > 0) {
    await logRewardOutcome(
      `network-earnings-${checkedAt}`,
      satsDelta,
      `${satsDelta} sats via x402 inbox`,
      checkedAt
    );
  }

  if (leaderboardMovement !== null || newAchievements.length > 0) {
    const notes: string[] = [];
    if (leaderboardMovement !== null) {
      notes.push(leaderboardMovement);
    }
    if (newAchievements.length > 0) {
      notes.push(`new achievements: ${newAchievements.join(", ")}`);
    }

    await logLeaderboardObservation(
      "network",
      leaderboardMovement,
      notes,
      checkedAt
    );
  }

  await writeJson("data/state/reward-sync.json", {
    address,
    lastCheckedAt: checkedAt,
    lastSatsReceived: satsReceived,
    lastLeaderboardRank: leaderboardRank,
    lastLeaderboardScore: leaderboardScore,
    lastAchievementIds: achievementIds
  } satisfies RewardSyncState);

  return {
    checkedAt,
    address,
    satsReceived,
    satsDelta,
    leaderboardRank,
    leaderboardScore,
    leaderboardMovement,
    newAchievements
  };
}
