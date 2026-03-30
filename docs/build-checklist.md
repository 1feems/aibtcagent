# Build Checklist

## Purpose
This checklist is the working build plan for development.

It is not just a feature inventory.
It is the ordered build contract for preventing drift, late-discovery failures, and patch-on-patch fixes.

Mark items complete only after implementation and testing both pass.

## Current Objective
Build an agent that only surfaces candidates that are:
- publishable by the current operator identity
- competitive enough to win `In Brief`
- fresh for the current report date

Primary KPI:
- `In Brief` wins
- sats actually realized

Not sufficient:
- approval-only outcomes
- technically valid submission artifacts
- filing-ready candidates that are not actually competitive or publishable

## Recent Repairs Already Completed
These came from real failures and should stay visible here so they do not get rediscovered in chat.

- [x] Add repo-boundary anti-drift docs so `aibtcagent` does not pull in `Kizuna`, `MkondoMe`, or `Synthesis` context by default
- [x] Add daily scoreboard fields for `In Brief` wins, approved-but-not-briefed, wallet sats realized, days since last brief, and days since last payout
- [x] Block raw release-note stories without operator consequence from ranking as `file`
- [x] Prune stale prior-day dry-run candidates before current-day ranking
- [x] Prevent `hold` candidates from entering `awaiting_human_approval`
- [x] Make operator summary fail closed when there are zero signable candidates
- [x] Add competitor coverage to ranked candidates and filing queue items

## Current Build Order
Build in this order.
Do not skip ahead to filing UX or optimization tweaks if an earlier gate is still weak.

1. Project guardrails
2. Publishability preflight
3. Editorial competitiveness contract
4. Freshness and queue hygiene
5. Outcome-driven scoring and learning
6. Operator flow and signable queue discipline
7. Regression tests from real failures

## Phase 0: Documentation Lock
- [x] Add project-boundary startup rule: when working in `aibtcagent`, do not import `Kizuna`, `MkondoMe`, `Synthesis`, or other repo context unless the user explicitly switches projects
- [x] Concept note completed
- [x] PRD completed
- [x] JSON schema completed
- [x] Setup doc completed
- [x] Architecture doc completed
- [x] Build plan completed
- [x] Sources doc completed
- [x] Beat strategy completed
- [x] Learning loop completed
- [x] Outcome schema completed
- [x] Testing plan completed

## Phase 0b: Guardrails And Startup Discipline
- [x] Add `memory.md` as repo-local running memory for `aibtcagent`
- [x] Add anti-drift startup rule to `AGENTS.md`, `AIBTC-AGENTS.md`, and `docs/in-brief-success-checklist.md`
- [ ] Make the startup guard visible in `README.md`
- [ ] Make future runbooks fail closed if active repo is not confirmed first

## Phase 1: Repo and Runtime Scaffold
- [x] Create source folder structure
- [x] Create config structure
- [x] Create state and log folders in runtime code
- [x] Create environment variable template
- [x] Create GitHub Actions workflow scaffold
- [x] Add README overview for developers

## Phase 2: Core Types and Schemas
- [x] Implement candidate signal types
- [x] Implement proof types
- [x] Implement source types
- [x] Implement model disclosure types
- [x] Implement validation result types
- [x] Implement outcome tracking types

## Phase 3: Validation Engine
- [x] Implement one-sentence headline validator
- [x] Implement proof validator
- [x] Implement causality validator
- [x] Implement disclosure validator
- [x] Implement dashboard-source rejection rule
- [x] Implement duplicate rejection rule
- [x] Add tests for all validation rules
- [x] Run Claude Code review for Phase 3
- [x] Apply Claude Code fixes for Phase 3

## Phase 4: Headline Composer
- [x] Implement one-line headline generator
- [x] Enforce concise formatting
- [x] Add acceptance and rejection examples
- [x] Add headline tests
- [x] Run Claude Code review for Phase 4
- [x] Apply Claude Code fixes for Phase 4

