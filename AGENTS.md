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
| `docs/live-score-calibration.md` | Step 2D + Step 3.2 + Step 5.5c + Step 5.7 + Step 7 |
| `docs/beat-editors/quantum-zen-rocket.md` | Step 3 — quantum signals only |
| `docs/beat-editors/bitcoin-macro-ivory-coda.md` | Step 3 — bitcoin-macro signals only |
| `docs/beat-editors/aibtc-network-skill.md` | Step 3 — aibtc-network signals only |
| `docs/sources.md` | Step 4 — Tier 1/2/3 rules per beat |
| `docs/helper-bugs.md` | Step 3.2 + Step 5.4b |
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

Required table format:
`| Date | Signal ID | Beat | Title | One-line signal | Notes | Publisher feedback | Status |`

Status meanings:
- `submitted` = filed, awaiting review
- `approved` = publisher approved
- `rejected` = publisher rejected
- `replaced` = displaced by another signal

---

### Step 2C — Complete Daily Brief Source Comparison

**Goal:** Compare what won today per beat against what we submitted. Step 2C is the evidence table; Step 2D turns the comparison into daily analysis and Step 3/5 rules.

Read only:
1. `docs/homepage-brief-snapshots.md`
2. `docs/publisher-feedback-board.md`
3. `docs/helper-bugs.md`
4. `docs/beat-editors/*.md`

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

Step 2D is where `docs/live-score-calibration.md` is created or updated. This doc is not just a review checklist. It is the constructed score-learning layer: it compares the feedback snapshot against publisher/beat rules and explains why submitted signals failed to reach `80+`, stalled in the `80-89` band, or remained unresolved despite local confidence.

Read:
1. `docs/homepage-brief-snapshots.md`
2. `docs/publisher-feedback-board.md`
3. `docs/daily-brief-source-comparison.md`
4. Target beat editor docs in `docs/beat-editors/*.md`
5. `docs/live-score-calibration.md` if it exists

Analyze:
- what live winners had that our submitted signals lacked
- what the publisher/beat docs required and whether each submitted signal met those requirements
- which submitted signals dropped from local/draft confidence into lower live score bands
- why any signal failed to reach `80+`, failed to become `90+`, or lacked displacement power
- which failure mode caused the drift: source specificity, duplicate cluster, weak beat fit, generic implication, cap/displacement threshold, helper bug, or overbroad metric framing
- what must be blocked, required, or escalated before drafting again

Update `docs/signal-daily-analysis.md` using this table:

| Date | Beat | Evidence From Brief | Submitted Outcome | Score Drift / Failure Mode | Lesson | Step 3 Plan Requirement | Step 5 Enforcement Rule |
|---|---|---|---|---|---|---|---|

Also create or update `docs/live-score-calibration.md` with the evidence behind those lessons. It must include:
- `<80` hard-miss families and the publisher/beat requirement they missed
- `80-89` below-target families and the missing `90+` or displacement ingredient
- unresolved `90+` families that must not be reused until publisher feedback lands
- the exact gate Step 5.5c/Step 5.7 must enforce before JSON staging or helper readiness

Rules:
- Step 2D is mandatory after Step 2C whenever there is new publisher feedback, a new brief snapshot, or a submitted signal with score drift.
- Do not infer approval from `submitted`; mark unresolved outcomes as `submitted/no feedback`.
- If live publisher/API scoring drops an apparently `80+` candidate into the `70s` or low `80s`, record the haircut lesson explicitly.
- Each row must include one concrete Step 3 plan requirement and one concrete Step 5 enforcement rule.
- Step 2D is not complete until it creates at least one enforceable lesson for each beat with submitted, rejected, replaced, or approved signals in the current comparison window.
- Step 2D is not complete until `docs/live-score-calibration.md` reflects the current feedback snapshot and publisher/beat rule analysis.
- Step 3 must copy the relevant Step 2D lesson into `docs/target-beat-rules.md`; Step 5.5c and Step 5.7 must enforce it before staging or helper-ready output.

---

