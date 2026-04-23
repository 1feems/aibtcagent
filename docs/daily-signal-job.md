# Daily Signal Job

## Document Role

- Category: `task contract`
- Scope: signal review and packaging after `AGENTS.md` context checks
- Use this when: the active step is turning prepared context into publishable signal packages
- Do not use this as: the filing contract or the only source of current implementation state

## Purpose
Use this doc after the `AGENTS.md` required-doc checks are complete.

This doc is for the signal review and packaging step after the live filing contract has been applied.

This is a separate task from the live source-review and beat-capacity checks.
It is expected to run at a different time.
It depends on current brief, publisher-feedback, helper-bug, source, and beat-editor context for the same active local cycle date.

This step should spend less time rebuilding context and more time selecting, validating, and packaging competitive signals that can earn sats, improve leaderboard position, and help Feems reach weekly top 3.

## Goal
Primary goal:

- win weekly leaderboard prizes

Secondary goals:

- maximize brief inclusion
- maximize sats earned
- improve leaderboard position
- preserve streak value

Weekly leaderboard prizes:

- `200,000 sats` for 1st
- `100,000 sats` for 2nd
- `50,000 sats` for 3rd

Brief economics:

- Brief Revenue Share: when a reader or agent pays `1,000 sats sBTC` to unlock a compiled brief, `70%` is split among all correspondents who filed signals that day
- Brief Inclusion Payout: each signal compiled into a published brief earns `30,000 sats sBTC`
- Up to `6` signals per day per correspondent means up to `180,000 sats/day`

## Job Contract
This signal job has a simple contract.

### Reads
The signal packaging step must read:

- `data/briefs/YYYY-MM-DD.md`
- prior-cycle `data/briefs/YYYY-MM-DD.md` when available
- `data/state/editorial-memory.json`
- `data/state/filed-signals.json`
- `memory/learnings.md`
- the deeper signal docs named later in this file

### Writes
The signal packaging step must write:

- `data/reports/signals/YYYY-MM-DD.md`

If that file does not exist yet, create it from:

- `data/reports/signals/TEMPLATE.md`

### Final Output
The final output must be:

- up to `6` signals
- human-readable first
- publish-ready
- saved to `data/reports/signals/YYYY-MM-DD.md`

Each signal includes:

- `Headline`
- `Body`
- `Sources`
- `Tags`

Do not return rough ideas.
Do not return alternates.
Do not return more than `6`.
Do not pad to `6`.
If the evidence only supports `1`, `2`, or `3` strong signals, return only those.

## Dependency Rule
This signal task depends on current `AGENTS.md` context checks.

Do not run the signal task unless these files already exist for the same active local cycle date:

- `data/briefs/YYYY-MM-DD.md`

If the brief file is missing, stop and add the brief artifact or use the live docs named in `AGENTS.md` before packaging.

## Read These First
Before doing signal work, read `AGENTS.md` and the live docs it names for the target beat.

Always use the files that match the active local cycle date for the current signal job.
Do not read an older date by default.
Use the same active local cycle date across all three files:

- `data/reports/daily/YYYY-MM-DD.md`
- `data/briefs/YYYY-MM-DD.md`
- `data/reports/signals/YYYY-MM-DD.md`

Read these in order:

1. `AGENTS.md`
   Use the live filing contract and required-doc list.

2. `data/briefs/YYYY-MM-DD.md`
   Use the archived actual brief for the active cycle.
   Do not default to an older brief date.

3. `data/briefs/YYYY-MM-DD.md` for the prior cycle
   Use the prior brief artifact if it exists.

4. `data/state/filed-signals.json`
   Use to avoid duplicate or already-filed angles and to see confirmed state.
   Use the current confirmed state.

5. `data/state/editorial-memory.json`
   Use the structured editorial brain generated from repeated `win:`, `loss:`, and `next:` lessons.
   Treat its `preFilingChecks` as explicit pass/fail checks before filing.

6. `memory/learnings.md`
   Use as the human-readable audit log behind editorial-memory, not as the only runtime memory.

Only after reading those daily output docs, read the deeper signal docs below.

## Then Read These Signal Docs

7. `docs/lean-signal-workflow.md`
   Use for low-token sourcing flow and fast-screen behavior.

8. `docs/signal-sourcing-checklist.md`
   Use for daily sourcing rules, competitive beat mapping, filing format, and qualification.

9. `docs/first-live-signal.md`
   Use as the final quality gate before treating a candidate as ready.

10. `docs/brief-winner-tracking.md`
   Use for repeat winners and same-day multi-win behavior.

11. `data/reports/competitor-review/YYYY-MM-DD.md`
   Use for current competitor patterns.

12. `data/reports/strategy/YYYY-MM-DD.json`
    Use for strategy behavior and current winning-shape guidance.

13. `data/state/top_5_competitor_styles.json`
    Use for compact top-5 style memory.

14. `docs/beat-editors/quantum-zen-rocket.md` — **active beat editor guidance for quantum**
    This is the only editorial authority for quantum beat drafting and review.
    Do not apply legacy publisher Q1–Q4 guardrails.

## What To Use From AGENTS.md Context
Extract these checks from `AGENTS.md` and the required live docs before sourcing:

- beat capacity
- publisher feedback
- homepage brief winners
- daily brief source comparison
- target beat editor standards
- source tier rules
- helper bug patterns

Use `AGENTS.md` as the main operating handoff.
Do not invent a separate prep loop.
Treat the required-doc list as the strategy source of truth for the signal job, not as a suggestion.

## What The Signal Packaging Step Must Do

