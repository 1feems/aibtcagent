# Build Plan

## Goal
Build the smallest strong version of the AIBTC Onchain Signal Agent that can evaluate one real signal lane end to end and decide correctly whether to submit or reject.

## Build Order

### Step 1: Lock the docs and contracts
- finalize concept note
- finalize PRD
- finalize JSON schema
- finalize setup and architecture docs

### Step 2: Create the repo structure
- create source folders
- create config layout
- create state and fixture folders
- create workflow or runtime skeleton
- optionally configure development aids for repo search and code analysis
- treat GitHub Actions as the default MVP hosting path

### Step 3: Implement the core signal model
- candidate signal structure
- proof structure
- source structure
- model disclosure structure
- validation result structure

### Step 4: Implement the validation layer first
- headline rule
- proof rule
- causality rule
- disclosure rule
- duplicate rule
- dashboard-source rejection rule

### Step 5: Implement one real detection lane
Recommended first lane:
- protocol updates

Tasks:
- connect one raw source
- normalize detections
- attach proof
- attach causal explanation

### Step 6: Implement formatting and submission packaging
- generate one-line headline
- create final payload
- mark submit or reject

### Step 7: Add observability
- save candidates
- save accepted and rejected outputs
- save rejection reasons
- save performance metrics

### Step 8: Add network-intelligence checks
- daily brief check
- agent-lookup check
- reputation check
- inbox check
- beat saturation awareness

### Step 9: Add outcome tracking
- approved or not
- sats earned
- BTC earned
- leaderboard movement
- streak/badge visibility

### Step 10: Expand only after proof of value
- add second lane
- add richer runtime
- add Paperboy only if helpful

Future runtime reminder:
- consider `agentic.hosting` only after one signal lane works, daily reports work, and outcomes show the agent is worth upgrading beyond the lowest-cost runtime

## MVP Definition
The MVP is done when:
- one lane works end to end
- valid signals pass
- weak signals are rejected
- output matches schema
- pre-submission checks are enforced
- outcomes are logged

## Not in the First Build
- multiple beats at once
- complex UIs
- broad automation across all earning paths
- real-money trading logic
- large multi-agent orchestration

## Implementation Principle
Build the decision system first, then add more inputs.

Useful optional build aids:
- semantic code search for faster repo navigation
- impact analysis before refactors
- dead code checks as the codebase grows

## End-of-Build Reminder
After the MVP is working, consider whether external development tools should be used to improve ongoing maintenance and iteration.

Examples:
- `lgrep` for semantic code search, repo navigation, and refactor impact analysis
- `evals-skills` for evaluation audits, fixture generation, and testing quality checks

Keep both as external development tools unless there is a later reason to integrate them more closely.
