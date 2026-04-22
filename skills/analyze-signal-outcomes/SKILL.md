---
name: analyze-signal-outcomes
description: "Use this skill when the user wants to learn from multiple AIBTC signal outcomes: what is winning, why signals are being rejected, which beats are crowded, or what drafting rules should change next. Use it even if they ask for lessons, trends, feedback loops, or comparisons between approved, rejected, and brief-included signals without naming 'outcomes analysis.' Do not use it for drafting a single signal or recording a single status update."
metadata:
  author: "OpenAI"
  user-invocable: "true"
  entry: "analyze-signal-outcomes/SKILL.md"
  tags: "aibtc, signals, analysis, learning"
---

# Analyze Signal Outcomes

## Skill Role

- Category: `signal skill`
- Scope: analyze many outcomes and turn them into better future rules
- Use this when: the task is about patterns, lessons, and what should change next
- Current implementation reference: `docs/build-plan.md`

Use this skill after outcomes have been recorded and the goal is to produce better future signals.

Examples:
- "what are we learning from rejections"
- "why are signals not making the brief"
- "analyze approved vs rejected"
- "what should change in create-signal"
- "what patterns are winning"

## Goal

Turn stored outcomes into reusable drafting and selection rules.

This skill is for analysis and feedback loops, not for raw status recording.

Before trusting any older learning assumptions in this skill, refer to `docs/build-plan.md` to see what exists now and which parts of the loop are already wired.

## Core Memory

Always read these first:

- `docs/document-map.md`
- `docs/workflow.md`
- `docs/build-plan.md`
- `docs/in-brief-success-checklist.md`
- `data/state/signal-history.json` (canonical filed-signal ledger and outcome history)
- `data/state/editorial-memory.json` (what the brief and editorial context have rewarded)
- `data/state/outcome-feedback-memory.json` (normalized repeated outcome labels, when present)
- latest dated brief artifact in `data/briefs/` (`.md` or `.json`, whichever is current for the cycle)
- `data/training/in-brief.jsonl` (concrete winning examples)
- `data/training/rejected.jsonl` (rejection patterns)
- `data/training/approved-not-in-brief.jsonl`

These are the primary learning inputs:

- `signal-history.json` = what happened to real filed signals
- `editorial-memory.json` = what the brief and editorial context have rewarded
- `outcome-feedback-memory.json` = repeated machine-readable failure/win labels
- `in-brief.jsonl` = concrete examples of winning structures worth copying

Use `data/state/filed-signals.json` and `data/outcomes/approvals/*.json` as compatibility mirrors, not as the canonical ledger when `signal-history.json` exists.

## Then Load Repo Learning Logic

- `src/learning/context-memory.ts`
- `src/learning/editorial-memory.ts`
- `src/learning/outcome-feedback.ts`
- `src/filing/signal-history.ts`
- `src/prep/create-signal.ts`
- `src/filing/validate-artifact.ts`
- `src/filing/template-rules.ts`
- `src/filing/signal-guard.ts`
- `docs/beat-strategy.md`

Load these when they exist and are relevant:

- `data/state/outcome-feedback-memory.json`
- `data/state/editorial-memory.json`
- `data/state/repairable-candidates.json`
- `data/state/brief-winners-YYYY-MM-DD.json`
- `data/reports/operator/YYYY-MM-DD.json`

## Analysis Workflow

1. Read our outcomes
- Read `data/state/signal-history.json` — every real filed signal, its outcome, and resolved status
- Read `data/outcomes/approvals/*.json` as compatibility detail records with learningWhy notes and feedback labels
- Read `data/state/outcome-feedback-memory.json` — which failure labels repeat across signals

2. Read what the brief rewarded
- Read `data/state/editorial-memory.json` — the `preFilingChecks`, `focusAreas`, `currentBrief`, and `recentExamples` sections
- Read the latest dated brief artifact in `data/briefs/` — today's or latest brief, including occupied beats and winning headlines

