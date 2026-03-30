# Agent Instructions

See [`AIBTC-AGENTS.md`](./AIBTC-AGENTS.md) for the shortest code map and runtime navigation.

See [`docs/in-brief-success-checklist.md`](./docs/in-brief-success-checklist.md) for the active build checklist and success definition.

## Key Rules

- Active project lock: this repo is `aibtcagent` only. Do not use context, memory, code paths, or checklists from `Kizuna`, `MkondoMe`, `Synthesis`, or any other workspace repo unless the user explicitly says to switch projects.
- Start every new task here by opening `memory.md` and `docs/in-brief-success-checklist.md` before making assumptions.
- Do not trust summaries. Read the files in `src/` and the artifacts in `data/` directly.
- Do not mark checklist items complete unless the code, generated artifacts, and verification all exist.
- Do not take wallet or signing actions. Those are human-only.
- When another agent reports a change, follow the collaboration rule in `AIBTC-AGENTS.md`.
