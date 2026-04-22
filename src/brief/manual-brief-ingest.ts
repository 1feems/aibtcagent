import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { BriefWinnerSignal, BriefWinnerSnapshot } from "./winner-tracker.js";

interface ManualBriefSource {
  url: string;
  title?: string;
}

interface ManualBriefEntry {
  agent: string;
  beat: string;
  headline: string;
  sources?: ManualBriefSource[];
  notes?: string[];
}

interface ManualApprovedNotInBrief {
  agent?: string;
  beat: string;
  headline: string;
  sources?: ManualBriefSource[];
}

interface ManualDailyBrief {
  kind?: "manual_daily_brief";
  reportDate?: string;
  entries: ManualBriefEntry[];
  approvedNotInBrief?: ManualApprovedNotInBrief[];
}

interface IngestedBriefState {
  kind?: "manual_brief_ingest_state";
  updatedAt?: string;
  entries: Array<{
    reportDate: string;
    headline: string;
  }>;
  reports?: Array<{
    reportDate: string;
    inputPath: string;
    briefJsonPath: string;
    briefSnapshotPath: string;
    entryCount: number;
    updatedAt: string;
  }>;
}

interface AgentBehaviorSnapshot {
  kind: "brief_agent_behavior";
  updatedAt: string;
  agents: Array<{
    agent: string;
    wins: number;
    beats: string[];
    sameDayMultiWins: number;
    commonSourceDomains: Array<{ domain: string; count: number }>;
  }>;
  commonSourceDomains: Array<{ domain: string; count: number }>;
}

interface TopCompetitorStylesSnapshot {
  kind: "top_competitor_styles";
  reportDate: string;
  updatedAt: string;
  competitors: Array<{
    agent: string;
    wins: number;
    beats: string[];
    sameDayMultiWins: number;
    commonSourceDomains: Array<{ domain: string; count: number }>;
    styleLabel: string;
    styleReason: string;
  }>;
}

interface BriefAnalysisReport {
  kind: "daily_brief_analysis";
  reportDate: string;
  generatedAt: string;
  occupiedBeats: string[];
  repeatWinners: Array<{ agent: string; appearances: number; beats: string[] }>;
  sourcePatterns: Array<{ domain: string; count: number }>;
  topAgentsToday: Array<{ agent: string; appearances: number; beats: string[] }>;
}

const BRIEF_BEATS = new Set([
  "Agent Economy",
  "Onboarding",
  "Security",
  "Governance",
  "Infrastructure",
  "Distribution",
  "Agent Social",
  "Agent Trading",
  "Agent Skills",
  "Deal Flow"
]);

function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function inferCompetitorStyle(agent: {
  wins: number;
  beats: string[];
  sameDayMultiWins: number;
  commonSourceDomains: Array<{ domain: string; count: number }>;
}): { styleLabel: string; styleReason: string } {
  const domains = agent.commonSourceDomains.map((item) => item.domain);
  const internalOrReleaseHeavy = domains.some((domain) =>
    domain === "github.com" || domain.endsWith("aibtc.com") || domain.endsWith("aibtc.news") || domain.endsWith("hiro.so")
  );

  if (agent.sameDayMultiWins > 0 && agent.beats.length > 1) {
    return {
      styleLabel: "cross_beat_operator_packaging",
      styleReason: "Repeated same-day multi-wins across multiple beats suggest broader packaging that can win more than one slot."
    };
  }

  if (internalOrReleaseHeavy && agent.beats.length > 1) {
    return {
      styleLabel: "release_operator_consequence",
      styleReason: "Wins cluster around release or internal proof sources while still converting across more than one beat."
    };
  }

  if (agent.beats.length === 1) {
    return {
      styleLabel: `${agent.beats[0].toLowerCase().replace(/[^a-z0-9]+/g, "_")}_specialist`,
      styleReason: `Observed wins are concentrated on ${agent.beats[0]}, so treat this agent as a beat specialist until broader evidence appears.`
    };
  }

  return {
    styleLabel: "broad_system_synthesis",
    styleReason: "Wins span multiple beats without a single narrow proof pattern dominating the profile."
  };
}

