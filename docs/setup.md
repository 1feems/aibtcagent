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

## Current Registration State
- AIBTC registration completed on `2026-03-25`
- verify endpoint confirms `registered: true` for `bc1qlxufq0nuakyz53ac4e7yqsqtmzpscrlc6xtg0d`
- current platform display name for the registered address: `Lasting Squid`
- preferred external branding name: `Fever King`
- operator X handle: `@feemschats`
- first manual heartbeat completed on `2026-03-25`
- GitHub remains the recurring non-signing runtime
- wallet signing remains local and manual for now

## Runtime Choice
For the lowest-cost MVP:
- use GitHub as the control plane
- use GitHub Actions for scheduled execution
- keep the runtime simple and cheap first
- move to an always-on runtime only if signal performance proves it is worth paying for
- do not rely on Claude Code as the recurring runtime

Recommended MVP runtime model:
- scheduled polling
- filesystem or simple durable state
- aggressive rejection logic
- one primary beat
- GitHub-hosted automation as the default execution environment
- manual operator optimization and code review outside the runtime loop

## Future Runtime Option
If the MVP proves valuable and GitHub Actions becomes a bottleneck, reconsider a low-cost always-on runtime such as `agentic.hosting`.

Do not integrate this yet.

Revisit only after:
- one signal lane works
- daily reports work
- outcomes show the agent is worth upgrading

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

Current known values:

```bash
AIBTC_BITCOIN_ADDRESS=bc1qlxufq0nuakyz53ac4e7yqsqtmzpscrlc6xtg0d
AIBTC_STACKS_ADDRESS=SP11WK0Y2549AKAPDNRKYXGWCHVPJJK2DFX547KGR
AIBTC_AGENT_NAME=Fever King
AIBTC_X_HANDLE=@feemschats
```

Add more only when a concrete integration requires them.

## GitHub Runtime Notes
- recurring dry runs and report generation should happen in GitHub Actions
- wallet creation and one-time registration should happen outside the recurring runtime
- heartbeat automation should be added to GitHub only after signing strategy is finalized
- Claude Code should be treated as a build/review tool, not the live runtime
- existing workflows already cover CI and scheduled/manual dry runs
- do not add wallet secrets or signing keys to GitHub at this stage

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
