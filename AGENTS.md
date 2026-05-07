# Agent Instructions

## Goal

Produce signals that score 90+ with the publisher, earn brief inclusion, and advance the leaderboard. Only file when a signal can compete for brief inclusion.

Local quality estimates are optimistic. Treat any internally estimated `80-85` as likely to land `70-78` in live publisher scoring unless the draft has exceptional source specificity, novelty, and operator consequence. Only file when the signal still looks `90+` after a `10-15` point live-score haircut. If the target beat or daily roster is full, only file when the signal is displacement-grade: it must plausibly beat the weakest current winner by a clear margin, not merely be valid.

---

## Retail Impact Priority

Before drafting any signal, ask: **would a regular Bitcoin or Stacks holder care about this?**

Prioritize stories that answer yes to at least one of:
- Does it change what they should do with their BTC, STX, or sBTC right now?
- Does it affect the safety or value of what they're holding?
- Does it change the cost or speed of a transaction they'd actually make?
- Does it warn them about a real risk to their keys, custody, or funds?

Examples that qualify:
- Quantum threat updates with concrete timelines or new hardware thresholds
- Fee windows that make on-chain transactions meaningfully cheaper
- Protocol changes that affect how existing coins are protected or migrated
- Security events that expose real user funds or signing keys
- Network capacity changes that affect payment reliability

Examples that do not qualify:
- Internal platform API changes with no holder-facing consequence
- Arbitrage gaps and derivatives funding ticks aimed at trading desks
- Scoring system or editorial rule changes inside the platform
- Bug fixes that only affect agent operators, not end users

This is a drafting priority, not a hard gate. A signal that fails this test can still be filed if it scores exceptionally on other criteria. But when two candidates are otherwise equal, prefer the one a retail holder would understand and act on.

---

## Operator Workflow Dashboard

Use `http://127.0.0.1:9119/aibtc-codex/` as the local operator workflow dashboard for this process.

Purpose:
- show which workflow step is active
- show which steps are complete
- distinguish producer completion from Hermes completion
- prevent duplicate or skipped work
- make handoffs clear between Codex, Claude, and Hermes
- show whether required docs/artifacts have only been produced or have also been absorbed/enforced by Hermes

Naming note:
- `aibtc-codex` is historical/local naming. It is not Codex-only.
- Blue checkmark = producer completed the step.
- Producer means Codex or Claude, whichever agent created, updated, checked, or produced the artifact.
- Green checkmark = Hermes completed/read/absorbed/enforced the step.
- For Step 2A and Step 2B, producer and Hermes may have separate rows because the producer writes/checks and Hermes reads.
- From Step 2C onward, use one shared step with two checkmarks: blue means producer updated the shared artifact; green means Hermes consumed or enforced it.
- When a referenced workflow step is completed, check off the matching dashboard item using this convention.

---

## Workflow Step Preflight

When the operator references a numbered or named workflow step, such as `Step 2C`, `2C`, `proceed to Step 3`, or `move to drafting`, do not act from memory or prior chat context.

Before reading task docs, editing files, or running step-specific commands:

1. Read the relevant `AGENTS.md` from disk fresh. For this repo, prefer this file: `duplicateaibtcagent2/AGENTS.md`.
2. Locate the referenced step in that file.
3. Send a visible preflight line naming the instruction source and step, for example: `Instruction source: /path/to/duplicateaibtcagent2/AGENTS.md, Step 2C`.
4. Summarize the step's allowed inputs, target output file, and required output format in one short status update.
5. Build a mental checklist from the step text and follow it in order.
6. If the existing target file format conflicts with the step text, follow the step text and mention the conflict before editing.

Evidence rule:

- A workflow step is not considered started until the visible preflight line names the `AGENTS.md` path and the step.
- Do not check off, mark complete, or call a step done unless this instruction file was read in the current turn.
- Do not rely on cached memory, pasted prior context, or the existing target file as the source of truth when a numbered workflow step is requested.

---

## Required Docs

Read these before every signal. No exceptions.

| Doc | Read at |
|---|---|
| `docs/beat-capacity-board.md` | Step 1 — before anything else |
| `docs/publisher-feedback-board.md` | Step 2 + Step 3.2 |
| `docs/homepage-brief-snapshots.md` | Step 2 + Step 3.2 |
| `docs/daily-brief-source-comparison.md` | Step 2 + Step 3.2 |
| `docs/signal-daily-analysis.md` | Step 2D + Step 3.2 |
| `docs/live-score-calibration.md` | Step 2E + Step 3.2 + Step 3.7 + Step 7 |
| `docs/active-blocks.md` | Step 3.7 + Step 5.1 + Step 5.2 |
| `docs/90-plus-beat-examples.md` | Step 3.2 + Step 5.1 — read before drafting any signal |
| `docs/beat-editors/quantum-zen-rocket.md` | Step 3 — quantum signals only |
| `docs/beat-editors/bitcoin-macro-ivory-coda.md` | Step 3 — bitcoin-macro signals only |
| `docs/beat-editors/aibtc-network-skill.md` | Step 3 — aibtc-network signals only |
| `docs/sources.md` | Step 4 — Tier 1/2/3 rules per beat |
| `docs/helper-bugs.md` | Step 5.3 + Step 6 — exception log only |
| `docs/draft-signals.md` |Step 5 |


If any required doc for the target beat is unread → return `hold`.
---

## Steps

### Step 1 — Check Beat Capacity

Run:
node skills/beat-capacity-status/scripts/beat-capacity-status.mjs


Output format:

| Beat | Approved | Cap | Slots Open |
|---|---:|---:|---:|
| `bitcoin-macro` | 10 | 10 | 0 |
| `quantum` | 6 | 10 | 4 |
| `aibtc-network` | 4 | 10 | 6 |

If slots open = 0 for target beat → do not proceed. Report beat is full.

---

### Step 2 — Daily Review Evidence Pass

**Goal:** Complete Steps 2A through 2D as one coordinated daily review pass while preserving the separate output artifacts each substep owns. Step 2E remains separate because live-score calibration is a hard creation gate for Steps 3, 5, and 7.

When running the full daily review:

1. Read `docs/homepage-brief-snapshots.md`, `docs/publisher-feedback-board.md`, `docs/helper-bugs.md`, and the relevant `docs/beat-editors/*.md` once for the Step 2A-2D pass.
2. Produce or update each required artifact in order: 2A snapshot, 2B status, 2C source comparison, 2D daily analysis.
3. Do not merge the artifacts. Each substep keeps its target file, table format, and completion rules.
4. If only one Step 2 substep is requested, follow that substep's read and update rules exactly.
5. After 2D, run 2E as its own calibration step whenever the Step 2E selection rule finds new scored signals or reusable score lessons.

