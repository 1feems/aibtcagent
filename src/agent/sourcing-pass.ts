import {
  buildLivePreSubmission,
  fetchApiSnapshots,
  fetchNewReleases,
  fetchNewsFeedEvents
} from "../sources/index.js";
import { runSignalJob } from "../prep/signal-job.js";
import type { ReplenishmentPassResult, ReplenishmentPassRunner } from "./replenishment.js";

export const runCandidateSourcingPass: ReplenishmentPassRunner = async (
  generatedAt: string,
  reportDate: string
): Promise<ReplenishmentPassResult> => {
  const [releasePaths, feedPaths, snapshotPaths] = await Promise.all([
    fetchNewReleases(generatedAt),
    fetchNewsFeedEvents(generatedAt),
    fetchApiSnapshots(generatedAt)
  ]);

  await buildLivePreSubmission(generatedAt, reportDate);
  await runSignalJob(reportDate, generatedAt);

  return {
    results: [
      ...releasePaths.map((path) => ({ path, status: "fetched" })),
      ...feedPaths.map((path) => ({ path, status: "fetched" })),
      ...snapshotPaths.map((path) => ({ path, status: "snapshot_saved" }))
    ]
  };
};
