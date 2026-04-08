// P27 — Beat saturation detector
// Before queuing, check how many signals on the same beat are already approved
// in the current cycle. High saturation → near-zero brief-win probability.

const API_BASE = "https://aibtc.news/api";
const FETCH_TIMEOUT_MS = 8000;

const SATURATION_WARNING_THRESHOLD = 3;  // 3 approved → warning
const SATURATION_BLOCKED_THRESHOLD = 4;  // 4+ approved → requires displacement angle

export type SaturationLevel = "clear" | "warning" | "blocked";

export interface BeatSaturationResult {
  beat: string;
  approvedCount: number;
  saturationLevel: SaturationLevel;
  blockingReason: string | null;
  displacementRequired: boolean;
}

interface LiveSignal {
  beat?: string;
  beat_slug?: string;
  status?: string;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchApprovedSignalsByBeat(beat: string): Promise<number> {
  const controller = new AbortController();
  const id = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);
  try {
    const url = `${API_BASE}/signals?beat=${encodeURIComponent(beat)}&status=approved&limit=50`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return 0;

    const data = await response.json() as unknown;
    const items: LiveSignal[] = Array.isArray(data)
      ? (data as LiveSignal[])
      : Array.isArray((data as Record<string, unknown>)?.signals)
        ? ((data as Record<string, unknown[]>).signals as LiveSignal[])
        : [];

    return items.filter((s) => {
      const b = s.beat ?? s.beat_slug ?? "";
      return b === beat || b.replace(/-/g, "_") === beat.replace(/-/g, "_");
    }).length;
  } catch {
    return 0;
  } finally {
    clearTimeout(id);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function checkBeatSaturation(beat: string): Promise<BeatSaturationResult> {
  const approvedCount = await fetchApprovedSignalsByBeat(beat);

  if (approvedCount >= SATURATION_BLOCKED_THRESHOLD) {
    return {
      beat,
      approvedCount,
      saturationLevel: "blocked",
      blockingReason: `Beat "${beat}" has ${approvedCount} approved signals this cycle — brief slot near-zero. Requires displacement angle (unique data, stronger evidence, or direct contradiction).`,
      displacementRequired: true
    };
  }

  if (approvedCount >= SATURATION_WARNING_THRESHOLD) {
    return {
      beat,
      approvedCount,
      saturationLevel: "warning",
      blockingReason: `Beat "${beat}" has ${approvedCount} approved signals this cycle — brief competition is high.`,
      displacementRequired: false
    };
  }

  return {
    beat,
    approvedCount,
    saturationLevel: "clear",
    blockingReason: null,
    displacementRequired: false
  };
}

export function formatSaturationWarning(result: BeatSaturationResult): string {
  if (result.saturationLevel === "clear") return "";
  const prefix = result.saturationLevel === "blocked" ? "beat_saturation_block" : "beat_saturation_warning";
  return `${prefix}: ${result.blockingReason ?? `${result.beat} has ${result.approvedCount} approved signals`}`;
}