## Phase 5: First Detection Lane
- [x] Confirm primary lane is protocol updates
- [x] Connect first raw detection source
- [x] Normalize source data into candidate signals
- [x] Attach proof
- [x] Attach causality
- [x] Add fixtures for this lane
- [x] Add lane tests
- [x] Run Claude Code review for Phase 5
- [x] Apply Claude Code fixes for Phase 5

## Phase 6: Pre-Submission Intelligence
- [x] Add daily brief check
- [x] Add activity feed check
- [x] Add agent-lookup check
- [x] Add reputation check
- [x] Add inbox check
- [x] Add agent status check
- [x] Persist pre-submission check results
- [x] Run Claude Code review for Phase 6
- [x] Apply Claude Code fixes for Phase 6

## Phase 7: Submission Packaging
- [x] Build final submission payload
- [x] Add submit or reject decision structure
- [x] Preserve proof, sources, and disclosure in output
- [x] Add packaging tests
- [x] Run Claude Code review for Phase 7
- [x] Apply Claude Code fixes for Phase 7

## Phase 8: Memory and Outcome Tracking
- [x] Log detected candidates
- [x] Log rejected candidates and reasons
- [x] Log accepted submissions
- [x] Log approval outcomes
- [x] Log sats and BTC outcomes
- [x] Log leaderboard and beat observations
- [x] Run Claude Code review for Phase 8
- [x] Apply Claude Code fixes for Phase 8

## Phase 9: Daily Reporting
- [x] Create daily report generator
- [x] Summarize detections and submissions
- [x] Summarize rejections and reasons
- [x] Summarize approvals and rewards
- [x] Summarize what changed and what to improve
- [x] Save reports in a readable format

## Phase 10: Optimization Loop
- [x] Adjust beat preference from outcomes
- [x] Adjust rejection thresholds from outcomes
- [x] Track duplicate-loss patterns
- [x] Track winning headline patterns
- [x] Record next-day recommendations

## Phase 11: Final MVP Review
- [x] Confirm one lane works end to end
- [x] Confirm weak signals are rejected reliably
- [x] Confirm outputs match schema
- [x] Confirm daily report is readable and useful
- [x] Confirm docs match implementation
- [x] Confirm build is ready for live iteration

## Phase 12: Registration to First Live Signal
- [x] Complete AIBTC registration with the chosen BTC and STX addresses
- [x] Verify the registered BTC address via the AIBTC verify endpoint
- [x] Complete the first manual heartbeat successfully
- [x] Confirm GitHub Actions is the active recurring non-signing runtime
- [x] Confirm the scheduled/manual dry-run workflow runs successfully on `main`
- [x] Add local manual helpers for Xverse registration and heartbeat signing
- [x] Save private registration details outside the git repo
- [x] Record current operator metadata in setup docs
- [x] Add a live raw-event template for protocol updates
- [x] Add a live pre-submission intelligence template
- [x] Add a runbook for the first live signal handoff
- [x] Add a PRD-fit checklist for candidate search and filing review
- [x] Add a publisher-skill checklist for protocol, fact-checker, and publisher review
- [x] Add a human-format checklist for publisher-facing output
- [x] Add a 30-day reward checklist to avoid low-value submissions
- [x] Choose one real protocol-update candidate to evaluate
- [x] Create `data/live-inputs/protocol-update-YYYY-MM-DD-001.json` from that candidate
- [x] Create `data/live-inputs/pre-submission-YYYY-MM-DD-001.json` for the same day
- [x] Run `Dry Run Report` in GitHub Actions against the real input paths
- [x] Inspect the generated submission package and confirm the decision is `submit`
- [x] Confirm the candidate also passes the PRD-fit checklist by human review
- [x] Confirm the candidate passes the publisher-skill checklist by human review
- [x] Confirm the candidate passes the human-format checklist by human review
- [x] Confirm the candidate passes the 30-day reward checklist by human review
- [x] Manually file the first live signal through the current AIBTC submission path
- [x] Record filed signals in `data/state/filed-signals.json` (3 signals: 72f6b724, 0585da60, 8be9f1ad — all approved, none published yet)
- [ ] Retry or complete the X claim if Genesis progression is still desired

