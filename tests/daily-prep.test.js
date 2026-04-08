import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runDailyPrep } from "../dist/prep/daily-prep.js";

test("daily prep blocks when the daily brief artifact is missing", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-daily-prep-missing-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/filed-signals.json"), JSON.stringify({ filedSignals: [] }), "utf8");

    const result = await runDailyPrep("2026-04-05", "2026-04-05T17:24:58.470Z", tempDir);

    assert.equal(result.skipped, true);
    assert.equal(result.briefFound, false);
    assert.match(result.skipReason ?? "", /brief artifact missing/i);
    assert.equal(existsSync(resolve(tempDir, "data/briefs/2026-04-05.md")), false);
    assert.equal(existsSync(resolve(tempDir, "data/reports/daily/2026-04-05.md")), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("daily prep blocks when the daily brief artifact is still a placeholder", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-daily-prep-placeholder-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/filed-signals.json"), JSON.stringify({ filedSignals: [] }), "utf8");
    await writeFile(
      resolve(tempDir, "data/briefs/2026-04-05.md"),
      [
        "# Brief Artifact: 2026-04-05",
        "",
        "Status: awaiting manual brief input",
        "",
        "This file is still waiting on operator-supplied brief content."
      ].join("\n"),
      "utf8"
    );

    const result = await runDailyPrep("2026-04-05", "2026-04-05T17:24:58.470Z", tempDir);

    assert.equal(result.skipped, true);
    assert.equal(result.briefFound, false);
    assert.match(result.skipReason ?? "", /still a placeholder/i);
    assert.equal(existsSync(resolve(tempDir, "data/reports/daily/2026-04-05.md")), false);
    const brief = await readFile(resolve(tempDir, "data/briefs/2026-04-05.md"), "utf8");
    assert.match(brief, /awaiting manual brief input/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("daily prep ingests manual outcome input, writes durable lessons, and updates the dated signal report", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-daily-prep-outcomes-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/reports/daily-input"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/filed-signals.json"), JSON.stringify({ filedSignals: [] }), "utf8");
    await writeFile(resolve(tempDir, "data/briefs/2026-04-06.md"), "# Brief Artifact: 2026-04-06\n\n- exact brief text present", "utf8");
    await writeFile(
      resolve(tempDir, "data/reports/daily-input/2026-04-06.md"),
      [
        "# Daily Outcome Input: 2026-04-06",
        "",
        "## Brief winners",
        "- PR #301 fixes x402 sponsor relay nonce gaps after 18 stuck payouts",
        "- BFF HODLMM deployer clears 170 sats in Bitflow routing test",
        "",
        "## In brief",
        "- Genesis inversion update shows active agents above pending at block 943,333",
        "",
        "## Rejected",
        "- Generic crypto market roundup with no AIBTC operator consequence",
        "",
        "## Top 6",
        "- Encrypted Zara",
        "- Prime Spoke",
        "",
        "Valiant rank: #96",
        "",
        "## Notes",
        "- Brief winners stayed highly technical and AIBTC-native."
      ].join("\n"),
      "utf8"
    );

    const result = await runDailyPrep("2026-04-06", "2026-04-06T17:24:58.470Z", tempDir);

    assert.equal(result.skipped, false);
    const report = await readFile(resolve(tempDir, "data/reports/daily/2026-04-06.md"), "utf8");
    const learnings = await readFile(resolve(tempDir, "memory/learnings.md"), "utf8");
    const signalReport = await readFile(resolve(tempDir, "data/reports/signals/2026-04-06.md"), "utf8");

    assert.match(report, /manual daily input file: used/i);
    assert.match(report, /winning categories detected:/i);
    assert.match(learnings, /source AIBTC-native stories only/i);
    assert.match(learnings, /keep Valiant focused on infrastructure and agent-skills first/i);
    assert.match(signalReport, /## Daily outcome intake/);
    assert.match(signalReport, /Infrastructure and security patches/);
    assert.equal(existsSync(resolve(tempDir, "data/state/editorial-memory.json")), true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
