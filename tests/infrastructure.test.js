import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInfrastructureLane, confirmPrimaryLane } from "../dist/signals/index.js";
import { validateSubject } from "../dist/validation/index.js";

async function readFixture() {
  const fixturePath = resolve(process.cwd(), "data/fixtures/protocol-update-raw.json");
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("infrastructure is confirmed as the primary lane", () => {
  assert.equal(confirmPrimaryLane(), "infrastructure");
});

test("infrastructure lane normalizes raw input into a candidate signal", async () => {
  const raw = await readFixture();
  const { subject } = runInfrastructureLane(raw);

  assert.equal(subject.candidate.beat, "infrastructure");
  assert.equal(subject.candidate.category, "protocol-change");
  assert.equal(subject.candidate.causality.length > 0, true);
});

test("infrastructure lane preserves duplicate and dashboard flags from raw input", async () => {
  const raw = await readFixture();
  raw.usesDashboardAsPrimarySource = true;
  raw.likelyDuplicate = true;
  const { subject } = runInfrastructureLane(raw);

  assert.equal(subject.candidate.usesDashboardAsPrimarySource, true);
  assert.equal(subject.candidate.likelyDuplicate, true);
});

test("infrastructure lane attaches proof and sources", async () => {
  const raw = await readFixture();
  const { subject } = runInfrastructureLane(raw);

  assert.equal(subject.proof.length > 0, true);
  assert.equal(subject.proof[0].txHash, raw.firstInteractionTxHash);
  assert.equal(subject.sources.length >= 2, true);
});

test("infrastructure lane supports versioned release candidates", () => {
  const raw = {
    id: "protocol-update-release-001",
    detectedAt: "2026-03-25T18:00:00Z",
    chain: "github",
    summary: "x402 relay v1.22.0 doubles sponsor wallet pool to 10 wallets",
    significance: "agents get 2x concurrent payment capacity from a versioned relay release",
    causalTrigger:
      "the relay was hitting nonce contention at 5 wallets under concurrent agent load",
    usesDashboardAsPrimarySource: false,
    likelyDuplicate: false,
    versionNumber: "x402-sponsor-relay-v1.22.0",
    releaseDate: "2026-03-24T19:12:39Z",
    changelogEntry: "increase sponsor wallet pool from 5 to 10",
    sourceUrls: {
      release:
        "https://github.com/aibtcdev/x402-sponsor-relay/releases/tag/x402-sponsor-relay-v1.22.0",
      compare:
        "https://github.com/aibtcdev/x402-sponsor-relay/compare/x402-sponsor-relay-v1.21.1...x402-sponsor-relay-v1.22.0"
    }
  };

  const { subject } = runInfrastructureLane(raw);

  assert.equal(subject.candidate.beat, "infrastructure");
  assert.equal(subject.proof[0].txHash, null);
  assert.equal(subject.proof[0].contractAddress, "x402-sponsor-relay-v1.22.0");
  assert.equal(subject.proof[0].queryName, "protocol-update-versioned-release");
  assert.equal(subject.sources[0].sourceUrl, raw.sourceUrls.release);
});

test("infrastructure lane produces a validation-ready signal", async () => {
  const raw = await readFixture();
  const { subject } = runInfrastructureLane(raw);
  const result = validateSubject(subject);

  assert.equal(result.passed, true);
});

test("infrastructure lane fails validation when raw event is marked duplicate", async () => {
  const raw = await readFixture();
  raw.likelyDuplicate = true;
  const { subject } = runInfrastructureLane(raw);
  const result = validateSubject(subject);

  assert.equal(result.passed, false);
  assert.equal(result.checks.duplicateRejected, false);
});
