# Runtime Enforcement Implementation Plan

## Abstract of program

This is your core job:

A decentralized intelligence network where AI agents file signals, compile briefs, and earn sats. The goal is to file daily signals in the format specified to climb the leaderboard and make money!!!!

Details: File Signals 6 signals daily the format must be Each signal includes a headline, analysis, sources, and tags.

See agent ranking via data/state/signal-history.json` to see if payout in sets have increased 

Payout:
- Brief Inclusion Payout — Each signal compiled into a published brief earns 30,000 sats sBTC. Up to 6 signals per day per correspondent means up to 180,000 sats/day.
- Payment status updated dailky

## Purpose of code changes

This file is the implementation plan for making the repo behave as a rules-executing system whose core maintained instructions come from a small set of canonical sources.

This plan is based on the following clarified assumption:

- the core maintained rule sources are specifically:
  - `docs/build-plan.md`
  - `docs/signal-template.md`
  - `data/config/signal-template.json`
  - `data/state/signal-history.json`
  - `data/briefs/shared-context.json` 

All implementation work in this plan must treat those files as the primary maintained sources for:

- runtime behavior 
- candidate generation behavior
- validation behavior
- operator handoff behavior
- learning and anti-repeat behavior

This file is planning-only.
It does not claim these changes are already implemented.

---

## System Diagrams

### Current system flow

```text
                                   CURRENT FLOW

  docs/build-plan.md
         |
         |  (read by humans / partially reflected in code)
         v
  [partial manual interpretation]

  docs/signal-template.md -----------------------------+
                                                       |
  data/config/signal-template.json                     |
             |                                         |
             |  (exists, but not yet the single        |
             |   shared imported rule source)          |
             v                                         v
     [duplicated rule logic] ----------------> signal-job pre-draft checks
             |                                         |
             +---------------------------------------> signal-guard / filing checks


  data/briefs/shared-context.json ----+
                                      |
  data/training/brief-examples.json --+--> context-memory.ts
                                      |         |
  data/state/signal-history.json -----+         v
                                      |   data/state/brief-examples.json
                                      |   data/state/editorial-memory.json
                                      |   data/state/objective-memory.json
                                      |   data/state/competition-memory.json
                                      |
                                      +--> (indirect brief-learning path)


  agent-daily
      |
      +--> sync runtime memory
      |
      +--> ingest / track brief winners
      |
      +--> daily-prep
      |      |
      |      +--> reads:
      |            - data/briefs/YYYY-MM-DD.md
      |            - prior brief/report
      |            - data/state/filed-signals.json
      |            - memory/learnings.md
      |            - manual daily input when present
      |
      |      +--> does NOT directly read:
      |            - data/briefs/shared-context.json
      |            - data/state/signal-history.json
      |            - signal-template.json
      |
      |      +--> writes:
      |            - data/reports/daily/YYYY-MM-DD.md
      |
      +--> signal-job
      |      |
      |      +--> reads:
      |            - daily report
      |            - today brief
      |            - compiled memory
      |            - data/state/filed-signals.json
      |            - data/manual-submissions/YYYY-MM-DD/
      |
      |      +--> validates candidate artifacts
      |      +--> does NOT autonomously generate final six candidate JSONs
      |
      +--> fetch-and-run / dry-run / ranking / filing queue
      |
      +--> operator review
             |
             +--> numbered candidate report may include rejected artifacts
             +--> human signs / submits
             +--> record filed
             +--> outcomes checker updates history / memory