### Step 3 — Load Beat Context (Required Before Any Drafting)

**Goal:** Front-load every constraint Step 5 needs. By the end of Step 3, nothing new should be discovered in Step 5.

#### 3.1 — Identify Target Beat

Run for each beat currently available to submit to from Step 1:

- `quantum`
- `bitcoin-macro`
- `aibtc-network`

#### 3.2 — Read All Required Docs (no skipping, no reusing cached reads)

Read in this exact order:

| # | File | What to extract |
|---|---|---|
| 1 | Beat editor for target beat only | Scoring rules, required checklist, instant rejection triggers, Tier 1 source list |
| 2 | `docs/homepage-brief-snapshots.md` | Blocked shapes — see 3.3 |
| 3 | `docs/publisher-feedback-board.md` | Rejection reasons, displacement patterns, score thresholds |
| 4 | `docs/daily-brief-source-comparison.md` | Story shapes that won and lost, sourcing mistakes |
| 5 | `docs/signal-daily-analysis.md` | Score drift, failure modes, Step 3 plan requirements, Step 5 enforcement rules |
| 6 | `docs/live-score-calibration.md` | Live score bands, sub-80 hard misses, 80-89 below-target patterns, and the gate that should have blocked each |
| 7 | `docs/helper-bugs.md` | Every bug entry — verbatim error, cause, fix, accepted anchor patterns, accepted source URL substrings, tag rules |

Beat editor files:

| Beat | File |
|---|---|
| `quantum` | `docs/beat-editors/quantum-zen-rocket.md` |
| `bitcoin-macro` | `docs/beat-editors/bitcoin-macro-ivory-coda.md` |
| `aibtc-network` | `docs/beat-editors/aibtc-network-skill.md` |

**Hard rule:** read all seven. Never skip. Never reuse a cached read from a prior session.

#### 3.3 — Extract Blocked Shapes (ALWAYS fresh, NEVER cached)

From `docs/homepage-brief-snapshots.md`:

1. Find every brief entry for the target beat from the last 48 hours.
2. For every headline, extract the structure, not the numbers. Example: `[N] Blocks Left Before [%] Retarget` is the same structure whether N is `1,094` or `1,372`.
3. Find every `Duplicates removed` note at the bottom of each brief and extract every structure listed there too.
4. Write every extracted structure into the `Blocked shapes` column of `docs/target-beat-rules.md`.

**Hard rule:** the `Blocked shapes` column must always be re-extracted fresh from `docs/homepage-brief-snapshots.md` on the current day. Even if a row already exists for today's date and beat, re-extract blocked shapes. Never carry over yesterday’s list.

A shape is blocked if it appears anywhere in the last 48h brief for the target beat, regardless of whether the numbers are different.

#### 3.4 — Extract Helper Failure Patterns

From `docs/helper-bugs.md`, for each bug entry read the verbatim error, what caused it, and the fix. Then record:

- every accepted headline anchor pattern
- every accepted source URL substring
- tag format rules

These feed directly into Step 5.4b. Reading them here means Step 5.4b is a confirmation check, not a discovery step.

#### 3.5 — File Into `docs/target-beat-rules.md`

Use this table format:

| Date | Beat | What scores 90+ | Required checklist | Instant rejection triggers | Blocked shapes (fresh, today) | Helper failure patterns | Candidate fit | What must change before drafting |
|---|---|---|---|---|---|---|---|---|

Rules:
- one row per date + beat combination
- `Blocked shapes`: always re-extracted today, never copied from a prior row
- `Helper failure patterns`: accepted anchor patterns + accepted source substrings from `helper-bugs.md`
- `What scores 90+`, `Instant rejection triggers`, and `What must change before drafting` must include Step 2D score-drift and enforcement-rule lessons for the target beat
- `Candidate fit`: `n/a` if no candidate yet, otherwise `yes`, `partial`, or `no`

#### 3.6 — Gate Before Step 4

Confirm all six before proceeding:

