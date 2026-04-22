import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { inferLifecycleFromQueueStatus, isAwaitingHumanApproval, type CandidateLifecycle, type FilingQueueStatus, type RankedCandidateDecision } from "../filing/lifecycle.js";
import { advanceDispatchQueue, getNextDueDispatchCandidate, type StaggeredDispatchQueueState } from "../filing/staggered-dispatch.js";
import { generateLiveCandidateSlate } from "../filing/live-candidates.js";
import { verifyEditorialLearningProof } from "../brief/index.js";
import { enforceConciseHeadline } from "../signals/headline-composer.js";
import type { CandidateFilingReview, DailyOperatorSummary, DailyReport } from "../types/index.js";

interface RankedQueue {
  candidates?: Array<{
    candidateId: string;
    score: number;
    decision: RankedCandidateDecision;
    headline: string;
    reasons: string[];
  }>;
}

type RankedQueueCandidate = NonNullable<RankedQueue["candidates"]>[number];

interface FilingQueueItem {
  candidateId: string;
  headline: string;
  beat: string;
  score: number;
  duplicateStatus: "clear" | "pending" | "flagged";
  freshnessStatus: "clear" | "risk_unresolved" | "unknown";
  queueStatus: FilingQueueStatus;
  lifecycle?: CandidateLifecycle;
  reasons: string[];
  sourcePath?: string;
}

interface FilingQueue {
  topCandidateId?: string | null;
  items?: FilingQueueItem[];
  recommendationSummary?: {
    targetRecommendations?: number;
    recommendedCount?: number;
    uniqueBeatCount?: number;
    beatsRepresented?: string[];
    quotaNotes?: string[];
  };
}

function formatDispatchDueAt(dueAt: string | null): string {
  return dueAt ?? "n/a";
}

interface FiledSignalsState {
  filedSignals?: Array<{ candidateId: string | null; headline: string | null }>;
}

interface AgentBehaviorState {
  agents?: Array<{
    agent: string;
    wins: number;
    beats: string[];
    sameDayMultiWins: number;
  }>;
}

interface CandidateSourceSubmission {
  candidate_signal?: {
    detected_at?: string;
    summary?: string;
    significance?: string;
    causality?: string;
  };
  article_preview?: {
    title?: string;
    dek?: string;
    why_it_matters?: string;
  };
  sources?: Array<{
    source_url?: string;
  }>;
}

function buildCompetitorContext(beat: string, agentBehavior: AgentBehaviorState | null): string | null {
  const owners = (agentBehavior?.agents ?? [])
    .filter((a) => a.beats.includes(beat) && (a.wins >= 2 || a.sameDayMultiWins >= 1))
    .sort((a, b) => b.wins - a.wins || a.agent.localeCompare(b.agent));

  if (owners.length === 0) return null;
  if (owners.length === 1) return `Beat owned by ${owners[0].agent} (${owners[0].wins} wins)`;
  return `Beat contested: ${owners.slice(0, 2).map((o) => `${o.agent} (${o.wins})`).join(", ")}`;
}

function normalizeBeat(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function headlineSimilarity(left: string, right: string): number {
  const tokenize = (value: string): Set<string> =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
    );

  const a = tokenize(left);
  const b = tokenize(right);
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function buildBriefComparison(item: FilingQueueItem, briefFile: ManualBriefFile | null): string[] {
  const entries = (briefFile?.entries ?? []).filter(
    (entry): entry is { agent?: string; beat?: string; headline?: string } =>
      typeof entry.headline === "string" && typeof entry.beat === "string"
  );

  if (entries.length === 0) {
    return ["No same-day In Brief comparison available — manual brief not ingested yet."];
  }

  const sameBeat = entries.filter(
    (entry) => normalizeBeat(entry.beat ?? "") === normalizeBeat(item.beat)
  );

  if (sameBeat.length === 0) {
    return [`Beat ${item.beat} is open in today's In Brief — no published winner on this lane yet.`];
  }

  let bestEntry = sameBeat[0];
  let bestSimilarity = headlineSimilarity(item.headline, sameBeat[0].headline ?? "");
  for (const entry of sameBeat.slice(1)) {
    const similarity = headlineSimilarity(item.headline, entry.headline ?? "");
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestEntry = entry;
    }
  }

  const winnerLabel = bestEntry.agent ?? "unknown";
  const winnerHeadline = bestEntry.headline ?? "unknown";
  const rounded = bestSimilarity.toFixed(2);

  if (bestSimilarity >= 0.5) {
    return [
      `Today's In Brief already has a same-beat winner from ${winnerLabel}: "${winnerHeadline}" (headline similarity ${rounded}).`,
      "This candidate overlaps materially with the published winner — treat it as likely too narrow or too late unless the angle is clearly differentiated."
    ];
  }

  return [
    `Today's In Brief already has a same-beat winner from ${winnerLabel}: "${winnerHeadline}" (headline similarity ${rounded}).`,
    "The beat is occupied, but the angle is still differentiated enough that a broader or more operator-useful package may compete."
  ];
}

