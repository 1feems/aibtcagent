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

## Workflow (7 Steps — AGENTS.md)
1. Check beat capacity before anything else
2. Check what already won (homepage-brief-snapshots.md) and what failed (publisher-feedback-board.md); update daily-brief-source-comparison.md
3. Load beat editor file for target beat only — extract 90+ checklist and instant rejection triggers
4. Find and verify a Tier 1 source that resolves to the exact claim — HOLD if none
5. Build signal: headline 119 chars max with accepted anchor, body 500-900 chars in CLAIM/EVIDENCE/IMPLICATION format
6. Validate: helper syntax + winner shape/duplicate guard + beat 90+ checklist — all three must pass
7. File only when filing_ready=true

If any required doc for the target beat is unread return hold.

## What Has Been Built
- Daily reporting with top KPI emphasis on In Brief and sats
- Competitor review and brief analysis
- Manual brief ingest and brief-history learning
- Filing queue and operator summary
- Xverse helper pages for signal filing and heartbeat
- Outcome checker and reward sync
- Candidate scoring with style memory, competitor coverage, and same-beat packaging adjustments
- Beat capacity status skill (skills/beat-capacity-status/scripts/beat-capacity-status.mjs)
- 3-check validation gate (helper syntax, winner shape, beat 90+ checklist)

## Important Recent Fixes

### 1. Competitor Coverage
- Tracked competitor histories fetched in parallel during ranking
- competitorCoverage persisted into ranked candidates and filing queue items
- Scoring: 2+ competitors means boost + differentiation warning; 0 competitors + approval-ready means unique-pick bonus

### 2. Daily Scoreboard
Reports now show: In Brief wins, Approved but not briefed, Wallet sats realized, Days since last brief, Days since last on-chain payout

### 3. Raw Release-Note Penalty
Raw release-note stories without operator consequence no longer rank as file.

### 4. Stale Dry-Run Pruning
Prior-day dry-run submissions pruned before ranking to prevent stale candidates leaking into today's queue.

### 5. Filing Queue Tightening
Only candidates with final decision file can become awaiting_human_approval. hold candidates no longer masquerade as signable queue items.

### 6. Operator Signability Preflight
Filing queue fails closed unless data/state/operator-signability.json confirms wallet/provider readiness, payload integrity, and beat permission.

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
aibtc-mcp-server v1.46.0 still surfaced despite being a raw release-note-shaped story.

## Root Process Problem
Build has been discovering critical constraints too late. Hard gates needed earlier for: publishability, wallet/provider readiness, helper payload integrity, competitiveness for In Brief, and freshness.

## What Must Exist Next
1. Publishability preflight before filing-ready generation (beat permission, wallet match)
2. Competitive gate before signable queue (human-news shape, operator consequence, beat slot strength)
3. Freshness gate before ranking (prune stale prior-day dry-runs)
4. Fail-closed runtime: if no candidate is publishable + competitive + fresh, say so and stop generating approval instructions

## Resume Note
If a future chat resumes work:
- open AGENTS.md first
- then open required docs for the target beat
- check beat capacity with: node skills/beat-capacity-status/scripts/beat-capacity-status.mjs

If the agent starts suggesting technically valid but weak stories again, treat that as regression against this memory file.