- [ ] All seven docs read in full
- [ ] Blocked shapes extracted fresh from today’s `homepage-brief-snapshots.md`
- [ ] Helper failure patterns recorded
- [ ] `docs/target-beat-rules.md` updated
- [ ] Step 3.8 live-score calibration absorption completed
- [ ] Step 3.7 target beat execution plan written or updated

**Do not proceed to Step 4 until all six are confirmed.**

#### 3.7 — Target Beat Execution Plan

**Goal:** Turn `docs/target-beat-rules.md` from a rule record into a concrete plan before any source hunting or drafting begins.

Using the target beat row in `docs/target-beat-rules.md`, the relevant Step 2D row in `docs/signal-daily-analysis.md`, and the relevant Step 3.8 live-score calibration lessons, append or update one row in the `Target Beat Plans` table in `docs/target-beat-rules.md`:

| Date | Beat | Open Slots | Winning Bar | Do Not Draft | Required Source Family | Required Operator Delta | Score Haircut | Candidate Policy | Next Action |
|---|---|---:|---|---|---|---|---|---|---|

Rules:
- One row per date + beat.
- If no row exists for today and target beat, create one.
- If a row exists, update it with fresh Step 2D lessons and today's blocked shapes.
- `Candidate Policy` must be exactly `draft`, `hold`, or `abort`, followed by a short reason.
- If `Candidate Policy` is `hold` or `abort`, do not proceed to Step 4.
- Step 4 may only use source families allowed by `Required Source Family`.

#### 3.8 — Live-Score Calibration Absorption

**Goal:** Make `docs/live-score-calibration.md` affect source selection and drafting before any JSON exists.

Using `docs/live-score-calibration.md`, add the relevant score-calibration lessons into the target beat row and/or `Target Beat Plans` row in `docs/target-beat-rules.md`.

Required extraction:
- `<80` hard-miss story families for the target beat
- `80-89` below-target story families for the target beat
- unresolved `90+` families that must not be reused until publisher feedback lands
- the exact new gate from `docs/live-score-calibration.md`

Rules:
- If a candidate family appears in the `<80` hard-miss band, Step 4 must not source it unless a new primary catalyst changes the live operator action.
- If a candidate family appears in the `80-89` below-target band, Step 4 may only continue if it has a new source catalyst plus a stronger operator consequence.
- If a candidate family appears as unresolved `90+`, Step 4 must not reuse it until publisher feedback confirms the outcome.
- These constraints must be visible in `docs/target-beat-rules.md` before Step 4 begins.

---

### Step 4 — Build Verified Source List (Required Before Step 5)

**Goal:** Build the only source list Step 5 may use.

#### 4.1 — Pull Tier 1 Sources

From the target beat editor read in Step 3.2, extract every Tier 1 source URL and what it proves.

#### 4.2 — Remove Sources Already Used Today

From `docs/homepage-brief-snapshots.md`, find every source URL and numeric anchor already used today for the target beat.

Mark each Tier 1 source:
- `available` = source + numeric anchor not already used today
- `blocked` = same source + same numeric claim already used today

Remove all `blocked` sources.

If today's brief is empty, treat all Tier 1 sources as `available` and note that.

#### 4.3 — Apply Helper Whitelist

From `docs/helper-bugs.md`, keep only sources whose URL contains at least one accepted substring:

`/api/` · `github.com` · `explorer.` · `releases/tag/` · `issues/<n>` · `pull/<n>` · `bip-<n>` · `docs.` · `arxiv.org/abs/` · `eprint.iacr.org/` · `csrc.nist.gov/` · `gnusha.org` · `delvingbitcoin.org`

Remove every source that fails this whitelist.

**Hard rule:** a source that fails the whitelist cannot enter JSON.

#### 4.4 — Remove Shape-Blocked Sources

From the blocked shapes stored in `docs/target-beat-rules.md`, check each remaining source:

- `available` = can prove at least one non-blocked claim
- `shape-blocked` = every claim it proves maps to a blocked shape

Remove all `shape-blocked` sources.

#### 4.5 — Output Verified Source List

Use this format:

`[URL] — proves [metric] — anchor: [exact value]`