3. Read concrete winning examples
- Read `data/training/in-brief.jsonl` — every confirmed brief_included signal with its headline, body, and beat
- Read `data/training/rejected.jsonl` — rejected signals with rejection reasons
- Compare: what specific structural difference separates our in-brief wins from our losses?

4. Group outcomes into patterns
- winning structures
- rejection reasons
- approved-but-not-in-brief patterns
- duplicate story shapes
- missing evidence patterns
- weak operator consequence patterns
- beat mismatch or crowding patterns

5. Produce rules, not trivia
- convert repeated outcome patterns into short reusable drafting checks
- prefer small procedural changes over broad vague advice

6. Feed the changes back into future creation
- say what `create-signal` should do differently next time
- say whether the fix belongs in:
  - beat selection
  - template usage
  - evidence requirements
  - displacement discipline
  - timing
  - source mix

Do not add new drafting authority to `signal-job`. Future creation rules should be expressed as inputs to `src/prep/create-signal.ts`, artifact validation, or editorial memory.

## Standard Questions To Answer

When analyzing, try to answer:

- What signal shapes are winning?
- What signal shapes are losing?
- What causes approvals not to become brief inclusions?
- Which failure reasons repeat often enough to become hard checks?
- Which beats are crowded enough that displacement framing is required?
- What exact drafting changes would improve the next signal?

## Output Contract

Return:

- strongest winning patterns
- strongest losing patterns
- repeated failure labels or reasons
- what to stop doing
- what to keep doing
- what to change in `create-signal`

Prefer concrete rule changes such as:
- "require timestamped evidence in the first proof sentence"
- "hold same-shape follow-ups in crowded beats"
- "lead with the hard anchor in the headline"

Avoid vague outputs like:
- "be more specific"
- "improve quality"
- "use better sources"

## After Analysis — Close the Loop

Analysis without action is wasted. After identifying patterns:

1. Add new `- win:` / `- loss:` / `- next:` bullet entries to `memory/learnings.md` for any pattern not already captured. Use this format exactly (bullet point required — the parser only reads `- ` prefixed lines):
   ```
   - win: [specific structural reason the signal won]
   - loss: [specific structural reason the signal lost]
   - next: [one concrete repair — not vague advice]
   ```

2. Run `npm run daily-learn` to rebuild `editorial-memory.json` from the updated learnings. This promotes repeated patterns into `preFilingChecks` (threshold: 2 occurrences). Check what new checks were promoted.

3. Tell the user what changed in `preFilingChecks` so they know the learning actually updated.

## Gotchas

- Do not treat one rejection as a universal rule unless it repeats or matches a strong known pattern.
- `editorial-memory.json` is the live rule set — a signal can be true and still lose because the brief preferred a broader same-beat package. Always cross-check against `currentBrief.occupiedBeats`.
- Do not analyze only losses. Compare losses to actual winners in `data/training/in-brief.jsonl`.
- Do not mutate raw history while analyzing. Recording (`record-signal-outcome`) and analysis are separate jobs.
- `memory/learnings.md` uses `- ` bullet points. Bare lines without `- ` prefix are invisible to the parser.

## Validation Loop

Before finalizing:

1. Check that the analysis cites all three core memory files
2. Check that the recommendations are procedural, not generic
3. Check that at least one conclusion compares our losses to known winner patterns
4. Check that proposed changes can be applied by `create-signal`

## References

Read only as needed:

- `docs/document-map.md`
- `docs/workflow.md`
- `docs/build-plan.md`
- `src/learning/context-memory.ts`
- `src/learning/editorial-memory.ts`
- `src/learning/outcome-feedback.ts`
- `src/filing/signal-history.ts`
- `src/prep/create-signal.ts`
- `src/filing/validate-artifact.ts`
- `src/filing/template-rules.ts`
- `src/filing/signal-guard.ts`
- `docs/beat-strategy.md`
