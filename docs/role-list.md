# Role List

## Document Role

- Category: `canonical`
- Scope: every micro-role and activity in the daily loop from brief to brief-inclusion
- Source: `docs/workflow.md`, `docs/architecture.md`, `src/loop/*`, `skills/create-signal/SKILL.md`, `skills/record-signal-outcome/SKILL.md`, `skills/analyze-signal-outcomes/SKILL.md`, `skills/aibtc-news-publisher/SKILL.md`
- Do not use: `docs/company-operating-model.md` — that doc describes the 5-role company shape, not the micro-step loop

---

## Complete Loop: Steps to Submit a Signal That Makes the Brief

Every step must be done in order. Do not skip. Do not jump ahead.

1. **Brief Reader** — Read today's brief; save it; extract which beats are occupied, which agents won, what headline shapes appeared, and what anchor types were used (PR number, version, block height, metric)

2. **Signal Status Checker** — Check every recent signal against the live feed; assign each a status of `pending`, `approved`, `rejected`, or `brief_included`; flag every unresolved helper error from the prior cycle

3. **Outcome Updater** — Compare winners against losers from the prior cycle; from each beat editor file (`docs/beat-editors/aibtc-network-skill.md`, `docs/beat-editors/bitcoin-macro-ivory-coda.md`, `docs/beat-editors/quantum-zen-rocket.md`) extract the reject conditions and what qualifies for approval on that beat; write the daily report

4. **Outcome Analyst** — Read the full outcome history and separate what is winning from what is failing; compare brief_included signals against rejected and approved-not-in-brief signals to name the specific structural difference; produce today's drafting rules stating: which patterns to stop, which to keep, which beats are winnable today and why the others are not

5. **Beat Saturation Check** — Check each beat against the live feed; produce a verdict of open, warning, or blocked for each; stop if all target beats are blocked

6. **Beat Analysis** — From the publisher skill file, extract the four pass conditions and the rejection conditions; from the beat editor file for the chosen beat, extract the scope rules, the triage priority levels, and the conditions that qualify a signal for approval versus rejection on that beat

7. **Source Discovery** — Find one exact identifier: a PR number, CVE identifier, version number, block height, or named metric with a traceable source; check it is not in today's brief and has not been submitted in a recent signal; if no exact identifier exists, return hold

8. **Create Signal** — Read editorial memory and apply every pre-filing rule it contains; check the story is not in today's brief and has not been recently submitted; draft the signal with the required five parts: `CLAIM`, `EVIDENCE`, `IMPLICATION`, `Directive`, `Sources`; run every validation check; return one verdict: `filing_ready`, `repair_and_resubmit`, or `hold`

9. **Signal Filer** — Confirm the filing window is open and cooldown is clear; present the exact payload to the operator for one signature; wait for the signal ID to confirm it landed

10. **Helper Maintainer** — If the helper failed, classify the failure as content problem, workflow problem, helper bug, or server bug; fix the root cause; ensure the same failure is caught earlier next time

11. **Record Signal Outcome** — Operator confirms the result as `pending`, `approved`, `rejected`, or `brief_included`; record the outcome; apply the outcome logic from the skill to write one specific lesson stating exactly what worked or what failed and what the concrete repair is

12. **Outcome Learner** — Take each recorded lesson and convert it into a named rule; store it in editorial memory; confirm which rules now meet the repeat threshold and become hard pre-filing checks that block the next cycle if violated

---

## 1. Brief Reader

Sub-step of Phase 1. Operator pastes the brief. Saves it and extracts what won, which beats are occupied, and which agents are winning.

**Before you start:**
- Operator must have pasted today's brief or confirmed it is available at `https://aibtc.news/api/signals?status=brief_included`

**Reads:**
- Today's brief (operator-pasted)
- Prior briefs in `data/briefs/` (.md files)
- `https://aibtc.news/api/signals?status=brief_included` — fallback if nothing pasted

**Steps:**
1. Save the full brief text to `data/briefs/YYYY-MM-DD.md` — do not summarise, keep the full text
2. From the brief, extract and note: which beats are occupied today, which agents appear, what headline structures won, what anchor types were used (PR number, version, block height, metric)
3. Record today's occupied beats explicitly — these are no-go zones for Signal Creation unless displacement framing is used

**Done when:**
- `data/briefs/YYYY-MM-DD.md` exists with the full brief text
- Today's occupied beats are listed and ready to hand to Role 3

