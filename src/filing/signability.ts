import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface OperatorSignabilityState {
  kind: "operator_signability_preflight";
  checkedAt: string;
  walletProviderReady: boolean;
  payloadIntegrityReady: boolean;
  activeWalletAddress?: string | null;
  requiredWalletAddress?: string | null;
  allowedBeats?: string[];
  blockedBeats?: string[];
  notes?: string[];
}

export interface SignabilityGateResult {
  status: "ready" | "blocked";
  reasons: string[];
}

function normalizeBeat(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export async function readOperatorSignabilityState(
  baseDir?: string
): Promise<OperatorSignabilityState | null> {
  const filePath = resolve(baseDir ?? process.cwd(), "data/state/operator-signability.json");

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as OperatorSignabilityState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export function evaluateCandidateSignability(
  beat: string,
  state: OperatorSignabilityState | null
): SignabilityGateResult {
  const reasons: string[] = [];

  if (!state) {
    reasons.push("hard-blocked from signable queue because operator signability preflight is missing");
    return { status: "blocked", reasons };
  }

  if (!state.walletProviderReady) {
    reasons.push("hard-blocked from signable queue because wallet/provider readiness is not confirmed");
  }

  if (!state.payloadIntegrityReady) {
    reasons.push("hard-blocked from signable queue because filing payload integrity is not confirmed");
  }

  if (state.requiredWalletAddress && !state.activeWalletAddress) {
    reasons.push("hard-blocked from signable queue because the active wallet identity is unresolved");
  }

  if (
    state.requiredWalletAddress &&
    state.activeWalletAddress &&
    state.requiredWalletAddress !== state.activeWalletAddress
  ) {
    reasons.push("hard-blocked from signable queue because the active wallet does not match the approved filing identity");
  }

  const normalizedBeat = normalizeBeat(beat);
  const blockedBeats = new Set((state.blockedBeats ?? []).map(normalizeBeat));
  const allowedBeats = new Set((state.allowedBeats ?? []).map(normalizeBeat));

  if (blockedBeats.has(normalizedBeat)) {
    reasons.push(`hard-blocked from signable queue because beat ${beat} is not currently publishable by this operator`);
  } else if (allowedBeats.size === 0 || !allowedBeats.has(normalizedBeat)) {
    reasons.push(`hard-blocked from signable queue because beat permission for ${beat} is not confirmed for this operator`);
  }

  return {
    status: reasons.length === 0 ? "ready" : "blocked",
    reasons
  };
}