Do not call Step 2 complete unless every requested substep has updated its own target file or explicitly reported that no update was required by that substep's rules.

---

### Step 2A — Check What Is in the Brief

Operator pastes brief content. Write it into `docs/homepage-brief-snapshots.md` in the existing table format.

Extract:
- today's approved titles
- their beat
- what made them win

Return in the same table format used in `docs/homepage-brief-snapshots.md`.

---

### Step 2B — Check Signal Status

Read only `docs/publisher-feedback-board.md`.

1. Use the `Pending Review` table as the exact list of signals awaiting status
2. Check live status for each row
3. For any row with real publisher feedback: move from `Pending Review` to `Publisher Feedback Rows`, add note to `Signal Content Review Notes`
4. For any row still without feedback: leave in `Pending Review`, keep status as `submitted`
5. For any row whose status changed to `In Brief`: add or update a row in the `## In Brief Signals` table at the top of `docs/publisher-feedback-board.md`. Include Date, Signal ID, Beat, Score, Title, and the Winning Pattern (extracted from the Learnings column — one line naming the anchor type, key delta, and operator consequence that cleared review).

Required table format:
`| Date | Signal ID | Beat | Title | One-line signal | Notes | Publisher feedback | Status |`

Status meanings:
- `submitted` = filed, awaiting review
- `approved` = publisher approved
- `rejected` = publisher rejected
- `replaced` = displaced by another signal

---

### Step 2C — Complete Daily Brief Source Comparison

**Goal:** Compare what won today per beat against what we submitted. Step 2C is the evidence table; Step 2D turns the comparison into daily analysis and Step 2E turns publisher feedback into live-score calibration gates for Step 3/5.

Read only:
1. `docs/homepage-brief-snapshots.md`
2. `docs/publisher-feedback-board.md`
3. `docs/helper-bugs.md`
4. `docs/beat-editors/*.md`

If Step 2C is being run inside the full Step 2 Daily Review Evidence Pass, reuse the current Step 2 reads for these files instead of reading them again solely for Step 2C. The output and evidence rules below still apply unchanged.

For each beat, same day only:

1. From homepage: extract winning patterns
   - structure
   - anchor type

2. From publisher board: list my signals + outcome
   - `rejected`
   - `displaced`
   - `cap full`
   - `approved`

3. From helper: remove blocked shapes
   - duplicate shape
   - same metric family
   - same blocked helper pattern

4. From editor rules: check required structure
   - anchor
   - numbers
   - implication

Determine:
- what patterns won
- which clusters are full
- how my signals differed
- which rule I missed
- score drift between local expectation and live publisher/API outcome

Update only `docs/daily-brief-source-comparison.md`.

Preserve the existing table format:

| Date | Beat | What Won Today (Pattern) | Saturated Clusters | My Competing Signals (Outcome) | What They Did Better | Editor Requirement Missed | What To Do Next |

Rules:
- same day only
- no summaries
- no repetition of headlines
- each row must end with a clear drafting action
- if any submitted signal scored below the expected local quality, record the live-score haircut needed for that beat or source family
- if a signal was valid but rejected, do not call the lesson “try again”; name the exact missing displacement power or 90+ ingredient
- if the status is still `submitted`, mark outcome uncertainty explicitly and do not infer approval

---

### Step 2D — Signal Daily Analysis

**Goal:** Convert Step 2A, Step 2B, Step 2C, and the publisher/beat docs into daily learning artifacts that Step 3 turns into a target-beat plan and Step 5 enforces before staging.

Step 2D updates `docs/signal-daily-analysis.md`. It explains what changed in the brief and feedback snapshot, then turns that evidence into Step 3 planning requirements and Step 5 enforcement rules. Step 2D does not update `docs/live-score-calibration.md`; Step 2E owns that file.

Read:
1. `docs/homepage-brief-snapshots.md`
2. `docs/publisher-feedback-board.md`
3. `docs/daily-brief-source-comparison.md`
4. Publisher/beat editor docs:
   - `docs/beat-editors/quantum-zen-rocket.md`
   - `docs/beat-editors/bitcoin-macro-ivory-coda.md`
   - `docs/beat-editors/aibtc-network-skill.md`

If Step 2D is being run inside the full Step 2 Daily Review Evidence Pass, reuse the current Step 2 reads where they already cover the same files. Always read the freshly updated `docs/daily-brief-source-comparison.md` after Step 2C before writing Step 2D.

If Step 2D is analyzing every beat in the current comparison window, read all three publisher/beat editor docs. If Step 2D is explicitly scoped to one target beat, read only that beat's publisher/beat editor doc.

Analyze:
- what live winners had that our submitted signals lacked
- what the publisher/beat docs required and whether each submitted signal met those requirements
- which submitted signals dropped from local/draft confidence into lower live score bands
- why any signal failed to reach `80+`, failed to become `90+`, or lacked displacement power
- which failure mode caused the drift: source specificity, duplicate cluster, weak beat fit, generic implication, cap/displacement threshold, helper bug, or overbroad metric framing
- what must be blocked, required, or escalated before drafting again

Update only `docs/signal-daily-analysis.md` using this table:

| Date | Beat | Evidence From Brief | Submitted Outcome | Score Drift / Failure Mode | Lesson | Step 3 Plan Requirement | Step 5 Enforcement Rule |
|---|---|---|---|---|---|---|---|

Rules:
- Step 2D is mandatory after Step 2C whenever there is new publisher feedback, a new brief snapshot, or a submitted signal with score drift.
- Do not infer approval from `submitted`; mark unresolved outcomes as `submitted/no feedback`.
- If live publisher/API scoring drops an apparently `80+` candidate into the `70s` or low `80s`, record the haircut lesson explicitly.
- Each row must include one concrete Step 3 plan requirement and one concrete Step 5 enforcement rule.
- Step 2D is not complete until it creates at least one enforceable lesson for each beat with submitted, rejected, replaced, or approved signals in the current comparison window.
- Step 2D is not complete until `docs/signal-daily-analysis.md` contains a current row for each beat with submitted, rejected, replaced, or approved signals in the current comparison window.
- Step 3 must copy the relevant Step 2D lesson into `docs/target-beat-rules.md`.

---

### Step 2E — Live Score Calibration

