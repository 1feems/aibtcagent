import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchCompetitorProfiles, readBriefWinnerSnapshot, type CompetitorProfile } from "../brief/index.js";
import { evaluateSignalGuard, type SignalGuardResult } from "../filing/signal-guard.js";
import { type CandidateLifecycle, type RankedCandidateDecision, inferLifecycleFromDecision } from "../filing/lifecycle.js";
import type { DailyOptimizationSnapshot } from "../types/index.js";
import { fetchLiveSignals, jaccardSimilarity, runAutoGates, type AutoGateResult } from "./auto-gates.js";

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
  model_disclosure?: {
    tools_used?: string[];
    derivation_steps?: string[];
  };
  article_preview?: {
    lede?: string;
    why_it_matters?: string;
  };
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
}

interface ScoreContext {
  optimization: DailyOptimizationSnapshot | null;
  briefSnapshot: Awaited<ReturnType<typeof readBriefWinnerSnapshot>>;
  agentBehavior: AgentBehaviorState | null;
  historicalBriefSignals: HistoricalBriefSignals;
  autoGate?: AutoGateResult;
  finalSignalGuard?: SignalGuardResult;
  competitorProfiles?: CompetitorProfile[];
  signalAgentContract?: SignalAgentContract;
}

interface SignalAgentContract {
  publisherSkillInstalled: boolean;
  factCheckerSkillInstalled: boolean;
  dailyPrepReportPresent: boolean;
  dailyPrepText: string;
  editorialMemoryPresent: boolean;
  objectiveMemoryPresent: boolean;
  competitionMemoryPresent: boolean;
  briefExamplesPresent: boolean;
  preFilingCheckIds: string[];
  objectivePressureNotes: string[];
  currentRank: number | null;
  currentScore: number | null;
  currentStreak: string | null;
  gapToTop3: number | null;
  gapToTop6: number | null;
  maxSignalsPerDay: number | null;
  maxSignalsPerBeatPerMinutes: number | null;
  crowdedBeatIds: string[];
  winningStoryShapes: string[];
  winningHeadlineExamples: string[];
  currentCycleReportDate: string | null;
  currentCycleWinningHeadlines: string[];
  currentCycleLossHeadlines: string[];
  currentCycleValueCreatingPatterns: string[];
  currentCycleSourcePatternsThatPassed: string[];
}

interface ParsedCandidateSubmission {
  sourcePath: string;
  submission: SerializedSubmission;
}

export interface RankedCandidate {
  candidateId: string;
  beat: string;
  headline: string;
  score: number;
  obviousBriefWinner: boolean;
  decision: RankedCandidateDecision;
  lifecycle: CandidateLifecycle;
  styleTested: string;
  competitorReference: string | null;
  whyThisStyleWasChosen: string;
  duplicateStatus: "clear" | "pending" | "flagged";
  freshnessStatus: "clear" | "risk_unresolved" | "unknown";
  competitorCoverage: Array<{ name: string; headline: string; similarity: number }>;
  reasons: string[];
  sourcePath: string;
}