```

### Desired system flow

```text
                                   DESIRED FLOW

  docs/build-plan.md
         |
         +--> build-plan compiler
                 |
                 v
        data/state/build-plan-memory.json
                 |
                 +--> generation
                 +--> validation
                 +--> scoring
                 +--> operator handoff


  docs/signal-template.md -------------------+
                                             |
  data/config/signal-template.json ----------+--> template-rules.ts
                                                    |
                                                    v
                                           shared template helpers
                                                    |
                                                    +--> pre-draft viability
                                                    +--> autonomous generation
                                                    +--> signal-job validation
                                                    +--> signal-guard / filing checks


  data/briefs/shared-context.json ------------------+
                                                    |
  data/state/signal-history.json -------------------+--> daily-prep
                                                    |      |
  data/briefs/YYYY-MM-DD.md ------------------------+      +--> structured machine handoff
                                                    |             |
                                                    |             v
                                                    |    data/reports/daily/YYYY-MM-DD.json
                                                    |             |
                                                    |             +--> winner shapes
                                                    |             +--> rejected shapes
                                                    |             +--> anti-repeat constraints
                                                    |             +--> active brief exclusions
                                                    |             +--> build-plan-derived priorities
                                                    |             +--> template-relevant requirements
                                                    |
                                                    +--> compiled runtime memory as supporting context


  agent-daily
      |
      +--> sync runtime memory
      |
      +--> compile build-plan memory
      |
      +--> refresh template rules / template cache
      |
      +--> daily-prep
      |      |
      |      +--> directly reads shared-context.json
      |      +--> directly reads signal-history.json
      |      +--> writes daily markdown + machine handoff JSON
      |
      +--> autonomous candidate generator
      |      |
      |      +--> uses:
      |            - build-plan-memory.json
      |            - template-rules.ts
      |            - daily-prep machine handoff
      |            - signal-history.json
      |            - shared-context-derived learning
      |
      |      +--> writes six template-complete candidate JSONs
      |
      +--> signal-job
      |      |
      |      +--> validates generated candidates
      |      +--> fills numbered slots with accepted only
      |      +--> renders slot_empty for missing slots
      |      +--> logs rejected items in appendix only
      |
      +--> ranking / filing queue / trusted slate
      |
      +--> operator review
      |      |
      |      +--> sees only accepted numbered slots
      |      +--> signs / submits
      |
      +--> record filed
      |
      +--> outcomes checker
      |      |
      |      +--> updates signal-history.json
      |      +--> feeds next cycle learning
      |
      +--> context persistence
             |
             +--> data/context-runs/YYYY-MM-DD/run.json
             +--> data/context-runs/YYYY-MM-DD/<candidate-id>.json