**Goal:** Update `docs/live-score-calibration.md` so under-80 and below-target publisher/API scores become creation gates before Step 5 stages any candidate.

Step 2E explains why submitted JSON payloads scored below target. It does not duplicate the publisher feedback board or daily comparison docs. It identifies which part of the submitted JSON failed, which beat editor rule it conflicted with, and what must change before a similar candidate can be staged again.

**Read only:**
1. `docs/publisher-feedback-board.md`
2. `docs/beat-editors/quantum-zen-rocket.md`
3. `docs/beat-editors/bitcoin-macro-ivory-coda.md`
4. `docs/beat-editors/aibtc-network-skill.md`
5. Submitted JSON payload when available

**Update only:**
`docs/live-score-calibration.md`

Selection rule:
- Go to `docs/publisher-feedback-board.md`.
- Find signals that are not currently represented in `docs/live-score-calibration.md`.
- Skip rows with blank scores.
- **For signals with a live API `quality_score` below `80`:** do NOT wait for publisher feedback text. The live API score is itself a publisher outcome. Add a calibration row immediately when the score is confirmed, even if `publisherFeedback` is empty and status is still `submitted` or `Pending review`.
- **For signals scoring `80–89`:** add a row only when there is real publisher feedback or a confirmed outcome (approved, rejected, replaced, in-brief) AND the score reveals a reusable JSON creation lesson that would affect Step 5 staging.
- **For signals scoring `90+`:** add a row only when publisher feedback or outcome changes the lesson (e.g., rejected despite high score — capture why).
- Skip rows that are still `Pending review` / `submitted` with blank scores.

Use this table:

| Date | Signal ID | Beat | Live Score | Failed JSON Field(s) | Payload Failure Pattern | Beat Editor Conflict | JSON Gate Before Staging | Required Upgrade To Proceed |
|---|---|---|---:|---|---|---|---|---|

For every newly assessed signal with a live score below `80`, add or update one row — no publisher feedback text required.

For `80-89` signals, add a row only when there is real publisher feedback or confirmed outcome and the score reveals a reusable JSON creation lesson that would affect Step 5 staging.

Column rules:
- `Failed JSON Field(s)`: name the JSON field(s) that caused the score miss, such as `headline`, `body`, `analysis`, `sources`, `tags`, `disclosure`, `operator_implication`, or `story_family`.
- `Payload Failure Pattern`: describe the reusable payload mistake, not the whole publisher outcome.
- `Beat Editor Conflict`: cite the relevant beat editor rule or requirement the payload failed.
- `JSON Gate Before Staging`: write the hard block Step 5 must apply before placing JSON in `docs/draft-signals.md`.
- `Required Upgrade To Proceed`: state what must be improved before a similar candidate can be staged.

Rules:
- Do not copy the whole publisher feedback row.
- Do not summarize the daily brief.
- Do not duplicate `docs/daily-brief-source-comparison.md`.
- Focus on the submitted JSON payload and why it scored below target.
- If the submitted JSON is unavailable, infer only from the headline, one-line signal, sources, score, and beat editor doc; mark the row as `payload unavailable`.
- If a failure pattern already exists, update it with the newest signal ID and score instead of creating a duplicate pattern row.
- Step 2E is not complete until every new under-80 scored signal (with any confirmed live API score, regardless of publisher feedback text) has either a calibration row or an explicit note saying why no JSON creation lesson was found.

---

### Step 3 — Load Beat Context (Required Before Any Drafting)

**Goal:** Front-load every constraint Step 5 needs. By the end of Step 3, nothing new should be discovered in Step 5.

#### 3.1 — Identify Target Beat

Use the open slots output from Step 1. If Step 1 was already completed this session, check the dashboard at `http://127.0.0.1:9119/aibtc-codex/` for the result — do not re-run the beat capacity script. Run Step 3 only for beats with slots open.

#### 3.2 — Read All Required Docs (no skipping, no reusing cached reads)

Read in this exact order:

| # | File | What to extract |
|---|---|---|
| 1 | Beat editor for target beat only | Scoring rules, required checklist, instant rejection triggers, Tier 1 source list |
| 2 | `docs/homepage-brief-snapshots.md` | Blocked shapes — see 3.3 |
| 3 | `docs/signal-daily-analysis.md` | Score drift, failure modes, Step 3 plan requirements, Step 5 enforcement rules |
| 4 | `docs/live-score-calibration.md` | Live score bands, sub-80 hard misses, 80-89 below-target patterns, and the gate that should have blocked each |
| 5 | `docs/90-plus-beat-examples.md` | Reusable source/catalyst/operator-action patterns from confirmed 90+ or in-brief signals — Step 5.1 must apply these before selecting a source |

Beat editor files:

| Beat | File |
|---|---|
| `quantum` | `docs/beat-editors/quantum-zen-rocket.md` |
| `bitcoin-macro` | `docs/beat-editors/bitcoin-macro-ivory-coda.md` |
| `aibtc-network` | `docs/beat-editors/aibtc-network-skill.md` |

**Hard rule:** read all five. Never skip. Never reuse a cached read from a prior session.

After reading all five, extract a compact Beat Context Brief for the target beat. This brief is the Step 3 handoff that later steps use to avoid rediscovering the same rules. It must include: beat scoring bar, Tier 1 source families, required structure, instant rejection triggers, fresh blocked shapes, Step 2D enforcement lessons, and Step 2E calibration gates.

#### 3.3 — Extract Blocked Shapes (ALWAYS fresh, NEVER cached)

From `docs/homepage-brief-snapshots.md`:

1. Find every brief entry for the target beat from the last 48 hours.
2. For every headline, extract the structure, not the numbers. Example: `[N] Blocks Left Before [%] Retarget` is the same structure whether N is `1,094` or `1,372`.
3. Find every `Duplicates removed` note at the bottom of each brief and extract every structure listed there too.
4. Write every extracted structure into the `Blocked shapes` column of `docs/target-beat-rules.md`.

**Hard rule:** the `Blocked shapes` column must always be re-extracted fresh from `docs/homepage-brief-snapshots.md` on the current day. Even if a row already exists for today's date and beat, re-extract blocked shapes. Never carry over yesterday’s list.

A shape is blocked if it appears anywhere in the last 48h brief for the target beat, regardless of whether the numbers are different.

#### 3.4 — Helper Exception Log

Do not read `docs/helper-bugs.md` during Step 3 unless the operator reports a new helper error or a current Step 6 helper/browser validation fails.

