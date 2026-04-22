import test from "node:test";
import assert from "node:assert/strict";
import { getPacificReportDate } from "../dist/utils/report-date.js";

test("report date maps from timezone-specific input onto the UTC calendar day", () => {
  assert.equal(getPacificReportDate("2026-04-04T00:30:00+07:00"), "2026-04-03");
});

test("report date no longer applies a Pacific rollover", () => {
  assert.equal(getPacificReportDate("2026-04-04T06:59:59Z"), "2026-04-04");
  assert.equal(getPacificReportDate("2026-04-04T07:00:00Z"), "2026-04-04");
});
