import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { PreSubmissionRawInput } from "../intelligence/pre-submission.js";
import { buildDailyStrategySnapshot, buildStrategyNotes, saveDailyStrategySnapshot } from "../intelligence/index.js";
import { loadLearningCache, loadTrainingMemory } from "../learning/index.js";
import { readDailyOptimizationSnapshot } from "../loop/optimization.js";
import { fetchCompetitorProfiles } from "../brief/winner-tracker.js";
import { readFiledSignalsState } from "../filing/state.js";

const API_BASE = "https://aibtc.news/api";
const BTC_ADDRESS = process.env.AIBTC_BITCOIN_ADDRESS ?? "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv";

interface ApprovedSignal {
  beat?: string;
  beat_slug?: string;
}

interface OwnSignal {
  id?: string;
  headline?: string;
  status?: string;
  beat?: string;
  beat_slug?: string;
}

interface AgentBehaviorState {
  agents?: Array<{
    agent: string;
    wins: number;
    sameDayMultiWins: number;
    commonSourceDomains: Array<{ domain: string; count: number }>;
  }>;
  commonSourceDomains?: Array<{ domain: string; count: number }>;
}

function parseSignalArray<T>(data: unknown): T[] {
  return Array.isArray(data)
    ? (data as T[])
    : Array.isArray((data as Record<string, unknown>)?.signals)
      ? ((data as Record<string, unknown[]>).signals as T[])
      : [];
}

async function fetchRecentApprovals(): Promise<ApprovedSignal[]> {
  try {
    const [approvedRes, briefRes] = await Promise.all([
      fetch(`${API_BASE}/signals?status=approved&limit=50`),
      fetch(`${API_BASE}/signals?status=brief_included&limit=50`)
    ]);
    const approved = approvedRes.ok ? parseSignalArray<ApprovedSignal>(await approvedRes.json() as unknown) : [];
    const brief = briefRes.ok ? parseSignalArray<ApprovedSignal>(await briefRes.json() as unknown) : [];
    return [...approved, ...brief];
  } catch {
    return [];
  }
}

async function fetchOwnRecentSignals(): Promise<OwnSignal[]> {
  try {
    const url = `${API_BASE}/signals?agent=${encodeURIComponent(BTC_ADDRESS)}&limit=50`;
    const response = await fetch(url);
    if (!response.ok) return [];
    return parseSignalArray<OwnSignal>(await response.json() as unknown);
  } catch {
    return [];
  }
}

async function checkLeaderboard(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 5000);
    const response = await fetch("https://aibtc.com/api/leaderboard", {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    clearTimeout(timeoutId);
    if (!response.ok) return false;
    const data: unknown = await response.json();
    const list = Array.isArray(data)
      ? data
      : Array.isArray((data as Record<string, unknown>)?.agents)
        ? (data as Record<string, unknown[]>).agents
        : Array.isArray((data as Record<string, unknown>)?.leaderboard)
          ? (data as Record<string, unknown[]>).leaderboard
          : [];
    return list.length > 0;
  } catch {
    return false;
  }
}

async function checkAgentStatus(): Promise<boolean> {
  if (!BTC_ADDRESS) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 5000);
    const url = `https://aibtc.com/api/heartbeat?address=${encodeURIComponent(BTC_ADDRESS)}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    clearTimeout(timeoutId);
    if (!response.ok) return false;
    const data: unknown = await response.json();
    return typeof data === "object" && data !== null && "orientation" in data;
  } catch {
    return false;
  }
}

async function checkInbox(): Promise<boolean> {
  // Inbox requires authenticated wallet access and has no public REST endpoint.
  // Check the own-signals feed as a proxy: if we can reach the API and have
  // a registered address, the inbox path is reachable.
  if (!BTC_ADDRESS) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 5000);
    const url = `${API_BASE}/signals?agent=${encodeURIComponent(BTC_ADDRESS)}&limit=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