function inferSourceContext(
  sources: ManualBriefSource[] | undefined
): {
  kind: "internal_operator_story" | "external_but_actionable_agent_story";
  scope: "aibtc_internal" | "broader_agent_environment" | "mixed";
  proof_type: "release" | "api" | "article" | "report" | "mixed";
} {
  const domains = (sources ?? []).map((source) => extractDomain(source.url));
  const hasInternal = domains.some((domain) =>
    domain.includes("github.com") || domain.includes("aibtc.") || domain.includes("hiro.so")
  );
  const hasExternal = domains.some((domain) => !domain.includes("aibtc.") && !domain.includes("github.com"));

  let proofType: "release" | "api" | "article" | "report" | "mixed" = "article";
  if (domains.some((domain) => domain.includes("github.com"))) {
    proofType = "release";
  } else if (domains.some((domain) => domain.includes("api") || domain.includes("hiro.so"))) {
    proofType = "api";
  } else if (domains.some((domain) => /chainalysis|trmlabs|rekt|elliptic/.test(domain))) {
    proofType = "report";
  }

  return {
    kind: hasInternal && !hasExternal ? "internal_operator_story" : "external_but_actionable_agent_story",
    scope: hasInternal && hasExternal ? "mixed" : hasInternal ? "aibtc_internal" : "broader_agent_environment",
    proof_type: proofType
  };
}

function buildTrainingEntry(reportDate: string, entry: ManualBriefEntry) {
  const sourceContext = inferSourceContext(entry.sources);
  const domains = (entry.sources ?? []).map((source) => extractDomain(source.url));

  return {
    label: "in_brief",
    beat: entry.beat,
    headline: entry.headline,
    source_context: sourceContext,
    strengths: [
      "Observed directly in the provided daily brief.",
      ...(entry.notes ?? [])
    ],
    weaknesses: [],
    reason_tags: [
      "manual_brief_ingest",
      "brief_slot_winner",
      ...(domains.some((domain) => domain.includes("github.com")) ? ["github_release_pattern"] : []),
      ...(domains.some((domain) => domain.includes("aibtc.")) ? ["aibtc_native_source_pattern"] : []),
      ...(domains.some((domain) => !domain.includes("aibtc.") && !domain.includes("github.com"))
        ? ["external_source_pattern"]
        : [])
    ],
    fact_checker: {
      exact_claim_supported: true,
      source_match: true,
      number_verifiable: true,
      causality_supported: true,
      operator_implication_supported: true
    },
    brief_competition: {
      same_day_competition_known: true,
      broadest_story_on_beat: true,
      lost_to_broader_same_beat_story: false
    },
    scores: {
      specificity: /\d/.test(entry.headline) ? 5 : 4,
      breadth: 5,
      operator_consequence: /\bqueue|security|window|upgrade|payment|launch|deploy|vote|risk\b/i.test(entry.headline) ? 5 : 4,
      publication_readiness: 5
    },
    training_note: `Imported from the ${reportDate} daily brief because it won an In Brief slot.`
  };
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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isRelativeTimeLine(line: string): boolean {
  return /^[·•]?\s*\d+\s*(?:m|h|d)\s+ago$/i.test(line.trim());
}

function isReadMoreLine(line: string): boolean {
  return /^read more\b/i.test(line.trim());
}

function collectParagraph(lines: string[], startIndex: number): { text: string; nextIndex: number } {
  const parts: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (line.length === 0) {
      if (parts.length > 0) {
        break;
      }
      index += 1;
      continue;
    }
    parts.push(line);
    index += 1;
  }

  return {
    text: normalizeWhitespace(parts.join(" ")),
    nextIndex: index
  };
}

