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

**Goal:** Compare what won today per beat against what we submitted. Step 2C is the evidence table; Step 2D turns the comparison into daily analysis and Step 2E turns publisher feedback into live-score calibration gates for Step 3/5.

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

Step 2D updates `docs/signal-daily-analysis.md`. It explains what changed in the brief and feedback snapshot, then turns that evidence into Step 3 planning requirements and Step 5 enforcement rules. Step 2D does not update `docs/live-score-calibration.md`; Step 2E owns that file.

Read:
1. `docs/homepage-brief-snapshots.md`
2. `docs/publisher-feedback-board.md`
3. `docs/daily-brief-source-comparison.md`
4. Publisher/beat editor docs:
   - `docs/beat-editors/quantum-zen-rocket.md`
   - `docs/beat-editors/bitcoin-macro-ivory-coda.md`
   - `docs/beat-editors/aibtc-network-skill.md`

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

**Goal:** Update `docs/live-score-calibration.md` so under-80 and below-target publisher/API scores become JSON creation gates before Step 5.6 stages any candidate.

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
- Only analyze rows with an actual live score and real publisher feedback or publisher outcome.
- Skip rows with blank scores.
- Skip rows that are still only `Pending review` / `submitted` with no real feedback outcome.

Use this table:

| Date | Signal ID | Beat | Live Score | Failed JSON Field(s) | Payload Failure Pattern | Beat Editor Conflict | JSON Gate Before Staging | Required Upgrade To Proceed |
|---|---|---|---:|---|---|---|---|---|

For every newly assessed signal with a live score below `80` and real publisher feedback or outcome, add or update one row.

For `80-89` signals, add a row only when there is real publisher feedback or outcome and the score reveals a reusable JSON creation lesson that would affect Step 5.6 staging.

Column rules:
- `Failed JSON Field(s)`: name the JSON field(s) that caused the score miss, such as `headline`, `body`, `analysis`, `sources`, `tags`, `disclosure`, `operator_implication`, or `story_family`.
- `Payload Failure Pattern`: describe the reusable payload mistake, not the whole publisher outcome.
- `Beat Editor Conflict`: cite the relevant beat editor rule or requirement the payload failed.
- `JSON Gate Before Staging`: write the hard block Step 5.6 must apply before placing JSON in `docs/draft-signals.md`.
- `Required Upgrade To Proceed`: state what must be improved before a similar candidate can be staged.

Rules:
- Do not copy the whole publisher feedback row.
- Do not summarize the daily brief.
- Do not duplicate `docs/daily-brief-source-comparison.md`.
- Focus on the submitted JSON payload and why it scored below target.
- If the submitted JSON is unavailable, infer only from the headline, one-line signal, sources, score, and beat editor doc; mark the row as `payload unavailable`.
- If a failure pattern already exists, update it with the newest signal ID and score instead of creating a duplicate pattern row.
- Step 2E is not complete until every new under-80 scored signal with real publisher feedback or outcome has either a calibration row or an explicit note saying why no JSON creation lesson was found.

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
- `What scores 90+`, `Instant rejection triggers`, and `What must change before drafting` must include Step 2D score-drift lessons and Step 2E live-score calibration gates for the target beat
- `Candidate fit`: `n/a` if no candidate yet, otherwise `yes`, `partial`, or `no`

#### 3.6 — Gate Before Step 4

Confirm all six before proceeding:

- [ ] All seven docs read in full
- [ ] Blocked shapes extracted fresh from today’s `homepage-brief-snapshots.md`
- [ ] Helper failure patterns recorded
- [ ] `docs/target-beat-rules.md` updated
- [ ] Step 3.7 target beat execution plan written or updated (includes calibration absorption)

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

- `Candidate Policy` must be exactly `draft`, `hold`, or `abort` plus a short reason.
- If `hold` or `abort`: stop here, do not proceed to Step 4.
- Step 4 may only use source families listed in `Required Source Family`.

---

### Step 4 — Build Verified Source List (Required Before Step 5)

**Goal:** Create the only source list Step 5 may use. Keep only sources that can support a fresh, helper-valid, non-duplicate signal.

#### 4.1 — Start From Tier 1 Sources

Use the target beat editor read in Step 3.2.

Extract only:
- Tier 1 source URL
- what exact claim, metric, or anchor it can prove
- anchor type, such as PR, issue, release tag, BIP, API metric, block height, paper ID, or NIST reference

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

#### 4.3 — Remove Helper-Invalid Sources

