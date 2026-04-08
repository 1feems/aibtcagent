import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadLearningCache, type LearningLesson } from "./lessons-cache.js";
import { loadBriefExamplesMemory, loadCompetitionMemory, type EditorialMemoryExample, type EditorialMemoryFocusArea } from "./context-memory.js";
import { refreshOutcomeFeedbackMemory, type FeedbackLabel } from "./outcome-feedback.js";
import { refreshSnapshotMemory } from "./snapshot-memory.js";
import { getPacificReportDate } from "../utils/report-date.js";

export type OutcomeLessonKind = "win" | "loss" | "next" | "note" | "bug";

export interface OutcomeLesson {
  kind: OutcomeLessonKind;
  text: string;
  recordedOn: string | null;
  categories: string[];
  signalIds: string[];
}

export interface PreFilingCheck {
  id: string;
  rule: string;
  rationale: string;
  triggerCount: number;
  sourceKinds: OutcomeLessonKind[];
}

export interface EditorialMemory {
  generatedAt: string;
  sourcePath: string;
  lessonCount: number;
  lessonsByKind: Record<OutcomeLessonKind, number>;
  editorialTemplate: {
    readTodayBriefFirst: true;
    source: string;
  };
  rejectionPolicy: {
    rejectedFeedbackIsOperatingInstruction: true;
    repairAndResubmitByDefault: true;
  };
  outcomeLogging: {
    requiredFormats: ["win:", "loss:", "next:", "bug:"];
    guidance: string;
  };
  lessons: OutcomeLesson[];
  preFilingChecks: PreFilingCheck[];
  publisherGate: {
    fourQuestions: string[];
    thisWeekPriority: string[];
  };
  factCheckerGate: {
    standards: string[];
    thisWeekPriority: string[];
  };
  currentCycle: {
    reportDate: string | null;
    winnersToday: EditorialMemoryExample[];
    lossesToday: EditorialMemoryExample[];
    valueCreatingPatterns: string[];
    sourcePatternsThatPassed: string[];
  };
  currentBrief: {
    reportDate: string | null;
    occupiedBeats: string[];
    headlines: string[];
  };
  focusAreas: EditorialMemoryFocusArea[];
  qualityBar: string[];
  recentExamples: {
    winners: EditorialMemoryExample[];
    losses: EditorialMemoryExample[];
  };
}

function extractReportDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/(20\d{2}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function latestReportDateFromExamples(winners: EditorialMemoryExample[], losses: EditorialMemoryExample[]): string | null {
  const dates = [...winners, ...losses]
    .map((entry) => extractReportDate(entry.source))
    .filter((date): date is string => typeof date === "string");
  return dates.sort().at(-1) ?? null;
}

interface RepeatedRuleDefinition {
  id: string;
  rule: string;
  rationale: string;
  match(lesson: OutcomeLesson): boolean;
  feedbackLabels?: FeedbackLabel[];
}

const PROMOTED_SECTION_HEADER = "## Promoted Filing Checks";

const REPEATED_RULES: RepeatedRuleDefinition[] = [
  {
    id: "headline-complete",
    rule: "Fail any candidate whose headline is truncated, incomplete, or ends mid-thought.",
    rationale: "Repeated packaging losses show incomplete headlines waste filing slots.",
    feedbackLabels: ["headline_truncated"],
    match: (lesson) =>
      /\bheadline\b|\btruncated\b|\bincomplete sentence\b|\bcuts off mid-thought\b/i.test(lesson.text)
  },
  {
    id: "body-required",
    rule: "Fail any candidate whose filing payload risks a null or missing body/analysis field.",
    rationale: "Headline-only or null-body submissions repeatedly lose even when the draft idea is good.",
    feedbackLabels: ["body_missing"],
    match: (lesson) =>
      /\bbody\b|\bheadline-only\b|\bnull\b|\banalysis\b|\bpayload\b/i.test(lesson.text)
  },
  {
    id: "evidence-anchor-required",
    rule: "Fail metric-driven claims unless they are tied to explicit dated evidence, snapshots, or verifiable anchors.",
    rationale: "Repeated losses show unsupported numbers and vague evidence are rejected.",
    feedbackLabels: ["missing_timestamped_evidence"],
    match: (lesson) =>
      /\bmetric\b|\bverifiable\b|\btimestamp\b|\bsnapshot\b|\bevidence\b|\bproof\b|\bfabricated\b/i.test(
        lesson.text
      )
  },
  {
    id: "duplicate-story-shape",
    rule: "Fail any candidate that duplicates today's brief, a prior posted brief, or an already-losing same story shape.",
    rationale: "Duplicate angles create low-upside filings even when the underlying story is valid.",
    feedbackLabels: ["duplicate_story_shape"],
    match: (lesson) =>
      /\bduplicate\b|\balready present\b|\balready approved\b|\bsame story shape\b|\balready in today's brief\b/i.test(
        lesson.text
      )
  },
  {
    id: "publisher-feedback-first",
    rule: "For rejected candidates, read publisher feedback first and rewrite only the flagged parts before any resubmission.",
    rationale: "Publisher feedback is the operating instruction for repair/resubmit.",
    feedbackLabels: ["publisher_feedback_required", "repair_and_resubmit"],
    match: (lesson) =>
      /\bpublisher feedback\b|\brepair\b|\bresubmit\b|\brejected\b|\bflagged parts\b/i.test(lesson.text)
  },
  {
    id: "wait-for-shipped-code",
    rule: "Hold stories on unshipped code or explicitly blocked PRs until the code is actually live.",
    rationale: "Premature stories on unmerged code have repeat rejection risk.",
    feedbackLabels: ["too_early_unshipped_code"],
    match: (lesson) => /\bdo not merge\b|\bunshipped\b|\bpremature\b|\bwait until the code ships\b/i.test(lesson.text)
  },
  {
    id: "beat-specialization-required",
    rule: "File into 1-2 beats maximum. Beat sprawl across 10 beats produces 26K sats average; specialists on 1-2 beats average 135K sats — a 5x gap. Pick the two strongest lanes and own them.",
    rationale: "NotebookLLM analysis of brief wins confirmed specialists outperform sprawlers 5x. Covering every beat produces low-quality signals in each and massive rejection rates.",
    match: (lesson) =>
      /\bspeciali[sz]|beat.*sprawl|sprawl.*beat|1-2 beats|two beats|one.*beat|domain.*expert|10.*beat|beat.*focus|beat.*spec/i.test(lesson.text)
  },
  {
    id: "early-utc-window",
    rule: "File best signals between 04:00 and 10:00 UTC. The 30-slot cap fills around 13:00 UTC; HTTP 429 after that means no new approvals regardless of quality. Late filings are dead.",
    rationale: "NotebookLLM analysis confirmed the brief cap closes by 13:00 UTC. Signals filed late in the day face structural HTTP 429 rejection, not editorial rejection.",
    match: (lesson) =>
      /\butc\b.*\bwindow|\bfiling.*window|\bearly.*utc|\b04:00|\b10:00|http 429|roster.*full|cap.*fills|brief.*cap|30.slot/i.test(lesson.text)
  },
  {
    id: "anchor-in-headline-required",
    rule: "The exact anchor (PR/issue/CVE/version/sats amount/block height) must appear in the headline — not only in the body. Winner headlines always lead with the hard fact.",
    rationale: "NotebookLLM analysis of all selected brief signals showed every winner had the precise anchor (PR#, issue#, exact sats, block height) in the headline itself.",
    match: (lesson) =>
      /anchor.*headline|headline.*anchor|anchor.*in.*headline|hard fact.*headline|headline.*hard fact|lead.*headline.*anchor/i.test(lesson.text)
  },
  {
    id: "sources-must-be-url-title-objects",
    rule: "Before passing to helper, verify every source is a {url, title} object — never a plain string. The display format and the filing payload contract are different.",
    rationale: "Plain-string sources caused silent helper rejection in both April 4 and April 5 cycles, wasting filing slots on otherwise valid signals.",
    match: (lesson) =>
      /plain string.*source|source.*plain string|\{.*url.*title\}|sources.*contract.*strict|sources.*url.*title|invalid sources.*array/i.test(lesson.text)
  },
  {
    id: "filing-payload-fields-only",
    rule: "Filing payload must contain only: beat_slug, btc_address, headline, analysis, sources, tags, disclosure. Remove all repo-only fields (status, lifecycle, repo) before passing to helper.",
    rationale: "Extra repo fields repeatedly caused helper rejection of valid signals; the helper contract is exact, not permissive.",
    match: (lesson) =>
      /repo-only.*field|filing.*payload.*must contain only|strip.*repo.*field|payload.*filing.*field|extra.*repo.*field|filing.*format.*only/i.test(lesson.text)
  },
  {
    id: "disclosure-verify-before-helper",
    rule: "Verify disclosure is non-empty in the final payload before passing to helper. Disclosure can be silently dropped by artifact generation steps.",
    rationale: "Silent disclosure drop in helper-ready artifacts caused payload contract failures on April 4.",
    match: (lesson) =>
      /disclosure.*silently.*drop|disclosure.*drop.*silently|disclosure.*verify.*non-empty|disclosure.*field.*drop|disclosure.*propagation.*bug|disclosure.*silently/i.test(lesson.text)
  },
  {
    id: "cycle-date-freshness-before-helper",
    rule: "Before running helper, check editorial-memory.json currentCycle.reportDate matches today's date. If stale, refresh editorial memory first — a stale cycle date blocks all filings for the day.",
    rationale: "Stale reportDate in editorial memory blocked all April 5 helper runs until manually corrected; the check must happen before, not during, the run.",
    match: (lesson) =>
      /currentCycle\.reportDate|cycle.*date.*stale|stale.*reportDate|reportDate.*stale|editorial.*memory.*fresh.*before|cycle.*date.*match.*today/i.test(lesson.text)
  }
];

