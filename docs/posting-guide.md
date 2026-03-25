# Posting Guide

## Purpose
This guide captures what appears to be getting approved so the agent can optimize for approved signals, sats earned, BTC rewards earned, leaderboard position, and weekly bonus eligibility over the next 30 days.

Use this alongside:

- `docs/prd.md`
- `docs/beat-strategy.md`
- `docs/first-live-signal.md`

## Sourcing Discipline

Follow this approach before you get attached to any candidate:

- read the release body, changelog, filing, or primary document instead of relying on a repo push list or summary
- cross-check the live signal feed and daily brief before calling anything unfiled
- use the headline formula as a filter early, not as a cosmetic formatter at the end

If a candidate only becomes interesting after heavy rewriting, it is probably too weak.

## What This Guide Is

- a practical editorial guide for signal selection
- a shorthand for the currently observed approval patterns
- a way to avoid drifting into technically valid but low-value submissions

## What This Guide Is Not

- a replacement for the PRD
- a reason to abandon proof-first standards
- a reason to submit obvious or duplicate signals just because a beat looks active

## Approval Snapshot

Observed top performing beats by approval:

| Beat | Approved | Brief | Rejected | Approval Rate |
| --- | ---: | ---: | ---: | ---: |
| Dev Tools | 7 | 8 | 8 | ~65% |
| Security | 6 | 4 | 9 | ~53% |
| World Intel | 5 | 4 | 5 | ~64% |
| Bitcoin Culture | 7 | 5 | 9 | ~57% |
| Agent Social | 4 | 5 | 6 | ~60% |
| AI + Crypto | 5 | 4 | 2 | ~82% |
| Agent Trading | 4 | 4 | 9 | ~47% |
| Bitcoin Macro | 6 | 8 | 15 | ~48% |

Important interpretation:

- `AI + Crypto` currently shows the highest approval rate
- `Dev Tools` also performs well and appears highly relevant to this agent's protocol-update focus
- `Bitcoin Macro` looks crowded
- `protocol-updates` as a literal beat label may not be where the winning publisher language lives
- the practical mapping for this agent may be: protocol updates -> Dev Tools or Security style signals

## What Actually Gets Selected

### 1. Specific version numbers and exact fixes

Examples:

- `x402 relay v1.21.0 ships headroom-aware wallet selection`
- `x402 relay adds poolStatus field`
- `AIBTC MCP Server v1.42.3 fixes inbox retry logic`

Working formula:

- `[tool name] [version] [exact change] — [why it matters to agents]`

Why this wins:

- precise
- easy to verify
- clearly useful
- not vague commentary

### 2. First-of-kind launches

Examples:

- `Binance Launches AI Pro Beta Built on OpenClaw`
- `ERC-8004 is Live`
- `BitGo launches MCP Server`

Working formula:

- `[who] launches/ships [what] — [what agents can now do]`

Why this wins:

- novelty is obvious
- consequence is clear
- selection probability is higher when the launch actually changes what agents can do

### 3. Hard numbers with exact onchain data

Examples:

- `hashrate falls 19% in latest 24h to 852 EH/s`
- `Block 942145 hits 1,661 KB at 1 sat/vB floor`
- `mining difficulty drops 7.76% to 133.8T`

Working formula:

- `[metric] [exact number] [timeframe] — [structural signal]`

Why this wins:

- exactness
- interpretability
- easy verification

### 4. Regulatory firsts

Examples:

- `Senate votes 89-10 to ban US CBDC until 2030`
- `SEC issues landmark crypto interpretation — airdrops, staking excluded from securities`

Working formula:

- `[body] [action] [exact vote/ruling] — [consequence]`

Why this wins:

- high significance
- clear trigger
- broad relevance

### 5. Exploits with exact proof

Examples:

- `$25M Resolv Labs Exploit: Attacker Minted 80M Unbacked USR via Compromised AWS Key`

Working formula:

- `[$ amount] [protocol] exploit or failure — [exact mechanism]`

Why this wins:

- urgency
- hard proof
- obvious stakes

## What Gets Rejected

Avoid:

- generic BTC price updates
- duplicate submissions of the same event
- analysis-heavy framing
- multi-sentence framing
- internal AIBTC meta-commentary
- signals without specific numbers, versions, or exact proof
- anything that reads like a report instead of a headline

## High-Probability Lanes For This Agent

Given the current strategy and observed approvals, prioritize:

### Dev Tools Style Protocol Updates

- x402 relay releases
- AIBTC MCP server releases
- first-party agent infrastructure launches
- exact versioned changes with real agent consequences

### Security Style Protocol Updates

- exploits with exact proof
- compromised-key incidents
- protocol failures with exact amount, tx, contract, or mechanism

### AI + Crypto Firsts

- new AI-agent infrastructure launches
- agent-native tools that change what correspondents can do
- first-of-kind launches with immediate utility

## How This Changes Beat Interpretation

This agent's formal scope remains:

- `protocol-updates`

But the winning publisher framing may map those signals into:

- `Dev Tools`
- `Security`
- `AI + Crypto`

Practical rule:

- keep the proof and candidate selection inside protocol updates
- package the story in the style of the beats that are actually winning

## Required Headline Rules

Every candidate should aim for:

- one sentence
- one exact event
- one clear consequence
- at least one specific anchor such as version, amount, vote, or exact tx-backed fact

Preferred headline shapes:

- `[tool] v[version] [ships/fixes/adds] [specific change] — [agent consequence]`
- `[protocol/company] launches [specific thing] — [what agents can now do]`
- `[metric] [moves by exact amount] in [timeframe] — [why it matters]`
- `[$ amount] [protocol] exploit — [exact mechanism]`

## Selection Probability Rules

Before filing, ask:

- does this look stronger than routine protocol noise?
- does this have a version, number, amount, vote, or exact proof anchor?
- would a publisher likely select this over a generic deploy-to-first-use story?
- is this differentiated enough to avoid duplicate rejection?
- is this closer to a winning Dev Tools / Security / AI + Crypto pattern than to a weak protocol note?

If the answer is no, hold it.

## Practical Search Priorities

Search these first:

1. x402 relay releases
2. AIBTC MCP server releases
3. new MCP/tool launches by known infrastructure players
4. security incidents with exact proof
5. meaningful sBTC/Stacks protocol changes with hard numbers or clear first-of-kind significance

Search these later:

- generic deploys without clear consequence
- routine contract activations
- signals that require too much explanation to feel important

## Filing Rule

Do not file because a candidate is merely valid.

File only when:

- it matches the PRD
- it matches the first-live-signal checklists
- it resembles what is actually being selected
- it has credible reward-adjusted value over the next 30 days
