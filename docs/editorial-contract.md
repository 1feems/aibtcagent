# Editorial Contract

## Purpose

This file is the canonical editorial contract for the AIBTC signal pipeline.

If there is any conflict between:

- Publisher skill
- Fact-Checker skill
- helper `signal-guard`
- `data/state/editorial-memory.json`
- dated signal reports
- manual submission artifacts
- live filing payload shape

this file wins.

The point of this contract is to make the repo behave like one editorial operating system instead of a collection of partially aligned checks.

## Operating Principle

The pipeline must reason:

1. context first
2. rules second
3. output last

Daily signal work is not free-form ideation.
It is a deterministic editorial workflow.

## Canonical Daily Order

Every signal must move through this order:

1. Read current context
2. Run duplicate-first hard gate
3. Run Publisher gate
4. Run Fact-Checker gate
5. Apply leaderboard, streak, beat-cap, and payout pressure
6. Sync dated report and artifact
7. Produce helper-ready payload

Do not skip steps.
Do not draft around a broken earlier step.

## Context Inputs

The runtime must read these before evaluating a new signal:

1. `data/briefs/YYYY-MM-DD.md`
2. `data/state/editorial-memory.json`
3. `data/state/filed-signals.json`
4. dated signal report for the active cycle
5. same-day accepted / rejected snapshots when available

The current brief is the editorial template.
`editorial-memory.json` is the structured daily brain.
`filed-signals.json` is the filing history source of truth.

## Duplicate-First Hard Gate

These checks run before Publisher or Fact-Checker review:

1. already in today's brief
2. already in prior posted briefs with the same story shape
3. already filed
4. already rejected with no materially new angle
5. duplicate of another same-day candidate

If any duplicate gate fails, the signal stops.

No scoring, rewriting, helper submission, or JSON handoff should happen after a duplicate failure.

## Publisher Gate

Apply the 4-question Publisher test in order.
Stop at the first failure.

### Q1 Mission-aligned

The signal must clearly serve:

`Bitcoin is the currency of AIs`

The signal must explicitly show how AI agents, correspondents, operators, or AIBTC participants:

- use
- earn
- transact with
- verify
- route
- settle
- govern

Bitcoin, sBTC, x402 payment flow, Stacks-based identity, or AIBTC network activity.

### Q2 Replicable

Another agent must be able to reproduce the signal.

The signal must include concrete disclosure naming:

- model or tool
- endpoint, URL, issue, PR, release, or query
- the actual verification path used

Trivially vague disclosure fails automatically.

### Q3 Inscribable

The signal must be worth permanent record.

Stable baselines, empty monitoring updates, and speculation without a real development do not pass.

### Q4 Value-creating

The signal must increase understanding of the AI-native economy in a measurable way.

This usually means it must show one of:

- payout consequence
- payment-routing consequence
- leaderboard or streak consequence
- attribution or identity consequence
- settlement consequence
- operator workflow change
- security or failure-mode consequence

If the signal is just “a thing changed” with no measurable effect on agent behavior or system economics, it fails.

## Fact-Checker Gate

The signal must also pass fact-check review.

### Source Rules

- no circular sourcing
- no single weak source for extraordinary claims
- no unverifiable numeric claim
- no stale price or market claim outside tolerance
- no unsupported externalized thesis

### Claim Verification Rules

Check the claim type:

- price
- count
- payout
- block height
- identity / registration
- routing / settlement
- security / CVE

The verification standard depends on the claim type.

### Source Combination Rule

When a stronger independent anchor is required, the signal must include it.
But the system must not reject valid repo-native operational stories merely because they are repo-native.

That means the helper and runtime must distinguish between:

- legitimate primary product / repo / protocol evidence
- circular self-sourcing with no verifying anchor

## Leaderboard and Operating Pressure

After Publisher and Fact-Checker pass, the signal must still be evaluated against:

- beat crowding
- beat caps
- streak protection
- weekly top-3 pressure
- brief inclusion odds
- payout upside

This is not a quality override.
It is a tie-break and prioritization layer.

The runtime must not choose low-value volume over stronger brief-win odds.

## Canonical Signal Contract

There is one canonical signal payload shape:

```json
{
  "beat_slug": "",
  "headline": "",
  "analysis": "",
  "sources": [
    {
      "url": "",
      "title": ""
    }
  ],
  "tags": [],
  "disclosure": ""
}
```

Rules:

- `analysis` is the canonical narrative field
- helper code may internally map `analysis` to `body`, but operators should not have to reason about two competing field names
- repo artifacts, report entries, and helper-ready payloads must all preserve the same editorial content

## Sync Contract

If a signal survives all gates, it must be written to:

1. the dated signal report
2. the repo artifact path
3. the helper-ready payload shape

Do not hand chat-only signals to the operator.

## Failure Diagnostics

Every blocked signal should report the failing layer:

- duplicate
- Publisher Q1
- Publisher Q2
- Publisher Q3
- Publisher Q4
- Fact-Checker
- helper mismatch
- format mismatch
- leaderboard / beat-pressure hold

This is required so the operator can tell whether a signal is wrong, premature, duplicate, or simply not competitive enough today.

## Daily Prep Contract

When the operator says `do the daily prep`, that means:

- follow repo workflow, not chat workflow
- use this editorial contract
- refresh `editorial-memory.json`
- review today’s brief first
- prefer context-led decisions over isolated rule firing

The intended daily-prep behavior is:

- context-led
- outcome-oriented
- repo-backed

not:

- fragmented
- chat-only
- rule-led without current editorial context
