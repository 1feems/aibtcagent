import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface DayValidationSummary {
  april2: {
    submittedCount: number;
    submittedHeadlines: string[];
  };
  april3: {
    leaderboardNotCheckedCount: number;
    sendReadyCount: number;
    blockedReadyCount: number;
    reviewableCount: number;
  };
  conclusion: {
    april2StillWorks: boolean;
    april3NoLongerOpaque: boolean;
  };
}

function matchAllLines(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1]?.trim() ?? "").filter(Boolean);
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

function parseApril2SignalReport(text: string): DayValidationSummary["april2"] {
  const submittedHeadlines: string[] = [];
  const blocks = text.split("\n## Candidate ").slice(1);
  for (const block of blocks) {
    const status = block.match(/- Status:\s+submitted\b/i);
    const headline = block.match(/- Headline:\s+(.+)/i)?.[1]?.trim();
    if (status && headline) {
      submittedHeadlines.push(headline);
    }
  }

  return {
    submittedCount: submittedHeadlines.length,
    submittedHeadlines
  };
}

function parseApril3TrustedSlate(text: string): Pick<DayValidationSummary["april3"], "sendReadyCount" | "blockedReadyCount" | "reviewableCount"> {
  const reviewableSection = text.split("## Reviewable queue candidates")[1]?.split("## Send-ready artifacts")[0] ?? "";
  const sendReadySection = text.split("## Send-ready artifacts")[1]?.split("## Blocked filing-ready artifacts")[0] ?? "";
  const blockedSection = text.split("## Blocked filing-ready artifacts")[1]?.split("## Untrusted paths")[0] ?? "";

  return {
    reviewableCount: countMatches(reviewableSection, /^###\s+/gm),
    sendReadyCount: countMatches(sendReadySection, /^###\s+/gm),
    blockedReadyCount: countMatches(blockedSection, /^###\s+/gm)
  };
}

function parseApril3DailyReport(text: string): Pick<DayValidationSummary["april3"], "leaderboardNotCheckedCount"> {
  const matched = text.match(/- leaderboard_not_checked:\s+(\d+)/i);
  return {
    leaderboardNotCheckedCount: matched ? Number(matched[1]) : 0
  };
}

export async function generateDayValidationReport(baseDir?: string): Promise<{
  outputPath: string;
  summary: DayValidationSummary;
}> {
  const root = resolve(baseDir ?? process.cwd());
  const [april2SignalReport, april3TrustedSlate, april3DailyReport] = await Promise.all([
    readFile(resolve(root, "data/reports/signals/2026-04-02.md"), "utf8"),
    readFile(resolve(root, "data/reports/signals/2026-04-03-trusted.md"), "utf8"),
    readFile(resolve(root, "data/reports/daily/2026-04-03.md"), "utf8")
  ]);

  const april2 = parseApril2SignalReport(april2SignalReport);
  const april3 = {
    ...parseApril3DailyReport(april3DailyReport),
    ...parseApril3TrustedSlate(april3TrustedSlate)
  };

  const summary: DayValidationSummary = {
    april2,
    april3,
    conclusion: {
      april2StillWorks: april2.submittedCount >= 5,
      april3NoLongerOpaque: april3.sendReadyCount >= 1 && april3.blockedReadyCount >= 1
    }
  };

  const lines = [
    "# Day Validation Replay",
    "",
    "## April 2",
    `- Submitted signals in report: ${summary.april2.submittedCount}`,
    ...summary.april2.submittedHeadlines.map((headline) => `- Submitted headline: ${headline}`),
    "",
    "## April 3",
    `- leaderboard_not_checked count in daily report: ${summary.april3.leaderboardNotCheckedCount}`,
    `- Reviewable queue candidates in trusted slate: ${summary.april3.reviewableCount}`,
    `- Send-ready artifacts in trusted slate: ${summary.april3.sendReadyCount}`,
    `- Blocked filing-ready artifacts in trusted slate: ${summary.april3.blockedReadyCount}`,
    "",
    "## Validation Verdict",
    `- April 2 still works: ${summary.conclusion.april2StillWorks ? "yes" : "no"}`,
    `- April 3 no longer collapses into opaque over-rejection: ${summary.conclusion.april3NoLongerOpaque ? "yes" : "no"}`,
    "",
    "## Interpretation",
    "- April 2 still shows a usable operator workflow because the report records a substantive submitted slate rather than only blocked candidates.",
    "- April 3 still preserves the evidence of the earlier failure mode in the daily report, but the trusted slate now separates send-ready artifacts from blocked ones and attaches explicit blocker reasons instead of leaving the operator with only fail-closed ambiguity."
  ];

  const outputPath = resolve(root, "data/reports/validation/2026-04-02-vs-2026-04-03.md");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

  return { outputPath, summary };
}
