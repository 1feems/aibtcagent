import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { FilingQueueSnapshot } from "./queue.js";
import { evaluateSignalGuard, type SignalGuardResult } from "./signal-guard.js";
import { buildHelperReadySignalPackage, parseCanonicalSignalPayload, type CanonicalSignalPayload } from "./signal-contract.js";

interface FilingReadyArtifact {
  candidateId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  sourcePath?: string;
  canonicalSignal?: CanonicalSignalPayload | null;
  submission?: {
    headline?: string;
    candidate_signal?: {
      beat?: string;
    };
  };
  sendPackage?: {
    btc_address?: string | null;
    headline?: string | null;
    analysis?: string | null;
    sources?: Array<{ url?: string; title?: string }>;
    tags?: string[];
    json?: unknown;
    helperPath?: string;
    helperUrl?: string;
  } | null;
}

function normalizePath(root: string, absolutePath: string): string {
  return absolutePath.startsWith(`${root}/`) ? absolutePath.slice(root.length + 1) : absolutePath;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function resolveArtifactPath(root: string, maybeRelativePath: string | undefined): string | null {
  if (!maybeRelativePath || maybeRelativePath.trim().length === 0) return null;
  return maybeRelativePath.startsWith("/") ? maybeRelativePath : resolve(root, maybeRelativePath);
}

function buildFallbackSendPackage(
  artifact: FilingReadyArtifact,
  canonicalSignal: CanonicalSignalPayload | null
): FilingReadyArtifact["sendPackage"] {
  if (!canonicalSignal) {
    return null;
  }
  return buildHelperReadySignalPackage(canonicalSignal);
}

function renderGuardSummary(guard: SignalGuardResult | null): string[] {
  if (!guard) {
    return ["- Final guard verdict: unknown"];
  }

  const duplicatePass =
    guard.checks.currentBrief === "pass" &&
    guard.checks.priorBriefs === "pass" &&
    guard.checks.priorMatchedRejection === "pass";

  return [
    "- Final guard:",
    `  - Q1: \`${guard.checks.publisherQ1}\``,
    `  - Q2: \`${guard.checks.publisherQ2}\``,
    `  - Q3: \`${guard.checks.publisherQ3}\``,
    `  - Q4: \`${guard.checks.publisherQ4}\``,
    `  - Fact-check source verification: \`${guard.checks.factCheckerSourceVerification}\``,
    `  - Fact-check claim verification: \`${guard.checks.factCheckerClaimVerification}\``,
    `  - Duplicate-shape: \`${duplicatePass ? "pass" : "reject"}\``,
    `  - Winner bar: \`${guard.checks.winnerBar}\``,
    `  - Verdict: \`${guard.ok ? "pass" : "kill"}\``
  ];
}

export async function writeTrustedSignalSlate(
  reportDate: string,
  baseDir?: string
): Promise<string> {
  const root = resolve(baseDir ?? process.cwd());
  const filingQueuePath = resolve(root, `data/filing-queue/${reportDate}.json`);
  const filingReadyDir = resolve(root, `data/filing-ready/${reportDate}`);
  const outputPath = resolve(root, `data/reports/signals/${reportDate}-trusted.md`);

  const queue = existsSync(filingQueuePath)
    ? await readJsonFile<FilingQueueSnapshot>(filingQueuePath)
    : null;

  const filingReadyArtifacts: Array<{
    path: string;
    artifact: FilingReadyArtifact;
    guard: SignalGuardResult | null;
  }> = [];
  if (existsSync(filingReadyDir)) {
    const fileNames = (await readdir(filingReadyDir))
      .filter((name) => name.endsWith(".json"))
      .sort();

    for (const fileName of fileNames) {
      const absolutePath = resolve(filingReadyDir, fileName);
      const artifact = await readJsonFile<FilingReadyArtifact>(absolutePath);
      const manualSubmissionPath = resolveArtifactPath(root, artifact.sourcePath);
      const manualSubmissionRaw =
        manualSubmissionPath && existsSync(manualSubmissionPath)
          ? await readJsonFile<unknown>(manualSubmissionPath).catch(() => null)
          : null;
      const canonicalFromSource = manualSubmissionRaw ? parseCanonicalSignalPayload(manualSubmissionRaw).payload : null;
      const enrichedArtifact: FilingReadyArtifact = {
        ...artifact,
        canonicalSignal: artifact.canonicalSignal ?? canonicalFromSource,
        sendPackage: artifact.sendPackage ?? buildFallbackSendPackage(artifact, artifact.canonicalSignal ?? canonicalFromSource)
      };
      const guard =
        enrichedArtifact.sendPackage?.headline && enrichedArtifact.sendPackage?.analysis
          ? await evaluateSignalGuard({
              reportDate,
              headline: enrichedArtifact.sendPackage.headline,
              beat_slug: enrichedArtifact.canonicalSignal?.beat_slug ?? artifact.submission?.candidate_signal?.beat ?? null,
              body: enrichedArtifact.sendPackage.analysis,
              sources: (enrichedArtifact.sendPackage.sources ?? []).map((source) => ({
                url: source.url,
                title: source.title
              })),
              enforceWinnerBar: true,
              model_disclosure: {
                tools_used: [],
                derivation_steps: enrichedArtifact.canonicalSignal?.disclosure
                  ? [enrichedArtifact.canonicalSignal.disclosure]
                  : []
              }
            }, root)
          : null;
      filingReadyArtifacts.push({
        path: normalizePath(root, absolutePath),
        artifact: enrichedArtifact,
        guard
      });
    }
  }

  const reviewable = (queue?.items ?? []).filter((item) => item.queueStatus === "awaiting_human_approval");
  const sendReady = filingReadyArtifacts.filter(({ guard }) => guard?.ok !== false);
  const blockedReady = filingReadyArtifacts.filter(({ guard }) => guard?.ok === false);

  const lines = [
    `# Trusted Signal Slate: ${reportDate}`,
    "",
    "This is the repo-trusted signal slate.",
    "Only entries already present in `data/filing-queue/YYYY-MM-DD.json` or `data/filing-ready/YYYY-MM-DD/*.json` appear here.",
    "Do not treat `data/manual-submissions` or the validation-only signal job report as the final send slate.",
    "",
    "## Runtime rule",
    "- Reviewable signals must already be `awaiting_human_approval` in the filing queue.",
    "- Send-ready signals must already have a filing-ready artifact.",
    "- Anything outside those two repo artifacts is not trusted runtime output.",
    "",
    "## Reviewable queue candidates",
    ...(reviewable.length > 0
      ? reviewable.flatMap((item, index) => [
          `### Candidate ${index + 1}`,
          `- Candidate ID: \`${item.candidateId}\``,
          `- Headline: ${item.headline}`,
          `- Beat: \`${item.beat}\``,
          `- Queue status: \`${item.queueStatus}\``,
          `- Queue artifact: \`data/filing-queue/${reportDate}.json\``,
          `- Source artifact: \`${normalizePath(root, item.sourcePath)}\``,
          `- Repo verdict: reviewable only; not send-ready until approved and materialized in \`data/filing-ready/${reportDate}/\``,
          ""
        ])
      : ["- none", ""]),
    "## Send-ready artifacts",
    ...(sendReady.length > 0
      ? sendReady.flatMap(({ path, artifact, guard }, index) => [
          `### Ready ${index + 1}`,
          `- Candidate ID: \`${artifact.candidateId ?? "unknown"}\``,
          `- Headline: ${artifact.canonicalSignal?.headline ?? artifact.submission?.headline ?? "unknown"}`,
          `- Beat: \`${artifact.canonicalSignal?.beat_slug ?? artifact.submission?.candidate_signal?.beat ?? "unknown"}\``,
          `- Filing-ready artifact: \`${path}\``,
          `- Reviewed by: \`${artifact.reviewedBy ?? "unknown"}\``,
          `- Reviewed at: \`${artifact.reviewedAt ?? "unknown"}\``,
          "- Repo verdict: send-ready; use this artifact for manual signing",
          ...renderGuardSummary(guard),
          ...(artifact.sendPackage
            ? [
                "- Send package:",
                `  - Headline: ${artifact.sendPackage.headline ?? "unknown"}`,
                `  - Analysis: ${artifact.sendPackage.analysis ?? "unknown"}`,
                "  - Sources:",
                ...((artifact.sendPackage.sources ?? []).length > 0
                  ? (artifact.sendPackage.sources ?? []).map(
                      (source) => `    - \`${source.url ?? ""}\`${source.title ? ` (${source.title})` : ""}`
                    )
                  : ["    - none"]),
                "  - Tags:",
                ...((artifact.sendPackage.tags ?? []).length > 0
                  ? (artifact.sendPackage.tags ?? []).map((tag) => `    - \`${tag}\``)
                  : ["    - none"]),
                "  - JSON:",
                "```json",
                JSON.stringify(artifact.sendPackage.json, null, 2),
                "```",
                `  - Helper path: \`${artifact.sendPackage.helperPath ?? "tools/xverse-register/file-signal.html"}\``,
                `  - Helper URL: \`${artifact.sendPackage.helperUrl ?? "http://127.0.0.1:4173/tools/xverse-register/file-signal.html"}\``
              ]
            : [
                "- Send package: unavailable in artifact; operator-facing payload must be recovered from the source draft before filing"
              ]),
          ""
        ])
      : ["- none", ""]),
    "## Blocked filing-ready artifacts",
    ...(blockedReady.length > 0
      ? blockedReady.flatMap(({ path, artifact, guard }, index) => [
          `### Blocked ${index + 1}`,
          `- Candidate ID: \`${artifact.candidateId ?? "unknown"}\``,
          `- Headline: ${artifact.submission?.headline ?? "unknown"}`,
          `- Filing-ready artifact: \`${path}\``,
          "- Repo verdict: do not send; artifact fails the shared final signal guard",
          ...renderGuardSummary(guard),
          ...((guard?.blockers ?? []).length > 0
            ? ["- Blockers:", ...(guard?.blockers ?? []).map((blocker) => `  - ${blocker}`)]
            : ["- Blockers: unknown"]),
          ""
        ])
      : ["- none", ""]),
    "## Untrusted paths",
    "- `data/manual-submissions/YYYY-MM-DD/` is validation input, not final runtime truth.",
    "- Chat-created candidates are not trusted runtime output.",
    "- If a signal is absent from the filing queue and filing-ready artifacts, do not show it as a real candidate."
  ];

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  return outputPath;
}
