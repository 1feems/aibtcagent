# AIBTC Agent

Private working repository for an AIBTC onchain signal agent focused on:
- early signal detection
- strict onchain proof
- one-line newsroom submissions
- leaderboard, reward, and reputation optimization

## Current Status
The repository is now in MVP implementation and verification.

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
- [`docs/outcome-schema.md`](./docs/outcome-schema.md)
- [`docs/sources.md`](./docs/sources.md)

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
