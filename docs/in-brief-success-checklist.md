# In Brief Success Checklist

## Document Role

- Category: `living implementation`
- Scope: active success criteria and checked progress
- Use this when: you need to know the current goal state and which concrete work items are complete
- Do not use this as: the sole workflow contract for daily execution

## Purpose
This is the active build checklist for the current agent objective.

Use this file as the source of truth in future chats.
If a new chat starts, say: `go to checklist` and open this file first.

Mark a task complete only when the code, generated artifacts, and verification all exist.
If something is only partly done, leave it unchecked and write the exact current state so no one repeats work.

## Success Definition
This agent is meant to operate like a real autonomous news agent.
It should source, learn, optimize, and present signable recommendations with minimal daily intervention.

Success means:

- the filed stories actually make `In Brief` on `aibtc.news`
- the agent earns sats
- the agent reaches at least `3 In Brief` stories per day as the real operating floor

Target state:

- all approved-and-filed stories make `In Brief`
- at least `3 In Brief` stories land per day

Anything less is failure or partial progress, not success.

`In Brief` in this checklist means the story was actually published on the `aibtc.news` daily brief.
The operator will keep posting the live daily `In Brief`.
Saved brief-history currently covers March 23, 2026 through March 29, 2026.

## Resume Rule
When resuming work:

1. open this checklist
2. trust only checked items with file evidence listed here
3. read the `Current state` note for every unchecked item before changing code
4. update this file immediately after completing any item

## Project Boundary
This checklist is for `aibtcagent` only.

If the user is talking about:
- `aibtc.news`
- signals
- `In Brief`
- beats
- correspondents
- filing-ready artifacts
- wallet signing for AIBTC signals

then do not import context from:
- `Kizuna`
- `MkondoMe`
- `Synthesis`
- any other agent repo in the workspace

unless the user explicitly says to switch projects.

Startup rule for future chats:
1. open `memory.md`
2. open this checklist
3. confirm active repo is `aibtcagent`
4. ignore all other project memory unless the user explicitly switches repos

## Current Completed Work

- [x] Add an explicit success model to optimization memory
Evidence:
  `src/types/optimization-loop.ts`
  `src/loop/optimization.ts`
Current state:
  `DailyOptimizationSnapshot` now includes `successMetrics`.
  The optimizer now records `targetInBriefWins`, `inBriefWins`, `satsEarned`, `btcRewards`, and `targetMet`.

- [x] Make optimization recommendations say that approval count is not the goal
Evidence:
  `src/loop/optimization.ts`
Current state:
  Next-day recommendations now explicitly say to optimize for brief-slot wins and payout, not approval count, when the target is missed.

- [x] Push the success scoreboard into pre-submission memory
Evidence:
  `src/sources/live-pre-submission.ts`
Current state:
  Pre-submission notes now include the current `In Brief` and sats scoreboard plus the success definition.

- [x] Strengthen ranking toward winner-style packaging
Evidence:
  `src/scoring/candidate-queue.ts`
Current state:
  The scorer now rewards broader same-beat packaging, operator consequence, exact anchors, structural patterns, and winner-matching source domains more strongly.
  The scorer also penalizes narrow stories more heavily when repeat winners already own the beat.

## Active Build Phases

### Phase 0: Anti-Drift Startup Guard
Goal:
  Prevent cross-project memory contamination before any work starts.
- [x] Enforce `aibtcagent`-only startup preflight in runtime docs and operator workflow
Current state:
  Completed in:
  `README.md`
  `src/ops/operator-summary.ts`
  `src/agent/run-daily.ts`
  `tests/operator-summary.test.js`
  The main runbook now makes `aibtcagent` repo confirmation an explicit startup preflight before any runtime command.
  The operator workflow and `agent-daily` console output now repeat that boundary so future sessions start from repo state instead of cross-project memory.

### Phase 1: KPI Gate
Goal:
  Make `In Brief` conversion and sats the top KPI everywhere.
- [x] Make daily reporting use `In Brief wins + sats` as the top KPI
Current state:
  Completed in:
  `src/reporting/daily-report.ts`
  `src/types/daily-report.ts`
  `src/ops/operator-summary.ts`
  Daily reports now render a `Top KPI` section with success definition, `In Brief` wins, target, sats earned, and target-met status.
  Daily reports also include `approved but not in brief`, `same-day resolved In Brief rate`, and failure notes.
  Operator summaries now show day-over-day movement in `In Brief` wins.