function classifyOutcomeKind(text: string): OutcomeLessonKind {
  const normalized = text.replace(/^\d{4}-\d{2}-\d{2}:\s*/i, "").trim().toLowerCase();
  if (normalized.startsWith("win:")) return "win";
  if (normalized.startsWith("loss:")) return "loss";
  if (normalized.startsWith("next:")) return "next";
  if (normalized.startsWith("bug:")) return "bug";
  return "note";
}

function cleanLessonText(text: string): string {
  return text.replace(/^\d{4}-\d{2}-\d{2}:\s*/i, "").trim();
}

function toOutcomeLesson(lesson: LearningLesson): OutcomeLesson {
  return {
    kind: classifyOutcomeKind(lesson.text),
    text: cleanLessonText(lesson.text),
    recordedOn: lesson.recordedOn,
    categories: lesson.categories,
    signalIds: lesson.signalIds
  };
}

function countByKind(lessons: OutcomeLesson[]): Record<OutcomeLessonKind, number> {
  return lessons.reduce<Record<OutcomeLessonKind, number>>(
    (counts, lesson) => {
      counts[lesson.kind] += 1;
      return counts;
    },
    { win: 0, loss: 0, next: 0, note: 0, bug: 0 }
  );
}

function buildChecks(
  lessons: OutcomeLesson[],
  repeatedFeedback: Map<FeedbackLabel, { count: number }>
): PreFilingCheck[] {
  const checks: PreFilingCheck[] = [
    {
      id: "today-brief-is-template",
      rule: "Read today's brief first and use it as the editorial template before drafting new signals.",
      rationale: "The active brief is the live template for headline shape, body shape, and consequence framing.",
      triggerCount: 1,
      sourceKinds: ["next"]
    },
    {
      id: "log-outcomes-as-win-loss-next",
      rule: "After each resolved outcome, record one short `win:`, `loss:`, and `next:` lesson in memory/learnings.md.",
      rationale: "Short structured lessons are what let the editorial memory promote repeated rules into filing checks.",
      triggerCount: 1,
      sourceKinds: ["next"]
    }
  ];

  for (const definition of REPEATED_RULES) {
    const matches = lessons.filter((lesson) => lesson.kind !== "win" && definition.match(lesson));
    const feedbackCount = (definition.feedbackLabels ?? []).reduce(
      (sum, label) => sum + (repeatedFeedback.get(label)?.count ?? 0),
      0
    );
    const triggerCount = Math.max(matches.length, feedbackCount);
    if (triggerCount < 2) continue;
    const sourceKinds = [...new Set(matches.map((lesson) => lesson.kind))];
    checks.push({
      id: definition.id,
      rule: definition.rule,
      rationale: definition.rationale,
      triggerCount,
      sourceKinds
    });
  }

  return checks.sort((left, right) => right.triggerCount - left.triggerCount || left.id.localeCompare(right.id));
}

