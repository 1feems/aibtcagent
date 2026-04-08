import test from "node:test";
import assert from "node:assert/strict";
import { getPacificReportDate } from "../dist/utils/report-date.js";

test("report date maps post-midnight Asia time back to the prior Pacific editorial day", () => {
  assert.equal(getPacificReportDate("2026-04-04T00:30:00+07:00"), "2026-04-03");
});

test("report date flips at Pacific midnight during daylight saving time", () => {
  assert.equal(getPacificReportDate("2026-04-04T06:59:59Z"), "2026-04-03");
  assert.equal(getPacificReportDate("2026-04-04T07:00:00Z"), "2026-04-04");
});
