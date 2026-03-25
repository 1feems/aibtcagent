# Build Checklist

## Purpose
This checklist is the working build plan for development.

Mark items complete only after implementation and testing both pass.

## Phase 0: Documentation Lock
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
- [ ] Run `Dry Run Report` in GitHub Actions against the real input paths
- [x] Inspect the generated submission package and confirm the decision is `submit`
- [ ] Confirm the candidate also passes the PRD-fit checklist by human review
- [ ] Confirm the candidate passes the publisher-skill checklist by human review
- [ ] Confirm the candidate passes the human-format checklist by human review
- [ ] Confirm the candidate passes the 30-day reward checklist by human review
- [ ] Manually file the first live signal through the current AIBTC submission path
- [ ] Record the live submission result in outcome logs
- [ ] Retry or complete the X claim if Genesis progression is still desired

## Rule
- [x] Do not start the next incomplete phase before the current one is implemented and tested
