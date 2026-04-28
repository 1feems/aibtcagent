# Agent Instructions

## Goal

Produce signals that score 90+ with the publisher, earn brief inclusion, and advance the leaderboard. Only file when a signal can compete for brief inclusion.

---

## Required Docs

Read these before every signal. No exceptions.

| Doc | Read at |
|---|---|
| `docs/beat-capacity-board.md` | Step 1 — before anything else |
| `docs/publisher-feedback-board.md` | Step 2 + Step 3.2 |
| `docs/homepage-brief-snapshots.md` | Step 2 + Step 3.2 |
| `docs/daily-brief-source-comparison.md` | Step 2 + Step 3.2 |
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

Read only:
1. `docs/homepage-brief-snapshots.md`
2. `docs/helper-bugs.md`
3. `docs/publisher-feedback-board.md`

Update only `docs/daily-brief-source-comparison.md` with:
- source types working per beat
- winning story shapes per beat
- story shapes that lost
- source or helper patterns to avoid

Preserve the existing table format.

---

### Step 3 — Load Beat Context (Required Before Any Drafting)

**Goal:** Front-load every constraint Step 5 needs. By the end of Step 3, nothing new should be discovered in Step 5.

#### 3.1 — Identify Target Beat
 Run  for each beat present  availble to submt to from step 1. `quantum` · `bitcoin-macro` · `aibtc-network`

#### 3.2 — Read All Required Docs (no skipping, no reusing cached reads)

Read in this exact order:

| # | File | What to extract |
|---|---|---|
| 1 | Beat editor for target beat only | Scoring rules, required checklist, instant rejection triggers, Tier 1 source list |
| 2 | `docs/homepage-brief-snapshots.md` | Blocked shapes — see 3.3 |
| 3 | `docs/publisher-feedback-board.md` | Rejection reasons, displacement patterns, score thresholds |
| 4 | `docs/daily-brief-source-comparison.md` | Story shapes that won and lost, sourcing mistakes |
| 5 | `docs/helper-bugs.md` | Every bug entry — verbatim error, cause, fix, accepted anchor patterns, accepted source URL substrings, tag rules |

Beat editor files:

| Beat | File |
|---|---|
| `quantum` | `docs/beat-editors/quantum-zen-rocket.md` |
| `bitcoin-macro` | `docs/beat-editors/bitcoin-macro-ivory-coda.md` |
| `aibtc-network` | `docs/beat-editors/aibtc-network-skill.md` |

**Hard rule: read all five. Never skip. Never reuse a cached read from a prior session.**

#### 3.3 — Extract Blocked Shapes (ALWAYS fresh, NEVER cached)

From `docs/homepage-brief-snapshots.md`:

1. Find every brief entry for the target beat from the last 48 hours
2. For every headline, extract the **structure not the numbers** — `[N] Blocks Left Before [%] Retarget` is the same structure whether N is 1,094 or 1,372
3. Find every "Duplicates removed" note at the bottom of each brief — extract every structure listed there too
4. Write every extracted structure into the `Blocked shapes` column of `docs/target-beat-rules.md`

**Hard rule: the `Blocked shapes` column must always be re-extracted fresh from `docs/homepage-brief-snapshots.md` on the current day. Even if a row already exists for today's date and beat, re-extract blocked shapes. Never carry over yesterday's list.**

A shape is blocked if it appears anywhere in the last 48h brief for the target beat — regardless of whether the numbers are different.

#### 3.4 — Extract Helper Failure Patterns

From `docs/helper-bugs.md`, for each bug entry read the verbatim error, what caused it, and the fix. Then record:
- Every accepted headline anchor pattern (exact list from the file)
- Every accepted source URL substring (exact list from the file)
- Tag format rules

These feed directly into Step 5.4b. Reading them here means Step 5.4b is a confirmation check, not a discovery step.

#### 3.5 — File Into `docs/target-beat-rules.md`

| Date | Beat | What scores 90+ | Required checklist | Instant rejection triggers | Blocked shapes (fresh, today) | Helper failure patterns | Candidate fit | What must change before drafting |
|---|---|---|---|---|---|---|---|---|

Rules:
- One row per date + beat combination
- `Blocked shapes`: always re-extracted today, never copied from a prior row
- `Helper failure patterns`: accepted anchor patterns + accepted source substrings from `helper-bugs.md`
- `Candidate fit`: `n/a` if no candidate yet, otherwise `yes`, `partial`, or `no`

#### 3.6 — Gate Before Step 4

Confirm all four before proceeding:

- [ ] All five docs read in full
- [ ] Blocked shapes extracted fresh from today's `homepage-brief-snapshots.md`
- [ ] Helper failure patterns recorded
- [ ] `docs/target-beat-rules.md` updated

**Do not proceed to Step 4 until all four are confirmed.**

---

### Step 4 — Build Verified Source List (Required Before Step 5)

**Goal:** Produce a verified, ordered list of Tier 1 sources for Step 5.2 to pick from. Step 5.2 selects from this list only — it does not search independently.

#### 4.1 — Pull Tier 1 Source List From Beat Editor

From the beat editor file read in Step 3.2, extract every Tier 1 source URL and what it proves.

#### 4.2 — Remove Already-Used Sources

From `docs/homepage-brief-snapshots.md` (read in Step 3.2), identify every source URL and numeric anchor already used in today's brief for the target beat.

Mark each Tier 1 source as:
- `available` — source + numeric anchor not used in today's brief
- `blocked` — same source + same numeric claim already in today's brief

Remove all `blocked` sources.

**If today's brief is not yet populated, treat all sources as `available` and note this.**

#### 4.3 — Verify Against Helper Whitelist

