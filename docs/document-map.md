# Document Map

## Purpose
This file marks which docs are canonical, which are task-level contracts, and which are reference/supporting docs.

Use it to reduce drift and to keep new agent sessions from treating every document like an equal source of truth.

## Canonical Docs

These define the stable top-level operating model.

| Doc | Role | Use |
|-----|------|-----|
| `AGENTS.md` | Canonical startup and filing contract | Open first for current operating rules, required docs, and signal filing behavior |
| `docs/architecture.md` | Canonical architecture doc | Understand the system shape and document layout |
| `docs/company-operating-model.md` | Canonical company roles doc | Understand the operating jobs, role boundaries, and handoffs |
| `docs/workflow.md` | Canonical workflow doc | Understand the daily operator flow |
| `docs/agent-operating-principles.md` | Canonical operating principles doc | Understand the repo-wide behavior rules |

## Living Implementation Docs

These are active and authoritative about current implementation reality.

| Doc | Role | Use |
|-----|------|-----|
| `docs/build-plan.md` | Living implementation document | See what has been done, what exists now, and what constraints are active |
| `docs/in-brief-success-checklist.md` | Living success and progress checklist | See the active goal state and checked implementation work |
| `docs/repo-cleanup-audit.md` | Living cleanup decision log | See the current delete / migrate / keep-temporarily decisions for stale repo paths |

## Task-Level Contract Docs

These define what a specific step must do.

| Doc | Role | Use |
|-----|------|-----|
| `docs/daily-docs-map.md` | Daily prep contract | Follow the prep loop and required outputs |
| `docs/daily-signal-job.md` | Signal packaging contract | Turn prepared context into reviewable signal packages |
| `AGENTS.md` | Filing contract | Follow live filing rules and cooldown-safe behavior |

## Supporting Reference Docs

These sharpen execution but should not override canonical docs or task contracts.

| Doc | Role | Use |
|-----|------|-----|
| `docs/signal-sourcing-checklist.md` | Sourcing and filing reference | Apply sourcing, qualification, and filing checks |
| `docs/brief-win-rules.md` | Editorial reference | Understand what wins brief slots |
| `docs/rejection-rules.md` | Editorial reference | Understand hard reject patterns |
| `docs/brief-winner-tracking.md` | Competitive reference | Track winning styles and repeat winners |
| `docs/beat-editors/*` | Beat-specific editorial references | Apply beat-specific guidance only when working that beat |

## Read Order

If starting fresh:

1. `AGENTS.md`
2. `docs/document-map.md`
3. `docs/architecture.md`
4. `docs/company-operating-model.md`
5. `docs/workflow.md`
6. `docs/build-plan.md`

If doing daily prep:

1. `docs/workflow.md`
2. `docs/daily-docs-map.md`
3. `docs/build-plan.md`

If packaging signals:

1. `docs/workflow.md`
2. `docs/daily-signal-job.md`
3. `docs/signal-sourcing-checklist.md`
4. `docs/build-plan.md`

## Rule

When two docs feel like they conflict:

1. canonical docs decide system shape and default behavior
2. task-level contracts decide the active step
3. the living implementation docs decide what is actually implemented now
4. supporting references help, but do not redefine the contract
