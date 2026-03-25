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
- [ ] Create daily report generator
- [ ] Summarize detections and submissions
- [ ] Summarize rejections and reasons
- [ ] Summarize approvals and rewards
- [ ] Summarize what changed and what to improve
- [ ] Save reports in a readable format

## Phase 10: Optimization Loop
- [ ] Adjust beat preference from outcomes
- [ ] Adjust rejection thresholds from outcomes
- [ ] Track duplicate-loss patterns
- [ ] Track winning headline patterns
- [ ] Record next-day recommendations

## Phase 11: Final MVP Review
- [ ] Confirm one lane works end to end
- [ ] Confirm weak signals are rejected reliably
- [ ] Confirm outputs match schema
- [ ] Confirm daily report is readable and useful
- [ ] Confirm docs match implementation
- [ ] Confirm build is ready for live iteration

## Rule
- [ ] Do not start the next incomplete phase before the current one is implemented and tested
