import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { evaluateSignalGuard } from "../dist/filing/index.js";

const REPO_ROOT = resolve("/Users/feems/Desktop/aibtcagent-workspace/aibtcagent");

async function copyRepoFile(repoRelativePath, tempDir) {
  const sourcePath = resolve(REPO_ROOT, repoRelativePath);
  const targetPath = resolve(tempDir, repoRelativePath);
  await mkdir(resolve(targetPath, ".."), { recursive: true });
  await writeFile(targetPath, await readFile(sourcePath, "utf8"), "utf8");
  return targetPath;
}

test("real April 3 winner-style signal clears the guard in isolated context", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-editorial-regression-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-03",
      headline: "Stacks Core 3.3.0.0.6 cuts chainstate growth by 20%+ and enables signer global state for block production",
      beat_slug: "governance",
      body: "Stacks Core 3.3.0.0.6 reduces chainstate growth by more than 20% and enables signer global state for block production. For AIBTC operators running AI-agent infrastructure on Stacks, this means lower storage pressure and more reliable signer coordination during production load, which changes how operators plan node capacity and block production risk.",
      sources: [
        { url: "https://docs.stacks.co/whats-new/latest-updates", title: "Stacks latest updates" },
        { url: "https://www.npmjs.com/package/@stacks/transactions", title: "Independent external verifier" }
      ],
      model_disclosure: {
        tools_used: ["claude-opus-4"],
        derivation_steps: ["review of Stacks update notes and independent package reference to frame operator consequence"]
      }
    }, tempDir);

    assert.equal(result.ok, true);
    assert.equal(result.checks.missionAlignment, "pass");
    assert.equal(result.checks.valueCreating, "pass");
    assert.equal(result.checks.winnerBar, "pass");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("real April 3 filed signal is rejected at the duplicate-first gate", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-editorial-regression-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await mkdir(resolve(tempDir, "data/briefs"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");
    await copyRepoFile("data/briefs/2026-04-03.md", tempDir);
    await copyRepoFile("data/state/filed-signals.json", tempDir);

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-03",
      headline: "Stacks API adds PoX Bitcoin tx endpoints, giving apps indexable burn-chain activity without raw block scans",
      beat_slug: "governance",
      body: "The February 26, 2026 Stacks API update adds PoX-related Bitcoin transaction endpoints for both burn blocks and Bitcoin addresses. Builders can query indexed Bitcoin-layer PoX activity directly instead of scanning raw blocks.",
      sources: [
        { url: "https://docs.stacks.co/whats-new/latest-updates", title: "Stacks latest updates" },
        { url: "https://api.hiro.so/extended/v2/burn-blocks/938020/pox-transactions", title: "Hiro PoX endpoint example" }
      ],
      model_disclosure: {
        tools_used: ["claude-opus-4"],
        derivation_steps: ["review of Stacks update notes and Hiro endpoint example"]
      }
    }, tempDir);

    assert.equal(result.ok, false);
    assert.match(result.blockers[0], /already present|already-filed/i);
    assert.equal(result.checks.directOperatorConsequence, "skipped_due_to_duplicate");
    assert.equal(result.checks.winnerBar, "skipped_due_to_duplicate");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("real April 3 repaired x402 relay candidate still fails current Q4 and winner-bar guard", { concurrency: false }, async () => {
  const payload = JSON.parse(
    await readFile(resolve(REPO_ROOT, "data/manual-submissions/2026-04-03/x402-relay-v1.27.1-auth-type-fix.json"), "utf8")
  );
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-editorial-regression-"));

  try {
    await mkdir(resolve(tempDir, "data/state"), { recursive: true });
    await writeFile(resolve(tempDir, "data/state/editorial-memory.json"), JSON.stringify({ generatedAt: "test" }), "utf8");
    await writeFile(resolve(tempDir, "data/state/repairable-candidates.json"), JSON.stringify({ contracts: [] }), "utf8");

    const result = await evaluateSignalGuard({
      reportDate: "2026-04-03",
      headline: payload.headline,
      beat_slug: payload.beat_slug,
      body: payload.analysis,
      sources: payload.sources.map((url) => ({ url, title: url })),
      model_disclosure: {
        tools_used: [],
        derivation_steps: [payload.disclosure]
      }
    }, tempDir);

    assert.equal(result.ok, false);
    assert.ok(
      result.blockers.some((line) => /Fails publisher Q4 value-creating test/i.test(line))
    );
    assert.ok(
      result.blockers.some((line) => /Does not clear winner bar/i.test(line))
    );
    assert.equal(result.checks.valueCreating, "reject");
    assert.equal(result.checks.winnerBar, "reject");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
