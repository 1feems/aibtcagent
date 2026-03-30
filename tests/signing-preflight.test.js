import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  generateOperatorSignabilityPreflight,
  recordHelperWalletSession,
  saveOperatorSignabilityPreflight
} from "../dist/filing/index.js";

test("signing preflight derives wallet, beat permission, and payload integrity from repo state", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signing-preflight-"));

  try {
    await mkdir(resolve(tempDir, "docs"), { recursive: true });
    await mkdir(resolve(tempDir, "tools/xverse-register"), { recursive: true });
    await mkdir(resolve(tempDir, "data/filing-ready/2026-03-30"), { recursive: true });

    await writeFile(
      resolve(tempDir, "docs/setup.md"),
      [
        "### Primary Bitcoin Address",
        "- `bc1qexpectedwallet`"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "docs/beat-strategy.md"),
      "Registered beat slug: `dev-tools`\n",
      "utf8"
    );
    await writeFile(resolve(tempDir, "tools/xverse-register/file-signal.html"), "<html></html>\n", "utf8");
    await writeFile(resolve(tempDir, "src-placeholder.txt"), "placeholder\n", "utf8");
    await mkdir(resolve(tempDir, "src/filing"), { recursive: true });
    await writeFile(resolve(tempDir, "src/filing/helper-server.ts"), "export {};\n", "utf8");
    await writeFile(
      resolve(tempDir, "data/filing-ready/2026-03-30/candidate-one.json"),
      JSON.stringify({
        kind: "filing_ready_submission",
        reportDate: "2026-03-30",
        candidateId: "candidate-one",
        submission: {
          headline: "Dev tools signal",
          candidate_signal: { beat: "dev-tools" },
          article_preview: {
            lede: "Lead paragraph.",
            why_it_matters: "Why it matters paragraph."
          }
        }
      }),
      "utf8"
    );

    await recordHelperWalletSession(
      {
        activeWalletAddress: "bc1qexpectedwallet",
        walletProviderReady: true,
        helperPath: "/tools/xverse-register/file-signal.html"
      },
      tempDir
    );

    const preflight = await generateOperatorSignabilityPreflight(
      { reportDate: "2026-03-30", candidateId: "candidate-one" },
      tempDir
    );

    assert.equal(preflight.walletProviderReady, true);
    assert.equal(preflight.payloadIntegrityReady, true);
    assert.equal(preflight.requiredWalletAddress, "bc1qexpectedwallet");
    assert.equal(preflight.activeWalletAddress, "bc1qexpectedwallet");
    assert.deepEqual(preflight.allowedBeats, ["dev-tools"]);
    assert.deepEqual(preflight.blockedBeats, []);
    assert.ok(preflight.notes.some((line) => /Filing-ready artifact candidate-one passed local payload-shape validation/i.test(line)));

    const path = await saveOperatorSignabilityPreflight(preflight, tempDir);
    const saved = JSON.parse(await readFile(path, "utf8"));
    assert.equal(saved.kind, "operator_signability_preflight");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signing preflight blocks beats that fall outside the automated allowed-beat set", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-signing-preflight-"));

  try {
    await mkdir(resolve(tempDir, "docs"), { recursive: true });
    await mkdir(resolve(tempDir, "tools/xverse-register"), { recursive: true });
    await mkdir(resolve(tempDir, "src/filing"), { recursive: true });
    await mkdir(resolve(tempDir, "data/filing-ready/2026-03-30"), { recursive: true });

    await writeFile(
      resolve(tempDir, "docs/setup.md"),
      [
        "### Primary Bitcoin Address",
        "- `bc1qexpectedwallet`"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      resolve(tempDir, "docs/beat-strategy.md"),
      "Registered beat slug: `dev-tools`\n",
      "utf8"
    );
    await writeFile(resolve(tempDir, "tools/xverse-register/file-signal.html"), "<html></html>\n", "utf8");
    await writeFile(resolve(tempDir, "src/filing/helper-server.ts"), "export {};\n", "utf8");
    await writeFile(
      resolve(tempDir, "data/filing-ready/2026-03-30/candidate-two.json"),
      JSON.stringify({
        kind: "filing_ready_submission",
        reportDate: "2026-03-30",
        candidateId: "candidate-two",
        submission: {
          headline: "Deal flow signal",
          candidate_signal: { beat: "deal-flow" },
          article_preview: {
            lede: "Lead paragraph.",
            why_it_matters: "Why it matters paragraph."
          }
        }
      }),
      "utf8"
    );

    await recordHelperWalletSession(
      {
        activeWalletAddress: "bc1qexpectedwallet",
        walletProviderReady: true,
        helperPath: "/tools/xverse-register/file-signal.html"
      },
      tempDir
    );

    const preflight = await generateOperatorSignabilityPreflight(
      { reportDate: "2026-03-30", candidateId: "candidate-two" },
      tempDir
    );

    assert.equal(preflight.payloadIntegrityReady, true);
    assert.deepEqual(preflight.allowedBeats, ["dev-tools"]);
    assert.deepEqual(preflight.blockedBeats, ["deal-flow"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
