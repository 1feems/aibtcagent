# Setup

## Purpose
This document records the operator setup, wallet references, runtime choice, and environment expectations for the AIBTC Onchain Signal Agent.

## Wallets

### Primary Bitcoin Address
- `bc1qlxufq0nuakyz53ac4e7yqsqtmzpscrlc6xtg0d`
- type: `Bitcoin Native SegWit`
- purpose: primary AIBTC Bitcoin identity, rewards, and BTC-side attribution

### Paired Stacks Address
- `SP11WK0Y2549AKAPDNRKYXGWCHVPJJK2DFX547KGR`
- purpose: AIBTC registration, Stacks-side activity, contract interaction attribution, and proof references

## Registration Notes
- register the agent with AIBTC
- keep the paired BTC and STX identities consistent across setup docs and runtime configuration
- claim the agent on X where required for reward attribution
- claim one primary newsroom beat before live signal submission

## Runtime Choice
For the lowest-cost MVP:
- use GitHub as the control plane
- use GitHub Actions for scheduled execution
- keep the runtime simple and cheap first
- move to an always-on runtime only if signal performance proves it is worth paying for

Recommended MVP runtime model:
- scheduled polling
- filesystem or simple durable state
- aggressive rejection logic
- one primary beat

## Environment Variables
Define these in repo secrets or a local `.env` file, depending on runtime:

```bash
AIBTC_BITCOIN_ADDRESS=
AIBTC_STACKS_ADDRESS=
AIBTC_AGENT_NAME=
AIBTC_PRIMARY_BEAT=
AIBTC_X_HANDLE=
AIBTC_RUNTIME_MODE=
AIBTC_DAILY_BRIEF_URL=
AIBTC_ACTIVITY_FEED_URL=
AIBTC_AGENT_REGISTRY_URL=
AIBTC_REPUTATION_URL=
```

Add more only when a concrete integration requires them.

## Operator Setup Checklist
- wallets confirmed
- AIBTC registration completed
- X claim completed if required
- primary beat chosen
- repo secrets configured
- runtime choice confirmed
- heartbeat strategy confirmed
- source docs saved in `docs/`

## Treasury Policy
- do not rely on personal capital for normal operation
- prefer free or earned sats for optional messaging and network actions
- preserve earned sats unless an action clearly improves expected reward outcomes

## MVP Operating Assumptions
- primary goal is approved newsroom signals
- secondary goal is treasury growth from low-risk paths like inbound messages, bounties, and later Paperboy
- badges and streaks matter, but they are secondary to approved signal performance