`docs/helper-bugs.md` is an exception log, not a daily planning input. Step 5.3 and Step 6 own helper validation using the current checklist and browser/helper process. If a new real helper error appears, log the exact text, cause, and fix in `docs/helper-bugs.md`.

#### 3.5 — File Into `docs/target-beat-rules.md`

Use this table format:

| Date | Beat | What scores 90+ | Required checklist | Instant rejection triggers | Blocked shapes (fresh, today) | Candidate fit | What must change before drafting |
|---|---|---|---|---|---|---|---|

Rules:
- one row per date + beat combination
- `Blocked shapes`: always re-extracted today, never copied from a prior row
- `What scores 90+`, `Instant rejection triggers`, and `What must change before drafting` must include Step 2D score-drift lessons and Step 2E live-score calibration gates for the target beat
- `Candidate fit`: `n/a` if no candidate yet, otherwise `yes`, `partial`, or `no`

Then add or update one row for today's beat in the **Beat Context Briefs** table in `docs/target-beat-rules.md`:

| Date | Beat | Scoring Bar | Tier 1 Source Families | Required Structure | Instant Rejects | Fresh Blocked Shapes | Active Step 2D Lessons | Active Step 2E Gates |
|---|---|---|---|---|---|---|---|---|

Rules:
- one row per date + beat combination
- this row is a compact handoff, not a replacement for the top rule table
- `Fresh Blocked Shapes` must match the freshly extracted Step 3.3 blocked shapes
- `Active Step 2D Lessons` must copy the relevant plan/enforcement lesson from `docs/signal-daily-analysis.md`
- `Active Step 2E Gates` must copy the relevant JSON gate/calibration lesson from `docs/live-score-calibration.md`

#### 3.6 — Gate Before Step 4

Confirm all six before proceeding:

- [ ] All five Step 3.2 docs read in full (including `docs/90-plus-beat-examples.md`)
- [ ] Blocked shapes extracted fresh from today’s `homepage-brief-snapshots.md`
- [ ] `docs/target-beat-rules.md` updated
- [ ] Beat Context Brief row written or updated in `docs/target-beat-rules.md`
- [ ] Step 3.7 target beat execution plan written or updated (includes calibration absorption and Score Haircut number)
- [ ] Active enforcement gates for target beat consolidated from calibration table + signal-daily-analysis.md

**Do not proceed to Step 4 until all six are confirmed.**

#### 3.7 — Target Beat Execution Plan

**Goal:** Read the rule record, today's analysis, and calibration bands, then write one execution row that decides whether to draft, hold, or abort before any source hunting begins.

Read these three docs:
- the rule-record row for today's beat in the **top table** of `docs/target-beat-rules.md`
- the Step 2D row in `docs/signal-daily-analysis.md`
- the calibration bands in `docs/live-score-calibration.md`: `<80` hard-miss families (Step 4 must not source these unless a new primary catalyst changes the live operator action), `80-89` below-target families (Step 4 may continue only with a new source catalyst plus stronger operator consequence), unresolved `90+` families (do not reuse until publisher feedback lands)

Then add or update one row for today's beat in the **Target Beat Plans** table in `docs/target-beat-rules.md`:

| Date | Beat | Open Slots | Winning Bar | Do Not Draft | Required Source Family | Required Operator Delta | Score Haircut | Candidate Policy | Next Action |
|---|---|---:|---|---|---|---|---|---|---|

- `Score Haircut`: write a specific number or range derived from `docs/live-score-calibration.md` for the target beat and source family you intend to draft. If no specific calibration row exists for the family, use the default: quantum −10 to −15 pts; bitcoin-macro −5 to −10 pts; aibtc-network 0 pts (observability/PR-summary families have a hard ceiling of 83, not haircut to 90+). This number feeds directly into Step 5.2's calibration kill-gate.
- `Candidate Policy` must be exactly `draft`, `hold`, or `abort` plus a short reason.
- If `hold` or `abort`: stop here, do not proceed to Step 4.
- Step 4 may only use source families listed in `Required Source Family`.

Then create or update `docs/active-blocks.md` for today's target beat. This is the single Step 5 handoff for active blocks and must be regenerated after Step 3.7 whenever the target beat, brief snapshot, publisher feedback, daily analysis, or calibration table changes.

Required `docs/active-blocks.md` format:

```md
# Active Blocks

Report date: YYYY-MM-DD

Instruction source: `/path/to/duplicateaibtcagent2/AGENTS.md`, Step 3.7.

## Target Beat: beat-slug

Candidate policy: draft|hold|abort — reason
Score haircut: specific number or range

### Hard Blocks From Live Score Calibration
- [rule from docs/live-score-calibration.md, or "none"]

### Enforcement Rules From Daily Analysis
- [rule from docs/signal-daily-analysis.md, or "none"]

### Saturated Clusters And Same-Day Collisions
- [cluster/anchor/source family from docs/daily-brief-source-comparison.md and docs/homepage-brief-snapshots.md, or "none"]

### Pending Review Collisions
- [signal ID + source family/anchor ID from docs/publisher-feedback-board.md, or "none"]

### Fresh Blocked Shapes
- [shape from docs/target-beat-rules.md Step 3.3, or "none"]

### Required Source Family
- [source family from the Step 3.7 plan]

### Required Operator Delta
- [operator delta from the Step 3.7 plan]
```

Rules:
- `docs/active-blocks.md` must include only current target-beat blocks for the current report date.
- If `Candidate Policy` is `hold` or `abort`, `docs/active-blocks.md` must say no Step 4 source list should be produced and why.
- Step 5 may rely on `docs/active-blocks.md` only when the report date and target beat match the current run and the instruction source says Step 3.7.
- If `docs/active-blocks.md` is missing, stale, or for a different beat, return to Step 3.7 before Step 5.

---

### Step 4 — Build Verified Source List (Required Before Step 5)

**Goal:** Create the only source list Step 5 may use. Keep only sources that can support a fresh, helper-valid, non-duplicate signal.

**Step 4 is NOT just sourcing. It is matching sources to patterns that already scored 80+ or won in brief.**

#### 4.0 — Load Learning Docs First (MANDATORY before any sourcing)

Before touching any source, read these 5 docs to understand what to look for:

| Doc | What to extract |
|---|---|
| `docs/90-plus-beat-examples.md` | Structural patterns that scored 90+ — anchor type, headline formula, body structure, operator directive pattern |
| `docs/publisher-feedback-board.md` | Rejection reasons, displacement patterns, score thresholds by beat |
| `docs/daily-brief-source-comparison.md` | Story shapes that won today vs what we filed and lost |
| `docs/signal-daily-analysis.md` | Score drift, failure modes, Step 5 enforcement rules |
| `docs/live-score-calibration.md` | Live score bands, sub-80 hard misses, 80-89 below-target patterns |

Write a summary before proceeding:

```
Source hunt for [beat]:
- 90+ pattern: [anchor type] + [headline formula] + [operator directive]
- Rejection reasons to avoid: [list from publisher-feedback-board.md]
- Today's winners: [shapes that won in brief]
- Failure modes: [what caused scores <80]
- Score floor: [minimum local estimate for this beat]
```

Do NOT proceed to 4.1 until this summary is written. The summary guides source selection.

#### 4.1 — Start From Tier 1 Sources

Use the target beat editor read in Step 3.2.

Extract only:
- Tier 1 source URL
- what exact claim, metric, or anchor it can prove
- anchor type, such as PR, issue, release tag, BIP, API metric, block height, paper ID, or NIST reference

**Beat-specific source quality screen (apply before including any source in the verified list):**

For `bitcoin-macro`: identify an exact two-branch operator directive, sat/dollar cost figure, or routing decision the source already supports. If none is identifiable from the source content alone, remove the source — observation-only and market-state sources cannot support a 90+ signal and must not enter the verified list.

For `aibtc-network`: confirm the source contains evidence of a failure-mode event (HTTP error, timeout, CVE, payment failure, limit breach) OR a quantified economic delta (cost per call, sats at risk, latency regression, routing change). If the source describes only a new capability, new tool, observability addition, or endpoint addition without a measurable failure or economic delta — mark it `ceiling:83` and exclude it from the verified list. Sources marked `ceiling:83` cannot pass the Step 5.2 calibration gate and must not be selected in Step 5.1.

For `quantum`: confirm the source is a primary event (merged PR, arXiv/IACR paper, NIST update, hardware announcement) with an exact qubit count, runtime metric, or threat-timeline delta AND Bitcoin-specific actionability (key rotation, verifier validation, migration directive). If either element is missing, remove the source.

Do not add new sources here. Do not browse for extras. Do not include Tier 2 or Tier 3 sources unless the beat editor explicitly allows them for the target claim.

#### 4.2 — Remove Already-Used Sources

Use `docs/homepage-brief-snapshots.md`.

For the target beat and today only, remove any source that would repeat:
- same source plus same numeric claim
- same anchor ID
- same metric family
- same comparison frame
- same operator implication

If today's brief has no entries for the target beat, treat all Tier 1 sources as still available and note that.

#### 4.3 — Filter and Write Verified Source List

Apply all four filters in order, then output and write the result.

**Filter 1 — Remove helper-invalid sources.**
Keep only URLs containing at least one accepted substring:
`/api/` · `github.com` · `explorer.` · `releases/tag/` · `issues/<n>` · `pull/<n>` · `bip-<n>` · `docs.` · `arxiv.org/abs/` · `eprint.iacr.org/` · `csrc.nist.gov/` · `gnusha.org` · `delvingbitcoin.org`

**Filter 2 — Remove shape-blocked sources.**
Use blocked shapes from `docs/target-beat-rules.md`. Remove any source whose usable claims all map to a blocked story shape, the same story with fresher numbers, a saturated cluster, or a recently rejected source family plus metric family plus implication family.

**Filter 3 — Pattern match to 90+ examples.**
Use the 90+ pattern summary from 4.0. Exclude any source that:
- Does not match the anchor type from the beat example
- Cannot support the headline formula structure
- Cannot support the operator directive pattern

A source must be able to map to the 90+ example structure. If it cannot, remove it.

**Filter 4 — Remove below-haircut-floor sources.**
Use the Step 3.7 Score Haircut and beat-family floor before writing `docs/verified-source-list.md`.

- `quantum`: exclude any source that cannot plausibly support a `95+` pre-haircut local estimate and `85+` post-haircut floor.
- `bitcoin-macro`: exclude any source that cannot plausibly support a `90+` pre-haircut local estimate and `85+` post-haircut floor.
- `aibtc-network` failure-mode/security/cost shapes: exclude any source that cannot plausibly support a `90+` local estimate.
- `aibtc-network` observability, capability-addition, new-tool, or endpoint-addition shapes without a named failure-mode event or quantified economic delta: mark `excluded: below haircut floor / ceiling 83`.

Do not label haircut-floor exclusions as helper-invalid. Record them in the Step 4 filter note as `excluded: below haircut floor` with the beat and source family.

**Output** only the sources that survived all four filters using this exact format:
`[URL] — proves [specific claim or metric] — anchor: [exact value]`

Write the final verified source list to:

`docs/verified-source-list.md`

This file is the only source-list artifact Step 5 may use.

Required `docs/verified-source-list.md` format:

```md
# Verified Source List

Report date: YYYY-MM-DD

Instruction source: `/path/to/duplicateaibtcagent2/AGENTS.md`, Step 4.

This is the Step 4 handoff for Step 5. Step 5 may use only the available source lines below.

## Target Beat: beat-slug

`[URL]` — proves [specific claim or metric] — anchor: [exact value]

Step 4 filter note: [one sentence naming any major removed source families, including `excluded: below haircut floor` when Filter 4 removed sources, or `No sources removed beyond helper/shape/pattern/haircut filters.`]
```

If Step 4 runs for multiple beats, include one `## Target Beat:` section per beat. If a beat is held or aborted by Step 3.7, include a short section saying no Step 4 source list was produced for that beat and why.

Do not call Step 4 complete from chat output alone. Step 4 is not complete until `docs/verified-source-list.md` has been updated or the verified source list is empty and the stop condition below has been reported.

For metric-heavy claims:
- require two independent organizations or source systems when the claim combines multiple figures, comparisons, or market-wide implications
- allow one source only when it is the canonical primary source and fully proves the exact claim

**Hard rule:** if the verified source list is empty, stop. Do not proceed to Step 5. Report that no signal can be filed today for this beat.

#### 4.4 — Update `docs/sources.md`

Write the verified source list from 4.3 into `docs/sources.md` only when it reveals a new reusable source pattern that helps future sourcing.

Do not update `docs/sources.md` for:
- one-off URLs
- rejected sources
- sources already documented
- sources that failed the helper whitelist
- sources that cannot support a fresh winning signal

#### 4.5 — Completion Gate Before Step 5

Confirm all seven before calling Step 4 complete:

- [ ] Step 4.0 learning summary was written (90+ pattern, rejection reasons, winners, failure modes, score floor)
- [ ] Target beat was allowed by the Step 3.7 `Candidate Policy`
- [ ] Tier 1 source families came from the target beat editor or already-documented source map
- [ ] Sources failing helper, shape, 90+ pattern, or haircut-floor filters were removed
- [ ] `docs/verified-source-list.md` was updated with the exact surviving source lines, or the empty-list stop condition was reported
- [ ] `docs/sources.md` was updated only if 4.4 required it; otherwise record that no update was needed
- [ ] Source list contains only sources that map to the 90+ example structure

**Do not tell the operator Step 4 is complete unless this 4.5 gate is satisfied.**

---

### Step 5 — Create Signal (Deterministic)

**Goal:** Produce 1-2 high-confidence, non-duplicate JSON signals by learning from other agents' 90+ / in-brief examples, then using only pre-verified inputs from Steps 3 and 4. Do not default to 4 candidates unless the operator explicitly asks for volume.

Step 5 builds from examples of what other agents already got scored 90+ or included in the brief. Start with:

- other agents' 90+ or in-brief examples supplied by the operator
- `docs/target-beat-rules.md` (contains all blocks, shapes, and requirements)
- `docs/90-plus-beat-examples.md`
- today's approved brief examples in `docs/homepage-brief-snapshots.md`
- relevant rows in `docs/daily-brief-source-comparison.md`
- relevant lessons in `docs/signal-daily-analysis.md`

Use `docs/draft-signals.md` only for finished JSON that has passed Step 5.2. Do not use it for rough notes, partial drafts, speculative candidates, or aborted candidates.

**No-Hold Rule:** Step 5 has no hold queue. A candidate that fails any gate in Step 5.1, 5.2, or 5.3 is permanently **ABORTED** — not queued, not set aside, not reformatted and retried. Record a one-line abort reason in `docs/signal-daily-analysis.md` and return to Step 4 for a different source family. Never add aborted candidates to `docs/draft-signals.md` under any status.

**Real Drift Prevention:** Live publisher scores are systematically lower than local estimates. Apply these mandatory pre-draft ceilings before selecting any source:

| Beat | Observed haircut | Required pre-draft local estimate to target 85+ live |
|---|---|---|
| `quantum` | 10–15 pts | 95+ pre-haircut (a local 90 lands 75–80 live) |
| `bitcoin-macro` | 5–10 pts | 90+ pre-haircut (a local 85 lands 75–80 live) |
| `aibtc-network` — failure-mode/security/cost shapes | 0 pts | 90+ local estimate required |
| `aibtc-network` — observability/capability-addition shapes | hard ceiling 83 | **cannot pass the 85 gate — ABORT at Step 5.1** |

These ceilings are enforced at Step 5.1 (source selection) and Step 5.2 (kill gate). A source that cannot support the pre-draft local estimate threshold must be rejected before any drafting begins.

Status language:
- `locally validated` = repo-side checks pass, including helper normalization and local signal guard
- `browser-helper confirmed` = exact JSON was checked in `file-signal.html` with no pre-login blocker before Sign Request
- `ready to submit` = only after `browser-helper confirmed`

#### 5.1 — Learn From 90+ Examples

**New Example Intake (run first if the operator provides a new beat example):**

If the operator pastes or describes a new 90+ or in-brief signal, process it before anything else in Step 5.1:

1. Accept from the operator: `Author`, `Title`, `Beat`, `Score`, `Sources` (URLs), and optionally the full signal body.
2. Extract structural fields — do not summarize the story, extract the reusable pattern:
   - **Anchor type:** what kind of primary source (merged PR, API metric, arXiv paper, NIST update, hardware announcement, geopolitical event)
   - **Source URL pattern:** the specific URL substrings from the helper whitelist that qualified
   - **Headline formula:** structural template with placeholders replacing specific values (e.g., `[Library] PR #N [Action] [Component] [to Version] For [BIP-N] [Algorithm]`)
   - **Body structure:** the CLAIM / EVIDENCE / IMPLICATION / Directive patterns — what each section contained structurally, not verbatim
   - **Operator directive pattern:** the type of action the Directive told agents to take (two-branch routing, version-gate migration, test-vector rejection, etc.)
   - **Why [score]:** the specific combination of factors that pushed it to 90+ — one sentence per factor
3. Append a new structured block to `docs/90-plus-beat-examples.md` following the block format used for existing examples (see the "How to add a new example" section in that file).
4. Confirm the block was written and state the key structural pattern in one line before proceeding.

Only add blocks for signals that scored 90+ or were confirmed in-brief. Do not add sub-90 approvals. If the operator provides multiple examples, process all of them before continuing.

---

**Active Learning Block Extraction (run before selecting any source):**

Before touching `docs/verified-source-list.md`, read `docs/target-beat-rules.md` row for today's date + target beat. This file already contains all blocks, shapes, and requirements from Steps 2-3.

1. Report date matches today's report date.
2. Target beat matches the candidate beat.
3. Instruction source says `Step 3.7`.
4. Candidate policy is `draft`.
5. The file includes hard blocks, enforcement rules, saturated clusters, pending collisions, fresh blocked shapes, required source family, required operator delta, and score haircut.

If `docs/active-blocks.md` is missing, stale, for a different beat, or has `Candidate policy: hold` or `Candidate policy: abort`, stop and return to Step 3.7. Do not rebuild the active block list ad hoc inside Step 5.

Write the result explicitly before proceeding:

```
Active blocks for [beat] as of [date]:
- HARD BLOCK (calibration): [rule from docs/active-blocks.md]
- ENFORCE (daily analysis): [rule from docs/active-blocks.md]
- SATURATED (brief comparison): [cluster or anchor from docs/active-blocks.md]
- PENDING COLLISION: [signal ID and source family from docs/active-blocks.md, or "none"]
- BLOCKED SHAPE: [shape from docs/active-blocks.md]
- REQUIRED SOURCE FAMILY: [source family from docs/active-blocks.md]
- REQUIRED OPERATOR DELTA: [operator delta from docs/active-blocks.md]
- SCORE HAIRCUT: [haircut from docs/active-blocks.md]
```

A verified source that triggers any active block must be rejected immediately — do not proceed to Pre-Draft Source Score.

---

**Structural Pattern Matching (select source against beat example structure):**

Read `docs/90-plus-beat-examples.md`. Find the block for the target beat. Map each candidate source to the example's structural fields:

- Does the source URL match the accepted URL pattern from the example?
- Does the source contain a primary anchor of the same type (merged PR, API metric, arXiv paper, etc.)?
- Can the source support a headline that fits the example's headline formula?
- Does the source contain evidence that maps to the example's EVIDENCE structure (price + flow + API, or PR + semver + deployment, etc.)?
- Can the source support an operator Directive of the same pattern type (two-branch routing, version-gate, test-vector rejection)?

If a candidate source cannot map to all five structural fields, it cannot support a 90+ signal for this beat. Do not select it. Return to the verified source list and try the next candidate. If no candidate maps to the beat example structure, stop and return to Step 4.

Use only `docs/verified-source-list.md`. Do not draft from a source merely because it passed the active block check.

For metric-heavy claims, require two independent verified source systems unless one canonical primary source fully proves the exact claim.

**Pre-Draft Source Score (required before any drafting — run for each selected source):**

Write out all five answers explicitly before starting any headline/body/JSON work:

1. **Haircut floor:** State `[beat] haircut = [X] pts; this source's pre-haircut local estimate = [Y]; post-haircut floor = [Y − X] = [Z]`. If Z < 85, **ABORT** immediately — do not draft.
2. **AIBTC ceiling gate:** If the source is an observability addition, new tool, new endpoint, or capability-addition without a named failure-mode event or quantified economic delta — **ABORT**. Hard ceiling is 83; cannot clear the 85 gate.
3. **Shape collision check:** Does the source's usable claim map to a blocked shape, saturated cluster, pending collision, or calibration hard-miss family recorded in `docs/active-blocks.md`? If yes — **ABORT**.
4. **90+ formula check:** Does the source satisfy all four elements: `primary source` + `fresh catalyst` + `hard number` + `concrete operator consequence`? Name each element. If any is missing — **ABORT**.
5. **Active enforcement gates:** Does the source trigger any hard block, enforcement rule, saturated cluster, pending collision, blocked shape, source-family limit, or operator-delta miss from `docs/active-blocks.md`? If yes — **ABORT**.

All five must pass before drafting. An ABORT at pre-draft scoring is terminal — record the abort reason in `docs/signal-daily-analysis.md` and return to Step 4. Do not attempt to rescue a source by rewriting.

#### 5.2 — Hard Kill Gate

**Before running the kill-gate questions, load active blocks for the target beat:**

Read `docs/target-beat-rules.md` and confirm the target beat row has Candidate Policy = draft.

Write the hard blocks, enforcement rules, saturated clusters, pending collisions, fresh blocked shapes, required source family, required operator delta, and score haircut from `docs/target-beat-rules.md` explicitly before evaluating each question. A candidate that matches any active block is **ABORTED** immediately — do not proceed to the questions.

Run these questions before any headline/body/JSON work. If any answer fails, **ABORT** this candidate immediately — it is permanently discarded. Record the specific failed question and reason in `docs/signal-daily-analysis.md`. Then return to Step 4 for a replacement source family and keep sourcing replacements until the requested batch has enough passing candidates or Step 4 proves that no viable replacement sources remain. Do not stop with an empty or short `docs/draft-signals.md` merely because candidates were aborted.

- Fresh catalyst: does the source itself contain a current event, filing, merge, transaction, purchase, disclosure, policy change, score-changing measurement, or status change?
- Not stale math: is this more than price/timestamp/fee refresh or recalculation over old facts?
- Winner displacement: is the catalyst fresher or the operator consequence stronger than today's approved same-cluster signal?
- Duplicate guard: does it avoid today's brief anchors, last-48h blocked shapes, recent rejected source+metric+implication families, and saturated clusters?
- Batch guard: is this the only candidate in the batch using this exact source family, anchor ID, CIK, PR, issue, paper, endpoint, contract, or metric family?
- Calibration: state the explicit post-haircut estimate as a number using the score haircut from `docs/active-blocks.md`. If no specific calibration row exists in the Step 3.7 source data, the active-blocks file must use the default haircuts: quantum −10 to −15 pts; bitcoin-macro −5 to −10 pts; aibtc-network 0 pts (observability/PR-summary ceiling is 83, not 90+). If the post-haircut number is below 85, this is a **hard block** — **ABORT**. Do not repair by rewriting; only a new source family clears this gate. This ABORT is terminal for this candidate.
- Current lesson: does it satisfy every required source family, required operator delta, hard block, and enforcement rule in `docs/active-blocks.md`?

Do not repair a kill-gate failure by rewriting. Weak freshness, weak displacement, or a below-85 post-haircut estimate all **ABORT** the candidate permanently. Only a new source from Step 4 can clear a kill-gate failure. If every current candidate is aborted, the Step 5 outcome is not complete for Step 6; go back to Step 4, build a fresh verified source list, and rerun Step 5 for replacement candidates before staging JSON.

#### 5.3 — Construct And Check

Only after Step 5.2 passes, construct the helper-ready JSON:

- headline: accepted anchor, hard number/status, no final period
- body and analysis: identical `CLAIM:` / `EVIDENCE:` / `IMPLICATION:` / `Directive:`
- body length: below `900` characters, target `800-900`
- tags: lowercase slugs, `beat_slug` first
- sources: verified objects with `title` and `url`
- disclosure: public-only model/date/source verification; no internal paths or workflow names
- wrapper: include required `workflow_context`

**Pre-stage validation (must pass all 9 before writing to draft-signals.md):**

1. [ ] tags[0] === beat_slug
2. [ ] body.length < 900 (count actual characters)
3. [ ] headline has anchor: PR #, v1.2.3, block height, $, %, sats, bytes
4. [ ] body has CLAIM:, EVIDENCE:, IMPLICATION: labels
5. [ ] disclosure has NO: AGENTS.md, docs/, /step/, local paths
6. [ ] sources[].url matches: /api/, github.com, explorer., releases/tag/
7. [ ] NOT same shape as today brief (check blocked shapes in target-beat-rules.md)
8. [ ] NOT same family as rejected signal (check publisher-feedback-board.md)
9. [ ] IF metric-heavy: 2+ independent sources

If any check fails, fix the JSON and re-validate. Do not stage failed candidates.

Use the current Step 5.3 checklist and Step 6 helper/browser process as the primary validation path. Read `docs/helper-bugs.md` only if there is a current helper failure, a recent unresolved helper blocker, or the operator reports a new helper error.

If the operator gives a new real helper error or filing blocker, log the exact text in `docs/helper-bugs.md`. Do not invent helper bugs.