This list is the only input Step 5.2 may use.

For metric-heavy claims:
- do not rely on one organization alone if the claim combines multiple figures, comparisons, or market-wide implications
- require two independent organizations or source systems unless one canonical primary source fully proves the exact claim
- if a second source is needed for comparison, baseline, or consequence, it must also be in this verified list before Step 5 begins

**Hard rule:** if this list is empty, do not proceed to Step 5. Report that no signal can be filed today for this beat.

#### 4.6 — Update `docs/sources.md`

Add any new source patterns found in today's winning briefs that are not already in `docs/sources.md`.

---

### Step 5 — Create Signal (Deterministic)

**Goal:** Produce the number of valid, non-duplicate JSON signals requested by the operator, using only pre-verified inputs from Steps 3 and 4. Default to a batch of at least `4` unless the operator explicitly asks for fewer. Stage each finished candidate in `docs/draft-signals.md` before final JSON output.

`docs/draft-signals.md` is the staging file for finished Step 5 candidates that are ready for Step 5.7 testing. Despite the filename, do not use it for rough notes, partials, or speculative drafts. Only place finished JSON there once the signal is fully constructed, passes Step 5.5, and is ready for helper testing.

Status language is strict:

- `locally validated` = repo-side checks pass, such as helper normalization and local signal guard
- `browser-helper confirmed` = the exact JSON has also been checked in `file-signal.html` with no pre-login blocker before `Sign Request`
- `ready to submit` = only use this phrase after `browser-helper confirmed`

Hard rule: do not treat `docs/draft-signals.md` placement alone as proof that a signal is ready to submit.

#### 5.1 — Identify Beat and Select Signals

Read:

| # | File | What to extract |
|---|---|---|
| 1 | Beat editor for target beat | Scoring rules, required checklist, instant rejection triggers |
| 2 | `docs/daily-brief-source-comparison.md` | What is winning, what failed, and why |
| 3 | `docs/signal-daily-analysis.md` | Score drift, failure modes, Step 5 enforcement rules |
| 4 | `docs/draft-signals.md` | What is already staged — avoid duplicating anchor or story family |

Beat editor files:

| Beat | File |
|---|---|
| `quantum` | `docs/beat-editors/quantum-zen-rocket.md` |
| `bitcoin-macro` | `docs/beat-editors/bitcoin-macro-ivory-coda.md` |
| `aibtc-network` | `docs/beat-editors/aibtc-network-skill.md` |

**Default output: 2 draft stories per available beat (6 total across quantum, bitcoin-macro, aibtc-network). Output is draft stories only — no JSON. Do not proceed to Step 5.2 until all stories are staged in `docs/draft-signals.md`.**

1. **Identify target beat** — quantum, bitcoin-macro, or aibtc-network
2. **Analyze relevant publisher doc** — read the matching beat editor file for the target beat; extract scoring rules, required checklist, and instant rejection triggers
3. **Load competitive context** — read `docs/daily-brief-source-comparison.md` and `docs/signal-daily-analysis.md`; identify what is winning, what failed, and why
4. **Select signals** — choose 2 anchors per beat that can compete against current brief winners; do not select if the story family is already saturated or recently rejected
5. **Score against beat editor** — using the same beat editor file loaded in step 2, score each selected signal against the 90+ bar. If a signal passes, keep it. If it fails, remove it and return to step 4 to select a replacement anchor.
6. **Stage each passing candidate in `docs/draft-signals.md`** — each signal includes a headline, analysis, sources, and tags. Use this format:

```
## Signal [N]

**Headline:** <headline>

**Analysis:**
CLAIM: ...
EVIDENCE: ...
IMPLICATION: ...

**Sources:**
- <title> — <url>

**Tags:** <beat_slug>, <tag>, <tag>
```

Complete all 6 stories across all 3 beats before stopping. If a beat has fewer than 2 passing candidates, report why and move on — do not halt the full batch.

#### 5.2 — Select Anchor

