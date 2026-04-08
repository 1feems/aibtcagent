import { fetchSubmittedSignals } from "./fetch-signals.js";
import { reviewSignals } from "./review-engine.js";
import { submitReviews } from "./submit-review.js";

// ── Entry point ───────────────────────────────────────────────────────────────

async function runEditorLoop(date: string): Promise<void> {
  process.stdout.write(`[editor-loop] start — ${date}\n`);

  // Step 1: Fetch unreviewed submitted signals
  const signals = await fetchSubmittedSignals(date);
  if (signals.length === 0) {
    process.stdout.write("[editor-loop] no unreviewed signals — done\n");
    return;
  }

  // Step 2: Review each signal
  const now = new Date().toISOString();
  const annotations = reviewSignals(signals, now);

  process.stdout.write(
    `[editor-loop] reviewed ${annotations.length} signal(s): ` +
      `approve=${annotations.filter((a) => a.recommendation === "approve").length} ` +
      `revise=${annotations.filter((a) => a.recommendation === "revise").length} ` +
      `reject=${annotations.filter((a) => a.recommendation === "reject").length}\n`
  );

  // Step 3: Submit annotations (helper mode = human-assisted BIP-137 POST)
  const results = await submitReviews(annotations, date, true);

  const submitted = results.filter((r) => r.submitted && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const errored = results.filter((r) => !r.submitted && !r.skipped).length;

  process.stdout.write(
    `[editor-loop] submissions — sent: ${submitted}, skipped: ${skipped}, errored: ${errored}\n`
  );

  process.stdout.write("[editor-loop] done\n");
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
runEditorLoop(date).catch((err: unknown) => {
  process.stderr.write(`[editor-loop] fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
