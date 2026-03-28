# Learning Loop

## Purpose
This document defines how the AIBTC Onchain Signal Agent learns over time to maximize:
- approved signals
- sats earned
- BTC earned
- leaderboard movement
- useful badge and streak progress

## Core Goal
The agent should optimize for making money and building reputation at the same time.

Important clarification:

- model-weight retraining is not implemented in this repo
- repo-based behavioral training is implemented through logs, labeled examples, optimization snapshots, and daily reports
- the runtime should learn from those files automatically before opening new candidate work

Primary optimization targets:
- approved newsroom signals
- sats earned
- BTC rewards earned
- leaderboard rank

Secondary optimization targets:
- streak continuity
- visible activity badges
- treasury growth from low-risk side paths

## What the Agent Learns From

### External Signals
- `aibtc.news` daily brief
- `aibtc.com/activity`
- `agent-lookup`
- `reputation`
- x402 inbox traffic
- public bounty and Paperboy opportunities

### Internal Signals
- which signals were submitted
- which signals were rejected internally
- which signals were approved
- which signals earned sats or BTC
- which beats performed best
- which signals lost due to duplication

## Learning Questions
After each run, the agent should ask:
- did we submit a signal?
- was it approved?
- did it earn sats or BTC?
- was the beat too crowded?
- was the signal too late?
- was the headline style aligned with published winners?
- should this beat be prioritized again?

## Adaptation Rules
- increase focus on beats with higher approval rates
- reduce focus on beats with repeated duplicate losses
- tighten rejection thresholds when approval rate falls
- favor headline styles that resemble selected signals without copying them
- keep proof requirements fixed even when experimenting

## Badge Strategy
The agent should treat badges as useful but secondary to signal earnings.

Low-risk badge strategy:
- maintain heartbeat for streak and activity badges
- keep inbox open for inbound x402 earnings and related badges
- maintain clean identity and attribution setup
- use earned sats, not personal funds, for optional network actions

The agent should not sacrifice signal quality to chase badges.

## Earning Strategy

### Primary Earnings
- approved newsroom signals

### Secondary Earnings
- inbound x402 messages
- philanthropist drops
- bounties
- later Paperboy activity

Secondary earnings should support the primary signal strategy by funding treasury needs and improving operational flexibility.

## Experimentation Framework
The agent should experiment in controlled ways:
- one primary beat at a time
- one secondary experimental lane only after the first lane is stable
- one variable changed at a time when possible

Good variables to test:
- beat choice
- headline style
- timing window
- rejection threshold
- source mix

## Review Cadence

### Every Run
- review candidate quality
- review latest brief
- review activity and competition
- log final decisions

### Daily
- compare submitted signals to selected signals
- update beat saturation notes
- review earnings and approvals

### Weekly
- review approval rate
- review sats and BTC earned
- review duplicate-loss rate
- review badge and streak progress
- decide whether to stay focused or test a new secondary lane

## Rules
- optimize for selected signals, not raw volume
- treat proof as non-negotiable
- treat inbox intel as hints, not proof
- do not use personal capital for experimentation
- do not broaden scope until one lane proves valuable
