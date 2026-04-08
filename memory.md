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
Primary checklist docs:
- `docs/build-checklist.md`
- `docs/in-brief-success-checklist.md`
- `docs/brief-win-rules.md`

This file exists because the checklist alone did not capture late-discovery failures from real operation.

## Project Boundary
This memory file is for `aibtcagent` only.

Do not mix context from:
- `Kizuna`
- `MkondoMe`
- `Synthesis`
- other agent repos in the workspace

Unless the user explicitly switches projects.

If another memory index mentions:
- Kizuna pre-fund
- synthesis-agent
- unrelated signal tooling

that is not active context for this repo by default.

For `aibtcagent`, the active objective is:
- win `In Brief`
- earn sats
- only surface candidates that are publishable, competitive, and fresh

## Current Reality
The real KPI is:
- stories that make `In Brief`
- sats that actually reach the wallet

Not enough:
- approval only
- technically valid submission artifacts
- "ready to file" candidates that are not actually competitive or publishable

## What Has Been Built
- Daily reporting with top KPI emphasis on `In Brief` and sats
- Competitor review and brief analysis
- Manual brief ingest and brief-history learning
- Filing queue and operator summary
- Xverse helper pages for signal filing and heartbeat
- Outcome checker and reward sync
- Candidate scoring with style memory, competitor coverage, and same-beat packaging adjustments

## Important Recent Fixes

### 1. Competitor Coverage
Implemented:
- tracked competitor histories fetched in parallel during ranking
- `competitorCoverage` persisted into ranked candidates and filing queue items
- scoring rules:
  - `2+ competitors` on same story => boost + differentiation warning
  - `1 competitor` => competition note only
  - `0 competitors` and approval-ready => unique-pick bonus

### 2. Daily Scoreboard
Daily reports now show:
- `In Brief wins`
- `Approved but not briefed`
- `Wallet sats realized`
- `Days since last brief`
- `Days since last on-chain payout`

### 3. Raw Release-Note Penalty
Fixed:
- raw release-note stories without operator consequence are no longer allowed to rank as `file`

### 4. Stale Dry-Run Pruning
Fixed:
- prior-day dry-run submissions are pruned before ranking for the current report date
- this prevents yesterday's stale candidates from leaking into today's queue

### 5. Filing Queue Tightening
Fixed:
- only candidates with final decision `file` can become `awaiting_human_approval`
- `hold` candidates no longer masquerade as signable queue items

### 6. Operator Summary Consistency
Fixed:
- operator summary now reflects the actual filing queue state
- when no signable candidate exists, it says so and stops printing approval instructions

### 7. Operator Signability Preflight
Fixed:
- the filing queue now fails closed unless `data/state/operator-signability.json` confirms wallet/provider readiness, payload integrity, and beat permission
- approval re-checks those gates so stale queue state cannot produce a non-signable filing-ready artifact

### 7. Xverse Helper Bugs
Fixed:
- direct-link artifact loading for filing-ready candidates
- stale default payload issue
- timeout handling for connect/sign requests
- query-param loader no longer wipes the loaded signal payload

## Failures This Chat Uncovered

These were discovered too late and should have failed much earlier:

### A. Beat Permission Failure
Observed:
- GameStop story was prepared for `deal-flow`
- filing failed because the current wallet is not allowed to claim/publish that beat
- API returned:
  - `You must claim beat "deal-flow" before filing signals on it`
  - then
  - `Only the designated Publisher can perform this action`

Meaning:
- the system allowed a non-publishable candidate to travel all the way to manual signing

### B. Wallet/Provider Late Discovery
Observed:
- Xverse helper initially hung on connect
- helper provided poor diagnostics until timeout handling was added

Meaning:
- wallet/provider readiness was not treated as a preflight requirement

### C. Payload Integrity Late Discovery
Observed:
- signed payload was truncated
- beat claim mode and signal mode had confusing state interactions

Meaning:
- helper payload integrity should have been validated before signing

### D. Non-Competitive Candidate Leakage
Observed:
- `aibtc-mcp-server v1.46.0` still surfaced despite being a raw release-note-shaped story

Meaning:
- the system was still overvaluing approval-ready technical cleanliness over slot-winning story quality

## Root Process Problem
The build has been discovering critical constraints too late.

We need earlier hard gates for:
- publishability by current identity
- wallet/provider readiness
- helper payload integrity
- competitiveness for `In Brief`
- freshness for the current day

## What Must Exist Next

### Publishability Preflight
Before a candidate becomes filing-ready, verify:
- beat is publishable by the current operator identity
- helper can connect to the wallet
- current wallet matches the intended filing identity

### Competitive Gate
Before a candidate enters the signable queue, verify:
- headline is human-news shaped
- story has operator consequence
- story is broader/stronger than narrow artifact fragments
- story is still strong enough to win a beat slot today

### Freshness Gate
Before a candidate is even ranked:
- stale prior-day dry-runs should be removed or ignored

### Fail-Closed Runtime
If no candidate is both:
- publishable
- competitive
- fresh

then the runtime should say:
- there are zero signable candidates
- source new stories

and stop generating approval instructions

## Immediate Next Repair Plan
1. Add a `publishability preflight` contract before filing-ready generation
2. Make beat permission an explicit runtime check, not a submit-time surprise
3. Add helper self-check diagnostics for wallet/provider presence before connect
4. Add a hard "human-news headline" gate before any candidate can be `file`
5. Record late-discovery failures as regression tests, not just notes

## Resume Note
If a future chat resumes work:
- open this file first
- then open:
  - `docs/in-brief-success-checklist.md`
  - `docs/build-checklist.md`
  - `docs/brief-win-rules.md`

If the agent starts suggesting technically valid but weak stories again, treat that as regression against this memory file.
