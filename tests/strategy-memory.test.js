import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  buildDailyStrategySnapshot,
  buildStrategyNotes,
  saveDailyStrategySnapshot
} from "../dist/intelligence/index.js";

test("daily strategy snapshot reads core docs and produces sourcing guidance", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-strategy-"));

  try {
    await mkdir(resolve(tempDir, "docs"), { recursive: true });
    await mkdir(resolve(tempDir, "data/brief-history"), { recursive: true });

    await writeFile(
      resolve(tempDir, "docs/brief-win-rules.md"),
      "# Brief\n- probability of in_brief\n- broader same-beat story wins\n- structural implication present\n- hidden driver identified\n- risk window identified\n- artifact title\n",
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "docs/signal-sourcing-checklist.md"),
      "# Checklist\n- check the daily brief before calling a candidate open\n- check approved, submitted, and rejected feeds before calling a candidate novel\n- note which beats are flooded\n- stronger same-beat story has already taken the slot\n- use the primary source, not a summary\n- would look natural on a human news site\n",
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "docs/brief-winner-tracking.md"),
      "# Winners\n- repeat-winning agent already owns the best angle on this beat today\n",
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "docs/sources.md"),
      "# Sources\n- GitHub releases\n- API docs and status pages\n- daily brief\n- live activity feed\n- official releases\n- external actionable security researcher reports\n- regulatory filings and primary legal documents\n",
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "docs/beat-strategy.md"),
      "# Beat\n- optimize for selection probability, not total output volume\n- dashboard-first observations\n",
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "data/brief-history/2026-03-seed.json"),
      JSON.stringify({
        kind: "historical_brief_seed",
        label: "seed",
        notes: [
          "Repeated brief winners often pair GitHub release proof with a concrete operator consequence."
        ]
      }),
      "utf8"
    );

    const snapshot = await buildDailyStrategySnapshot("2026-03-29", "2026-03-29T06:15:00Z", tempDir);
    assert.equal(snapshot.reportDate, "2026-03-29");
    assert.ok(snapshot.priorities.some((line) => /in_brief/i.test(line)));
    assert.ok(snapshot.sourceLanes.some((line) => /GitHub releases/i.test(line)));
    assert.ok(snapshot.sourceLanes.some((line) => /approved, submitted, and rejected feeds/i.test(line)));
    assert.ok(snapshot.sourceLanes.some((line) => /external actionable security researcher reports/i.test(line)));
    assert.ok(snapshot.competitionRules.some((line) => /same-beat/i.test(line)));
    assert.ok(snapshot.antiPatterns.some((line) => /dashboard-first/i.test(line)));
    assert.ok(snapshot.historicalNotes.some((line) => /GitHub release proof/i.test(line)));

    const notes = buildStrategyNotes(snapshot);
    assert.equal(notes.length > 0, true);
    assert.ok(notes.some((line) => /Historical brief pattern:/i.test(line)));

    const savedPath = await saveDailyStrategySnapshot(snapshot, tempDir);
    const saved = JSON.parse(await readFile(savedPath, "utf8"));
    assert.equal(saved.kind, "daily_strategy_snapshot");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
