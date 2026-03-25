# Architecture

## Purpose
This document defines the high-level architecture for the AIBTC Onchain Signal Agent.

## System Overview
The agent is a continuous signal decision system with six main layers:
- detection
- verification
- formatting
- validation
- submission
- memory and observability

## Component Diagram

```text
Raw Sources / Skills
  -> Detection Engine
  -> Candidate Signal Record
  -> Verification Engine
  -> Headline Composer
  -> Validation Engine
  -> Submission Decision
  -> Submission Adapter
  -> Outcome Tracking
  -> Memory / Logs / Performance Data
```

## Components

### Detection Engine
Purpose:
- collect candidate events from raw or near-raw sources

Inputs:
- mempool-watch
- query
- protocol and contract activity
- structured skill outputs
- verified agent-tip leads

Outputs:
- candidate signal records

### Verification Engine
Purpose:
- attach exact onchain proof
- determine whether the event is independently verifiable
- explain the event’s cause

Inputs:
- candidate signal record
- tx references
- contract analysis
- raw query results

Outputs:
- enriched candidate with proof and causality

### Headline Composer
Purpose:
- convert verified findings into a one-line news-style headline

Rules:
- one sentence only
- state what happened
- state why it matters or why it happened

### Validation Engine
Purpose:
- reject weak, duplicate, or non-compliant signals before submission

Checks:
- one sentence
- proof attached
- causality present
- full source disclosure
- full model disclosure
- independently verifiable
- not dashboard-primary
- not likely duplicate

### Submission Adapter
Purpose:
- package and submit valid signals to the AIBTC newsroom flow

Responsibilities:
- map internal record to submission payload
- preserve proof, sources, and model disclosure
- support authenticated filing

### Memory and Observability Layer
Purpose:
- track decisions, outcomes, and performance over time

Stores:
- candidate signals
- rejected signals and reasons
- accepted submissions
- daily brief patterns
- leaderboard observations
- approval outcomes
- sats / BTC outcomes when visible

## Network Intelligence Layer
This is a support layer that informs decisions but does not replace proof.

Inputs:
- aibtc.news brief
- live activity feed
- x402 inbox
- agent-lookup
- reputation

Uses:
- beat saturation awareness
- duplication avoidance
- calibration of headline style
- strategy adjustment

## Runtime Model
MVP runtime:
- scheduled execution
- one primary beat
- one detection lane
- durable local or artifact-backed state

Later runtime:
- continuous loop
- multiple lanes
- richer observability

## Data Flow
1. detect candidate
2. normalize record
3. verify proof
4. determine causality
5. compose headline
6. validate
7. submit or reject
8. track outcome
9. update strategy

## Design Rules
- proof is mandatory
- rejection is a feature
- network intelligence informs but never substitutes proof
- one strong lane before many weak lanes
- keep components separable and testable
