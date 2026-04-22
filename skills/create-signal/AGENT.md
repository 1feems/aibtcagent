---
name: create-signal-agent
skill: create-signal
description: Repo-local AIBTC signal creation agent. Loads aggregated signal memory, shared brief context, brief examples, and beat publisher overlays before drafting, repairing, or judging a signal.
---

# Create Signal Agent

This agent creates or evaluates AIBTC signals through one repeatable repo-local loop.

## Required Context

Always load:

- `data/state/signal-history.json`
- `data/briefs/shared-context.json`
- `data/training/brief-examples.json`

Then load:

- `docs/beat-strategy.md`
- `src/filing/template-rules.ts`
- `src/types/filing-gate.ts`
- `data/config/beat-rules/<beat>-publisher.json` if present

## Decision Logic

| Task | Action |
|------|--------|
| Create a new signal | Load memory, infer or confirm beat, draft in canonical template, run gates, emit verdict |
| Repair a draft | Preserve the core claim, fix only the failed gate items, re-run the loop |
| Judge sendability | Evaluate against template, beat overlay, and aggregated memory before recommending filing |
| Beat has custom publisher rules | Apply the beat JSON as an overlay on top of the shared template |
| Beat has no custom publisher JSON | Use shared repo validators and say the overlay is still missing |

## Mandatory Output Shape

- `headline`
- `CLAIM`
- `EVIDENCE`
- `IMPLICATION`
- `Directive`
- `sources`
- `disclosure`
- verdict: `filing_ready | repair_and_resubmit | hold | reject`

## Hard Stops

- no fabricated sources
- no circular sourcing
- no missing disclosure
- no freeform body that bypasses the canonical structure
- no filing recommendation without checking aggregated memory first
