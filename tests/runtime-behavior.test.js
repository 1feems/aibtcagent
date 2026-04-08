import test from "node:test";
import assert from "node:assert/strict";
import { shouldRunSecondSourcingPass } from "../dist/agent/run-daily.js";

test("runtime triggers a second sourcing pass when fewer than five signable candidates survive", () => {
  assert.equal(
    shouldRunSecondSourcingPass({
      kind: "filing_queue",
      reportDate: "2026-03-30",
      generatedAt: "2026-03-30T10:00:00Z",
      topCandidateId: "one",
      recommendationSummary: {
        targetRecommendations: 5,
        recommendedCount: 4,
        uniqueBeatCount: 4,
        beatsRepresented: ["a", "b", "c", "d"],
        quotaNotes: []
      },
      items: [
        { candidateId: "one", queueStatus: "awaiting_human_approval" },
        { candidateId: "two", queueStatus: "awaiting_human_approval" },
        { candidateId: "three", queueStatus: "awaiting_human_approval" },
        { candidateId: "four", queueStatus: "awaiting_human_approval" },
        { candidateId: "five", queueStatus: "on_hold" }
      ]
    }),
    true
  );
});

test("runtime skips the second sourcing pass when five signable candidates already exist", () => {
  assert.equal(
    shouldRunSecondSourcingPass({
      kind: "filing_queue",
      reportDate: "2026-03-30",
      generatedAt: "2026-03-30T10:00:00Z",
      topCandidateId: "one",
      recommendationSummary: {
        targetRecommendations: 5,
        recommendedCount: 5,
        uniqueBeatCount: 5,
        beatsRepresented: ["a", "b", "c", "d", "e"],
        quotaNotes: []
      },
      items: [
        { candidateId: "one", queueStatus: "awaiting_human_approval" },
        { candidateId: "two", queueStatus: "awaiting_human_approval" },
        { candidateId: "three", queueStatus: "awaiting_human_approval" },
        { candidateId: "four", queueStatus: "awaiting_human_approval" },
        { candidateId: "five", queueStatus: "awaiting_human_approval" }
      ]
    }),
    false
  );
});
