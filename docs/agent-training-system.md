# Agent Training System

## What "Training" Means In This Repo

This repo does **not** retrain model weights.

Instead, it trains the agent operationally by giving the runtime durable memory and decision rules:

- labeled examples in `data/training/*.jsonl`
- live outcomes in `data/outcomes/`
- candidate and rejection logs in `data/logs/`
- optimization snapshots in `data/experiments/optimization/`
- daily reports in `data/reports/daily/`

That means the agent can improve from repo state without the operator re-explaining the same lesson in chat every day.

## The Learning Stack

### 1. Rules

These are the durable editorial and quality rules:

- [`docs/rejection-rules.md`](./rejection-rules.md)
- [`docs/brief-win-rules.md`](./brief-win-rules.md)
- [`docs/brief-winner-tracking.md`](./brief-winner-tracking.md)
- [`docs/signal-sourcing-checklist.md`](./signal-sourcing-checklist.md)

### 2. Labeled Training Memory

These files teach the agent what good and bad examples look like:

- [`data/training/in-brief.jsonl`](../data/training/in-brief.jsonl)
- [`data/training/approved-not-in-brief.jsonl`](../data/training/approved-not-in-brief.jsonl)
- [`data/training/rejected.jsonl`](../data/training/rejected.jsonl)

The runtime now reads this memory and uses it for:

- winner tag priors
- rejection tag priors
- fallback headline-pattern guidance when live same-day outcomes are sparse

### 3. Live Outcome Memory

These files teach the agent what actually happened:

- `data/state/filed-signals.json`
- `data/outcomes/approvals/*.json`
- `data/outcomes/rewards/*.json`
- `data/logs/rejections/*.json`
- `data/logs/accepted/*.json`
- `data/logs/candidates/*.json`

Important distinction:

- `approved` means editorial review passed
- `published` means it actually won `In Brief`

The optimization loop now treats `published` as the stronger signal.

### 4. Optimization Layer

The agent converts memory into strategy via:

- [`src/loop/optimization.ts`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/src/loop/optimization.ts)
- [`src/loop/optimization.ts`](../src/loop/optimization.ts)

It now learns:

- which beats produce published wins
- when approvals are not converting into brief wins
- which duplicate-loss patterns are recurring
- which headline shapes keep appearing in winners
- which historical training tags are most predictive

### 5. Pre-Submission Memory

Before new sourcing, the repo can refresh current context into:

- `data/live-inputs/pre-submission-YYYY-MM-DD-auto.json`

That memory now includes:

- live beat saturation
- top historical winning tag
- top historical rejection tag
- top historical winning headline pattern

## Daily Runtime

### The Minimum Daily Command

```bash
npm run daily-learn
```

This does four things in order:

1. checks filed signals against live AIBTC outcomes
2. refreshes pre-submission memory from live feeds plus training memory
3. writes a daily optimization snapshot
4. writes a daily markdown and JSON report

### The Candidate Discovery Command

```bash
npm run fetch-and-run
```

Use this after `daily-learn`.

It fetches live sources, refreshes automated pre-submission context, and runs the dry-run pipeline on new events.

### The Agent-Level Command

```bash
npm run agent-daily
```

This is the first repo command that behaves like an agent loop rather than a single utility.

It now:

1. runs the daily learning pass
2. auto-labels resolved outcomes into training memory
3. snapshots current brief winners into `data/state/brief-winners-YYYY-MM-DD.json`
4. fetches and dry-runs live candidates
5. ranks today's dry-run submissions into `data/queues/YYYY-MM-DD.json`
6. promotes the best `file` candidate into `data/filing-queue/YYYY-MM-DD.json`

### Scheduled Execution

The repo now includes a scheduled GitHub Actions workflow:

- [`.github/workflows/agent-daily.yml`](../.github/workflows/agent-daily.yml)

It runs the autonomous loop daily at `06:15 UTC` and commits the updated memory back into the repo.

This is now the primary non-signing runtime path.

### Human Approval Gate

After `agent-daily`, the operator reviews the filing queue and explicitly approves a candidate:

```bash
npm run approve-filing -- --date YYYY-MM-DD --candidate <candidate-id> --decision approve --reviewed-by <name>
```

That writes a ready-to-submit artifact to:

- `data/filing-ready/YYYY-MM-DD/<candidate-id>.json`

This keeps the final wallet-signing step human-gated while allowing the repo to do the rest autonomously.

## Recommended Daily Steps

### Morning

1. Run `npm run daily-learn`
2. Read:
   - `data/reports/daily/<today>.md`
   - `data/experiments/optimization/<today>.json`
   - `docs/brief-winner-tracking.md`
3. Confirm what is already in `In Brief`
4. Update training files if a new rejection or clear win pattern appeared

### Midday

1. Run `npm run fetch-and-run`
2. Inspect `data/dry-runs/<today>/dry-run-summary.json`
3. File only the strongest candidate
4. Log any manual observations that the automation missed

### End Of Day

1. Re-run `npm run daily-learn`
2. Make sure outcomes, notes, and brief-winner tracking are up to date
3. If a signal was clearly:
   - `in_brief`, add it to `data/training/in-brief.jsonl`
   - `approved_not_in_brief`, add it to `data/training/approved-not-in-brief.jsonl`
   - `rejected`, add it to `data/training/rejected.jsonl`

## How To Use Skills In Practice

Treat skills as specialized workflows, not random extras.

For this repo, that means:

- use the repo rules docs as the default editorial skill
- use the training files as memory, not prose notes
- only add a new external skill if it clearly improves sourcing, verification, or filing quality

Good reasons to add or build a skill:

- automatic brief parsing
- structured repeat-winner tracking
- rejection labeling from raw outcomes
- beat-specific candidate scoring

Bad reasons:

- rewriting the same checklist in another place
- adding a skill with no runtime hook
- adding generic prompts that do not read repo state

## What Still Needs To Happen

The repo is now set up for behavioral learning, but a stronger autonomous agent still needs:

1. auto-labeling helpers that convert live outcomes into `in_brief`, `approved_not_in_brief`, and `rejected` training entries
2. candidate scoring that reads optimization snapshots directly before ranking
3. brief parsing that logs exact same-day multi-winners automatically
4. scheduled execution for `daily-learn` and `fetch-and-run`
5. a filing queue that ranks candidates by brief-win probability, not just basic validation

## Plain-English Summary

The model is not being re-trained in the ML sense.

But the **agent is being trained** because the repo now stores:

- what wins
- what loses
- why it lost
- which agents keep winning
- which beats are converting into published wins
- what to do differently tomorrow

That is the right foundation for an agent that can eventually do the job with less and less operator intervention.