function getItemLifecycle(item: FilingQueueItem): CandidateLifecycle {
  return item.lifecycle ?? inferLifecycleFromQueueStatus(item.queueStatus, item.reasons);
}

function sentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function stripLeadReleasePhrase(headline: string): string {
  return headline
    .replace(/^(?:CVE-\d{4}-\d+\s+)?(?:[\w.-]+\s+)?(?:patch(?:ed)?|fix(?:ed)?|upgrade(?:d)?|release(?:d)?)\s+/i, "")
    .replace(/\b(?:patched|fixes?|upgrades?|released?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRepoLabel(source: CandidateSourceSubmission | null, fallbackHeadline: string): string | null {
  const rawUrl = source?.sources?.[0]?.source_url;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.hostname === "github.com") {
        const segments = parsed.pathname.split("/").filter(Boolean);
        const repo = segments[1] ?? segments[0] ?? "";
        if (repo === "landing-page") return "AIBTC landing-page";
        if (repo === "agent-news") return "AIBTC agent-news";
        if (repo.length > 0) return repo.replace(/-/g, " ");
      }
    } catch {
      // ignore parse failures
    }
  }

  if (/landing-page/i.test(fallbackHeadline)) return "AIBTC landing-page";
  if (/agent-news/i.test(fallbackHeadline)) return "AIBTC agent-news";
  if (/stacks/i.test(fallbackHeadline)) return "Stacks";
  return null;
}

