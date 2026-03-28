# AIBTC Agent

Private working repository for an AIBTC onchain signal agent focused on:
- early signal detection
- strict onchain proof
- one-line newsroom submissions
- leaderboard, reward, and reputation optimization

## Start Here Every Day
The first thing to open is:

- [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md)

Step 0 in the checklist is now the first thing that runs every day from tomorrow onwards. It has three sub-steps:

- `0a — Pull data` — forces you to actually look at yesterday's outcome before assuming anything
- `0b — Analyze` — seven specific questions that connect the outcome back to a root cause (was it proof, timing, headline, beat mismatch?)
- `0c — Set strategy` — four sentences written before you open any source, so your sourcing is intentional not random

Daily report files that support Step 0:

- [`data/reports/daily/TEMPLATE.md`](./data/reports/daily/TEMPLATE.md) — reusable template for every day. Six sections:
  What was filed (signal log)
  Outcomes (with running sats and leaderboard)
  What happened (one line per signal)
  What was learned (proof, timing, headline, beat, gate failures)
  Strategy for tomorrow (four decisions written before day ends)
  Running totals (today / week / all time so you can see the trend)
- [`data/reports/daily/2026-03-25.md`](./data/reports/daily/2026-03-25.md) — today's report is already created. Fill in sections 1-4 tonight after your first filing. Section 5 becomes tomorrow morning's Step `0c`.

Tomorrow morning:
- open [`data/reports/daily/2026-03-26.md`](./data/reports/daily/2026-03-26.md)
- run through Step `0`
- write `2026-03-27.md`
- then start sourcing

## Daily Check-In
Do this every day in addition to signal work. Check-ins are free and count toward engagement achievements.

Daily routine:

1. Make sure the agent runs and completes its heartbeat/check-in action for the day.
2. Treat check-ins as separate from signal filing — do both.
3. Verify progress on the public profile or verification endpoints after activity is visible.
4. Aim for consistency first, not bursts:
   - `10` check-ins → `Active`
   - `7` consecutive days → `Weekly Streaker`
   - `100` check-ins → `Dedicated`
5. Re-run free achievement verification after cooldowns:
   - `https://aibtc.com/api/achievements?btcAddress=<your-btc-address>`
   - `https://aibtc.com/api/achievements/verify`

Rules:
- no paid check-in tactics
- no spend-to-earn loops
- consistency beats volume spikes
- signal quality work and daily check-ins should both happen
- if `checkInCount` is not increasing, treat that as an ops problem to fix quickly

## Daily Free Progression Checklist
Use this after the daily heartbeat/check-in. The goal is to improve progression without paying.

- Run the daily heartbeat/check-in
- Confirm heartbeat/orientation state:
  - `https://aibtc.com/api/heartbeat?address=<your-btc-address>`
- Check earned and available achievements:
  - `https://aibtc.com/api/achievements?btcAddress=<your-btc-address>`
- Run free achievement verification:
  - `POST https://aibtc.com/api/achievements/verify`
- Check inbox for free reply opportunities:
  - `https://aibtc.com/api/inbox/<your-btc-address>`
- Check leaderboard visibility and rank:
  - `https://aibtc.com/api/leaderboard`
- If achievement verification is rate-limited or times out:
  - record that it was attempted
  - retry later
  - do not treat it as completed until the endpoint returns a result

Interpretation rules:
- no inbox messages = no free reply opportunity today
- `checkInCount` increasing = daily activity is working
- `achievements: []` = no free progression unlocked yet
- do not spend sats just to force progression
- signal filing and free progression are separate daily tracks; do both

## Approval Check
Never mark a signal as approved just because submission succeeded or a model inferred that it probably won.

Use live evidence only, in this order:

1. Check the approved feed:
   `https://aibtc.news/api/signals?status=approved&limit=100`
2. Search for one of:
   - exact signal ID
   - exact BTC address
   - exact headline
3. If found there, status = `approved`
4. If not found, check the submitted feed:
   `https://aibtc.news/api/signals?status=submitted&limit=100`
5. If found there, status = `pending`
6. If not found, check the rejected feed:
   `https://aibtc.news/api/signals?status=rejected&limit=100`
7. If found there, status = `rejected`
8. If not found in any of the three feeds, status = `unverified` or `needs manual confirmation`

Rules:
- submission response is not proof of approval
- the public agent page alone is not proof of approval
- do not guess from tone, absence, or model confidence
- if no live evidence exists, do not write `approved`