**If you skip this:** Role 3 cannot update outcome state. Role 8 will draft against an unknown brief and risk filing a duplicate.

---

## 2. Signal Status Checker

Sub-step of Phase 1. Checks every previously submitted signal and gives a confirmed status before anything else starts.

**Before you start:**
- `data/state/signal-history.json` must be readable

**Reads:**
- `data/state/signal-history.json` — canonical filed-signal ledger
- `data/state/helper-errors.jsonl` — any unresolved filing tool failures
- `https://aibtc.news/api/signals` — live status per signal

**Steps:**
1. Read every signal filed in the past 7 days from `data/state/signal-history.json`
2. For each signal, confirm its current status against the live API: `brief_included`, `approved`, `rejected`, `pending`, or `unknown`
3. Check `data/state/helper-errors.jsonl` — flag any errors that are unclassified or unresolved
4. Write confirmed status updates back to `data/state/signal-history.json`

**Done when:**
- Every signal from the past 7 days has a confirmed status in `data/state/signal-history.json` — no entry left as `unknown` unless genuinely unresolvable
- All unresolved entries in `data/state/helper-errors.jsonl` are flagged for Role 10

**If you skip this:** Role 3 is working with stale outcome data. Role 8 may re-draft a story already filed or already in brief.

---

## 3. Outcome Updater

Phase 1 core role. Reads what happened in the last cycle, labels resolved outcomes, writes the daily report.

**Before you start:**
- Role 1 must be done: `data/briefs/YYYY-MM-DD.md` must exist
- Role 2 must be done: `data/state/signal-history.json` must have confirmed statuses

**Reads:**
- `data/state/signal-history.json`
- `data/state/helper-errors.jsonl`
- `data/briefs/YYYY-MM-DD.md`
- `docs/beat-editors/aibtc-network-skill.md` — beat: `aibtc-network`
- `docs/beat-editors/bitcoin-macro-ivory-coda.md` — beat: `bitcoin-macro`
- `docs/beat-editors/quantum-zen-rocket.md` — beat: `quantum`
- `memory/learnings.md`
- `docs/document-map.md`
- `docs/workflow.md`

**Steps:**
1. Go through every signal from `data/state/signal-history.json` and label its outcome: `brief_included`, `approved_not_in_brief`, `rejected`, `pending`
2. Check `data/state/helper-errors.jsonl` and record any unresolved tool failures — do not ignore them
3. Read all three beat editor files and note any updated editorial guidance that affects today
4. Write `data/reports/daily/YYYY-MM-DD.md` — must include: outcome board, helper error log, open beats, occupied beats, signal-generation handoff section
5. Update `data/state/editorial-memory.json` and `data/state/outcome-feedback-memory.json` with confirmed outcome data

**Done when:**
- `data/reports/daily/YYYY-MM-DD.md` exists and contains all required sections
- `data/state/editorial-memory.json` has a `lastUpdated` timestamp matching today's date

**If you skip this:** Role 4 has no outcome board to analyse. Role 8 will draft without knowing what is already in today's brief or what recently failed.

---

## 4. Outcome Analyst

Phase 2 opening step. Uses `analyze-signal-outcomes` skill. Reads outcomes and turns them into today's specific drafting rules.

**Skill:** `skills/analyze-signal-outcomes/SKILL.md`

**Before you start:**
- Role 3 must be done: `data/reports/daily/YYYY-MM-DD.md` must exist and be dated today
- `data/state/editorial-memory.json` must have been updated today

**Reads:**
- `data/reports/daily/YYYY-MM-DD.md` — today's outcome board from Role 3
- `data/state/signal-history.json`
- `data/state/editorial-memory.json`
- `data/state/outcome-feedback-memory.json`
- `data/briefs/YYYY-MM-DD.md` — latest dated brief
- `data/training/in-brief.jsonl`
- `data/training/rejected.jsonl`
- `data/training/approved-not-in-brief.jsonl`
- `data/outcomes/approvals/*.json`
- `docs/document-map.md`
- `docs/workflow.md`
- `docs/build-plan.md`

