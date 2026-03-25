# AIBTC Agent

Private working repository for an AIBTC onchain signal agent focused on:
- early signal detection
- strict onchain proof
- one-line newsroom submissions
- leaderboard, reward, and reputation optimization

## Start Here Every Day
The first thing to open is:

- [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md)

Step 0 starts tomorrow and runs before any sourcing:

- `0a - Pull data`: review yesterday's filed signals, outcomes, sats, and leaderboard movement before making assumptions
- `0b - Analyze`: answer the seven root-cause questions so any approval, rejection, or duplicate loss is tied back to proof, timing, headline, beat fit, or gate failure
- `0c - Set strategy`: write four sentences for today's strategy before opening any source so sourcing is intentional rather than random

Daily report files that support Step 0:

- [`data/reports/daily/TEMPLATE.md`](./data/reports/daily/TEMPLATE.md): reusable daily operating template
- [`data/reports/daily/2026-03-25.md`](./data/reports/daily/2026-03-25.md): today's report, where Sections 1-4 should be filled tonight and Section 5 becomes tomorrow morning's Step `0c`

Use this doc map during operation:

- Before any work session: [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md) (Step `0`, then Steps `1-2`)
- Evaluating a candidate: [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md) (Steps `3-7`) + [`docs/first-live-signal.md`](./docs/first-live-signal.md)
- Filing: [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md) (Step `8`) + [`docs/live-ops-loop.md`](./docs/live-ops-loop.md)
- Something is wrong or unclear: [`docs/prd.md`](./docs/prd.md)
- Tracking outcomes: [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md) daily log + [`docs/outcome-schema.md`](./docs/outcome-schema.md)
- Iterating strategy: [`docs/learning-loop.md`](./docs/learning-loop.md) + [`docs/beat-strategy.md`](./docs/beat-strategy.md)

## Current Status
The repository is now in MVP implementation and verification.

MVP complete note:
- one lane works end to end
- daily reporting and optimization snapshots are active
- the next step is controlled live iteration, not broad new feature work

Core product docs are in place:
- [`docs/concept-note.md`](./docs/concept-note.md)
- [`docs/prd.md`](./docs/prd.md)
- [`docs/json-schema.md`](./docs/json-schema.md)
- [`docs/setup.md`](./docs/setup.md)
- [`docs/architecture.md`](./docs/architecture.md)
- [`docs/build-plan.md`](./docs/build-plan.md)
- [`docs/build-checklist.md`](./docs/build-checklist.md)
- [`docs/testing-plan.md`](./docs/testing-plan.md)
- [`docs/beat-strategy.md`](./docs/beat-strategy.md)
- [`docs/learning-loop.md`](./docs/learning-loop.md)
- [`docs/live-ops-loop.md`](./docs/live-ops-loop.md)
- [`docs/outcome-schema.md`](./docs/outcome-schema.md)
- [`docs/post-mvp-roadmap.md`](./docs/post-mvp-roadmap.md)
- [`docs/sources.md`](./docs/sources.md)
- [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md)

## Product Goal
Build an AIBTC agent that:
- detects non-obvious onchain events early
- verifies causality with public proof
- submits only newsroom-quality one-line signals
- learns from approvals, rewards, activity, and published briefs over time

## MVP Direction
The first build focuses on:
- one primary beat
- one strong signal lane
- strict validation and rejection logic
- submission-ready output packaging
- daily learning and reporting
- GitHub-hosted execution for the lowest-cost runtime path

## Repo Structure
```text
docs/    product, setup, architecture, strategy, and testing docs
data/    state, logs, outcomes, and experiments
src/     signal detection, validation, packaging, reporting, and optimization logic
tests/   node-based integration and behavior tests
```

The current implementation covers:
- one production-style `protocol-updates` lane
- strict validation and pre-submission gating
- filesystem-backed memory and outcome tracking
- daily reporting in markdown and JSON
- daily optimization snapshots and next-day recommendations

## Build Rule
Build the decision system first.

That means:
- proof first
- rejection first
- one lane before many lanes
- learn from outcomes before expanding scope