Use the accepted source substrings from `docs/helper-bugs.md`.

Keep only URLs containing at least one accepted substring:

`/api/` · `github.com` · `explorer.` · `releases/tag/` · `issues/<n>` · `pull/<n>` · `bip-<n>` · `docs.` · `arxiv.org/abs/` · `eprint.iacr.org/` · `csrc.nist.gov/` · `gnusha.org` · `delvingbitcoin.org`

Remove every source that fails this whitelist.

**Hard rule:** a source that fails the helper whitelist cannot enter JSON.

#### 4.4 — Remove Shape-Blocked Sources

Use the blocked shapes already stored in `docs/target-beat-rules.md`.

Remove any source whose usable claims all map to:
- a blocked story shape
- the same story with fresher numbers
- a saturated cluster
- a recently rejected source family plus metric family plus implication family

Keep a source only if it can prove at least one fresh claim family that avoids those blocks.

#### 4.5 — Output Verified Source List

Output only the sources that survived 4.2, 4.3, and 4.4.

Use this exact format:

`[URL] — proves [specific claim or metric] — anchor: [exact value]`

This list is the only input Step 5.2 may use.

For metric-heavy claims:
- require two independent organizations or source systems when the claim combines multiple figures, comparisons, or market-wide implications
- allow one source only when it is the canonical primary source and fully proves the exact claim
- if a second source is needed, it must appear in this verified list before Step 5 begins

**Hard rule:** if the verified source list is empty, stop. Do not proceed to Step 5. Report that no signal can be filed today for this beat.

#### 4.6 — Update `docs/sources.md` Only If Useful

Update `docs/sources.md` only when today's winning briefs reveal a new reusable source pattern that helps future sourcing.

Do not update `docs/sources.md` for:
- one-off URLs
- rejected sources
- sources already documented
- sources that failed the helper whitelist
- sources that cannot support a fresh winning signal

---

### Step 5 — Create Signal (Deterministic)

**Goal:** Produce the requested number of valid, non-duplicate JSON signals using only the pre-verified inputs from Steps 3 and 4. Default to at least 4 candidates unless the operator explicitly asks for fewer.

`docs/draft-signals.md` is the staging file for finished Step 5 JSON only. Do not use it for rough notes, partial drafts, or speculative candidates.

Status language is strict:
- `locally validated` = repo-side checks pass, including helper normalization and local signal guard
- `browser-helper confirmed` = exact JSON was checked in `file-signal.html` with no pre-login blocker before Sign Request
- `ready to submit` = only use after `browser-helper confirmed`

**Hard rule:** placing JSON in `docs/draft-signals.md` does not mean it is ready to submit.

#### 5.1 — Confirm Inputs

Confirm these are available from prior steps:

- [ ] Blocked shapes from Step 3.3 in `docs/target-beat-rules.md`
- [ ] Helper failure patterns from Step 3.4
- [ ] Verified source list from Step 4.5

If any input is missing, return to the missing step. Do not draft.

Do not re-read source docs in Step 5 unless `docs/helper-bugs.md` changed after Step 3.2.

#### 5.2 — Select Anchor From Verified Sources Only

Pick one source from the Step 4.5 verified source list.

Extract:
- exact anchor ID, such as PR number, issue number, arXiv ID, BIP, release tag, block height, or metric value
- exact numeric, version, or status claim
- timestamp or freshness marker
- source URL and title

**Hard rule:** do not select a source outside the Step 4.5 verified list.

If no clear anchor plus number/status exists, abort that candidate.

For metric-heavy claims:
- use two independent organizations or source systems when the claim combines multiple figures, comparisons, or market-wide implications
- use one source only when it is the canonical primary source and fully proves the exact claim
- if a second source is required, it must already be in the Step 4.5 verified list

#### 5.3 — Duplicate And Shape Guard

Block the candidate if any answer is `yes`:

- Does it repeat an anchor ID already used in today's brief?
- Does it reuse the same source plus same numeric claim?
- Does it repeat a blocked story shape from today or the last 48h brief window?
- Is it the same story with fresher numbers?
- Does it reuse the same metric family, comparison frame, or operator implication as a prior posted winner?
- Does it reuse the same source family plus metric family plus implication family as a recent rejected filing?
- Is the cluster already saturated?

Do not compare headlines only. Compare:
- source anchor family
- core metric family
- comparison frame
- operator implication

If blocked, reject the candidate locally and pick a different claim family from Step 4.5.

If every Step 4.5 source is blocked, stop and report that no signal can be filed for this beat.

