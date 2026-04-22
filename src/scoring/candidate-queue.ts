import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchCompetitorProfiles, readBriefWinnerSnapshot, type CompetitorProfile } from "../brief/index.js";
import { assessBeatPublishability, type PublishabilityStatus } from "../filing/publishability.js";
import { assessEditorialCompetitiveness, type EditorialCompetitivenessStatus } from "./editorial-contract.js";
import type { DailyOptimizationSnapshot } from "../types/index.js";
import { fetchLiveSignals, jaccardSimilarity, runAutoGates, type AutoGateResult } from "./auto-gates.js";

export type TodayStrengthStatus =
  | "strong_enough_today"
  | "operator_relevant_but_weak_today"
  | "unknown";

interface SerializedSubmission {
  candidate_signal: {
    candidate_id: string;
    beat: string;
    detected_at?: string;
    summary?: string;
    causality?: string;
    likely_duplicate: boolean;
    uses_dashboard_as_primary_source: boolean;
    significance: string;
    duplicate_check_status?: string;
    staleness_risk?: string;
  };
  headline: string;
  proof?: Array<{
    query_result?: string;
    proof_note?: string;
  }>;
  sources?: Array<{
    source_type?: string;
    source_url?: string;
  }>;
  pre_submission_intelligence?: {
    notes?: string[];
    beat_status_today?: string;
  };
  validation_status?: {
    checks?: {
      duplicate_check_note?: string;
    };
  };
  submission_decision: {
    status?: string;
    submissionStatus?: "submit" | "reject";
    rejection_reasons?: string[];
    editorial_review?: {
      ready_to_file?: boolean;
    };
    hold_reasons?: string[];
  };
  editorial_review?: {
    editorial_fit?: "strong" | "borderline" | "weak";
    publisher_confidence?: "high" | "medium" | "low";
    ready_to_file?: boolean;
    hold_reasons?: string[];
  };
  candidate_metadata?: {
    style_tested?: string;
    competitor_reference?: string | null;
    why_this_style_was_chosen?: string;
    duplicate_status?: "clear" | "pending" | "flagged";
    freshness_status?: "clear" | "risk_unresolved" | "unknown";
    publishability_status?: PublishabilityStatus;
    filing_beat_slug?: string;
    why_this_beat_is_open?: string;
    why_now?: string;
    why_this_beats_same_day_competition?: string;
    primary_source_proof?: string;
    operator_action?: string;
  };
}

interface AgentBehaviorState {
  agents?: Array<{
    agent: string;
    wins: number;
    beats: string[];
    sameDayMultiWins: number;
    commonSourceDomains: Array<{ domain: string; count: number }>;
  }>;
  commonSourceDomains?: Array<{ domain: string; count: number }>;
}

interface HistoricalBriefSignals {
  preferredBeats: string[];
  prefersReleaseConsequence: boolean;
  prefersStructuralPatterns: boolean;
  prefersExactAnchors: boolean;
  preferredTopics: Array<{ topic: string; label: string; count: number }>;
}

interface RecentBriefOccupancyEntry {
  reportDate: string;
  headline: string;
  beat: string;
}

interface ScoreContext {
  optimization: DailyOptimizationSnapshot | null;
  briefSnapshot: Awaited<ReturnType<typeof readBriefWinnerSnapshot>>;
  agentBehavior: AgentBehaviorState | null;
  historicalBriefSignals: HistoricalBriefSignals;
  recentBriefOccupancy: RecentBriefOccupancyEntry[];
  competitorWinningAngles: string[];
  autoGate?: AutoGateResult;
  competitorProfiles?: CompetitorProfile[];
}

interface ParsedCandidateSubmission {
  sourcePath: string;
  submission: SerializedSubmission;
}

interface BriefCompetitionProof {
  whyThisBeatIsOpen: string;
  whyNow: string;
  whyThisBeatsSameDayCompetition: string;
  primarySourceProof: string;
  operatorAction: string;
}

interface ManualSubmissionArtifact {
  beat_slug?: string;
  headline?: string;
  analysis?: string;
  sources?: Array<{
    url?: string;
    title?: string;
  }>;
  disclosure?: string;
}

interface SignalJobContextReview {
  fileName: string;
  candidateId: string;
  headline: string;
  beat: string;
  accepted: boolean;
  preDraftAccepted: boolean;
  preDraftScore: number;
  reasons: string[];
}

interface SignalJobContextFile {
  kind?: string;
  queueDir?: string;
  queueFiles?: string[];
  reviews?: SignalJobContextReview[];
}

interface StalePruningRecord {
  kind: "stale_dry_run_pruning";
  reportDate: string;
  generatedAt: string;
  removedCount: number;
  removed: Array<{
    candidateId: string;
    headline: string;
    detectedAt: string | null;
    sourcePath: string;
    reason: string;
  }>;
}

export interface RankedCandidate {
  candidateId: string;
  beat: string;
  filingBeatSlug: string;
  headline: string;
  score: number;
  obviousBriefWinner?: boolean;
  decision: "file" | "hold" | "reject";
  styleTested: string;
  competitorReference: string | null;
  whyThisStyleWasChosen: string;
  duplicateStatus: "clear" | "pending" | "flagged";
  freshnessStatus: "clear" | "risk_unresolved" | "unknown";
  publishabilityStatus: PublishabilityStatus;
  publishabilityReasons: string[];
  competitivenessStatus: EditorialCompetitivenessStatus;
  competitivenessReasons: string[];
  todayStrengthStatus: TodayStrengthStatus;
  todayStrengthReasons: string[];
  competitorCoverage: Array<{ name: string; headline: string; similarity: number }>;
  reasons: string[];
  sourcePath: string;
}

function normalizeScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readOptimizationSnapshot(
  reportDate: string,
  baseDir?: string
): Promise<DailyOptimizationSnapshot | null> {
  const filePath = resolve(
    baseDir ?? process.cwd(),
    `data/experiments/optimization/${reportDate}.json`
  );

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as DailyOptimizationSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function isManualCheckOnly(rejectionReasons: string[]): boolean {
  return rejectionReasons.length > 0 && rejectionReasons.every((reason) =>
    [
      "leaderboard_not_checked",
      "reputation_not_checked",
      "inbox_not_checked",
      "agent_status_not_checked"
    ].includes(reason)
  );
}

function hasRawReleaseNoteShape(headline: string): boolean {
  return (
    /\bbug fixes?\b/i.test(headline) ||
    /\bcloses?\s+#\d+\b/i.test(headline) ||
    /\bv\d+\.\d+\.\d+\b/i.test(headline)
  );
}

function hasArtifactTitleShape(headline: string): boolean {
  const normalized = headline.trim().toLowerCase();
  return (
    /^\S+\s+ships\s+\S*?v\d+\.\d+/i.test(normalized) ||
    /^\S+:\s+/i.test(normalized) ||
    /\(#\d+\)/.test(headline) ||
    /\([0-9a-f]{7,}\)/i.test(headline)
  );
}

function inferHeadlinePattern(headline: string): string {
  const normalized = headline.toLowerCase();

  if (normalized.includes(" because ")) {
    return "because-causality";
  }
  if (normalized.includes(", signaling ")) {
    return "signaling-significance";
  }
  if (normalized.includes("which suggests")) {
    return "which-suggests-significance";
  }
  if (normalized.includes(" before ")) {
    return "before-advantage";
  }
  if (headline.length <= 90) {
    return "short-form";
  }
  if (headline.length <= 140) {
    return "full-length";
  }

  return "summary-led";
}

function extractDomain(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function readAgentBehaviorState(baseDir?: string): Promise<AgentBehaviorState | null> {
  const filePath = resolve(baseDir ?? process.cwd(), "data/state/brief-agent-behavior.json");

  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as AgentBehaviorState;
    return {
      agents: (parsed.agents ?? []).map((agent) => ({
        agent: agent.agent,
        wins: agent.wins,
        beats: Array.isArray(agent.beats) ? agent.beats : [],
        sameDayMultiWins: agent.sameDayMultiWins ?? 0,
        commonSourceDomains: Array.isArray(agent.commonSourceDomains) ? agent.commonSourceDomains : []
      })),
      commonSourceDomains: Array.isArray(parsed.commonSourceDomains) ? parsed.commonSourceDomains : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function getSubmissionStatus(submission: SerializedSubmission): "submit" | "reject" {
  if (submission.submission_decision.status === "submit" || submission.submission_decision.status === "reject") {
    return submission.submission_decision.status;
  }
  return submission.submission_decision.submissionStatus ?? "reject";
}

function getRejectionReasons(submission: SerializedSubmission): string[] {
  return submission.submission_decision.rejection_reasons ?? [];
}

function getEditorialReview(submission: SerializedSubmission): {
  editorialFit: "strong" | "borderline" | "weak";
  publisherConfidence: "high" | "medium" | "low";
  readyToFile: boolean;
  holdReasons: string[];
} {
  const topLevel = submission.editorial_review;
  const nested = submission.submission_decision.editorial_review;

  return {
    editorialFit: topLevel?.editorial_fit ?? "borderline",
    publisherConfidence: topLevel?.publisher_confidence ?? "low",
    readyToFile: topLevel?.ready_to_file ?? nested?.ready_to_file ?? false,
    holdReasons: topLevel?.hold_reasons ?? submission.submission_decision.hold_reasons ?? []
  };
}

async function readHistoricalBriefSignals(baseDir?: string): Promise<HistoricalBriefSignals> {
  const root = baseDir ?? process.cwd();
  // Brief JSON files are saved to data/briefs/ by ingestManualDailyBrief
  const briefsDir = resolve(root, "data/briefs");
  const correspondentsDir = resolve(root, "data/correspondents");
  const stateDir = resolve(root, "data/state");

  // Collect notes from manually ingested brief entry notes[]
  let briefFiles: string[] = [];
  try {
    briefFiles = (await readdir(briefsDir)).filter((f) => f.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const notes: string[] = [];
  for (const fileName of briefFiles) {
    const parsed = JSON.parse(
      await readFile(resolve(briefsDir, fileName), "utf8")
    ) as { entries?: Array<{ notes?: string[] }> };
    for (const entry of parsed.entries ?? []) {
      for (const note of entry.notes ?? []) {
        notes.push(note);
      }
    }
  }

  let correspondentFiles: string[] = [];
  try {
    correspondentFiles = (await readdir(correspondentsDir)).filter((f) => f.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const correspondentBeats: string[] = [];
  for (const fileName of correspondentFiles) {
    const parsed = JSON.parse(
      await readFile(resolve(correspondentsDir, fileName), "utf8")
    ) as {
      correspondents?: Array<{
        beats?: string[];
        notes?: string[];
        headlinePatterns?: string[];
      }>;
    };

    for (const correspondent of parsed.correspondents ?? []) {
      for (const beat of correspondent.beats ?? []) {
        correspondentBeats.push(beat);
      }
      for (const note of correspondent.notes ?? []) {
        notes.push(note);
      }
      for (const pattern of correspondent.headlinePatterns ?? []) {
        notes.push(pattern);
      }
    }
  }

  // Also read publishedSignals from auto-tracked brief-winners-*.json files
  let stateFiles: string[] = [];
  try {
    stateFiles = (await readdir(stateDir))
      .filter((f) => f.startsWith("brief-winners-") && f.endsWith(".json"))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const publishedHeadlines: string[] = [];
  const publishedBeats: string[] = [];
  for (const fileName of stateFiles) {
    const parsed = JSON.parse(
      await readFile(resolve(stateDir, fileName), "utf8")
    ) as { publishedSignals?: Array<{ headline: string; beat: string }> };
    for (const signal of parsed.publishedSignals ?? []) {
      publishedHeadlines.push(signal.headline);
      publishedBeats.push(signal.beat);
    }
  }

  const normalizedNotes = notes.map((note) => note.toLowerCase());
  const normalizedHeadlines = publishedHeadlines.map((h) => h.toLowerCase());
  const normalizedBeats = publishedBeats.map((b) => b.toLowerCase());
  const normalizedCorrespondentBeats = correspondentBeats.map((b) => b.toLowerCase());

  // Accepted filing beats for this agent. Other public aibtc.news beats are intentionally excluded.
  const beatVocabulary = [
    "aibtc-network",
    "bitcoin-macro",
    "quantum"
  ];

  const preferredBeats = beatVocabulary
    .filter((beat) =>
      normalizedNotes.some((note) => note.includes(beat)) ||
      normalizedBeats.some((b) => b === beat) ||
      normalizedCorrespondentBeats.some((b) => b === beat)
    );

  const prefersReleaseConsequence =
    normalizedNotes.some((note) =>
      note.includes("release or pr plus operator consequence") ||
      note.includes("release-driven stories won")
    ) ||
    normalizedHeadlines.some((h) =>
      /\brelease[sd]?\b|\bv\d+\.\d+\b|\bupgrade[sd]?\b/.test(h) && hasOperatorConsequence(h)
    );

  const prefersStructuralPatterns =
    normalizedNotes.some((note) =>
      note.includes("structural pattern") ||
      note.includes("bottleneck") ||
      note.includes("saturation")
    ) ||
    normalizedHeadlines.some((h) => hasStructuralPattern(h));

  const prefersExactAnchors =
    normalizedNotes.some((note) =>
      note.includes("exact numbers") ||
      note.includes("versions") ||
      note.includes("thresholds") ||
      note.includes("release tags")
    ) ||
    normalizedHeadlines.some((h) => hasExactAnchor(h));

  const topicCounts = new Map<string, { label: string; count: number }>();
  for (const text of [...notes, ...publishedHeadlines]) {
    for (const topic of detectBriefTopics(text)) {
      const existing = topicCounts.get(topic.topic);
      topicCounts.set(topic.topic, {
        label: topic.label,
        count: (existing?.count ?? 0) + 1
      });
    }
  }
  const preferredTopics = [...topicCounts.entries()]
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
    .map(([topic, value]) => ({ topic, label: value.label, count: value.count }));

  return {
    preferredBeats,
    prefersReleaseConsequence,
    prefersStructuralPatterns,
    prefersExactAnchors,
    preferredTopics
  };
}

function inferWinningAngle(text: string): string | null {
  const normalized = text.toLowerCase();

  if (/\bdependency risk\b|\bconcentration\b|\bgap\b|\btrap\b|\brisk\b/.test(normalized)) {
    return "structural-risk";
  }

  if (/\binstead of\b|\bafter \d+s instead of \d+s\b|\btimeout\b|\blatency\b|\bfaster\b|\bslower\b/.test(normalized)) {
    return "measured-operator-improvement";
  }

  if (/\btop \d+\b|\b\d+%\b|\bmarket formation\b|\btaxonomy\b|\bpool\b|\bshare\b/.test(normalized)) {
    return "market-structure";
  }

  return null;
}

const OCCUPANCY_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "that",
  "this",
  "when",
  "than",
  "have",
  "will",
  "your",
  "after",
  "before",
  "during",
  "through",
  "across",
  "agent",
  "agents",
  "operator",
  "operators",
  "workflows",
  "workflow",
  "skills",
  "skill",
  "stacks"
]);

function extractVersionAnchors(text: string): string[] {
  return [...text.toLowerCase().matchAll(/\bv\d+\.\d+(?:\.\d+)?\b/g)].map((match) => match[0]);
}

function extractSignificantTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !OCCUPANCY_STOPWORDS.has(token))
  );
}

function recentBriefOccupancyMatch(
  candidateHeadline: string,
  winnerHeadline: string
): boolean {
  const normalizedCandidate = candidateHeadline.trim().toLowerCase();
  const normalizedWinner = winnerHeadline.trim().toLowerCase();

  if (normalizedCandidate === normalizedWinner) {
    return true;
  }

  const similarity = jaccardSimilarity(candidateHeadline, winnerHeadline);
  if (similarity >= 0.5) {
    return true;
  }

  const candidateVersions = extractVersionAnchors(candidateHeadline);
  const winnerVersions = extractVersionAnchors(winnerHeadline);
  const sharedVersion = candidateVersions.some((version) => winnerVersions.includes(version));

  const candidateTokens = extractSignificantTokens(candidateHeadline);
  const winnerTokens = extractSignificantTokens(winnerHeadline);
  const sharedTokens = [...candidateTokens].filter((token) => winnerTokens.has(token));

  if (sharedVersion && sharedTokens.length >= 2) {
    return true;
  }

  return similarity >= 0.3 && sharedTokens.length >= 3;
}

async function readRecentBriefOccupancy(
  reportDate: string,
  baseDir?: string
): Promise<RecentBriefOccupancyEntry[]> {
  const root = baseDir ?? process.cwd();
  const stateDir = resolve(root, "data/state");

  let stateFiles: string[] = [];
  try {
    stateFiles = (await readdir(stateDir))
      .filter((fileName) => fileName.startsWith("brief-winners-") && fileName.endsWith(".json"))
      .sort()
      .filter((fileName) => fileName.slice("brief-winners-".length, "brief-winners-".length + 10) < reportDate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const recentFiles = stateFiles.slice(-2);
  const entries: RecentBriefOccupancyEntry[] = [];
  for (const fileName of recentFiles) {
    const parsed = JSON.parse(
      await readFile(resolve(stateDir, fileName), "utf8")
    ) as { reportDate?: string; publishedSignals?: Array<{ headline: string; beat: string }> };
    for (const signal of parsed.publishedSignals ?? []) {
      entries.push({
        reportDate: parsed.reportDate ?? fileName.replace(/^brief-winners-/, "").replace(/\.json$/, ""),
        headline: signal.headline,
        beat: signal.beat
      });
    }
  }

  return entries;
}

const BRIEF_TOPIC_PATTERNS: Array<{
  topic: string;
  label: string;
  patterns: RegExp[];
}> = [
  {
    topic: "queue-bottleneck",
    label: "queue or bottleneck pressure",
    patterns: [/\bqueue\b/i, /\bbottleneck\b/i, /\bbacklog\b/i, /\bsaturation\b/i, /\bcongestion\b/i]
  },
  {
    topic: "upgrade-window",
    label: "upgrade windows and activation deadlines",
    patterns: [/\brequired upgrade\b/i, /\bupgrade before\b/i, /\bactivation\b/i, /\bdeadline\b/i, /\bwindow\b/i]
  },
  {
    topic: "api-registry-signals",
    label: "API, registry, heartbeat, or leaderboard signals",
    patterns: [/\bapi\b/i, /\bregistry\b/i, /\bheartbeat\b/i, /\bleaderboard\b/i, /\bendpoint\b/i]
  },
  {
    topic: "security-mitigation",
    label: "security exposure and mitigation",
    patterns: [/\bsecurity\b/i, /\bexploit\b/i, /\bvulnerab/i, /\bmitigation\b/i, /\bpatch\b/i]
  },
  {
    topic: "market-structure",
    label: "market structure and concentration",
    patterns: [/\bmarket structure\b/i, /\bconcentration\b/i, /\bmarket formation\b/i, /\bshare\b/i, /\btop \d+\b/i]
  },
  {
    topic: "release-proof",
    label: "release proof and shipping changes",
    patterns: [/\brelease\b/i, /\bships\b/i, /\btag\b/i, /\bv\d+\.\d+(?:\.\d+)?\b/i, /\bpr\s*#\d+\b/i]
  }
];

function detectBriefTopics(text: string): Array<{ topic: string; label: string }> {
  const matches: Array<{ topic: string; label: string }> = [];
  for (const entry of BRIEF_TOPIC_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) {
      matches.push({ topic: entry.topic, label: entry.label });
    }
  }
  return matches;
}

function getTodayWinningAngles(
  briefSnapshot: Awaited<ReturnType<typeof readBriefWinnerSnapshot>>
): string[] {
  const counts = new Map<string, number>();
  for (const signal of briefSnapshot?.publishedSignals ?? []) {
    const angle = inferWinningAngle(signal.headline);
    if (angle) {
      counts.set(angle, (counts.get(angle) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([angle]) => angle);
}

function getTodayWinningTopics(
  briefSnapshot: Awaited<ReturnType<typeof readBriefWinnerSnapshot>>
): Array<{ topic: string; label: string }> {
  const counts = new Map<string, { label: string; count: number }>();
  for (const signal of briefSnapshot?.publishedSignals ?? []) {
    for (const match of detectBriefTopics(signal.headline)) {
      const existing = counts.get(match.topic);
      counts.set(match.topic, {
        label: match.label,
        count: (existing?.count ?? 0) + 1
      });
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
    .map(([topic, value]) => ({ topic, label: value.label }));
}

function assessTodayBriefStrength(
  submission: SerializedSubmission,
  briefSnapshot: Awaited<ReturnType<typeof readBriefWinnerSnapshot>>,
  candidateContextText: string,
  operatorConsequence: boolean,
  broadWinnerShape: boolean,
  exactAnchor: boolean,
  candidateWinningAngle: string | null
): {
  status: TodayStrengthStatus;
  reasons: string[];
} {
  const publishedSignals = briefSnapshot?.publishedSignals ?? [];
  if (publishedSignals.length === 0) {
    return {
      status: "unknown",
      reasons: ["today brief strength check unavailable because no pasted brief winners were ingested"]
    };
  }

  const winnerHeadlines = publishedSignals.map((signal) => signal.headline);
  const winnerAngles = getTodayWinningAngles(briefSnapshot);
  const winnerTopics = getTodayWinningTopics(briefSnapshot);
  const candidateTopics = detectBriefTopics(candidateContextText);
  const matchedTopicLabels = candidateTopics
    .filter((topic) => winnerTopics.some((winnerTopic) => winnerTopic.topic === topic.topic))
    .map((topic) => topic.label);
  const winnersWithExactAnchors = winnerHeadlines.filter((headline) => hasExactAnchor(headline)).length;
  const winnersWithBroadShape = winnerHeadlines.filter((headline) =>
    hasBroadWinnerShape(
      {
        ...submission,
        headline,
        candidate_signal: {
          ...submission.candidate_signal,
          summary: headline,
          significance: headline,
          causality: headline
        }
      },
      headline
    )
  ).length;
  const winnersWithOperatorConsequence = winnerHeadlines.filter((headline) =>
    hasOperatorConsequence(headline)
  ).length;
  const beatOccupied = briefSnapshot?.occupiedBeats.includes(submission.candidate_signal.beat) ?? false;
  const repeatWinnerPressure = (briefSnapshot?.repeatWinners.length ?? 0) > 0;

  let misses = 0;
  const reasons: string[] = [];

  if (!operatorConsequence) {
    misses += 1;
    reasons.push("today brief mismatch: operator consequence is not explicit enough for the current winner set");
  } else {
    reasons.push("today brief match: operator consequence is explicit");
  }

  if (winnersWithExactAnchors >= Math.ceil(publishedSignals.length * 0.4)) {
    if (exactAnchor) {
      reasons.push("today brief match: uses the exact numeric/version anchors that today’s winners keep using");
    } else {
      misses += 1;
      reasons.push("today brief mismatch: today’s winners lean on exact anchors and this candidate does not");
    }
  }

  if (winnerAngles.length > 0) {
    if (candidateWinningAngle && winnerAngles.includes(candidateWinningAngle)) {
      reasons.push(`today brief match: fits a winning angle landing today (${candidateWinningAngle})`);
    } else {
      misses += 1;
      reasons.push("today brief mismatch: does not match the concrete operator angles winning in the pasted brief");
    }
  }

  if (winnerTopics.length > 0) {
    if (matchedTopicLabels.length > 0) {
      reasons.push(
        `today brief match: aligns with the concrete topics winning today (${[...new Set(matchedTopicLabels)].join(", ")})`
      );
    } else {
      misses += 1;
      reasons.push("today brief mismatch: misses the concrete topics already winning the pasted brief");
    }
  }

  if (winnersWithBroadShape >= Math.ceil(publishedSignals.length * 0.3)) {
    if (broadWinnerShape) {
      reasons.push("today brief match: packaged broadly enough to compete with today’s winner style");
    } else {
      misses += 1;
      reasons.push("today brief mismatch: packaging is narrower than the stronger same-day winners");
    }
  }

  if (beatOccupied && repeatWinnerPressure && !broadWinnerShape && candidateWinningAngle === null) {
    misses += 1;
    reasons.push("today brief mismatch: occupied beat plus repeat-winner pressure requires a stronger differentiating angle");
  }

  if (winnersWithOperatorConsequence === 0 && operatorConsequence) {
    reasons.push("today brief note: winners are less explicit than this candidate, so the operator-consequence edge still helps");
  }

  return {
    status: misses === 0 ? "strong_enough_today" : "operator_relevant_but_weak_today",
    reasons
  };
}

async function readCompetitorWinningAngles(
  reportDate: string,
  baseDir?: string
): Promise<string[]> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/reports/competitor-review/${reportDate}.json`);

  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as {
      whoWonToday?: Array<{ headlines?: string[] }>;
    };
    const angles = new Map<string, number>();

    for (const winner of parsed.whoWonToday ?? []) {
      for (const headline of winner.headlines ?? []) {
        const angle = inferWinningAngle(headline);
        if (angle) {
          angles.set(angle, (angles.get(angle) ?? 0) + 1);
        }
      }
    }

    return [...angles.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([angle]) => angle);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function hasExactAnchor(headline: string): boolean {
  return /\b\d[\d,.]*(?:\s?(?:k|m|b|sats?|sat|stx|btc|%))?\b/i.test(headline) || /\bv\d+\.\d+(?:\.\d+)?\b/i.test(headline);
}

function hasStructuralPattern(text: string): boolean {
  return /\bcluster|gap|bottleneck|threshold|saturation|queue|concentration|backlog|lead|dominat/i.test(text);
}

function hasOperatorConsequence(text: string): boolean {
  return /\bagents should\b|\boperators should\b|\boperators may need\b|\bmatters because\b|\brequires\b|\bneed to review\b|\breview before\b|\bupgrade\b|\brisk\b|\bwindow\b|\bconsequence\b|\breduces?\b|\bprevents?\b|\bkeeps?\b|\bclears?\b|\bstops?\b|\brestores?\b|\bavoids?\b/i.test(text);
}

function sourceUrlSignalsBitcoinEcosystem(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    const hostname = parsed.hostname.replace(/^www\./, "");

    if (
      hostname === "aibtc.com" ||
      hostname === "aibtc.news" ||
      hostname === "hiro.so" ||
      hostname === "stacks.co" ||
      hostname === "docs.stacks.co" ||
      hostname === "mempool.space"
    ) {
      return true;
    }

    if (hostname === "github.com") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const owner = segments[0] ?? "";
      if (owner === "aibtcdev" || owner === "stacks-network") {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// Security beat: headline must name one of these specific components to pass the relevance gate.
// Generic Bitcoin wallet or security stories fail even if "bitcoin" appears in the headline.
const SECURITY_ALLOWED_COMPONENTS = /\b(x402|aibtcdev|stacks-network|hiro|clarity|sbtc)\b/i;

// Ecosystem keywords checked against the headline for non-security beats.
const ECOSYSTEM_KEYWORDS = /\b(aibtc|bitcoin|btc|sbtc|stacks|stx|x402|ordinals|runes|hiro|clarity|mempool)\b/i;

function hasBitcoinEcosystemRelevance(
  submission: SerializedSubmission
): boolean {
  const sourceUrls = (submission.sources ?? [])
    .map((source) => source.source_url)
    .filter((value): value is string => typeof value === "string");

  const beat = submission.candidate_signal.beat;

  // Source URLs are the primary signal — ecosystem-specific source is sufficient for non-security beats.
  if (sourceUrls.some(sourceUrlSignalsBitcoinEcosystem)) {
    // External security stories require the headline to name a specific allowed component even when
    // the source URL already signals the ecosystem. This blocks generic wallet/security rewrites.
    if (beat === "security") {
      return SECURITY_ALLOWED_COMPONENTS.test(submission.headline);
    }
    return true;
  }

  // For the security beat without an ecosystem source URL, the headline must name a specific
  // allowed component. "bitcoin" or "btc" alone in the headline is not sufficient.
  if (beat === "security") {
    return SECURITY_ALLOWED_COMPONENTS.test(submission.headline);
  }

  // Headline is the second signal for all other beats.
  // Summary, significance, causality, and other agent-written prose are not consulted.
  if (ECOSYSTEM_KEYWORDS.test(submission.headline)) {
    return true;
  }

  // Beat is soft secondary support only — not sufficient on its own.
  return false;
}

function isRawReleaseWithoutOperatorConsequence(
  submission: SerializedSubmission,
  operatorConsequence: boolean
): boolean {
  return (
    (hasRawReleaseNoteShape(submission.headline) || hasArtifactTitleShape(submission.headline)) &&
    !operatorConsequence
  );
}

function hasBroadWinnerShape(submission: SerializedSubmission, text: string): boolean {
  const numericAnchors = submission.headline.match(/\b\d[\d,.]*\b/g) ?? [];
  return (
    /\b(and|plus|simultaneous|bundle|bundled|combined|cluster)\b/i.test(submission.headline) ||
    /\bbroader\b|\bstructural\b|\bsystem\b|\bnetwork-level\b|\bnetwork wide\b/i.test(text) ||
    numericAnchors.length >= 2
  );
}

function inferStyleTestedFromSubmission(
  submission: SerializedSubmission,
  contextText: string,
  broadWinnerShape: boolean,
  operatorConsequence: boolean,
  structuralPattern: boolean,
  exactAnchor: boolean
): string {
  if (submission.candidate_metadata?.style_tested) {
    return submission.candidate_metadata.style_tested;
  }

  if (broadWinnerShape && operatorConsequence) {
    return "broad_same_beat_operator";
  }

  if ((submission.sources ?? []).some((source) => source.source_url?.includes("github.com")) && operatorConsequence) {
    return "release_operator_consequence";
  }

  if (structuralPattern) {
    return "structural_pattern";
  }

  if (exactAnchor && /\bbefore|early|same day|deadline|activation\b/i.test(contextText)) {
    return "exact_anchor_timing";
  }

  return "single_story_operator_angle";
}

function inferCompetitorReferenceFromSubmission(
  submission: SerializedSubmission,
  dominantBeatOwners: Array<{ agent: string }>,
  topWinningDomains: Array<{ domain: string; count: number }>
): string | null {
  if (submission.candidate_metadata?.competitor_reference !== undefined) {
    return submission.candidate_metadata.competitor_reference ?? null;
  }

  if (dominantBeatOwners[0]) {
    return `${dominantBeatOwners[0].agent} is a repeat winner on ${submission.candidate_signal.beat}`;
  }

  if (topWinningDomains[0]) {
    return `${topWinningDomains[0].domain} is a recent winning source domain`;
  }

  return null;
}

function inferWhyStyleWasChosen(
  submission: SerializedSubmission,
  styleTested: string,
  exactAnchor: boolean,
  operatorConsequence: boolean,
  broadWinnerShape: boolean
): string {
  if (submission.candidate_metadata?.why_this_style_was_chosen) {
    return submission.candidate_metadata.why_this_style_was_chosen;
  }

  const reasons: string[] = [];
  if (exactAnchor) {
    reasons.push("uses a hard anchor");
  }
  if (operatorConsequence) {
    reasons.push("frames a direct operator consequence");
  }
  if (broadWinnerShape) {
    reasons.push("tests the broader same-beat package instead of a narrow fragment");
  }
  if ((submission.sources ?? []).some((source) => source.source_url?.includes("github.com"))) {
    reasons.push("leans on release-grade proof");
  }

  return reasons.length > 0
    ? `${styleTested}: ${reasons.join("; ")}`
    : `${styleTested}: chosen as the strongest available style from current evidence`;
}

function readBriefCompetitionProof(
  submission: SerializedSubmission
): BriefCompetitionProof {
  const metadata = submission.candidate_metadata ?? {};

  return {
    whyThisBeatIsOpen: metadata.why_this_beat_is_open?.trim() ?? "",
    whyNow: metadata.why_now?.trim() ?? "",
    whyThisBeatsSameDayCompetition: metadata.why_this_beats_same_day_competition?.trim() ?? "",
    primarySourceProof: metadata.primary_source_proof?.trim() ?? "",
    operatorAction: metadata.operator_action?.trim() ?? ""
  };
}

function hasStrongTerminalPunctuation(text: string): boolean {
  return /[.!?]$/.test(text.trim());
}

function evaluateBriefCompetitionProof(
  proof: BriefCompetitionProof
): { ready: boolean; reasons: string[] } {
  const hasExplicitCompetitionFields = [
    proof.whyThisBeatIsOpen,
    proof.whyNow,
    proof.whyThisBeatsSameDayCompetition,
    proof.primarySourceProof,
    proof.operatorAction
  ].some((value) => value.trim().length > 0);
  if (!hasExplicitCompetitionFields) {
    // Backward-compatibility for legacy dry-run fixtures that predate the explicit brief-competition contract.
    return { ready: true, reasons: [] };
  }

  const reasons: string[] = [];
  const minLen = 24;
  const addMissingOrWeak = (label: string, value: string) => {
    if (!value.trim()) {
      reasons.push(`brief competition proof missing: ${label}`);
      return;
    }
    if (value.trim().length < minLen) {
      reasons.push(`brief competition proof weak: ${label} is too short`);
    }
    if (!hasStrongTerminalPunctuation(value)) {
      reasons.push(`brief competition proof weak: ${label} must end with terminal punctuation`);
    }
  };

  addMissingOrWeak("why_this_beat_is_open", proof.whyThisBeatIsOpen);
  addMissingOrWeak("why_now", proof.whyNow);
  addMissingOrWeak("why_this_beats_same_day_competition", proof.whyThisBeatsSameDayCompetition);
  addMissingOrWeak("primary_source_proof", proof.primarySourceProof);
  addMissingOrWeak("operator_action", proof.operatorAction);

  if (proof.whyThisBeatIsOpen && !/\bopen\b|\bslot\b|\bbeat\b|\bcrowd|\bcoverage\b|\bwindow\b/i.test(proof.whyThisBeatIsOpen)) {
    reasons.push("brief competition proof weak: why_this_beat_is_open must explain beat-slot pressure or gap");
  }
  if (proof.whyNow && !/\bnow\b|\btoday\b|\bsame day\b|\bbefore\b|\bwindow\b|\bdeadline\b|\blive\b|\bcurrent\b|\bthis cycle\b|\b\d{4}-\d{2}-\d{2}\b/i.test(proof.whyNow)) {
    reasons.push("brief competition proof weak: why_now must include concrete timing urgency");
  }
  if (proof.whyThisBeatsSameDayCompetition && !/\bbeat\b|\boutcompete\b|\bbroader\b|\bstronger\b|\bdifferentiat|\bcompetition\b|\bsame-day\b|\bslot\b/i.test(proof.whyThisBeatsSameDayCompetition)) {
    reasons.push("brief competition proof weak: why_this_beats_same_day_competition must explain displacement versus same-day competition");
  }
  if (proof.primarySourceProof && !/\bhttps?:\/\/\S+/i.test(proof.primarySourceProof)) {
    reasons.push("brief competition proof weak: primary_source_proof must include an exact source URL");
  }
  if (proof.primarySourceProof && !hasExactAnchor(proof.primarySourceProof)) {
    reasons.push("brief competition proof weak: primary_source_proof must include an exact anchor");
  }
  if (proof.operatorAction && !hasOperatorConsequence(proof.operatorAction)) {
    reasons.push("brief competition proof weak: operator_action must contain an explicit operator action");
  }

  return {
    ready: reasons.length === 0,
    reasons
  };
}

function isAibtcNativeSource(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === "github.com") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments[0] === "aibtcdev";
    }

    return parsed.hostname === "aibtc.news" || parsed.hostname === "aibtc.com";
  } catch {
    return false;
  }
}

function isAibtcNativeOperatorStory(
  submission: SerializedSubmission,
  contextText: string,
  operatorConsequence: boolean
): boolean {
  const sourceUrls = (submission.sources ?? [])
    .map((source) => source.source_url)
    .filter((value): value is string => typeof value === "string");

  return operatorConsequence && sourceUrls.some(isAibtcNativeSource) && !readsLikeGenericExternalAdaptation(submission);
}

function hasConcreteNetworkAnchor(text: string): boolean {
  return /\b(aibtc|agent-news|landing-page|mcp-server|x402|sbtc|beat|brief|correspondent|genesis|leaderboard|heartbeat|inbox|service registry|relay)\b/i.test(text);
}

function isExternalWithoutAibtcNetworkActivity(
  submission: SerializedSubmission,
  contextText: string
): boolean {
  const sourceUrls = (submission.sources ?? [])
    .map((source) => source.source_url)
    .filter((value): value is string => typeof value === "string");
  return sourceUrls.length > 0 && !sourceUrls.some(isAibtcNativeSource) && !hasConcreteNetworkAnchor(contextText);
}

function isRawDataWithoutThesis(
  submission: SerializedSubmission,
  contextText: string,
  operatorConsequence: boolean,
  structuralPattern: boolean
): boolean {
  const baselineShape = /\b(baseline|snapshot|submitted|approved|rejected|unknown|moved from|page \d+ of \d+|delta|membership)\b/i;
  const countAnchor = /\b\d[\d,.]*\b/.test(contextText);
  return baselineShape.test(`${submission.headline} ${contextText}`) && countAnchor && !operatorConsequence && !structuralPattern;
}

function isGenericOperationalAdvice(
  submission: SerializedSubmission,
  contextText: string,
  exactAnchor: boolean,
  structuralPattern: boolean
): boolean {
  const colonLedSpeaker = /^[A-Z][a-z]+(?: [A-Z][a-z]+)*:/.test(submission.headline);
  const adviceShape = /\b(process-control|deterministic claim templates?|verification gates?|preflight|sequencing|payload structure|first-pass progression|false-ready states|multi-wallet publishing loops|one-x-account-per-agent|activity logs)\b/i;
  return (colonLedSpeaker || adviceShape.test(contextText)) && !exactAnchor && !structuralPattern;
}

function inferDuplicateStatus(
  submission: SerializedSubmission,
  pendingDuplicateRisk: boolean,
  autoGate?: AutoGateResult
): "clear" | "pending" | "flagged" {
  if (autoGate?.duplicateStatus === "flagged") return "flagged";
  if (autoGate?.duplicateStatus === "pending") return "pending";
  if (submission.candidate_metadata?.duplicate_status) {
    return submission.candidate_metadata.duplicate_status;
  }
  if (submission.candidate_signal.likely_duplicate) return "flagged";
  if (pendingDuplicateRisk) return "pending";
  return "clear";
}

function inferFreshnessStatus(
  submission: SerializedSubmission,
  freshnessRisk: boolean,
  autoGate?: AutoGateResult
): "clear" | "risk_unresolved" | "unknown" {
  if (autoGate !== undefined) return autoGate.freshnessStatus;
  if (submission.candidate_metadata?.freshness_status) {
    return submission.candidate_metadata.freshness_status;
  }
  if (freshnessRisk) return "risk_unresolved";
  return "unknown";
}

function buildCandidateContextText(submission: SerializedSubmission): string {
  return [
    submission.headline,
    submission.candidate_signal.summary,
    submission.candidate_signal.significance,
    submission.candidate_signal.causality,
    ...(submission.proof ?? []).flatMap((item) => [item.query_result, item.proof_note])
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
}

function hasRequiredUpgradeWindow(text: string): boolean {
  return /\brequired upgrade\b|\bgenesis sync\b|\bactivation\b|\bbitcoin block\b|\bupgrade before\b/i.test(text);
}

function readsLikeGenericExternalAdaptation(submission: SerializedSubmission): boolean {
  const sourceTypes = [...new Set(
    (submission.sources ?? [])
      .map((source) => source.source_type)
      .filter((value): value is string => typeof value === "string")
  )];
  const contextText = buildCandidateContextText(submission);

  return (
    sourceTypes.length > 0 &&
    sourceTypes.every((value) => value === "live-feed") &&
    /published this event/i.test(submission.candidate_signal.causality ?? "") &&
    !hasStructuralPattern(contextText) &&
    !hasRequiredUpgradeWindow(contextText)
  );
}

function hasPendingDuplicateRisk(submission: SerializedSubmission): boolean {
  const signals = [
    submission.candidate_signal.duplicate_check_status,
    submission.validation_status?.checks?.duplicate_check_note,
    ...(submission.pre_submission_intelligence?.notes ?? [])
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  return (
    /\bpending\b/.test(signals) &&
    /\bduplicate\b/.test(signals)
  ) || /\bmanual check required\b/.test(signals);
}

function hasFreshnessRisk(submission: SerializedSubmission): boolean {
  const stale = submission.candidate_signal.staleness_risk?.toLowerCase() ?? "";
  return stale.length > 0;
}

function extractPrimarySourceRepo(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return parsed.hostname.replace(/^www\./, "");
    }

    return `${parsed.hostname.replace(/^www\./, "")}/${segments[0]}/${segments[1]}`;
  } catch {
    return null;
  }
}

function extractActivationAnchor(text: string): string | null {
  const blockMatch = text.match(/\bblock\s+(\d[\d,]*)\b/i);
  if (blockMatch) {
    return `block:${blockMatch[1]}`;
  }

  const dateMatch = text.match(/\bactivation is estimated for ([^.]+)/i);
  if (dateMatch) {
    return `activation:${dateMatch[1].trim().toLowerCase()}`;
  }

  return null;
}

function isComponentRelease(submission: SerializedSubmission): boolean {
  const text = `${submission.candidate_signal.candidate_id} ${submission.headline}`.toLowerCase();
  return /\bsigner\b|\bplugin\b|\bsdk\b|\bworker\b|\bcli\b/.test(text);
}

function applyCompanionReleaseAdjustments(
  rankedCandidates: RankedCandidate[],
  parsedSubmissions: ParsedCandidateSubmission[]
): void {
  const rankedById = new Map(rankedCandidates.map((candidate) => [candidate.candidateId, candidate]));
  const grouped = new Map<string, SerializedSubmission[]>();

  for (const { submission } of parsedSubmissions) {
    const primarySource = (submission.sources ?? []).find((source) => source.source_url)?.source_url;
    const repo = extractPrimarySourceRepo(primarySource);
    const activationAnchor = extractActivationAnchor(buildCandidateContextText(submission));

    if (!repo || !activationAnchor) {
      continue;
    }

    const key = `${repo}::${activationAnchor}`;
    const existing = grouped.get(key) ?? [];
    existing.push(submission);
    grouped.set(key, existing);
  }

  for (const submissions of grouped.values()) {
    if (submissions.length < 2) {
      continue;
    }

    const canonical = submissions.find((submission) => !isComponentRelease(submission)) ?? submissions[0];
    const canonicalRanked = rankedById.get(canonical.candidate_signal.candidate_id);
    if (canonicalRanked) {
      canonicalRanked.score = normalizeScore(canonicalRanked.score + 6);
      canonicalRanked.reasons.push("paired-release cluster detected; this is the broader primary release story");
    }

    for (const submission of submissions) {
      if (submission.candidate_signal.candidate_id === canonical.candidate_signal.candidate_id) {
        continue;
      }

      const ranked = rankedById.get(submission.candidate_signal.candidate_id);
      if (!ranked) {
        continue;
      }

      ranked.score = normalizeScore(ranked.score - 8);
      ranked.reasons.push("paired-release cluster detected; this companion release is better folded into the broader primary story");
    }
  }
}

async function scoreCandidate(
  submission: SerializedSubmission,
  context: ScoreContext
): Promise<Omit<RankedCandidate, "sourcePath">> {
  const { optimization, briefSnapshot, agentBehavior, historicalBriefSignals, recentBriefOccupancy, competitorWinningAngles, autoGate } = context;
  let score = 50;
  const reasons: string[] = [];
  const submissionStatus = getSubmissionStatus(submission);
  const rejectionReasons = getRejectionReasons(submission);
  const editorialReview = getEditorialReview(submission);
  const manualCheckOnlyBlocked = isManualCheckOnly(rejectionReasons);
  const pendingDuplicateRisk =
    hasPendingDuplicateRisk(submission) || autoGate?.duplicateStatus === "pending";
  const freshnessRisk =
    hasFreshnessRisk(submission) || autoGate?.freshnessStatus === "risk_unresolved";
  const sourceDomains = [...new Set(
    (submission.sources ?? [])
      .map((source) => source.source_url)
      .filter((value): value is string => typeof value === "string")
      .map((value) => extractDomain(value))
      .filter((value): value is string => value !== null)
  )];
  const topWinningDomains = (agentBehavior?.commonSourceDomains ?? []).slice(0, 5);
  const winningDomainMatches = topWinningDomains.filter((item) => sourceDomains.includes(item.domain));
  const beatOwners = (agentBehavior?.agents ?? []).filter((agent) =>
    agent.beats.includes(submission.candidate_signal.beat)
  );
  const dominantBeatOwners = beatOwners.filter((agent) => agent.wins >= 2 || agent.sameDayMultiWins >= 1);

  const COMPETITOR_OVERLAP_THRESHOLD = 0.25;
  const competitorCoverage: Array<{ name: string; headline: string; similarity: number }> = [];
  for (const profile of context.competitorProfiles ?? []) {
    let bestSim = 0;
    let bestHeadline = "";
    for (const competitorHeadline of profile.recentHeadlines) {
      const sim = jaccardSimilarity(submission.headline, competitorHeadline);
      if (sim > bestSim) {
        bestSim = sim;
        bestHeadline = competitorHeadline;
      }
    }
    if (bestSim >= COMPETITOR_OVERLAP_THRESHOLD) {
      competitorCoverage.push({ name: profile.name, headline: bestHeadline, similarity: bestSim });
    }
  }
  const candidateContextText = buildCandidateContextText(submission);
  const candidateWinningAngle = inferWinningAngle(candidateContextText);
  const exactAnchor = hasExactAnchor(submission.headline);
  const structuralPattern = hasStructuralPattern(candidateContextText);
  const operatorConsequence = hasOperatorConsequence(candidateContextText);
  const bitcoinEcosystemRelevant = hasBitcoinEcosystemRelevance(submission);
  const broadWinnerShape = hasBroadWinnerShape(submission, candidateContextText);
  const rawReleaseWithoutOperatorConsequence = isRawReleaseWithoutOperatorConsequence(
    submission,
    operatorConsequence
  );
  const externalWithoutAibtcActivity = isExternalWithoutAibtcNetworkActivity(
    submission,
    candidateContextText
  );
  const styleTested = inferStyleTestedFromSubmission(
    submission,
    candidateContextText,
    broadWinnerShape,
    operatorConsequence,
    structuralPattern,
    exactAnchor
  );
  const competitorReference = inferCompetitorReferenceFromSubmission(
    submission,
    dominantBeatOwners,
    topWinningDomains
  );
  const whyThisStyleWasChosen = inferWhyStyleWasChosen(
    submission,
    styleTested,
    exactAnchor,
    operatorConsequence,
    broadWinnerShape
  );
  const duplicateStatus = inferDuplicateStatus(submission, pendingDuplicateRisk, autoGate);
  const freshnessStatus = inferFreshnessStatus(submission, freshnessRisk, autoGate);
  const competitionProof = readBriefCompetitionProof(submission);
  const competitionProofAssessment = evaluateBriefCompetitionProof(competitionProof);
  const publishability = await assessBeatPublishability(submission.candidate_signal.beat);
  const nativeOperatorStory = isAibtcNativeOperatorStory(
    submission,
    candidateContextText,
    operatorConsequence
  );
  const rawDataWithoutThesis = isRawDataWithoutThesis(
    submission,
    candidateContextText,
    operatorConsequence,
    structuralPattern
  );
  const genericOperationalAdvice = isGenericOperationalAdvice(
    submission,
    candidateContextText,
    exactAnchor,
    structuralPattern
  );
  const competitiveness = assessEditorialCompetitiveness({
    headline: submission.headline,
    summary: submission.candidate_signal.summary,
    significance: submission.candidate_signal.significance,
    causality: submission.candidate_signal.causality,
    proofNotes: (submission.proof ?? []).flatMap((item) => [item.query_result, item.proof_note]).filter(
      (value): value is string => typeof value === "string"
    ),
    sourceUrls: (submission.sources ?? [])
      .map((source) => source.source_url)
      .filter((value): value is string => typeof value === "string"),
    sourceTypes: (submission.sources ?? [])
      .map((source) => source.source_type)
      .filter((value): value is string => typeof value === "string")
  });
  const approvalReady =
    submissionStatus === "submit" &&
    editorialReview.readyToFile &&
    editorialReview.editorialFit !== "weak" &&
    editorialReview.publisherConfidence !== "low" &&
    competitionProofAssessment.ready;
  const targetMet = optimization?.successMetrics?.targetMet ?? false;
  const topCandidatePublicationRate = optimization?.topCandidatePerformance?.publicationRate ?? null;
  const todayStrength = assessTodayBriefStrength(
    submission,
    briefSnapshot,
    candidateContextText,
    operatorConsequence,
    broadWinnerShape,
    exactAnchor,
    candidateWinningAngle
  );
  const candidateHistoricalTopics = detectBriefTopics(candidateContextText);
  const matchingHistoricalTopics = historicalBriefSignals.preferredTopics.filter((topic) =>
    candidateHistoricalTopics.some((candidateTopic) => candidateTopic.topic === topic.topic)
  );
  const occupiedRecentBriefStory = recentBriefOccupancy.find((entry) =>
    recentBriefOccupancyMatch(submission.headline, entry.headline)
  );

  if (submissionStatus === "submit") {
    score += 12;
    reasons.push("submission gate passed");
  } else if (manualCheckOnlyBlocked) {
    reasons.push("manual checks still missing before this can be filed");
  } else {
    score -= 30;
    reasons.push("submission gate failed on substantive checks");
  }

  if (editorialReview.readyToFile) {
    score += 8;
    reasons.push("editorial review says ready to file");
  } else {
    score -= 8;
    reasons.push("editorial review does not consider it filing-ready");
  }

  if (editorialReview.editorialFit === "strong") {
    score += 6;
    reasons.push("strong editorial fit");
  } else if (editorialReview.editorialFit === "borderline") {
    score += 1;
    reasons.push("borderline editorial fit");
  } else {
    score -= 12;
    reasons.push("weak editorial fit");
  }

  if (editorialReview.publisherConfidence === "high") {
    score += 4;
  } else if (editorialReview.publisherConfidence === "medium") {
    score += 2;
  } else {
    score -= 8;
    reasons.push("low publisher confidence");
  }

  if (competitionProofAssessment.ready) {
    score += 6;
    reasons.push("brief competition proof is complete and strong enough to justify brief-slot competitiveness");
  } else {
    score -= 18;
    reasons.push(...competitionProofAssessment.reasons);
  }

  if (submission.headline.length <= 110) {
    score += 2;
  } else if (submission.headline.length > 140) {
    score -= 10;
    reasons.push("headline too long");
  }

  if (hasRawReleaseNoteShape(submission.headline) && !nativeOperatorStory) {
    score -= 10;
    reasons.push("headline reads like raw release notes instead of a finished filing");
  }

  if (hasArtifactTitleShape(submission.headline) && !nativeOperatorStory) {
    score -= 8;
    reasons.push("headline starts with a source artifact instead of a publishable news event");
  }

  if (rawReleaseWithoutOperatorConsequence) {
    score -= 25;
    reasons.push("raw release-note framing without operator consequence is not competitive for In Brief");
  }

  if (
    /\bbefore\b|\bearly\b|\bsame day\b/i.test(submission.candidate_signal.significance)
  ) {
    score += 5;
    reasons.push("significance claims timing or novelty edge");
  }

  if (submission.candidate_signal.likely_duplicate || autoGate?.duplicateStatus === "flagged") {
    score -= 20;
    reasons.push("duplicate risk already flagged");
  }

  if (autoGate?.duplicateMatchHeadline) {
    const matchStatus = autoGate.duplicateStatus ?? "unknown";
    if (autoGate.duplicateStatus === "flagged") {
      score -= 15;
      reasons.push(
        `live feed occupancy block: matching ${matchStatus} story already exists — "${autoGate.duplicateMatchHeadline}"`
      );
    } else if (autoGate.duplicateStatus === "pending") {
      reasons.push(
        `live feed overlap warning: similar ${matchStatus} story already exists — "${autoGate.duplicateMatchHeadline}"`
      );
    }
  }

  if (occupiedRecentBriefStory) {
    score -= 35;
    reasons.push(
      `recent brief occupancy block: same core story already won on ${occupiedRecentBriefStory.reportDate} — "${occupiedRecentBriefStory.headline}"`
    );
  }

  if (pendingDuplicateRisk) {
    score -= 18;
    reasons.push("unresolved duplicate check is still pending");
  }

  if (freshnessRisk) {
    score -= 10;
    reasons.push("freshness risk must be cleared before filing");
  }

  if (publishability.status !== "publishable") {
    score -= 20;
    reasons.push(...publishability.reasons);
  }

  if (competitiveness.status !== "competitive") {
    score -= 20;
    reasons.push(...competitiveness.reasons);
  } else {
    if (competitiveness.exactAnchor) {
      score += 4;
      reasons.push("editorial contract passed: story carries the exact anchor recent brief winners keep using");
    }
    if (competitiveness.storyOfValue) {
      score += 4;
      reasons.push("editorial contract passed: story reads like a valuable brief item, not just a technical update");
    }
    if (competitiveness.humanNewsHeadline) {
      score += 3;
      reasons.push("editorial contract passed: headline reads like human news instead of repo exhaust");
    }
  }

  if (todayStrength.status === "operator_relevant_but_weak_today") {
    score -= 15;
    reasons.push(...todayStrength.reasons);
  } else if (todayStrength.status === "strong_enough_today") {
    score += 8;
    reasons.push(...todayStrength.reasons);
  }

  if (submission.candidate_signal.uses_dashboard_as_primary_source || autoGate?.dashboardContaminated) {
    score -= 15;
    reasons.push("dashboard-first sourcing risk");
  }

  if (hasRequiredUpgradeWindow(candidateContextText)) {
    score += 8;
    reasons.push("source carries an exact upgrade window or failure threshold operators can act on");
  }

  if (nativeOperatorStory) {
    score += 6;
    reasons.push("AIBTC-native fix with direct operator consequence stays recommendable even if it started as release-shaped proof");
  }

  if (readsLikeGenericExternalAdaptation(submission)) {
    score -= 10;
    reasons.push("external story still reads descriptive rather than like a filing-ready operator signal");
  }

  if (externalWithoutAibtcActivity) {
    score -= 35;
    reasons.push("hard gate: external story does not show direct AIBTC network activity");
  }

  if (rawDataWithoutThesis) {
    score -= 25;
    reasons.push("hard gate: raw counts without a decision-grade thesis are not fileable");
  }

  if (genericOperationalAdvice) {
    score -= 25;
    reasons.push("hard gate: generic operational advice is not intelligence");
  }

  if (!bitcoinEcosystemRelevant) {
    score -= 40;
    reasons.push("relevance gate failed: story is not clearly Bitcoin, Stacks, sBTC, x402, or AIBTC related");
  }

  const beatPreference = optimization?.beatPreferences.find(
    (item) => item.beat === submission.candidate_signal.beat
  );
  const beatCrowding = optimization?.beatCrowding?.find(
    (item) => item.beat === submission.candidate_signal.beat
  );
  const preferredHeadlinePattern = optimization?.winningHeadlinePatterns[0]?.pattern ?? null;
  const headlinePattern = inferHeadlinePattern(submission.headline);
  const stylePerformance = optimization?.stylePerformance?.find((item) => item.style === styleTested);
  const packagingAdjustments = optimization?.packagingAdjustments;

  if (beatPreference?.preference === "increase") {
    score += 10;
    reasons.push(`beat ${beatPreference.beat} is producing published wins`);
  } else if (beatPreference?.preference === "decrease") {
    score -= 10;
    reasons.push(`beat ${beatPreference.beat} is currently crowded or underperforming`);
  }

  if (beatPreference?.publicationRate !== null && beatPreference?.publicationRate !== undefined) {
    if (beatPreference.publicationRate >= 0.5) {
      score += 6;
      reasons.push(`beat ${beatPreference.beat} is converting into published brief wins`);
    } else if (beatPreference.publicationRate < 0.25) {
      score -= 6;
      reasons.push(`beat ${beatPreference.beat} has weak published conversion history`);
    }
  }

  if (beatCrowding && beatCrowding.crowdingScore >= 40) {
    score -= 6;
    reasons.push(`beat ${beatCrowding.beat} is crowded right now`);
  }

  if (optimization?.rejectionThreshold.mode === "tightened") {
    if (!editorialReview.readyToFile) {
      score -= 5;
      reasons.push("current strictness regime punishes non-ready filings");
    }

    if (editorialReview.publisherConfidence !== "high") {
      score -= 4;
      reasons.push("current strictness regime favors cleaner publisher fit");
    }
  }

  if (preferredHeadlinePattern !== null) {
    if (headlinePattern === preferredHeadlinePattern) {
      score += 4;
      reasons.push(`headline matches the current winning pattern (${headlinePattern})`);
    } else {
      score -= 2;
      reasons.push(`headline misses the current winning pattern (${preferredHeadlinePattern})`);
    }
  }

  if (stylePerformance?.preference === "promote") {
    score += 8;
    reasons.push(`style ${styleTested} is converting into In Brief and is currently promoted`);
  } else if (stylePerformance?.preference === "demote") {
    score -= 10;
    reasons.push(`style ${styleTested} is underperforming against the real KPI and is currently demoted`);
  }

  if (stylePerformance?.briefIncludedRate !== null && stylePerformance?.briefIncludedRate !== undefined) {
    if (stylePerformance.briefIncludedRate >= 0.5) {
      score += 4;
      reasons.push(`style ${styleTested} has a strong brief-included conversion history`);
    } else if (stylePerformance.resolvedSubmissions >= 2 && stylePerformance.briefIncludedRate < 0.25) {
      score -= 4;
      reasons.push(`style ${styleTested} has weak brief-included conversion history`);
    }
  }

  if ((stylePerformance?.satsEarned ?? 0) > 0) {
    const satsBoost = Math.min(4, Math.max(1, Math.round((stylePerformance?.satsEarned ?? 0) / 500)));
    score += satsBoost;
    reasons.push(`style ${styleTested} has already converted into wallet sats`);
  } else if ((stylePerformance?.resolvedSubmissions ?? 0) >= 2 && (stylePerformance?.inBriefWins ?? 0) === 0) {
    score -= 5;
    reasons.push(`style ${styleTested} has not converted into In Brief or wallet sats yet`);
  }

  if (candidateWinningAngle && competitorWinningAngles.includes(candidateWinningAngle)) {
    score += 4;
    reasons.push(`candidate matches a competitor winning angle that landed today (${candidateWinningAngle})`);
  } else if (
    competitorWinningAngles.length > 0 &&
    competitiveness.status === "competitive" &&
    candidateWinningAngle === null
  ) {
    score -= 3;
    reasons.push("candidate misses the concrete winning angles top competitors are landing today");
  }

  if (packagingAdjustments?.promoteBroadSameBeatPackaging && styleTested === "broad_same_beat_operator") {
    score += 6;
    reasons.push("recent loss memory says broader same-beat packaging should be promoted");
  }

  if (
    packagingAdjustments?.demoteNarrowFragmentPackaging &&
    styleTested === "single_story_operator_angle" &&
    ((beatCrowding?.crowdingScore ?? 0) >= 40 || dominantBeatOwners.length > 0)
  ) {
    score -= 8;
    reasons.push("recent loss memory says narrow same-beat fragments should be demoted in crowded lanes");
  }

  if (briefSnapshot?.occupiedBeats.includes(submission.candidate_signal.beat)) {
    score -= 8;
    reasons.push(`beat ${submission.candidate_signal.beat} is already occupied in the latest brief snapshot`);
  }

  if (briefSnapshot && briefSnapshot.repeatWinners.length > 0) {
    score -= 3;
    reasons.push("repeat-winner pressure is high in the latest brief snapshot");
  }

  if (approvalReady) {
    reasons.push("candidate already clears the approval-quality floor, so brief-win signals can act as upside");

    if (!targetMet) {
      score -= 3;
      reasons.push("real KPI is still being missed, so approval-ready cleanliness is not enough by itself");
    }

    if (historicalBriefSignals.preferredBeats.includes(submission.candidate_signal.beat)) {
      score += 4;
      reasons.push(`beat ${submission.candidate_signal.beat} matches the historical brief-winning lanes`);
    }

    if (
      historicalBriefSignals.prefersReleaseConsequence &&
      sourceDomains.includes("github.com") &&
      !hasRawReleaseNoteShape(submission.headline) &&
      operatorConsequence
    ) {
      score += 6;
      reasons.push("candidate matches the release-plus-operator-consequence shape recent winners use");
    }

    if (
      historicalBriefSignals.prefersStructuralPatterns &&
      structuralPattern
    ) {
      score += 5;
      reasons.push("candidate matches the structural-pattern behavior that brief winners keep using");
    }

    if (historicalBriefSignals.prefersExactAnchors && exactAnchor) {
      score += 5;
      reasons.push("headline uses the exact numeric or version anchors that top winners favor");
    }

    if (matchingHistoricalTopics.length > 0) {
      score += Math.min(6, matchingHistoricalTopics.length * 3);
      reasons.push(
        `candidate matches historical brief topics (${matchingHistoricalTopics.map((topic) => topic.label).join(", ")})`
      );
    } else if (historicalBriefSignals.preferredTopics.length > 0) {
      score -= 3;
      reasons.push("candidate misses the concrete topics that recent brief winners keep revisiting");
    }

    if (operatorConsequence) {
      score += 5;
      reasons.push("candidate leads with direct operator consequence instead of a descriptive fragment");
    }

    if (broadWinnerShape) {
      score += 5;
      reasons.push("candidate has the broader same-beat packaging shape that converts better into In Brief");
    }

    if (winningDomainMatches.length > 0) {
      score += 8;
      reasons.push(
        `sources match domains that have recently won the brief (${winningDomainMatches.map((item) => item.domain).join(", ")})`
      );
    } else if (sourceDomains.length > 0 && topWinningDomains.length > 0) {
      score -= 4;
      reasons.push("sources do not match the domains that are recently winning the brief");
    }

    if (dominantBeatOwners.length >= 2) {
      score -= broadWinnerShape && operatorConsequence ? 4 : 11;
      reasons.push(`beat ${submission.candidate_signal.beat} is actively owned by repeat-winning agents`);
    } else if (dominantBeatOwners.length === 1) {
      score -= broadWinnerShape && operatorConsequence ? 2 : 7;
      reasons.push(`beat ${submission.candidate_signal.beat} is regularly won by ${dominantBeatOwners[0].agent}`);
    }

    if (dominantBeatOwners.length > 0 && winningDomainMatches.length === 0) {
      score -= 6;
      reasons.push("crowded beat without matching the source pattern recent winners are using");
    }

    if (dominantBeatOwners.length > 0 && !broadWinnerShape) {
      score -= 6;
      reasons.push("narrow packaging is unlikely to beat correspondents already winning this beat");
    }

    if (competitorCoverage.length >= 2) {
      score += 5;
      reasons.push(
        `story validated: ${competitorCoverage.length} tracked competitors also covering this (${competitorCoverage.map((c) => c.name).join(", ")}) — strong brief candidate, ensure angle is differentiated`
      );
    } else if (competitorCoverage.length === 1) {
      reasons.push(
        `1 tracked competitor on similar story: ${competitorCoverage[0].name} — note competition, ensure angle is differentiated`
      );
    } else if (competitiveness.status === "competitive") {
      score += 3;
      reasons.push("no tracked competitors on this story — unique pick advantage");
    } else {
      reasons.push("no tracked competitors on this story, but uniqueness does not help until the story clears the competitive bar");
    }
  } else if (winningDomainMatches.length > 0 || dominantBeatOwners.length > 0) {
    reasons.push("brief-win pattern signals were observed but ignored because the candidate has not cleared the approval-quality floor");
  }

  if (competitorCoverage.length === 0 && !approvalReady) {
    reasons.push("no tracked competitors on this story (unique pick noted, but candidate has not cleared approval-quality floor)");
  }

  if (!targetMet && topCandidatePublicationRate !== null && topCandidatePublicationRate < 0.25) {
    score -= 3;
    reasons.push("recent top candidates are not converting into published wins, so the scorer is leaning harder on outcome signals");
  }

  const normalized = normalizeScore(score);
  let decision: RankedCandidate["decision"] =
    normalized >= 75
      ? "file"
      : normalized >= 45
        ? "hold"
        : "reject";

  if ((manualCheckOnlyBlocked || pendingDuplicateRisk || freshnessRisk) && decision === "file") {
    decision = "hold";
  }

  if (!competitionProofAssessment.ready && decision === "file") {
    decision = "hold";
  }

  if (autoGate?.duplicateStatus === "flagged") {
    decision = "reject";
  }

  if (occupiedRecentBriefStory) {
    decision = "reject";
  }

  if (!bitcoinEcosystemRelevant) {
    decision = "reject";
  }

  if (externalWithoutAibtcActivity || rawDataWithoutThesis || genericOperationalAdvice) {
    decision = "reject";
  }

  if (rawReleaseWithoutOperatorConsequence && decision === "file") {
    decision = approvalReady ? "hold" : "reject";
  }

  if (publishability.status !== "publishable") {
    decision = "reject";
  }

  if (competitiveness.status !== "competitive" && decision === "file") {
    decision = approvalReady ? "hold" : "reject";
  }

  if (todayStrength.status === "operator_relevant_but_weak_today" && decision === "file") {
    decision = "reject";
  }

  return {
    candidateId: submission.candidate_signal.candidate_id,
    beat: submission.candidate_signal.beat,
    filingBeatSlug: publishability.filingBeatSlug,
    headline: submission.headline,
    score: normalized,
    decision,
    styleTested,
    competitorReference,
    whyThisStyleWasChosen,
    duplicateStatus,
    freshnessStatus,
    publishabilityStatus: publishability.status,
    publishabilityReasons: publishability.reasons,
    competitivenessStatus: competitiveness.status,
    competitivenessReasons: competitiveness.reasons,
    todayStrengthStatus: todayStrength.status,
    todayStrengthReasons: todayStrength.reasons,
    competitorCoverage,
    reasons
  };
}

function detectedBeforeReportDate(
  submission: SerializedSubmission,
  reportDate: string
): boolean {
  const detectedAt = submission.candidate_signal.detected_at;
  return typeof detectedAt === "string" && detectedAt.slice(0, 10) < reportDate;
}

async function saveStalePruningRecord(
  reportDate: string,
  staleSubmissions: ParsedCandidateSubmission[],
  baseDir?: string
): Promise<void> {
  const root = resolve(baseDir ?? process.cwd());
  const filePath = resolve(root, `data/logs/stale-pruning/${reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  const record: StalePruningRecord = {
    kind: "stale_dry_run_pruning",
    reportDate,
    generatedAt: new Date().toISOString(),
    removedCount: staleSubmissions.length,
    removed: staleSubmissions.map(({ sourcePath, submission }) => ({
      candidateId: submission.candidate_signal.candidate_id,
      headline: submission.headline,
      detectedAt: submission.candidate_signal.detected_at ?? null,
      sourcePath,
      reason: `detected_at predates report date ${reportDate}`
    }))
  };
  await writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
}

function extractAnalysisSection(analysis: string, label: string): string | null {
  const match = analysis.match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}

function inferDuplicateStatusFromReasons(reasons: string[]): "clear" | "pending" | "flagged" {
  const text = reasons.join(" ").toLowerCase();
  if (/\bduplicate\b/.test(text) && /\bpending\b/.test(text)) return "pending";
  if (/\bduplicate\b/.test(text) || /\bsame story\b/.test(text)) return "flagged";
  return "clear";
}

function inferFreshnessStatusFromReasons(reasons: string[]): "clear" | "risk_unresolved" | "unknown" {
  const text = reasons.join(" ").toLowerCase();
  if (/\bfreshness\b/.test(text) || /\bstale\b/.test(text) || /\btimely\b/.test(text)) {
    return "risk_unresolved";
  }
  return "unknown";
}

function convertManualArtifactToSubmission(
  candidateId: string,
  artifact: ManualSubmissionArtifact,
  review: SignalJobContextReview | null
): SerializedSubmission {
  const headline = artifact.headline?.trim() ?? candidateId;
  const analysis = artifact.analysis?.trim() ?? "";
  const summary = extractAnalysisSection(analysis, "What changed") ?? headline;
  const significance = extractAnalysisSection(analysis, "What it means") ?? (analysis || headline);
  const causality =
    extractAnalysisSection(analysis, "What to do") ??
    extractAnalysisSection(analysis, "Directive") ??
    significance;
  const duplicateStatus = inferDuplicateStatusFromReasons(review?.reasons ?? []);
  const freshnessStatus = inferFreshnessStatusFromReasons(review?.reasons ?? []);

  return {
    candidate_signal: {
      candidate_id: candidateId,
      beat: artifact.beat_slug?.trim() ?? "aibtc-network",
      summary,
      significance,
      causality,
      likely_duplicate: duplicateStatus === "flagged",
      uses_dashboard_as_primary_source: false,
      duplicate_check_status: duplicateStatus === "pending" ? "pending duplicate review" : undefined,
      staleness_risk: freshnessStatus === "risk_unresolved" ? "manual freshness review required" : undefined
    },
    headline,
    proof: [],
    sources: (artifact.sources ?? []).map((source) => ({
      source_type: "generated-candidate",
      source_url: source.url
    })),
    pre_submission_intelligence: {
      notes: review?.reasons ?? []
    },
    validation_status: {
      checks: {
        duplicate_check_note: (review?.reasons ?? []).find((reason) => /duplicate/i.test(reason))
      }
    },
    submission_decision: {
      status: review?.accepted ? "submit" : "reject",
      rejection_reasons: review?.accepted ? [] : (review?.reasons ?? [])
    },
    editorial_review: {
      editorial_fit: review?.accepted ? "strong" : review?.preDraftAccepted ? "borderline" : "weak",
      publisher_confidence: review?.accepted ? "high" : review?.preDraftAccepted ? "medium" : "low",
      ready_to_file: review?.accepted ?? false,
      hold_reasons: review?.accepted ? [] : (review?.reasons ?? [])
    },
    candidate_metadata: {
      duplicate_status: duplicateStatus,
      freshness_status: freshnessStatus,
      filing_beat_slug: artifact.beat_slug?.trim() ?? "aibtc-network",
      why_this_beat_is_open: "This beat slot is still open for an operator-relevant same-day story with concrete proof.",
      why_now: significance || "This event is live in the current cycle and actionable now.",
      why_this_beats_same_day_competition: "This candidate is packaged as a broader operator-facing story instead of a narrow fragment.",
      primary_source_proof: (artifact.sources ?? []).map((source) => source.url).filter(Boolean)[0]
        ? `${(artifact.sources ?? []).map((source) => source.url).filter(Boolean)[0]} is the primary source proof anchor.`
        : "",
      operator_action: causality || "Operators should verify this anchor before filing."
    }
  };
}

async function loadManualSubmissionCandidates(
  reportDate: string,
  root: string
): Promise<ParsedCandidateSubmission[]> {
  const queueDir = resolve(root, `data/manual-submissions/${reportDate}`);
  const contextPath = resolve(root, `data/context-runs/${reportDate}/signal-job.json`);
  const [context, fileNames] = await Promise.all([
    readJsonOrNull<SignalJobContextFile>(contextPath),
    readdir(queueDir).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [] as string[];
      throw error;
    })
  ]);

  if (!context?.reviews || context.reviews.length === 0 || fileNames.length === 0) {
    return [];
  }

  const reviewsByFile = new Map(context.reviews.map((review) => [review.fileName, review]));
  return Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith(".json"))
      .map(async (fileName) => {
        const sourcePath = resolve(queueDir, fileName);
        const artifact = JSON.parse(await readFile(sourcePath, "utf8")) as ManualSubmissionArtifact;
        const candidateId = fileName.replace(/\.json$/, "");
        return {
          sourcePath,
          submission: convertManualArtifactToSubmission(candidateId, artifact, reviewsByFile.get(fileName) ?? null)
        } satisfies ParsedCandidateSubmission;
      })
  );
}

export async function rankDryRunCandidates(
  reportDate: string,
  baseDir?: string
): Promise<RankedCandidate[]> {
  const root = resolve(baseDir ?? process.cwd());
  const [
    optimization,
    briefSnapshot,
    agentBehavior,
    historicalBriefSignals,
    recentBriefOccupancy,
    competitorProfiles,
    competitorWinningAngles,
    manualSubmissions
  ] = await Promise.all([
    readOptimizationSnapshot(reportDate, root),
    readBriefWinnerSnapshot(reportDate, root),
    readAgentBehaviorState(root),
    readHistoricalBriefSignals(root),
    readRecentBriefOccupancy(reportDate, root),
    fetchCompetitorProfiles(root),
    readCompetitorWinningAngles(reportDate, root),
    loadManualSubmissionCandidates(reportDate, root)
  ]);

  let parsedSubmissions = manualSubmissions;
  if (parsedSubmissions.length === 0) {
    const queueDir = resolve(root, `data/dry-runs/${reportDate}`);
    let fileNames: string[] = [];
    try {
      fileNames = await readdir(queueDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    parsedSubmissions = await Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith("-submission.json"))
        .map(async (fileName) => {
          const sourcePath = resolve(queueDir, fileName);
          const submission = JSON.parse(
            await readFile(sourcePath, "utf8")
          ) as SerializedSubmission;
          return {
            sourcePath,
            submission
          } satisfies ParsedCandidateSubmission;
        })
    );
  }

  const staleSubmissions = parsedSubmissions.filter(({ submission }) =>
    detectedBeforeReportDate(submission, reportDate)
  );
  await saveStalePruningRecord(reportDate, staleSubmissions, root);
  await Promise.all(
    staleSubmissions
      .filter(({ sourcePath }) => sourcePath.includes(`${resolve(root, `data/dry-runs/${reportDate}`)}`))
      .map(({ sourcePath }) => rm(sourcePath, { force: true }))
  );
  const submissions = parsedSubmissions.filter(({ submission }) =>
    !detectedBeforeReportDate(submission, reportDate)
  );

  const runAt = new Date().toISOString();
  const liveSignals = await fetchLiveSignals();
  const autoGateResults = await Promise.all(
    submissions.map(({ submission }) =>
      runAutoGates(
        submission.candidate_signal.candidate_id,
        submission.headline,
        (submission.sources ?? [])
          .map((s) => s.source_url)
          .filter((u): u is string => typeof u === "string"),
        runAt,
        root,
        liveSignals
      )
    )
  );

  const rankedCandidates = await Promise.all(
    submissions.map(async ({ sourcePath, submission }, index) => ({
      ...(await scoreCandidate(submission, {
        optimization,
        briefSnapshot,
        agentBehavior,
        historicalBriefSignals,
        recentBriefOccupancy,
        competitorWinningAngles,
        autoGate: autoGateResults[index],
        competitorProfiles
      })),
      sourcePath
    }) satisfies RankedCandidate)
  );

  applyCompanionReleaseAdjustments(rankedCandidates, submissions);

  const byBeatCounts = new Map<string, number>();
  for (const candidate of [...rankedCandidates].sort((left, right) => right.score - left.score)) {
    const seen = byBeatCounts.get(candidate.beat) ?? 0;
    if (seen === 0) {
      candidate.score = normalizeScore(candidate.score + 5);
      candidate.reasons.push(`beat ${candidate.beat} is needed to keep the daily slate diverse`);
    } else if (seen >= 2) {
      candidate.score = normalizeScore(candidate.score - 6);
      candidate.reasons.push(`daily slate already has multiple ${candidate.beat} candidates`);
    }
    byBeatCounts.set(candidate.beat, seen + 1);
  }

  for (const candidate of rankedCandidates) {
    if (candidate.reasons.some((reason) => reason.startsWith("live feed occupancy block:"))) {
      candidate.decision = "reject";
    }
  }

  return rankedCandidates.sort(
    (left, right) => right.score - left.score || left.candidateId.localeCompare(right.candidateId)
  );
}

export async function saveRankedCandidateQueue(
  reportDate: string,
  rankedCandidates: RankedCandidate[],
  baseDir?: string
): Promise<string> {
  const filePath = resolve(baseDir ?? process.cwd(), `data/queues/${reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        kind: "ranked_candidate_queue",
        reportDate,
        generatedAt: new Date().toISOString(),
        candidates: rankedCandidates
      },
      null,
      2
    ),
    "utf8"
  );
  return filePath;
}