```

---

## Canonical Sources

### Primary product rule source

- `docs/build-plan.md`

This is the maintained product operating plan.
It contains:

- the intended runtime architecture
- the intended priority order
- what is meant to be enforced
- what is complete, partial, or still open

### Primary signal-format rule source

- `docs/signal-template.md`
- `data/config/signal-template.json`

These define the canonical signal format and gate rules.
They must drive:

- discovery
- pre-draft viability
- generation
- validation
- filing review

### Primary canonical signal memory

- `data/state/signal-history.json`

This is the canonical record of filed signals and their outcomes.
It must be the query target for:

- rejected signals
- approved-not-in-brief signals
- brief-included winners
- duplicate story-shape checks
- repair/resubmit decisions where appropriate
- learning from actual outcomes

### Canonical brief-learning source

- `data/briefs/shared-context.json`

This file contains maintained brief-context material such as:

- brief titles
- rejected titles
- snippets
- ranking notes
- other carried-forward brief learning keyed by date

Under this plan, it is not equal to `build-plan.md` or the signal template as a rule source, but it is a required canonical input to the brief-learning and discovery pipeline.

It should influence:

- daily prep handoff
- brief-learning memory compilation
- candidate discovery
- duplicate avoidance
- same-day winner-shape awareness


## Core Architectural Rule

The system must operate as follows:

1. `build-plan.md` defines the maintained product/runtime rules
2. `signal-template.md` and `signal-template.json` define the maintained signal contract
3. `signal-history.json` defines the maintained outcome memory
4. code compiles these sources into runtime-enforced behavior
5. generation, validation, scoring, and operator handoff must all use those compiled/executed rules

The codebase must not drift into a state where:

- markdown says one thing
- hardcoded regexes say another
- signal history is canonical in theory but ignored in practice

---

## Current Problems

### Problem 1: Build plan is not yet the clear runtime driver

`docs/build-plan.md` currently mixes:

- intended behavior
- completed behavior
- partially implemented behavior
- historical notes

It is highly valuable, but the codebase does not yet fully compile and execute it as the active rule source.

Result:

- some parts of the build plan are enforced
- some are only partially wired
- some are described as complete in a way that is easy to over-trust

### Problem 2: Signal template exists, but is not yet the single rule source for writing signals

`docs/signal-template.md` and `data/config/signal-template.json` exist, but the active runtime does not yet consistently import them as the single rule source across all layers.

Instead, parts of the rules have been reimplemented in separate files with drift.

Result:

- pre-draft behavior differs from final validation behavior
- sourcing does not reliably use the template before drafting
- template compliance is stronger after drafting than before drafting

### Problem 3: `signal-history.json` is canonical by intent, but not yet universal in runtime

`data/state/signal-history.json` is intended to be the canonical filed-signal history, but some active logic still reads `data/state/filed-signals.json` or other compatibility state directly.

Result:

- rejected and losing patterns are not always queried from the intended canonical source
- duplicate and recency logic remains split
- learning is partially canonical and partially compatibility-driven

### Problem 3b: `shared-context.json` exists, but enters the runtime too late and too indirectly

`data/briefs/shared-context.json` is currently used indirectly through the compiled brief-examples memory path.

In the current pipeline:

1. `context-memory.ts` reads `data/briefs/shared-context.json`
2. that contributes to `data/state/brief-examples.json`
3. downstream runtime layers may load compiled brief-examples memory

But:

- `daily-prep` does not directly read `data/briefs/shared-context.json`
- `daily-prep` therefore does not directly include shared-context-derived learning in its machine handoff
- the earliest planning stage for the active cycle is weaker than intended

Result:

- brief context is available in the repo
- but not injected early enough into the prep -> generation path
- which weakens discovery and same-day exclusion behavior

### Problem 4: Autonomous signal generation is unfinished

The active system still depends on manual placement of candidate artifacts in:

- `data/manual-submissions/YYYY-MM-DD/`

Result:

- the system validates well
- but does not yet reliably generate the six final candidate JSONs autonomously from repo truth
does not use the signal template before creating finalized template
does not strictly run all signals through publisher questions and require an all yes to pass , Questions are 

1 Mission-aligned? Does it serve "Bitcoin is the currency of AIs"?
2 Replicable? Could another agent reproduce this signal by following the disclosure?
3 Inscribable? Is it worth a permanent record on Bitcoin — would you be comfortable with it existing forever?
4 Value-creating? Does it increase understanding of the AI-native economy in a measurable way?


### Problem 5: Operator handoff still promotes rejected artifacts visually

The signal report currently numbers rejected artifacts inside the same candidate-slot sequence as accepted ones.

Result:

- operators perceive rejected artifacts as actionable candidates
- chat rewrites are encouraged
- time is wasted repairing what should have been replaced by stronger discovery

---

## Desired End State

The final system should behave like this:

1. `build-plan.md` is compiled into a runtime rule layer
2. `signal-template.md` and `signal-template.json` are compiled/imported into shared signal-rule helpers
3. `signal-history.json` is the canonical query source for actual filed-signal learning
4. `daily-prep` produces machine-usable generation handoff
5. autonomous generation uses the signal template before drafting
6. validation confirms compliance rather than discovering it late
7. rejected candidates never appear as numbered operator slots
8. operators see only accepted candidates in numbered slots and explicit `slot_empty` where generation failed to fill a slot
9. `shared-context.json` enters the pipeline early enough to shape daily prep and discovery, not only downstream compiled memory
 data/briefs/shared-context.json

---

## Rule Authority Model

### Rule layer 1: Build-plan authority

`docs/build-plan.md` is the primary product/runtime instruction source.

It should govern:

- system architecture
- runtime order of operations
- what is considered complete vs partial vs open
- what the normal path should be
- what the canonical state files are
- what behavior must be moved from docs into code

### Rule layer 2: Signal-template authority

`docs/signal-template.md` and `data/config/signal-template.json` are the primary signal-shape and filing-shape authorities.

They should govern:

- Q1–Q4
- acceptable headline anchors
- valid analysis frameworks
- directive requirements
- source rules
- tag rules
- disclosure rules

### Rule layer 3: Historical learning authority

`data/state/signal-history.json` is the primary real-outcome memory.

It should govern:

- what we already filed
- what was rejected
- what was approved but not included
- what won the brief
- what should be treated as duplicate or prior-loser shape

### Rule layer 4: Shared brief-context learning

`data/briefs/shared-context.json` is the canonical maintained brief-context source.

It should not be treated as a loose optional reference file.

It should supply:

- recent winner title shapes
- recent rejected title shapes
- snippets of why something won or lost
- ranking notes and brief-context cues

It should influence discovery and prep earlier than it currently does.

---

## Build Plan Must Drive Functionality

### Principle

The build plan is not just a reference document.
It must drive runtime behavior.

### What this means in practice

The code should not manually re-express the whole build plan in scattered conditionals.

Instead:

1. the build plan remains the maintained source
2. a small compilation/extraction layer turns active build-plan rules into structured runtime memory
3. runtime code reads that structured output

### Required compiled artifact

Add:

- `data/state/build-plan-memory.json`

This file should be generated from `docs/build-plan.md`.

### Required content of `build-plan-memory.json`

It should contain only runtime-useful, active material such as:

- current runtime priorities
- active generation rules
- active validation rules
- active operator handoff rules
- active canonical-file rules
- active migration rules
- active exclusions and anti-patterns
- explicit status markers:
  - `active`
  - `partial`
  - `planned`
  - `deprecated`

### Required compaction behavior

When the build plan contains overlapping or historical entries, the compiler must:

- keep the most recent operative rule
- mark older conflicting entries as superseded
- preserve completed-vs-partial distinction
- avoid presenting planned work as if it is already live

### Why this is necessary

Without this, the build plan remains too broad and too mixed to be a direct runtime authority, and the code continues to drift toward partial manual interpretation.

---

## Signal Template Must Drive Functionality

### Principle

The signal template must be used before drafting, not only after drafting.

### Required role of the template

The signal template must control:

1. what stories qualify for discovery
2. what stories are worth drafting
3. how drafts are structured
4. how pre-draft kills work
5. how validation works

### Required interaction with shared brief context

The signal template alone is not enough.

The system also needs recent brief-shape context from:

- `data/briefs/shared-context.json`

The template defines:

- what a valid signal must look like

Shared context helps determine:

- what winning and losing shapes look like right now
- which title structures are already occupied
- which rejected patterns should be avoided before drafting

So generation must use both:

- signal-template rules
- shared brief context

### Current wrong pattern

The current wrong pattern is:

1. discover something interesting
2. draft it loosely
3. later check template compliance

And, in practice, brief-shape learning from `shared-context.json` is often downstream and indirect instead of being part of the first discovery handoff.

### Required pattern

The correct pattern is:

1. use `build-plan.md` to determine the active operating mode and priorities
2. use `shared-context.json` to determine current brief winner/loser context
3. use the signal template to decide whether a story is viable
4. only draft if the story can already satisfy the template
5. validate the draft as confirmation

### Required pre-draft viability checks

A story must not become a candidate unless it already has:

- Q1 pass
- Q2 pass
- Q3 pass
- Q4 pass
- exact headline anchor
- acceptable analysis framework path
- measurable implication
- directive path
- valid sources path
- valid disclosure path
- tags count within limit

### Required shared implementation

Create:

- `src/filing/template-rules.ts`

This module must be the shared implementation point for template logic used by:

- `src/prep/signal-job.ts`
- `src/filing/signal-guard.ts`
- future generator code

### Required shared helpers

At minimum:

- `loadSignalTemplate()`
- `hasFrameworkAAnalysis()`
- `hasFrameworkBAnalysis()`
- `hasTemplateAnalysis()`
- `hasTerminalDirective()`
- `hasExactHeadlineAnchor()`
- tag-count checks
- disclosure checks
- source-rule checks where applicable

### Required source of truth behavior

If the signal template changes:

- code should not need scattered changes in multiple files
- the helper layer should be the main update point

---

## `signal-history.json` Must Drive Functionality

### Principle

`data/state/signal-history.json` must become the canonical query source everywhere that filed-signal outcome history matters.

### Required uses

It should be used for:

- duplicate detection
- recent same-story detection
- prior-loser shape detection
- approved-not-in-brief anti-repeat logic
- recency checks
- beat repetition checks
- repair/resubmit logic when tied to real filed outcomes

### Current gap

Some active code still reads `data/state/filed-signals.json` directly for logic that should migrate to `signal-history.json`.

### Required migration rule

Normal runtime logic should query:

- `signal-history.json` first

Compatibility files may still be written for backward compatibility, but they should not remain the primary query target where the build plan intends canonical history.

---

## `shared-context.json` Must Enter The Pipeline Earlier

### Current pipeline behavior

At a high level, the current pipeline works like this:

1. `agent-daily` refreshes runtime memory
2. memory compilation reads sources such as:
   - `data/briefs/shared-context.json`
   - `data/training/brief-examples.json`
   - `data/state/signal-history.json`
3. compiled outputs such as `data/state/brief-examples.json` are written
4. `daily-prep` runs
5. `signal-job` runs
6. fetch/rank/queue paths run
7. operator review and signing happen later

### Current specific problem

`shared-context.json` currently gets into the pipeline mainly through:

- `src/learning/context-memory.ts`

where it contributes to:

- `data/state/brief-examples.json`

That means `shared-context.json` is present in the system, but not in the earliest prep-layer logic.

`daily-prep.ts` currently does not directly read `data/briefs/shared-context.json`.

### Why this is a problem

`daily-prep` is the place where the system should:

- normalize today’s state
- decide what kind of signals are worth generating
- build the machine handoff for discovery and generation

If `shared-context.json` is not directly in that handoff path, then recent brief-title and reject-title learning is only applied later and less reliably.

### Required fix

`daily-prep` should directly read:

- `data/briefs/shared-context.json`

and include it in the active-cycle handoff.

### Required use inside daily prep

`daily-prep` should extract from `shared-context.json`:

- recent winning title shapes
- recent rejected title shapes
- snippets explaining what won or lost
- ranking or pressure notes if present

And it should write those into the daily machine handoff artifact for the active cycle.

### Required output behavior

The daily-prep machine handoff should include a section such as:

- `sharedBriefContext`

with fields like:

- `recentWinningTitles`
- `recentRejectedTitles`
- `titleShapeLessons`
- `rankingNotes`

### Required downstream behavior

The autonomous generator must then read that handoff and use it before drafting.

That way `shared-context.json` affects:

1. prep
2. discovery
3. generation
4. validation

instead of only affecting compiled memory late and indirectly.

---

## Immediate Bugs To Fix

### Issue 1: Rejected candidates appear in numbered operator slots

#### Current bug

In `src/prep/signal-job.ts`, `buildSignalReport()` currently combines accepted and rejected candidates into one numbered sequence.

This makes rejected candidates appear as if they are still candidate-slot items.

#### Why this is wrong

The numbered slot makes a rejected artifact look actionable.
That visually overrides disclaimers.

It trains the operator toward:

- patching failed drafts
- rewriting in chat
- re-queuing weak candidates

Instead of:

- returning to signal discovery
- generating stronger candidates from real anchors

#### Required fix

Split the report into:

1. numbered accepted slots only
2. unnumbered rejected appendix

#### Required numbered-slot behavior

For each slot up to `targetCount`:

- if accepted candidate exists:
  - render numbered accepted candidate section
- else:
  - render `slot_empty`
  - say no candidate survived validation
  - instruct the system/operator to return to Signal Discovery
  - instruct the system/operator to use stronger source anchors
  - instruct the system/operator not to repair rejected ones for that slot

#### Required rejected appendix behavior

Rejected candidates must be logged:

- without slot numbering
- as not actionable
- as excluded from the operator slate
- with only short failure summaries

#### Required report summary changes

The report should explicitly show:

- accepted candidates count
- rejected candidates count
- empty slots require new discovery, not repair

### Issue 2: Signal template is not yet used as the single shared rule source

#### Current bug

`data/config/signal-template.json` exists, but the active source files do not consistently load and share it as the rule source.

Instead, different files reimplement overlapping logic.

#### Immediate fix

Align `signal-job.ts` pre-draft checks with the stronger template-shape logic already present in `signal-guard.ts`.

This includes:

- framework A requiring:
  - `CLAIM:`
  - `EVIDENCE:`
  - `IMPLICATION:`
  - `Directive:`
- framework B requiring:
  - `What changed:`
  - `What it means:`
  - `What to do:`
- explicit tag count kill if tags > 2
- explicit Q2 headline fast-check kill

#### Structural fix

Centralize the logic in `src/filing/template-rules.ts` and load `signal-template.json` there.

---

## Daily Prep and Generation

### Current gap

The system still does not fully do this:

- read daily prep
- autonomously generate the six final candidate JSONs

This is critical and must become the normal path.

### Required daily prep output

`daily-prep` must produce a machine-usable handoff artifact, e.g.:

- `data/reports/daily/YYYY-MM-DD.json`

This must include enough structured information for candidate generation to work without chat improvisation.

### Required contents

At minimum:

- cycle date
- active brief exclusions
- occupied beats
- open beats if any
- shared brief-context winner shapes
- shared brief-context rejected shapes
- shared brief-context ranking notes when present
- recent loser shapes
- recent winner shapes
- discovery priorities derived from build plan
- template-relevant requirements for this cycle
- anti-repeat constraints from `signal-history.json`

### Required generation step

Add an autonomous generator module, for example:

- `src/prep/generate-candidates.ts`

Inputs:

- `build-plan-memory.json`
- daily-prep machine handoff
- `data/briefs/shared-context.json` content as surfaced through the handoff
- signal template helpers
- `signal-history.json`
- compiled runtime memory already used by scoring as needed

Outputs:

- six template-complete candidate JSONs on the normal path

### Required behavior

Generation must:

- use build-plan priorities
- use signal template before drafting
- use signal-history anti-repeat behavior
- create only candidates that can fill true operator slots

### Required deprecation

`data/manual-submissions/YYYY-MM-DD/` should not remain the normal dependency for daily generation.

It may remain as:

- compatibility path
- manual override path

But not the default pipeline requirement.

---

## Full Context Persistence

### Goal

Persist the full effective repo-side context used by the runtime.

### Required paths

- `data/context-runs/YYYY-MM-DD/run.json`
- `data/context-runs/YYYY-MM-DD/<candidate-id>.json`

### Required contents

- run metadata
- report date
- build-plan memory version/hash
- signal-template version/hash
- shared-context version/hash or snapshot reference
- source file paths read
- `signal-history.json` snapshot/hash used
- daily-prep handoff used
- candidate generation decision trace
- pre-draft viability result
- validation result
- queue/handoff result

### Why it matters

This makes it inspectable:

- what the runtime actually used
- what rules were active
- why a candidate passed or failed

---

## Recompilation / Refresh Behavior

### Current behavior

Runtime memory recompilation already happens during:

- `npm run agent-daily`

It can also be triggered manually via:

- `npm run refresh-memory`

### Required expanded behavior

After this plan is implemented, recompilation should also include:

- build-plan memory refresh
- template-rule cache refresh where relevant
- handoff generation refresh

### Practical rule

Operators should not need to run many separate commands daily.

Normal daily operation should keep these current through:

- `agent-daily`

Manual refresh remains useful for:

- debugging
- after direct edits to source-of-truth files
- validating rule changes without running the full pipeline

---

## Repo-First Rule

### Principle

Repo state must be authoritative.
Chat context must be advisory only.

### Required preflight

Before major runtime actions:

- confirm repo boundary
- confirm cycle date
- confirm build-plan memory loaded
- confirm signal-template rules loaded
- confirm signal-history context loaded

### Required runtime behavior

If chat assumptions conflict with:

- `build-plan.md`
- `signal-template.md`
- `signal-template.json`
- `signal-history.json`

the repo sources win.

---

## Tests Required

### Operator-handoff regression

Test that:

- only accepted candidates appear in numbered slots
- empty slots appear as `slot_empty`
- rejected candidates appear only in appendix

### Framework-B pre-draft pass

Test that Framework B passes pre-draft template analysis.

### Tag-count kill

Test that 3 or more tags are rejected pre-draft.

### Q2 headline fast-check kill

Test that a vague headline with no exact anchor fails pre-draft even if the body contains anchors.

### Template load

Test that:

- `loadSignalTemplate()` reads `data/config/signal-template.json`
- required sections are present

### Shared-helper parity

Test that both pre-draft and final validation use the same template helper behaviors.

### Canonical-history query use

Add tests proving that relevant duplicate and prior-outcome checks read `signal-history.json` rather than only legacy compatibility files.

---

## Required Deliverables

### Deliverable 1

Compile `docs/build-plan.md` into:

- `data/state/build-plan-memory.json`

### Deliverable 2

Create shared template rule module:

- `src/filing/template-rules.ts`

### Deliverable 3

Use `signal-template.json` as the imported template-rule source.

### Deliverable 4

Port pre-draft and validation layers to shared template helpers.

### Deliverable 5

Port relevant history-query logic to `signal-history.json`.

### Deliverable 6

Add structured daily-prep machine handoff.

### Deliverable 7

Add autonomous candidate generation using:

- build-plan memory
- template rules
- signal history

### Deliverable 8

Fix operator handoff so only accepted candidates occupy numbered slots.

### Deliverable 9

Persist full repo-side context envelopes for runs and candidates.

---

## Recommended Execution Order

1. build-plan memory compiler
2. shared template-rules module
3. immediate signal-job parity fixes
4. operator handoff fix
5. `signal-history.json` query migration
6. structured daily-prep handoff
7. autonomous candidate generator
8. full context persistence

---

## Acceptance Criteria

The work is complete when all of the following are true:

1. `build-plan.md` is compiled into runtime-usable rule memory.
2. `signal-template.md` and `signal-template.json` drive both pre-draft and final validation behavior.
3. `signal-history.json` is the primary outcome-history query source where intended.
4. `shared-context.json` is directly represented in the daily-prep handoff rather than only entering late through compiled memory.
5. daily prep produces machine-usable generation handoff.
6. autonomous generation creates six final candidate JSONs on the normal path.
7. numbered operator slots contain only accepted candidates or explicit `slot_empty`.
8. rejected candidates no longer appear as numbered actionable slots.
9. repo-first behavior is enforced.
10. full repo-side runtime context is inspectable after each run.

---

## Final Rule

Under this plan, the system must behave as an execution engine for:

- `docs/build-plan.md`
- `docs/signal-template.md`
- `data/config/signal-template.json`
- `data/state/signal-history.json`
- `data/briefs/shared-context.json`

If implementation does not follow those maintained sources, implementation is wrong and must be brought back into alignment.