Needed files:
  `src/reporting/daily-report.ts`
  `src/ops/daily-stability.ts`
  `data/reports/daily/*.json`

- [x] Make `approved_not_in_brief` report as non-success everywhere
Current state:
  Completed in:
  `src/reporting/daily-report.ts`
  `src/outcomes/checker.ts`
  `src/types/memory-records.ts`
  `src/filing/candidate-history.ts`
  `src/ops/operator-summary.ts`
  Daily reporting now treats `approved but not in brief` as a failed outcome and surfaces failure notes.
  Outcome records now persist `success` and `failureMode`.
  Candidate history now persists `success` and `failureMode`.
  Outcome checker now labels `approved but not published in In Brief` as a failed outcome for the real KPI.
Needed files:
  `src/reporting/daily-report.ts`
  `src/ops/index.ts`
  `src/outcomes/checker.ts`

### Phase 2: Candidate Metadata
Goal:
  Persist enough metadata on every candidate so the agent can learn by style, competitor pressure, and gating failures.
- [x] Persist `style_tested` on every candidate
Current state:
  Completed in:
  `src/types/submission-package.ts`
  `src/newsroom/serialize.ts`
  `src/scoring/candidate-queue.ts`
  `src/filing/queue.ts`
  `src/filing/candidate-history.ts`
  `style_tested` now persists in serialized dry-run submissions as `candidate_metadata.style_tested`, then carries through ranked candidates, filing queue items, and candidate history.
Needed files:
  `src/scoring/candidate-queue.ts`
  dry-run submission artifact writers
  candidate history storage

- [x] Persist `competitor_reference` on every candidate
Current state:
  Completed in the same files as `style_tested`.
  `competitor_reference` now persists in serialized submissions, ranked candidates, filing queue items, and candidate history.
Needed files:
  `src/scoring/candidate-queue.ts`
  candidate history storage

- [x] Persist `why_this_style_was_chosen` on every candidate
Current state:
  Completed in the same files as `style_tested`.
  `why_this_style_was_chosen` now persists in serialized submissions, ranked candidates, filing queue items, and candidate history.
Needed files:
  `src/scoring/candidate-queue.ts`
  candidate history storage

- [x] Persist `duplicate_status` on every candidate
Current state:
  Completed in the same files as `style_tested`.
  `duplicate_status` now persists in serialized submissions, ranked candidates, filing queue items, and candidate history.
Needed files:
  dry-run submission artifact writers
  candidate history storage

- [x] Persist `freshness_status` on every candidate
Current state:
  Completed in the same files as `style_tested`.
  `freshness_status` now persists in serialized submissions, ranked candidates, filing queue items, and candidate history.
  When the source pipeline does not provide a concrete freshness signal, this field currently persists as `unknown` rather than guessing.
Needed files:
  dry-run submission artifact writers
  candidate history storage

### Phase 3: Competitor Style Memory
Goal:
  Build top-competitor style tracking and per-style performance learning.
- [x] Build `top_5_competitor_styles.json`
Current state:
  Completed in:
  `src/brief/manual-brief-ingest.ts`
  `src/agent/run-daily.ts`
  `tests/manual-brief-ingest.test.js`
  Manual brief ingest now writes `data/state/top_5_competitor_styles.json`.
  The artifact records the top 5 competitors by observed wins with inferred style labels, beats, same-day multi-win counts, source-domain patterns, and style reasons.
Needed files:
  `src/brief/manual-brief-ingest.ts`
  new artifact in `data/state/`

- [x] Track per-style approval rate
Current state:
  Completed in:
  `src/types/optimization-loop.ts`
  `src/loop/optimization.ts`
  `tests/optimization.test.js`
  `DailyOptimizationSnapshot` now includes `stylePerformance`.
  Each style now records `submissions`, `resolvedSubmissions`, `approvals`, and `approvalRate`.
Needed files:
  optimization loop
  new style-performance artifact

- [x] Track per-style `brief_included` rate
Current state:
  Completed in the same files as per-style approval rate.
  Each style now records `inBriefWins` and `briefIncludedRate`, using resolved submissions as the denominator.
Needed files:
  optimization loop
  new style-performance artifact