**Steps:**
1. Read the last 7 days of rejection patterns — what tags, beat types, or body structures keep failing
2. Read what is winning — what beat, headline shape, and anchor type made recent briefs
3. Read approved-not-in-brief signals — why did those lose the slot after passing approval
4. Write new `- win:` / `- loss:` / `- next:` entries to `memory/learnings.md`
5. Run `npm run daily-learn` — confirm it succeeds and reports what was promoted to `preFilingChecks`
6. Write today's drafting rules to `logs/analyst-memo-YYYY-MM-DD.json`

**Done when:**
- `logs/analyst-memo-YYYY-MM-DD.json` exists and contains: patterns to stop, patterns to keep, target beats, beats to avoid, what the next signal must include
- `npm run daily-learn` ran successfully today
- `data/state/editorial-memory.json` `preFilingChecks` reflects today's promoted patterns

**If you skip this:** Role 8 drafts without a current rule set. Rejected patterns repeat.

---

## 5. Beat Saturation Check

Checks every active beat against the live API before any drafting begins. If a beat is full or blocked, work stops before time is wasted.

**Before you start:**
- Role 4 must be done: `logs/analyst-memo-YYYY-MM-DD.json` must exist

**Reads:**
- `https://aibtc.news/api/signals?beat=aibtc-network&status=approved`
- `https://aibtc.news/api/signals?beat=bitcoin-macro&status=approved`
- `https://aibtc.news/api/signals?beat=quantum&status=approved`

**Steps:**
1. Check live slot count for each beat
2. Produce a verdict for each: `open`, `warning`, or `blocked`
3. If all target beats from the analyst memo are `blocked`, stop and return the verdict to the operator — do not proceed to drafting

**Done when:**
- A named verdict exists for each of the three beats
- If any target beat is `blocked`, operator has been informed and drafting has not started

**Code:** `src/scoring/beat-saturation.ts`

---

## 6. Beat Analysis

Reads the publisher's 4-question approval test and the specific beat editor file for the chosen beat. Produces a written beat brief before any drafting begins.

**Before you start:**
- Role 5 must be done: at least one beat must be `open` or `warning`
- You must have chosen a specific target beat from `logs/analyst-memo-YYYY-MM-DD.json`

**Reads:**
- `skills/aibtc-news-publisher/SKILL.md` — 4-question approval test and rejection patterns
- `docs/beat-editors/aibtc-network-skill.md` — if beat is `aibtc-network`
- `docs/beat-editors/bitcoin-macro-ivory-coda.md` — if beat is `bitcoin-macro`
- `docs/beat-editors/quantum-zen-rocket.md` — if beat is `quantum`
- `docs/beat-strategy.md`
- `data/state/signal-history.json`
- `data/training/rejected.jsonl`
- `data/training/in-brief.jsonl`

**Steps:**
1. Read the publisher's 4-question test from `skills/aibtc-news-publisher/SKILL.md` — state what each question requires for the chosen beat specifically
2. Read the specific beat editor file for the chosen beat — state the beat scope, triage priority, and review checklist
3. From `data/training/in-brief.jsonl` and `data/training/rejected.jsonl`, identify what has won and what has been rejected on this beat specifically
4. Write a beat brief to `logs/beat-analysis-YYYY-MM-DD.json`

**Done when:**
- `logs/beat-analysis-YYYY-MM-DD.json` exists and contains: chosen beat, publisher Q1-Q4 criteria for this beat, what a winning signal looks like today, what would be rejected today

**If you skip this:** Role 8 drafts without beat-specific publisher rules. Signals pass local checks but fail publisher review.

---

## 7. Source Discovery

Finds one specific verifiable story anchor for the chosen beat. No anchor means no signal. Returns hold to the operator if nothing verifiable is found.

**Before you start:**
- Role 6 must be done: `logs/beat-analysis-YYYY-MM-DD.json` must exist for the chosen beat

**Reads:**
- Live sources: GitHub releases, PRs, CVE databases, on-chain APIs, block explorers
- `data/state/editorial-memory.json` — avoids anchors already rejected or used in recent signals
- `data/state/signal-history.json` — avoids anchors already filed

**Steps:**
1. Search live sources for a specific verifiable anchor: PR number, CVE identifier, version number, block height, exact transaction, or named measurable change
2. Confirm the anchor is independently verifiable — it must resolve at the linked source
3. Confirm the anchor is not already covered in `data/state/signal-history.json` or today's brief
4. If no anchor found: return a `hold` verdict to operator with the reason — do not proceed to drafting

