# Agent Memory

## Purpose
This file is the running memory for the agent build.

Use it to answer:
- what has already been built
- what was fixed recently
- what failed in real use
- what must be repaired next

This is not the full spec.
It is the practical "do not forget this again" file.

## Source Of Truth
Primary operating procedure: `AGENTS.md`

Supporting docs read before every signal:
- `docs/beat-capacity-board.md`
- `docs/publisher-feedback-board.md`
- `docs/homepage-brief-snapshots.md`
- `docs/daily-brief-source-comparison.md`
- `docs/beat-editors/quantum-zen-rocket.md` (quantum only)
- `docs/beat-editors/bitcoin-macro-ivory-coda.md` (bitcoin-macro only)
- `docs/beat-editors/aibtc-network-skill.md` (aibtc-network only)
- `docs/sources.md`
- `docs/helper-bugs.md`
- `docs/target-beat-rules.md` (Step 3 output; blocked shapes extracted fresh daily)

This file exists because the checklist alone did not capture late-discovery failures from real operation.

## Project Boundary
This memory file is for `aibtcagent` only.

Do not mix context from:
- `Kizuna`
- `MkondoMe`
- `Synthesis`
- other agent repos in the workspace

Unless the user explicitly switches projects.

For `aibtcagent`, the active objective is:
- score 90+ with the publisher
- win `In Brief`
- earn sats
- only surface candidates that are publishable, competitive, and fresh

## Current Reality
The real KPI is:
- signals that score 90+ and make `In Brief`
- sats that actually reach the wallet

Not enough:
- approval only
- technically valid submission artifacts
- "ready to file" candidates that are not actually competitive or publishable

## Active Beats
| Beat | Cap | Check live |
|---|---|---|
| `quantum` | 10 | `node skills/beat-capacity-status/scripts/beat-capacity-status.mjs` |
| `bitcoin-macro` | 10 | same |
| `aibtc-network` | 10 | same |

BTC filing address: `bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv`

## Workflow (5 Steps — AGENTS.md, updated 2026-04-24)

Steps must run in order. Each step's output feeds the next. Do not skip.

1. **Check beat capacity** — run `node skills/beat-capacity-status/scripts/beat-capacity-status.mjs`; if slots = 0 stop
2. **Check brief status** — update `homepage-brief-snapshots.md` (Step 2A), check signal status from `publisher-feedback-board.md` (Step 2B), update `daily-brief-source-comparison.md` (Step 2C). Must run before Step 3 or blocked shapes extraction is stale
3. **Load beat context** — read all 5 docs (beat editor, homepage-brief-snapshots, publisher-feedback-board, daily-brief-source-comparison, helper-bugs); extract blocked shapes fresh from last 48h brief into `docs/target-beat-rules.md`; gate: confirm all 5 docs read before proceeding
4. **Build verified source list** — pull Tier 1 sources from beat editor; remove already-used sources; verify every URL against helper whitelist; check each source against blocked shapes; output ordered list; if list is empty do not file
5. **Create signal (deterministic)** — pick anchor only from Step 4 list; run duplicate guard on anchor + claim, not headline; run shape/story-family guard against Step 3 blocked shapes and `helper-bugs.md`; build `CLAIM` / `EVIDENCE` / `IMPLICATION`; apply every helper lesson; validate all checks; return exactly one JSON

If any required doc is unread → return `hold`.

## What Has Been Built
- Daily reporting with top KPI emphasis on In Brief and sats
- Competitor review and brief analysis
- Manual brief ingest and brief-history learning
- Filing queue and operator summary
- Xverse helper pages for signal filing and heartbeat
- Outcome checker and reward sync
- Candidate scoring with style memory, competitor coverage, and same-beat packaging adjustments
- Beat capacity status skill (`skills/beat-capacity-status/scripts/beat-capacity-status.mjs`)
- 3-check validation gate (helper syntax, winner shape, beat 90+ checklist)

## Important Recent Fixes

### 1. Competitor Coverage
- Tracked competitor histories fetched in parallel during ranking
- `competitorCoverage` persisted into ranked candidates and filing queue items
- Scoring: 2+ competitors means boost + differentiation warning; 0 competitors + approval-ready means unique-pick bonus

