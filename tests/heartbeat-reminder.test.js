import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { generateHeartbeatReminder } from "../dist/ops/index.js";

const VALID_ADDRESS = "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv";

test("heartbeat reminder skips invalid bitcoin addresses without calling the endpoint", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-heartbeat-"));
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  try {
    process.chdir(tempDir);
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called for an invalid address");
    };

    const { report, state } = await generateHeartbeatReminder(
      " definitely-not-a-bitcoin-address ",
      "2026-04-06T00:00:00.000Z"
    );

    assert.equal(fetchCalled, false);
    assert.equal(report.status, "skipped");
    assert.equal(report.error, "invalid_address");
    assert.match(report.note, /does not look like a valid mainnet bitcoin address/i);
    assert.equal(report.reminderNeeded, false);
    assert.equal(state.lastCheckInCount, null);
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("heartbeat reminder converts endpoint 400 responses into skipped reports", { concurrency: false }, async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "aibtcagent-heartbeat-"));
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;

  try {
    process.chdir(tempDir);
    globalThis.fetch = async () => new Response("bad request", { status: 400 });

    const { report, state } = await generateHeartbeatReminder(
      VALID_ADDRESS,
      "2026-04-06T00:00:00.000Z"
    );

    assert.equal(report.status, "skipped");
    assert.equal(report.error, "endpoint_400");
    assert.match(report.note, /endpoint rejected the configured bitcoin address/i);
    assert.equal(report.address, VALID_ADDRESS);
    assert.equal(state.address, VALID_ADDRESS);
    assert.equal(report.reminderNeeded, false);
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