## New Session Prompt
When starting a fresh chat window, point the agent here and use this prompt:

`We need more candidate signals for today. Follow the repo checklist/runbook for the day. Start with docs/signal-sourcing-checklist.md, use docs/first-live-signal.md when evaluating filing readiness, and return only the strongest candidates with file/hold/reject decisions and short reasons.`

If one signal has already been filed today, use this version:

`We already filed today's first signal. We need more candidate signals for today. Follow the repo checklist/runbook for the day, use the current GitHub candidate table as context, and return only the strongest remaining candidates with file/hold/reject decisions and short reasons.`

If there is a pending filed signal and a held follow-up candidate, use this morning prompt:

`README.md is current. Start with README.md, then follow docs/signal-sourcing-checklist.md from Step 0. First, review the pending filed signal and update its outcome if approved, rejected, brief-included, duplicate-loss, or still pending. Use the README Approval Check rules and live evidence only. Do not guess. Then review the held candidate, decide whether it stays on hold or becomes fileable, and search for additional strong candidates for today. Return only the strongest candidates with file/hold/reject decisions and short reasons.`

Current reference context for the latest filed signal cycle:

- Last filed signal ID: `8be9f1ad-d00d-4e43-9fb8-b0cecd879faa` — **submitted** (2026-03-28T04:30Z, pending review)
- Previous approved: `0585da60-6467-4fa0-aad3-f48113ed9b2d` — **approved** (confirmed 2026-03-28)
- Previous approved: `72f6b724-6f18-407f-adca-c78612d23c2b` — **approved** (confirmed 2026-03-27T04:38Z)
- Today's candidate package: [`data/dry-runs/2026-03-28/protocol-update-2026-03-28-001-submission.json`](./data/dry-runs/2026-03-28/protocol-update-2026-03-28-001-submission.json)
- Daily shortlist/report: [`data/reports/daily/2026-03-28.md`](./data/reports/daily/2026-03-28.md)
- Yesterday's report: [`data/reports/daily/2026-03-27.md`](./data/reports/daily/2026-03-27.md)

Candidates remaining today (2026-03-28):

| Candidate | Decision | Beat | Notes |
|---|---|---|---|
| `x402-sponsor-relay-v1.24.0 + v1.25.0` | **FILED** | Infrastructure | Signal ID 8be9f1ad. Submitted 2026-03-28T04:30Z. Pending review. |
| `mcp-server-v1.46.0` | **HOLD** | Infrastructure | zest_enable_collateral — ships actual tool (not just PR). File after 8be9f1ad outcome. |
| `x402-sponsor-relay-v1.26.0` | **HOLD** | Infrastructure | Dashboard redesign only. File if beat stays open and 8be9f1ad approved. |

## What Gets Approved vs Brief-Included
Learned from live signals analysis (2026-03-28). Approval rate on the live feed: ~13%.

**Approved = passed editorial review. Brief-included = selected for the daily compiled brief. These are different outcomes.**

### Top rejection reasons (in order of frequency)
1. **"Signal does not cover aibtc network activity"** — the #1 killer. External BTC price, ETFs, geopolitics, other-chain news all get this. Only internal network events qualify: agent transactions, skill releases, infrastructure changes, onboarding, governance actions, relay/MCP/agent-news releases.
2. **Changelog dump** — pasting release notes without explaining what agents can do now that they couldn't before. Always state the agent consequence explicitly.
3. **Beat flooded** — beats have daily signal limits (typically 3). Check the live feed for how many signals have been approved on your target beat today before filing.
4. **Empty or truncated body** — content cuts off mid-sentence = instant reject.
5. **Wrong beat** — filing external news under Infrastructure, or filing internal metrics under Agent Economy when it belongs on Distribution.

### What gets brief-included (not just approved)
The daily brief picks the **most comprehensive story per beat slot**. Single-release signals get approved but often lose the brief slot to a multi-release story.

**Pattern that wins the brief slot:** cover two releases that shipped the same day as one story.
- Precedent: `cf40c472` covered x402 relay v1.35.0 + v1.35.1 in one signal → brief_included
- Precedent: `2f48f5ed` covered two HODLMM PR merges together → brief_included
- Our single-release signals (72f6b724, 0585da60) got approved but not brief_included because another agent filed a broader x402 story

**Apply this rule:** if two related releases shipped within 12 hours of each other, file them as one signal.

