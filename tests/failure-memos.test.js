import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  generateDailyFailureMemos,
  saveDailyFailureMemos
} from "../dist/ops/index.js";

test("failure memos normalize miss categories and persist artifacts", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-failure-memos-"));

  try {
    await mkdir(resolve(tempDir, "data/candidate-history"), { recursive: true });
    await mkdir(resolve(tempDir, "data/queues"), { recursive: true });

    await writeFile(
      resolve(tempDir, "data/queues/2026-03-30.json"),
      JSON.stringify({
        kind: "ranked_candidate_queue",
        reportDate: "2026-03-30",
        generatedAt: "2026-03-30T23:00:00Z",
        candidates: [
          {
            candidateId: "memo-target",
            reasons: [
              "hard-blocked from signable queue because duplicate risk is unresolved",
              "headline reads like raw release notes instead of a finished filing",
              "recent loss memory says narrow same-beat fragments should be demoted in crowded lanes",
              "wrong beat for the current brief slot",
              "packaging still reads like a fragment instead of an article-shaped story"
            ]
          }
        ]
      }),
      "utf8"
    );

    await writeFile(
      resolve(tempDir, "data/candidate-history/memo-target.json"),
      JSON.stringify({
        kind: "candidate_history",
        reportDate: "2026-03-30",
        candidateId: "memo-target",
        headline: "v1.2.3 bug fixes stale queue behavior",
        beat: "Infrastructure",
        candidateMetadata: {
          duplicateStatus: "pending",
          freshnessStatus: "risk_unresolved"
        },
        outcome: {
          success: false,
          publishedInBrief: false,
          note: "approved but not published in In Brief — failed outcome for the real KPI",
          learningWhy: "Approved, but a broader same-beat story won because this was too narrow and the packaging was weak."
        }
      }),
      "utf8"
    );

    const memos = await generateDailyFailureMemos(
      "2026-03-30",
      "2026-03-30T23:10:00Z",
      tempDir
    );

    assert.equal(memos.length, 1);
    assert.deepEqual(
      memos[0].categories.sort(),
      [
        "approved_but_not_published",
        "duplicate",
        "stale",
        "too_narrow",
        "weak_headline",
        "weak_packaging",
        "wrong_beat"
      ].sort()
    );

    const paths = await saveDailyFailureMemos(memos, tempDir);
    const saved = JSON.parse(await readFile(paths[0], "utf8"));
    assert.equal(saved.kind, "failure_memo");
    const markdown = await readFile(paths[0].replace(/\.json$/, ".md"), "utf8");
    assert.match(markdown, /Categories:/);
    assert.match(markdown, /approved_but_not_published/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
