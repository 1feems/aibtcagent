# Agent Operating Principles

## Purpose
This doc is the short operating philosophy for keeping the repo agent effective.
Use it to reduce workflow sprawl and to keep the system behaving like an operator, not a chatty drafter.

## Document Role

- Category: `canonical`
- Scope: repo-wide operating behavior
- Use this when: you need the default behavioral rules for how the agent should think and load context
- Do not use this as: a task contract or implementation checklist

## Core Principles

1. Runtime first, chat last.
Use repo commands, validators, and artifact paths before free-form reasoning. Chat should explain or review what the runtime produced, not replace it.

2. Minimal persistent instructions.
Keep top-level instructions short and durable. Put specialized workflows in focused docs or skills so they are loaded only when needed.

3. One canonical contract per step.
Each operating step should have one source of truth for inputs, outputs, and pass/fail gates. If two docs disagree, the agent will drift.

4. Teach, then codify.
Do not freeze a workflow just because it sounds right. First observe a few successful runs, then encode the repeated winning pattern into docs, code, or validation rules.

5. Quality beats quota.
`In Brief` wins and sats matter more than raw filing count. Never force weak candidates just to hit a daily maximum.

6. Deterministic checks before generation.
Duplicate checks, already-in-brief checks, cooldown checks, source validation, and proof anchors should run before any drafting or packaging.

7. Outcome feedback must change behavior.
Rejected, approved-not-in-brief, duplicate, and timeout outcomes are not admin details. They are training signals that should tighten future selection and packaging.

## What This Means For This Repo

- Prefer `body` as the canonical content field. Treat `analysis` only as a compatibility alias.
- Treat `news_check_status` as mandatory before every filing attempt.
- Treat timeout verification as part of the filing contract, not an optional recovery step.
- Treat `up to 6` as capacity, not as a quota that must be filled.
- Keep daily prep as the context-building step and signal packaging as the narrower follow-on step.
- Treat `docs/build-plan.md` as living implementation memory for what has been done and what exists now.
- Avoid duplicating the same workflow guidance across many long docs unless one of them is clearly marked canonical.

## Anti-Patterns

- Requiring the agent to re-read large overlapping docs every turn.
- Keeping conflicting field names in active docs.
- Mixing strategic guidance with low-level filing mechanics in the same checklist.
- Letting chat invent signals when the repo already has a creation and validation path.
- Measuring success by approval count or file count instead of `In Brief` conversion and sats.

## Practical Rule
If a new instruction makes the agent more verbose, more duplicative, or more likely to hand-write outputs that the runtime can already validate, it is probably the wrong instruction.
