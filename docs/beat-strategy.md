# Beat Strategy

## Purpose
This document defines the initial beat strategy for the AIBTC Onchain Signal Agent.

## Primary Beat
Registered beat slug: `quantum`

Why:
- this bounty only counts signals filed under `quantum`
- the strongest live edge is Bitcoin-specific post-quantum readiness: BIP-360, P2MR migration issues, developer stance changes, and exact readiness deltas tied to Bitcoin keys, wallets, or agent ops
- the publisher already confirmed the Apr. 8/9 BIP-360 P2MR vector bug angle is a strong Quantum-beat resubmission if filed with a proper body
- quantum signals can be anchored to primary sources like the BIP repo, Delving Bitcoin, mailing-list posts, and the live dataset at `quantum-power-map.p-d07.workers.dev`
- aligns with the current proof-first newsroom requirement for exact dates, exact claims, and direct source URLs

## Submission-Ready Beat Set
The helper smoke gate must stay aligned to these three filing lanes:

- `quantum` — primary lane for Bitcoin post-quantum readiness, BIP-360/P2MR, developer stance, and migration-risk signals
- `aibtc-network` — network-level AIBTC signals about correspondent capacity, beat changes, leaderboard/registry shifts, and newsroom mechanics
- `bitcoin-macro` — Bitcoin market, fee, miner, mempool, policy, and macro conditions that change agent treasury or settlement decisions

Do not treat older infrastructure fixtures as submit-ready beat authority. Infrastructure examples may remain useful training data, but they are not part of the current three-beat helper smoke contract.

## Accepted Beat Slugs
Only these beat slugs may enter create-signal, helper-ready JSON, or filing workflows:

- `quantum`
- `aibtc-network`
- `bitcoin-macro`

All other beat slugs are rejected for this agent, even if they exist on the public aibtc.news beat list.

## What Signals to Prefer
- BIP, PR, or test-vector changes that alter Bitcoin post-quantum implementation readiness
- named developer stance changes backed by a primary source and a verifiable score update
- exact Bitcoin exposure data, qubit/timeline updates, and migration-readiness deltas tied to Bitcoin
- single-topic quantum signals with a direct Bitcoin link and operator consequence
- AIBTC network-capacity changes with exact API counts, release anchors, and implications for correspondents or operators
- Bitcoin macro changes with exact BTC price, mempool fee, miner, policy, ETF, treasury, or settlement-window evidence tied to agent action

## What Signals to Avoid
- dashboard-first observations
- general quantum computing news with no explicit Bitcoin link
- signals without clear causality
- signals without exact tx or contract proof
- bundled multi-topic quantum roundups
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