function parseManualBriefText(reportDate: string, rawText: string): ManualDailyBrief {
  const lines = rawText
    .split(/\r?\n/u)
    .map((line) => line.trimEnd());
  const entries: ManualBriefEntry[] = [];

  let index = 0;
  while (index < lines.length) {
    const beat = lines[index].trim();
    if (!BRIEF_BEATS.has(beat)) {
      index += 1;
      continue;
    }

    index += 1;
    while (index < lines.length && lines[index].trim().length === 0) {
      index += 1;
    }
    if (index >= lines.length) {
      break;
    }

    const headline = normalizeWhitespace(lines[index] ?? "");
    index += 1;

    const bodyParagraphs: string[] = [];
    while (index < lines.length) {
      while (index < lines.length && lines[index].trim().length === 0) {
        index += 1;
      }
      if (index >= lines.length) {
        break;
      }

      const maybeAgent = lines[index].trim();
      const maybeTime = lines[index + 1]?.trim() ?? "";
      if (maybeAgent.length > 0 && isRelativeTimeLine(maybeTime)) {
        break;
      }
      if (BRIEF_BEATS.has(maybeAgent)) {
        break;
      }

      const paragraph = collectParagraph(lines, index);
      if (paragraph.text.length > 0) {
        bodyParagraphs.push(paragraph.text);
      }
      index = paragraph.nextIndex;
    }

    while (index < lines.length && lines[index].trim().length === 0) {
      index += 1;
    }

    let agent = "unknown";
    if (index < lines.length && (lines[index + 1] ? isRelativeTimeLine(lines[index + 1]) : false)) {
      agent = normalizeWhitespace(lines[index]);
      index += 1;
      while (index < lines.length && isRelativeTimeLine(lines[index])) {
        index += 1;
      }
      while (index < lines.length && isReadMoreLine(lines[index])) {
        index += 1;
      }
    }

    if (headline.length > 0) {
      entries.push({
        agent,
        beat,
        headline,
        notes: bodyParagraphs.length > 0 ? bodyParagraphs : undefined
      });
    }
  }

  return {
    kind: "manual_daily_brief",
    reportDate,
    entries
  };
}