## Phase 13: Wallet Signing Helper
- [x] Add Xverse browser signing page (`tools/xverse-register/file-signal.html`)
- [x] Add "Load dry-run JSON" button — auto-fills payload from submission JSON
- [x] Map dry-run fields to API payload format (beat_slug, headline, body, sources, tags, disclosure)
- [x] Show "Add to filed-signals.json" entry after successful submission
- [x] Confirm BIP-322 signing and authenticated POST to aibtc.news API works

## Phase 14: Outcome Checker
- [x] Add `data/state/filed-signals.json` to track signalId → candidateId mapping
- [x] Pre-populate with all 3 known filed signals
- [x] Build `src/outcomes/checker.ts` — fetches approved/rejected/submitted feeds by agent address
- [x] Write outcome records to `data/outcomes/approvals/{signalId}.json`
- [x] Mark signals resolved when terminal (approved/rejected); re-check submitted signals each run
- [x] Add `npm run check-outcomes` script
- [x] Add `.github/workflows/check-outcomes.yml` — runs 12:00 and 20:00 UTC, commits results
- [x] Set `AIBTC_BITCOIN_ADDRESS` as a GitHub repo variable (Settings → Variables)
- [x] Verify first automated outcome check runs and commits files

## Phase 15: Live Source Fetcher
- [x] Add `data/config/monitored-repos.json` — repos to watch (x402-sponsor-relay, mcp-server, agent-tools-ts)
- [x] Add `data/state/fetched-releases.json` — tracks already-processed release tags
- [x] Pre-populate with all known releases to avoid re-processing
- [x] Build `src/sources/github-fetcher.ts` — polls GitHub Releases API, generates raw event JSONs
- [x] Build `src/sources/live-pre-submission.ts` — generates fresh pre-submission intelligence from live API
- [x] Build `src/loop/fetch-and-run.ts` — fetches releases → packages each → writes dry-run artifacts
- [x] Add `npm run fetch-and-run` script
- [x] Add `.github/workflows/fetch-and-run.yml` — runs 06:30 UTC daily, commits candidates + artifacts
- [x] Remove daily schedule from `dry-run-report.yml` (now manual-only)
- [x] Fix `dry-run-report.yml` to not wipe `data/outcomes/` on each run
- [ ] Add more repos to `data/config/monitored-repos.json` as needed
- [x] Verify first automated fetch-and-run produces candidates and commits them

## Phase 16: Deploy and Verify Automation
These are the remaining steps to make the agent fully live. Do these in order.

### 16a — Push and activate
- [x] Push all changes to `main` branch on GitHub (commit edf664c)
- [x] Fix test harness issue in `tests/memory.test.js` — passes with existing log files
- [x] `npm run check` and `npm test` both pass
- [x] Set `AIBTC_BITCOIN_ADDRESS` = `bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv` in repo Settings → Secrets and variables → Actions → Variables → New repository variable
- [x] Manually trigger `Fetch and Run` workflow and confirm it finds releases and commits files
- [x] Manually trigger `Check Outcomes` workflow and confirm it writes outcome files and commits them

### 16b — Verify the learning loop has data
- [x] Confirm `data/outcomes/approvals/` has at least one outcome file after checker runs
- [x] Confirm `data/experiments/optimization/` has a snapshot with real `beatPreferences` (not all "hold")
- [x] Confirm `data/reports/daily/` report shows approval outcomes, not all empty

### 16c — Signing page end-to-end test
- [x] Open `tools/xverse-register/file-signal.html` in Chrome with Xverse installed
- [x] Load a `*-submission.json` from `data/dry-runs/` using the Load button
- [x] Connect Xverse and confirm it shows `bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv`
- [x] Sign a request and confirm the curl fallback command appears
- [ ] File a real signal and copy the returned entry into `data/state/filed-signals.json`

