# AIBTC Agent Code Map

This is the shortest path for any LLM to find the live agent code and the signing flow.

## Start Here

- Project boundary: if the user is talking about `aibtc`, `signals`, `In Brief`, filing, beats, correspondents, or rewards, stay inside this repo. Do not pull context from `Kizuna`, `MkondoMe`, `Synthesis`, or other workspace agents unless the user explicitly switches projects.
- Open [`memory.md`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/memory.md) first for the current known failures, fixes, and anti-drift rules.
- Runtime entrypoint: [`src/agent/run-daily.ts`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/src/agent/run-daily.ts)
- Fetch loop: [`src/loop/fetch-and-run.ts`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/src/loop/fetch-and-run.ts)
- Candidate ranking: [`src/scoring/candidate-queue.ts`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/src/scoring/candidate-queue.ts)
- Filing queue: [`src/filing/queue.ts`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/src/filing/queue.ts)
- Outcome tracking: [`src/outcomes/checker.ts`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/src/outcomes/checker.ts)
- Live pre-submission memory: [`src/sources/live-pre-submission.ts`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/src/sources/live-pre-submission.ts)

## What To Read For The User's Main Goal

User goal:
- produce 5 to 6 strong signal candidates per day
- approve the best ones
- manually sign the filing-ready artifact
- maximize `In Brief` wins and BTC rewards

Read these next:

- Strategy memory: [`src/intelligence/strategy-memory.ts`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/src/intelligence/strategy-memory.ts)
- Signal sourcing rules: [`docs/signal-sourcing-checklist.md`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/docs/signal-sourcing-checklist.md)
- Brief win rules: [`docs/brief-win-rules.md`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/docs/brief-win-rules.md)
- Active success checklist: [`docs/in-brief-success-checklist.md`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/docs/in-brief-success-checklist.md)
- Filing approval path: [`src/filing/approve.ts`](/Users/feems/Desktop/agentic%20workflows/aibtcagent/src/filing/approve.ts)

## Commands

- Full run: `npm run agent-daily -- --date YYYY-MM-DD`
- Build only: `npm run build`
- Typecheck: `npm run check`
- Generate signing preflight: `npm run signing-preflight -- --date YYYY-MM-DD --candidate <candidate-id>`
- Approve for signing: `npm run approve-filing -- --date YYYY-MM-DD --candidate <candidate-id> --decision approve --reviewed-by <name> --approval-note "<why this should win>"`

## Outputs To Inspect

- Ranked candidates: `data/queues/YYYY-MM-DD.json`
- Filing queue: `data/filing-queue/YYYY-MM-DD.json`
- Dry-run dossiers: `data/dry-runs/`
- Filing-ready artifacts: `data/filing-ready/`
- Daily KPI report: `data/reports/daily/YYYY-MM-DD.json` + `.md`
- Operator summary: `data/reports/operator/YYYY-MM-DD.json` + `.md`
- Competitor review: `data/reports/competitor-review/YYYY-MM-DD.json` + `.md`
- Failure memos: `data/reports/failure-memos/YYYY-MM-DD/{candidateId}.json` + `.md`
- Runtime history: `data/state/agent-runtime.json`
- Operator signability preflight: `data/state/operator-signability.json`
- Brief winners: `data/state/brief-winners-YYYY-MM-DD.json`
- Style performance: `data/state/style-performance.json`
- Competitor styles: `data/state/top_5_competitor_styles.json`

## Current Important Behavior

- `run-daily.ts` is the top-level orchestrator.
- `queue.ts` can expose up to five `awaiting_human_approval` candidates, but only after duplicate, freshness, and operator-signability gates all pass.
- If `data/state/operator-signability.json` is missing or does not confirm wallet readiness, payload integrity, and beat permission, the queue fails closed and the operator flow should not recommend signing anything.

## Collaboration Rule

When another LLM reports a change:

1. open the files above
2. open `memory.md`
3. open `docs/in-brief-success-checklist.md`
4. verify the real paths in this repo
5. inspect generated artifacts in `data/`
6. do not trust summaries without checking the code and queue outputs
7. do not import project memory from other repos unless the user explicitly switched projects