#### 5.4 — Stage Finished JSON

Write only completed JSON candidates to `docs/draft-signals.md`. Use the exact helper-ready format. Do not create a second stripped-down paste format.

```json
{
  "beat_slug": "<beat>",
  "btc_address": "<address>",
  "headline": "<headline>",
  "body": "CLAIM: ...\n\nEVIDENCE: ...\n\nIMPLICATION: ...\n\nDirective: ...",
  "analysis": "CLAIM: ...\n\nEVIDENCE: ...\n\nIMPLICATION: ...\n\nDirective: ...",
  "sources": [
    { "title": "...", "url": "..." }
  ],
  "tags": ["<beat_slug>", "..."],
  "disclosure": "...",
  "workflow_context": {
    "reportDate": "YYYY-MM-DD",
    "analysisPath": "...",
    "analysisGeneratedAt": "...",
    "reviewedInputs": {
      "signalHistoryPath": "...",
      "editorialMemoryPath": "...",
      "outcomeFeedbackPath": "...",
      "helperErrorsPath": "...",
      "latestBriefPath": "...",
      "distilledLearningBriefPath": "...",
      "beatEditorGuidancePaths": ["..."]
    }
  }
}
```

Required closeout line:

`Confirmed: Pre-stage validation passed (9/9 checks). Signal ready for Step 6.`

### Step 6 — Test With Helper Process Before Final Output

#### 6a — Re-read publisher doc before helper test

Re-read the target beat editor file immediately before helper testing:

- `docs/beat-editors/quantum-zen-rocket.md`
- `docs/beat-editors/bitcoin-macro-ivory-coda.md`
- `docs/beat-editors/aibtc-network-skill.md`

Use the file that matches the signal's `beat_slug`.

Confirm the exact JSON still aligns with:
- required checklist items
- instant rejection triggers
- beat-specific 90+ requirements
- any "never use" rules

If the JSON no longer aligns, revise it before helper testing. Do not rely on memory from Step 3.

#### 6b — Test exact JSON in the local helper

Before calling any signal `JSON ready`, `helper-ready`, `ready to submit`, or before returning the final batch to the operator, test each JSON against the same local filing-helper process the operator uses at:

`http://127.0.0.1:4173/tools/xverse-register/file-signal.html`

**Required:**
- Start or restart the helper if needed.
- Load or paste the exact JSON staged in `docs/draft-signals.md`.
- Validate the exact JSON through the helper normalization path.
- Validate the payload through the local signal-guard path.
- Confirm there are no pre-login helper blockers before the `Sign Request` stage.
- Check the exact browser-side helper rules in `tools/xverse-register/file-signal.html`, not just the server-side guard approximation.

**Explicit interpretation:**
- Repo-side validation alone is not enough.
- Script output alone is not enough.
- If the operator specifically asked for browser-side confirmation, the agent must actually open or otherwise use the local helper page and check the exact JSON there.
- If browser access is unavailable, blocked, or not performed, the agent must say `locally validated only` and must not say `ready to submit`.

**Minimum browser-side checks:**
- `getHeadlineAnchorPass(...)`
- required template labels
- empty template sections
- universal payload hints
- headline length and no-period rule
- source presence and source `url` / `title` validity
- `beat_slug` present in `tags`

**This step is specifically for catching:**
- missing helper wrapper fields such as `workflow_context`
- helper/template/guard failures
- any pre-login helper error the operator would otherwise discover manually

#### 6c — Pass condition and reporting

**Pass condition:**
- helper normalization passes
- local signal guard passes
- no pre-login helper rejection remains
- exact browser helper checks in `file-signal.html` pass for the same JSON
- the re-read target beat editor file confirms the JSON still aligns with publisher rules

**Reporting rule:**
- If all repo-side checks pass but the browser helper page was not actually used, report `locally validated only`.
- If the browser helper page was used and no pre-login blocker remains, report `browser-helper confirmed`.
- Only after `browser-helper confirmed` may the agent say `ready to submit`.

**Not required:**
- wallet login
- final signed submission

**Hard rule:**
- Do not return final JSON output until every JSON in the batch passes Step 6.

---

### Step 7 — Review and Update Live Score Calibration

Final-review and update the live score calibration before any more filing.

Read `docs/live-score-calibration.md`.
Re-check the recent rows in `docs/publisher-feedback-board.md`, prioritizing rows from the current comparison window and any newly scored signals since the last calibration update.
Read `docs/daily-brief-source-comparison.md`.
Read `docs/signal-daily-analysis.md`.
Read the relevant publisher/beat editor doc for every beat represented in `docs/draft-signals.md`:
- `docs/beat-editors/quantum-zen-rocket.md` for `quantum`
- `docs/beat-editors/bitcoin-macro-ivory-coda.md` for `bitcoin-macro`
- `docs/beat-editors/aibtc-network-skill.md` for `aibtc-network`
Confirm whether every `<80`, `80-89`, and unresolved `90+` row is represented correctly.
Add any missing low-score findings to `docs/live-score-calibration.md`.
Use those findings, plus the current daily brief source comparison and signal daily analysis lessons, to review the current `docs/draft-signals.md`.
Confirm every staged JSON still has a winning source pattern or fresher catalyst than today's approved signals, a stronger operator consequence than any rejected/displaced same-family signal, no repeated failure mode from the current comparison window, and plausible `85+` live-score power after applying the relevant calibration haircut.
If any draft signal does not meet the `85+` final-audit standard, do not leave it as-is and do not close Step 7. Immediately update `docs/signal-daily-analysis.md` with the exact failed lesson, Step 3 plan requirement, and Step 5 enforcement rule that would have prevented the miss. Then update `docs/draft-signals.md` until the JSON either passes the `85+` final-audit standard or is explicitly marked hold/removed.
If any draft signal matches a `<80` hard-miss family, an `80-89` below-target family without a new source catalyst and stronger operator consequence, or violates the relevant publisher/beat editor doc, update `docs/signal-daily-analysis.md` with that failure mode and update `docs/draft-signals.md` immediately to mark it hold, remove it, or rework the JSON into compliant form.
Confirm that `docs/draft-signals.md` is now informed by the up-to-date live-score calibration.

Step 7 is a final audit, not the first construction pass. The calibration data should already have been created or updated in Step 2D and enforced during Step 5.

Required closeout line:

`Confirmed: live-score calibration reviewed against publisher feedback and applied to current draft-signal doc or updated to ensure its submit ready.`
