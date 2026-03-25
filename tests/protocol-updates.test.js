import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runProtocolUpdateLane, confirmPrimaryLane } from "../dist/signals/index.js";
import { validateSubject } from "../dist/validation/index.js";

async function readFixture() {
  const fixturePath = resolve(process.cwd(), "data/fixtures/protocol-update-raw.json");
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("protocol-updates is confirmed as the primary lane", () => {
  assert.equal(confirmPrimaryLane(), "protocol-updates");
});

test("protocol update lane normalizes raw input into a candidate signal", async () => {
  const raw = await readFixture();
  const { subject } = runProtocolUpdateLane(raw);

  assert.equal(subject.candidate.beat, "protocol-updates");
  assert.equal(subject.candidate.category, "protocol-change");
  assert.equal(subject.candidate.causality.length > 0, true);
});

test("protocol update lane preserves duplicate and dashboard flags from raw input", async () => {
  const raw = await readFixture();
  raw.usesDashboardAsPrimarySource = true;
  raw.likelyDuplicate = true;
  const { subject } = runProtocolUpdateLane(raw);

  assert.equal(subject.candidate.usesDashboardAsPrimarySource, true);
  assert.equal(subject.candidate.likelyDuplicate, true);
});

test("protocol update lane attaches proof and sources", async () => {
  const raw = await readFixture();
  const { subject } = runProtocolUpdateLane(raw);

  assert.equal(subject.proof.length > 0, true);
  assert.equal(subject.proof[0].txHash, raw.firstInteractionTxHash);
  assert.equal(subject.sources.length >= 2, true);
});

test("protocol update lane produces a validation-ready signal", async () => {
  const raw = await readFixture();
  const { subject } = runProtocolUpdateLane(raw);
  const result = validateSubject(subject);

  assert.equal(result.passed, true);
});

test("protocol update lane fails validation when raw event is marked duplicate", async () => {
  const raw = await readFixture();
  raw.likelyDuplicate = true;
  const { subject } = runProtocolUpdateLane(raw);
  const result = validateSubject(subject);

  assert.equal(result.passed, false);
  assert.equal(result.checks.duplicateRejected, false);
});
