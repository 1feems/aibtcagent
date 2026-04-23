# Architecture

## Purpose
This is the canonical high-level architecture doc for the repo.
Use it when you need to understand how the agent is structured without reading the full build plan.

## Document Role

- Category: `canonical`
- Scope: system shape and doc layout
- Use this when: you need the shortest accurate map of how the agent is organized
- Do not use this as: the only source for step-by-step task execution or current implementation history

This file exists because architecture was previously spread across `README.md`, the root agent instructions, `docs/build-plan.md`, and task-specific docs.

## Design Goal
Build an agent that behaves like an operator:

- it reads durable repo state instead of relying on chat memory
- it uses deterministic checks before drafting
- it packages only strong, fileable signals
- it learns from outcomes and changes future behavior

This follows the principle from the attached workflow document: keep top-level context minimal, keep workflows explicit, and only load specialized guidance when needed.

## Document Layout

The repo should be read in layers, not as one giant instruction blob.

Top-level document stack:

1. `README.md` for repo intent and startup orientation
2. `docs/architecture.md` for the system map
3. `docs/company-operating-model.md` for the company jobs and handoffs
4. `docs/workflow.md` for the daily operating flow
5. `docs/build-plan.md` for the living implementation record of what has been done and what exists now
6. task-specific docs only when the current step needs them

This mirrors the attached workflow document:

- minimal persistent context at the top
- explicit workflow documents
- deeper instructions loaded only when the step requires them

## Business Goal

The architecture exists to improve business outcomes, not just code organization.

Primary outcomes:

- more signals published in `In Brief`
- more sats earned
- more consistent leaderboard performance

Architectural choices should therefore prefer:

- winner-style selection over raw volume
- deterministic rejection of weak candidates
- faster access to current implementation truth
- cleaner handoff from machine packaging to human signing

## System Shape

The repo has five layers:

1. Orchestration
2. Detection and candidate creation
3. Validation and queueing
4. Human signing and filing handoff
5. Outcome learning and optimization

## Operating Company Shape

The company should be organized as one operating agent with explicit jobs before it is split into many Paperclip agents.

Core jobs:

1. `Outcome Updater`
2. `Outcome Analyst`
3. `Create Signal`
4. `Signal Filer`

Support job:

5. `Helper Maintainer`

Why this shape:

- the main loop is sequential, not parallel-first
- each job has a distinct input and output
- publisher work, brief state, helper bugs, and open beats need a named owner
- helper maintenance is real work, but it should not be mixed into normal filing

The detailed role descriptions live in `docs/company-operating-model.md`.

## Layer 1: Orchestration

Primary entrypoints:

- `src/agent/run-daily.ts`
- `.github/workflows/agent-daily.yml`

Responsibility:

- run the daily loop
- refresh state
- trigger candidate generation
- produce queue artifacts
- persist runtime history

This is the top-level runtime. Chat sessions are not the runtime.

## Layer 2: Detection And Candidate Creation

Primary modules:

- `src/loop/fetch-and-run.ts`
- `src/prep/candidate-generator.ts`
- `src/prep/create-signal.ts`
- `src/sources/*`

Responsibility:

- fetch live events and source material
- normalize them into candidate inputs
- create canonical signal artifacts
- attach evidence, impact framing, and metadata

Architectural rule:

- candidate creation should produce structured artifacts, not loose prose
- `create_signal_artifact` is the canonical creation boundary

## Layer 3: Validation And Queueing

Primary modules:

- `src/filing/validate-artifact.ts`
- `src/filing/filing-gate-validator.ts`
- `src/scoring/candidate-queue.ts`
- `src/filing/queue.ts`
- `src/filing/signal-contract.ts`

Responsibility:

- reject weak, duplicate, stale, or malformed candidates
- score survivors against brief-win probability
- produce approval-ready queue outputs
- normalize filing payload contracts

Architectural rule:

- deterministic gates run before filing promotion
- queue output is fail-closed when signability or proof is missing

## Layer 4: Human Signing And Filing Handoff

Primary modules and tools:

- `src/filing/approve.ts`
- `tools/xverse-register/file-signal.html`
- `src/filing/helper-server.ts`

Responsibility:

- approve a candidate for filing
- produce filing-ready payloads
- enforce live filing contract expectations
- support manual signing without letting chat improvise payloads

Architectural rule:

- the repo prepares the filing package
- the human signs
- `body` is canonical
- `news_check_status` is mandatory before post

## Layer 5: Outcome Learning And Optimization

Primary modules:

- `src/outcomes/checker.ts`
- `src/loop/optimization.ts`
- `src/learning/*`
- `src/intelligence/strategy-memory.ts`

Responsibility:

- check published and rejected outcomes
- update memory and strategy state
- promote winner shapes
- demote losing patterns

Architectural rule:

- approved-but-not-in-brief is not treated as success
- outcome memory must change future queue behavior

## Core Data Flow

The intended flow is:

1. Read durable memory and current cycle artifacts
2. Fetch and normalize raw candidate inputs
3. Create canonical signal artifacts
4. Validate and score them
5. Queue only signable, high-quality survivors
6. Approve one for human signing
7. File through helper/manual signing path
8. Check outcomes and write lessons back into repo state

## Sources Of Truth

Use these by role:

- Runtime map: `docs/architecture.md`
- Live filing contract: `AGENTS.md`
- High-level operating rules: `docs/agent-operating-principles.md`
- System map: `docs/architecture.md`
- Daily operator flow: `docs/workflow.md`
- Daily prep contract: `docs/daily-docs-map.md`
- Signal packaging contract: `docs/daily-signal-job.md`
- Current build and enforcement details: `docs/build-plan.md`

Rule:

- `build-plan.md` remains the living implementation document for what has been done and what exists now
- this file is the shorter system map
- task docs should not redefine architecture

## Recommended Read Order By Intent

If the goal is onboarding:

1. `README.md`
2. `docs/architecture.md`
3. `docs/company-operating-model.md`
4. `docs/workflow.md`
5. `AGENTS.md`

If the goal is understanding current implementation reality:

1. `docs/build-plan.md`
2. `docs/architecture.md`
3. relevant `src/*` files

If the goal is improving signal output:

1. `docs/workflow.md`
2. `docs/company-operating-model.md`
3. `docs/in-brief-success-checklist.md`
4. `docs/daily-docs-map.md`
5. `docs/daily-signal-job.md`
6. `docs/build-plan.md`

## Architectural Principles

1. Runtime first, chat last.
2. Keep top-level instructions short.
3. One canonical contract per step.
4. Prefer deterministic checks before generation.
5. Treat outcomes as feedback, not bookkeeping.
6. Optimize for `In Brief` wins and sats, not raw filing count.

## Anti-Patterns

- using chat as the primary workflow engine
- duplicating the same workflow rules across many docs
- mixing architecture, daily operations, and filing mechanics in one giant file
- treating six signals as a quota instead of a ceiling
- keeping active docs on both `analysis` and `body`

## Relationship To The Attached Workflow Document

The attached document is not a literal repo workflow.
It is a set of agent-design principles:

- less persistent context
- progressive disclosure
- explicit workflows
- iterative refinement after failures

This architecture adopts those principles by keeping system design here, detailed tasks in smaller docs, and specialized guidance in narrower files.