function cleanArtifactNoise(text: string): string {
  return text
    .replace(/\([0-9a-f]{7,}\)/gi, "")
    .replace(/\(#\d+\)/g, "")
    .replace(/\bv\d+\.\d+(?:\.\d+)?\b/gi, "")
    .replace(/\bSETTLEMENT_TIMEOUT\b/g, "timeout")
    .replace(/\bexpirationTtl\b/g, "cache window")
    .replace(/\bCloudflare KV\b/g, "Cloudflare KV")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim()
    .replace(/[.:,-]+$/g, "")
    .trim();
}

function toNewsVerbPhrase(text: string): string {
  const cleaned = cleanArtifactNoise(text)
    .replace(/^inbox:\s*/i, "")
    .replace(/^(?:bug fixes?|fixes?|changes?)\s+/i, "")
    .trim();

  return cleaned
    .replace(/^return\s+/i, "returns ")
    .replace(/^enforce\s+/i, "adds ")
    .replace(/^ship[s]?\s+/i, "")
    .replace(/^patch(?:es|ed)?\s+/i, "patches ")
    .replace(/^adds?\s+/i, "adds ")
    .replace(/^improves?\s+/i, "improves ");
}

function addOperationalObject(repoLabel: string | null, phrase: string, context: string): string {
  const lowered = `${phrase} ${context}`.toLowerCase();

  if (/pending status instead of .*timeout/.test(lowered) && /x402|inbox|payment/.test(lowered)) {
    return `${repoLabel ?? "The update"} returns pending x402 inbox payments instead of timing out`;
  }

  if (/60s|60-second|60 second/.test(lowered) && /cloudflare kv|cache window/.test(lowered) && /x402|inbox|payment/.test(lowered)) {
    return `${repoLabel ?? "The update"} adds a 60-second minimum cache window to stabilize x402 inbox payment state`;
  }

  if (/cve-\d{4}-\d+/i.test(lowered) && /x402|inbox|payment/.test(lowered)) {
    const cveMatch = lowered.match(/cve-\d{4}-\d+/i)?.[0]?.toUpperCase() ?? "the CVE";
    return `${repoLabel ?? "The update"} patches ${cveMatch} to close an x402 inbox denial-of-service risk`;
  }

  return repoLabel ? `${repoLabel} ${phrase}` : phrase;
}

function buildHeadlineRewrite(
  item: FilingQueueItem,
  source: CandidateSourceSubmission | null
): string | null {
  const repoLabel = extractRepoLabel(source, item.headline);
  const summary = source?.candidate_signal?.summary?.trim() ?? "";
  const significance = source?.candidate_signal?.significance?.trim() ?? "";
  const whyItMatters = source?.article_preview?.why_it_matters?.trim() ?? "";
  const dek = source?.article_preview?.dek?.trim() ?? "";
  const cleanedHeadline = stripLeadReleasePhrase(item.headline);

  const phrase = toNewsVerbPhrase(summary || cleanedHeadline);
  const context = `${significance} ${whyItMatters} ${dek}`;
  const primary = sentenceCase(addOperationalObject(repoLabel, phrase, context));
  const secondary = sentenceCase(cleanArtifactNoise(significance || whyItMatters || dek));

  const variants = [
    primary,
    primary && secondary && !primary.toLowerCase().includes(secondary.toLowerCase())
      ? `${primary} — ${secondary}`
      : ""
  ]
    .map((variant) => variant.replace(/\.+$/u, "").trim())
    .filter(Boolean)
    .filter((variant) => !/ships?\s+v\d+\.\d+/i.test(variant));

  if (variants.length === 0) {
    return null;
  }

  return enforceConciseHeadline(variants[0], 140).replace(/\.$/u, "");
}

function formatWaitTime(detectedAt: string | null, generatedAt: string): string | null {
  if (!detectedAt) return null;

  const detectedMs = Date.parse(detectedAt);
  const generatedMs = Date.parse(generatedAt);
  if (Number.isNaN(detectedMs) || Number.isNaN(generatedMs) || generatedMs < detectedMs) {
    return null;
  }

  const totalMinutes = Math.floor((generatedMs - detectedMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

async function buildCandidateReview(
  items: FilingQueueItem[],
  filedSignals: FiledSignalsState | null,
  agentBehavior: AgentBehaviorState | null,
  briefFile: ManualBriefFile | null
): Promise<CandidateFilingReview[]> {
  const filedIds = new Set(
    (filedSignals?.filedSignals ?? [])
      .map((s) => s.candidateId)
      .filter((id): id is string => id !== null)
  );
  const filedHeadlines = new Set(
    (filedSignals?.filedSignals ?? [])
      .map((s) => s.headline?.toLowerCase().trim())
      .filter((h): h is string => h !== undefined)
  );

  const reviews = await Promise.all(
    items
      .filter((item) => isAwaitingHumanApproval(getItemLifecycle(item)))
      .map(async (item): Promise<CandidateFilingReview> => {
      const lifecycle = getItemLifecycle(item);
      const source = item.sourcePath
        ? await readJsonOrNull<CandidateSourceSubmission>(item.sourcePath)
        : null;
      const alreadyFiled =
        filedIds.has(item.candidateId) ||
        filedHeadlines.has(item.headline?.toLowerCase().trim() ?? "");

      const flags: string[] = [];
      if (item.duplicateStatus === "pending") flags.push("DUPLICATE RISK — pending check, verify no matching signal already approved or in brief");
      if (item.duplicateStatus === "flagged") flags.push("DUPLICATE RISK — flagged, do not file until resolved");
      if (item.freshnessStatus === "risk_unresolved") flags.push("FRESHNESS RISK — story freshness unresolved, confirm it is still current today");
      if (item.freshnessStatus === "unknown") flags.push("FRESHNESS UNKNOWN — could not determine story age, verify before filing");
      for (const reason of item.reasons) {
        if (/raw release notes/i.test(reason)) flags.push("WEAK HEADLINE — reads like a release note, rewrite before filing");
        if (/low publisher confidence/i.test(reason)) flags.push("LOW PUBLISHER CONFIDENCE — borderline on editorial fit");
        if (/borderline editorial fit/i.test(reason)) flags.push("BORDERLINE EDITORIAL FIT — check beat alignment");
      }
      if (alreadyFiled) flags.unshift("ALREADY FILED — do not refile");
      if (lifecycle.state === "approved_for_filing") {
        flags.push("APPROVED FOR FILING — manual signing is the next operator step");
      }
      const briefComparison = buildBriefComparison(item, briefFile);
      if (briefComparison.some((line) => /overlaps materially/i.test(line))) {
        flags.push("BRIEF SLOT OCCUPIED — today's published winner is already close to this angle");
      }

      const briefReadiness: CandidateFilingReview["briefReadiness"] =
        alreadyFiled || flags.some((f) => f.startsWith("ALREADY FILED") || f.startsWith("DUPLICATE RISK") || f.startsWith("FRESHNESS RISK"))
          ? "not_ready"
          : item.score >= 80
            ? "ready"
            : item.score >= 60
              ? "borderline"
              : "not_ready";

      const actionRequired =
        alreadyFiled
          ? "Skip — already in filed-signals.json."
          : flags.some((f) => f.startsWith("DUPLICATE RISK"))
            ? "Manually verify no matching signal exists at aibtc.news before approving."
            : flags.some((f) => f.startsWith("SIGNABILITY"))
              ? "Do not approve or sign yet. Fix the operator signability preflight first."
            : flags.some((f) => f.startsWith("FRESHNESS RISK") || f.startsWith("FRESHNESS UNKNOWN"))
              ? "Confirm story is still current today before approving."
            : flags.some((f) => f.startsWith("WEAK HEADLINE"))
                ? "Review the suggested headline, make any edits needed, then approve."
                : briefReadiness === "ready"
                  ? "Approve only after all operator signability gates are green, then sign via Xverse filing helper."
                  : "Review flags above before approving.";

      return {
        candidateId: item.candidateId,
        headline: item.headline,
        beat: item.beat,
        score: item.score,
        alreadyFiled,
        flags,
        briefComparison,
        briefReadiness,
        actionRequired,
        competitorContext: buildCompetitorContext(item.beat, agentBehavior),
        suggestedHeadline: flags.some((f) => f.startsWith("WEAK HEADLINE"))
          ? buildHeadlineRewrite(item, source)
          : null,
        detectedAt: source?.candidate_signal?.detected_at ?? null
      };
    })
  );

  return reviews.filter((review) => !review.alreadyFiled && review.briefReadiness === "ready");
}

function buildOperatorBoundary(): string[] {
  return [
    "Wallet-required actions stay operator-only: the agent may prepare artifacts, but it must not custody keys or sign on your behalf.",
    "Use the Xverse helper pages for signal filing, heartbeat, or other wallet signature steps instead of any automated agent flow.",
    "If a signing prompt asks for a send, PSBT, fee, inputs, or outputs instead of a message signature, cancel it."
  ];
}

function buildWorkingLoop(
  reportDate: string,
  candidateId: string | null,
  dispatchSummary: DailyOperatorSummary["staggeredDispatch"]
): string[] {
  const base = [
    "Startup preflight: confirm this session is inside aibtcagent, then read README.md, AIBTC-AGENTS.md, and memory.md before trusting any prior chat context.",
    `Run agent-daily for ${reportDate}.`,
    `Place the manual brief at data/briefs/${reportDate}.json before re-running agent-daily when editorial context is missing.`,
    `Inspect data/filing-queue/${reportDate}.json for the ranked filing queue.`,
    `Inspect data/reports/operator/${reportDate}.json or .md for the top-candidate rationale and action summary.`,
    `Treat data/brief-history and any prior examples as strategy memory only, not as candidates to send the publisher.`,
    `Only approve a candidate when it comes from fresh fetched inputs for ${reportDate}; if the queue is empty, source new stories instead of reusing yesterday's queue.`
  ];

  if (candidateId === null) {
    return [
      ...base,
      `No signable candidate is in the filing queue right now; source new stories instead of forcing an approval.`
    ];
  }

  return [
    ...base,
    `Review the top candidate dossier in data/candidate-history/${candidateId}.md when a candidate exists.`,
    `Approve the best candidate with npm run approve-filing -- --date ${reportDate} --candidate ${candidateId} --decision approve --reviewed-by <name> --approval-note "<why this should win>" only after data/state/operator-signability.json confirms wallet readiness, payload integrity, and beat permission.`,
    `Do not let the agent submit or sign wallet actions directly; submit the approved artifact from data/filing-ready/${reportDate}/${candidateId}.json through the Xverse filing helper.`,
    ...(dispatchSummary.nextCandidateId
      ? [
          `Staggered dispatch next due candidate: ${dispatchSummary.nextCandidateId} (${dispatchSummary.nextStatus ?? "scheduled"}) at ${formatDispatchDueAt(dispatchSummary.nextDueAt)}. Require a fresh Xverse signature for that send and do not batch-sign later candidates.`
        ]
      : []),
    `Confirm filing state updated in data/state/filed-signals.json and data/filing-results/${reportDate}/${candidateId}.json.`,
    `Track whether the filed signal is approved and whether it makes In Brief via data/outcomes/approvals and data/candidate-history/${candidateId}.md.`
  ];
}

function buildDispatchSummary(
  queue: StaggeredDispatchQueueState | null
): DailyOperatorSummary["staggeredDispatch"] {
  if (!queue) {
    return {
      queueStatus: "unavailable",
      nextCandidateId: null,
      nextHeadline: null,
      nextDueAt: null,
      nextStatus: null,
      pendingCount: 0,
      notes: ["No staggered dispatch queue exists for this report date yet."]
    };
  }

  const nextCandidate = getNextDueDispatchCandidate(queue);
  const pendingCount = queue.items.filter((item) => !["sent", "skipped", "cancelled", "failed"].includes(item.status)).length;
  const notes = [
    `Dispatch queue is ${queue.queueStatus}; spacing remains ${queue.dispatchIntervalMinutes} minutes between sends and ${queue.beatSpacingMinutes} minutes between repeat beat sends.`,
    nextCandidate
      ? `Next due candidate is ${nextCandidate.candidateId} (${nextCandidate.status}) at ${formatDispatchDueAt(queue.nextDueAt ?? nextCandidate.scheduledFor)}.`
      : "No candidate is currently due to dispatch."
  ];

  return {
    queueStatus: queue.queueStatus,
    nextCandidateId: nextCandidate?.candidateId ?? null,
    nextHeadline: nextCandidate?.headline ?? null,
    nextDueAt: queue.nextDueAt ?? nextCandidate?.scheduledFor ?? null,
    nextStatus: nextCandidate?.status ?? null,
    pendingCount,
    notes
  };
}

function buildQueueGuidance(filingQueue: FilingQueue | null): string[] {
  if (!filingQueue?.recommendationSummary) {
    return ["Filing queue recommendation summary is unavailable for this run."];
  }

  const summary = filingQueue.recommendationSummary;
  const beats = (summary.beatsRepresented ?? []).join(", ");
  return [
    `Recommendation slate: ${summary.recommendedCount ?? 0}/${summary.targetRecommendations ?? 5} signable candidates across ${summary.uniqueBeatCount ?? 0} beat(s).`,
    ...(beats.length > 0 ? [`Beats represented: ${beats}.`] : []),
    ...((summary.quotaNotes ?? []).map((line) => line))
  ];
}

function buildOperatorLoadGuidance(report: DailyReport): string[] {
  const operatorLoad = report.optimization.operatorLoad;
  if (!operatorLoad) {
    return [];
  }

  return [
    `Operator load: ${operatorLoad.status} (${operatorLoad.loadScore}) with ${operatorLoad.headlineRewriteRequiredCount} rewrite(s), ${operatorLoad.rankingOverrideCount} override(s), ${operatorLoad.skippedSignableCount} skipped signable candidate(s), and ${operatorLoad.untouchedSignableCount} untouched signable candidate(s).`,
    ...operatorLoad.rationale
  ];
}

function pickOperatorTopCandidate(
  queue: RankedQueue | null,
  filingQueue: FilingQueue | null
): RankedQueueCandidate | null {
  const rankedCandidates = queue?.candidates ?? [];
  const recommendedCount = filingQueue?.recommendationSummary?.recommendedCount ?? 0;

  if (rankedCandidates.length === 0 || recommendedCount === 0) {
    return null;
  }

  const filingTopId = filingQueue?.topCandidateId ?? null;
  if (filingTopId) {
    const filingTop = rankedCandidates.find((candidate) => candidate.candidateId === filingTopId);
    if (filingTop) {
      return filingTop;
    }
  }

  const firstFile = rankedCandidates.find((candidate) => candidate.decision === "file");
  return firstFile ?? rankedCandidates[0] ?? null;
}

function groupTopCandidateReasons(reasons: string[]): DailyOperatorSummary["rationaleGroups"] {
  const groups: DailyOperatorSummary["rationaleGroups"] = [];
  const buckets: Array<{ label: string; patterns: RegExp[] }> = [
    {
      label: "Approval Fit",
      patterns: [
        /submission gate/i,
        /ready to file/i,
        /editorial fit/i,
        /publisher/i,
        /approval-quality floor/i,
        /strictness regime/i
      ]
    },
    {
      label: "Brief Fit",
      patterns: [
        /historical brief/i,
        /winning pattern/i,
        /brief/i,
        /structural-pattern/i,
        /exact numeric/i
      ]
    },
    {
      label: "Source Fit",
      patterns: [
        /sources match/i,
        /source/i,
        /release-plus-operator-consequence/i,
        /dashboard-first/i
      ]
    },
    {
      label: "Competition Pressure",
      patterns: [
        /crowded/i,
        /occupied/i,
        /repeat-winning/i,
        /repeat-winner/i,
        /regularly won/i,
        /actively owned/i
      ]
    }
  ];

  const unmatched: string[] = [];
  for (const reason of reasons) {
    const bucket = buckets.find((entry) => entry.patterns.some((pattern) => pattern.test(reason)));
    if (!bucket) {
      unmatched.push(reason);
      continue;
    }

    const existing = groups.find((group) => group.label === bucket.label);
    if (existing) {
      existing.points.push(reason);
    } else {
      groups.push({ label: bucket.label, points: [reason] });
    }
  }

  if (unmatched.length > 0) {
    groups.push({ label: "Other Signals", points: unmatched });
  }

  return groups;
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

function formatDelta(label: string, today: number, yesterday: number): string {
  const delta = today - yesterday;
  if (delta === 0) {
    return `${label} held flat at ${today}.`;
  }

  return `${label} ${delta > 0 ? "improved" : "fell"} from ${yesterday} to ${today}.`;
}

function buildImprovementAssessment(
  today: DailyReport,
  yesterday: DailyReport | null
): DailyOperatorSummary["improving"] {
  if (yesterday === null) {
    return {
      status: "unclear",
      reasons: ["No prior daily report exists yet for a comparison baseline."]
    };
  }

  const reasons: string[] = [];
  let positiveSignals = 0;
  let negativeSignals = 0;

  const todayApprovalRate = today.approvalsAndRewards.sameDayResolvedApprovalRate;
  const yesterdayApprovalRate = yesterday.approvalsAndRewards.sameDayResolvedApprovalRate;
  if (todayApprovalRate !== null && yesterdayApprovalRate !== null) {
    if (todayApprovalRate > yesterdayApprovalRate) {
      positiveSignals += 1;
      reasons.push(formatDelta("Same-day approval rate", todayApprovalRate, yesterdayApprovalRate));
    } else if (todayApprovalRate < yesterdayApprovalRate) {
      negativeSignals += 1;
      reasons.push(formatDelta("Same-day approval rate", todayApprovalRate, yesterdayApprovalRate));
    }
  }

  if (today.detections.submissionConversionRate !== null && yesterday.detections.submissionConversionRate !== null) {
    if (today.detections.submissionConversionRate > yesterday.detections.submissionConversionRate) {
      positiveSignals += 1;
      reasons.push(
        formatDelta(
          "Submission conversion",
          today.detections.submissionConversionRate,
          yesterday.detections.submissionConversionRate
        )
      );
    } else if (today.detections.submissionConversionRate < yesterday.detections.submissionConversionRate) {
      negativeSignals += 1;
      reasons.push(
        formatDelta(
          "Submission conversion",
          today.detections.submissionConversionRate,
          yesterday.detections.submissionConversionRate
        )
      );
    }
  }

  if (today.optimization.rejectionThreshold.mode === "standard" &&
      yesterday.optimization.rejectionThreshold.mode === "tightened") {
    positiveSignals += 1;
    reasons.push("Strictness regime eased from tightened to standard.");
  } else if (today.optimization.rejectionThreshold.mode === "tightened" &&
      yesterday.optimization.rejectionThreshold.mode === "standard") {
    negativeSignals += 1;
    reasons.push("Strictness regime tightened, which usually means recent quality pressure increased.");
  }

  const todayOperatorLoad = today.optimization.operatorLoad?.loadScore;
  const yesterdayOperatorLoad = yesterday.optimization.operatorLoad?.loadScore;
  if (typeof todayOperatorLoad === "number" && typeof yesterdayOperatorLoad === "number") {
    if (todayOperatorLoad < yesterdayOperatorLoad) {
      positiveSignals += 1;
      reasons.push(`Operator load eased from ${yesterdayOperatorLoad} to ${todayOperatorLoad}.`);
    } else if (todayOperatorLoad > yesterdayOperatorLoad) {
      negativeSignals += 1;
      reasons.push(`Operator load rose from ${yesterdayOperatorLoad} to ${todayOperatorLoad}.`);
    }
  }

  if (positiveSignals === 0 && negativeSignals === 0) {
    return {
      status: "unclear",
      reasons: ["Core quality metrics were mostly flat versus yesterday."]
    };
  }

  return {
    status: positiveSignals >= negativeSignals ? "yes" : "no",
    reasons
  };
}

interface ManualBriefFile {
  entries?: Array<{
    agent?: string;
    beat?: string;
    headline?: string;
  }>;
}

interface ManualBriefIngestState {
  reports?: Array<{
    reportDate: string;
    inputPath: string;
    briefJsonPath?: string;
    briefSnapshotPath?: string;
    entryCount?: number;
    updatedAt?: string;
  }>;
}

function buildUrgencyNotes(candidateReview: CandidateFilingReview[], generatedAt: string): string[] {
  const approvable = candidateReview.filter(
    (c) => !c.alreadyFiled && c.briefReadiness !== "not_ready"
  );

  if (approvable.length === 0) {
    return ["No approvable candidates are waiting — source new stories before the next run."];
  }

  const contested = approvable.filter((c) => c.competitorContext !== null);
  const open = approvable.filter((c) => c.competitorContext === null);
  const notes: string[] = [];

  if (contested.length > 0) {
    notes.push(
      `${contested.length} candidate(s) are on contested beat(s) — file these in the current session to avoid losing the slot.`
    );
    for (const c of contested) {
      notes.push(`${c.beat}: ${c.competitorContext} — approve ${c.candidateId} first.`);
    }
  }

  if (open.length > 0) {
    notes.push(
      `${open.length} candidate(s) are on open beat(s) — lower urgency but file today before ownership forms.`
    );
  }

  const waitingCandidates = approvable
    .map((candidate) => ({
      candidate,
      wait: formatWaitTime(candidate.detectedAt, generatedAt)
    }))
    .filter((entry) => entry.wait !== null);

  if (waitingCandidates.length > 0) {
    waitingCandidates.sort((left, right) =>
      Date.parse(left.candidate.detectedAt ?? "") - Date.parse(right.candidate.detectedAt ?? "")
    );
    const stalest = waitingCandidates[0];
    const newest = waitingCandidates[waitingCandidates.length - 1];
    notes.push(
      `Approval queue latency: ${waitingCandidates.length} signable candidate(s) have been waiting since detection; oldest wait is ${stalest.wait}.`
    );
    if (newest.wait !== null && newest.candidate.candidateId !== stalest.candidate.candidateId) {
      notes.push(
        `Newest signable candidate ${newest.candidate.candidateId} has already been waiting ${newest.wait}.`
      );
    }
  }

  notes.push(
    "The brief publishes daily. Every hour of approval latency is exposure for first-mover loss on contested beats."
  );

  return notes;
}

function renderMarkdown(summary: DailyOperatorSummary): string {
  return [
    `# Operator Summary: ${summary.reportDate}`,
    "",
    `Generated at: ${summary.generatedAt}`,
    `Dispatch queue: ${summary.staggeredDispatch.queueStatus}`,
    `Next due candidate: ${summary.staggeredDispatch.nextCandidateId ?? "none"}`,
    `Next due at: ${summary.staggeredDispatch.nextDueAt ?? "n/a"}`,
    `Top candidate: ${summary.topCandidate.candidateId ?? "none"}`,
    `Decision: ${summary.topCandidate.decision}`,
    `Score: ${summary.topCandidate.score ?? "n/a"}`,
    `Headline: ${summary.topCandidate.headline ?? "none"}`,
    "",
    "## Contender Slate",
    ...(summary.candidateReview.length === 0
      ? ["- No real contenders reached the human review slate for this date."]
      : summary.candidateReview.flatMap((c) => [
          `### ${c.briefReadiness.toUpperCase()} | Score ${c.score} | ${c.beat}`,
          `Headline: ${c.headline}`,
          `Already filed: ${c.alreadyFiled ? "YES — do not refile" : "No"}`,
          c.competitorContext !== null ? `Competition: ${c.competitorContext}` : "Competition: Beat open",
          ...c.briefComparison.map((line) => `Brief comparison: ${line}`),
          c.detectedAt !== null ? `Detected at: ${c.detectedAt}` : "Detected at: unknown",
          ...(c.flags.length > 0 ? c.flags.map((f) => `⚠ ${f}`) : ["✓ No flags"]),
          ...(c.suggestedHeadline ? [`Suggested headline: ${c.suggestedHeadline}`] : []),
          `Action: ${c.actionRequired}`,
          ""
        ])),
    "## Why It Ranked First",
    ...(summary.whyItRankedFirst.length === 0 ? ["- No candidate ranked today."] : summary.whyItRankedFirst.map((line) => `- ${line}`)),
    "",
    "## Reason Groups",
    ...(summary.rationaleGroups.length === 0
      ? ["- No grouped rationale available."]
      : summary.rationaleGroups.flatMap((group) => [
          `- ${group.label}: ${group.points[0] ?? "n/a"}`,
          ...group.points.slice(1).map((line) => `- ${line}`)
        ])),
    "",
    "## Operator Boundary",
    ...summary.operatorBoundary.map((line) => `- ${line}`),
    "",
    "## Queue Guidance",
    ...summary.queueGuidance.map((line) => `- ${line}`),
    "",
    "## Staggered Dispatch",
    `- Queue status: ${summary.staggeredDispatch.queueStatus}`,
    `- Pending candidates: ${summary.staggeredDispatch.pendingCount}`,
    `- Next candidate: ${summary.staggeredDispatch.nextCandidateId ?? "none"}`,
    `- Next due at: ${summary.staggeredDispatch.nextDueAt ?? "n/a"}`,
    ...(summary.staggeredDispatch.nextHeadline ? [`- Next headline: ${summary.staggeredDispatch.nextHeadline}`] : []),
    ...summary.staggeredDispatch.notes.map((line) => `- ${line}`),
    "",
    "## Working Loop",
    ...summary.workingLoop.map((line) => `- ${line}`),
    "",
    "## What Changed From Yesterday",
    ...(summary.changedFromYesterday.length === 0 ? ["- No prior report available."] : summary.changedFromYesterday.map((line) => `- ${line}`)),
    "",
    "## Improving",
    `- Status: ${summary.improving.status}`,
    ...summary.improving.reasons.map((line) => `- ${line}`),
    "",
    "## Filing Urgency",
    ...summary.urgencyNotes.map((line) => `- ${line}`),
    "",
    "## Brief Ingest Status",
    `- Ingested: ${summary.briefIngestStatus.ingested ? "Yes" : "No"}`,
    `- Learned: ${summary.briefIngestStatus.learned ? "Yes" : "No"}`,
    `- Input path: ${summary.briefIngestStatus.inputPath}`,
    ...(summary.briefIngestStatus.verifiedFiles.length === 0
      ? []
      : [`- Verified files: ${summary.briefIngestStatus.verifiedFiles.join(", ")}`]),
    ...(summary.briefIngestStatus.missingFiles.length === 0
      ? []
      : [`- Missing proof: ${summary.briefIngestStatus.missingFiles.join(", ")}`]),
    ...(summary.briefIngestStatus.staleFiles.length === 0
      ? []
      : [`- Stale proof: ${summary.briefIngestStatus.staleFiles.join(", ")}`]),
    `- ${summary.briefIngestStatus.note}`,
    ""
  ].join("\n");
}

export async function generateDailyOperatorSummary(
  reportDate: string,
  generatedAt: string,
  baseDir?: string
): Promise<DailyOperatorSummary> {
  const root = resolve(baseDir ?? process.cwd());
  const report = await readJsonOrNull<DailyReport>(resolve(root, `data/reports/daily/${reportDate}.json`));
  if (report === null) {
    throw new Error(`Daily report for ${reportDate} is required before building operator summary.`);
  }

  const defaultBriefInputPath = `data/briefs/${reportDate}.json`;
  const [queue, filingQueue, filedSignals, agentBehavior, briefFile, briefIngestState] = await Promise.all([
    readJsonOrNull<RankedQueue>(resolve(root, `data/queues/${reportDate}.json`)),
    readJsonOrNull<FilingQueue>(resolve(root, `data/filing-queue/${reportDate}.json`)),
    readJsonOrNull<FiledSignalsState>(resolve(root, "data/state/filed-signals.json")),
    readJsonOrNull<AgentBehaviorState>(resolve(root, "data/state/brief-agent-behavior.json")),
    readJsonOrNull<ManualBriefFile>(resolve(root, defaultBriefInputPath)),
    readJsonOrNull<ManualBriefIngestState>(resolve(root, "data/state/manual-brief-ingest.json"))
  ]);
  const briefReport = (briefIngestState?.reports ?? []).find((entry) => entry.reportDate === reportDate) ?? null;
  const briefInputPath = briefReport?.inputPath
    ? briefReport.inputPath.replace(`${root}/`, "")
    : defaultBriefInputPath;
  const yesterday = new Date(`${reportDate}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const previousDate = yesterday.toISOString().slice(0, 10);
  const previousReport = await readJsonOrNull<DailyReport>(
    resolve(root, `data/reports/daily/${previousDate}.json`)
  );

  const liveSlate = await generateLiveCandidateSlate(reportDate, root);
  const liveCandidateIds = new Set(liveSlate.candidates.map((candidate) => candidate.candidateId));
  const reviewCandidateId =
    liveSlate.topCandidateId ??
    filingQueue?.topCandidateId ??
    filingQueue?.items?.find((item) => item.queueStatus === "awaiting_human_approval")?.candidateId ??
    null;
  const topCandidate = reviewCandidateId
    ? (queue?.candidates ?? []).find((candidate) => candidate.candidateId === reviewCandidateId) ?? null
    : null;
  const changedFromYesterday: string[] = [];
  if (previousReport !== null) {
    changedFromYesterday.push(
      `Detections moved from ${previousReport.detections.totalDetected} to ${report.detections.totalDetected}.`
    );
    changedFromYesterday.push(
      `Submitted candidates moved from ${previousReport.detections.totalSubmitted} to ${report.detections.totalSubmitted}.`
    );
    changedFromYesterday.push(
      `Approvals moved from ${previousReport.approvalsAndRewards.totalApprovals} to ${report.approvalsAndRewards.totalApprovals}.`
    );
    changedFromYesterday.push(
      `In Brief wins moved from ${previousReport.approvalsAndRewards.totalInBrief} to ${report.approvalsAndRewards.totalInBrief}.`
    );
    changedFromYesterday.push(
      `Strictness regime is ${report.optimization.rejectionThreshold.mode}; yesterday it was ${previousReport.optimization.rejectionThreshold.mode}.`
    );
  }

  const whyItRankedFirst = topCandidate
    ? topCandidate.reasons
    : [
        `No fresh fetched candidate ranked for ${reportDate}.`,
        "Historical examples and brief-memory notes remain useful for strategy, but they are not filing candidates.",
        "Source new stories before approving anything for the publisher."
      ];

  const candidateReview = await buildCandidateReview(
    (filingQueue?.items ?? []).filter((item) => liveCandidateIds.has(item.candidateId)),
    filedSignals,
    agentBehavior,
    briefFile
  );
  const dispatchQueue = await advanceDispatchQueue(reportDate, { now: generatedAt }, root).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  });
  const staggeredDispatch = buildDispatchSummary(dispatchQueue);
  const editorialLearning = await verifyEditorialLearningProof(reportDate, {
    baseDir: root,
    requireOperatorReport: false
  });

  return {
    kind: "daily_operator_summary",
    reportDate,
    generatedAt,
    staggeredDispatch,
    topCandidate: topCandidate === null
      ? { candidateId: null, score: null, decision: "none", headline: null, reasons: [] }
      : { candidateId: topCandidate.candidateId, score: topCandidate.score, decision: topCandidate.decision, headline: topCandidate.headline, reasons: topCandidate.reasons },
    candidateReview,
    whyItRankedFirst,
    rationaleGroups: topCandidate ? groupTopCandidateReasons(topCandidate.reasons) : [],
    operatorBoundary: buildOperatorBoundary(),
    queueGuidance: [
      ...buildQueueGuidance(filingQueue),
      ...liveSlate.notes,
      ...staggeredDispatch.notes,
      ...buildOperatorLoadGuidance(report)
    ],
    workingLoop: buildWorkingLoop(reportDate, reviewCandidateId, staggeredDispatch),
    changedFromYesterday,
    improving: buildImprovementAssessment(report, previousReport),
    urgencyNotes: buildUrgencyNotes(candidateReview, generatedAt),
    briefIngestStatus: {
      ingested: editorialLearning.briefSaved,
      learned: editorialLearning.verified,
      inputPath: editorialLearning.inputPath || briefInputPath,
      verifiedFiles: editorialLearning.verifiedFiles,
      missingFiles: editorialLearning.missingFiles,
      staleFiles: editorialLearning.staleFiles,
      note: editorialLearning.briefSaved
        ? editorialLearning.note
        : `No manual brief found at ${defaultBriefInputPath}. Place a brief file at data/briefs/${reportDate}.json, .md, or .txt and re-run agent-daily to capture editorial notes (why slots were won). Without it, the system tracks who won but not why — this is the richest learning signal.`
    }
  };
}

export async function saveDailyOperatorSummary(
  summary: DailyOperatorSummary,
  baseDir?: string
): Promise<{ jsonPath: string; markdownPath: string }> {
  const root = resolve(baseDir ?? process.cwd());
  const jsonPath = resolve(root, `data/reports/operator/${summary.reportDate}.json`);
  const markdownPath = resolve(root, `data/reports/operator/${summary.reportDate}.md`);
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  await writeFile(markdownPath, renderMarkdown(summary), "utf8");
  return { jsonPath, markdownPath };
}