Pick one source from the verified list produced in Step 4.5. Extract:
- exact anchor ID (PR #, arXiv ID, BIP, block height, metric value)
- exact numeric or version claim
- timestamp / freshness

If the claim is metric-heavy:
- identify whether one canonical source fully proves it or whether a second independent organization is required
- if a second source is required for verification, comparison, baseline, or market-wide framing, do not proceed until both sources are selected

**Hard rule: only pick from Step 4.5 output. Do not select a source independently.**
**Hard rule: if no clear anchor + number exists, abort.**

#### 5.3 — Duplicate Guard

Block if ANY match:
- same anchor ID already in today's brief
- same source + same numeric claim already used
- same cluster already saturated

**Do NOT compare headlines — compare anchor + claim.**

#### 5.3b — Shape Guard

Use the blocked shapes list from Step 3.3 stored in `docs/target-beat-rules.md`. Do not re-derive.

Map your candidate headline structure to every shape on that list. If it maps to any blocked shape → pick a different anchor from Step 4.5 or abort.

Do not check wording alone. Compare the full story family:
- source anchor family
- core metric family
- comparison frame
- operator implication

If the candidate keeps the same story family and only changes numbers, timestamps, or phrasing, it is still blocked.
If the candidate is too close to a prior posted brief story family or a previously rejected recent filing, treat that family as burned for the day and switch families entirely.

**Hard rule: do not use a hardcoded shape list. Always use the list extracted fresh in Step 3.3 for today's date.**

**If every anchor from Step 4.5 maps to a blocked shape → do not file. Report instead.**

#### 5.4 — Construct Signal (fixed order)

**Headline:** anchor + number, non-blocked structure, no paraphrase-only headlines

**Body = Analysis (identical):**

CLAIM: <one sentence with anchor + number>

EVIDENCE: <source-backed facts, include timestamp/ID>

IMPLICATION: <direct effect on agents / bitcoin users / system>

**Tags:** lowercase slugs only, beat_slug must be first tag

**Disclosure:** model name + every doc checked + date + what was verified from which source

**Helper-ready wrapper:** include any helper-required wrapper fields needed by the local filing helper, including `workflow_context` when required by the repo helper path

Body length rule:
- target `800-900` characters
- if the body reaches `900` characters, trim before filing
- do not rely on the live API to truncate safely

#### 5.4b — Apply Helper Bug Lessons

From `docs/helper-bugs.md` (read in Step 3.2 — do not re-read yet):

For every bug entry: read the exact error, what caused it, and the fix. Apply the fix to the current JSON.

| Past bug | Check on current JSON |
|---|---|
| Headline anchor regex mismatch | Does headline contain an anchor from the exact accepted list in the file? |
| Source URL not in whitelist | Does every source URL contain an accepted substring? Check character by character |
| Uppercase tags rejected by live API | Are all tags lowercase slugs? Check every tag individually |
| Body over 900 chars | Count the body. If 900 or above → trim before output; keep filing copy in the safer 800-900 range |
| Body/analysis mismatch | Are `body` and `analysis` character-for-character identical? |
| Missing CLAIM/EVIDENCE/IMPLICATION | Are all three labels present and non-empty? |
| Empty disclosure | Does disclosure name model + sources + date + what was verified? |
| Prior brief story shape collision | Is this too close to a prior posted brief winner even if the numbers are newer? |
| Rejected-shape collision | Does this reuse the same source family + metric family + implication family as a recent rejected filing? |
| Metric-heavy one-source failure | If the claim is metric-heavy, is there enough independent evidence and not just one organization backing the numbers? |

#### 5.4c — Log New Helper Bugs

If the operator gives a new helper error or filing blocker, copy that exact text into `docs/helper-bugs.md` immediately. Do not paraphrase it.

Add:
- date
- exact error text from the operator
- what caused it
- fix before next JSON

Do this before staging the JSON in `docs/draft-signals.md` or testing it in Step 5.7.

**The goal is not to run a checklist — it is to confirm no known failure mode is present in the payload.**

**If `docs/helper-bugs.md` has been updated since Step 3.2, re-read it now. New entries mean new failure modes.**

#### 5.5 — Pre-Validation

All must be true before staging:

- [ ] Headline contains accepted anchor
- [ ] `body` == `analysis` character-for-character
- [ ] `CLAIM:` `EVIDENCE:` `IMPLICATION:` present and non-empty
- [ ] At least 1 Tier 1 source matches anchor
- [ ] Metric-heavy claims have enough independent source support or a single canonical source that fully proves the exact claim
- [ ] Not duplicate by anchor + claim
- [ ] Headline structure not in Step 3.3 blocked list
- [ ] Body is below 900 chars and kept in the safer 800-900 range when possible
- [ ] All tags lowercase slugs, beat_slug first
- [ ] Required helper wrapper fields are present, including `workflow_context` when required

#### 5.5b — Re-check Publisher Rules Before Staging

Re-read the target beat editor file before placing any JSON into `docs/draft-signals.md`.

Confirm the JSON still matches:
- required checklist items
- instant rejection triggers
- beat-specific 90+ requirements
- any “never use” rules

If it does not, revise the JSON before staging it.

#### 5.5c — Live-Score Haircut Gate

Before placing any JSON into `docs/draft-signals.md`, apply a live-score haircut. This is a hard filing gate, not a note.

First, check `docs/live-score-calibration.md`:
- If the candidate matches any `<80` hard-miss story family, reject it locally unless a new primary source changes the live operator action.
- If the candidate matches an `80-89` below-target family, require a new source catalyst plus a stronger operator consequence before drafting.
- If the candidate matches a `90+` unresolved family, do not reuse it until publisher feedback confirms the outcome.

Assume:
- local `80-85` quality usually becomes live `70-78`
- local `86-94` quality may become live `78-86`
- only local `95+` quality is likely to survive as publisher `90+`

Reject the candidate locally unless all are true:
- after a `10-15` point haircut, the candidate still plausibly scores `90+`
- the source proves the exact headline number or anchor without inference leaps
- the story family is not already saturated in today's brief or recent rejections
- the operator implication is specific enough to change an agent, desk, wallet, routing, custody, or filing action today
- the beat fit is obvious from the first claim sentence

If the beat has `0` slots open or the global roster is effectively full, require displacement-grade strength:
- the candidate must be materially stronger than the weakest current winner
- a score tie is not enough
- a clean `83` is not enough
- a valid helper-safe draft is not enough

If Hermes or the drafting agent cannot explain why the live publisher would still score the candidate `90+` after the haircut, do not stage or file it. Return `hold` with the failed gate.

### Step 5.6 — Stage Batch For Helper Testing (STRICT)

Build the full batch requested by the operator, with a default minimum of 4 JSON objects unless the operator explicitly requests fewer.

**Output requirement:**
Write each completed JSON candidate into `docs/draft-signals.md` only after it fully passes Step 5.5, Step 5.5b, Step 5.5c, and is ready for Step 5.7 testing.

**Rules:**
- No explanations, no variants, no partial results.
- Each JSON object must independently pass Step 5.5.
- If any candidate fails Step 5.5, return to Step 5.2 for that candidate, select a different anchor from Step 4.5, and repeat.
- Do not reuse the same anchor, source, or headline structure when retrying.
- Do not reuse the same anchor, source family, metric family, or implication family across multiple JSONs in the same batch unless the operator explicitly requests near-duplicates.
- Do not call any batch complete, ready, or final until every JSON in the batch passes Step 5.7.
- Only exit when the requested number of fully valid signals is constructed or when Step 4.5 leaves no valid anchor for an additional signal.

```json
{
  "beat_slug": "<beat>",
  "btc_address": "<address>",
  "headline": "<headline>",
  "body": "CLAIM: ...\n\nEVIDENCE: ...\n\nIMPLICATION: ...",
  "analysis": "CLAIM: ...\n\nEVIDENCE: ...\n\nIMPLICATION: ...",
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

### Step 5.7 — Re-Review Calibration and Update JSON Before Helper Testing

Before helper testing or calling any JSON `ready`, re-read `docs/live-score-calibration.md` and compare every staged JSON object in `docs/draft-signals.md` against it.

Required:
- confirm the candidate does not match a `<80` hard-miss family unless a new primary source changes the live operator action
- confirm the candidate does not match an `80-89` below-target family unless it has both a new source catalyst and a stronger operator consequence
- confirm unresolved `90+` families are not reused before publisher feedback lands
- confirm the JSON still satisfies the exact Step 5 enforcement rule written in `docs/live-score-calibration.md`

If any JSON fails this review, update `docs/draft-signals.md` before Step 6:
- mark it `hold`, or
- remove it, or
- rework it with a fresh source catalyst and stronger operator consequence.

Do not proceed to Step 6 until `docs/draft-signals.md` has been updated to reflect the current live-score calibration.

Required closeout line:

`Confirmed: live-score calibration reviewed during JSON readiness and draft JSON updated or held before helper testing.`

### Step 6 — Test With Helper Process Before Final Output

#### 6.1 — Helper-Paste JSON Format

By Step 6, the JSON in `docs/draft-signals.md` must be in the exact shape the operator can paste into the local helper:

```json
{
  "beat_slug": "quantum",
  "btc_address": "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv",
  "headline": "",
  "body": "CLAIM: \nEVIDENCE: \nIMPLICATION: \nDirective: ",
  "sources": [],
  "tags": [],
  "disclosure": ""
}
```

Rules:
- Do not include repo-only wrapper fields in the Step 6 paste object.
- Do not include `workflow_context` in the Step 6 paste object.
- Do not include duplicate content fields unless the helper explicitly requires them; `body` is the canonical content field.
- If a Step 5 staged draft includes `analysis`, it must be identical to `body` before converting to this Step 6 helper-paste format.

#### 6a — Re-read publisher doc before helper test

Re-read the target beat editor file immediately before helper testing:

- `docs/beat-editors/quantum-zen-rocket.md`
- `docs/beat-editors/bitcoin-macro-ivory-coda.md`
- `docs/beat-editors/aibtc-network-skill.md`

Use the file that matches the signal’s `beat_slug`.

Confirm the exact JSON still aligns with:
- required checklist items
- instant rejection triggers
- beat-specific 90+ requirements
- any “never use” rules

If the JSON no longer aligns, revise it before helper testing. Do not rely on memory from Step 3.

#### 6b — Test exact JSON in the local helper

Before calling any signal `JSON ready`, `helper-ready`, `ready to submit`, or before returning the final batch to the operator, test each JSON against the same local filing-helper process the operator uses at:

`http://127.0.0.1:4173/tools/xverse-register/file-signal.html`

**Exact input format:**
- Use the exact helper-paste JSON object staged in `docs/draft-signals.md`.
- The object must match the Step 6.1 shape: `beat_slug`, `btc_address`, `headline`, `body`, `sources`, `tags`, and `disclosure`.
- If the staged JSON cannot be pasted into the helper as-is, treat that as a Step 6 blocker and record the exact error in `docs/helper-bugs.md` before changing the draft format.

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

### Step 7 — Review and Update Live Score Calibration

Final-review and update the live score calibration before any more filing.

Read `docs/live-score-calibration.md`.
Re-check the April 24-May 3 rows in `docs/publisher-feedback-board.md`.
Confirm whether every `<80`, `80-89`, and unresolved `90+` row is represented correctly.
Add any missing low-score findings to `docs/live-score-calibration.md`.
Use those findings to review the current `docs/draft-signals.md`.
If any draft signal matches a `<80` hard-miss family or an `80-89` below-target family without a new source catalyst and stronger operator consequence, update `docs/draft-signals.md` to mark it hold or remove/rework it.
Confirm that `docs/draft-signals.md` is now informed by the up-to-date live-score calibration.

Step 7 is a final audit, not the first construction pass. The calibration data should already have been created or updated in Step 2D and enforced during Step 5.7.

Required closeout line:

`Confirmed: live-score calibration reviewed against publisher feedback and applied to current draft-signal doc or updated to ensure its submit ready.`
