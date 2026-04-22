import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

interface ManualBriefIngestState {
  reports?: Array<{
    reportDate: string;
    inputPath: string;
    briefJsonPath: string;
    briefSnapshotPath: string;
    entryCount: number;
    updatedAt: string;
  }>;
}

interface VerificationOptions {
  baseDir?: string;
  requireOperatorReport?: boolean;
}

export interface EditorialLearningVerification {
  reportDate: string;
  briefSaved: boolean;
  verified: boolean;
  inputPath: string;
  verifiedFiles: string[];
  missingFiles: string[];
  staleFiles: string[];
  note: string;
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function findBriefInputPath(reportDate: string, baseDir?: string): Promise<string | null> {
  const root = resolve(baseDir ?? process.cwd());
  const candidates = [
    resolve(root, `data/briefs/${reportDate}.json`),
    resolve(root, `data/briefs/${reportDate}.md`),
    resolve(root, `data/briefs/${reportDate}.txt`)
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function verifyEditorialLearningProof(
  reportDate: string,
  options: VerificationOptions = {}
): Promise<EditorialLearningVerification> {
  const root = resolve(options.baseDir ?? process.cwd());
  const briefInputPath = await findBriefInputPath(reportDate, root);
  const requireOperatorReport = options.requireOperatorReport ?? false;

  if (!briefInputPath) {
    return {
      reportDate,
      briefSaved: false,
      verified: false,
      inputPath: `data/briefs/${reportDate}.md`,
      verifiedFiles: [],
      missingFiles: [`data/briefs/${reportDate}.json|md|txt`],
      staleFiles: [],
      note: "Brief is not learned yet because no saved daily brief exists in data/briefs."
    };
  }

  const briefStat = await stat(briefInputPath);
  const ingestStatePath = resolve(root, "data/state/manual-brief-ingest.json");
  const behaviorPath = resolve(root, "data/state/brief-agent-behavior.json");
  const winnersPath = resolve(root, `data/state/brief-winners-${reportDate}.json`);
  const operatorReportPath = resolve(root, `data/reports/operator/${reportDate}.json`);
  const expectedPaths = [
    ingestStatePath,
    behaviorPath,
    winnersPath,
    ...(requireOperatorReport ? [operatorReportPath] : [])
  ];
  const verifiedFiles: string[] = [];
  const missingFiles: string[] = [];
  const staleFiles: string[] = [];

  for (const filePath of expectedPaths) {
    if (!(await fileExists(filePath))) {
      missingFiles.push(filePath.replace(`${root}/`, ""));
      continue;
    }

    const fileStat = await stat(filePath);
    if (fileStat.mtimeMs < briefStat.mtimeMs) {
      staleFiles.push(filePath.replace(`${root}/`, ""));
      continue;
    }

    verifiedFiles.push(filePath.replace(`${root}/`, ""));
  }

  const ingestState = await readJsonOrNull<ManualBriefIngestState>(ingestStatePath);
  const ingestReport = (ingestState?.reports ?? []).find((entry) => entry.reportDate === reportDate) ?? null;
  if (!ingestReport && !missingFiles.includes("data/state/manual-brief-ingest.json")) {
    staleFiles.push("data/state/manual-brief-ingest.json");
  }

  const verified = missingFiles.length === 0 && staleFiles.length === 0;
  const note = verified
    ? "Brief learning is proven by repo state."
    : `Do not say the brief was learned yet; missing or stale proof remains (${[...missingFiles, ...staleFiles].join(", ")}).`;

  return {
    reportDate,
    briefSaved: true,
    verified,
    inputPath: briefInputPath.replace(`${root}/`, ""),
    verifiedFiles,
    missingFiles,
    staleFiles,
    note
  };
}
