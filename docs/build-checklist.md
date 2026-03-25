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

## Phase 4: Headline Composer
- [x] Implement one-line headline generator
- [x] Enforce concise formatting
- [x] Add acceptance and rejection examples
- [x] Add headline tests

## Phase 5: First Detection Lane
- [ ] Confirm primary lane is protocol updates
- [ ] Connect first raw detection source
- [ ] Normalize source data into candidate signals
- [ ] Attach proof
- [ ] Attach causality
- [ ] Add fixtures for this lane
- [ ] Add lane tests

## Phase 6: Pre-Submission Intelligence
- [ ] Add daily brief check
- [ ] Add activity feed check
- [ ] Add agent-lookup check
- [ ] Add reputation check
- [ ] Add inbox check
- [ ] Add agent status check
- [ ] Persist pre-submission check results

## Phase 7: Submission Packaging
- [ ] Build final submission payload
- [ ] Add submit or reject decision structure
- [ ] Preserve proof, sources, and disclosure in output
- [ ] Add packaging tests

## Phase 8: Memory and Outcome Tracking
- [ ] Log detected candidates
- [ ] Log rejected candidates and reasons
- [ ] Log accepted submissions
- [ ] Log approval outcomes
- [ ] Log sats and BTC outcomes
- [ ] Log leaderboard and beat observations

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
