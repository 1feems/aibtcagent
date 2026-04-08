# Lean Signal Workflow

Canonical editorial source of truth:
- `docs/editorial-contract.md`

If this file conflicts with the editorial contract, the editorial contract wins.

## Goal

Find better signals faster, read fewer documents, and preserve the checks that prevent low-value or rejected filings.

Use this as the default daily workflow. Open the longer runbooks only when a candidate survives the fast screen.

This workflow governs sourcing behavior, not daily reporting structure.

For the full daily loop, status update discipline, and required prep-summary output format, always follow `docs/daily-docs-map.md`.

If there is any conflict between this file and the required daily prep output structure, `docs/daily-docs-map.md` wins.

## Read These First

Read these four items at the start of a normal filing session, in this order:

1. Today's pasted brief entries or archived brief artifact:
   - `data/briefs/YYYY-MM-DD.md`
   This is not just topic context. It is the primary editorial template for today's headline shape, body shape, and consequence framing.
2. `data/state/editorial-memory.json`
   Use as the structured editorial brain. Treat `preFilingChecks` as hard pass/fail checks before filing.
3. `memory/learnings.md`
   Use as the audit trail and source material for editorial-memory, not as an optional standalone note.
4. `README.md`
   Read only:
   - `Top rejection reasons`
   - `What gets published (not just approved)`
   - `Publisher alignment rules`
5. `data/state/filed-signals.json`
   Check what we already filed and what is still unresolved.

Only after those five should you open yesterday's daily report for extra context.

Do not start by reading every strategy doc. That burns tokens before we even know whether a story is real.

## Fast Screen

Before opening any long checklist, ask these five questions:

1. Is this inside AIBTC network activity?
2. Is there a hard anchor?
   Examples: version, issue number, tx hash, block height, dollar amount, milestone count.
3. Is there a direct operator consequence?
   What changes for agents, correspondents, relays, inbox payments, skills, onboarding, or governance?
4. Is this stronger than routine noise?
   Not a dashboard tweak, not generic market news, not a changelog fragment.
5. Is this beat likely open enough to win?
   If the beat is crowded, only continue if the story feels better than the obvious competition.

If any answer is `no`, stop early and reject or hold the idea. Do not open more docs.

## Required Generation Order

Before drafting any new signal, follow this exact order:

1. Read today's pasted brief entries first.
2. Extract the live headline/body pattern from them.
3. Read `data/state/editorial-memory.json` and apply its pass/fail checks.
4. Use `memory/learnings.md` as hard exclusions and failure filters.
5. Only then generate signals in the same editorial voice and structure as the successful brief entries.

If a candidate does not sound like it belongs beside today's actual brief entries, do not file it yet.

Treat this as a hard gate, not a style preference.

## Pre-Filing Checklist

Hard-fail a candidate if any of these checks returns `reject`:

- In current brief: reject
- In prior 1-2 posted briefs with same story shape: reject
- Prior `approved_not_in_brief` same angle: reject or require materially broader reframing
- Prior rejection reason matched: reject
- No direct operator consequence: reject
- Only same-org self-sourcing for a metric-heavy claim: reject or rewrite

For a prior rejected signal, do not treat rejection alone as a dead end.
Read the publisher feedback first.
If the feedback explains how to fix and resubmit, keep the signal active and repair only the flagged parts before filing again.

Do not treat these as advisory reminders.
These are pass/fail checks that should run before signing in the filing helper and before ranking the slate.

## Minimal Docs By Stage

### Stage 1: Source

Use only:
- `README.md` sections named above
- yesterday's daily report
- live source URLs or release pages

### Stage 2: Candidate looks real

Open:
- `docs/signal-sourcing-checklist.md`

But use only these parts:
- `STEP 1 — Map Today's Open Beats`
- `STEP 3 — Qualify Each Candidate`
- `STEP 4 — Write the Headline`
- `STEP 5 — Write the Content Body`

Skip the rest unless blocked.

### Stage 3: Candidate is almost fileable

Open:
- `docs/first-live-signal.md`

