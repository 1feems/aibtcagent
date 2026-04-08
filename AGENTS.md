# Agent Instructions

See [`AIBTC-AGENTS.md`](./AIBTC-AGENTS.md) for the shortest code map and runtime navigation.

See [`docs/in-brief-success-checklist.md`](./docs/in-brief-success-checklist.md) for the active build checklist and success definition.

## Executor Mode

When running the agent loop inside a Claude Code session:

1. Run `npm run agent-daily -- --date YYYY-MM-DD` first. Do NOT reason about what to do before running it.
2. Read the stdout. Report what the code produced.
3. Do NOT generate signals, headlines, or analysis in chat. The code does that.
4. If the run prints `SLATE EMPTY`: the correct action is to write JSON candidate files to `data/manual-submissions/{date}/` and re-run — not to reason about what signals might work.
5. If you find yourself typing a signal headline or analysis in a response instead of running a command, stop. Execute the command instead.

Slipping into chat-reasoning mode when the pipeline is empty is a behavioral error, not a valid recovery. The loop recovers by writing files and re-running.

## Key Rules

- Active project lock: this repo is `aibtcagent` only. Do not use context, memory, code paths, or checklists from `Kizuna`, `MkondoMe`, `Synthesis`, or any other workspace repo unless the user explicitly says to switch projects.
- Start every new task here by opening `memory.md` and `docs/in-brief-success-checklist.md` before making assumptions.
- Do not trust summaries. Read the files in `src/` and the artifacts in `data/` directly.
- Do not mark checklist items complete unless the code, generated artifacts, and verification all exist.
- Do not take wallet or signing actions. Those are human-only.
- When another agent reports a change, follow the collaboration rule in `AIBTC-AGENTS.md`.