### Beat status as of 2026-03-28
- `infrastructure` — open, 0 approvals today (our primary lane)
- `agent-skills` — flooded (daily limit hit)
- `deal-flow` — flooded (daily limit hit)
- `governance` — open
- `onboarding` — open
- `agent-economy` — open but competitive

### Beat slug reference (post v1.17.0 restructuring)
`dev-tools` no longer exists. Use `infrastructure` for relay/MCP/agent-news releases.

Active slugs: `infrastructure`, `agent-economy`, `agent-skills`, `agent-trading`, `agent-social`, `deal-flow`, `governance`, `onboarding`, `security`

---

Use this doc map during operation:

- Before any work session: [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md) (Step `0`, then Steps `1-2`)
- Evaluating a candidate: [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md) (Steps `3-7`) + [`docs/first-live-signal.md`](./docs/first-live-signal.md)
- Filing: [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md) (Step `8`) + [`docs/live-ops-loop.md`](./docs/live-ops-loop.md)
- Something is wrong or unclear: [`docs/prd.md`](./docs/prd.md)
- Tracking outcomes: [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md) daily log + [`docs/outcome-schema.md`](./docs/outcome-schema.md)
- Iterating strategy: [`docs/learning-loop.md`](./docs/learning-loop.md) + [`docs/beat-strategy.md`](./docs/beat-strategy.md)

## Earning & Progression (All Free — You Earn, Not Pay)

- [Viral Claims](https://aibtc.com/api/claims/viral): GET for instructions, POST to claim tweet reward (free)
- [Claim Code](https://aibtc.com/api/claims/code): GET to validate code, POST to regenerate (free)
- [Achievements](https://aibtc.com/api/achievements): GET achievement definitions or check earned achievements (free)
- [Achievement Verify](https://aibtc.com/api/achievements/verify): GET for docs, POST to verify on-chain activity and unlock achievements (free)
- [Level System](https://aibtc.com/api/levels): GET level definitions and how to advance (free)
- [Leaderboard](https://aibtc.com/api/leaderboard): GET ranked agents by level (free)

## Current Status
The repository is now in MVP implementation and verification.

MVP complete note:
- one lane works end to end
- daily reporting and optimization snapshots are active
- the next step is controlled live iteration, not broad new feature work

Core product docs are in place:
- [`docs/concept-note.md`](./docs/concept-note.md)
- [`docs/prd.md`](./docs/prd.md)
- [`docs/json-schema.md`](./docs/json-schema.md)
- [`docs/setup.md`](./docs/setup.md)
- [`docs/architecture.md`](./docs/architecture.md)
- [`docs/build-plan.md`](./docs/build-plan.md)
- [`docs/build-checklist.md`](./docs/build-checklist.md)
- [`docs/testing-plan.md`](./docs/testing-plan.md)
- [`docs/beat-strategy.md`](./docs/beat-strategy.md)
- [`docs/learning-loop.md`](./docs/learning-loop.md)
- [`docs/live-ops-loop.md`](./docs/live-ops-loop.md)
- [`docs/outcome-schema.md`](./docs/outcome-schema.md)
- [`docs/post-mvp-roadmap.md`](./docs/post-mvp-roadmap.md)
- [`docs/sources.md`](./docs/sources.md)
- [`docs/signal-sourcing-checklist.md`](./docs/signal-sourcing-checklist.md)

## Product Goal
Build an AIBTC agent that:
- detects non-obvious onchain events early
- verifies causality with public proof
- submits only newsroom-quality one-line signals
- learns from approvals, rewards, activity, and published briefs over time

## MVP Direction
The first build focuses on:
- one primary beat
- one strong signal lane
- strict validation and rejection logic
- submission-ready output packaging
- daily learning and reporting
- GitHub-hosted execution for the lowest-cost runtime path

## Repo Structure
```text
docs/    product, setup, architecture, strategy, and testing docs
data/    state, logs, outcomes, and experiments
src/     signal detection, validation, packaging, reporting, and optimization logic
tests/   node-based integration and behavior tests
```

The current implementation covers:
- one production-style `infrastructure` lane (formerly `dev-tools`, renamed in v1.17.0 beat restructuring)
- strict validation and pre-submission gating
- filesystem-backed memory and outcome tracking
- daily reporting in markdown and JSON
- daily optimization snapshots and next-day recommendations

## Build Rule
Build the decision system first.

That means:
- proof first
- rejection first
- one lane before many lanes
- learn from outcomes before expanding scope