async function readManualBrief(
  reportDate: string,
  baseDir?: string
): Promise<null | { brief: ManualDailyBrief; inputPath: string }> {
  const root = resolve(baseDir ?? process.cwd());
  const jsonPath = resolve(root, `data/briefs/${reportDate}.json`);
  const jsonBrief = await readJsonOrNull<ManualDailyBrief>(jsonPath);
  if (jsonBrief) {
    return { brief: jsonBrief, inputPath: jsonPath };
  }

  const textCandidates = [
    resolve(root, `data/briefs/${reportDate}.md`),
    resolve(root, `data/briefs/${reportDate}.txt`)
  ];

  for (const candidatePath of textCandidates) {
    try {
      const rawText = await readFile(candidatePath, "utf8");
      const parsed = parseManualBriefText(reportDate, rawText);
      if (parsed.entries.length === 0) {
        continue;
      }
      await mkdir(dirname(jsonPath), { recursive: true });
      await writeFile(jsonPath, JSON.stringify(parsed, null, 2), "utf8");
      return { brief: parsed, inputPath: candidatePath };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  return null;
}

async function appendJsonl(filePath: string, entry: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  let existing = "";
  try {
    existing = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await writeFile(filePath, `${existing}${prefix}${JSON.stringify(entry)}\n`, "utf8");
}

async function updateTrainingFromBrief(
  reportDate: string,
  brief: ManualDailyBrief,
  baseDir?: string
): Promise<IngestedBriefState> {
  const root = resolve(baseDir ?? process.cwd());
  const statePath = resolve(root, "data/state/manual-brief-ingest.json");
  const currentState = (await readJsonOrNull<IngestedBriefState>(statePath)) ?? { entries: [] };
  const seen = new Set(currentState.entries.map((item) => `${item.reportDate}:${item.headline}`));

  for (const entry of brief.entries) {
    const key = `${reportDate}:${entry.headline}`;
    if (seen.has(key)) {
      continue;
    }
    await appendJsonl(resolve(root, "data/training/in-brief.jsonl"), buildTrainingEntry(reportDate, entry));
    currentState.entries.push({ reportDate, headline: entry.headline });
    seen.add(key);
  }

  return currentState;
}

async function saveIngestState(
  state: IngestedBriefState,
  baseDir?: string
): Promise<string> {
  const root = resolve(baseDir ?? process.cwd());
  const statePath = resolve(root, "data/state/manual-brief-ingest.json");
  const normalized: IngestedBriefState = {
    kind: "manual_brief_ingest_state",
    updatedAt: new Date().toISOString(),
    entries: state.entries,
    reports: state.reports
      ?.slice()
      .sort((left, right) => left.reportDate.localeCompare(right.reportDate))
  };
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(normalized, null, 2), "utf8");
  return statePath;
}

function upsertIngestReport(
  state: IngestedBriefState,
  report: NonNullable<IngestedBriefState["reports"]>[number]
): IngestedBriefState {
  const reports = state.reports ?? [];
  const nextReports = reports.filter((entry) => entry.reportDate !== report.reportDate);
  nextReports.push(report);
  return {
    ...state,
    reports: nextReports
  };
}

function toSignal(entry: ManualBriefEntry | ManualApprovedNotInBrief, publishedAt: string | null): BriefWinnerSignal {
  return {
    signalId: null,
    headline: entry.headline,
    beat: entry.beat,
    publishedAt,
    approvedAt: publishedAt,
    agent: entry.agent ?? "unknown"
  };
}

async function saveBriefWinnerSnapshot(
  reportDate: string,
  brief: ManualDailyBrief,
  baseDir?: string
): Promise<string> {
  const byAgent = new Map<string, { appearances: number; beats: string[]; headlines: string[] }>();
  for (const entry of brief.entries) {
    const current = byAgent.get(entry.agent) ?? { appearances: 0, beats: [], headlines: [] };
    current.appearances += 1;
    current.beats.push(entry.beat);
    current.headlines.push(entry.headline);
    byAgent.set(entry.agent, current);
  }

  const snapshot: BriefWinnerSnapshot = {
    kind: "brief_winner_snapshot",
    reportDate,
    generatedAt: new Date().toISOString(),
    occupiedBeats: [...new Set(brief.entries.map((entry) => entry.beat))].sort(),
    repeatWinners: [...byAgent.entries()]
      .map(([agent, value]) => ({ agent, appearances: value.appearances, beats: [...new Set(value.beats)].sort() }))
      .filter((item) => item.appearances > 1)
      .sort((left, right) => right.appearances - left.appearances || left.agent.localeCompare(right.agent)),
    winners: [...byAgent.entries()]
      .map(([agent, value]) => ({
        agent,
        appearances: value.appearances,
        beats: [...new Set(value.beats)].sort(),
        headlines: value.headlines
      }))
      .sort((left, right) => right.appearances - left.appearances || left.agent.localeCompare(right.agent)),
    publishedSignals: brief.entries.map((entry) => toSignal(entry, `${reportDate}T00:00:00Z`)),
    approvedNotInBrief: (brief.approvedNotInBrief ?? []).map((entry) => toSignal(entry, null))
  };

  const filePath = resolve(baseDir ?? process.cwd(), `data/state/brief-winners-${reportDate}.json`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  return filePath;
}

async function findAvailableManualBriefDates(baseDir?: string): Promise<string[]> {
  const root = resolve(baseDir ?? process.cwd());
  const briefsDir = resolve(root, "data/briefs");
  let files: string[] = [];
  try {
    files = await readdir(briefsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const dates = new Set<string>();
  for (const fileName of files) {
    const match = fileName.match(/^(\d{4}-\d{2}-\d{2})\.(json|md|txt)$/);
    if (match) {
      dates.add(match[1]);
    }
  }

  return [...dates].sort();
}

async function ingestResolvedBrief(
  params: {
    reportDate: string;
    brief: ManualDailyBrief;
    inputPath: string;
  },
  baseDir?: string
): Promise<{ state: IngestedBriefState; briefSnapshotPath: string }> {
  const root = resolve(baseDir ?? process.cwd());
  const state = await updateTrainingFromBrief(params.reportDate, params.brief, root);
  const briefSnapshotPath = await saveBriefWinnerSnapshot(params.reportDate, params.brief, root);
  const nextState = upsertIngestReport(state, {
    reportDate: params.reportDate,
    inputPath: params.inputPath,
    briefJsonPath: resolve(root, `data/briefs/${params.reportDate}.json`),
    briefSnapshotPath,
    entryCount: params.brief.entries.length,
    updatedAt: new Date().toISOString()
  });
  await saveIngestState(nextState, root);
  return {
    state: nextState,
    briefSnapshotPath
  };
}

async function updateAgentBehaviorState(
  reportDate: string,
  baseDir?: string
): Promise<{ analysisPath: string; behaviorPath: string; competitorStylesPath: string }> {
  const root = resolve(baseDir ?? process.cwd());
  const briefsDir = resolve(root, "data/briefs");
  let files: string[] = [];
  try {
    files = (await readdir(briefsDir)).filter((fileName) => fileName.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        analysisPath: resolve(root, `data/reports/brief-analysis/${reportDate}.json`),
        behaviorPath: resolve(root, "data/state/brief-agent-behavior.json"),
        competitorStylesPath: resolve(root, "data/state/top_5_competitor_styles.json")
      };
    }
    throw error;
  }

  const agentStats = new Map<string, { wins: number; beats: string[]; sameDayMultiWins: number; domains: string[] }>();
  const domainCounts = new Map<string, number>();
  let todayEntries: ManualBriefEntry[] = [];

  for (const fileName of files) {
    const brief = await readJsonOrNull<ManualDailyBrief>(resolve(briefsDir, fileName));
    if (!brief) {
      continue;
    }
    const fileDate = brief.reportDate ?? fileName.replace(/\.json$/, "");
    if (fileDate === reportDate) {
      todayEntries = brief.entries;
    }

    const countsByAgent = new Map<string, number>();
    for (const entry of brief.entries) {
      countsByAgent.set(entry.agent, (countsByAgent.get(entry.agent) ?? 0) + 1);
      const current = agentStats.get(entry.agent) ?? { wins: 0, beats: [], sameDayMultiWins: 0, domains: [] };
      current.wins += 1;
      current.beats.push(entry.beat);
      current.domains.push(...(entry.sources ?? []).map((source) => extractDomain(source.url)));
      agentStats.set(entry.agent, current);
      for (const domain of (entry.sources ?? []).map((source) => extractDomain(source.url))) {
        domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
      }
    }
    for (const [agent, count] of countsByAgent.entries()) {
      if (count > 1) {
        const current = agentStats.get(agent);
        if (current) {
          current.sameDayMultiWins += 1;
        }
      }
    }
  }

  const behaviorState: AgentBehaviorSnapshot = {
    kind: "brief_agent_behavior",
    updatedAt: new Date().toISOString(),
    agents: [...agentStats.entries()]
      .map(([agent, value]) => {
        const perAgentDomains = new Map<string, number>();
        for (const domain of value.domains) {
          perAgentDomains.set(domain, (perAgentDomains.get(domain) ?? 0) + 1);
        }
        return {
          agent,
          wins: value.wins,
          beats: [...new Set(value.beats)].sort(),
          sameDayMultiWins: value.sameDayMultiWins,
          commonSourceDomains: [...perAgentDomains.entries()]
            .map(([domain, count]) => ({ domain, count }))
            .sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain))
            .slice(0, 5)
        };
      })
      .sort((left, right) => right.wins - left.wins || left.agent.localeCompare(right.agent)),
    commonSourceDomains: [...domainCounts.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain))
      .slice(0, 10)
  };

  const countsToday = new Map<string, number>();
  for (const entry of todayEntries) {
    countsToday.set(entry.agent, (countsToday.get(entry.agent) ?? 0) + 1);
  }

  const analysis: BriefAnalysisReport = {
    kind: "daily_brief_analysis",
    reportDate,
    generatedAt: new Date().toISOString(),
    occupiedBeats: [...new Set(todayEntries.map((entry) => entry.beat))].sort(),
    repeatWinners: [...countsToday.entries()]
      .map(([agent, appearances]) => ({
        agent,
        appearances,
        beats: [...new Set(todayEntries.filter((entry) => entry.agent === agent).map((entry) => entry.beat))].sort()
      }))
      .filter((item) => item.appearances > 1)
      .sort((left, right) => right.appearances - left.appearances || left.agent.localeCompare(right.agent)),
    sourcePatterns: behaviorState.commonSourceDomains,
    topAgentsToday: [...countsToday.entries()]
      .map(([agent, appearances]) => ({
        agent,
        appearances,
        beats: [...new Set(todayEntries.filter((entry) => entry.agent === agent).map((entry) => entry.beat))].sort()
      }))
      .sort((left, right) => right.appearances - left.appearances || left.agent.localeCompare(right.agent))
  };

  const analysisPath = resolve(root, `data/reports/brief-analysis/${reportDate}.json`);
  const behaviorPath = resolve(root, "data/state/brief-agent-behavior.json");
  const competitorStylesPath = resolve(root, "data/state/top_5_competitor_styles.json");
  const competitorStyles: TopCompetitorStylesSnapshot = {
    kind: "top_competitor_styles",
    reportDate,
    updatedAt: new Date().toISOString(),
    competitors: behaviorState.agents
      .slice(0, 5)
      .map((agent) => {
        const inferred = inferCompetitorStyle(agent);
        return {
          agent: agent.agent,
          wins: agent.wins,
          beats: agent.beats,
          sameDayMultiWins: agent.sameDayMultiWins,
          commonSourceDomains: agent.commonSourceDomains,
          styleLabel: inferred.styleLabel,
          styleReason: inferred.styleReason
        };
      })
  };
  await mkdir(dirname(analysisPath), { recursive: true });
  await mkdir(dirname(behaviorPath), { recursive: true });
  await mkdir(dirname(competitorStylesPath), { recursive: true });
  await writeFile(analysisPath, JSON.stringify(analysis, null, 2), "utf8");
  await writeFile(behaviorPath, JSON.stringify(behaviorState, null, 2), "utf8");
  await writeFile(competitorStylesPath, JSON.stringify(competitorStyles, null, 2), "utf8");

  return { analysisPath, behaviorPath, competitorStylesPath };
}

export async function ingestManualDailyBrief(
  reportDate: string,
  baseDir?: string
): Promise<null | {
  briefInputPath: string;
  briefSnapshotPath: string;
  analysisPath: string;
  behaviorPath: string;
  competitorStylesPath: string;
}> {
  const root = resolve(baseDir ?? process.cwd());
  const availableDates = await findAvailableManualBriefDates(root);
  if (availableDates.length === 0) {
    return null;
  }
  let currentBrief:
    | null
    | {
        brief: ManualDailyBrief;
        inputPath: string;
        briefSnapshotPath: string;
      } = null;

  for (const availableDate of availableDates) {
    const loadedBrief = await readManualBrief(availableDate, root);
    if (!loadedBrief) {
      continue;
    }
    const { brief, inputPath } = loadedBrief;
    const { briefSnapshotPath } = await ingestResolvedBrief(
      {
        reportDate: availableDate,
        brief,
        inputPath
      },
      root
    );
    if (availableDate === reportDate) {
      currentBrief = {
        brief,
        inputPath,
        briefSnapshotPath
      };
    }
  }

  if (!currentBrief) {
    return null;
  }
  const { analysisPath, behaviorPath, competitorStylesPath } = await updateAgentBehaviorState(reportDate, root);

  return {
    briefInputPath: currentBrief.inputPath,
    briefSnapshotPath: currentBrief.briefSnapshotPath,
    analysisPath,
    behaviorPath,
    competitorStylesPath
  };
}
