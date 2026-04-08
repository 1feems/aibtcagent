// P26 — Brief conversion tracking
// Analyzes filed-signals.json to surface approved-not-brief patterns.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FiledSignalRecord } from "../filing/state.js";

interface FiledSignalsState {
  filedSignals: FiledSignalRecord[];
}

// ── Reason inference ──────────────────────────────────────────────────────────

type ConversionLossReason =
  | "beat_saturation"   // same beat had 4+ approved that cycle
  | "score_margin"      // approved late or with low approval margin
  | "filing_time"       // filed late in the cycle (disadvantaged by queue order)
  | "unknown";

export interface ApprovedNotBriefRecord {
  signalId: string;
  headline: string | null;
  beat: string | null;
  filedAt: string | null;
  cap_blocked: boolean;
  inferredReason: ConversionLossReason;
}

export interface ConversionAnalysis {
  totalFiled: number;
  totalApproved: number;
  totalBriefIncluded: number;
  approvedNotInBrief: number;
  conversionRate: number;         // brief_included / approved (0–1)
  approvedNotInBriefRecords: ApprovedNotBriefRecord[];
  topLossReasons: Array<{ reason: ConversionLossReason; count: number }>;
  beatBreakdown: Array<{ beat: string; approved: number; brief: number; conversionRate: number }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferLossReason(
  record: FiledSignalRecord,
  allRecords: FiledSignalRecord[]
): ConversionLossReason {
  if (record.cap_blocked) return "beat_saturation";

  if (!record.filedAt || !record.beat) return "unknown";

  const filedDate = record.filedAt.slice(0, 10);
  const sameBeatSameDay = allRecords.filter(
    (r) => r.beat === record.beat && r.filedAt?.startsWith(filedDate) && r.signalId !== record.signalId
  );
  const sameBeatApproved = sameBeatSameDay.filter((r) => r.approved || r.brief_included);

  if (sameBeatApproved.length >= 3) return "beat_saturation";

  // Infer filing time if filed late in the day (after 20:00 UTC)
  try {
    const hour = new Date(record.filedAt).getUTCHours();
    if (hour >= 20) return "filing_time";
  } catch { /* ignore */ }

  return "score_margin";
}

function groupByBeat(
  records: FiledSignalRecord[]
): Array<{ beat: string; approved: number; brief: number; conversionRate: number }> {
  const beatMap = new Map<string, { approved: number; brief: number }>();

  for (const r of records) {
    if (!r.approved && !r.brief_included) continue;
    const beat = r.beat ?? "unknown";
    const entry = beatMap.get(beat) ?? { approved: 0, brief: 0 };
    if (r.approved || r.brief_included) entry.approved++;
    if (r.brief_included) entry.brief++;
    beatMap.set(beat, entry);
  }

  return [...beatMap.entries()]
    .map(([beat, { approved, brief }]) => ({
      beat,
      approved,
      brief,
      conversionRate: approved > 0 ? brief / approved : 0
    }))
    .sort((a, b) => b.approved - a.approved);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeConversion(baseDir?: string): Promise<ConversionAnalysis> {
  const path = resolve(baseDir ?? process.cwd(), "data/state/filed-signals.json");
  let records: FiledSignalRecord[] = [];
  try {
    const state = JSON.parse(await readFile(path, "utf8")) as FiledSignalsState;
    records = state.filedSignals ?? [];
  } catch { /* no state file yet */ }

  const totalFiled = records.length;
  const approvedRecords = records.filter((r) => r.approved || r.brief_included);
  const briefRecords = records.filter((r) => r.brief_included === true);
  const totalApproved = approvedRecords.length;
  const totalBriefIncluded = briefRecords.length;
  const approvedNotInBrief = approvedRecords.filter((r) => !r.brief_included);

  const approvedNotInBriefRecords: ApprovedNotBriefRecord[] = approvedNotInBrief.map((r) => ({
    signalId: r.signalId,
    headline: r.headline,
    beat: r.beat,
    filedAt: r.filedAt,
    cap_blocked: r.cap_blocked === true,
    inferredReason: inferLossReason(r, records)
  }));

  // Tally top loss reasons
  const reasonCounts = new Map<ConversionLossReason, number>();
  for (const r of approvedNotInBriefRecords) {
    reasonCounts.set(r.inferredReason, (reasonCounts.get(r.inferredReason) ?? 0) + 1);
  }
  const topLossReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalFiled,
    totalApproved,
    totalBriefIncluded,
    approvedNotInBrief: approvedNotInBrief.length,
    conversionRate: totalApproved > 0 ? totalBriefIncluded / totalApproved : 0,
    approvedNotInBriefRecords,
    topLossReasons,
    beatBreakdown: groupByBeat(records)
  };
}

export function formatConversionSection(analysis: ConversionAnalysis): string {
  const pct = analysis.totalApproved > 0
    ? Math.round(analysis.conversionRate * 100)
    : 0;

  const lines: string[] = [
    `- Total filed: ${analysis.totalFiled}`,
    `- Approved (editorial): ${analysis.totalApproved}`,
    `- Brief included (real KPI wins): ${analysis.totalBriefIncluded}`,
    `- Approved not in brief: ${analysis.approvedNotInBrief}`,
    `- Conversion rate (brief/approved): ${pct}%`
  ];

  if (analysis.topLossReasons.length > 0) {
    lines.push("- Top approved-not-brief loss reasons:");
    for (const { reason, count } of analysis.topLossReasons.slice(0, 3)) {
      lines.push(`  - ${reason}: ${count} signal(s)`);
    }
  }

  if (analysis.beatBreakdown.length > 0) {
    lines.push("- Beat conversion breakdown:");
    for (const b of analysis.beatBreakdown.slice(0, 5)) {
      const bPct = Math.round(b.conversionRate * 100);
      lines.push(`  - ${b.beat}: ${b.brief}/${b.approved} brief-wins (${bPct}%)`);
    }
  }

  return lines.join("\n");
}
