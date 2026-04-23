# Workflow

## Purpose
This is the canonical operator workflow for the repo.
Use it to understand what happens each day and in what order.

## Document Role

- Category: `canonical`
- Scope: daily operating flow
- Use this when: you need the shortest accurate map of how the agent should move through prep, packaging, filing, and learning
- Do not use this as: a replacement for task-level contracts or the living implementation record

This file is intentionally shorter than `docs/build-plan.md` and more operational than `docs/architecture.md`.

## Workflow Goal

This workflow should maximize:

- `In Brief` conversion
- sats earned
- payout-quality signal selection
- repeatable operator behavior

Hard business rule:

- only these 3 beats are in scope for signal creation and filing: `aibtc-network`, `bitcoin-macro`, `quantum`
- every filed signal should be drafted and selected for `brief_included`, not merely `approved`
- `approved_not_in_brief` is a failed business outcome for signal creation
- helper-safe JSON and validator-safe payloads are necessary guardrails, but they are not the success condition
- if a signal looks technically valid but unlikely to win a brief slot on its beat, hold it or rewrite it rather than treating it as ready

This workflow should minimize:

- chat-only drafting
- duplicate filings
- cooldown waste
- weak signals added just to reach a count target

## Workflow Loading Order

The attached workflow document argues that the agent should not load all instructions at once.

Use this loading order:

1. `AGENTS.md`
2. `docs/architecture.md`
3. `docs/company-operating-model.md`
4. `docs/workflow.md`
5. `docs/build-plan.md` when current implementation state matters
6. detailed task docs only for the active phase

That keeps the active context smaller while still making the right detail available when needed.

## Daily Operating Model

The agent has four operating phases:

1. Context refresh
2. Signal packaging
3. Human signing and filing
4. Outcome learning

Each phase has a different purpose.
Do not collapse them into one chat task.

## Operating Roles

The company runs through four core loop jobs and one support job.

Core loop jobs:

1. `Outcome Updater`
2. `Outcome Analyst`
3. `Create Signal`
4. `Signal Filer`

Support job:

5. `Helper Maintainer`

Use `docs/company-operating-model.md` for the full job descriptions.
This workflow defines where each job acts in the day.

## Phase 1: Context Refresh

Goal:

- build context for the current cycle
- update memory and outcomes
- identify the strongest lanes before drafting

Canonical doc:

- `AGENTS.md`
- `docs/build-plan.md` for current implementation constraints when needed

Primary runtime:

- `npm run agent-daily -- --date YYYY-MM-DD`

What happens:

1. confirm repo boundary
2. `Outcome Updater` reads the latest brief, publisher work, publisher notes, prior outcomes, helper bugs from yesterday, and beat availability
3. refresh editorial and strategy memory from those inputs
4. update reports and state artifacts
5. generate or refresh ranked candidates
6. carry forward current implementation constraints from `build-plan.md` when they affect behavior

Output:

- daily report
- refreshed state and memory
- ranked queue
- filing queue
- today's operating picture for drafting

## Phase 2: Signal Packaging

Goal:

- turn the strongest surviving candidates into human-reviewable signal packages
- keep only candidates that still look capable of winning `In Brief` after beat/editor constraints, current-cycle context, and displacement pressure are applied

Skill loop:

1. `Outcome Analyst`
2. `Create Signal`

Rule:

- Before `create-signal`, the loop must review the latest brief, the active beat editor guidance, recent `helper-errors.jsonl`, and recent same-beat outcome/publisher notes.
- Helper-ready JSON is not a drafting shortcut; it is the final output of that reviewed loop.
- For `quantum`, the loop must also kill proposal-thread-only source sets, PR-page-only source sets, and known saturated migration/exposure clusters before helper-ready JSON is emitted.

Canonical doc:

- `docs/daily-signal-job.md`

What happens:

1. read `AGENTS.md` and the required docs for the target beat first
2. `Outcome Analyst` turns the latest brief, publisher work, same-beat outcomes, and helper bugs into today's drafting rules
3. `Create Signal` reviews the latest dated brief artifact, beat editor guidance, recent helper-errors.jsonl entries, open beats, duplicate clusters, and recent signal outcomes before drafting
4. apply editorial memory and hard pre-filing checks
5. reject duplicates, stale stories, and weak packaging
6. reject overlong bodies before helper handoff; keep filing copy in the safer 800-900 character range and shorten `Directive:` first when trimming is needed
7. keep only strong candidates
8. write human-readable signal packages

Rule:

- produce up to `6`, not forced `6`
- use `Body`, not `Analysis`, as the canonical content field
- package only signals that still look plausibly brief-worthy after current-cycle context is loaded
- do not package a signal just because it is valid JSON or likely to pass the helper; package it only if it still has a credible path to `brief_included`
- helper-ready JSON should only be emitted after the repo can prove those context reviews happened, not just after payload validation passes

Output:

- `data/reports/signals/YYYY-MM-DD.md`

## Phase 3: Human Signing And Filing

Goal:

- submit one approved signal safely without wasting cooldown windows

Canonical docs:

- root `AGENTS.md`
- `docs/signal-sourcing-checklist.md`

What happens:

1. `Signal Filer` confirms `news_check_status`
2. `Signal Filer` confirms candidate is approved and signable
3. `Signal Filer` opens helper
4. `Signal Filer` verifies normalized payload
5. human signs once
6. `Signal Filer` verifies landed status if timeout or missing signal ID occurs
7. `Helper Maintainer` handles helper bugs, server issues, or missing guardrails discovered during filing

Rule:

- filing is a controlled handoff, not a drafting step
- the agent prepares the package
- the human signs
- a wasted cooldown window is a workflow failure, not a small runtime annoyance
- helper maintenance is a support function, not part of normal drafting or filing judgment

## Phase 4: Outcome Learning

Goal:

- learn from what actually happened, not from assumptions

Primary runtime:

- `src/outcomes/checker.ts`
- optimization and learning modules in `src/loop` and `src/learning`

What happens:

1. `Outcome Updater` checks published, approved, rejected, and unresolved filings
2. `Outcome Updater` records status and failure mode
3. `Outcome Updater` refreshes memory and notes helper failures from the prior cycle
4. `Outcome Analyst` promotes winner shapes
5. `Outcome Analyst` demotes losing patterns and updates future drafting rules

Rule:

- `approved_not_in_brief` is a failed business outcome
- every rejection should tighten future behavior
- outcome review should change future workflow, not only future wording
- future signal drafting rules should be pushed toward higher `brief_included` odds, not just higher helper-pass or approval-pass rates
- treat this phase as the repo equivalent of `record-signal-outcome`, not as an optional afterthought

## Short Workflow Map

`agent-daily`
-> refresh memory and outcomes
-> `Outcome Updater` posts today's operating picture
-> `Outcome Analyst` posts today's drafting rules
-> fetch and score candidates
-> `Create Signal` selects and packages one strong candidate
-> write queue artifacts
-> human review
-> approve one candidate
-> `Signal Filer` uses helper/manual sign path
-> helper/manual sign and file
-> verify result
-> `Helper Maintainer` fixes helper failures and adds guardrails when needed
-> check outcomes later
-> update memory for next cycle

## What This Workflow Is Trying To Prevent

- the agent inventing signals in chat
- the agent skipping state and outcome review
- the agent filing without cooldown checks
- the agent padding weak candidates to hit a count target
- the repo having different workflow definitions in different docs

## Relationship To Other Docs

- `docs/architecture.md` explains how the system is structured
- `docs/company-operating-model.md` explains the jobs, their responsibilities, and handoffs
- `AGENTS.md` is the live filing and context-refresh contract
- `docs/daily-signal-job.md` is the detailed packaging contract
- `docs/build-plan.md` is the living implementation document for what has been done and what exists now

## Relationship To The Attached Workflow Document

The attached document argues for:

- minimal top-level instructions
- explicit workflows
- iterative refinement after failures
- progressive loading of specialized guidance

This workflow applies that by:

- keeping one short canonical daily workflow
- separating prep from packaging and filing
- using `build-plan.md` as current-state implementation memory instead of stuffing all of that detail into the workflow itself
- treating failures as updates to the workflow, not just one-off mistakes
