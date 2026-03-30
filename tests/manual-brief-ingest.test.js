import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ingestManualDailyBrief } from "../dist/brief/index.js";

test("manual brief ingest updates winner snapshot, training memory, and agent behavior", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-manual-brief-"));

  try {
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/training"), { recursive: true });
    await writeFile(resolve(tempDir, "data/training/in-brief.jsonl"), "", "utf8");

    await writeFile(
      resolve(tempDir, "data/briefs/2026-03-29.json"),
      JSON.stringify({
        kind: "manual_daily_brief",
        reportDate: "2026-03-29",
        entries: [
          {
            agent: "Royal Wolf",
            beat: "Onboarding",
            headline: "3 of 5 New AIBTC Agents Register via Auto Referral Batch",
            sources: [
              { url: "https://aibtc.com/api/agents", title: "AIBTC Agents API" },
              { url: "https://aibtc.news/brief/2026-03-29", title: "Daily brief" }
            ]
          },
          {
            agent: "Royal Wolf",
            beat: "Distribution",
            headline: "3 AIBTC Agents Broadcast Claim Codes on X in 1 Day",
            sources: [
              { url: "https://aibtc.com/activity", title: "Activity" },
              { url: "https://x.com/example/status/1", title: "X post" }
            ]
          }
        ],
        approvedNotInBrief: [
          {
            agent: "Other Agent",
            beat: "Dev Tools",
            headline: "A valid but narrower tooling story",
            sources: [{ url: "https://github.com/aibtcdev/x402-sponsor-relay/releases", title: "Release" }]
          }
        ]
      }),
      "utf8"
    );

    const result = await ingestManualDailyBrief("2026-03-29", tempDir);
    assert.ok(result);

    const snapshot = JSON.parse(
      await readFile(resolve(tempDir, "data/state/brief-winners-2026-03-29.json"), "utf8")
    );
    assert.deepEqual(snapshot.occupiedBeats, ["Distribution", "Onboarding"]);
    assert.equal(snapshot.repeatWinners[0].agent, "Royal Wolf");
    assert.equal(snapshot.approvedNotInBrief.length, 1);

    const behavior = JSON.parse(
      await readFile(resolve(tempDir, "data/state/brief-agent-behavior.json"), "utf8")
    );
    assert.equal(behavior.agents[0].agent, "Royal Wolf");
    assert.equal(behavior.agents[0].sameDayMultiWins, 1);

    const competitorStyles = JSON.parse(
      await readFile(resolve(tempDir, "data/state/top_5_competitor_styles.json"), "utf8")
    );
    assert.equal(competitorStyles.competitors[0].agent, "Royal Wolf");
    assert.equal(competitorStyles.competitors[0].styleLabel, "cross_beat_operator_packaging");

    const training = await readFile(resolve(tempDir, "data/training/in-brief.jsonl"), "utf8");
    assert.match(training, /manual_brief_ingest/);

    const analysis = JSON.parse(
      await readFile(resolve(tempDir, "data/reports/brief-analysis/2026-03-29.json"), "utf8")
    );
    assert.equal(analysis.topAgentsToday[0].agent, "Royal Wolf");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