#### 5.4 — Construct Signal

**Headline:** anchor plus number/status, non-blocked structure, no paraphrase-only headlines, no final period

**Body = Analysis (identical):**

CLAIM: <one sentence with anchor plus number/status>

EVIDENCE: <source-backed facts, include timestamp/ID>

IMPLICATION: <direct effect on agents / bitcoin users / system>

Directive: <exact action to take>

**Tags:** lowercase slugs only, beat_slug must be first tag

**Disclosure:** model name + every doc checked + date + what was verified from which source

**Helper-ready wrapper:** include any helper-required wrapper fields needed by the local filing helper, including `workflow_context` when required by the repo helper path

Body length rule:
- target `800-900` characters
- if the body reaches `900` characters, trim before filing
- do not rely on the live API to truncate safely

Then check the constructed JSON against every known failure mode from `docs/helper-bugs.md` (read in Step 3.2 — do not re-read unless it has been updated since then):

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

The goal is not to run a checklist — it is to confirm no known failure mode is present in the payload. If `docs/helper-bugs.md` has been updated since Step 3.2, re-read it now before checking.

#### 5.4b — Log New Helper Bugs Only When Given

If the operator gives a new helper error or filing blocker, copy that exact text into `docs/helper-bugs.md` before staging or testing more JSON. Do not paraphrase it.

Add:
- date
- exact error text from the operator
- what caused it
- fix before next JSON

Do not invent helper bugs. Do not update `docs/helper-bugs.md` during normal drafting unless there is a new real error.

#### 5.5 — Pre-Validation

All must be true before writing to `docs/draft-signals.md`:

- [ ] Source came from Step 4.5
- [ ] Clear anchor plus number/status exists
- [ ] Not duplicate by anchor, source, claim, cluster, or story family
- [ ] Headline structure is not in the Step 3.3 blocked list
- [ ] Headline contains an accepted anchor and has no final period
- [ ] `body` equals `analysis`
- [ ] `CLAIM:`, `EVIDENCE:`, `IMPLICATION:`, and `Directive:` are present and non-empty
- [ ] Body is below `900` characters
- [ ] Sources include valid `title` and `url`
- [ ] Every source URL passes the helper whitelist
- [ ] Tags are lowercase slugs and `beat_slug` is first
- [ ] Disclosure is complete
- [ ] Metric-heavy claims have enough verified support

#### 5.6 — Stage Finished JSON For Helper Testing

Write each completed JSON candidate into `docs/draft-signals.md`.

Use the exact helper-ready JSON format below. Do not create a second stripped-down paste format.

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

#### 5.7 — Review JSON Against Live Calibration

Before helper testing, re-read `docs/live-score-calibration.md` and compare every staged JSON object in `docs/draft-signals.md` against the calibration table.

Execution:

- if calibration review finds an issue, resolve it by updating the JSON object in `docs/draft-signals.md`
- if the issue cannot be resolved, mark the JSON `hold` in `docs/draft-signals.md`

Then check each JSON against every known failure mode from `docs/helper-bugs.md` (read in Step 3.2 — do not re-read unless it has been updated since then):

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

Do not proceed to Step 6 until every staged JSON has been reviewed against `docs/live-score-calibration.md`, every bug-check passes, and every required JSON update in `docs/draft-signals.md` is complete.

Required closeout line:

`Confirmed: live-score calibration reviewed during JSON readiness and draft JSON updated or held before helper testing.`

### Step 7 — Review and Update Live Score Calibration

Final-review and update the live score calibration before any more filing.

Read `docs/live-score-calibration.md`.
Re-check the recent rows in `docs/publisher-feedback-board.md`, prioritizing rows from the current comparison window and any newly scored signals since the last calibration update.
Confirm whether every `<80`, `80-89`, and unresolved `90+` row is represented correctly.
Add any missing low-score findings to `docs/live-score-calibration.md`.
Use those findings to review the current `docs/draft-signals.md`.
If any draft signal matches a `<80` hard-miss family or an `80-89` below-target family without a new source catalyst and stronger operator consequence, update `docs/draft-signals.md` to mark it hold or remove/rework it.
Confirm that `docs/draft-signals.md` is now informed by the up-to-date live-score calibration.

Step 7 is a final audit, not the first construction pass. The calibration data should already have been created or updated in Step 2D and enforced during Step 5.7.

Required closeout line:

`Confirmed: live-score calibration reviewed against publisher feedback and applied to current draft-signal doc or updated to ensure its submit ready.`
