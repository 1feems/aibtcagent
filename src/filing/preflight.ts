import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFilingQueue } from "./queue.js";
import { ALLOWED_SIGNAL_BEATS } from "./signal-contract.js";
import type { OperatorSignabilityState } from "./signability.js";

interface HelperSessionState {
  kind: "xverse_helper_session";
  updatedAt: string;
  walletProviderReady: boolean;
  activeWalletAddress: string | null;
  lastHelperPath: string | null;
}

interface PreflightConfig {
  reportDate: string | null;
  candidateId: string | null;
}

interface FilingReadyArtifact {
  submission?: {
    headline?: string;
    candidate_signal?: {
      beat?: string;
    };
    article_preview?: {
      lede?: string;
      why_it_matters?: string;
    };
  };
}

function parseArgs(argv: string[]): PreflightConfig {
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed.set(key, "true");
      continue;
    }

    parsed.set(key, next);
    index += 1;
  }

  return {
    reportDate: parsed.get("date") ?? null,
    candidateId: parsed.get("candidate") ?? null
  };
}

function resolveSignabilityPath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/operator-signability.json");
}

function resolveHelperSessionPath(baseDir?: string): string {
  return resolve(baseDir ?? process.cwd(), "data/state/xverse-helper-session.json");
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

function normalizeBeat(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function readPrimaryBeatFromDocs(baseDir?: string): Promise<string | null> {
  const filePath = resolve(baseDir ?? process.cwd(), "docs/beat-strategy.md");
  try {
    const raw = await readFile(filePath, "utf8");
    const match = raw.match(/Registered beat slug:\s*`([^`]+)`/i);
    return match?.[1] ? normalizeBeat(match[1]) : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readExpectedWalletAddress(baseDir?: string): Promise<string | null> {
  if (process.env.AIBTC_BITCOIN_ADDRESS) {
    return process.env.AIBTC_BITCOIN_ADDRESS.trim();
  }

  const filePath = resolve(baseDir ?? process.cwd(), "docs/setup.md");
  try {
    const raw = await readFile(filePath, "utf8");
    const match = raw.match(/### Primary Bitcoin Address\s+-\s+`([^`]+)`/m);
    return match?.[1] ?? null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function parseAllowedBeatsFromEnv(): string[] {
  const csv = process.env.AIBTC_ALLOWED_BEATS ?? process.env.AIBTC_PRIMARY_BEAT ?? "";
  return csv
    .split(",")
    .map((value) => normalizeBeat(value))
    .filter(Boolean);
}

async function resolveTargetCandidate(
  reportDate: string | null,
  candidateId: string | null,
  baseDir?: string
): Promise<{ reportDate: string | null; candidateId: string | null }> {
  if (reportDate && candidateId) {
    return { reportDate, candidateId };
  }

  if (!reportDate) {
    return { reportDate: null, candidateId: null };
  }

  const queue = await readJsonOrNull<Awaited<ReturnType<typeof readFilingQueue>>>(
    resolve(baseDir ?? process.cwd(), `data/filing-queue/${reportDate}.json`)
  );
  if (!queue) {
    return { reportDate, candidateId: null };
  }

  const approved = queue.items.find((item) => item.queueStatus === "approved_for_filing");
  return {
    reportDate,
    candidateId: candidateId ?? approved?.candidateId ?? queue.topCandidateId ?? null
  };
}

async function validateHelperPayloadIntegrity(
  reportDate: string | null,
  candidateId: string | null,
  baseDir?: string
): Promise<{ ready: boolean; notes: string[]; beat: string | null }> {
  const root = baseDir ?? process.cwd();
  const notes: string[] = [];
  const helperHtmlPath = resolve(root, "tools/xverse-register/file-signal.html");
  const helperServerPath = resolve(root, "src/filing/helper-server.ts");

  const [helperHtml, helperServer] = await Promise.all([
    readJsonOrNull<string>(helperHtmlPath).catch(async () => {
      try {
        await readFile(helperHtmlPath, "utf8");
        return "ok";
      } catch {
        return null;
      }
    }),
    readJsonOrNull<string>(helperServerPath).catch(async () => {
      try {
        await readFile(helperServerPath, "utf8");
        return "ok";
      } catch {
        return null;
      }
    })
  ]);

  if (!helperHtml || !helperServer) {
    notes.push("Signal filing helper assets are missing.");
    return { ready: false, notes, beat: null };
  }

  if (!reportDate || !candidateId) {
    notes.push("Helper assets are present; no filing-ready artifact was targeted in this run.");
    return { ready: true, notes, beat: null };
  }

  const artifactPath = resolve(root, `data/filing-ready/${reportDate}/${candidateId}.json`);
  const artifact = await readJsonOrNull<FilingReadyArtifact>(artifactPath);
  if (!artifact?.submission) {
    notes.push(`Filing-ready artifact is missing for ${candidateId}.`);
    return { ready: false, notes, beat: null };
  }

  const headline = artifact.submission.headline?.trim() ?? "";
  const beat = artifact.submission.candidate_signal?.beat?.trim() ?? "";
  const body = [
    artifact.submission.article_preview?.lede?.trim() ?? "",
    artifact.submission.article_preview?.why_it_matters?.trim() ?? ""
  ].filter(Boolean).join(" ");

  if (!headline || !beat || !body) {
    notes.push(`Filing-ready artifact ${candidateId} is missing headline, beat, or article preview body text.`);
    return { ready: false, notes, beat: beat || null };
  }

  notes.push(`Filing-ready artifact ${candidateId} passed local payload-shape validation.`);
  return { ready: true, notes, beat };
}

export async function readHelperSessionState(baseDir?: string): Promise<HelperSessionState | null> {
  return readJsonOrNull<HelperSessionState>(resolveHelperSessionPath(baseDir));
}

export async function saveHelperSessionState(
  state: HelperSessionState,
  baseDir?: string
): Promise<string> {
  const filePath = resolveHelperSessionPath(baseDir);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2) + "\n", "utf8");
  return filePath;
}

export async function recordHelperWalletSession(
  input: {
    activeWalletAddress: string | null;
    walletProviderReady: boolean;
    helperPath?: string | null;
  },
  baseDir?: string
): Promise<string> {
  return saveHelperSessionState(
    {
      kind: "xverse_helper_session",
      updatedAt: new Date().toISOString(),
      walletProviderReady: input.walletProviderReady,
      activeWalletAddress: input.activeWalletAddress,
      lastHelperPath: input.helperPath ?? null
    },
    baseDir
  );
}

export async function generateOperatorSignabilityPreflight(
  config: PreflightConfig,
  baseDir?: string
): Promise<OperatorSignabilityState> {
  const root = baseDir ?? process.cwd();
  const [expectedWalletAddress, primaryBeat, helperSession] = await Promise.all([
    readExpectedWalletAddress(root),
    readPrimaryBeatFromDocs(root),
    readHelperSessionState(root)
  ]);
  const target = await resolveTargetCandidate(config.reportDate, config.candidateId, root);
  const payloadCheck = await validateHelperPayloadIntegrity(target.reportDate, target.candidateId, root);

  const automationAllowedBeats = [...new Set([
    ...parseAllowedBeatsFromEnv(),
    ...(primaryBeat ? [primaryBeat] : [])
  ])];
  const canonicalAllowedBeats = [...new Set(ALLOWED_SIGNAL_BEATS.map((beat) => normalizeBeat(beat)))];
  const canonicalSet = new Set(canonicalAllowedBeats);
  const filteredAutomationBeats = automationAllowedBeats.filter((beat) => canonicalSet.has(beat));
  const droppedStaleBeats = automationAllowedBeats.filter((beat) => !canonicalSet.has(beat));
  const allowedBeats = canonicalAllowedBeats;

  const notes: string[] = [];
  if (expectedWalletAddress) {
    notes.push(`Expected filing wallet: ${expectedWalletAddress}.`);
  } else {
    notes.push("Expected filing wallet could not be resolved from env or docs/setup.md.");
  }

  if (allowedBeats.length > 0) {
    notes.push(`Allowed beats for helper/manual filing: ${allowedBeats.join(", ")}.`);
  } else {
    notes.push("Allowed beats could not be resolved; set AIBTC_ALLOWED_BEATS or keep docs/beat-strategy.md current.");
  }
  if (filteredAutomationBeats.length > 0) {
    notes.push(`Automation focus beats from env/docs: ${filteredAutomationBeats.join(", ")}.`);
  }
  if (droppedStaleBeats.length > 0) {
    notes.push(`Ignored stale or retired beats from config/docs: ${droppedStaleBeats.join(", ")}.`);
  }

  if (helperSession?.walletProviderReady) {
    notes.push(`Last helper wallet session: ${helperSession.activeWalletAddress ?? "unknown address"} via ${helperSession.lastHelperPath ?? "unknown helper"}.`);
  } else {
    notes.push("No recent helper wallet session recorded yet. Open the Xverse helper and connect the wallet first.");
  }

  notes.push(...payloadCheck.notes);

  return {
    kind: "operator_signability_preflight",
    checkedAt: new Date().toISOString(),
    walletProviderReady: helperSession?.walletProviderReady ?? false,
    payloadIntegrityReady: payloadCheck.ready,
    activeWalletAddress: helperSession?.activeWalletAddress ?? null,
    requiredWalletAddress: expectedWalletAddress,
    allowedBeats,
    blockedBeats: payloadCheck.beat && allowedBeats.length > 0 && !allowedBeats.includes(normalizeBeat(payloadCheck.beat))
      ? [normalizeBeat(payloadCheck.beat)]
      : [],
    notes
  };
}

export async function saveOperatorSignabilityPreflight(
  state: OperatorSignabilityState,
  baseDir?: string
): Promise<string> {
  const filePath = resolveSignabilityPath(baseDir);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2) + "\n", "utf8");
  return filePath;
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const state = await generateOperatorSignabilityPreflight(config);
  const filePath = await saveOperatorSignabilityPreflight(state);
  process.stdout.write(`${JSON.stringify({ filePath, state }, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