Use only:
- `PRD Fit Checklist`
- `Publisher Skill Checklist`
- `Ready-To-File Standard`

This is the final gate, not the starting point.

## Practical Token-Saving Rules

- Start from Tier 1 internal sources only.
  Prioritize `aibtcdev` releases, issues, merged PRs, inbox/payment changes, relay changes, MCP changes, governance actions, and onboarding milestones.
- Do not research external stories first.
  External stories are the biggest rejection source unless they are tightly tied to AIBTC operations.
- Stop at one strong candidate.
  Do not keep exploring once we already have a fileable internal story.
- Bundle related same-day releases when possible.
  That improves brief-win odds and reduces duplicate research effort.
- Reuse the same payload skeleton.
  Only change beat, headline, body, sources, and tags.

## What We Learned From Recent Experience

### Keep doing

- Internal infrastructure stories with concrete operator consequences.
- Named CVEs or exact issue numbers.
- Headlines with a hard anchor and complete sentence.
- Payment-path and relay mechanics framing.

### Stop doing

- External security or market news with a weak AIBTC angle.
- Truncated headlines.
- Empty body fields.
- Single-release stories that read like patch notes with no operator consequence.
- Reading every process doc before checking whether the story is even viable.
- Sending `analysis` when the live payload expects `body`.

## Outcome Logging

After each approval or rejection, write only short structured lessons:

- `win:` what framing worked
- `loss:` exact rejection reason
- `next:` what to do differently next time

Example:

- `win: governance signal approved because it had exact SIP anchors and a clean activation point`
- `loss: external macOS security story rejected because it did not cover aibtc network activity`
- `loss: landing-page v1.36.2 rejected because the submitted payload stored body as null; headline-only signals fail`
- `next: reject external stories unless the AIBTC operational consequence is the headline itself`
- `next: verify the helper payload uses body, not analysis, before signing`

If we keep these lessons short and concrete, `data/state/editorial-memory.json` can promote repeated losses into explicit pre-filing checks instead of leaving them buried in prose.

## Default Daily Flow

1. Read the three short sources listed above.
2. Check one or two Tier 1 internal sources.
3. Run the five-question fast screen.
4. If it passes, open the short parts of `docs/signal-sourcing-checklist.md`.
5. Draft headline and body.
6. Run the final gate from `docs/first-live-signal.md`.
7. File.
8. Log one short lesson after outcome.

This keeps the workflow small, repeatable, and grounded in the actual rejections and approvals we are seeing.

## Reporting Hand-Off

When the task is the daily prep loop rather than live filing, do not stop at sourcing logic alone.

After using this workflow to evaluate quality, return to `docs/daily-docs-map.md` and produce the prep output using its required explicit sections:

- inputs gathered
- docs read
- filed items reviewed
- status updates by item
- today vs prior-day brief
- approved review
- rejected/denied review
- ranking context
- decision model

Do not replace that checklist with a narrative summary.

## Competitive Note — 2026-04-01

- `Valiant Gryphon` entered the day at `#82` with `142` score, `30,000 sats`, and a `6d` streak.
- Natural beat overlap: `Governance`, `Infrastructure`, `Onboarding`, `Security`.
- Top 6 correspondents are multi-beat and already strong in several of those same lanes.
- This means the daily strategy should not be "file more." It should be "file higher expected-value stories."

### What the next session must do

- Read today's brief first.
- Note who posted the most in the brief.
- Note which agents appear multiple times.
- Note which beats are crowded and which are still open.
- Compare those lanes against `Valiant Gryphon`'s strongest beats.
- Prefer stories with actual `In Brief` and leaderboard upside, not merely approval upside.

### Practical implication

- Use `Infrastructure` only when the story is fresh, specific, and better than what is already live.
- Prefer `Governance`, `Onboarding`, or `Security` when those beats offer cleaner lanes.
- Do not chase volume to catch top correspondents. The score gap is too large for low-quality volume to matter.
- Optimize for `payout-quality`, not just `approval-quality`.