**Done when:**
- One specific anchor is confirmed and documented, OR
- A `hold` verdict has been returned to the operator with the reason stated

**Code:** `src/sources/*`, `src/loop/fetch-and-run.ts`, `src/prep/candidate-generator.ts`

---

## 8. Create Signal

Uses `create-signal` skill. Reads all prior role outputs and drafts one signal. Runs every gate. Returns one verdict.

**Skill:** `skills/create-signal/SKILL.md`

**Before you start — hard gates, all must be true:**
- `data/briefs/YYYY-MM-DD.md` exists and is dated today — if missing, stop, return to Role 1
- `data/reports/daily/YYYY-MM-DD.md` exists and is dated today — if missing, stop, return to Role 3
- `logs/analyst-memo-YYYY-MM-DD.json` exists and is dated today — if missing, stop, return to Role 4
- `logs/beat-analysis-YYYY-MM-DD.json` exists for the chosen beat — if missing, stop, return to Role 6
- `data/state/helper-errors.jsonl` has been reviewed this cycle and no unresolved errors remain — if unresolved errors exist, stop, route to Role 10 first
- `data/state/editorial-memory.json` has a `lastUpdated` timestamp from today — if stale, stop, return to Role 4 to run `npm run daily-learn`

**Reads:**
- `logs/analyst-memo-YYYY-MM-DD.json` — read this first, it is today's instruction set
- `logs/beat-analysis-YYYY-MM-DD.json` — read this second, it is the beat-specific rule set
- `data/briefs/YYYY-MM-DD.md` — read this third, confirms what is already in brief today
- `data/state/editorial-memory.json` — every item in `preFilingChecks` is a hard gate
- `data/state/signal-history.json`
- `data/training/in-brief.jsonl`
- `data/training/rejected.jsonl`
- `data/training/approved-not-in-brief.jsonl`
- `docs/beat-editors/aibtc-network-skill.md` — beat: `aibtc-network`
- `docs/beat-editors/bitcoin-macro-ivory-coda.md` — beat: `bitcoin-macro`
- `docs/beat-editors/quantum-zen-rocket.md` — beat: `quantum`
- `docs/beat-strategy.md`
- `docs/in-brief-success-checklist.md`
- `docs/document-map.md`
- `docs/workflow.md`
- `docs/build-plan.md`
- `data/state/repairable-candidates.json`

**Steps:**
1. Confirm all hard gates above are satisfied before writing a single word of the signal
2. Read `logs/analyst-memo-YYYY-MM-DD.json` — apply every stop pattern and must-have rule
3. Read `logs/beat-analysis-YYYY-MM-DD.json` — apply beat-specific publisher rules
4. Read `data/briefs/YYYY-MM-DD.md` — confirm the story is not already in today's brief
5. Read the specific beat editor file for the chosen beat — apply the triage and review checklist
6. Read every item in `data/state/editorial-memory.json` `preFilingChecks` — fail any candidate that violates them
7. Draft using the canonical template: `CLAIM`, `EVIDENCE`, `IMPLICATION`, `Directive`
8. Run every factual integrity gate: source verification, quantitative consistency, temporal coherence, structural red flags
9. Check body length — target 800-900 characters, hard max 1000, shorten `Directive:` first when trimming
10. Return one verdict: `filing_ready`, `repair_and_resubmit`, or `hold`

**Done when:**
- `data/reports/signals/YYYY-MM-DD.md` exists with the drafted signal
- A named verdict has been returned: `filing_ready`, `repair_and_resubmit`, or `hold`
- Helper-ready JSON payload is produced if verdict is `filing_ready`

**Code:** `src/prep/create-signal.ts`, `src/filing/validate-artifact.ts`, `src/filing/template-rules.ts`, `src/types/filing-gate.ts`

---

## 9. Signal Filer

Takes the approved helper-ready JSON, confirms the filing window is open, submits. Operator signs once.

**Before you start:**
- Role 8 must be done and verdict must be `filing_ready`
- `data/reports/signals/YYYY-MM-DD.md` must exist

**Reads:**
- `data/filing-ready/YYYY-MM-DD/*.json`
- `AGENTS.md`
- `docs/signal-sourcing-checklist.md`
- Live: `news_check_status` — confirms cooldown is clear and `canFileSignal` is true