- [x] Track per-style sats earned
Current state:
  Completed in the same files as per-style approval rate.
  The optimizer now aggregates reward outcomes by `style_tested`, and `saveDailyOptimizationSnapshot` now writes `data/state/style-performance.json`.
Needed files:
  optimization loop
  reward aggregation by style

- [x] Automatically promote styles that convert to `In Brief`
Current state:
  Completed in:
  `src/loop/optimization.ts`
  `src/scoring/candidate-queue.ts`
  `tests/optimization.test.js`
  `tests/scoring.test.js`
  Style memory now marks named styles as `promote` when they convert into `In Brief`, surfaces that in next-day recommendations, and boosts those styles in ranking.
Needed files:
  optimization loop
  scoring config

- [x] Automatically demote styles that only get approved or keep losing
Current state:
  Completed in the same files as style promotion.
  Styles that get approved without making `In Brief`, or that keep missing approval, now get marked `demote`, surfaced in recommendations, and penalized during ranking.
Needed files:
  optimization loop
  scoring config

### Phase 4: Queue Gates
Goal:
  Hard-block unresolved duplicate and freshness risk from signable queue output.
- [x] Hard-block unresolved duplicates from the sign queue
Current state:
  Completed in:
  `src/filing/queue.ts`
  `src/filing/approve.ts`
  `tests/filing-queue.test.js`
  The filing queue now excludes candidates with `duplicateStatus` of `pending` or `flagged` from `awaiting_human_approval`, moves them to `on_hold`, and appends an explicit hard-block reason.
  Human approval now also refuses any candidate that is not already signable in the queue.
Needed files:
  `src/scoring/candidate-queue.ts`
  `src/filing/queue.ts`

- [x] Hard-block unresolved freshness risk from the sign queue
Current state:
  Completed in the same files as unresolved duplicate hard-blocks.
  Candidates with `freshnessStatus` of `risk_unresolved` can no longer surface as signable queue entries, and the queue now records the explicit freshness hard-block reason.
Needed files:
  `src/scoring/candidate-queue.ts`
  `src/filing/queue.ts`

### Phase 5: Runtime Behavior
Goal:
  Add runtime behaviors that help the agent autonomously reach at least 3 strong `In Brief` candidates per day.

- [x] Enforce the operator-signing boundary in the runtime flow
Current state:
  Completed in:
  `src/agent/run-daily.ts`
  `src/ops/operator-summary.ts`
  `src/ops/runtime-history.ts`
  `tools/xverse-register/README.md`
  `tests/operator-summary.test.js`
  `tests/runtime-history.test.js`
  `tests/runtime-behavior.test.js`
  Runtime now emits an explicit operator-boundary note before sourcing.
  Operator summaries now include a dedicated operator-boundary section and manual-signing instructions.
  Runtime history now records that wallet-required actions remain human-signed.
Needed files:
  `src/agent/run-daily.ts`
  operator summaries
  signing helpers in `tools/xverse-register/`

- [x] Mandatory second sourcing pass if fewer than 5 strong candidates survive hard gates
Current state:
  Completed in:
  `src/agent/run-daily.ts`
  `tests/runtime-behavior.test.js`
  `tests/runtime-history.test.js`
  Runtime now counts signable candidates after queue gates and automatically triggers a second sourcing pass when fewer than 5 survive.
  Runtime history records whether the second pass was triggered plus the initial and final strong-candidate counts.
Needed files:
  `src/loop/fetch-and-run.ts`
  `src/agent/run-daily.ts`

- [x] Soft beat quotas across the 5 recommendations
Current state:
  Completed in:
  `src/filing/queue.ts`
  `src/ops/operator-summary.ts`
  `tests/filing-queue.test.js`
  `tests/operator-summary.test.js`
  Filing queue recommendation ordering now prefers unique beats first, uses repeat beats only after diversity options are exhausted, and persists `recommendationSummary` with quota notes.
  Operator summaries now surface the recommendation count, beats represented, and quota notes.
Needed files:
  `src/scoring/candidate-queue.ts`
  `src/filing/queue.ts`
  operator summary output

- [x] Broader-package auto-promotion when narrow fragments keep losing
Current state:
  Completed in:
  `src/loop/optimization.ts`
  `src/scoring/candidate-queue.ts`
  `tests/optimization.test.js`
  `tests/scoring.test.js`
  Optimization now derives `packagingAdjustments` from approved-but-not-published learning text.
  Scoring now explicitly promotes `broad_same_beat_operator` candidates and demotes narrow same-beat fragments in crowded lanes when recent loss memory says broader packaging is needed.
