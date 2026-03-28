import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchNewReleases,
  fetchNewsFeedEvents,
  fetchApiSnapshots,
  buildLivePreSubmission
} from "../sources/index.js";
import { runDryRun } from "./dry-run.js";

export async function runFetchAndRun(
  now = new Date().toISOString()
): Promise<{
  now: string;
  reportDate: string;
  snapshotPaths: string[];
  results: Array<{ path: string; status: string }>;
}> {
  const reportDate = now.slice(0, 10);

  process.stdout.write(`[fetch-and-run] starting at ${now}\n`);

  // 1. Fetch new GitHub releases and news-feed candidates, plus direct API snapshots
  const [releasePaths, feedPaths, snapshotPaths] = await Promise.all([
    fetchNewReleases(now),
    fetchNewsFeedEvents(now),
    fetchApiSnapshots(now)
  ]);
  const newEventPaths = [...releasePaths, ...feedPaths];

  if (newEventPaths.length === 0) {
    process.stdout.write(
      `[fetch-and-run] no new candidate events — saved ${snapshotPaths.length} snapshot(s) and exiting\n`
    );
    return { now, reportDate, snapshotPaths, results: [] };
  }

  // 2. Build live pre-submission intelligence from the current approved feed
  const prePath = await buildLivePreSubmission(now);
  process.stdout.write(`[fetch-and-run] pre-submission intelligence saved to ${basename(prePath)}\n`);

  // 3. Run the dry-run pipeline for each new event
  const results: Array<{ path: string; status: string }> = [];

  for (const rawPath of newEventPaths) {
    const label = basename(rawPath);
    try {
      const summary = await runDryRun({
        rawPath,
        preSubmissionPath: prePath,
        generatedAt: now,
        reportDate,
        outputDir: `data/dry-runs/${reportDate}`
      });
      results.push({ path: label, status: summary.submissionStatus });
      process.stdout.write(`[fetch-and-run] ${label} → ${summary.submissionStatus}\n`);
    } catch (error) {
      results.push({ path: label, status: "error" });
      process.stderr.write(`[fetch-and-run] ${label} failed: ${(error as Error).message}\n`);
    }
  }

  // 4. Summary
  const submitCount = results.filter((r) => r.status === "submit").length;
  const rejectCount = results.filter((r) => r.status === "reject").length;
  process.stdout.write(
    `[fetch-and-run] done — ${submitCount} ready to file, ${rejectCount} rejected, ${snapshotPaths.length} snapshots saved\n`
  );

  return { now, reportDate, snapshotPaths, results };
}

async function main(): Promise<void> {
  await runFetchAndRun();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentModulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === currentModulePath) {
  void main();
}
