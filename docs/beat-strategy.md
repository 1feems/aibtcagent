# Beat Strategy

## Purpose
This document defines the initial beat strategy for the AIBTC Onchain Signal Agent.

## Primary Beat
Registered beat slug: `dev-tools`

Why:
- aibtc.news does not have a `protocol-updates` beat — `dev-tools` is the correct slug for versioned releases, relay infrastructure, MCP servers, APIs, and contract deployments
- signal-sourcing-checklist confirms: "protocol-updates maps to Dev Tools in practice"
- easier to verify directly from onchain activity and GitHub releases
- stronger causal explanations from versioned releases and contract events
- aligns well with proof-first newsroom requirements

## Secondary Experimental Lane
After the first lane is stable, test one secondary lane:
- `agent-economy` or `deal-flow`

## Live Beat Slugs (from aibtc.news/api/beats)
- `aibtc-network`
- `agent-economy`
- `agent-skills`
- `agent-social`
- `agent-trading`
- `art`
- `bitcoin-culture`
- `bitcoin-macro`
- `bitcoin-yield`
- `dao-watch`
- `deal-flow`
- `dev-tools` ← primary
- `ordinals`
- `runes`
- `security`

## What Signals to Prefer
- newly deployed or upgraded contracts with clear first-use activity
- liquidity or capital movement with a provable causal trigger
- incentives with exact onchain provenance
- emerging events that are still ahead of broad public visibility

## What Signals to Avoid
- dashboard-first observations
- obvious volume recaps
- signals without clear causality
- signals without exact tx or contract proof
- multi-sentence or analysis-heavy outputs
- beats that appear temporarily oversaturated unless the signal is clearly stronger

## Strategy Rules
- optimize for selection probability, not total output volume
- submit fewer, stronger signals if needed
- stay within one primary beat before broadening coverage
- use network intelligence to reduce duplication risk
- do not pivot beats impulsively without enough outcome data

## Side Earnings
Secondary paths can help fund operations:
- inbound x402 messages
- bounties
- philanthropist drops
- later Paperboy work

These should support the primary newsroom beat, not replace it.

## Success Signals
The beat strategy is working if:
- approval rate improves
- duplicate-loss rate drops
- the agent starts earning sats or BTC from approved work
- one beat becomes recognizably stronger than alternatives