Needed files:
  `src/scoring/candidate-queue.ts`
  `src/loop/optimization.ts`

### Phase 6: Daily Competitor Review
Goal:
  Produce a daily report on who won, what style won, what to copy tomorrow, and what to stop doing.
- [x] Create a daily competitor review artifact
Current state:
  Completed in:
  `src/ops/competitor-review.ts`
  `src/ops/index.ts`
  `src/agent/run-daily.ts`
  `src/ops/runtime-history.ts`
  `tests/competitor-review.test.js`
  `tests/runtime-history.test.js`
  Runtime now writes a dedicated competitor review artifact to `data/reports/competitor-review/`.
Needed files:
  new report generator
  `data/reports/competitor-review/`

- [x] Output `who won today`
Current state:
  Completed in:
  `src/ops/competitor-review.ts`
  `tests/competitor-review.test.js`
  The competitor review now persists `whoWonToday` with agent, appearance count, beats, and headlines from the daily brief winner snapshot.

- [x] Output `what style they used`
Current state:
  Completed in the same files as the competitor review artifact.
  The competitor review now persists `stylesUsed` by joining the top competitor style memory into explicit style labels and reasons.

- [x] Output `what to copy tomorrow`
Current state:
  Completed in the same files as the competitor review artifact.
  The competitor review now persists `copyTomorrow` using winner recaps, competitor-style memory, and optimization guidance.

- [x] Output `what to stop doing`
Current state:
  Completed in the same files as the competitor review artifact.
  The competitor review now persists `stopDoing` using repeat-winner pressure, demoted styles, packaging-loss memory, and recent top-candidate failure patterns.

### Phase 7: Failure Memo System
Goal:
  Create normalized failure memos for every non-brief outcome so the agent can learn from every loss.
- [x] Create a failure memo artifact for each miss
Current state:
  Completed in:
  `src/ops/failure-memos.ts`
  `src/ops/index.ts`
  `src/agent/run-daily.ts`
  `tests/failure-memos.test.js`
  Runtime now writes normalized failure memos to `data/reports/failure-memos/YYYY-MM-DD/`.
Needed files:
  new memo writer
  `data/reports/failure-memos/`

- [x] Store `duplicate` miss reason
- [x] Store `stale` miss reason
- [x] Store `too narrow` miss reason
- [x] Store `wrong beat` miss reason
- [x] Store `weak headline` miss reason
- [x] Store `weak packaging` miss reason
- [x] Store `approved but not published` miss reason
Current state:
  Completed in:
  `src/ops/failure-memos.ts`
  `tests/failure-memos.test.js`
  Failure memos now normalize and persist these miss categories as `categories` on each memo artifact using candidate history plus stored queue evidence.

### Phase 20: Outcome-Driven Scoring
Goal:
  Optimize for `In Brief` wins and sats, not just `approval-ready` cleanliness.
- [x] Make ranking and reporting treat `In Brief` conversion as the real north star
Current state:
  Verified in:
  `src/scoring/candidate-queue.ts`
  `src/loop/optimization.ts`
  `src/outcomes/checker.ts`
  `src/reporting/daily-report.ts`
  `tests/scoring.test.js`
  `tests/optimization.test.js`
  `tests/reporting.test.js`
  Ranking now boosts learned `In Brief`-winning styles, demotes styles that only get approved, and penalizes raw artifact framing that is unlikely to win a brief slot.
  Daily reporting and outcome labeling both treat `approved but not in brief` as a failed real-world result.

### Phase 21: Operator Flow Discipline
Goal:
  Never tell the operator to sign something unless it passed all gates and is truly signable.
- [x] Fail closed on missing operator signability preflight
- [x] Hard-block beats that are not confirmed publishable by the current operator
- [x] Re-check operator signability gates at approval time
Current state:
  Completed in:
  `src/filing/signability.ts`
  `src/filing/queue.ts`
  `src/filing/approve.ts`
  `src/agent/run-daily.ts`
  `src/ops/operator-summary.ts`
  `tests/filing-queue.test.js`
  `tests/operator-summary.test.js`
  The filing queue now fails closed when `data/state/operator-signability.json` is missing or does not confirm wallet/provider readiness, payload-integrity readiness, and beat permission for the current operator.
  Approval now re-checks those gates so a stale queue cannot sneak a non-signable candidate into `data/filing-ready/`.
  Runtime and operator guidance now point to the signability preflight before any approve-and-sign instruction.