**Steps:**
1. Run `news_check_status` — if `canFileSignal` is false, stop, record the blocked status and next eligible time, do not retry
2. Verify the normalized payload is correct before presenting it
3. Present the payload to the operator for one signature
4. After signature, wait for the signal ID — if no ID arrives, run a verification check before retrying
5. Record the result

**Done when:**
- `data/state/signal-history.json` has a new entry for the filed signal with a real signal ID
- If filing was blocked, the blocked status and next eligible time are recorded

**Code:** `src/filing/approve.ts`, `src/filing/helper-server.ts`

---

## 10. Helper Maintainer

Support only. Activates when Signal Filer reports a failure or when Role 2 flags unresolved entries in `data/state/helper-errors.jsonl`. Classifies the failure and fixes the tool if it is a real bug.

**Before you start:**
- Signal Filer must have reported a failure, OR Role 2 must have flagged unresolved entries in `data/state/helper-errors.jsonl`

**Reads:**
- `data/state/helper-errors.jsonl`
- Filing failure description from Role 9

**Steps:**
1. Classify the failure: content problem, workflow problem, helper bug, or server bug
2. For content or workflow problems: do not touch the helper code — write a note so it appears in the next Role 3 cycle
3. For helper or server bugs: fix the issue, then add a guardrail so the same failure surfaces earlier next time
4. Append the resolution to `data/state/helper-errors.jsonl`

**Done when:**
- Every entry in `data/state/helper-errors.jsonl` from this cycle has a classification and resolution note
- Role 2 can confirm on the next cycle that no entries remain unresolved

---

## 11. Record Signal Outcome

Uses `record-signal-outcome` skill. Operator returns the confirmation. Agent records the result and closes the feedback loop.

**Skill:** `skills/record-signal-outcome/SKILL.md`

**Before you start:**
- Role 9 must be done and a real signal ID must exist
- Operator must have confirmed the outcome: `brief_included`, `approved`, `rejected`, or `pending`

**Reads:**
- Confirmation from operator (signal ID, outcome, publisher feedback verbatim)
- `data/state/signal-history.json`
- `data/state/editorial-memory.json`
- `data/outcomes/approvals/` — existing files for pattern context
- `docs/document-map.md`
- `docs/workflow.md`
- `docs/build-plan.md`

**Steps:**
1. Update `data/state/signal-history.json` — set outcome, `resolvedAt`, `satsEarned` if known, publisher feedback in `note`
2. Write `data/outcomes/approvals/{signalId}.json` using the exact schema from the skill
3. Append to `memory/learnings.md` — one `- win:` or `- loss:` + `- next:` entry, specific enough for the parser to match it
4. Run `npm run daily-learn` — confirm it succeeds and report what changed in `preFilingChecks`

**Done when:**
- `data/state/signal-history.json` entry has a confirmed outcome and `resolvedAt` timestamp
- `data/outcomes/approvals/{signalId}.json` exists
- `memory/learnings.md` has a new entry for this outcome
- `npm run daily-learn` ran successfully and its output has been reported

**Code:** `src/filing/signal-history.ts`, `src/learning/outcome-feedback.ts`

---

## 12. Outcome Learner

Takes the recorded result, runs the learning pipeline, promotes repeated patterns into hard pre-filing checks, and prepares state for the next cycle.

**Before you start:**
- Role 11 must be done: outcome recorded, `daily-learn` already run in Role 11

**Reads:**
- `data/state/signal-history.json`
- `data/state/editorial-memory.json`
- `data/state/outcome-feedback-memory.json`
- `memory/learnings.md`
- `data/outcomes/approvals/*.json`

**Steps:**
1. Read the full `data/state/editorial-memory.json` `preFilingChecks` array — note what was promoted this cycle
2. Confirm any pattern with `triggerCount >= 2` is now a hard block in the creation path
3. Confirm `data/state/outcome-feedback-memory.json` reflects the latest failure label counts
4. Report to the operator: what new checks were promoted, what the next cycle should do differently

**Done when:**
- `data/state/editorial-memory.json` `preFilingChecks` is confirmed current
- `data/state/outcome-feedback-memory.json` is confirmed current
- A summary of what changed has been reported to the operator

**Code:** `src/outcomes/checker.ts`, `src/loop/optimization.ts`, `src/learning/context-memory.ts`, `src/learning/editorial-memory.ts`, `src/learning/outcome-feedback.ts`, `src/intelligence/strategy-memory.ts`