### 16d — Daily heartbeat automation (free progression)
- [x] Build a heartbeat signing page in `tools/xverse-register/` (same pattern as file-signal.html)
- [x] Or confirm `tools/xverse-register/heartbeat.html` already works end-to-end
- [x] Add a GitHub Action that reminds (via artifact or report) if checkInCount has not increased

### 16e — Signal quality improvement
- [x] Review the first batch of auto-generated `data/live-inputs` raw events from fetch-and-run
- [x] Confirm the pipeline rejects weak ones (changelog dumps, dashboard-only releases)
- [x] Tune `significance` and `causalTrigger` extraction in `src/sources/github-fetcher.ts` if needed
- [x] Add more repos to `data/config/monitored-repos.json` as new beats are prioritised

## Phase 17: Publishability Preflight
Goal:
  Fail early if the current operator cannot actually publish the story.
- [x] Add a single `publishability preflight` module before filing-ready generation
- [x] Verify beat permission for the current operator identity before a candidate becomes signable
- [x] Verify the current wallet identity matches the intended filing identity
- [x] Persist `publishable_by_current_operator` status on candidates
- [x] Persist exact publishability failure reasons on candidates and in the operator summary
- [x] Prevent non-publishable candidates from entering filing-ready artifacts
- [x] Add regression coverage for the `deal-flow` / designated publisher failure path

## Phase 18: Editorial Competitiveness Contract
Goal:
  Separate technically valid stories from stories that can realistically win a brief slot.
- [x] Add a single editorial contract module for `competitive_for_brief`
- [x] Require human-news headline shape before any candidate can rank as `file`
- [x] Require operator consequence or system consequence framing before any candidate can rank as `file`
- [x] Block narrow raw artifact or release-note packaging unless the broader consequence story is present
- [x] Make `valid but not competitive` an explicit candidate state in queue output and reporting
- [x] Add regression fixtures where generic release notes lose to stronger consequence-led stories

## Phase 19: Freshness And Queue Hygiene
Goal:
  Keep the queue limited to stories that are live, current, and worth operator attention today.
- [x] Auto-prune prior-day dry-run submissions before ranking
- [x] Add an explicit stale-candidate cleanup step before queue generation
- [x] Persist why a candidate was removed for staleness
- [x] Stop stale candidates from appearing in operator-facing recommendation summaries entirely
- [x] Add verification that current-day filing queues only contain current-day signable candidates

## Phase 20: Outcome-Driven Scoring
Goal:
  Optimize for real wins and payouts instead of approval-ready cleanliness.
- [x] Reduce or remove score bonuses that let generic approval-ready stories overpower non-competitive editorial shape
- [x] Gate `unique pick advantage` so it only applies after a candidate already clears the stronger competitive bar
- [x] Learn from actual `In Brief` winners and wallet payouts, not just resolved API approvals
- [x] Show why top competitors won the slot in a form the scorer can directly use
- [x] Add tests proving crowded but important differentiated stories can outrank lonely weak ones

## Phase 21: Operator Flow Discipline
Goal:
  Never ask for manual signing unless the candidate is truly signable.
- [ ] Show three operator-facing failure classes everywhere: `not publishable`, `not competitive`, `stale`
- [ ] Ensure the operator summary only emits approve/sign instructions for candidates that pass all hard gates
- [ ] Add helper diagnostics for wallet/provider detection before connect
- [ ] Validate payload integrity before signing begins
- [ ] Add an explicit pre-sign checklist to the manual filing helper

## Phase 22: Regression Discipline
Goal:
  Every painful failure becomes a permanent test or checklist item.
- [ ] Add a regression test for wallet/provider late-discovery failure handling
- [ ] Add a regression test for helper payload truncation or wiped-payload behavior
- [ ] Add a regression test for operator summary suggesting approval with zero signable candidates
- [ ] Add a checklist rule: no live fix is complete until the failure has a persistent test or documented guardrail

## Rule
- [x] Do not start the next incomplete phase before the current one is implemented and tested