### Phase 22: Regression Discipline
Goal:
  Every painful failure becomes a test or checklist rule so we stop repeating it.
- [x] Add regression tests for late-discovery signability failures
- [x] Add checklist coverage for operator signability preflight
- [x] Add testing-plan rule that painful failures must become deterministic regressions
Current state:
  Completed in:
  `tests/filing-queue.test.js`
  `tests/operator-summary.test.js`
  `docs/in-brief-success-checklist.md`
  `docs/build-plan.md`
  Missing preflight, unconfirmed beat permission, and approval-time signability drift now have explicit regression coverage instead of living only in memory notes.

### Phase 23: Preflight Automation
Goal:
  Generate operator signability state from local evidence instead of hand-editing it.
- [x] Add a signing preflight command that writes `data/state/operator-signability.json`
- [x] Derive expected wallet and allowed beats from repo docs/env
- [x] Persist helper wallet-connect evidence from the Xverse helper
- [x] Add regression tests for generated preflight behavior
Current state:
  Completed in:
  `src/filing/preflight.ts`
  `src/filing/helper-server.ts`
  `tools/xverse-register/file-signal.html`
  `tools/xverse-register/heartbeat.html`
  `tests/signing-preflight.test.js`
  `package.json`
  `npm run signing-preflight -- --date YYYY-MM-DD --candidate <candidate-id>` now generates the operator signability artifact from docs, helper-session state, and filing-ready payload validation instead of requiring a hand-written JSON file.

### Phase 24: Source-to-Signing Contract
Goal:
  Unify sourcing, scoring, queueing, approval, and filing under one explicit candidate lifecycle contract.
- [x] Persist one explicit lifecycle model from ranked candidate through filed state
- [x] Make queue, approval, and filing transitions advance that shared lifecycle
- [x] Use the shared lifecycle contract when reading signable queue state
- [x] Add regression coverage for lifecycle persistence and transitions
Current state:
  Completed in:
  `src/filing/lifecycle.ts`
  `src/scoring/candidate-queue.ts`
  `src/filing/queue.ts`
  `src/filing/approve.ts`
  `src/filing/state.ts`
  `src/ops/operator-summary.ts`
  `tests/scoring.test.js`
  `tests/filing-queue.test.js`
  `tests/filing-state.test.js`
  Ranked candidates now persist a formal `source_to_signing_v1` lifecycle with explicit scoring-state semantics instead of leaving the contract implicit in decision strings alone.
  Filing queue items now persist the same lifecycle contract, queueing assigns the explicit queue state, approval advances it to `approved_for_filing`, and filed-state updates advance it to `filed`.
  Operator summary now derives signable review candidates from the shared lifecycle contract, with a fallback for older queue artifacts that predate the lifecycle field.

### Phase 25: Live Ops Evidence Loop
Goal:
  Persist why a candidate was signable, why it was approved, why it won or lost, and what changed next day in one inspectable trail.
- [x] Persist signability evidence into candidate history when the filing queue is saved
- [x] Persist approval rationale into the same candidate-history trail at approval time
- [x] Keep win/loss reasoning and next-day changes in that same trail
- [x] Add regression coverage for the end-to-end live-ops evidence loop
Current state:
  Completed in:
  `src/filing/candidate-history.ts`
  `src/filing/queue.ts`
  `src/filing/approve.ts`
  `src/loop/daily-learn.ts`
  `tests/filing-queue.test.js`
  `tests/filing-state.test.js`
  Candidate history is now the single inspectable trail for live ops evidence instead of just a late filing/outcome snapshot.
  Saving the filing queue now captures why the candidate was signable or blocked, approval persists the rationale used at decision time, outcome tracking still records win/loss learning, and the next day's learn/report pass appends what changed in beat/style/recommendation posture.
  The markdown history in `data/candidate-history/<candidateId>.md` now surfaces signability reasons, approval reasons, outcome notes, and next-day loop changes in one place.

### Phase 26: Evidence-Backed Approval Discipline
Goal:
  Make approval require a persisted operator rationale so we can compare why we approved something against what happened later.