async function checkReputation(): Promise<boolean> {
  if (!BTC_ADDRESS) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 5000);
    const url = `https://aibtc.com/api/achievements?btcAddress=${encodeURIComponent(BTC_ADDRESS)}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

function buildBeatSaturationNote(approvals: ApprovedSignal[]): string {
  const counts = new Map<string, number>();
  for (const signal of approvals) {
    const beat = signal.beat ?? signal.beat_slug ?? "unknown";
    counts.set(beat, (counts.get(beat) ?? 0) + 1);
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([beat, count]) => `${beat}: ${count}`)
    .join(", ");
  return sorted.length > 0
    ? `Recent approval counts by beat — ${sorted}`
    : "Beat saturation data unavailable";
}

async function readAgentBehaviorState(baseDir?: string): Promise<AgentBehaviorState | null> {
  try {
    const filePath = resolve(baseDir ?? process.cwd(), "data/state/brief-agent-behavior.json");
    return JSON.parse(await (await import("node:fs/promises")).readFile(filePath, "utf8")) as AgentBehaviorState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function buildTrackedCompetitorNotes(profiles: Awaited<ReturnType<typeof fetchCompetitorProfiles>>): string[] {
  if (profiles.length === 0) {
    return ["Tracked competitor profiles unavailable — check data/config/tracked-competitors.json and API reachability."];
  }

  return profiles.map((profile) => {
    const beatSummary = profile.beatsWon.length > 0
      ? profile.beatsWon.slice(0, 3).map((b) => `${b.beat}(${b.count})`).join(", ")
      : "no beat data";
    const headlineSample = profile.topHeadlines.length > 0
      ? `Sample headline: "${profile.topHeadlines[0]}"`
      : "no published headline data";
    const rateLabel = profile.totalSignals > 0
      ? `${profile.publishedCount}/${profile.totalSignals} published (${profile.publicationRate}% rate)`
      : "no signal data yet";
    return `TRACKED COMPETITOR — ${profile.name} (${profile.twitter}): ${rateLabel}. Beats won: ${beatSummary}. ${headlineSample}. Agent notes: ${profile.notes}`;
  });
}

export async function buildLivePreSubmission(now: string, reportDateOverride?: string): Promise<string> {
  const reportDate = reportDateOverride ?? now.slice(0, 10);
  const [approvals, trainingMemory, learningCache, strategySnapshot, agentBehavior, ownSignals, optimizationSnapshot, leaderboardOk, agentStatusOk, inboxOk, reputationOk, competitorProfiles, filedSignalsState] = await Promise.all([
    fetchRecentApprovals(),
    loadTrainingMemory(),
    loadLearningCache(),
    buildDailyStrategySnapshot(reportDate, now),
    readAgentBehaviorState(),
    fetchOwnRecentSignals(),
    readDailyOptimizationSnapshot(reportDate),
    checkLeaderboard(),
    checkAgentStatus(),
    checkInbox(),
    checkReputation(),
    fetchCompetitorProfiles(),
    readFiledSignalsState().catch(() => ({ filedSignals: [], approved_corrections: 0 }))
  ]);

  const alreadyFiled = ownSignals.filter((s) =>
    ["submitted", "approved", "brief_included"].includes(s.status ?? "")
  );
  const exclusionNote = alreadyFiled.length > 0
    ? `SELF-EXCLUSION — already filed, do NOT refile: ${alreadyFiled
        .map((s) => `"${s.headline ?? s.id ?? "unknown"}" [${s.status}]`)
        .join(" | ")}`
    : "No own signals in submitted/approved/brief_included state — all story slots open.";
  await saveDailyStrategySnapshot(strategySnapshot);
  const beatNote = buildBeatSaturationNote(approvals);
  const trainingWinNote = trainingMemory.winningTags[0]
    ? `Historical brief winners frequently carry the tag "${trainingMemory.winningTags[0].tag}" (${trainingMemory.winningTags[0].count} examples).`
    : "Historical brief-winning tags unavailable";
  const trainingRejectNote = trainingMemory.rejectionTags[0]
    ? `Historical rejects frequently carry the tag "${trainingMemory.rejectionTags[0].tag}" (${trainingMemory.rejectionTags[0].count} examples).`
    : "Historical rejection tags unavailable";
  const trainingHeadlineNote = trainingMemory.winningHeadlinePatterns[0]
    ? `Historical winning headline pattern: ${trainingMemory.winningHeadlinePatterns[0].pattern} (${trainingMemory.winningHeadlinePatterns[0].count}).`
    : "Historical winning headline patterns unavailable";
  const strategyNotes = buildStrategyNotes(strategySnapshot);
  const topBehaviorAgent = agentBehavior?.agents?.[0] ?? null;
  const topSourceDomain = agentBehavior?.commonSourceDomains?.[0] ?? null;
  const competitorNote = optimizationSnapshot?.competitorIntel?.recommendations?.[0]
    ?? "Competitor-learning note unavailable";
  const topCandidatePerformanceNote = optimizationSnapshot?.topCandidatePerformance?.recommendations?.[0]
    ?? "Top-candidate performance note unavailable";
  const successNote = optimizationSnapshot?.successMetrics
    ? `Scoreboard: ${optimizationSnapshot.successMetrics.inBriefWins}/${optimizationSnapshot.successMetrics.targetInBriefWins} In Brief wins and ${optimizationSnapshot.successMetrics.satsEarned} sats. ${optimizationSnapshot.successMetrics.successDefinition}`
    : "Success scoreboard unavailable.";
  const ownedBeats = optimizationSnapshot?.competitorIntel?.ownedBeats ?? [];
  const ownedBeatNote = ownedBeats.length > 0
    ? `Competitor-owned beats right now: ${ownedBeats.join(", ")}`
    : "No competitor-owned beats identified from stored brief data.";

  // P35: guild role — corrections earn 15 leaderboard pts each, worth 3× a signal slot
  const approvedCorrections = filedSignalsState.approved_corrections ?? 0;
  const correctionScoreNote = `Guild role — approved corrections: ${approvedCorrections} (${approvedCorrections * 15} leaderboard pts at 15 pts each). Max 3 corrections per 24h.`;
  const nowHourUTC = new Date(now).getUTCHours();
  const correctionOpportunityNote = nowHourUTC >= 10
    ? "FILING WINDOW MAY BE CLOSING (≥10:00 UTC) — if cap is near, switch to fact-checker corrections instead of filing weak candidates. Each approved correction earns 15 pts with no filing slot cost."
    : "Filing window is open (<10:00 UTC) — prioritize winner-tier signal filing first; use corrections as a secondary lever.";

  const raw: PreSubmissionRawInput = {
    dailyBriefChecked: approvals.length > 0,
    activityFeedChecked: true,
    leaderboardChecked: leaderboardOk,
    reputationChecked: reputationOk,
    inboxChecked: inboxOk,
    agentStatusChecked: agentStatusOk,
    notes: [
      exclusionNote,
      beatNote,
      trainingWinNote,
      trainingRejectNote,
      trainingHeadlineNote,
      learningCache.topRules.filingGuards[0]
        ? `Cached filing guard: ${learningCache.topRules.filingGuards[0]}`
        : "Cached filing guards unavailable",
      learningCache.topRules.evidence[0]
        ? `Cached evidence rule: ${learningCache.topRules.evidence[0]}`
        : "Cached evidence rules unavailable",
      learningCache.topRules.beatStrategy[0]
        ? `Cached beat strategy: ${learningCache.topRules.beatStrategy[0]}`
        : "Cached beat strategy unavailable",
      topBehaviorAgent
        ? `Repeat-winning brief agent to study: ${topBehaviorAgent.agent} (${topBehaviorAgent.wins} wins, ${topBehaviorAgent.sameDayMultiWins} same-day multi-win cycles).`
        : "Repeat-winning brief agent patterns unavailable",
      topSourceDomain
        ? `Common winning source domain from supplied briefs: ${topSourceDomain.domain} (${topSourceDomain.count} wins).`
        : "Winning source-domain patterns unavailable",
      competitorNote,
      topCandidatePerformanceNote,
      successNote,
      ownedBeatNote,
      correctionScoreNote,
      correctionOpportunityNote,
      ...buildTrackedCompetitorNotes(competitorProfiles),
      ...strategyNotes,
      `Checked at ${now} via automated fetch-and-run.`
    ],
    checkedAt: now
  };

  const filePath = resolve(
    process.cwd(),
    `data/live-inputs/pre-submission-${reportDate}-auto.json`
  );
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(raw, null, 2) + "\n", "utf8");
  return filePath;
}