function buildEditorialMemory(
  lessons: OutcomeLesson[],
  sourcePath: string,
  repeatedFeedback: Map<FeedbackLabel, { count: number }>,
  context: {
    competitionMemory: Awaited<ReturnType<typeof loadCompetitionMemory>>;
    briefExamplesMemory: Awaited<ReturnType<typeof loadBriefExamplesMemory>>;
  }
): EditorialMemory {
  const briefWinners = context.briefExamplesMemory.recentWinners.slice(0, 3).map((entry) => ({
    headline: entry.headline,
    beat: entry.beat,
    whyItWonOrLost: entry.whyItWorked,
    source: entry.source
  }));
  const briefLosses = context.briefExamplesMemory.recentLosses.slice(0, 3).map((entry) => ({
    headline: entry.headline,
    beat: entry.beat,
    whyItWonOrLost: entry.whyItLost,
    source: entry.source
  }));
  const currentReportDate = latestReportDateFromExamples(briefWinners, briefLosses);
  const crowdedBeat = context.competitionMemory.crowdedBeats[0] ?? null;
  const specialistBeats = context.competitionMemory.beatOwners
    .filter((owner) => owner.beats.length <= 2 && owner.wins >= 2)
    .flatMap((owner) => owner.beats);
  const openSpecialistBeats = [...new Set(specialistBeats)].filter(
    (beat) => !context.competitionMemory.crowdedBeats.slice(0, 3).some((crowded) => crowded.beat === beat)
  );

  const focusAreas: EditorialMemoryFocusArea[] = [
    {
      label: "Beat specialization",
      evidence: "Data shows 10-beat sprawlers average 26K sats while 1-2 beat specialists average 135K sats — a 5x difference driven by domain expertise and lower rejection rates.",
      action: `Focus on 1-2 beats maximum. Open specialist lanes from competition memory: ${openSpecialistBeats.slice(0, 3).join(", ") || "check competition-memory.json for low-pressure beats"}. Do not dilute across 10 beats.`
    },
    {
      label: "Early UTC filing window",
      evidence: "The 30-slot daily cap fills around 13:00 UTC. After that, the API returns HTTP 429 and blocks all new approvals regardless of signal quality.",
      action: "File best signals between 04:00 and 10:00 UTC. If it is past 10:00 UTC and the roster may be full, hold signals for next day rather than waste a slot on a probable HTTP 429."
    },
    {
      label: "Displacement bar awareness",
      evidence: crowdedBeat
        ? `${crowdedBeat.beat} is currently crowded (${crowdedBeat.pressure} pressure points in competition memory).`
        : "No crowded beat dominates the current snapshot.",
      action: crowdedBeat
        ? `Only file into ${crowdedBeat.beat} with a broader, earlier, or materially more consequential angle than the incumbent story shape.`
        : "Favor clean, non-duplicative stories and verify the lane against today's brief before filing."
    },
    {
      label: "Verification before novelty",
      evidence: "Recent losses repeatedly cite single-source metrics, missing numbers, or unsupported quantitative framing.",
      action: "If a claim is numeric, contrarian, or extraordinary, add a second anchor or an exact dated proof point before filing."
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    sourcePath,
    lessonCount: lessons.length,
    lessonsByKind: countByKind(lessons),
    editorialTemplate: {
      readTodayBriefFirst: true,
      source: "data/briefs/YYYY-MM-DD.md"
    },
    rejectionPolicy: {
      rejectedFeedbackIsOperatingInstruction: true,
      repairAndResubmitByDefault: true
    },
    outcomeLogging: {
      requiredFormats: ["win:", "loss:", "next:", "bug:"],
      guidance: "Keep outcome lessons short so repeated failures can be promoted into pass/fail checks. Use bug: for workflow/payload bugs that should become code-level guards."
    },
    lessons,
    preFilingChecks: buildChecks(lessons, repeatedFeedback),
    publisherGate: {
      fourQuestions: [
        "Mission-aligned: does it advance understanding of how AI agents use, earn, or transact with Bitcoin or sBTC?",
        "Replicable: could another agent reproduce the signal from the disclosure and cited evidence?",
        "Inscribable: would you be comfortable with this exact claim becoming a permanent record on Bitcoin?",
        "Value-creating: does it produce a concrete operational or economic consequence for the AI-native economy?"
      ],
      thisWeekPriority: [
        "Read today's brief first and avoid filing a narrow same-shape duplicate into a crowded roster.",
        "Prefer direct operator consequence over descriptive or self-referential meta commentary.",
        "Broader package stories beat raw stat dumps and isolated component updates in crowded beats."
      ]
    },
    factCheckerGate: {
      standards: [
        "Metric-heavy claims need an independent or harder anchor, not just one internal or delayed source.",
        "Treat stale price data, unsupported comparative numbers, and truncated analysis as hard editorial risk.",
        "Correctness beats novelty when the brief is permanent."
      ],
      thisWeekPriority: [
        "Watch for roster-full rejections masking weak evidence; improve proof before retrying tomorrow.",
        "Do not let single-source contrarian statistics or unmerged-code claims through unchanged."
      ]
    },
    currentCycle: {
      // Always use today's Pacific date — never derive from example source paths which
      // reflect the last brief, not the active filing cycle.
      reportDate: getPacificReportDate(),
      winnersToday: briefWinners,
      lossesToday: briefLosses,
      valueCreatingPatterns: [
        "Direct operator consequence with a measurable payout, routing, identity, settlement, or security effect.",
        "Hard anchors in the headline or body such as issue numbers, PR numbers, versions, affected populations, or exact sats counts.",
        "A clear answer to what an agent, correspondent, or operator should do differently now."
      ],
      sourcePatternsThatPassed: context.competitionMemory.convertingSourcePatterns.slice(0, 5)
    },
    currentBrief: {
      reportDate: currentReportDate,
      occupiedBeats: context.competitionMemory.crowdedBeats.slice(0, 4).map((entry) => entry.beat),
      headlines: context.briefExamplesMemory.recentWinners.slice(0, 6).map((entry) => entry.headline)
    },
    focusAreas,
    qualityBar: [
      "Good looks like claim + evidence + implication, with exact anchors and a visible operator consequence.",
      "Good is broad enough to displace a crowded incumbent angle, not merely accurate in isolation.",
      "Good is specific enough that the Publisher and Fact-Checker can both verify it quickly."
    ],
    recentExamples: {
      winners: briefWinners,
      losses: briefLosses
    }
  };
}

function renderPromotedChecksSection(checks: PreFilingCheck[]): string {
  const promoted = checks.filter(
    (check) =>
      check.triggerCount >= 2 &&
      check.id !== "today-brief-is-template" &&
      check.id !== "log-outcomes-as-win-loss-next"
  );

  const lines = [
    PROMOTED_SECTION_HEADER,
    "_Auto-generated from repeated rejection or repair patterns. Update the source lessons above; this section is rewritten automatically._"
  ];

  if (promoted.length === 0) {
    lines.push("1. No repeated rejection patterns have been promoted yet.");
    return lines.join("\n");
  }

  promoted.forEach((check, index) => {
    lines.push(`${index + 1}. ${check.rule}`);
    lines.push(`   Rationale: ${check.rationale}`);
    lines.push(`   Trigger count: ${check.triggerCount}`);
  });

  return lines.join("\n");
}

function syncPromotedChecksSection(markdown: string, checks: PreFilingCheck[]): string {
  const rendered = renderPromotedChecksSection(checks).trim();
  const escapedHeader = PROMOTED_SECTION_HEADER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionPattern = new RegExp(`${escapedHeader}[\\s\\S]*?(?=\\n##\\s|$)`, "m");

  if (sectionPattern.test(markdown)) {
    return markdown.replace(sectionPattern, rendered);
  }

  return `${markdown.trimEnd()}\n\n${rendered}\n`;
}

export function getEditorialMemoryPath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/editorial-memory.json");
}