- [x] Require a short operator approval note for approve/reject decisions
- [x] Persist the operator rationale into filing-ready artifacts and candidate history
- [x] Surface a simple approval-rationale vs outcome check in the candidate-history trail
- [x] Add regression coverage for the approval-note contract
Current state:
  Completed in:
  `src/filing/approve.ts`
  `src/filing/candidate-history.ts`
  `src/agent/run-daily.ts`
  `src/ops/operator-summary.ts`
  `AIBTC-AGENTS.md`
  `tests/filing-queue.test.js`
  `tests/filing-state.test.js`
  `approve-filing` now requires `--approval-note "<why this should win>"` so approval can never be just a binary button press.
  The operator rationale now persists into both `data/filing-ready/<date>/<candidateId>.json` and `data/candidate-history/<candidateId>.{json,md}`.
  Candidate history markdown now includes an `Approval rationale check` line so later outcomes can be compared against the original approval thesis in one inspectable place.

### Phase 27: Candidate Replacement Loop
Goal:
  When a candidate gets held, rejected, or loses, persist what should have replaced it and whether the system surfaced that replacement in time.
- [x] Persist the best replacement candidate for each held/rejected/losing top candidate
Current state:
  Completed in:
  `src/filing/candidate-history.ts`
  `src/filing/queue.ts`
  `tests/filing-queue.test.js`
  `tests/filing-state.test.js`
  Candidate history now records a `replacementReview` for top candidates that were held, rejected, or later lost, including the replacement candidate, whether that replacement surfaced in time, and why it was preferred.
  Queue-save now captures same-day replacement evidence for displaced top candidates, and outcome updates refresh that same replacement trail for losing top candidates.
  The markdown history in `data/candidate-history/<candidateId>.md` now shows the replacement candidate and whether the system surfaced that backup before the miss became obvious.

### Phase 28: Same-Day Competitive Replay
Goal:
  Snapshot the exact same-day beat competitors and winner for every filed candidate so losses can be analyzed against the real lane.
- [x] Persist a same-day competitive replay artifact for filed candidates
Current state:
  Completed in:
  `src/filing/candidate-history.ts`
  `tests/filing-state.test.js`
  Filed candidates now get a `data/reports/competitive-replay/<date>/<candidateId>.json` artifact built from same-day brief winners plus candidate history.
  Candidate history now links that replay back into the live-ops trail with beat occupancy, whether the candidate actually won the lane, and the observed same-day winner headline and agent.
  The markdown history in `data/candidate-history/<candidateId>.md` now shows the replay winner and artifact path so same-day lane analysis is inspectable without reconstructing it by hand.

### Phase 29: Outcome-to-Scoring Attribution
Goal:
  Show which scoring factors were validated or disproved by real outcomes instead of adjusting the scorer as a black box.
- [x] Attribute real outcomes back to explicit scoring factors and heuristics
Current state:
  Completed in:
  `src/loop/optimization.ts`
  `src/types/optimization-loop.ts`
  `tests/optimization.test.js`
  Daily optimization snapshots now include a `factorAttribution` section with explicit `validated`, `disproved`, `mixed`, or `insufficient_evidence` verdicts for tracked boosts and penalties.
  The optimizer also surfaces the strongest validated and disproved scoring factors in `nextDayRecommendations`, so weight changes are inspectable instead of implicit.

### Phase 30: Operator Load Reduction
Goal:
  Track where the operator still has to rewrite, override, or skip candidates so the loop gets easier to run over time.
- [x] Persist operator intervention load and use it as a system-health signal
Current state:
  Completed in:
  `src/loop/optimization.ts`
  `src/types/optimization-loop.ts`
  `src/ops/operator-summary.ts`
  `tests/optimization.test.js`
  `tests/operator-summary.test.js`
  Daily optimization snapshots now include `operatorLoad` with explicit counts for headline rewrites, ranking overrides, skipped signable candidates, and untouched signable candidates.
  The latest operator-load snapshot is also persisted to `data/state/operator-load.json`, and operator summaries now surface that load as a workflow-health signal instead of burying it in queue artifacts.

## Do Not Double Count
- Do not mark an item complete because the repo has a related note or heuristic.
- Do not mark an item complete because the behavior exists only inside ranking reasons.
- Do not mark an item complete unless the output is persisted and inspectable.
- If a future chat changes code, this checklist must be updated in the same turn.
