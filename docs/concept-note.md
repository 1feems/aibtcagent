# Concept Note: AIBTC Onchain Signal Agent

## Title
AIBTC Onchain Signal Agent

## Purpose
Build an agent for the AIBTC network that detects early, non-obvious onchain events, verifies their cause, and submits them as one-line news signals with full proof and full source disclosure.

## Problem
The AIBTC environment is competitive and curated. Many agents can access similar public information, but only a small number of signals are selected for publication. Signals based on obvious, indexed, or dashboard-visible data are likely to be duplicated and rejected. To compete effectively, the agent must detect meaningful events earlier than others, verify them directly from onchain data, and explain causality clearly.

## Core Objective
The agent must outperform competing agents on three dimensions:
- Speed: detect signals before they appear on public dashboards
- Verifiability: attach strict onchain proof and fully disclosed public sources
- Insight: explain why the event happened, not just what happened

## Agent Positioning
This agent is an early detection and verification system. It is not a dashboard scraper, not a generic market commentator, and not a long-form reporting system. Its role is to identify meaningful changes before they become obvious, explain them clearly, and prove them rigorously.

## Scope
The agent focuses on early onchain intelligence across broad categories rather than a single protocol, including:
- protocol changes
- liquidity shifts
- yield opportunities
- incentive-related events
- other actionable DeFi or market structure changes supported by onchain proof

This category-level scope is necessary to maintain a steady flow of valid signals while still allowing differentiation through early detection and verification.

## Implementation Model
The agent should be designed as a decision-making layer over AIBTC-native skills and MCP tools, rather than a monolithic custom scraper. Detection, verification, newsroom interaction, and submission should be composed from reusable AIBTC capabilities where possible.

The agent decides:
- what qualifies as a signal
- whether a signal is strong enough to submit
- whether the signal satisfies novelty, proof, and causality requirements

Tools and skills execute:
- chain queries
- mempool monitoring
- contract analysis
- newsroom actions
- authenticated submission

## Architecture Assumption
The AIBTC ecosystem provides reusable skills and tool interfaces for Bitcoin, Stacks, DeFi, and newsroom operations. The agent should leverage these native capabilities instead of reimplementing all infrastructure from scratch. This keeps the system simpler, more extensible, and better aligned with the network.

## Core Execution Loop
The agent must follow a strict loop:
1. Detect candidate events from raw blockchain activity
2. Filter out events that are obvious, indexed, dashboard-visible, or likely duplicated
3. Verify the event with direct onchain proof
4. Identify the causal trigger behind the event
5. Convert the result into a one-line news headline
6. Attach proof, sources, and model disclosure
7. Validate against all publication rules
8. Submit only if every condition is satisfied

If any step fails, the signal must not be submitted.

## Editorial Standard
Every submission must:
- be a single news-style sentence
- communicate what happened and why it matters
- avoid reports, explanations, paragraphs, or data dumps

If the signal cannot be expressed as one clear sentence, it is invalid.

## Publication Requirements
Each signal must include:
- onchain provenance
- fully disclosed public sources
- full model disclosure
- universal verifiability
- public traceability for any edits or corrections

These requirements are mandatory and not optional.

## Rejection Rules
The agent must reject a signal if:
- it relies primarily on dashboards or indexed public data
- it is likely duplicated by other agents
- it lacks exact onchain proof
- it does not explain causality
- it cannot be written as a single sentence
- it lacks full disclosure
- it cannot be independently verified from the disclosed sources

Rejection is a core feature of the system, not a failure.

## System Components
The agent should be organized into five minimal components:
- Detection: monitor raw onchain activity and pre-index data
- Verification: confirm event details and causal source
- Formatting: produce a one-line newsroom headline
- Validation: enforce editorial, novelty, and proof rules
- Submission: file only fully qualified signals

This structure keeps the system simple while remaining extensible.

## Operational Requirement
The agent must integrate with AIBTC newsroom workflows, including:
- claiming and operating within an editorial beat
- preparing newsroom-compatible signals
- filing authenticated submissions
- preserving transparency and traceability

The agent is not only producing content; it is participating in a networked newsroom process.

## Authentication Requirement
All submissions must be attributable to the agent’s registered identity. The agent must support authenticated filing and should be designed with cryptographic identity and submission integrity in mind.

## Runtime Model
The agent should run as a continuous autonomous loop rather than a one-time script. It should repeatedly detect, evaluate, validate, and submit signals, adapting to a competitive environment where speed and consistency matter every day.

## Design Principles
The system should follow these principles:
- simple before complex
- proof over speculation
- causality over surface-level observation
- early detection over completeness
- rejection is required when standards are not met
- tools execute, agent decides

## Success Criteria
The agent is successful if it consistently produces signals that are:
- early
- non-duplicative
- provable
- causally explained
- clear enough to publish immediately

## Non-Goals
This agent is not intended to be:
- a dashboard scraper
- a generic analytics reporter
- a long-form research writer
- a submission engine for weak or unverifiable claims
- a system that depends on hidden or private sourcing

## Conclusion
The AIBTC Onchain Signal Agent should be built as a focused, newsroom-aware intelligence system that detects meaningful events before they become obvious, verifies them directly from onchain data, explains why they happened, and submits them in a form that meets strict editorial and proof standards. Its competitive edge comes from combining speed, causality, verifiability, and disciplined rejection logic in a continuous operating loop.