### 2. Daily Scoreboard
Reports now show: In Brief wins, Approved but not briefed, Wallet sats realized, Days since last brief, Days since last on-chain payout

### 3. Raw Release-Note Penalty
Raw release-note stories without operator consequence no longer rank as file.

### 4. Stale Dry-Run Pruning
Prior-day dry-run submissions pruned before ranking to prevent stale candidates leaking into today's queue.

### 5. Filing Queue Tightening
Only candidates with final decision file can become `awaiting_human_approval`. `hold` candidates no longer masquerade as signable queue items.

### 6. Operator Signability Preflight
Filing queue fails closed unless `data/state/operator-signability.json` confirms wallet/provider readiness, payload integrity, and beat permission.

### 7. Xverse Helper Bugs
Fixed: direct-link artifact loading, stale default payload, timeout handling, query-param loader no longer wipes loaded signal payload.

## Failures This Chat Uncovered

### A. Beat Permission Failure
GameStop story prepared for deal-flow beat — filing failed because wallet is not allowed to claim/publish that beat. System allowed a non-publishable candidate to travel all the way to manual signing.

### B. Wallet/Provider Late Discovery
Xverse helper hung on connect. Wallet/provider readiness was not treated as a preflight requirement.

### C. Payload Integrity Late Discovery
Signed payload was truncated. Helper payload integrity should be validated before signing.

### D. Non-Competitive Candidate Leakage
`aibtc-mcp-server v1.46.0` still surfaced despite being a raw release-note-shaped story.

## Signal Drift Prevention (learned 2026-04-24)

The main failure mode is not syntax. It is story-shape reuse discovered too late.

Hard rules:
- blocked shapes must be extracted fresh from `docs/homepage-brief-snapshots.md` every day
- `docs/target-beat-rules.md` is the active Step 3 output for blocked shapes; do not use a hardcoded list
- Step 5 selects anchors only from the Step 4 verified source list
- `docs/helper-bugs.md` must be read before drafting so Step 5 applies lessons, not discovers them
- every new helper or live filing blocker must be logged in `docs/helper-bugs.md` immediately

Before writing any JSON, answer these:
- Does this candidate repeat a blocked story shape from today or the last 48h brief window?
- Is this just the same story with fresher numbers?
- Does this reuse the same metric family, comparison frame, or operator implication as a prior posted brief winner?
- Does this reuse the same source family + metric family + implication family as a previously rejected recent filing?

If any answer is `yes`, stop and switch claim families before writing JSON.

Story-family rule:
- changing the headline alone is not enough
- changing only numbers, timestamps, or wording is not enough
- if a story family is blocked by a prior brief winner or recent rejected filing, treat that family as burned for the day

Known `bitcoin-macro` blocked families from live operation:
- `blocks remaining + retarget % + carry desk consequence`
- `top pools concentration + low fee floor + concentration risk`

Safe pivots after a `bitcoin-macro` collision:
- ETF / AUM / filing flow
- Lightning channel structure
- block-fee volatility
- hashrate swing with a distinct non-retarget frame

## JSON Hard Rules
- `beat_slug` must be first tag; all tags lowercase slugs
- `body` == `analysis` character-for-character
- include `CLAIM:`, `EVIDENCE:`, and `IMPLICATION:`
- include non-empty `disclosure`
- disclosure names model + every doc checked + date + what was verified from which source
- run prior-brief story-shape collision and rejected-shape collision checks before returning JSON

## Root Process Problem
Build has been discovering critical constraints too late. Hard gates needed earlier for: publishability, wallet/provider readiness, helper payload integrity, competitiveness for In Brief, freshness, and story-family drift.

## What Must Exist Next
1. Publishability preflight before filing-ready generation (beat permission, wallet match)
2. Competitive gate before signable queue (human-news shape, operator consequence, beat slot strength)
3. Freshness gate before ranking (prune stale prior-day dry-runs)
4. Fail-closed runtime: if no candidate is publishable + competitive + fresh, say so and stop generating approval instructions

## Resume Note
If a future chat resumes work:
- open `AGENTS.md` first
- then open required docs for the target beat
- check beat capacity with: `node skills/beat-capacity-status/scripts/beat-capacity-status.mjs`

If the agent starts suggesting technically valid but weak or duplicate-shaped stories again, treat that as regression against this memory file.
