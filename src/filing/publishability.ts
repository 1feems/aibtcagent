import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type PublishabilityStatus =
  | "publishable"
  | "permission_blocked"
  | "identity_mismatch"
  | "unknown";

interface OperatorPublishabilityConfig {
  kind?: string;
  operatorBtcAddress?: string;
  publishableBeatSlugs?: string[];
  beatMappings?: Record<string, string>;
}

export interface PublishabilityAssessment {
  status: PublishabilityStatus;
  filingBeatSlug: string;
  operatorBtcAddress: string | null;
  reasons: string[];
}

const DEFAULT_BEAT_MAPPINGS: Record<string, string> = {
  "protocol-updates": "dev-tools",
  infrastructure: "dev-tools",
  "dev-tools": "dev-tools",
  security: "security",
  "deal-flow": "deal-flow",
  "agent-skills": "agent-skills",
  "agent-economy": "agent-economy",
  "agent-social": "agent-social",
  "agent-trading": "agent-trading",
  governance: "governance",
  onboarding: "onboarding"
};

function normalizeBeat(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function readOperatorPublishabilityConfig(baseDir?: string): Promise<OperatorPublishabilityConfig | null> {
  const filePath = resolve(baseDir ?? process.cwd(), "data/config/operator-profile.json");
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as OperatorPublishabilityConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function assessBeatPublishability(
  beat: string,
  baseDir?: string
): Promise<PublishabilityAssessment> {
  const config = await readOperatorPublishabilityConfig(baseDir);
  const envAddress = process.env.AIBTC_BITCOIN_ADDRESS?.trim() ?? "";
  const configuredAddress = config?.operatorBtcAddress?.trim() ?? "";
  const operatorBtcAddress = envAddress || configuredAddress || null;
  const beatMappings = {
    ...DEFAULT_BEAT_MAPPINGS,
    ...(config?.beatMappings ?? {})
  };
  const filingBeatSlug = beatMappings[normalizeBeat(beat)] ?? normalizeBeat(beat);
  if (!config) {
    return {
      status: "publishable",
      filingBeatSlug,
      operatorBtcAddress,
      reasons: ["publishability preflight skipped because no operator-profile.json is configured"]
    };
  }

  const publishableBeatSlugs = (config.publishableBeatSlugs ?? ["dev-tools"]).map(normalizeBeat);
  const reasons: string[] = [];

  if (envAddress && configuredAddress && envAddress !== configuredAddress) {
    return {
      status: "identity_mismatch",
      filingBeatSlug,
      operatorBtcAddress,
      reasons: [
        `publishability preflight failed: AIBTC_BITCOIN_ADDRESS (${envAddress}) does not match configured operator identity (${configuredAddress})`
      ]
    };
  }

  if (!operatorBtcAddress) {
    return {
      status: "unknown",
      filingBeatSlug,
      operatorBtcAddress,
      reasons: [
        "publishability preflight could not verify the operator identity because no BTC address is configured"
      ]
    };
  }

  if (!publishableBeatSlugs.includes(filingBeatSlug)) {
    return {
      status: "permission_blocked",
      filingBeatSlug,
      operatorBtcAddress,
      reasons: [
        `publishability preflight failed: beat ${filingBeatSlug} is not configured as publishable for the current operator`,
        `current operator can publish on: ${publishableBeatSlugs.join(", ")}`
      ]
    };
  }

  return {
    status: "publishable",
    filingBeatSlug,
    operatorBtcAddress,
    reasons: [`publishability preflight passed for filing beat ${filingBeatSlug}`]
  };
}