1. Read `AGENTS.md`, publisher feedback, helper bugs, target beat guidance, and brief artifacts first.
2. Treat today's brief as the editorial template for headline shape, body shape, and consequence framing before drafting anything new.
3. Use the `AGENTS.md` required-doc list as the starting strategy and strategy source of truth.
4. Read `data/state/editorial-memory.json` before drafting and use its `preFilingChecks` as hard pass/fail rules.
5. Recheck any unresolved items from the `Pending watchlist` before sourcing fresh ideas, and state whether any of them changed the final 6.
6. Use the brief comparison, top-6 pressure, and repeat-winner pressure to cut weak candidates before drafting.
7. Read and use publisher feedback, brief snapshots, and daily source comparison as separate selection filters.
8. Use today's updated `memory/learnings.md` and today's updated `data/state/filed-signals.json` as live state inputs for the signal job.
9. Use the deeper signal docs only for qualification and competitive sharpening.
10. Prefer candidates with the best brief-win, payout, and weekly-prize-upside profile.
11. Produce only strong, human-readable, publish-ready signals.
12. Reject any candidate that already appears in today's brief artifact. A winner already printed in `data/briefs/YYYY-MM-DD.md` is not a fresh filing candidate.
13. If fewer than the target number of sure-winner candidates survive, explicitly say so and keep sourcing instead of padding the list with approval-quality candidates.
14. For rejected signals, read the publisher feedback and treat it as the operating instruction for what to do next.
15. Default rule for rejected signals: keep them active as repair-and-resubmit candidates unless the publisher feedback clearly says not to resubmit.
16. Rewrite only the parts the publisher flagged: beat, evidence, headline packaging, or angle.

Do not waste time rebuilding context that already exists in `AGENTS.md` required docs.
Do not hand-draft helper payloads when the repo already has a runtime path that can validate and package them.

## Output File
Write the signal output to:

- `data/reports/signals/YYYY-MM-DD.md`

If it does not exist yet, create it from:

- `data/reports/signals/TEMPLATE.md`

Do not only show the signals in chat.
Also save the completed signal output into:

- `data/reports/signals/YYYY-MM-DD.md`

## Signal Output Format
Signals must be human-readable first.

The human-readable version is the working output for Feems to review.
Helper-ready payload generation happens later through the repo runtime, not by hand in chat.

Each signal includes:

- `Headline`
- `Body`
- `Sources`
- `Tags`

### Body rule — CLAIM / EVIDENCE / IMPLICATION (mandatory)
Every `Body` field must follow this exact three-move structure with labeled sections:

```
Claim: [one precise sentence — what happened or changed, with exact anchor]
Evidence: [verifiable source — PR #, CVE, paper, post, or on-chain tx]
Implication: [concrete impact on agents, funds, or the protocol — quantified where possible]
```

This structure is especially required for infrastructure patches and security signals.

**Anti-fluff rule:** Never describe a metric changing without stating the magnitude.
- BAD: "A bug caused issues." → GOOD: "Claim: A routing bug left 200 correspondents with 22.34M Sats unrouted."
- BAD: "Quantum is getting faster." → GOOD: "Claim: Google's Willow chip achieved a 20-fold reduction in error rate (Nature, Dec 2024)."

A body that states a fact without evidence, or evidence without an implication, is incomplete and must not be filed.

Default target:

- produce up to `6` signals
- show only the strongest publish-ready signals that survive the gates
- do not show rough ideas, backups, alternates, or half-ready candidates unless Feems explicitly asks

Publish-ready means:

- strong enough to plausibly compete for brief inclusion
- written clearly enough for immediate human review
- complete in the required format
- grounded in `AGENTS.md` required docs and signal docs
- not already present in today's brief artifact
- better than merely approval-worthy; winner-tier is the default bar
- able to be converted into a helper-ready payload without rewriting the core claim

## Competitive Rules

- optimize for `In Brief`, not just approval
- optimize for payout and weekly leaderboard prizes, not just acceptable filing volume
- use the `AGENTS.md` decision model before exploring new angles
- use `earned`, `score`, and `rank` together when judging competitive pressure
- compare Feems's current gap versus the current top 3 before selecting the final 6
- study what the top earners posted most and what actually got them paid, not just who ranked high
- treat `Published`, `Approved not in brief`, and `Why approved-not-in-brief lost` as separate filters
- demote signal shapes that already produced `approved_not_in_brief` outcomes unless the new angle is clearly broader or stronger
- prioritize highest brief-win and weekly-prize upside over beat diversity
- check who won multiple slots in the active brief and the prior brief
- avoid beats already owned by repeat winners unless the story is clearly broader or stronger
- demote beats already dominated by stronger repeat winners unless the candidate is clearly better, broader, or more monetizable
- auto-reject any story already visible in today's brief; do not recycle printed winners into the filing slate
- avoid narrow changelog fragments unless they can be bundled into a stronger beat story
- prefer stories with direct operator consequence, clear proof, and current payout relevance
- optimize for weekly leaderboard prizes, not just acceptable daily output
- favor publication odds and payout relevance over approval odds alone
- the final 6 must be the 6 strongest publish-ready signals for weekly-prize upside, not just 6 acceptable signals
- if the evidence only supports 2 or 3 true winner-tier signals, do not label weaker candidates as "for sure winners" just to hit the count

For each chosen signal, explicitly say:

- why it was chosen relative to weekly leaderboard prize odds
- what it is trying to beat:
  - crowded beat
  - repeat winner
  - prior losing shape

## Handoff Rule
At the top of the signal output, state:

- which `AGENTS.md` context checks were used
- which brief artifact was used
- which prior-brief artifact or proxy was used
- whether any pending items were rechecked before sourcing

## One-Line Summary
Read `AGENTS.md` and its required docs first.
Use them as the handoff.
Then spend time on competitive signals, not context recovery.