From `docs/helper-bugs.md` (read in Step 3.2), confirm every remaining source URL contains at least one accepted substring:

`/api/` · `github.com` · `explorer.` · `releases/tag/` · `issues/<n>` · `pull/<n>` · `bip-<n>` · `docs.` · `arxiv.org/abs/` · `eprint.iacr.org/` · `csrc.nist.gov/` · `gnusha.org` · `delvingbitcoin.org`

Remove any source that does not contain an accepted substring.

**Hard rule: a source that fails the helper whitelist cannot enter the JSON.**

#### 4.4 — Check Each Source Against Blocked Shapes

From the blocked shapes list extracted in Step 3.3 (stored in `docs/target-beat-rules.md`), check whether each remaining source can only prove claims that map to a blocked shape.

A source is `available` if it can prove at least one claim in a non-blocked shape.
A source is `shape-blocked` if every claim it proves maps to a blocked structure.

Remove all `shape-blocked` sources.

#### 4.5 — Output Verified Source List


[URL] — proves [metric] — status: available — anchor: [exact value]
[URL] — proves [metric] — status: available — anchor: [exact value]


**This list is the only input Step 5.2 is allowed to use.**

For metric-heavy claims:
- do not rely on one organization alone if the claim combines multiple figures, comparisons, or market-wide implications
- require at least two independent organizations or source systems unless one canonical primary source alone fully proves the exact claim
- if one source gives the headline metric and a second source is needed for comparison, baseline, or consequence, both must be in the verified list before Step 5 begins

**Hard rule: if this list is empty → do not proceed to Step 5. Report that no signal can be filed today for this beat.**

#### 4.6 — Update `docs/sources.md`

Add any new source patterns found in today's winning briefs not already in `docs/sources.md`.

---

### Step 5 — Create Signal (Deterministic)

**Goal:** Produce the number of valid, non-duplicate JSON signals requested by the operator, using only pre-verified inputs from Steps 3 and 4. Default to a batch of at least `4` unless the operator explicitly asks for fewer. Stage each finished candidate in `docs/draft-signals.md` before final JSON output.

`docs/draft-signals.md` is the staging file for finished Step 5 candidates that are ready for Step 5.7 testing. Despite the filename, do not use it for rough notes, partials, or speculative drafts. Only place finished JSON there once the signal is fully constructed and ready for helper testing.

Status language is strict:

- `locally validated` = repo-side checks pass, such as helper normalization and local signal guard
- `browser-helper confirmed` = the exact JSON has also been checked in `file-signal.html` with no pre-login blocker before `Sign Request`
- `ready to submit` = only use this phrase after `browser-helper confirmed`

Hard rule: do not treat `docs/draft-signals.md` placement alone as proof that a signal is ready to submit.

#### 5.1 — Confirm Inputs (do not re-read docs)

Confirm these are available from Steps 3 and 4:

- [ ] Blocked shapes list from Step 3.3 (in `docs/target-beat-rules.md`)
- [ ] Helper failure patterns from Step 3.4
- [ ] Verified source list from Step 4.5

**If any are missing → return to the missing step. Do not re-read docs here. Do not proceed.**

Before selecting any anchor, answer these with `yes` or `no`:
- Does this candidate repeat a blocked story shape from today or the last 48h brief window?
- Is this just the same story with fresher numbers?
- Does this reuse the same metric family, comparison frame, or operator implication as a prior posted brief winner?
- Does this reuse the same source family + metric family + implication family as a previously rejected recent filing?

If any answer is `yes` → stop, reject the candidate locally, and pick a different claim family before writing JSON.

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

From `docs/helper-bugs.md` (read in Step 3.2 — do not re-read):

For every bug entry: read the verbatim error, what caused it, and the fix. Apply the fix to the current JSON.

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

**The goal is not to run a checklist — it is to confirm no known failure mode is present in the payload.**

**If `docs/helper-bugs.md` has been updated since Step 3.2, re-read it now. New entries mean new failure modes.**

#### 5.5 — Pre-Validation

All must be true before output:

- [ ] Headline contains accepted anchor
- [ ] `body` == `analysis` character-for-character
- [ ] `CLAIM:` `EVIDENCE:` `IMPLICATION:` present and non-empty
- [ ] At least 1 Tier 1 source matches anchor
- [ ] Metric-heavy claims have enough independent source support or a single canonical source that fully proves the exact claim
- [ ] Not duplicate by anchor + claim
- [ ] Headline structure not in Step 3.3 blocked list
- [ ] Body is below 900 chars and kept in the safer 800-900 range when possible
- [ ] All tags lowercase slugs, beat_slug first


### Step 5.6 — Final Output (STRICT)

Build the full batch requested by the operator, with a default minimum of 4 JSON objects unless the operator explicitly requests fewer.

**Output requirement:**
Write each completed JSON candidate into `docs/draft-signals.md` before Step 5.7 testing.

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

** Hard rule **

Do not output anything until a valid batch is found.
Return only the final number of JSON objects required for the batch.

### Step 5.7 — Test With Helper Process Before Final Output

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

**Pass condition:**
- helper normalization passes
- local signal guard passes
- no pre-login helper rejection remains
- exact browser helper checks in `file-signal.html` pass for the same JSON

**Reporting rule:**
- If all repo-side checks pass but the browser helper page was not actually used, report `locally validated only`.
- If the browser helper page was used and no pre-login blocker remains, report `browser-helper confirmed`.
- Only after `browser-helper confirmed` may the agent say `ready to submit`.

**Not required:**
- wallet login
- final signed submission

**Hard rule:**
- Do not return final JSON output until every JSON in the batch passes Step 5.7.

