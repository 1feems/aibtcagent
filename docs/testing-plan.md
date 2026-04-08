# Testing Plan

## Purpose
This document defines how development should be tested so each build step is verifiable before moving on.

It is designed to help the operator and coding agent validate work incrementally and avoid wasteful back-and-forth.

## Testing Principles
- test one layer at a time
- do not expand scope before the current layer passes
- prefer deterministic fixtures over vague manual checks
- test rejection logic as aggressively as acceptance logic
- keep tests tied to the PRD and JSON schema
- when a live operational failure is discovered late, add a deterministic regression test or checklist rule in the same turn

## Development Aids
Optional development tools may be used to speed up code search, inspection, and QA during implementation.

Useful examples:
- semantic code search tools such as `lgrep`
- dependency and impact analysis tools
- dead code and unused export checks

These tools are for development efficiency only. They are not part of the runtime signal pipeline.

## Test Layers

### 1. Schema and Contract Tests
Goal:
- confirm outputs match the documented schema

Checks:
- candidate signal object shape is valid
- submission payload shape is valid
- outcome tracking shape is valid
- required fields are always present

### 2. Validation Engine Tests
Goal:
- confirm weak signals are rejected correctly

Checks:
- reject multi-sentence headlines
- reject missing proof
- reject missing causality
- reject missing sources
- reject missing model disclosure
- reject dashboard-primary signals
- reject duplicates
- accept valid one-line signals with proof

### 3. Headline Formatting Tests
Goal:
- ensure headlines stay newsroom-compatible

Checks:
- output is one sentence
- output is concise
- output explains what happened
- output explains why it matters or happened

### 4. Detection Lane Tests
Goal:
- confirm one real signal lane works end to end

Checks:
- raw source input is normalized correctly
- proof is attached correctly
- causality is attached correctly
- candidate record is complete

### 5. Pre-Submission Intelligence Tests
Goal:
- confirm final checks happen before submission

Checks:
- daily brief check runs
- leaderboard check runs
- reputation check runs
- inbox check runs
- agent status check runs
- final decision records whether these checks were completed

### 6. Outcome Tracking Tests
Goal:
- confirm the system can learn from results

Checks:
- accepted/rejected signals are logged
- approval outcomes can be recorded
- sats and BTC outcomes can be recorded
- duplicate-losses can be recorded
- daily report inputs are saved

### 7. Daily Reporting Tests
Goal:
- confirm the human operator receives useful summaries

Checks:
- report summarizes detections
- report summarizes submissions
- report summarizes rejections
- report summarizes approvals and rewards
- report recommends changes for next day

## Manual QA Checklist
Before marking any phase done, confirm:
- docs match actual behavior
- output examples still match schema
- rejection reasons are clear
- accepted outputs are genuinely publishable
- no unsupported claims are introduced

## Development Rule
No phase is complete until:
- code is implemented
- expected outputs are verified
- failure cases are tested
- docs stay aligned
- painful late-discovery failures are converted into explicit regression coverage
