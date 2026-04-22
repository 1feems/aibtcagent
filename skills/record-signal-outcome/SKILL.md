---
name: record-signal-outcome
description: "Use this skill when the user wants to record what happened to a filed AIBTC signal: approval, rejection, brief inclusion, cap pressure, pending status, payout, or publisher feedback. Use it even if they ask to mark, update, normalize, or preserve a result rather than saying 'record outcome.' Do not use it to draft new signals or to analyze patterns across multiple outcomes."
metadata:
  author: "OpenAI"
  user-invocable: "true"
  entry: "record-signal-outcome/SKILL.md"
  tags: "aibtc, signals, outcomes, learning"
---

# Record Signal Outcome

## Skill Role

- Category: `signal skill`
- Scope: record one real filed signal outcome and refresh learning
- Use this when: the task is about one real filed signal result
- Current implementation reference: `docs/build-plan.md`

Use this skill when a signal outcome becomes known and the repo must preserve it for learning.

Examples:
- "mark this signal approved"
- "record this rejection"
- "this one made the brief"
- "add the publisher feedback"
- "update the signal history"

## Goal

Close the feedback loop so every outcome feeds the next signal.

This skill records real filed-signal outcomes only. Drafts, candidates, queue rows, and filing-ready artifacts without a real signal ID must not be written to outcome history.

## Local Architecture Override — 2026-04-15

- canonical filed-signal ledger: `data/state/signal-history.json`
- canonical outcome writer in repo code: `src/filing/signal-history.ts`
- compatibility mirrors: `data/state/filed-signals.json`, `data/outcomes/approvals/*.json`
- learning refresh path: `npm run daily-learn`

When possible, update the canonical ledger first, then maintain compatibility mirrors if the current repo path still expects them. Never describe `filed-signals.json` as the source of truth when `signal-history.json` exists.

This skill has three mandatory effects: canonical outcome state updated, a concise learnings.md entry added when there is a new lesson, and a daily-learn run. Recording without running daily-learn leaves editorial memory stale.

Before trusting any older outcome instructions in this skill, refer to `docs/build-plan.md` to see what exists now and which ledgers are still canonical.

## Load First

Always read:

- `docs/document-map.md`
- `docs/workflow.md`
- `docs/build-plan.md`
- `docs/in-brief-success-checklist.md`
- `data/state/signal-history.json` (canonical filed-signal ledger)
- `data/state/filed-signals.json` (compatibility mirror)
- `data/state/editorial-memory.json`
- latest dated brief artifact in `data/briefs/` (`.md` or `.json`, whichever is current for the cycle)
- `data/outcomes/approvals/` (scan existing files to understand the outcome pattern)

## Step 1 — Update canonical signal history

In `data/state/signal-history.json`, update the real filed signal entry:

- match by `signalId` first
- if the signal ID is unknown, search by exact filed headline, beat, and filing timestamp
- set `outcome`: `"brief_included"`, `"approved"`, `"rejected"`, `"cap_blocked"`, `"pending"`, or `"unknown"`
- set `resolvedAt` when the outcome is known
- preserve publisher feedback in `note`
- preserve feedback labels when known
- set `satsEarned` for brief-included payouts when known

Do not add rows with missing/null `signalId` or missing/null `filedAt`. `signal-history.json` is for real filed signals only.

## Step 2 — Write the compatibility outcome JSON

Write a file to `data/outcomes/approvals/<signalId>.json` using this exact schema:

```json
{
  "kind": "approval_outcome",
  "recordedAt": "<ISO timestamp>",
  "signalId": "<signal ID from filing>",
  "candidateId": "<candidateId or null>",
  "approved": <true|false>,
  "published": <true|false>,
  "success": <true if brief_included, false otherwise>,
  "failureMode": <"not_in_brief" | "rejected" | "pending" | "unknown" | null>,
  "status": <"approved" | "rejected" | "submitted" | "unknown">,
  "note": "<publisher note verbatim, or null>",
  "learningWhy": "<one sentence: what specifically caused this outcome>"
}
```

