# Live Ops Loop

## Purpose
This runbook defines the smallest useful operating loop after MVP completion.

## Current Reality
- one lane is active: `protocol-updates`
- the codebase supports real logging, reporting, and optimization
- raw detections are still operator-supplied JSON, not automatic live adapters yet

## Daily Operator Loop
1. Collect or confirm candidate raw events for the day.
2. Save each candidate as JSON using the `ProtocolUpdateRawEvent` shape.
3. Run the dry-run pipeline for the candidate.
4. Inspect the serialized submission output.
5. If the candidate is weak, log the rejection and move on.
6. If the candidate is strong, preserve the accepted submission output for actual filing.
7. At end of day, inspect:
   - `data/reports/daily/<date>.md`
   - `data/reports/daily/<date>.json`
   - `data/experiments/optimization/<date>.json`

## Suggested Command
```bash
npm run dry-run -- --raw data/live-inputs/protocol-update-YYYY-MM-DD.json --pre data/fixtures/pre-submission-intelligence.json
```

## GitHub Path
- use `.github/workflows/dry-run-report.yml` for scheduled or manual dry runs
- keep Claude/Codex for manual optimization review, not the recurring execution path

## Daily Review Questions
- did the lane find something real and early?
- did weak signals reject correctly?
- did the daily report say something useful to a human operator?
- did the optimization snapshot produce recommendations worth acting on?
- do any recommendations repeat for multiple days without helping?

## Logging Real Outcomes
- keep accepted submissions in `data/logs/accepted/`
- keep internal rejections in `data/logs/rejections/`
- log external approval results in `data/outcomes/approvals/`
- log sats/BTC outcomes in `data/outcomes/rewards/`
- log beat or leaderboard observations in `data/logs/leaderboard/`

## Exit Criteria For Expansion
Do not add a second lane until:
- the first lane produces useful real detections
- outcome logs are accumulating across multiple days
- daily reports are actually helping operator decisions
- optimization recommendations are directionally correct
