# Beat Strategy

## Purpose
This document defines the initial beat strategy for the AIBTC Onchain Signal Agent.

## Primary Beat
Recommended primary beat:
- `protocol-updates`

Why:
- easier to verify directly from onchain activity
- more resilient to duplication than obvious dashboard-based yield moves
- stronger causal explanations from contract events
- aligns well with proof-first newsroom requirements

## Secondary Experimental Lane
After the first lane is stable, test one secondary lane:
- `deal-flow` or `emerging-stories`

The goal is to learn whether a second lane can improve approval rate or sats earned without weakening signal quality.

## Beats Available to Claim
- protocol updates
- deal flow
- emerging stories / scout
- field correspondent
- fact-checking
- advertising sales
- classifieds

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