export async function refreshEditorialMemory(baseDir?: string): Promise<EditorialMemory> {
  const root = resolve(baseDir ?? process.cwd());
  const sourcePath = resolve(root, "memory/learnings.md");
  const [learningCache, outcomeFeedbackMemory, snapshotMemory, competitionMemory, briefExamplesMemory] = await Promise.all([
    loadLearningCache(root),
    refreshOutcomeFeedbackMemory(root),
    refreshSnapshotMemory(root),
    loadCompetitionMemory(root),
    loadBriefExamplesMemory(root)
  ]);
  const repeatedFeedback = new Map(
    outcomeFeedbackMemory.repeatedLabels.map((entry) => [entry.label, { count: entry.count }])
  );
  const mergedLessons = dedupeLearningLessons([...learningCache.lessons, ...snapshotMemory.lessons]);
  const memory = buildEditorialMemory(
    mergedLessons.map(toOutcomeLesson),
    sourcePath,
    repeatedFeedback,
    { competitionMemory, briefExamplesMemory }
  );
  const markdown = await readFile(sourcePath, "utf8");
  const syncedMarkdown = syncPromotedChecksSection(markdown, memory.preFilingChecks);
  if (syncedMarkdown !== markdown) {
    await writeFile(sourcePath, syncedMarkdown, "utf8");
  }
  const outputPath = getEditorialMemoryPath(root);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(memory, null, 2)}\n`, "utf8");
  return memory;
}

function dedupeLearningLessons(lessons: LearningLesson[]): LearningLesson[] {
  const seen = new Set<string>();
  const deduped: LearningLesson[] = [];

  for (const lesson of lessons) {
    const key = `${lesson.recordedOn ?? ""}::${lesson.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(lesson);
  }

  return deduped;
}

export async function loadEditorialMemory(baseDir?: string): Promise<EditorialMemory> {
  const root = resolve(baseDir ?? process.cwd());
  const outputPath = getEditorialMemoryPath(root);

  if (!existsSync(outputPath)) {
    return refreshEditorialMemory(root);
  }

  try {
    const raw = await readFile(outputPath, "utf8");
    return JSON.parse(raw) as EditorialMemory;
  } catch {
    return refreshEditorialMemory(root);
  }
}
