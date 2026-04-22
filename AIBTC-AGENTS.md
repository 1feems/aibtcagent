# AIBTC Agent Code Map

This file is the runtime navigation map for LLM sessions in this repo.
It must follow the canonical contracts in:

- `docs/architecture.md`
- `docs/company-operating-model.md`
- `docs/workflow.md`

If this file conflicts with those docs, those docs win.

## Project Boundary

- If the user is talking about `aibtc`, signals, beats, filing, correspondents, `In Brief`, or rewards, stay inside this repo.
- Do not pull operating context from sibling repos unless the user explicitly switches projects.

## Canonical Read Order

Load docs in this exact order:

1. `README.md`
2. `docs/architecture.md`
3. `docs/company-operating-model.md`
4. `docs/workflow.md`
5. `docs/build-plan.md` (only when current implementation state is needed)
6. task-specific docs only for the active step

This is the repo's official progressive-loading contract.

## Company Workflow Contract (Required)

Signal cycles follow `docs/company-operating-model.md` Step 1 through Step 12 in order:

1. Brief Reader
2. Signal Status Checker
3. Outcome Updater
4. Outcome Analyst
5. Beat Saturation Check
6. Beat Analysis
7. Source Discovery
8. Create Signal (`filing_ready` or stop/repair)
9. Signal Filer (helper-executed)
10. Helper Maintainer
11. Record Signal Outcome
12. Outcome Learner

Loop rules:

- End-of-cycle loop: after Step 12, restart at Step 1.
- Repair loop: if Step 8 returns `repair_and_resubmit`, repeat Step 6 through Step 8 before filing.
- Helper-failure loop: if Step 9 or Step 10 fails, fix root cause, add guard, restart at Step 2.

Filing gate rule:

- Never attempt filing unless Step 8 returns `filing_ready`.
- `news_check_status` before every filing attempt is mandatory.

## Runtime And Loop Entry Points

- Top-level orchestrator: `npm run agent-daily -- --date YYYY-MM-DD`
- Signal packaging runtime: `npm run signal-loop -- --date YYYY-MM-DD`
- Outcome and optimization refresh: `npm run daily-learn -- --date YYYY-MM-DD`
- Outcome poller: `npm run check-outcomes`
- Filing approval path: `npm run approve-filing -- --date YYYY-MM-DD --candidate <candidate-id> --decision approve --reviewed-by <name> --approval-note "<why this should win>"`
- Signing preflight: `npm run signing-preflight -- --date YYYY-MM-DD --candidate <candidate-id>`
- Helper server: `npm run filing-helper`

Fetch loop note:

- `src/loop/fetch-and-run.ts` is a compatibility entrypoint and delegates to `run-daily`.
- Prefer `agent-daily` for canonical runtime behavior.

## Architecture Map By Phase

- Orchestration: `src/agent/run-daily.ts`, `.github/workflows/agent-daily.yml`
- Detection and candidate creation: `src/loop/fetch-and-run.ts`, `src/prep/candidate-generator.ts`, `src/prep/create-signal.ts`, `src/sources/*`
- Validation and queueing: `src/filing/validate-artifact.ts`, `src/filing/filing-gate-validator.ts`, `src/scoring/candidate-queue.ts`, `src/filing/queue.ts`
- Human signing handoff: `src/filing/approve.ts`, `src/filing/helper-server.ts`, `tools/xverse-register/file-signal.html`
- Outcome learning: `src/outcomes/checker.ts`, `src/loop/optimization.ts`, `src/learning/*`

## Operational Rules

- Only these beats are in scope: `aibtc-network`, `bitcoin-macro`, `quantum`.
- Business success is `brief_included`; `approved_not_in_brief` is a failed business outcome.
- Queue output must fail closed when signability evidence is missing.
- Do not hand-write chat signal JSON; use `npm run chat-signal -- --input <create-signal-input.json>`.
- Wallet, heartbeat, and claim signatures remain human-only.

## Outputs To Inspect

- Ranked candidates: `data/queues/YYYY-MM-DD.json`
- Filing queue: `data/filing-queue/YYYY-MM-DD.json`
- Filing-ready artifacts: `data/filing-ready/`
- Daily report: `data/reports/daily/YYYY-MM-DD.json` and `.md`
- Operator summary: `data/reports/operator/YYYY-MM-DD.json` and `.md`
- Competitor review: `data/reports/competitor-review/YYYY-MM-DD.json` and `.md`
- Failure memos: `data/reports/failure-memos/YYYY-MM-DD/{candidateId}.json` and `.md`
- Runtime history: `data/state/agent-runtime.json`
- Operator signability preflight: `data/state/operator-signability.json`

## Collaboration Rule

When another LLM reports a change:

1. Verify the claim in code and generated artifacts.
2. Re-open `docs/architecture.md`, `docs/company-operating-model.md`, and `docs/workflow.md`.
3. Confirm the change still satisfies the Step 1 through Step 12 workflow contract.
4. Do not trust summaries without checking real files.