Outcome mapping:
- brief_included → `approved: true, published: true, success: true, failureMode: null`
- approved but not in brief → `approved: true, published: false, success: false, failureMode: "not_in_brief"`
- rejected → `approved: false, published: false, success: false, failureMode: "rejected"`
- cap_blocked → `approved: true, published: false, success: false, failureMode: "not_in_brief"` + note cap reason
- pending → `approved: false, published: false, success: false, failureMode: "pending"`
- unknown → `approved: false, published: false, success: false, failureMode: "unknown"`

Keep the publisher's wording in `note` verbatim. Do not paraphrase.

## Step 3 — Write a learnings.md entry

Append to `memory/learnings.md` under the relevant `##` section using `- ` bullet point format. **Lines without a `- ` prefix are invisible to the parser and will never be read.**

For a win (brief_included):
```
- win: [what specifically worked — headline structure, beat choice, evidence type, anchor in headline]
```

For a loss (rejected or approved-not-in-brief):
```
- loss: [what specifically failed — headline truncated, missing evidence anchor, duplicate story shape, beat cap, etc.]
- next: [smallest concrete repair — add PR number to headline, pick a less crowded beat, add timestamped evidence]
```

For a bug in the workflow (wrong field, payload error, tooling failure):
```
- bug: [exactly what broke — field name, payload contract violation, tool error message]
```

Rules:
- One to two sentences max per entry.
- Must be specific enough that `editorial-memory.ts` can pattern-match it.
- Do not write vague entries like "improve quality" or "be more specific".
- Trigger keywords that the learning system regex-matches: `headline`, `truncated`, `evidence`, `timestamp`, `anchor`, `duplicate`, `payload`, `disclosure`, `beat`, `publisher feedback`, `repair`, `resubmit`, `metric`, `verifiable`, `analysis`.
- If the section does not exist in `learnings.md`, add it as `## Outcomes` before the bullet.

## Step 4 — Run daily-learn to refresh editorial memory

After writing the outcome JSON and the learnings.md entry, run:

```bash
npm run daily-learn
```

This command:
- Re-reads all `data/outcomes/approvals/*.json` files
- Promotes repeated patterns into `preFilingChecks` in `editorial-memory.json`
- Syncs the promoted checks back into `memory/learnings.md`
- Refreshes `outcome-feedback-memory.json`
- Rebuilds competition memory

Do not skip this step. Without it, the editorial memory stays stale and the next signal is drafted against an outdated model.

## Step 5 — Update filed-signals.json compatibility mirror

If older repo paths still read `data/state/filed-signals.json`, mirror the outcome there:

- Set `resolved: true`
- Add `outcome` field: `"brief_included"`, `"approved"`, `"rejected"`, `"cap_blocked"`, `"pending"`, or `"unknown"`
- Add `resolvedAt` timestamp

## Gotchas

- Only write to `data/outcomes/approvals/` for real filed signals. Never write candidate placeholders.
- If the signal ID is unknown, search `signal-history.json` first by headline and beat, then use `filed-signals.json` only as a compatibility fallback.
- If the outcome is genuinely ambiguous, record `unknown` with the full context note.
- If a rejection says "repair and resubmit", record `failureMode: "rejected"` and write `next:` in learnings.md.
- `daily-learn` must succeed. If it fails due to a build error, check `src/` for type errors first.

## Output Contract

Return to the user:

- Signal ID matched
- Outcome written to `data/outcomes/approvals/<signalId>.json`
- Learnings.md entry added
- daily-learn result (success or error)
- What changed in editorial-memory.json preFilingChecks (if anything new was promoted)

## References

- `docs/document-map.md`
- `docs/workflow.md`
- `docs/build-plan.md`
- `src/learning/outcome-feedback.ts` — inferFeedbackLabels logic and label definitions
- `src/filing/signal-history.ts` — canonical filed-signal ledger
- `src/learning/editorial-memory.ts` — REPEATED_RULES and promotion threshold (triggerCount >= 2)
- `src/loop/daily-learn.ts` — what daily-learn actually runs
- `src/outcomes/checker.ts` — outcome checking logic