function normalizeScore(value: number): number {
  return Math.max(0, Math.min(100, value));
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

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function loadSignalAgentContract(
  reportDate: string,
  baseDir?: string
): Promise<SignalAgentContract> {
  const root = resolve(baseDir ?? process.cwd());
  const dailyPrepText = await readTextIfExists(resolve(root, `data/reports/daily/${reportDate}.md`));
  const publisherSkillText = await readTextIfExists("/Users/feems/.agents/skills/aibtc-news-publisher/SKILL.md");
  const factCheckerSkillText = await readTextIfExists("/Users/feems/.agents/skills/aibtc-news-fact-checker/SKILL.md");
  const editorialMemoryText = await readTextIfExists(resolve(root, "data/state/editorial-memory.json"));
  const objectiveMemoryText = await readTextIfExists(resolve(root, "data/state/objective-memory.json"));
  const competitionMemoryText = await readTextIfExists(resolve(root, "data/state/competition-memory.json"));
  const briefExamplesText = await readTextIfExists(resolve(root, "data/state/brief-examples.json"));
  const editorialMemory = editorialMemoryText ? JSON.parse(editorialMemoryText) as {
    preFilingChecks?: Array<{ id?: string }>;
    currentCycle?: {
      reportDate?: string | null;
      winnersToday?: Array<{ headline?: string }>;
      lossesToday?: Array<{ headline?: string }>;
      valueCreatingPatterns?: string[];
      sourcePatternsThatPassed?: string[];
    };
  } : null;
  const objectiveMemory = objectiveMemoryText ? JSON.parse(objectiveMemoryText) as {
    pressureNotes?: string[];
    cadenceLimits?: {
      maxSignalsPerDay?: number;
      maxSignalsPerBeatPerMinutes?: number;
    };
    currentStanding?: {
      rank?: number | null;
      score?: number | null;
      streak?: string | null;
      gapToTop3?: number | null;
      gapToTop6?: number | null;
    };
  } : null;
  const competitionMemory = competitionMemoryText ? JSON.parse(competitionMemoryText) as {
    crowdedBeats?: Array<{ beat?: string }>;
    winningStoryShapes?: string[];
  } : null;
  const briefExamples = briefExamplesText ? JSON.parse(briefExamplesText) as {
    recentWinners?: Array<{ headline?: string }>;
  } : null;

  return {
    publisherSkillInstalled: publisherSkillText.includes("# Publisher — aibtc.news"),
    factCheckerSkillInstalled: factCheckerSkillText.includes("# Fact-Checker — aibtc.news"),
    dailyPrepReportPresent: dailyPrepText.includes(`# Daily Report: ${reportDate}`),
    dailyPrepText,
    editorialMemoryPresent: editorialMemoryText.length > 0,
    objectiveMemoryPresent: objectiveMemoryText.length > 0,
    competitionMemoryPresent: competitionMemoryText.length > 0,
    briefExamplesPresent: briefExamplesText.length > 0,
    preFilingCheckIds: (editorialMemory?.preFilingChecks ?? [])
      .map((check) => check.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
    objectivePressureNotes: (objectiveMemory?.pressureNotes ?? []).filter(
      (note): note is string => typeof note === "string" && note.length > 0
    ),
    currentRank: objectiveMemory?.currentStanding?.rank ?? null,
    currentScore: objectiveMemory?.currentStanding?.score ?? null,
    currentStreak: objectiveMemory?.currentStanding?.streak ?? null,
    gapToTop3: objectiveMemory?.currentStanding?.gapToTop3 ?? null,
    gapToTop6: objectiveMemory?.currentStanding?.gapToTop6 ?? null,
    maxSignalsPerDay: objectiveMemory?.cadenceLimits?.maxSignalsPerDay ?? null,
    maxSignalsPerBeatPerMinutes: objectiveMemory?.cadenceLimits?.maxSignalsPerBeatPerMinutes ?? null,
    crowdedBeatIds: (competitionMemory?.crowdedBeats ?? [])
      .map((entry) => entry.beat)
      .filter((beat): beat is string => typeof beat === "string" && beat.length > 0)
      .map(normalizeBeat),
    winningStoryShapes: (competitionMemory?.winningStoryShapes ?? []).filter(
      (shape): shape is string => typeof shape === "string" && shape.length > 0
    ),
    winningHeadlineExamples: (briefExamples?.recentWinners ?? [])
      .map((entry) => entry.headline)
      .filter((headline): headline is string => typeof headline === "string" && headline.length > 0)
    ,
    currentCycleReportDate: editorialMemory?.currentCycle?.reportDate ?? null,
    currentCycleWinningHeadlines: (editorialMemory?.currentCycle?.winnersToday ?? [])
      .map((entry) => entry.headline)
      .filter((headline): headline is string => typeof headline === "string" && headline.length > 0),
    currentCycleLossHeadlines: (editorialMemory?.currentCycle?.lossesToday ?? [])
      .map((entry) => entry.headline)
      .filter((headline): headline is string => typeof headline === "string" && headline.length > 0),
    currentCycleValueCreatingPatterns: (editorialMemory?.currentCycle?.valueCreatingPatterns ?? [])
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
    currentCycleSourcePatternsThatPassed: (editorialMemory?.currentCycle?.sourcePatternsThatPassed ?? [])
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
  };
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

function normalizeBeat(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
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
  const briefHistoryDir = resolve(root, "data/brief-history");
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

  let briefHistoryFiles: string[] = [];
  try {
    briefHistoryFiles = (await readdir(briefHistoryDir)).filter((f) => f.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  for (const fileName of briefHistoryFiles) {
    const parsed = JSON.parse(
      await readFile(resolve(briefHistoryDir, fileName), "utf8")
    ) as { notes?: string[] };
    for (const note of parsed.notes ?? []) {
      notes.push(note);
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
  const normalizedBeats = publishedBeats.map((b) => normalizeBeat(b));

  // Live beat slugs from aibtc.news/api/beats — must match exactly what is used in submissions
  const beatVocabulary = [
    "dev-tools",
    "security",
    "aibtc-network",
    "agent-economy",
    "agent-trading",
    "dao-watch",
    "deal-flow",
    "distribution",
    "agent-skills",
    "agent-social",
    "bitcoin-yield",
    "bitcoin-macro",
    "bitcoin-culture",
    "ordinals",
    "runes",
    "art"
  ];

  const preferredBeats = beatVocabulary
    .filter((beat) =>
      normalizedNotes.some((note) => note.includes(beat)) ||
      normalizedBeats.some((b) => b === beat)
    );

  const noteMentionedBeats = normalizedNotes.flatMap((note) => {
    const matches = note.match(/\b(infrastructure|security|onboarding|distribution|governance|agent economy|agent trading|protocol updates|deal flow)\b/g) ?? [];
    return matches.map((match) => normalizeBeat(match));
  });

  const preferredBeatSet = new Set([
    ...preferredBeats,
    ...normalizedBeats,
    ...noteMentionedBeats
  ]);

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

  return {
    preferredBeats: [...preferredBeatSet],
    prefersReleaseConsequence,
    prefersStructuralPatterns,
    prefersExactAnchors
  };
}

function hasExactAnchor(headline: string): boolean {
  return /\b\d[\d,.]*\b/.test(headline) || /\bv\d+\.\d+(?:\.\d+)?\b/i.test(headline);
}

function hasStructuralPattern(text: string): boolean {
  return /\bcluster|gap|bottleneck|threshold|saturation|queue|concentration|backlog|lead|dominat/i.test(text);
}

function hasOperatorConsequence(text: string): boolean {
  return /\bagents should\b|\boperators should\b|\bmatters because\b|\brequires\b|\bupgrade\b|\brisk\b|\bwindow\b|\bconsequence\b/i.test(text);
}

function getDisclosureText(submission: SerializedSubmission): string {
  const tools = submission.model_disclosure?.tools_used ?? [];
  const steps = submission.model_disclosure?.derivation_steps ?? [];
  return [...tools, ...steps]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function hasTriviallyVagueDisclosure(disclosure: string): boolean {
  const normalized = disclosure.toLowerCase().trim();
  if (normalized.length === 0) {
    return true;
  }

  return [
    "used ai",
    "my own analysis",
    "various sources",
    "internal data",
    "used llm",
    "ai generated",
    "model output",
    "my analysis"
  ].some((pattern) => normalized.includes(pattern));
}

function hasConcreteDisclosureAnchors(disclosure: string): boolean {
  if (disclosure.trim().length < 24) {
    return false;
  }

  return (
    /\b(?:claude|gpt|grok|gemini|opus|sonnet|haiku)\b/i.test(disclosure) ||
    /\b(?:curl|rg|npm|node|bun|gh|api|endpoint|query|search)\b/i.test(disclosure) ||
    /\/api\/|https?:\/\/|github\.com|issue\s+#\d+|pr\s+#\d+|release/i.test(disclosure)
  );
}

function passesMissionAlignment(text: string): boolean {
  const normalized = text.toLowerCase();
  const bitcoinRail =
    /\bbitcoin\b|\bbtc\b|\bsbtc\b|\bstacks\b|\bstx\b|\bx402\b|\binscription\b|\bordinal\b/i.test(normalized);
  const aiOrNetworkActor =
    /\bai\b|\bagent\b|\bagents\b|\boperator\b|\boperators\b|\bapp\b|\bapps\b|\bcorrespondent\b|\bcorrespondents\b|\baibtc\b/i.test(normalized);
  const economicOrOperationalUse =
    /\buse\b|\bearn\b|\btransact\b|\bpayment\b|\bpayments\b|\bpayout\b|\bpayouts\b|\bsettlement\b|\bbrief\b|\branking\b|\binbox\b|\btransaction\b|\btransactions\b|\bindexable\b|\bblock production\b/i.test(normalized);

  return bitcoinRail && aiOrNetworkActor && economicOrOperationalUse;
}

function passesInscribableNewsTest(text: string): boolean {
  const normalized = text.toLowerCase();
  const speculative =
    /\bsources say\b|\breportedly\b|\ballegedly\b|\brumored\b|\bcould soon\b|\bmay be planning\b|\bexpected to\b|\bunconfirmed\b/.test(normalized);
  const hasDevelopment =
    /\bissue\s+#\d+\b|\bpr\s+#\d+\b|\brelease\b|\bships\b|\bshipped\b|\bfix(?:es|ed)?\b|\bpatch(?:es|ed)?\b|\badds?\b|\brestores?\b|\breplaces?\b|\bactivates?\b|\bratifies?\b|\bshows\b|\blive\b|\blaunch(?:es|ed)?\b|\bopens?\b|\bcut(?:s)?\b/i.test(text);

  return !speculative && hasDevelopment;
}

function passesValueCreationTest(text: string): boolean {
  const normalized = text.toLowerCase();
  return /\bthis means\b|\bimplication\b|\bmatters because\b|\boperators need\b|\bagents should\b|\boperators should\b|\bwhich means\b|\bas a result\b|\bso that\b|\bchanges\b|\blowers\b|\bdelays\b|\benables\b|\bturns\b/i.test(normalized);
}

function hasMeasurableEcosystemDelta(text: string): boolean {
  // Signal tracks a specific before/after change, not a vague trend.
  // Pattern: "from X to Y", "up/down N%", "increased by N", "now N vs N", stalled N blocks, etc.
  return (
    /\bfrom\s+\d[\d,.]*\s+to\s+\d[\d,.]*\b/i.test(text) ||
    /\b(?:up|down|fell?|rose?|drop(?:ped)?|jumped?|surged?|climbed?)\s+(?:from\s+)?\d[\d,.]*[KMBk%]?\b/i.test(text) ||
    /\b(?:increased?|decreased?|grew?|grew|slowed?)\s+(?:by\s+)?\d[\d,.]*[KMBk%]?\b/i.test(text) ||
    /\bnow\s+\d[\d,.]*[KMBk]?\s+(?:agents?|signals?|blocks?|sats?|stx|sbtc|users?|slots?|nodes?)\b/i.test(text) ||
    /\d[\d,.]*[KMBk%]?\s+(?:higher|lower|faster|slower|more|fewer)\s+than\b/i.test(text) ||
    /\bstalled?\s+\d+\s+block|\b\d+\s+(?:blocks?|tx|transactions?)\s+(?:stuck|pending|delayed)\b/i.test(text) ||
    /\b(?:vs\.?|versus|compared to|up from|down from)\s+\d[\d,.]*\b/i.test(text)
  );
}

function isVagueTrendNarrative(text: string): boolean {
  // Signals that describe organic/gradual trends without a specific measurable incident.
  const vagueTerms = /\bgrowing interest\b|\bincreasing adoption\b|\borganic\b|\bgradually\b|\btraction\b|\bmomentum\b|\bon the rise\b|\bemerging trend\b|\bslow(ly)? increasing\b|\bsteadily\b/i.test(text);
  const hasSpecificAnchor = /\bpr\s+#\d+\b|\bissue\s+#\d+\b|\bv\d+\.\d+|\bcve-\d{4}|\bblock\s*\d{5,}|\bhttp\s*[45]\d\d\b/i.test(text);
  const hasDelta = hasMeasurableEcosystemDelta(text);
  return vagueTerms && !hasSpecificAnchor && !hasDelta;
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
    /\bstructural\b|\bsystem\b|\bnetwork-level\b|\bnetwork wide\b|\bbroader same-beat\b|\bbroader package\b|\bbroader story\b/i.test(text) ||
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

function buildSignalGuardBody(submission: SerializedSubmission): string {
  return [
    submission.article_preview?.lede,
    submission.article_preview?.why_it_matters,
    submission.candidate_signal.summary,
    submission.candidate_signal.significance,
    submission.candidate_signal.causality
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
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

function scoreCandidate(
  submission: SerializedSubmission,
  context: ScoreContext
): Omit<RankedCandidate, "sourcePath"> {
  const {
    optimization,
    briefSnapshot,
    agentBehavior,
    historicalBriefSignals,
    autoGate,
    finalSignalGuard,
    signalAgentContract
  } = context;
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
  const normalizedSubmissionBeat = normalizeBeat(submission.candidate_signal.beat);
  const beatOwners = (agentBehavior?.agents ?? []).filter((agent) =>
    agent.beats.map(normalizeBeat).includes(normalizedSubmissionBeat)
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
  const exactAnchor = hasExactAnchor(submission.headline);
  const structuralPattern = hasStructuralPattern(candidateContextText);
  const operatorConsequence = hasOperatorConsequence(candidateContextText);
  const disclosureText = getDisclosureText(submission);
  const missionAligned = passesMissionAlignment(candidateContextText);
  const replicableDisclosure =
    !hasTriviallyVagueDisclosure(disclosureText) && hasConcreteDisclosureAnchors(disclosureText);
  const inscribableNews = passesInscribableNewsTest(candidateContextText);
  const valueCreating = passesValueCreationTest(candidateContextText);
  const broadWinnerShape = hasBroadWinnerShape(submission, candidateContextText);
  const rawReleaseWithoutOperatorConsequence = isRawReleaseWithoutOperatorConsequence(
    submission,
    operatorConsequence
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
  const approvalReady =
    submissionStatus === "submit" &&
    editorialReview.readyToFile &&
    editorialReview.editorialFit !== "weak" &&
    editorialReview.publisherConfidence !== "low";
  const dailyPrepText = signalAgentContract?.dailyPrepText ?? "";
  const preFilingCheckIds = new Set(signalAgentContract?.preFilingCheckIds ?? []);
  const crowdedBeatIds = new Set(signalAgentContract?.crowdedBeatIds ?? []);
  const signalGuardBlockers = finalSignalGuard?.blockers ?? [];
  const signalGuardBody = buildSignalGuardBody(submission);
  const headlinePattern = inferHeadlinePattern(submission.headline);

  if (signalAgentContract?.objectivePressureNotes.length) {
    score += 2;
    reasons.push(`objective context loaded: ${signalAgentContract.objectivePressureNotes[0]}`);
  }
  if ((signalAgentContract?.gapToTop3 ?? null) !== null && (signalAgentContract?.gapToTop3 ?? 0) <= 50) {
    score += 3;
    reasons.push("top-3 pressure is live; prioritize brief-winning shapes over baseline approvals");
  }
  if ((signalAgentContract?.gapToTop6 ?? null) !== null && (signalAgentContract?.gapToTop6 ?? 0) <= 25) {
    score += 2;
    reasons.push("top-6 pressure is close enough that payout-quality filings matter more than exploratory volume");
  }
  if (signalAgentContract?.currentStreak) {
    reasons.push(`streak context loaded: ${signalAgentContract.currentStreak}`);
    if (!approvalReady) {
      score -= 4;
      reasons.push("active streak means weak non-ready filings are worse than waiting for a real winner");
    }
  }

  if (crowdedBeatIds.has(normalizedSubmissionBeat)) {
    score -= 12;
    reasons.push("competition memory marks this beat as crowded; candidate must clear the displacement bar");
  } else if (signalAgentContract?.competitionMemoryPresent) {
    score += 2;
    reasons.push("competition memory shows this beat is not in the most crowded lanes");
  }

  const winningHeadlineExamples = signalAgentContract?.winningHeadlineExamples ?? [];
  const currentCycleWinningHeadlines = signalAgentContract?.currentCycleWinningHeadlines ?? [];
  const currentCycleLossHeadlines = signalAgentContract?.currentCycleLossHeadlines ?? [];
  const exampleSimilarity = winningHeadlineExamples.reduce((best, headline) => {
    return Math.max(best, jaccardSimilarity(submission.headline, headline));
  }, 0);
  const currentWinnerSimilarity = currentCycleWinningHeadlines.reduce((best, headline) => {
    return Math.max(best, jaccardSimilarity(submission.headline, headline));
  }, 0);
  const currentLossSimilarity = currentCycleLossHeadlines.reduce((best, headline) => {
    return Math.max(best, jaccardSimilarity(submission.headline, headline));
  }, 0);
  if (approvalReady && exampleSimilarity >= 0.35) {
    score += 6;
    reasons.push("brief examples show this headline shape is close to a recent winner");
  }
  if (approvalReady && currentWinnerSimilarity >= 0.35) {
    score += 6;
    reasons.push("current-cycle editorial memory says this headline shape is close to today's winners");
  }
  if (currentLossSimilarity >= 0.35) {
    score -= 8;
    reasons.push("current-cycle editorial memory says this headline shape is too close to today's losing patterns");
  }

  if (
    approvalReady &&
    (signalAgentContract?.winningStoryShapes ?? []).some((shape) =>
      shape === headlinePattern ||
      (shape.includes("Broad") && broadWinnerShape) ||
      (shape.includes("operator consequence") && operatorConsequence)
    )
  ) {
    score += 6;
    reasons.push("competition memory says this story shape is converting recently");
  }

  if (
    signalAgentContract?.currentCycleValueCreatingPatterns.length &&
    valueCreating
  ) {
    score += 3;
    reasons.push(`current-cycle value bar loaded: ${signalAgentContract.currentCycleValueCreatingPatterns[0]}`);
  }

  if (
    signalAgentContract?.currentCycleSourcePatternsThatPassed.length &&
    (submission.sources ?? []).some((source) =>
      signalAgentContract.currentCycleSourcePatternsThatPassed.some((pattern) =>
        typeof source.source_url === "string" && source.source_url.includes(pattern)
      )
    )
  ) {
    score += 2;
    reasons.push("uses a source pattern that already cleared the current cycle");
  }

  if (submissionStatus === "submit") {
    score += 20;
    reasons.push("submission gate passed");
  } else if (manualCheckOnlyBlocked) {
    reasons.push("manual checks still missing before this can be filed");
  } else {
    score -= 30;
    reasons.push("submission gate failed on substantive checks");
  }

  if (editorialReview.readyToFile) {
    score += 15;
    reasons.push("editorial review says ready to file");
  } else {
    score -= 8;
    reasons.push("editorial review does not consider it filing-ready");
  }

  if (editorialReview.editorialFit === "strong") {
    score += 10;
    reasons.push("strong editorial fit");
  } else if (editorialReview.editorialFit === "borderline") {
    score += 2;
    reasons.push("borderline editorial fit");
  } else {
    score -= 12;
    reasons.push("weak editorial fit");
  }

  if (editorialReview.publisherConfidence === "high") {
    score += 10;
  } else if (editorialReview.publisherConfidence === "medium") {
    score += 4;
  } else {
    score -= 8;
    reasons.push("low publisher confidence");
  }

  if (submission.headline.length <= 110) {
    score += 4;
  } else if (submission.headline.length > 140) {
    score -= 10;
    reasons.push("headline too long");
  }

  if (hasRawReleaseNoteShape(submission.headline)) {
    score -= 10;
    reasons.push("headline reads like raw release notes instead of a finished filing");
  }

  if (hasArtifactTitleShape(submission.headline)) {
    score -= 8;
    reasons.push("headline starts with a source artifact instead of a publishable news event");
  }

  if (rawReleaseWithoutOperatorConsequence) {
    score -= 25;
    reasons.push("raw release-note framing without operator consequence is not competitive for In Brief");
  }

  if (missionAligned) {
    score += 6;
    reasons.push("passes publisher Q1 mission-aligned test");
  } else {
    score -= 24;
    reasons.push("fails publisher Q1 mission-aligned test");
  }

  if (replicableDisclosure) {
    score += 6;
    reasons.push("passes publisher Q2 replicable-disclosure test");
  } else {
    score -= 24;
    reasons.push("fails publisher Q2 replicable-disclosure test");
  }

  if (inscribableNews) {
    score += 5;
    reasons.push("passes publisher Q3 inscribable/newsworthy test");
  } else {
    score -= 18;
    reasons.push("fails publisher Q3 inscribable/newsworthy test");
  }

  if (valueCreating) {
    score += 5;
    reasons.push("passes publisher Q4 value-creating test");
  } else {
    score -= 18;
    reasons.push("fails publisher Q4 value-creating test");
  }

  if (
    /\bbefore\b|\bearly\b|\bsame day\b/i.test(submission.candidate_signal.significance)
  ) {
    score += 5;
    reasons.push("significance claims timing or novelty edge");
  }

  // Measurable delta: outstanding signals track specific before/after changes, not organic trickles.
  if (hasMeasurableEcosystemDelta(candidateContextText)) {
    score += 7;
    reasons.push("signal tracks a specific measurable ecosystem delta (numeric before/after change) — strong brief candidate shape");
  }
  if (isVagueTrendNarrative(candidateContextText)) {
    score -= 12;
    reasons.push("signal reads like a vague trend narrative with no specific incident or measurable delta — displacement risk in any crowded brief");
  }

  if (submission.candidate_signal.likely_duplicate || autoGate?.duplicateStatus === "flagged") {
    score -= 20;
    reasons.push("duplicate risk already flagged");
  }

  if (pendingDuplicateRisk) {
    score -= 18;
    reasons.push("unresolved duplicate check is still pending");
  }

  if (freshnessRisk) {
    score -= 10;
    reasons.push("freshness risk must be cleared before filing");
  }

  if (submission.candidate_signal.uses_dashboard_as_primary_source || autoGate?.dashboardContaminated) {
    score -= 15;
    reasons.push("dashboard-first sourcing risk");
  }

  if (finalSignalGuard && !finalSignalGuard.ok) {
    score -= 40;
    reasons.push(`publisher/fact-checker guard failed: ${finalSignalGuard.blockers.join("; ")}`);
  }

  if (!signalAgentContract?.publisherSkillInstalled) {
    score = 0;
    reasons.push("signal agent contract failed: publisher skill is not installed locally");
  }

  if (!signalAgentContract?.factCheckerSkillInstalled) {
    score = 0;
    reasons.push("signal agent contract failed: fact-checker skill is not installed locally");
  }

  if (!signalAgentContract?.dailyPrepReportPresent) {
    score = 0;
    reasons.push("signal agent contract failed: daily-prep report is missing for this cycle");
  }

  if (!signalAgentContract?.editorialMemoryPresent) {
    score = 0;
    reasons.push("signal agent contract failed: editorial-memory.json is missing for this cycle");
  }

  if (
    dailyPrepText.includes("Package related release activity into one operator-facing story with consequence up top") &&
    (hasRawReleaseNoteShape(submission.headline) || hasArtifactTitleShape(submission.headline))
  ) {
    score = 0;
    reasons.push("daily-prep contract rejects raw release-note and artifact-title headline shapes for this cycle");
  }

  if (
    dailyPrepText.includes("Demote single_story_operator_angle") &&
    styleTested === "single_story_operator_angle"
  ) {
    score -= 20;
    reasons.push("daily-prep contract demotes single_story_operator_angle for this cycle");
  }

  if (preFilingCheckIds.has("headline-complete") && submission.headline.length > 140) {
    score = 0;
    reasons.push("editorial-memory check failed: headline-complete");
  }

  if (preFilingCheckIds.has("body-required") && signalGuardBody.trim().length === 0) {
    score = 0;
    reasons.push("editorial-memory check failed: body-required");
  }

  if (
    preFilingCheckIds.has("evidence-anchor-required") &&
    signalGuardBlockers.some((blocker) =>
      blocker.includes("Metric-heavy claim is sourced only from one organization") ||
      blocker.includes("Sources do not include an independent external verifier") ||
      blocker.includes("All sources are internal or agent-oracle-only")
    )
  ) {
    score = 0;
    reasons.push("editorial-memory check failed: evidence-anchor-required");
  }

  if (
    preFilingCheckIds.has("duplicate-story-shape") &&
    (duplicateStatus !== "clear" ||
      signalGuardBlockers.some((blocker) =>
        blocker.includes("Headline looks too close") ||
        blocker.includes("Same story anchor already appears") ||
        blocker.includes("approved_not_in_brief angle")
      ))
  ) {
    score = 0;
    reasons.push("editorial-memory check failed: duplicate-story-shape");
  }

  if (
    preFilingCheckIds.has("wait-for-shipped-code") &&
    /\bpr\s+#\d+\b/i.test(candidateContextText) &&
    !/\bships?\b|\bshipped\b|\brelease\b|\blive\b|\bpublished\b/i.test(candidateContextText)
  ) {
    score = 0;
    reasons.push("editorial-memory check failed: wait-for-shipped-code");
  }

  if (hasRequiredUpgradeWindow(candidateContextText)) {
    score += 8;
    reasons.push("source carries an exact upgrade window or failure threshold operators can act on");
  }

  if (readsLikeGenericExternalAdaptation(submission)) {
    score -= 18;
    reasons.push("external story still reads descriptive rather than like a filing-ready operator signal");
  }

  const beatPreference = optimization?.beatPreferences.find(
    (item) => item.beat === submission.candidate_signal.beat
  );
  const beatCrowding = optimization?.beatCrowding?.find(
    (item) => item.beat === submission.candidate_signal.beat
  );
  const preferredHeadlinePattern = optimization?.winningHeadlinePatterns[0]?.pattern ?? null;
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

  // --- EDITORIAL LEARNING ENFORCEMENT: beat specialization state ---
  const editorialLearnings = optimization?.editorialLearnings;
  if (editorialLearnings) {
    const normalizedPrimary = editorialLearnings.primaryBeat
      ? normalizeBeat(editorialLearnings.primaryBeat)
      : null;
    const normalizedSecondary = editorialLearnings.secondaryBeat
      ? normalizeBeat(editorialLearnings.secondaryBeat)
      : null;
    const normalizedDeprioritized = editorialLearnings.deprioritizedBeats.map(normalizeBeat);

    if (normalizedPrimary !== null && normalizedSubmissionBeat === normalizedPrimary) {
      score += 8;
      reasons.push(`beat ${submission.candidate_signal.beat} matches the outcome-backed primary specialization lane`);
    } else if (normalizedSecondary !== null && normalizedSubmissionBeat === normalizedSecondary) {
      score += 4;
      reasons.push(`beat ${submission.candidate_signal.beat} matches the outcome-backed secondary specialization lane`);
    } else if (normalizedDeprioritized.includes(normalizedSubmissionBeat)) {
      score -= 10;
      reasons.push(`beat ${submission.candidate_signal.beat} is memory-deprioritized — editorial learning shows weak conversion here`);
    } else if (normalizedPrimary !== null && normalizedDeprioritized.length > 0) {
      score -= 4;
      reasons.push(`beat ${submission.candidate_signal.beat} is outside the two learned specialization lanes`);
    }

    // --- EDITORIAL LEARNING ENFORCEMENT: raw stat dump anti-pattern ---
    if (editorialLearnings.rawStatDumpAntiPatternActive && !operatorConsequence) {
      score -= 12;
      reasons.push("memory enforces raw-stat-dump anti-pattern: no operator consequence present and outcome data shows this shape loses");
    }

    // --- EDITORIAL LEARNING ENFORCEMENT: feed-only source anti-pattern ---
    if (editorialLearnings.feedOnlySourceAntiPatternActive && submission.candidate_signal.uses_dashboard_as_primary_source) {
      score -= 10;
      reasons.push("memory enforces feed-only-source anti-pattern: dashboard-primary sourcing is outcome-proven to underperform");
    }

    // --- EDITORIAL LEARNING ENFORCEMENT: timing loss boost for early-window candidates ---
    if (editorialLearnings.timingLossObserved) {
      const detectedAt = submission.candidate_signal.detected_at;
      const detectedHourUTC = detectedAt ? new Date(detectedAt).getUTCHours() : null;
      if (detectedHourUTC !== null && detectedHourUTC < 10) {
        score += 6;
        reasons.push("timing-loss memory active: early-UTC candidate gets boost (detected before 10:00 UTC)");
      }
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

  if ((briefSnapshot?.occupiedBeats ?? []).map(normalizeBeat).includes(normalizedSubmissionBeat)) {
    score -= 8;
    reasons.push(`beat ${submission.candidate_signal.beat} is already occupied in the latest brief snapshot`);
  }

  if (briefSnapshot && briefSnapshot.repeatWinners.length > 0) {
    score -= 3;
    reasons.push("repeat-winner pressure is high in the latest brief snapshot");
  }

  if (approvalReady) {
    reasons.push("candidate already clears the approval-quality floor, so brief-win signals can act as upside");

    if (historicalBriefSignals.preferredBeats.includes(normalizedSubmissionBeat)) {
      score += 6;
      reasons.push(`beat ${submission.candidate_signal.beat} matches the historical brief-winning lanes`);
    }

    if (
      historicalBriefSignals.prefersReleaseConsequence &&
      sourceDomains.includes("github.com") &&
      !hasRawReleaseNoteShape(submission.headline) &&
      operatorConsequence
    ) {
      score += 6;
      reasons.push("candidate matches the historical release-plus-operator-consequence winning shape");
    }

    if (
      historicalBriefSignals.prefersStructuralPatterns &&
      structuralPattern
    ) {
      score += 5;
      reasons.push("candidate matches the historical structural-pattern winning shape");
    }

    if (historicalBriefSignals.prefersExactAnchors && exactAnchor) {
      score += 5;
      reasons.push("headline uses the exact numeric or version anchors that top winners favor");
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
      score += 10;
      reasons.push(
        `sources match domains that have recently won the brief (${winningDomainMatches.map((item) => item.domain).join(", ")})`
      );
    } else if (sourceDomains.length > 0 && topWinningDomains.length > 0) {
      score -= 4;
      reasons.push("sources do not match the domains that are recently winning the brief");
    }

    if (dominantBeatOwners.length >= 2) {
      score -= broadWinnerShape && operatorConsequence ? 6 : 14;
      reasons.push(`beat ${submission.candidate_signal.beat} is actively owned by repeat-winning agents`);
    } else if (dominantBeatOwners.length === 1) {
      score -= broadWinnerShape && operatorConsequence ? 4 : 9;
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
    } else {
      score += 3;
      reasons.push("no tracked competitors on this story — unique pick advantage");
    }
  } else if (winningDomainMatches.length > 0 || dominantBeatOwners.length > 0) {
    reasons.push("brief-win pattern signals were observed but ignored because the candidate has not cleared the approval-quality floor");
  }

  if (competitorCoverage.length === 0 && !approvalReady) {
    reasons.push("no tracked competitors on this story (unique pick noted, but candidate has not cleared approval-quality floor)");
  }

  const normalized = normalizeScore(score);
  const obviousBriefWinner =
    normalized >= 88 &&
    approvalReady &&
    missionAligned &&
    replicableDisclosure &&
    inscribableNews &&
    valueCreating &&
    editorialReview.editorialFit === "strong" &&
    editorialReview.publisherConfidence === "high" &&
    operatorConsequence &&
    broadWinnerShape &&
    duplicateStatus === "clear" &&
    freshnessStatus !== "risk_unresolved" &&
    !rawReleaseWithoutOperatorConsequence &&
    !hasArtifactTitleShape(submission.headline) &&
    !hasRawReleaseNoteShape(submission.headline);

  if (obviousBriefWinner) {
    reasons.push("clears the explicit obvious-brief-winner threshold");
  } else {
    reasons.push("does not yet clear the explicit obvious-brief-winner threshold");
  }

  // Late-window threshold gate: if timing losses are in memory and the candidate was
  // detected at or after 13:00 UTC (when the 30-slot cap starts filling), require a
  // stronger score before filing.
  const lateWindowActive =
    optimization?.editorialLearnings?.lateWindowThresholdRaised === true &&
    (() => {
      const detectedAt = submission.candidate_signal.detected_at;
      const h = detectedAt ? new Date(detectedAt).getUTCHours() : null;
      return h !== null && h >= 13;
    })();
  const fileThreshold = lateWindowActive ? 82 : 75;
  if (lateWindowActive) {
    reasons.push("late-window gate active (memory: timing losses observed) — file threshold raised to 82");
  }

  let decision: RankedCandidateDecision =
    normalized >= fileThreshold
      ? "file"
      : normalized >= 45
        ? "hold"
        : "reject";

  if ((manualCheckOnlyBlocked || pendingDuplicateRisk || freshnessRisk) && decision === "file") {
    decision = "hold";
  }

  // Displacement risk gate: a signal in an occupied beat that is not an obvious brief winner
  // is highly likely to be displaced after approval (approved ≠ in brief). Hold it unless it
  // clears the winner bar, which is the only way to survive deterministic roster reconciliation.
  const beatOccupiedInBrief = (briefSnapshot?.occupiedBeats ?? []).map(normalizeBeat).includes(normalizedSubmissionBeat);
  if (beatOccupiedInBrief && !obviousBriefWinner && normalized < 85 && decision === "file") {
    decision = "hold";
    reasons.push("displacement risk gate: beat is occupied in the latest brief and candidate is below winner-tier threshold (85) — hold to avoid displacement-probable filing");
  }

  if (finalSignalGuard && !finalSignalGuard.ok) {
    decision = "reject";
  }

  if (rawReleaseWithoutOperatorConsequence && decision === "file") {
    decision = approvalReady ? "hold" : "reject";
  }

  if ((!missionAligned || !replicableDisclosure || !inscribableNews || !valueCreating) && decision === "file") {
    decision = "hold";
  }

  if (!missionAligned || !replicableDisclosure) {
    decision = "reject";
  }

  if (
    !signalAgentContract?.publisherSkillInstalled ||
    !signalAgentContract?.factCheckerSkillInstalled ||
    !signalAgentContract?.dailyPrepReportPresent ||
    !signalAgentContract?.editorialMemoryPresent
  ) {
    decision = "reject";
  }

  if (
    dailyPrepText.includes("Package related release activity into one operator-facing story with consequence up top") &&
    (hasRawReleaseNoteShape(submission.headline) || hasArtifactTitleShape(submission.headline))
  ) {
    decision = "reject";
  }

  return {
    candidateId: submission.candidate_signal.candidate_id,
    beat: submission.candidate_signal.beat,
    headline: submission.headline,
    score: normalized,
    obviousBriefWinner,
    decision,
    lifecycle: inferLifecycleFromDecision(decision, reasons),
    styleTested,
    competitorReference,
    whyThisStyleWasChosen,
    duplicateStatus,
    freshnessStatus,
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

export async function rankDryRunCandidates(
  reportDate: string,
  baseDir?: string
): Promise<RankedCandidate[]> {
  const root = resolve(baseDir ?? process.cwd());
  const queueDir = resolve(root, `data/dry-runs/${reportDate}`);
  const [optimization, briefSnapshot, agentBehavior, historicalBriefSignals, competitorProfiles, signalAgentContract] = await Promise.all([
    readOptimizationSnapshot(reportDate, root),
    readBriefWinnerSnapshot(reportDate, root),
    readAgentBehaviorState(root),
    readHistoricalBriefSignals(root),
    fetchCompetitorProfiles(root),
    loadSignalAgentContract(reportDate, root)
  ]);

  let fileNames: string[] = [];
  try {
    fileNames = await readdir(queueDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const parsedSubmissions = await Promise.all(
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

  const staleSubmissions = parsedSubmissions.filter(({ submission }) =>
    detectedBeforeReportDate(submission, reportDate)
  );
  await Promise.all(
    staleSubmissions.map(({ sourcePath }) => rm(sourcePath, { force: true }))
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
  const finalSignalGuardResults = await Promise.all(
    submissions.map(({ submission }) =>
      evaluateSignalGuard({
        reportDate,
        headline: submission.headline,
        beat_slug: submission.candidate_signal.beat,
        body: buildSignalGuardBody(submission),
        sources: (submission.sources ?? []).map((source) => ({
          url: source.source_url,
          title: source.source_type
        })),
        enforceWinnerBar: true,
        model_disclosure: {
          tools_used: submission.model_disclosure?.tools_used ?? [],
          derivation_steps: submission.model_disclosure?.derivation_steps ?? []
        }
      }, root)
    )
  );

  const rankedCandidates = submissions.map(({ sourcePath, submission }, index) => ({
    ...scoreCandidate(submission, {
      optimization,
      briefSnapshot,
      agentBehavior,
      historicalBriefSignals,
      autoGate: autoGateResults[index],
      finalSignalGuard: finalSignalGuardResults[index],
      competitorProfiles,
      signalAgentContract
    }),
    sourcePath
  }) satisfies RankedCandidate);

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
