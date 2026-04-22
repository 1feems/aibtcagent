# Build Plan

## Document Role

- Category: `living implementation`
- Scope: what has been done, what exists now, and what implementation constraints are active
- Use this when: you need current implementation reality before changing behavior or code
- Do not use this as: the shortest onboarding doc or the only architecture/workflow summary

## Goal
Build the smallest strong version of the AIBTC signal filing agent that can run the live 12-step signal cycle, stop when any required proof is missing, and only hand off helper-ready filings that have a high chance of making `In Brief`.

This build should prefer deterministic automation first.
Do not assume LLM calls are required for the core runtime.

## Current Operating Source Of Truth

`AGENTS.md` is the current execution contract. The build plan must align to it and must not preserve stale workflow instructions as active guidance.

Active signal workflow:

1. Brief Reader
2. Signal Status Checker
3. Outcome Updater
4. Outcome Analyst
5. Beat Saturation Check
6. Beat Analysis
7. Source Discovery
8. Create Signal
9. Signal Filer (Helper-Executed)
10. Helper Maintainer
11. Record Signal Outcome
12. Outcome Learner

Active filing beats:

- `aibtc-network`
- `bitcoin-macro`
- `quantum`

Dead or historical correspondent beats such as `infrastructure`, `agent-skills`, `deal-flow`, `agent-trading`, `bitcoin-yield`, and `onboarding` are not active filing targets unless the live `AGENTS.md`, `data/config/signal-template.json`, and beat-editor docs are changed together.

Canonical Step 8 payload behavior:

- `body` is required and canonical.
- `analysis` may mirror `body` only as a compatibility alias.
- `body` must contain `CLAIM:`, `EVIDENCE:`, `IMPLICATION:`, and `Directive:`.
- The helper/status gate must confirm `canFileSignal: true` before any filing attempt.
- Wallet signing remains human-only.

## Score Priorities

**Target: top-3 on the leaderboard.**

All metrics use a 30-day rolling window except `current_streak`, which reflects consecutive active days up to today.

Correspondent score formula:

```
score = brief_inclusions   × 20
      + signal_count       ×  5
      + current_streak     ×  5
      + days_active        ×  2
      + approved_corrections × 15
      + referral_credits   × 25
```

Practical interpretation:

- `brief_inclusions` are the main normal driver — every win is worth 4× a raw submission
- `approved_corrections` are second-highest single-signal value — worth 3× a raw submission
- `current_streak` must be protected daily — one missed day resets it to zero
- `referral_credits` are strategic and one-time — highest value but not repeatable
- `signal_count` matters, but is much weaker than brief inclusion
- `days_active` accumulates as a side effect of consistent work

Build decisions should follow this priority order.
Do not optimize for raw filing volume ahead of brief-win probability.
Daily prep should also preserve the current top-6 leaderboard snapshot and note which agents have earned more than one brief inclusion in recent cycles, because those are the strongest signals of where payout pressure and editorial lane ownership currently sit.
Leaderboard context is now part of memory, not just a prep note: store the exact ranking headings, our latest known rank/score/streak/earnings, and the current top-6 snapshot so future cycles can detect discrepancies and measure gap-to-cutoff explicitly.
The loop now has an explicit raw-snapshot-to-brain step: daily `brief-winners-YYYY-MM-DD.json` and `rejected-signals-YYYY-MM-DD.json` files are ingested into derived snapshot lessons during `agent-daily`, and those lessons are merged into `data/state/editorial-memory.json` during every runtime memory refresh.

## Build Order

Use this order for new implementation work.
If a later section conflicts with this order, this section wins.

## Daily Prep Operating Contract

When the operator says `do the daily prep`, the runtime must behave as the repo agent, not as a free-form chat assistant.

Daily prep therefore means:

1. follow `AGENTS.md` Step 1 through Step 12 in order
2. read or create the latest brief artifact before drafting
3. update/read `data/state/brief-winners-YYYY-MM-DD.json`, `data/state/signal-history.json`, `data/state/helper-errors.jsonl`, and today's outcome board before drafting
4. apply the selected beat editor from `docs/beat-editors/` before drafting
5. run duplicate / already-in-brief / already-filed checks before scoring or rewriting
6. reject bodies that drift into the live truncation zone; treat 800-900 characters as the safe target even though the hard max remains 1000, and shorten `Directive:` first when trimming
7. keep leaderboard, streak, beat-cap, and payout pressure in view as operating constraints
8. return `hold`, `repair_and_resubmit`, or `filing_ready`; do not hand off anything unless Step 8 returns `filing_ready`
9. validate helper-ready JSON before operator handoff
10. confirm the latest `news_check_status` has `canFileSignal: true` before any filing attempt

Explicit skill loop contract:

1. `analyze-signal-outcomes`:
   Read briefs, `signal-history.json`, `data/outcomes/approvals/*.json`, beat editor guidance, and recent `helper-errors.jsonl` before candidate drafting.
2. `create-signal`:
   Create or repair exactly one filing candidate only after the analysis inputs above and `data/state/outcome-boards/YYYY-MM-DD.json` have been loaded. The beat must be one of `aibtc-network`, `bitcoin-macro`, or `quantum`; for `quantum`, hard-block proposal-thread-only evidence, PR-page-only evidence, and known saturated migration/exposure clusters unless the angle is clearly AIBTC-native and operator-distinct.
3. `record-signal-outcome`:
   After a real filing result exists, update canonical outcome state and refresh learning before the next cycle.

This loop should be treated as mandatory operating order, not as optional operator memory.

This contract exists to prevent drift back into rule-only or chat-only behavior.
The intended daily-prep mode is context first, rules second, output last.

### Step 1: Lock the docs and contracts
- finalize concept note
- finalize PRD
- finalize JSON schema
- finalize setup and architecture docs
- finalize `docs/document-map.md`, `docs/company-operating-model.md`, and `docs/workflow.md` together so role definitions and operating flow do not drift

### Step 2: Create the repo structure
- create source folders
- create config layout
- create state and fixture folders
- create workflow or runtime skeleton
- optionally configure development aids for repo search and code analysis
- treat GitHub Actions as the default MVP hosting path

### Step 3: Implement the core signal model
- candidate signal structure
- proof structure
- source structure
- model disclosure structure
- validation result structure

### Step 4: Implement the validation layer first
- headline rule
- proof rule
- causality rule
- disclosure rule
- duplicate rule
- dashboard-source rejection rule

### Step 5: Implement the active beat discovery lanes
Active lanes:
- `aibtc-network`
- `bitcoin-macro`
- `quantum`

Tasks:
- connect raw sources from `data/config/monitored-sources.json`
- connect repo sources from `data/config/monitored-repos.json`
- normalize detections into one of the three active beat slugs
- attach exact proof and source URLs
- attach operator consequence and beat-editor fit

### Step 6: Implement formatting and submission packaging
- generate one-line headline
- create final payload with canonical `body`
- mark submit or reject

### Step 7: Add observability
- save candidates
- save accepted and rejected outputs
- save rejection reasons
- save performance metrics

### Step 7b: Add score observability
- track `brief_inclusions`
- track `signal_count`
- track `current_streak`
- track `days_active`
- track `approved_corrections`
- track `referral_credits`
- surface which scoring lever is highest expected value today

### Step 8: Add network-intelligence checks
- daily brief check
- agent-lookup check
- reputation check
- inbox check
- beat saturation awareness

### Step 8b: Add deterministic anomaly and contradiction checks
- compare snapshots across short windows such as now vs 1h / 24h ago
- detect exact deltas, spikes, drops, and mismatches
- flag contradiction shapes such as growth up but activity down
- always attach exact numbers and timeframe
- format these as candidate signal structures, not free-form notes

Good target shape:

- `[X changed in Y time] — Yet [contradiction or structural implication]`

This is a rules-based signal engine, not a volume-first spam engine.

### Step 9: Add outcome tracking
- approved or not
- sats earned
- BTC earned
- leaderboard movement
- streak/badge visibility

### Step 9b: Separate publication from approval
- track `published` separately from generic `approved`
- track `approved_not_in_brief` separately
- track why approved-but-not-published signals lost
- use that feedback to demote weak same-shape candidates

### Step 9c: Add correction opportunities
- parse published signals and stored outputs for factual inconsistencies
- check for math mismatch, percentage mismatch, duplicated attribution, or inconsistent totals
- surface only high-confidence correction candidates
- treat approved corrections as a high-value scoring lane

### Step 10: Expand only after proof of value
- add second lane
- add richer runtime
- add Paperboy only if helpful

### Step 10b: Protect streak without degrading quality
- ensure the agent can identify when streak risk is real
- only use a fallback filing candidate when needed to avoid a missed active day
- do not turn fallback behavior into blind hourly filing
- keep payout-quality ahead of raw volume-quality

### Step 10c: Keep the runtime non-LLM by default
- prefer rules, thresholds, snapshot diffs, and deterministic formatting first
- treat LLM usage as optional later, not core infrastructure
- the autonomous runtime should remain useful even with no paid model access

Future runtime reminder:
- consider `agentic.hosting` only after one signal lane works, daily reports work, and outcomes show the agent is worth upgrading beyond the lowest-cost runtime

## MVP Definition
The MVP is done when:
- the 12-step signal cycle works end to end
- valid signals pass
- weak signals are rejected
- output matches the helper-ready schema
- pre-submission checks are enforced
- outcomes are logged

## Not in the First Build
- complex UIs
- broad automation across all earning paths
- real-money trading logic
- large multi-agent orchestration

## Implementation Principle
Build the decision system first, then add more inputs.

Implementation bias:

- first build a rules-based anomaly and contradiction engine
- quantify every candidate with exact numbers and time windows
- favor candidates with stronger brief-win and payout odds
- do not optimize for six weak signals when one stronger signal has better publication value

Useful optional build aids:
- semantic code search for faster repo navigation
- impact analysis before refactors
- dead file and dead code checks as the codebase grows, with removal work added to the active priority list when drift is discovered

## Current Coded State
This section is the current repo state for implemented agent work.
Future chats should read this before changing runtime behavior so completed work is not overwritten.

**Last updated: 2026-04-21**

## Current Priority Order
This is the live implementation order for the next agent chats.
Optimize for the highest-value work that also reduces future token use and duplicate work.

## 2026-04-21 Company Operating Model + Repo Cleanup

- [x] 1. Add `docs/company-operating-model.md` as the canonical company roles document.
- [x] 2. Wire company roles into `docs/architecture.md`, `docs/workflow.md`, and `docs/document-map.md`.
- [x] 3. Align the top-level read order so architecture -> company operating model -> workflow is the default startup path.
- [x] 4. Audit `docs/build-plan.md`, `docs/build-checklist.md`, and adjacent canonical docs for stale assumptions whenever roles, beats, or filing behavior change.
- [x] 5. Remove dead files, dead docs, dead helper assets/routes, and dead code paths once they are confirmed unused rather than leaving them as historical clutter.
- [x] 6. Turn repeated helper `ENOENT`, stale-path, or legacy fixture failures into explicit cleanup tasks instead of treating them as harmless noise.
- [x] 7. Keep the build plan current with the company model: if a role or contract changes, update the plan in the same change set.
- [x] 8. Make the outcome board and hard do-not-draft rules part of current repo truth.
  - The runtime now writes `data/state/outcome-boards/YYYY-MM-DD.json` before drafting.
  - `create-signal` refuses to draft without today's board.
  - Repeated rejection shapes now hard-block in the creation, guard, and filing-gate validation layers.

Work completed in the legacy lane cleanup pass:
- active runtime lane moved from the old protocol-update surface to `src/signals/infrastructure.ts`
- exports now expose `runInfrastructureLane` and the old protocol-update lane file/test were removed
- primary lane coverage moved to `tests/infrastructure.test.js`
- dry-run, GitHub fetcher, raw-event types, filing-gate docs, and related tests now use the infrastructure lane
- historical artifacts under `data/reports/failure-memos/` were left unchanged as archived data

Open cleanup that remains outside this completed item:
- Queue/scoring compatibility is still follow-up work. Older tests and fixtures may still assume pre-contract candidate artifacts or older signability behavior.

### Cleanup Rule

When a file, route, fixture, helper asset, or compatibility layer is no longer part of the canonical workflow:

- remove it if nothing reads it
- migrate it if compatibility is still needed
- document it if it remains temporary on purpose

Do not keep dead code or dead docs just because they were once useful.

### 2026-04-21 Audit Notes

- `docs/build-checklist.md` was rewritten around the five-role company model and the explicit cleanup rule.
- `docs/repo-cleanup-audit.md` now records the concrete `delete / migrate / keep temporarily` decisions for duplicate files, stale helper paths, compatibility layers, and legacy lane/test surfaces.
- Repeated helper `ENOENT` noise was traced to:
  - browser requests for `tools/xverse-register/favicon.ico`
  - stale query-param lookups for `data/filing-ready/2026-04-16/manual.json`
- The helper now suppresses favicon noise and returns a user-facing missing-artifact response for stale filing-ready paths instead of logging them as generic server failures.

## 2026-04-21 Outcome Board + Hard Do-Not-Draft Rules

- [x] Made the daily operating board a mandatory runtime artifact.
  - New artifact: `data/state/outcome-boards/YYYY-MM-DD.json`
  - Mirror log: `logs/outcome-board-YYYY-MM-DD.json`
  - Writer: `src/ops/outcome-board.ts`
  - Runtime hooks: `src/agent/run-daily.ts` and `src/agent/run-signal-loop.ts`
- [x] Defined and stores the required board fields:
  - open beats
  - crowded beats
  - duplicate clusters
  - recent rejection reasons
  - latest brief winner shape
  - helper failures
- [x] Made `create-signal` fail closed when today's board is missing, stale, or structurally incomplete.
  - Drafting now requires both `data/state/signal-learning-briefs/YYYY-MM-DD.json` and `data/state/outcome-boards/YYYY-MM-DD.json`.
  - `filing_gate.testedAgainst` and `contextAudit.outcomeReview` now name the outcome board as reviewed context.
- [x] Promoted repeated rejection reasons into automatic blockers across the creation and guard path:
  - homepage-level or bare repository-root sources on metric-heavy claims
  - closed PR pages as proof of shipped changes
  - proposal-thread-only quantum sources
  - PR-page-only quantum sources without state artifacts
  - saturated quantum clusters without an AIBTC-native operator angle
  - duplicate same-day source clusters
  - filing bodies above 900 characters
- [x] Extended filing-gate validation with matching issue codes for final signable-queue defense:
  - `gate_homepage_metric_source`
  - `gate_closed_pr_as_proof`
  - `gate_quantum_proposal_thread_only`
  - `gate_quantum_pr_page_only`
  - `gate_quantum_saturated_cluster`
  - `gate_duplicate_same_day_source_cluster`
  - `gate_body_above_900_chars`
- [x] Added regression coverage:
  - `tests/create-signal.test.js` proves drafting cannot proceed without today's outcome board and covers closed-PR/source-cluster blockers.
  - `tests/signal-guard.test.js` covers closed PRs, same-day source clusters, quantum source blockers, saturated clusters, homepage metric sources, and 900-character body blocking.
  - `tests/signal-loop-analysis.test.js` proves the outcome board artifact stores the mandatory fields.
  - `tests/filing-gate-validator.test.js` covers the new final gate issue codes.

### Verification

- `npm run build` passes.
- Focused suites passing:
  - `node --test --test-concurrency=1 tests/create-signal.test.js`
  - `node --test --test-concurrency=1 tests/signal-guard.test.js`
  - `node --test --test-concurrency=1 tests/signal-loop-analysis.test.js`
- `tests/filing-gate-validator.test.js` status:
  - New hard-blocker tests pass.
  - The full file still has legacy Q1-Q4 expectation failures because the current validator intentionally treats Q1-Q4 as deprecated compatibility fields.

### Do Not Regress

- Do not allow `create-signal` to draft without today's outcome board.
- Do not move board construction into chat memory; it must remain a repo artifact.
- Do not weaken the 900-character body blocker back to only a near-1000 truncation warning.
- Do not allow closed PRs, proposal threads, or saturated quantum clusters to act as proof unless a durable state artifact or AIBTC-native operator angle clears the relevant gate.

## 2026-04-12 Filing Helper Contract Hardening

- [x] 1. Make `body` the canonical signal field in the helper.
- [x] 2. Treat `analysis` only as a compatibility input alias and normalize it into `body`.
- [x] 3. Add a mandatory pre-submit `news_check_status` step before any signal POST.
- [x] 4. Block submit immediately when cooldown is active and show `waitMinutes`.
- [x] 5. Surface the active filing address and verify it matches the approved BTC address before signing.
- [x] 6. Keep beat-claim flow fully separate from signal-validation flow.
- [x] 7. Keep the default beat-claim payload pinned to `quantum`.
- [x] 8. Update helper labels/text so they no longer reference retired beats like `dev-tools`, `infrastructure`, or other legacy beat names outside the active three-beat scope.
- [x] 9. Enforce the exact signal template in the UI before signing: `CLAIM:`, `EVIDENCE:`, `IMPLICATION:`, `Directive:`
- [x] 10. Show template failures in plain language with the missing label called out directly.
- [x] 11. Show the final normalized outgoing payload before submit so you can confirm what will actually be sent.
- [x] 12. Make the helper display whether the outgoing content field is `body` and non-empty.
- [x] 13. Ensure the headline validator checks for exact anchors when required by the local guard.
- [x] 14. Add Quantum-specific mission-alignment hints so signals mention AI agents / Bitcoin / sBTC operator consequences when needed.
- [x] 15. Add Quantum-specific value-creating hints so signals mention measurable security/settlement/routing consequences when needed.
- [x] 16. Use the MCP/news contract as the source of truth for claim-beat and file-signal payloads.
- [x] 17. Improve timeout handling so the helper doesn’t leave you guessing after 90 seconds.
- [x] 18. Improve landed-signal recovery after timeout using headline + address + since timestamp.
- [x] 19. Treat duplicate/already-exists outcomes as terminal, not retryable.
- [x] 20. Reduce blind retry behavior so the helper never encourages repeated POSTs inside the cooldown window.
- [x] 21. Make browser submit optional and prefer signed terminal/MCP submission after validation.
- [x] 22. Expose a clean copyable terminal submit command after signing.
- [x] 23. Refresh or sync editorial memory automatically when the cycle date is stale.
- [x] 24. Refresh or sync signability state automatically when allowed beats change.
- [x] 25. Add regression tests for body normalization, beat-claim bypass, template enforcement, cooldown pre-check, duplicate handling.
- [x] 26. Add one end-to-end helper test for Quantum signal submission shape.
- [x] 27. Add clearer logging so failures are grouped as beat issue, cooldown issue, template issue, payload issue, timeout issue.
- [x] 28. Remove stale assumptions in helper code that drift from current MCP/news behavior.
- [x] 29. Update docs so the helper workflow matches the actual live filing contract.
- [x] 30. Add a short operator checklist in the helper itself: check status, confirm beat, confirm payload, sign, submit once, verify landed.

### Implementation Notes

- `src/filing/signal-contract.ts` now treats `body` as canonical output while still accepting `analysis` as an input alias.
- `src/filing/helper-server.ts` now exposes local `news-check-status` and `helper-sync` endpoints, blocks signal POSTs during inferred cooldown windows, refreshes stale editorial/signability state, and classifies duplicate/timeout outcomes as terminal helper categories.
- `tools/xverse-register/file-signal.html` now shows the active filing address, exact-template blockers, quantum mission/value hints, the normalized outgoing payload, filing status/signability state, a terminal-first submit command, and an operator checklist. Browser POST remains available but is explicitly optional.
- Regression coverage was added in `tests/helper-server.test.js`, `tests/signal-contract.test.js`, and `tests/signal-guard.test.js`.

## 2026-04-15 Audit + Loop Hardening

- [x] 1. Add a reusable audit module for validator, evaluator, loop, logging, skill checks, src checks, and regression scoring.
- [x] 2. Write `/logs/{run_id}.json` records with `{ input, output, score, failures, iteration }`.
- [x] 3. Enforce a minimal audited output schema requiring `claims` and `evidence`.
- [x] 4. Block invalid audited outputs before treating them as successful runtime results.
- [x] 5. Add a 1-5 evaluator that scores task success, evidence quality, and constraint fit.
- [x] 6. Add the required retry loop so `missing_evidence` can tighten the prompt and rerun once.
- [x] 7. Keep controlled learning limited to pattern-count memory only, not free-form memory writes during execution.
- [x] 8. Add a scoped skills audit for the three reference skills: `create-signal`, `record-signal-outcome`, `analyze-signal-outcomes`.
- [x] 9. Add a src audit that verifies the loop exists, evaluation is called, and runtime memory writes are not happening in the audited loop.
- [x] 10. Wire the audited loop into `src/prep/candidate-generator.ts` so generated candidates are validated and logged before materialization.
- [x] 11. Wire the audited loop into `src/agent/run-signal-loop.ts` so the runtime can retry when the first pass produces no strong candidates.
- [x] 12. Add a repo-specific `skill_usage_correct` contract tied to local counterparts of create-signal, record-signal-outcome, and analyze-signal-outcomes.
- [x] 13. Fail the skill-usage audit if those local contract paths contain raw LLM API call patterns.
- [x] 14. Add regression tests for the audit loop, scoped skill scan, candidate materialization audit path, signal-loop audit path, and repo-specific skill-usage contract.
- [x] 15. Add `npm run audit-agent` to make the repository audit runnable as a first-class check.

### Audit Notes

- The audited creation path now lives in `src/audit/*` and is integrated into both `src/prep/candidate-generator.ts` and `src/agent/run-signal-loop.ts`.
- Candidate materialization now emits canonical `CLAIM:`, `EVIDENCE:`, `IMPLICATION:`, and `Directive:` body text and saves an audit log for each candidate run.
- The signal-loop runtime now saves `logs/signal-loop-<reportDate>.json` and retries once when the first audited pass produces no `awaiting_human_approval` candidates.
- The skills audit is intentionally narrowed to the three signal skills instead of the entire `skills` tree.
- The skill-usage audit is now repo-specific: it checks that local runtime code fulfills the responsibilities of `create-signal`, `record-signal-outcome`, and `analyze-signal-outcomes` without raw LLM API dependencies.
- Current audit target state after this pass:
  - `loop: true`
  - `evaluation: true`
  - `learning: true`
  - `skills_valid: true`
  - `skill_usage_correct: true`
  - `memory_violation: false`

## 2026-04-15 Signal Architecture Contract + Create-Signal Cut

- [x] Add beat-editor source docs under `docs/beat-editors/` as the architecture source of truth for filing and review behavior.
- [x] Add execution cut tasks directly into this build plan instead of a separate architecture-todo document.
- [x] Apply progressive skill disclosure for the three signal skills:
  - `create-signal`: draft, repair, review, validate, or prepare filing artifacts.
  - `record-signal-outcome`: record one real filed signal result.
  - `analyze-signal-outcomes`: analyze many outcomes and promote future rules.
- [x] Document local overrides for external skill drift:
  - canonical filed-outcome ledger: `data/state/signal-history.json`
  - compatibility mirror only: `data/state/filed-signals.json`
  - canonical artifact narrative field: `body`
  - compatibility alias: `analysis = body`
- [x] Add `src/prep/create-signal.ts` as the local canonical creation layer.
- [x] Move Q1-Q4 filing-gate authority into the `create-signal` artifact path.
- [x] Make `create-signal` generate explicit `filing_gate.q1` through `q4` rationales and ISO timestamps.
- [x] Make `create-signal` generate `winnerCheck` from repo memory and filed history.
- [x] Make headline anchor validation run before artifact creation can proceed.
- [x] Enforce headline max length / not-truncated behavior in the creation path.
- [x] Enforce source objects as `{url,title}[]`; plain string sources are rejected.
- [x] Define one canonical fileable artifact shape:
  - `headline`
  - `body`
  - `analysis` compatibility alias
  - `beat_slug`
  - `sources: {url,title}[]`
  - `disclosure`
  - full `filing_gate`
- [x] Add `src/filing/validate-artifact.ts` and `npm run validate-artifact -- <file>`.
- [x] Make artifact validation fail non-zero through the CLI on any gate issue.
- [x] Require `create-signal` to run artifact validation before returning a fileable artifact.
- [x] Update `src/prep/candidate-generator.ts` so materialized candidates are canonical `create-signal` artifacts, not loose prose candidates.
- [x] Mark dry-run/generated submission packages as explicitly non-fileable intermediate artifacts:
  - `kind: "intermediate_candidate_artifact"`
  - `fileable: false`
  - `non_fileable: true`
  - `intended_use: "ranking_only"`
  - `canonical_artifact_required: "create_signal_artifact"`
- [x] Make `src/filing/validate-artifact.ts` reject explicit non-fileable intermediates before helper/filing promotion.
- [x] Update `src/filing/filing-ready-append.ts` so filing-ready writes require full artifact validation, not only filing-gate validation.
- [x] Demote `src/prep/signal-job.ts` toward adapter/reporting behavior around validated artifacts; it should not be a second drafting authority.
- [x] Demote duplicate headline/anchor, brief-fit, and memory-derived pre-draft gates in `signal-job` for canonical `create_signal_artifact` inputs; keep them hard for raw non-canonical inputs.
- [x] Add direct `create-signal` contract coverage plus artifact validation regression coverage.

### Verification

- `npm run build` passes.
- Focused creation/filing suite passes:
  - `tests/candidate-generator-audit.test.js`
  - `tests/create-signal.test.js`
  - `tests/validate-artifact.test.js`
  - `tests/filing-ready-append.test.js`
  - `tests/runtime-enforcement.test.js`
  - `tests/filing-gate-validator.test.js`
- Full `npm test` is not green yet; remaining failures are in older fixture paths, missing exports, queue/scoring assumptions, and legacy winner-gate expectations. Treat those as follow-up cleanup, not as blockers to the completed create-signal cut.

### Priority 1: Queue/scoring artifact compatibility cleanup
- update older queue and scoring paths/tests so they either consume canonical `create_signal_artifact` records or explicitly keep intermediate candidates non-fileable
- keep `signal-job`, helper, guard, queue, and audit in adapter/blocker roles; none should redefine editorial truth after `create-signal` has created a validated artifact
- success condition:
  - queue/scoring no longer assumes pre-contract dry-run submissions are fileable
  - repo-wide tests no longer fail because old paths expect raw dry-runs to promote directly

### Priority 2: Brief artifact automation
- automate creation or fetch/storage of `data/briefs/YYYY-MM-DD.md` when brief text is available
- keep `signal-job` fail-closed when the same-cycle brief artifact is missing
- success condition:
  - same-cycle prep + signal flow can run without manual brief file placement when the brief source is available

### Priority 3: Submission scheduler and cadence guardrails
- implement an early-UTC submit gate for the actual filing path:
  - prefer best submissions between `04:00` and `10:00` UTC
  - do not block drafting, scoring, or queue-building outside that window
- add defer/queue behavior outside the filing window:
  - strong candidates should be preserved as queued/deferred, not discarded
  - the queue should surface what is ready to send at the next valid window
- enforce per-beat cooldown at runtime:
  - no more than 1 filing attempt per beat per 60 minutes
  - expose blocker reasons clearly before helper/signing time is wasted
- enforce daily quota tracking and stop conditions:
  - track signals filed today against the live `6/day` operating limit
  - stop recommending low-value filings once quota or window constraints are exhausted
- why this is next:
  - timing and cadence are real structural constraints, but they should shape submission timing rather than disable the full prep pipeline
- success condition:
  - the runtime can prepare candidates all day, queue strong ones safely, and only advance send-ready artifacts when window and cadence rules are satisfied

### Priority 3b: Correction loop as a second scoring lane
- poll recent network signals on a schedule
- run factual checks against:
  - source URLs
  - on-chain or Hiro-backed facts
  - GitHub artifacts
  - live price or oracle data where relevant
- rank likely correction candidates by confidence and point value
- prepare correction payloads for signing/submission without requiring manual reconstruction
- why this is next:
  - `approved_corrections × 15` is the second-highest repeatable scoring lever and does not consume a filing slot
- success condition:
  - the repo can surface a short daily queue of high-confidence corrections and output helper-ready correction payloads

### Priority 3c: Streak protection and failure recovery
- add retries with backoff around fragile network operations
- use `AbortSignal.timeout` so API calls fail fast instead of hanging the run
- strengthen heartbeat/check-in monitoring and reminder state
- add explicit failure alerts and a durable `did we complete today?` state record
- why this is next:
  - missed active days destroy streak value and hide failures until it is too late to recover
- success condition:
  - the runtime can prove whether the day has a completed activity path, and transient API failures no longer silently burn the streak

### Priority 3d: Source and evidence quality enforcement ✅ (2026-04-21)
- `create-signal`, `signal-guard`, and `filing-gate-validator` now hard-block the repeated weak-evidence shapes that were still slipping toward drafting:
  - homepage-level or repository-root sources on metric-heavy claims
  - closed PR pages as proof of shipped changes
  - proposal-thread-only quantum sources
  - PR-page-only quantum sources without durable state artifacts
  - saturated quantum clusters without an AIBTC-native operator angle
  - duplicate same-day source clusters
  - bodies above 900 characters
- Structured source objects, concrete anchors, non-empty disclosure, and template bodies were already enforced in the create-signal artifact path and remain active.
- Current follow-up is not to rebuild these gates. It is to keep new source-specific rules in the same creation/guard/filing-gate layers when fresh rejection data proves a new blocker.

### Priority 3e: Real-data enrichment in draft construction
- wire GitHub PR, issue, and release extraction into candidate evidence
- wire Hiro and other on-chain fetches into candidate proof
- validate price and oracle claims against live endpoints before packaging
- normalize payloads so proof, sources, tags, and disclosure all match the filing contract
- why this is next:
  - the drafting layer should start from verified facts, with refinement only happening after the evidence is attached
- success condition:
  - candidate drafts are built from live, attributable data and already contain the proof needed for filing or correction work

### Priority 3f: Measurement and feedback instrumentation
- track submission timing by UTC window and beat
- track acceptance, rejection, approved-not-in-brief, and brief-inclusion outcomes
- track correction attempt rate and correction hit rate
- track beat-level performance so the runtime can see which lanes are compounding and which are wasting slots
- why this is next:
  - we need operating feedback that shows whether timing, specialization, and correction work are actually improving score velocity
- success condition:
  - the repo can show which scoring lever is performing best and whether the current strategy is closing the gap to top 3

### Priority 4: Brief artifact automation
- automate creation/fetch/update of `data/briefs/YYYY-MM-DD.md` when source text exists
- preserve the current dated file contract
- why this is fourth:
  - useful for unattended runs, but less important than smarter selection and gating

### Priority 5: Outcome normalization and auto-learning
- normalize publisher feedback into machine labels like:
  - `body_missing`
  - `headline_truncated`
  - `beat_cap`
  - `missing_timestamped_evidence`
  - `approved_not_in_brief`
- feed those labels into the runtime brain automatically
- keep `memory/learnings.md` as the human-readable audit log, not the runtime dependency
- why this is fifth:
  - this strengthens the brain once the default runtime path already uses it

### Priority 6: Signal Pipeline Recovery
Status: done on 2026-04-04
- define one canonical editorial contract across:
  - Publisher process
  - Fact-Checker process
  - duplicate / already-in-brief / already-filed checks
  - leaderboard and streak operating context
  - helper and filing payload contract
- source of truth:
  - `docs/beat-editors/`
- why this is next:
  - April 2 behaved like a usable operator workflow while April 3 behaved like a fragmented validation system
  - the system drifted from context-first, outcome-oriented behavior into rule-led, fail-closed behavior
  - context memory, editorial rules, helper guard, signal docs, filing format, and live Publisher behavior stopped reinforcing each other
- success condition:
  - the repo behaves like one editorial operating system rather than multiple partially aligned gates

### Priority 7: Duplicate-First Hard Gate
Status: done on 2026-04-04
- make these checks run before scoring, rewriting, or helper submission:
  - already in today's brief
  - already in prior posted briefs
  - already filed
  - same-story-shape duplicate lane
- why this is next:
  - duplicate control was not first, so already-briefed and already-filed ideas made it too far into the pipeline
- success condition:
  - a signal already in brief or already filed is impossible to suggest or submit

### Priority 8: Make `data/state/editorial-memory.json` the live daily brain
Status: done on 2026-04-04
- regenerate `editorial-memory.json` every cycle from:
  - same-day accepted signals
  - same-day rejected signals
  - brief winners
  - normalized publisher feedback
  - normalized fact-check lessons
- add explicit sections for:
  - what won today
  - what lost today
  - what "value-creating" looked like today
  - what source combinations passed today
- why this is next:
  - `editorial-memory.json` became too stale, too abstract, and too weak as the live brain
- success condition:
  - runtime decisions start from fresh context first, not stale generalized rules
  - same-day accepted and rejected outcome records automatically feed snapshot lessons and brief-example memory without requiring a manual rejected-signals paste for every cycle

### Priority 8a: Add leaderboard and streak context as explicit operating constraints
Status: done on 2026-04-04
- load leaderboard and cadence context from objective memory into the runtime:
  - current rank
  - current score
  - current streak
  - gap to top-3
  - gap to top-6
  - max 6/day cadence limit
  - 1 beat / 60 minute cadence limit
- use that context in queueing and recommendation behavior:
  - protect live streaks without rewarding weak filler
  - favor brief-winning candidates when top-3 pressure is active
  - surface beat-cap and same-beat cooldown blockers before signing time is wasted
  - keep quota notes explicit about streak and top-3 pressure
- why this is next:
  - leaderboard pressure, payout pressure, and cadence limits were present in docs but not enforced strongly enough in the live queue
- success condition:
  - the runtime respects streak, top-3 pressure, beat caps, and payout pressure as operating constraints rather than after-the-fact notes
  - filing queue tests prove daily cap and same-beat cooldown are enforced only in the live daily filing context

### Priority 9: Align `signal-guard` to real Publisher and Fact-Checker behavior
- audit current helper guard blockers against real accepted and rejected signals
- remove or relax helper-only rules that are stricter than live editorial behavior unless they are intentionally stricter
- strengthen first-stop blockers where the live Publisher is stricter:
  - duplicate / already-in-brief
  - already-filed
  - circular sourcing
  - unsupported numeric claims
- **Update (2026-04-07):** `src/filing/signal-guard.ts` now enforces structured analysis bodies before duplicate checks when a body is present.
  - Added `hasStructuredAnalysis(text)` — requires a `claim:` section, an `evidence:` section with a verifiable artifact pattern, and an `implication:` section with an action/directive pattern. Directive verb list: `update|upgrade|avoid|redeploy|watch|pause|check|migrate|monitor`.
  - **Update (2026-04-07):** Added `monitor` to the directive verb regex (same line as the other verbs — no separate check). Error message string updated to match.
  - Added a first-stop blocker when a non-empty body fails that structure test.
  - Regression coverage updated in `tests/signal-guard.test.js`:
    - structured three-part body passes
    - free-form body fails with the exact blocker string
    - existing publisher/fact-check fixture body updated to use CLAIM / EVIDENCE / IMPLICATION structure
- why this is next:
  - helper guard and editorial judgment drifted apart
- success condition:
  - a signal that should pass editorially passes the helper, and a signal that should fail editorially fails the helper

### Priority 10: Canonical Signal Payload Contract
- define one canonical signal payload for:
  - repo artifact
  - helper paste
  - API filing
- explicitly document required fields and field names:
  - `beat_slug`
  - `headline`
  - `body`
  - `sources`
  - `tags`
  - `disclosure`
- `analysis` is only a compatibility alias and must mirror `body` when present
- prevent drift between helper validation, artifact validation, and API filing fields
- why this is next:
  - signal format split into multiple truths and created repeated operator errors
- success condition:
  - there is one unambiguous signal JSON contract across the repo and helper, with `body` as the required content field

### Priority 11: Helper, Report, and Artifact Sync Contract
- every signal handed to the operator must also exist in:
  - the dated signal report
  - the dated repo artifact path
  - the helper-compatible payload shape
- never hand chat-only signals to the user
- why this is next:
  - the system drifted into artifact/report/helper mismatch and encouraged bandaid fixes
- success condition:
  - every proposed signal is repo-backed, dated, and helper-ready

### Priority 12: Regression Tests from Real Accepted and Rejected Signals
Status: done on 2026-04-04
- add fixtures from April 2, April 3, and future days
- assert:
  - known in-brief winners pass
  - known rejects fail for the right reason
  - known duplicates fail early
  - known already-filed signals fail early
- why this is next:
  - the system currently claims skills and memory are wired even when real outcomes prove alignment is weak
- success condition:
  - future drift is caught by tests before it reaches the operator
  - regression coverage includes:
    - a real winner-style April 3 signal that clears the guard in isolated context
    - a real April 3 already-filed headline that fails duplicate-first
    - a real April 3 repaired candidate that still fails the current Q4 / winner-bar gate for the exact helper reasons seen live

### Priority 13: Pre-Submit Audit Step
Status: done on 2026-04-04
- before any signal is handed to the operator, confirm:
  - not already in brief
  - not already filed
  - passes Publisher gate
  - passes Fact-Checker gate
  - passes helper guard
  - exists in the dated signal report and artifact path
- why this is next:
  - the system needs one final deterministic stop before operator time is wasted
- success condition:
  - wrong, duplicate, or malformed signals are blocked before they ever reach the user
  - queue promotion now includes a repo-backed pre-submit audit:
    - missing source artifact blocks
    - missing headline / analysis / sources / tags / disclosure blocks
    - missing dated signal-report presence blocks
    - final shared signal guard blockers are surfaced before the candidate can reach `awaiting_human_approval`

### Priority 14: Day-over-Day Validation
Status: done on 2026-04-04
- replay April 2 and April 3 through the repaired pipeline
- compare:
  - accepted candidates
  - rejected candidates
  - helper behavior
  - report usefulness
  - memory freshness
- why this is next:
  - April 2 worked more like a usable operator workflow, while April 3 exposed the fragmented validation failure mode
- success condition:
  - April 2 remains strong and April 3 no longer collapses into over-rejection and confusion
  - replay artifact exists at:
    - `data/reports/validation/2026-04-02-vs-2026-04-03.md`
  - validation now proves:
    - April 2 still shows a substantive submitted slate
    - April 3 still records the old `leaderboard_not_checked` failure mode in the daily report
    - the repaired runtime now surfaces April 3 as a trusted slate with explicit send-ready and blocked outcomes instead of opaque fail-closed confusion

### Priority 15: Correct Status Language in the Plan
Status: done on 2026-04-04
- remove or soften any claim that Publisher / Fact-Checker / helper enforcement is already "complete"
- only mark complete after end-to-end day replay and regression tests pass
- why this is next:
  - the plan must reflect reality or it will keep encouraging bandaid work
- success condition:
  - the build plan no longer overstates how solved this part of the system is

---

## Retired Separate Editor Role

The standalone infrastructure editor loop was removed during the 2026-04-22 focus cleanup.
It is not part of the active 12-step filing contract in `AGENTS.md`.

Current beat-editor usage is local guidance only:
- read `docs/beat-editors/*.md` during Steps 3, 6, and 8
- apply the selected beat editor as a drafting and validation constraint
- do not run a separate editor fetch/review/submit loop

**Diagnosis (as of 2026-04-05, rank #104, slipped from #80):**
- Score ~260: estimated 1 brief inclusion, 34 signals, 10d streak
- Not in April 4 or April 5 brief
- Top agents (Encrypted Zara #1, Dual Cougar #3, Micro Basilisk #6) landed 2–3 brief slots on April 5 alone
- Problem is conversion, not participation: signals get approved but do not win brief slots

**Top-6 leaderboard context (2026-04-05):**

| # | Agent | Signals | Streak | Score |
|---|---|---|---|---|
| 1 | Encrypted Zara | 72 | 12d | 1064 |
| 2 | Prime Spoke | 75 | 13d | 946 |
| 3 | Dual Cougar | 75 | 13d | 891 |
| 4 | Secret Mars | 137 | 4d | 859 |
| 5 | Elegant Orb | 67 | 13d | 786 |
| 6 | Micro Basilisk | 62 | 12d | 754 |

April 5 brief wins: Dual Cougar 3, Micro Basilisk 3, Encrypted Zara 2, Secret Mars 1. Prime Spoke and Elegant Orb had zero — leaderboard rank does not map 1:1 to brief conversion.

**Scoring formula:**
```
brief_inclusions × 20  ← primary lever, 4× value of a raw signal
approved_corrections × 15  ← second-highest single-signal value
referral_credits × 25  ← highest but one-time
current_streak × 5  ← protect daily
signal_count × 5  ← weak
days_active × 2  ← passive
```

### Priority 26: Brief conversion tracking ✅

- In canonical outcome state, track `brief_included` separately from generic `approved`
- Current canonical target is `data/state/signal-history.json`; `data/state/filed-signals.json` may mirror this for legacy readers
- Add `approved_not_in_brief` count to daily prep report and leaderboard context
- Identify the shape of approved-but-not-brief signals: what score range, what beats, what time filed
- Why: approved signals that miss brief slots are near-wins — understanding why they lost slots is the highest-leverage insight available
- Success condition: daily prep surfaces approved-but-not-brief count and the most common reason signals in that bucket lost slots (beat saturation, score margin, filing time)

### Priority 27: Beat saturation detector ✅

- Before queuing a candidate, check how many signals on the same beat are already in the current cycle's approved pool
- If beat saturation is high, require a displacement-level angle (unique data, stronger evidence, or direct contradiction of existing signal) to proceed
- Surface saturation level as an explicit queueing constraint in the daily prep report
- Why: filing a fifth infrastructure signal when four are already approved wastes a filing slot with near-zero brief-win probability
- Success condition: artifact creation / queueing surfaces beat saturation as a blocking or warning condition before a candidate reaches the operator

### Priority 28: Brief-win signal shape gate ✅

- Enforce three mandatory attributes on every candidate before it reaches the queue:
  1. Explicit operator consequence — "what changes for agents now" must be stated, not implied
  2. Exact number — a verifiable quantity (block height, sat amount, percentage, count) in the first two sentences
  3. Displacement framing — why this signal belongs in the brief over the others on the same beat today
- Demote candidates that pass approval gates but fail these three attributes to a secondary queue
- Why: current approved signals are "good" but brief slots go to signals that are operationally urgent and numerically specific
- Success condition: `create-signal` / artifact validation gates on all three attributes; candidates missing any one are flagged before reaching operator

### Priority 29: Cap-blocked resubmission queue ✅

- Track signals that were approved but blocked by the daily beat cap (not rejected for quality)
- Surface cap-blocked signals as the first resubmission candidates on the next available cycle for that beat
- Do not treat cap-blocked signals as quality failures — they are queue management artifacts
- Why: cap-blocked signals are often the strongest candidates for the next cycle; currently they are buried or forgotten
- Success condition: daily prep shows cap-blocked candidates from prior cycles as the top resubmission candidates before new generation

### Priority 30: Three-beat operating coverage ✅

- Audit which of the three active beats has the best open slot: `aibtc-network`, `bitcoin-macro`, or `quantum`
- Keep all candidate sourcing, beat saturation checks, and editor guidance inside those active beats
- File only when the selected beat has a concrete anchor, primary proof, and enough brief-win probability to justify the shared cooldown
- Why: the live beat model consolidated older lanes; spreading into retired beats creates helper and publisher mismatch
- Success condition: daily prep identifies the strongest active-beat candidate or returns `hold` with explicit blocker reasons

---

## Leaderboard Recovery — Brief Conversion ✅ COMPLETE (2026-04-06)

**All 5 priorities (P26–P30) implemented and passing. Build clean. 15/15 tests pass.**

**Goal: top 3. Current rank #104, slipped from #78 (as of 2026-04-06).**

| Agent | Rank | Signals | Streak | Earned | Score | Est. briefs |
|---|---|---|---|---|---|---|
| Encrypted Zara | #1 | 72 | 12d | 1,130,000 sats | 1064 | ~31 |
| Prime Spoke | #2 | 75 | 13d | 640,000 sats | 946 | ~24 |
| Dual Cougar | #3 | 75 | 13d | 740,000 sats | 891 | ~21 |
| Secret Mars | #4 | 137 | 4d | 780,000 sats | 859 | high volume |
| Elegant Orb | #5 | 67 | 13d | 540,000 sats | 786 | — |
| Micro Basilisk | #6 | 62 | 12d | 540,000 sats | 754 | — |
| **Valiant Gryphon** | **#96** | **37** | **11d** | **30,000 sats** | **284** | **~1** |

**Score breakdown — Valiant (as of 2026-04-06):**
- Base (signals×5 + streak×5 + days×2) = ~268 points
- Remainder ~16 → estimated 1 brief inclusion total
- Not in April 4, April 5, or April 6 brief

**Gap to top 3:**
- Need +607 points to reach #3 (891)
- Brief inclusions: 30 more wins needed — primary path
- Approved corrections: 40 needed — secondary path
- Referrals: 24 needed — one-time, strategic

**April 5 brief conversion:** Dual Cougar 3, Micro Basilisk 3, Encrypted Zara 2, Secret Mars 1. Prime Spoke 0, Elegant Orb 0. Rank does not map to conversion.

**Root cause (updated 2026-04-06):** Conversion is broken at two levels — signal quality (not winning the 30-best selection) and payload bugs (same errors hit in both April 4 and April 5, wasting filing slots).

**Beat specialization gap:** NotebookLLM analysis showed that broad beat sprawl underperformed specialist behavior. The current live model is the three-beat set in `AGENTS.md` and `data/config/signal-template.json`: `aibtc-network`, `bitcoin-macro`, and `quantum`. Older `infrastructure` / `agent-skills` strategy language is historical only.

**Scoring formula:**
```
brief_inclusions × 20  ← primary lever, 4× a raw signal
approved_corrections × 15  ← second-highest per-signal value
referral_credits × 25  ← highest but one-time
current_streak × 5  ← protect daily
signal_count × 5  ← weak multiplier
days_active × 2  ← passive
```

### Priority 26: Brief conversion tracking ✅

- In canonical outcome state, track `brief_included` separately from generic `approved`
- Current canonical target is `data/state/signal-history.json`; `data/state/filed-signals.json` may mirror this for legacy readers
- Add `approved_not_in_brief` count to daily prep report and leaderboard context
- Identify the shape of approved-but-not-brief signals: what score range, what beats, what time filed
- Why: approved signals that miss brief slots are near-wins — understanding why they lost slots is the highest-leverage insight available
- Success condition: daily prep surfaces approved-but-not-brief count and the most common reason signals in that bucket lost slots (beat saturation, score margin, filing time)

### Priority 27: Beat saturation detector ✅

- Before queuing a candidate, check how many signals on the same beat are already in the current cycle's approved pool
- If beat saturation is high, require a displacement-level angle (unique data, stronger evidence, or direct contradiction of existing signal) to proceed
- Surface saturation level as an explicit queueing constraint in the daily prep report
- Why: filing a fifth infrastructure signal when four are already approved wastes a filing slot with near-zero brief-win probability
- Success condition: artifact creation / queueing surfaces beat saturation as a blocking or warning condition before a candidate reaches the operator

### Priority 28: Brief-win signal shape gate ✅

- Enforce three mandatory attributes on every candidate before it reaches the queue:
  1. Explicit operator consequence — "what changes for agents now" must be stated, not implied
  2. Exact number — a verifiable quantity (block height, sat amount, percentage, count) in the first two sentences
  3. Displacement framing — why this signal belongs in the brief over the others on the same beat today
- Demote candidates that pass approval gates but fail these three attributes to a secondary queue
- Why: current approved signals are "good" but brief slots go to signals that are operationally urgent and numerically specific
- Success condition: `create-signal` / artifact validation gates on all three attributes; candidates missing any one are flagged before reaching operator

### Priority 29: Cap-blocked resubmission queue ✅

- Track signals that were approved but blocked by the daily beat cap (not rejected for quality)
- Surface cap-blocked signals as the first resubmission candidates on the next available cycle for that beat
- Do not treat cap-blocked signals as quality failures — they are queue management artifacts
- Why: cap-blocked signals are often the strongest candidates for the next cycle; currently they are buried or forgotten
- Success condition: daily prep shows cap-blocked candidates from prior cycles as the top resubmission candidates before new generation

### Priority 30: Three-beat operating coverage ✅

- Audit which active beats have current proof-backed opportunities: `aibtc-network`, `bitcoin-macro`, and `quantum`
- Keep sourcing and filing inside the active beat set unless `AGENTS.md`, the signal template, and beat-editor docs are updated together
- File only when the candidate can beat same-day competition; otherwise return `hold`
- Why: the live publisher/helper contract now rejects old beat sprawl as operational drift
- Success condition: daily prep identifies the strongest active-beat candidate or explains why all active beats are blocked

---

## Signal Quality & Bug Loop — 2026-04-06

Source: NotebookLLM analysis of brief-winning signals, April 4–5 workflow bug reports, publisher rule update.

**Context:** Publisher changed the brief model. Best 30 signals across ALL correspondents win — not per-agent quotas. Approved ≠ in brief. Approved entries can be replaced by better stories until inscription. Only the 30 in the brief earn 30,000 sats. This makes winner-tier quality mandatory on every filing.

**Rank at start of this work: #96, score 284, 11d streak, 37 signals, 30,000 sats earned.**

### Priority 31: Bug learning loop ✅

- Add `bug:` as a first-class lesson kind to `src/learning/editorial-memory.ts` (alongside `win:`, `loss:`, `next:`)
- Update `classifyOutcomeKind`, `countByKind`, and `outcomeLogging.requiredFormats` to recognize `bug:` entries
- Add 4 new `REPEATED_RULES` that promote repeated payload bugs to hard `preFilingChecks` after 2+ occurrences:
  - `sources-must-be-url-title-objects` — plain-string sources silently failed helper in Apr 4 + Apr 5 (already at 2 hits, will be promoted)
  - `filing-payload-fields-only` — extra repo fields (status, lifecycle) rejected by helper contract
  - `disclosure-verify-before-helper` — disclosure silently dropped by artifact generation
  - `cycle-date-freshness-before-helper` — stale `currentCycle.reportDate` blocked all Apr 5 helper runs (2 hits, will be promoted)
- Write all April 4 + April 5 workflow bugs to `memory/learnings.md` as `bug:` entries
- Add `## Bugs and Rejections` section to `data/reports/signals/TEMPLATE.md` with instruction to copy bugs to `learnings.md` after every cycle
- Why: same payload bugs hit in both April 4 and April 5 cycles, wasting at least 4 filing slots; the bug findings were documented but never machine-ingested
- Success condition: workflow bugs from signal reports automatically flow into `preFilingChecks` after 2 cycles, surfacing in the hard editorial gates section of every future signal report

### Priority 32: Winner-gate structural improvements ✅

- `src/signals/winner-gate.ts`: add `hasAnchorInHeadline()` — exact anchor must appear in the headline itself (PR#, issue#, version, sats amount, block height, CVSS, HTTP code); winners always lead with the hard fact
- `src/signals/winner-gate.ts`: expand `hasExactAnchor()` to recognize sats amounts (`\b\d[\d,.]*[KMBk]?\s*sats?\b`), HTTP error codes, CVSS scores, block heights — the precision anchors that distinguish brief winners
- `src/signals/winner-gate.ts`: add `hasClaimEvidenceImplication()` — body must contain at least one evidence sentence (PR/issue/API/block/sats) and at least one implication sentence (`agents should`, `this means`, `which means`, etc.)
- Why: NotebookLLM analysis shows every brief winner uses CLAIM → EVIDENCE → IMPLICATION structure with an anchor in the headline; our signals were missing either the headline anchor or the explicit implication sentence
- Success condition: a signal without an anchor in the headline or missing CLAIM/EVIDENCE/IMPLICATION body structure fails `evaluateWinnerGate` before reaching the operator

### Priority 33: Beat specialization pivot ✅ (strategy + scoring enforcement)

- NotebookLLM data: 10-beat sprawlers average 26K sats, 1-2 beat specialists average 135K sats — 5x gap driven by domain expertise and lower rejection rates
- Strategy baseline moved from retired narrow beats to the current active beat model:
  - `aibtc-network`: AIBTC protocol, agent infrastructure, leaderboard, payment, relay, governance, and ecosystem operating changes
  - `bitcoin-macro`: Bitcoin market, fee, mining, ETF, regulatory, custody, and macro conditions with agent-relevant implications
  - `quantum`: Bitcoin-specific post-quantum threat intelligence, BIP-360 / P2MR migration milestones, exact readiness deltas tied to Bitcoin keys, wallets, or agent ops
  - Avoid retired filing beats unless the live contract is updated: Infrastructure, Agent Skills, Agent Economy, Agent Social, Onboarding, Deal Flow, Agent Trading, Bitcoin Yield
- `src/learning/editorial-memory.ts`: add `Beat specialization` and `Early UTC filing window` to `focusAreas` compiled from competition memory
- Why: spreading across 8 beats produces low-quality signals per beat with no specialization advantage — this is the root cause of the 26K avg sats
- Success condition: every signal report targets at most 2 beats; editorial memory surfaces open specialist lanes; beat sprawl is flagged in focusAreas
- **Scoring enforcement (2026-04-06):** beat specialization is now runtime-enforced in `candidate-queue.ts` — +8 for primary learned lane, +4 for secondary, −10 for memory-deprioritized beats, −4 for beats outside the two learned lanes. Derived from outcome-backed publication rates in `editorialLearnings.primaryBeat` / `secondaryBeat` / `deprioritizedBeats`.
- **Runtime focus update (2026-04-07):**
  - `src/scoring/beat-coverage.ts` now includes `quantum` in `KNOWN_BEATS` and adjacency maps (`quantum` ↔ `infrastructure`, `security`)
  - **2026-04-07 patch:** `infrastructure` adjacency array was missing `quantum` — the `quantum` ↔ `infrastructure` link was one-directional. Added `"quantum"` to `ADJACENT_BEATS["infrastructure"]`; all three edges (`quantum`→`infrastructure`, `quantum`→`security`, `infrastructure`→`quantum`, `security`→`quantum`) are now bidirectional.
  - `src/scoring/beat-coverage.ts` now reads `data/state/objective-memory.json` for `specialistMode`, `targetBeats`, and `targetBeatsPerWeek` so a 2-beat strategy is not treated as under-coverage against the old 11-beat expansion target
  - `data/state/objective-memory.json` should be treated as stale if it records target beats outside `["aibtc-network", "bitcoin-macro", "quantum"]`
  - `data/state/competition-memory.json` now treats Infrastructure as crowded and adds explicit crowding notes for both Infrastructure and Quantum
  - `data/config/monitored-repos.json` now points release monitoring at infrastructure-heavy repos plus `bitcoin/bips` for quantum-adjacent standards tracking
  - `data/config/monitored-sources.json` now adds `arXiv` and `NIST` quantum watch feeds plus an extra Stacks core info snapshot for infrastructure
  - `src/sources/news-source-fetcher.ts` now recognizes `quantum` as a first-class inferred beat and frames its significance/operator consequence in Bitcoin-specific terms

### Priority 37: Publisher pattern enforcement ✅ (2026-04-06)

**Source:** Publisher analysis — 4 findings mapped to concrete build gaps.

**Gap 1: UTC threshold was wrong.** Late-window gate fired at ≥14:00 UTC but the 30-slot cap fills at ~13:00 UTC. Fix: threshold moved to ≥13:00 UTC in `candidate-queue.ts`.

**Gap 2: No measurable delta enforcement.** Publisher data shows outstanding signals track specific ecosystem changes (before/after, N-to-Y, stalled N blocks) not vague trend narratives ("growing adoption", "organic trickle"). Nothing in scoring distinguished these.
- Added `hasMeasurableEcosystemDelta(text)` — +7 when signal shows a numeric before/after change
- Added `isVagueTrendNarrative(text)` — −12 when signal describes organic/gradual trends with no specific incident anchor or measurable delta
- Both wired into `scoreCandidate` in `candidate-queue.ts`

**Gap 3: Displacement risk was only a score penalty.** "Approved ≠ in brief" (deterministic roster reconciliation) means a signal in an occupied beat that barely clears 75 will be filed, then likely displaced. A score penalty of −8 was not enough to prevent that.
- Added explicit displacement risk gate in the decision block: if beat is occupied in the latest brief snapshot AND candidate is not an obvious brief winner AND score < 85 → override `file` to `hold`
- Prevents displacement-probable filings from wasting slots on certain loss

**What remains at skill/prompt level (not TypeScript):**
- HTTP 429 → `cap_blocked = true` flag must be set by the agent at runtime when the MCP `news_file_signal` call returns a 429 response. The `cap_blocked` field in `FiledSignalRecord` already exists (P29). The wiring is in the signal skill prompt, not TypeScript — part of Priority 34 template side still open.

### Priority 34: Filing window enforcement ✅ (2026-04-06)

- The daily 30-slot cap fills around 13:00 UTC; after that HTTP 429 blocks all new approvals regardless of quality
- Target: 04:00–10:00 UTC — before the cap fills and before competitor volume peaks
- `data/reports/signals/TEMPLATE.md`: `## Filing window` section present with UTC targets and HTTP 429 = cap-hit rule ✅
- HTTP 429 at runtime: `cap_blocked` field exists in `FiledSignalRecord`; the agent skill must set it when the MCP call returns 429 — this is a prompt-level instruction, not TypeScript, and is covered by the template rule above ✅
- Why: filing after 10:00 UTC wastes slots on probable cap-hit rejections that look like quality failures but are timing failures
- **Scoring enforcement:** late-window gate in `candidate-queue.ts` — candidates detected at ≥13:00 UTC require score ≥82 to file when `lateWindowThresholdRaised` is set; early-UTC (<10:00 UTC) candidates get +6 boost when timing losses are in memory

### Priority 36: Memory-to-scoring enforcement loop ✅ (2026-04-06)

**Problem:** memory was written and surfaced but did not change actual scoring, rejection, or filing decisions. The loop could learn but the lessons did not automatically change outcomes.

**What was built:**

- `src/types/optimization-loop.ts`: added 7 machine-readable enforcement fields to `EditorialLearningSnapshot`:
  - `timingLossObserved` / `lateWindowThresholdRaised` — derived from top-candidate failure pattern text
  - `primaryBeat` / `secondaryBeat` — best two beats sorted by outcome-backed publication rate (fixed prior bug: was using alphabetical sort, not performance sort)
  - `deprioritizedBeats` — all beats with `preference === "decrease"` from outcome memory
  - `rawStatDumpAntiPatternActive` — true when `raw_release_without_operator_consequence` factor is outcome-validated OR narrow packaging is flagged
  - `feedOnlySourceAntiPatternActive` — true when `dashboard_first_sourcing` factor is outcome-validated OR source-domain failure patterns are present

- `src/loop/optimization.ts` (`buildEditorialLearnings`): populates all 7 flags from live outcome data; fixed `primaryBeat` derivation to use publication-rate-sorted "increase" beats rather than alphabetical first entry

- `src/scoring/candidate-queue.ts`: three enforcement blocks added after the existing beat preference checks:
  1. **Beat specialization gate** — primary/secondary/deprioritized lane scoring using `editorialLearnings`
  2. **Anti-pattern enforcement** — −12 for no operator consequence when `rawStatDumpAntiPatternActive`; −10 for dashboard-primary sourcing when `feedOnlySourceAntiPatternActive`
  3. **Late-window threshold gate** — file threshold raised to 82 for late-UTC candidates when `lateWindowThresholdRaised`; +6 boost for early-UTC candidates when timing losses are in memory

- Build: `tsc --noEmit` passes clean.

**Why:** the agent was observing and summarizing lessons but outcomes were not changing. Scoring and the file/hold/reject decision are the two real enforcement points — now they read structured memory flags instead of treating editorial learnings as advisory text only.

### Priority 35: Guild role activation ✅ (2026-04-06)

- Publisher announced guild roles: fact-checker and editor earn leaderboard points independently of correspondent filing
- `approved_corrections × 15` = second-highest scoring lever, worth 3× a raw signal
- When the 30-slot cap is already hit or candidates are below winner bar: shift to fact-checker instead of filing weak signals
- Fact-checker path: find published signals with verifiable metric errors and queue correction candidates for operator review
- Standalone editor review/submission tooling was removed during the 2026-04-22 focus cleanup because it is not part of the active `AGENTS.md` 12-step filing loop
- **Tracking (2026-04-06):**
  - `src/filing/state.ts`: added `approved_corrections?: number` to `FiledSignalsState` and exported `incrementApprovedCorrections()`
  - `src/corrections/correction-hunter.ts`: scans for high-confidence correction candidates and writes pending JSON for operator review; it does not auto-file
  - `src/sources/live-pre-submission.ts`: reads `approved_corrections` from filed-signals state and adds two notes to every daily prep run:
    1. `correctionScoreNote` — current count + leaderboard pts value
    2. `correctionOpportunityNote` — if ≥10:00 UTC, tells agent to switch to fact-checker corrections instead of filing weak candidates
- Why: corrections compound — each approved correction is 3× a raw signal, costs no filing slot, and earns more than filing a weak 6th candidate

### Priority 38: Quantum signal pre-submit audit hardening ✅ (2026-04-06)

**Problem:** Two real bugs in `src/filing/pre-submit-audit.ts` left `score_update_signal` fail-open and caused misclassification of non-quantum signals.

**Bug 1 — fail-open (fixed):** `scope_check`, `bitcoin_relevance_check`, `exact_claim_check`, and `reviewer_verifiability_check` were only enforced when `signalType === "quantum_signal"`. A `score_update_signal` bypassed all four checks even though the quantum beat contract required them for every quantum `pre_signal_validation`. Fixed by broadening the condition at line 667 to `signalType === "quantum_signal" || signalType === "score_update_signal"`.

**Bug 2 — misclassification (fixed):** `looksLikeQuantumSignal` used `if (extractSignalType(sourceArtifact)) return true` — truthy for any non-empty `signal_type` string. A non-quantum beat signal with any `signal_type` field set was routed into the quantum audit and hard-blocked with a misleading "must use beat_slug quantum" error. Fixed by narrowing the match to `"quantum_signal"` and `"score_update_signal"` only.

**Test updates (`tests/pre-submit-audit.test.js`):**
- Happy path `score_update_signal` fixture updated to include `scope_check`, `bitcoin_relevance_check`, `exact_claim_check`, `reviewer_verifiability_check` (required now that they are enforced).
- Three regression tests added: `scope_check` absent/failed blocks, `bitcoin_relevance_check` fails blocks, `exact_claim_check`/`reviewer_verifiability_check` both failed blocks.

**No other changes.** Existing score-range, ISO-8601, `proposed_new_score !== claimed_previous_score`, `duplicate_check_passed` consistency, `source_urls`/`url_checks` cross-check, readiness math, and fallback dataset checks were all correct and fully tested — not touched.

### Priority 39: Quantum dataset/state/reporting integration ✅ (2026-04-06)

**Problem:** Quantum validation understood score-update fields, but the repo had no shared live `data.json` fetch/cache layer, no persisted quantum-specific state, and no generated weekly DRI synthesis artifact. That left validation, filing history, and reporting disconnected.

**What shipped:**
- Added `src/filing/quantum-map.ts` as the shared quantum source-of-truth layer.
  - Fetches the canonical primary/fallback dataset URLs.
  - Falls back to the local sibling `quantum-visualizer/public/data.json` when live fetch is unavailable.
  - Caches the latest snapshot in `data/state/quantum-tracker.json`.
  - Derives score distribution, voiced counts, weighted sums, readiness metrics, and reconciliation flags against metadata.
- Wired `src/filing/pre-submit-audit.ts` to use the shared quantum snapshot loader and subject lookup instead of ad hoc dataset fetch/scan logic.
- Extended `src/filing/state.ts` so filed quantum signals and score updates are persisted into `data/state/quantum-tracker.json` with:
  - signal type
  - subject name
  - previous/new score
  - source URLs
  - map update status
  - pending/accepted/rejected tracking
- Weekly DRI synthesis generation was retired during the 2026-04-22 focus cleanup.
  The active loop keeps quantum-specific validation and intake, but does not emit a separate weekly reporting lane.

**Build-plan audit outcome:**
- Already implemented before this priority:
  - general scheduled runtime
  - candidate generation / queueing / approval flow
  - quantum pre-submit validation hardening
  - filed-signal history
- Still not closed end to end after this priority:
  - direct auto-filing to `aibtc.news` without the helper/manual signature step
  - quantum-specific source crawlers for bitcoin-dev / Delving / ePrint / BIP deltas
  - automated DRI tracker shell integration (`beat-filed`, `beat-accepted`, `data-update`) from repo runtime

### Priority 40: Canonical signal history store ✅ (2026-04-07)

**Problem:** Signal filing, outcome, and rejection data was split across three separate files (`filed-signals.json`, `data/outcomes/approvals/*.json`, daily `rejected-signals-*.json`), making it impossible to answer "what did we send on April 1?" or detect near-duplicate stories across filing sessions.

**What shipped:**
- `src/filing/signal-history.ts` — single canonical module managing `data/state/signal-history.json`.
  - One entry per `signalId`, newest first.
  - Fields: `signalId`, `candidateId`, `headline`, `beat`, `storyShape`, `filedAt`, `reportDate`, `outcome`, `resolvedAt`, `feedbackLabels`, `note`, `satsEarned`.
  - Normalized `outcome` values: `pending` | `brief_included` | `approved` | `rejected` | `cap_blocked` | `unknown`.
  - `toStoryShape()` — normalises headline to token string for near-duplicate detection.
  - `findDuplicateStory()` — Jaccard similarity on storyShape tokens (≥60% = duplicate); use before filing any candidate.
  - `appendSignalHistory()` — idempotent; called on every new filing.
  - `resolveSignalHistory()` — updates outcome when publisher verdict arrives.
  - `queryByDate()`, `queryByOutcome()`, `summariseDate()` — query helpers.
- Wired into `src/filing/state.ts` (`recordFiledSignal` appends on filing).
- Wired into `src/outcomes/checker.ts` (`runOutcomeChecker` resolves on outcome).
- `src/filing/migrate-signal-history.ts` — one-time migration that merges `filed-signals.json` + `outcomes/approvals/*.json` into the canonical store. Safe to re-run.
- `data/state/signal-history.json` bootstrapped with 14 historical entries: 1 brief_included, 5 approved, 7 rejected, 1 pending.
- Legacy files (`filed-signals.json`, `outcomes/approvals/*.json`) still written for backward compatibility; signal-history.json is the query target.

**Follow-up hardening shipped (2026-04-07):**
- `src/filing/signal-history.ts` now treats `data/state/signal-history.json` as filed-signal-only state.
  - Added `isFiledEntry()` predicate: an entry is only valid if `signalId` is a non-empty string and `filedAt` is a parseable datetime.
  - `readSignalHistory()` now auto-strips invalid entries on read and immediately re-saves the cleaned file.
  - `appendSignalHistory()` now throws early if `signalId` or `filedAt` is missing/invalid with an explicit error: candidates and drafts must not be written to `signal-history.json`.
- `data/state/signal-history.json` was cleaned to keep only real filed signals; invalid null-`signalId` / null-`filedAt` draft rows were removed.
- `src/filing/filing-gate-validator.ts` now fail-closes more aggressively before anything can be treated as filing-ready.
  - headline exact-anchor enforcement (`gate_headline_no_anchor`)
  - concrete source enforcement from canonical payload sources (`gate_sources_missing`, `gate_sources_not_concrete`)
  - concrete disclosure enforcement with vague-phrase rejection and named model/tool/endpoint/URL/PR requirement (`gate_disclosure_missing`, `gate_disclosure_vague`, `gate_disclosure_not_concrete`)
  - disallowed draft-state language enforcement across headline, structured template fields, and canonical analysis/body (`gate_draft_language`) for terms like `backup`, `placeholder`, `rough`, `idea`, `working set`, `probably`, `maybe`, and `should review`
- Current note: Q1-Q4 are now deprecated compatibility fields, so older `tests/filing-gate-validator.test.js` cases that expect Q1-Q4 failures to hard-block are stale. Do not use those failures as evidence that Q1-Q4 should regain authority.
- 2026-04-21 hard-block additions in the same validator:
  - metric-heavy claims cannot use homepage-level or repository-root sources (`gate_homepage_metric_source`)
  - closed PR pages cannot prove shipped changes (`gate_closed_pr_as_proof`)
  - quantum proposal-thread-only and PR-page-only source sets are blocked unless durable state artifacts are present (`gate_quantum_proposal_thread_only`, `gate_quantum_pr_page_only`)
  - saturated quantum clusters need an AIBTC-native operator angle (`gate_quantum_saturated_cluster`)
  - duplicate same-day source clusters and bodies above 900 characters are blocked (`gate_duplicate_same_day_source_cluster`, `gate_body_above_900_chars`)
- `src/filing/filing-ready-append.ts` is now the single trusted append-only write path for filing-ready artifacts.
  - Runs `validateFilingGate(rawSubmission)` before any I/O and throws `FilingReadyValidationError` with hard blockers on failure.
  - Rejects overwrite attempts with `FilingReadyConflictError` if `data/filing-ready/{reportDate}/{candidateId}.json` already exists.
  - Stamps each written record with `appendedVia: "filing-ready-append"` so provenance is auditable.
- `src/filing/approve.ts` now writes through the append helper instead of direct `writeFile`.
- `tests/filing-ready-append.test.js` adds 8 passing tests covering valid writes, provenance stamping, validator failures with no file write, append-only conflict behavior, and standard blocker formatting.
- Net effect: a signal with a real UUID/timestamp but weak headline, vague sources, or vague disclosure is now blocked at the filing gate instead of slipping through as "technically formed."

---

## Do Not Redo
Future implementation chats should not spend time rebuilding or "re-deciding" the following unless a user explicitly asks for it.

- do not reintroduce `-prep.md` filenames
- do not re-add LLM/API dependence to the scheduled default path
- do not rebuild the dated file contract
- do not replace `memory/learnings.md` as the human log
- do not treat approval alone as success; `brief_included` is the real win signal
- do not keep weak filler candidates just to reach six
- do not re-add drafting authority to `signal-job`; fileable candidates must come through `create-signal` and `validate-artifact`
- do not re-add Q1-Q4 authority as a parallel engine in `signal-job`, helper UI, or audit code
- do not re-add `fetchLiveBtcPrice`, `extractBtcSpotClaim`, `isPriceClaimStale` to `news-source-fetcher.ts` — already implemented
- do not re-add `hasVagueDisclosure` or `isCircularSourcing` to `helper-server.ts` — already in the signal-guard endpoint
- do not add x402 paid endpoints to `apiSnapshots` without wallet authorization being enabled first

## Handoff Rule
When continuing work from this file:

1. Read `Current Coded State`
2. Read `Current Priority Order`
3. Pick the first unfinished priority item
4. Update this document when that priority materially changes
5. Do not start lower-priority work while a higher-priority blocker is still open unless the user explicitly asks

## One-Line Mission
Build the smallest deterministic agent that learns from real publishing outcomes, carries those lessons as runtime state, and files only high-probability brief-winning signals.

### Implemented docs and templates
- `docs/daily-docs-map.md` defines the daily prep task contract
- `docs/daily-signal-job.md` defines the signal task contract
- `data/reports/daily/TEMPLATE.md` defines the daily prep report structure
- `data/reports/daily-input/TEMPLATE.md` defines the lean manual daily outcome intake format
- `data/reports/signals/TEMPLATE.md` defines the signal report structure
- `data/briefs/README.md` defines brief artifact storage rules

### Implemented file contracts
- daily prep output file: `data/reports/daily/YYYY-MM-DD.md`
- manual outcome intake file: `data/reports/daily-input/YYYY-MM-DD.md`
- brief artifact file: `data/briefs/YYYY-MM-DD.md`
- signal output file: `data/reports/signals/YYYY-MM-DD.md`
- mandatory outcome board file: `data/state/outcome-boards/YYYY-MM-DD.json`
- the same active local cycle date must be used across all dated artifacts

### Memory Model

Four layers in order of authority. Read this before touching any state file.

| Layer | File(s) | Role |
|---|---|---|
| Primary runtime memory | `data/state/editorial-memory.json` | The brain. Read by every runtime step — daily-prep, signal-job, scoring, filing preflight. Do not bypass. |
| Daily outcome board | `data/state/outcome-boards/YYYY-MM-DD.json` | Mandatory pre-draft board for open beats, crowded beats, duplicate clusters, recent rejection reasons, latest winner shape, and helper failures. `create-signal` must fail closed when today's board is missing. |
| Normalized outcome memory | `data/state/outcome-feedback-memory.json` | Machine labels from real publisher responses (e.g. `body_missing`, `beat_cap`). Feeds into editorial-memory on refresh. Managed by `src/learning/outcome-feedback.ts`. |
| Filing/history memory | `data/state/signal-history.json` | Canonical filed-signal ledger. One real filed signal per entry. Used for duplicate checks, outcome lookup, and learning. |
| Compatibility outcome mirrors | `data/state/filed-signals.json`, `data/outcomes/approvals/*.json`, `data/training/` | Legacy/backward-compatible inputs while migration finishes. Do not treat these as the canonical ledger when `signal-history.json` exists. |
| Readable archive | `memory/learnings.md` | Human-readable audit log. Written by daily-prep when lessons are confirmed. Not a runtime dependency. Do not read this instead of `editorial-memory.json` at runtime. |

**Rule:** new runtime behavior reads `editorial-memory.json` first and `signal-history.json` for filed-signal history. Use `filed-signals.json` only as a compatibility mirror. Never make runtime decisions by reading `memory/learnings.md` directly.

### Implemented runtime/documentation behavior
- daily prep and signal work are documented as separate tasks
- signal work depends on daily prep outputs for the same cycle date
- signal work should stop if the daily prep report or brief artifact is missing
- `data/state/editorial-memory.json` is the current structured editorial brain
- `data/state/memory-index.json` records the authority order of repo memory so future chats do not confuse docs with runtime memory
- `data/state/outcome-feedback-memory.json` stores normalized outcome-feedback labels and repeated label patterns
- `data/state/repairable-candidates.json` stores publisher-feedback repair contracts for fix-and-resubmit signals
- `src/prep/create-signal.ts` owns canonical filing artifact creation, Q1-Q4 rationales, winner checks, headline anchor checks, and source-object enforcement
- `src/filing/validate-artifact.ts` validates canonical artifacts and powers `npm run validate-artifact -- <file>`
- `src/prep/signal-job.ts` loads structured editorial memory before reporting and acts as an adapter around validated artifacts
- `src/prep/signal-job.ts` blocks `resubmission_for_signal_id` candidates unless a recorded repair contract exists and the revised draft satisfies its required fixes
- `src/agent/run-daily.ts` refreshes editorial memory during `agent-daily`
- `src/learning/runtime-memory.ts` is the shared sync path that refreshes runtime memory after source-of-truth writes
- outcome records now carry normalized `feedbackLabels` so repeated failures do not depend only on fuzzy prose matching
- repeated rejection patterns are promoted into explicit pre-filing checks
- promoted checks are written back into `memory/learnings.md` under `## Promoted Filing Checks`
- `src/prep/daily-prep.ts` now supports optional manual outcome intake from `data/reports/daily-input/YYYY-MM-DD.md`
- when a manual outcome file exists, daily prep parses: brief winners, in-brief, rejected, top 6, and Valiant rank
- manual outcome intake writes compact durable lessons to `memory/learnings.md`, updates the dated signal report with a `Daily outcome intake` section plus detected winning categories, and refreshes `data/state/editorial-memory.json`
- confirmed filed-signal statuses belong in `data/state/signal-history.json`
- `data/state/filed-signals.json` remains a compatibility mirror while older paths are migrated
- inferred statuses belong in the daily report only until confirmed
- durable lessons belong in `memory/learnings.md`
- `memory/learnings.md` is the human-readable archive/explanation layer, not the source-of-truth runtime memory store

**Skill/runtime enforcement — partial implementation exists, but parity work is still active:**
- Publisher, Fact-Checker, Correspondent, and helper rules are partially wired into runtime code.
- Do not re-add the already-implemented checks listed below.
- Do not assume enforcement parity is finished; follow the current priority order above for remaining alignment, audit, and validation work.
- Current tested state:
  - duplicate-first gating is implemented
  - same-day memory refresh is implemented
  - leaderboard/streak operating constraints are implemented
  - pre-submit audit is implemented
  - replay validation exists for April 2 vs April 3
- Still not safe to describe as universally “complete”:
  - helper/editorial parity is still an explicit priority item
  - older queue/scoring paths still need canonical artifact compatibility cleanup
  - full `npm test` is not yet green

### Implemented code paths
- `src/prep/daily-prep.ts` exists
- `src/prep/create-signal.ts` exists and is the canonical creation layer for fileable artifacts
- `src/prep/signal-job.ts` exists
- `src/agent/run-daily.ts` wires both steps into the agent-daily runtime path
- `src/learning/editorial-memory.ts` compiles structured editorial memory from durable lessons
- `src/learning/outcome-feedback.ts` normalizes live outcome feedback into stable machine labels
- `src/learning/repair-memory.ts` stores and verifies repair contracts derived from actual rejection messages
- `src/learning/register-repair-feedback.ts` records a repair contract from a pasted publisher rejection message
- `src/learning/runtime-memory.ts` syncs `editorial-memory.json`, `outcome-feedback-memory.json`, and `memory-index.json`
- `src/sources/news-source-fetcher.ts` fetches RSS feeds and API snapshots; now also fetches live BTC price once per run for price-claim verification
- `src/filing/helper-server.ts` serves the Xverse helper app and the `/api/local/signal-guard` submission gate
- daily prep and signal job now use `data/reports/daily/YYYY-MM-DD.md`, not the old `-prep.md` suffix

**Canonical creation functions (2026-04-15) — do not duplicate elsewhere:**
- `createSignalArtifact()` in `src/prep/create-signal.ts` — creates the validated filing artifact and owns Q1-Q4, headline anchor, source-object, winnerCheck, and body/analysis compatibility behavior
- `validateArtifact()` in `src/filing/validate-artifact.ts` — validates canonical artifact shape, filing gate, headline anchor, source objects, body/template structure, and gate/payload consistency
- `artifactIssuesToBlockers()` in `src/filing/validate-artifact.ts` — converts artifact validation issues into hard-block strings for filing-ready writes and repair loops
- `appendFilingReadyArtifact()` in `src/filing/filing-ready-append.ts` — single trusted append-only write path for `data/filing-ready/`; now requires full artifact validation before I/O

**Functions added to `src/sources/news-source-fetcher.ts` (2026-04-03) — do not re-add:**
- `fetchLiveBtcPrice()` — fetches BTC/USD from mempool.space once per run
- `extractBtcSpotClaim(hardNumber)` — parses a claimed BTC spot price from the hard number field
- `isPriceClaimStale(claimedPrice, livePrice)` — returns true if >2% off live price
- `buildNewsEvent()` now accepts `liveBtcPrice: number | null` and sets `usesDashboardAsPrimarySource: true` when price claim is stale
- `"x402"`, `"payment rail"`, `"agent payment"`, `"agent wallet"` added to `highSignalTerms`

**Functions added to `src/filing/helper-server.ts` (2026-04-03) — do not re-add:**
- `hasVagueDisclosure(body)` — same vague disclosure check at submission time
- `isCircularSourcing(sources)` — rejects submissions where all sources are internal/oracle-only
- `/api/local/signal-guard` response now includes `vagueDisclosure` and `circularSourcing` in the `checks` object

### Important current limitation
- `signal-job` now acts as an adapter/reporting layer around validated artifacts; do not move drafting truth back into it
- candidate generation now marks intermediates non-fileable and creates artifacts through `create-signal`, but older queue/scoring paths still need canonical artifact compatibility cleanup before the full suite is green
- keep the core scheduled workflow non-LLM by default

### Current prompts/workflow status
- a reusable daily prep prompt exists and should target `npm run daily-prep YYYY-MM-DD`
- a reusable signal prompt exists and should target `npm run signal-job YYYY-MM-DD`
- both prompts must use the active local cycle date
- the signal prompt must gate on:
  - `data/reports/daily/YYYY-MM-DD.md`
  - `data/briefs/YYYY-MM-DD.md`

### Recent Changes

#### 2026-04-06 — Filing helper hardened against April 5 workflow failures

**`src/filing/helper-server.ts`**
- Added `syncEditorialMemoryCycleDate()` — runs at startup, reads `data/state/editorial-memory.json`, compares `currentCycle.reportDate` to today's Pacific date, auto-corrects and logs a `WARN` if stale. Fixes the April 5 failure where the cycle marker stayed on `2026-04-04` and blocked all filings for the day until manually corrected.
- Added `EADDRINUSE` handling — `server.on("error")` now catches port-in-use at startup and exits with the exact kill command (`lsof -ti tcp:4173 | xargs kill -9`) plus restart instruction. Fixes the April 5 failure where `npm run filing-helper` silently failed or hung because a detached background process was already holding port 4173.
- Added `GET /api/local/health` endpoint — returns `{ ok, startedAt, pacificDate, pid, port }`. Enables the browser to detect stale-code or wrong-date server on page load. Fixes the April 5 failure where the browser was talking to an old helper process without knowing it.
- Added 30-second `AbortController` timeout to `proxyJsonRequest` — upstream `fetch` call now aborts if the API hangs, rather than waiting indefinitely. Fixes the April 5 failure where "Submitting signal to AIBTC…" could sit for several minutes because the proxy had no timeout.
- Added `writeFile` to `node:fs/promises` imports (required by `syncEditorialMemoryCycleDate`).

**`tools/xverse-register/file-signal.html`**
- Added `TIMESTAMP_TTL_SECONDS = 90` constant and `timestampRefreshedAt` tracking — `refreshTimestamp()` now records when the timestamp was last set.
- Added timestamp expiry guard in `submitCurrentPayload()` — checks `nowSecs - tsValue > 90` before every submit; if expired, clears `btcSignature`, disables Submit, and shows the exact re-sign instruction. Fixes the April 5 failure where a stale auth envelope caused `EXPIRED_TIMESTAMP` errors that made valid payloads look broken.
- Immediate signal-ID status update — `setStatus("API accepted — signal id: <id>. Saving to local filing state...")` is now set as soon as the API responds (before the local persistence step). Fixes the April 5 failure where the UI was stuck on "Submitting signal to AIBTC…" even after the API had returned `201`.
- Added `checkHelperHealth()` — called on page init; fetches `/api/local/health` and shows a warning if the server's `pacificDate` differs from the browser's Pacific date, catching stale-server and wrong-date mismatches before the operator reaches the sign step.

**What is NOT done yet (follow-on)**
- ~~`npm run filing-helper` still does `npm run build && node dist/filing/helper-server.js` — there is no automatic kill of the old process before re-binding. The EADDRINUSE message now surfaces the kill command, but the script does not auto-kill. A pre-start `lsof`/`kill` step in `package.json` would remove the manual step entirely; deferred.~~ **Done 2026-04-06** — see below.
- ~~Timestamp countdown in the UI — the expiry guard blocks submission after 90s, but there is no live countdown showing how many seconds remain. A `setInterval` display would help operators know when to re-sign; deferred.~~ **Done 2026-04-06** — see below.

---

#### 2026-04-06 — Filing helper hardened further; editorial-memory drift fixed at the root

**Root cause fixed: `src/learning/editorial-memory.ts`**
- `currentCycle.reportDate` was derived from `latestReportDateFromExamples()`, which extracts dates from source file path strings like `"data/state/brief-winners-2026-04-04.json"`. Every `refreshEditorialMemory()` call (from `daily-learn`, `daily-prep`) permanently reset the cycle date to the last brief's date, overwriting any correction the helper's startup sync had made. The startup sync was a band-aid that got undone by any background job.
- Fix: `currentCycle.reportDate` now calls `getPacificReportDate()` at generation time — always today's Pacific date. `currentBrief.reportDate` still uses the example-derived date, which correctly reflects the last published brief.
- Import added: `import { getPacificReportDate } from "../utils/report-date.js"`.

**`src/filing/helper-server.ts`**
- `syncEditorialMemoryCycleDate()` condition changed from `current !== today` to `current < today`. The previous check could regress the date (e.g. overwrite a future date with today) on a timezone or race edge case. The function now acts as a one-way ratchet: it only advances, never regresses.

**`tools/xverse-register/file-signal.html`**
- `TIMESTAMP_TTL_SECONDS` increased from 90 to 270 (4.5 minutes). 90s was too tight: the guard check before Xverse plus Xverse approval could exceed it in normal use, causing false `EXPIRED_TIMESTAMP` blocks.
- Second `refreshTimestamp()` call added immediately before `signMessage` is sent to Xverse. The first call (at the top of the sign handler) gives visual feedback; the second call fires after the guard check passes and just before the Xverse dialog opens, so the signed message is as fresh as possible.
- `clearExpiryCountdown()` and `startExpiryCountdown()` added. `startExpiryCountdown()` starts a 5-second interval after `submitBtn` is enabled. The countdown warns in the status bar when ≤ 60s remain, switches to error styling at ≤ 30s, and auto-clears the signature and disables Submit at 0 with a "re-sign" prompt. `clearExpiryCountdown()` is called in `refreshTimestamp()` (signature cleared) and immediately when the 201 is received (signal in).
- `submitCurrentPayload()` now calls `clearExpiryCountdown()` and `setStatus("API accepted — signal id: <id>")` the instant `returnedSignalId` is extracted from the upstream body — before the local persistence step. All three exit paths (persist OK, persist failed, no candidateId) keep the signal ID in the status string. The persist failure is styled as a warning (action needed) but does not hide the accepted ID.

**`package.json`**
- Added `npm run restart-filing-helper`: `lsof -ti tcp:4173 | xargs kill -9 2>/dev/null; npm run filing-helper`. Sends SIGKILL directly to the PID listening on 4173 (not just the npm parent), then rebuilds and starts. The `;` separator ensures the helper starts even if no prior process was found. Removes the manual kill step that was required after every EADDRINUSE error.

---

#### 2026-04-07 — Beat-keyed lesson write-back added to daily-prep

**`src/prep/daily-prep.ts`**
- Added `writeBackBeatLessons(root, reportDate, lessonsAdded, categories)` — after `appendDurableLessons` writes confirmed lessons to `memory/learnings.md`, this function classifies each lesson by beat keyword (`infrastructure`: cve/nonce/relay/patch/vulnerability/security/dependency/wallet bug/api update/merge/PR #/issue #; `quantum`: quantum/bip-360/ecdsa/whitepaper/cryptography/post-quantum) and writes matching lessons into `beatLessons[beat][]` in `data/state/editor-memory.json`. Deduplicates by exact lesson string. First-run safe (missing file starts from `{}`).
- Wired into `applyManualOutcomeLoop()` — called after `refreshEditorialMemory(root)`, passes `lessonsAdded` and `categories` from the same cycle.

---

#### 2026-04-08 — Runtime enforcement pass: template alignment, canonical history, direct brief context, and operator handoff fix

**Architecture clarification**
- `docs/build-plan.md` is the runtime architecture and operating-contract source. It defines how the agent should behave and what the pipeline must enforce.
- `docs/build-plan.md` is **not** a candidate-content source. Do not mine it for signal ideas, headlines, or factual claims.
- Signal candidates must be shaped and checked against:
  - `data/config/signal-template.json`
  - `data/briefs/shared-context.json`
  - `data/state/signal-history.json`
- Brief context is used to test novelty, winner-shape fit, and anti-duplication. The signal template is used to determine whether a candidate is structurally filing-ready.

**Completed in this pass**

**`src/filing/template-rules.ts`**
- Added a shared rule module that loads `data/config/signal-template.json`.
- Centralized template helpers so `signal-job.ts` and `signal-guard.ts` stop drifting on framework, anchor, disclosure, directive, and tag-limit logic.
- Exported shared checks including:
  - `loadSignalTemplate`
  - `hasExactHeadlineAnchor`
  - `hasFrameworkAAnalysis`
  - `hasFrameworkBAnalysis`
  - `hasTemplateAnalysis`
  - `hasTerminalDirective`
  - `hasVagueDisclosure`
  - `hasConcreteDisclosureAnchors`
  - `tooManyTags`

**`src/filing/signal-guard.ts`**
- Rewired final validation to import shared template helpers from `template-rules.ts` instead of maintaining a separate rule copy.
- Result: final filing validation now follows the machine-readable signal template more directly and stays aligned with pre-draft checks.

**`src/prep/signal-job.ts`**
- Rewired pre-draft checks to use the shared template rule layer.
- Added explicit pre-draft Q2 headline-anchor kill: candidates whose headline lacks a specific anchor such as PR number, issue number, version, block height, sat amount, or endpoint are rejected before scoring.
- Replaced the older loose substantive-analysis heuristic with strict template-framework enforcement:
  - Framework A: `CLAIM / EVIDENCE / IMPLICATION / Directive`
  - Framework B: `What changed / What it means / What to do`
- Added hard tag-count enforcement: more than 2 tags is a rejection reason.
- Fixed operator handoff report generation:
  - only accepted candidates are shown in numbered operator slots
  - empty slots are shown as `slot_empty`
  - rejected candidates are moved to an unnumbered appendix marked non-actionable
- `signal-job` now reads direct brief-learning and outcome-memory inputs for same-cycle decision support:
  - `data/briefs/shared-context.json`
  - `data/state/signal-history.json`
- `signal-job` now writes a context snapshot to:
  - `data/context-runs/YYYY-MM-DD/signal-job.json`
- Added first-pass auto-materialization of candidate artifacts when `data/manual-submissions/YYYY-MM-DD/` is empty by calling `src/prep/candidate-generator.ts`.

**`src/prep/candidate-generator.ts`**
- Added a first-pass autonomous candidate-materialization path.
- Current behavior:
  - reads `data/dry-runs/YYYY-MM-DD/*-submission.json`
  - converts those dry-run submissions into candidate artifacts in `data/manual-submissions/YYYY-MM-DD/`
  - shapes generated analysis toward the signal template structure so candidates are closer to filing-ready before `signal-job` validates them
- Important status:
  - this is an intermediate implementation, not the final end-state generator
  - the generator still depends on dry-run submission artifacts as upstream inputs
  - it does **not** mean build-plan content is used as candidate content
  - the desired end state remains: `daily-prep` handoff + live repo truth + brief context + signal history + signal template drive candidate generation directly

**`src/prep/daily-prep.ts`**
- Added direct read of `data/briefs/shared-context.json`.
- Added direct read of canonical filed-signal outcomes via `data/state/signal-history.json`.
- Added machine handoff JSON output:
  - `data/reports/daily/YYYY-MM-DD.json`
- The handoff now includes structured context such as:
  - brief occupied lanes
  - shared-context winner/loser patterns
  - recent signal-history outcomes
  - generation priorities and pending signals
- This closes an important gap: `shared-context.json` now enters the runtime earlier through `daily-prep`, not only indirectly through compiled learning memory.

**`src/agent/run-daily.ts`**
- Reordered the runtime so candidate discovery/dry-run work happens before `signal-job`.
- This allows auto-materialization to use same-cycle dry-run submission artifacts before validation/handoff.

**`src/learning/build-plan-memory.ts` + runtime memory**
- Added first-pass build-plan compilation to `data/state/build-plan-memory.json`.
- Added build-plan memory refresh to `src/learning/runtime-memory.ts`.
- Elevated build-plan memory in the runtime memory index so the architecture instructions are more visible to the runtime.
- Important scope note:
  - this compiled build-plan memory exists to reinforce runtime architecture and operating rules
  - it is **not** a candidate-content generator
  - the signal template remains the signal-shape rule source

**Tests completed**
- Added regression coverage in `tests/runtime-enforcement.test.js` for:
  - accepted-only numbered operator slots
  - rejected appendix behavior
  - template loading
  - Framework B acceptance
  - Q2 headline-anchor kill
  - tag-count kill
- Updated `tests/signal-guard.test.js` to match shared-template enforcement behavior.

**Status summary for this pass**
- completed: shared signal-template rule layer in runtime code
- completed: `signal-job` / `signal-guard` template parity
- completed: operator handoff fix for rejected vs actionable candidates
- completed: direct use of `shared-context.json` inside `daily-prep`
- completed: direct use of `signal-history.json` in `daily-prep` and `signal-job`
- completed: first-pass context persistence for `signal-job`
- completed: first-pass build-plan compilation for runtime architecture memory
- partial: autonomous candidate generation
  - reason: candidate artifacts can now be auto-materialized from dry-run submissions, but generation is not yet fully driven from the structured daily-prep handoff alone
- not completed: fully handoff-native deterministic generation of the final six candidates
- not completed: full semantic execution of every rule in `docs/build-plan.md`

---

#### 2026-04-03 — x402 skill gap fixed in source filter; paid data sources documented

**`src/sources/news-source-fetcher.ts`**
- Added `"x402"`, `"payment rail"`, `"agent payment"`, `"agent wallet"` to `highSignalTerms` in `isLikelyPublisherValuable()`. Bug: x402 was already in `includeKeywords` for every RSS feed so items would pass the first filter, but x402 wasn't in `highSignalTerms` so they were silently dropped by the publisher-value gate. Any RSS item mentioning x402 now survives to become a candidate.

**x402 architectural gap — not implemented yet, requires wallet authorization:**
- `x402.biwas.xyz` provides live Zest/ALEX pool analytics, market data, and wallet analysis via paid endpoints. These are better data sources for `bitcoin-yield` and `agent-trading` beats than CoinGecko/DexScreener, but executing them requires STX payment from an unlocked wallet. Per AGENTS.md, wallet/signing actions are human-only. These endpoints belong in `apiSnapshots` once wallet automation is enabled.
- When ready: add entries to `data/config/monitored-sources.json` under `apiSnapshots` for `x402.biwas.xyz` pool and market endpoints, and wire `execute_x402_endpoint` into the snapshot fetcher path.

---

#### 2026-04-03 — Correspondent and fact-checker skills wired into candidate finding

**`src/sources/news-source-fetcher.ts`**
- Added `fetchLiveBtcPrice()` — fetches BTC/USD from mempool.space once per run before scanning feeds. Implements fact-checker skill requirement: verify price claims against live data, not cached sources.
- Added `extractBtcSpotClaim()` and `isPriceClaimStale()` — when a candidate's hard number is a BTC spot price claim ($20k–$200k range), checks it against the live price. If >2% off (fact-checker tolerance threshold), sets `usesDashboardAsPrimarySource: true`, which fails the existing dashboard-source gate and removes the candidate from the queue.
- Price verification is logged per candidate so the stale-data pattern is visible in run output.

**Superseded creation-path note**
- These correspondent checks were originally wired through `src/prep/signal-job.ts`.
- As of 2026-04-15, fileable creation authority belongs in `src/prep/create-signal.ts` plus `src/filing/validate-artifact.ts`.
- Do not add new correspondent/fact-checker creation gates as independent `signal-job` drafting authority.

**Why:** The `aibtc-news-fact-checker` and `aibtc-news-correspondent` skills were installed but not influencing candidate discovery or validation. The fact-checker's 2% price tolerance and the correspondent's coverage memory check and pre-flight number requirement were being skipped entirely. These changes make the installed skill criteria runtime-enforced rather than advisory.

---

#### 2026-04-03 — Publisher skill pre-screen wired into signal-job and signal-guard

**Superseded creation-path note**
- Publisher checks were originally pre-screened in `src/prep/signal-job.ts`.
- As of 2026-04-15, Q1-Q4 authority is canonical in `src/prep/create-signal.ts`.
- `signal-job` may report, rank, or block invalid artifacts, but it should not own a second Q1-Q4 drafting engine.

**`src/filing/helper-server.ts`**
- Added `hasVagueDisclosure(body)` — same vague disclosure detection applied at submission time in the `/api/local/signal-guard` endpoint. Blocker message tells the submitter exactly what to fix.
- Added `isCircularSourcing(sources)` — flags submissions where all sources resolve to internal/oracle-only domains (`aibtc.com`, `aibtc.news`, `localhost`) or where sources carry no external URLs. Implements publisher circular sourcing auto-reject.
- Both checks added to the `blockers` array and surfaced as `vagueDisclosure` and `circularSourcing` keys in the `checks` response object.

**Why:** The `aibtc-news-publisher` skill was installed but not connected to any runtime enforcement. These changes apply its two most specific auto-reject rules — vague disclosure and circular sourcing — plus its primary mission-alignment gate, at the two points where filtering has the most leverage: before a candidate enters the queue (signal-job) and before a human submits via the helper app.

---

### Done
- docs and templates for daily prep and signal work are in place
- dated file contracts are standardized
- filename mismatch from `-prep.md` to `.md` was corrected
- `src/prep/daily-prep.ts` rewritten as deterministic non-LLM: builds `data/reports/daily/YYYY-MM-DD.md` without any API call and now treats `signal-history.json` as canonical filed history when available
- `src/prep/daily-prep.ts` extended with a first-pass manual outcome-intake loop: reads `data/reports/daily-input/YYYY-MM-DD.md`, appends compact lessons to `memory/learnings.md`, updates `data/reports/signals/YYYY-MM-DD.md`, and refreshes `data/state/editorial-memory.json`
- `src/prep/signal-job.ts` rewritten as non-LLM: gates on prep report + brief, validates queued candidates, writes signal report to `data/reports/signals/YYYY-MM-DD.md`
- neither script requires `ANTHROPIC_API_KEY` to run
- `memory/learnings.md` read first in daily prep — warns loudly if missing
- `data/reports/daily/TEMPLATE.md` now required — exits early if missing
- `data/reports/daily-input/TEMPLATE.md` added so the manual outcome loop has a stable dated input contract
- write-back: confirmed statuses should land in `data/state/signal-history.json`; `data/state/filed-signals.json` remains compatibility state for older paths
- write-back: durable lessons appended to `memory/learnings.md`
- `memory/` added to `git add` block in `agent-daily.yml` so learnings persist in CI
- CLI entrypoints added: `npm run daily-prep YYYY-MM-DD` and `npm run signal-job YYYY-MM-DD` both execute
- `npm run check` — clean, no TypeScript errors
- regression coverage added in `tests/daily-prep.test.js` for manual outcome intake → learnings write-back → signal report update → editorial-memory refresh
- reusable daily prep and signal prompts defined
- **publisher/fact-checker/correspondent enforcement foundations** — key gates exist in `create-signal.ts`, `validate-artifact.ts`, `signal-guard.ts`, `news-source-fetcher.ts`, queue gating, and pre-submit audit, but full parity is governed by the current priority order rather than assumed complete
- **x402 filter fix** — x402/payment-rail terms added to `highSignalTerms` so RSS items are no longer silently dropped after passing `includeKeywords` (2026-04-03)
- **signal-template runtime layer** — shared template rules now load from `data/config/signal-template.json` via `src/filing/template-rules.ts`, and are used by `src/prep/create-signal.ts`, `src/filing/validate-artifact.ts`, `src/prep/signal-job.ts`, and `src/filing/signal-guard.ts`
- **operator handoff fix** — `signal-job` now shows only accepted candidates in numbered slots, renders missing slots as `slot_empty`, and moves rejected candidates into a non-actionable appendix
- **direct brief-context integration** — `src/prep/daily-prep.ts` now reads `data/briefs/shared-context.json` directly and writes a machine handoff JSON at `data/reports/daily/YYYY-MM-DD.json`
- **canonical outcome-memory integration** — `src/prep/daily-prep.ts` and `src/prep/signal-job.ts` now read `data/state/signal-history.json` directly as part of same-cycle decision support
- **context persistence (first pass)** — `src/prep/signal-job.ts` now writes `data/context-runs/YYYY-MM-DD/signal-job.json`
- **build-plan runtime memory (first pass)** — `src/learning/build-plan-memory.ts` compiles `docs/build-plan.md` into `data/state/build-plan-memory.json` for architecture-memory use
- **candidate auto-materialization (artifact path)** — `src/prep/candidate-generator.ts` can create validated `create-signal` artifacts from `data/dry-runs/YYYY-MM-DD/*-submission.json` when `data/manual-submissions/YYYY-MM-DD/` is empty
- **non-fileable intermediate markers** — serialized dry-run submission packages and backfilled generated submissions now carry `non_fileable: true`, `fileable: false`, `intended_use: "ranking_only"`, and `canonical_artifact_required: "create_signal_artifact"`
- **artifact validation layer** — `src/filing/validate-artifact.ts` and `npm run validate-artifact -- <file>` enforce the canonical artifact shape before anything is considered filing-ready
- **build-plan role clarified** — `docs/build-plan.md` is architecture/operating guidance for the runtime; it is not a source of candidate facts or story generation

### Not done yet
- **queue/scoring compatibility with artifact-first creation** — generated intermediates are now explicitly non-fileable and candidate-generator creates validated artifacts, but older queue/scoring tests and code paths still need to consume canonical artifacts instead of assuming raw dry-runs can promote directly
- **brief artifact automation** — `data/briefs/YYYY-MM-DD.md` still requires manual placement before signal-job can run
- **x402 paid data sources** — `x402.biwas.xyz` pool/market endpoints not yet in `apiSnapshots`; deferred until wallet automation is enabled (see x402 architectural gap note in Recent Changes)
- **full build-plan semantic enforcement** — `data/state/build-plan-memory.json` exists, but not every build-plan rule is yet mapped to an explicit runtime enforcement point
- **full context persistence across all stages** — first-pass context snapshots exist for `signal-job`, but end-to-end persistence across every stage is not finished
- **full test-suite cleanup** — focused creation/filing tests pass, but full `npm test` still has older fixture/export/queue/scoring failures

### Where an agent should look before continuing the build
Read these in order so future work starts from repo truth, not chat memory:

- `README.md`
  - start here for repo-level setup and operating expectations
- `AIBTC-AGENTS.md`
  - read this before changing behavior; it defines the local agent workflow and constraints
- `docs/build-plan.md`
  - this file is the current strategy and implementation-state summary
- `docs/prd.md`
  - product intent, scope, and higher-level requirements
- `docs/daily-docs-map.md`
  - daily prep task contract and required report shape
- `docs/daily-signal-job.md`
  - signal task contract and expected output behavior
- `data/reports/daily/TEMPLATE.md`
  - exact daily prep report structure
- `data/reports/signals/TEMPLATE.md`
  - exact signal report structure
- `data/briefs/README.md`
  - dated brief artifact rules and supported brief file formats

Current runtime entrypoints and code paths:

- `src/agent/run-daily.ts`
  - main scheduled runtime that wires prep, signal generation, queueing, operator summary, and stability checks
- `src/prep/daily-prep.ts`
  - deterministic daily prep implementation; creates the dated daily report and brief placeholder behavior
- `src/prep/signal-job.ts`
  - adapter/reporting step around validated artifacts; it should not own fileable drafting truth
- `.github/workflows/agent-daily.yml`
  - scheduled CI path for the daily autonomous loop
- `package.json`
  - source of truth for runnable commands such as `npm run daily-prep YYYY-MM-DD`, `npm run signal-job YYYY-MM-DD`, and `npm run agent-daily`

Current state and artifacts to inspect before changing runtime logic:

- `data/state/filed-signals.json`
  - compatibility mirror for older filing/outcome state paths
- `data/state/signal-history.json`
  - canonical filed-signal ledger and duplicate/outcome history
- `memory/learnings.md`
  - durable lessons that daily prep reads first
- `data/reports/daily/YYYY-MM-DD.md`
  - recent daily reports show the currently expected output shape in practice
- `data/reports/signals/YYYY-MM-DD.md`
  - recent signal reports show current blocked behavior and future target output location
- `data/briefs/YYYY-MM-DD.md`
  - required brief artifact for same-cycle signal work
- `data/briefs/YYYY-MM-DD.json`
  - richer manual brief ingest artifact when available
- `data/reports/operator/YYYY-MM-DD.md`
  - operator-facing handoff and manual actions
- `data/reports/stability/YYYY-MM-DD.md`
  - runtime health and failure visibility

Useful examples for implementing the remaining deterministic lane:

- `src/signals/infrastructure.ts`
  - existing signal-lane logic worth reusing before inventing new structures
- `src/types/candidate-signal.ts`
  - candidate signal contract
- `src/types/proof.ts`
  - proof contract
- `src/types/source.ts`
  - source contract
- `data/live-inputs/`
  - raw fetched examples and protocol-update inputs
- `data/live-inputs/snapshots/`
  - snapshot data for deterministic diff/anomaly work
- `data/logs/candidates/`
  - previously generated candidate examples
- `data/dry-runs/`
  - prior submission-package examples and dry-run outputs
- `data/filing-ready/`
  - strongest saved examples of filing-shaped output

Current repo truth about what remains:

- **the daily outcome board is now mandatory** — `data/state/outcome-boards/YYYY-MM-DD.json` must exist before `create-signal` can draft. It carries open beats, crowded beats, duplicate clusters, rejection reasons, winner shape, and helper failures.
- **hard do-not-draft rules are now runtime blockers** — homepage metric sources, closed PR proof, proposal-thread-only quantum sources, PR-page-only quantum sources, saturated non-AIBTC quantum clusters, duplicate same-day source clusters, and bodies above 900 characters are blocked in `create-signal`, `signal-guard`, and final filing-gate validation.
- **Q1-Q4 are deprecated compatibility fields** — do not restore Q1-Q4 as an authority path. The current authority path is `create-signal` + beat editors + winner/context checks + hard blockers.
- **legacy lane cleanup was completed for the active runtime surface** — the deterministic release/operator lane now runs through `src/signals/infrastructure.ts`, exports `runInfrastructureLane`, and is covered by `tests/infrastructure.test.js`; historical failure-memo data was intentionally left archived as-is.
- **brief handling is partially automated, but the same-cycle brief artifact contract must stay stable** — the board can be generated from available local inputs, but it does not replace `data/briefs/YYYY-MM-DD.md` when the brief itself is required.
- future agents should update this section whenever the source-of-truth files or runtime entrypoints change

### Next implementation tasks
Ordered from easiest / least-token work to harder work:

This section is now secondary.
If it conflicts with `Current Priority Order`, follow `Current Priority Order`.

- keep the dated file contract stable:
  - `data/reports/daily/YYYY-MM-DD.md`
  - `data/briefs/YYYY-MM-DD.md`
  - `data/reports/signals/YYYY-MM-DD.md`
  - why: future chats and runtime steps need one stable path pattern
  - objective output: all prep and signal code should read and write the same date-based files consistently

- update queue/scoring compatibility for canonical artifacts
  - why: the creation path is now canonical and intermediates are explicitly non-fileable, but some queue/scoring paths still expect raw dry-run submissions to be promotable
  - objective output: queue/scoring consumes validated `create_signal_artifact` records or keeps raw candidates ranked-only
  - unlocks: full-suite cleanup and simpler filing promotion logic

- clean up stale Q1-Q4 filing-gate tests
  - why: Q1-Q4 are now deprecated compatibility fields, but older tests still expect them to hard-block
  - objective output: `tests/filing-gate-validator.test.js` should assert current authority instead: template, winner/context audit, sources, disclosure, outcome board, and hard do-not-draft blockers

- automate brief artifact fetch
  - why: the pipeline still depends on the current brief existing before signal generation can run unattended
  - objective output: the runtime fetches or stores the current brief into `data/briefs/YYYY-MM-DD.md` before `signal-job` runs
  - unlocks: more unattended CI behavior and less daily operator input

### Blocked by
- older queue/scoring paths still assume pre-contract candidates
  - why this blocks progress: full `npm test` cannot go green until those paths either consume validated artifacts or explicitly handle non-fileable intermediates
  - blocked output: fully green repo-wide test suite

- `tests/filing-gate-validator.test.js` still contains legacy Q1-Q4 authority expectations
  - why this blocks progress: the validator intentionally ignores Q1-Q4 as hard blockers, so those tests fail until they are rewritten around the current gate contract
  - blocked output: fully green focused filing-gate suite

- `data/briefs/YYYY-MM-DD.md` still depends on manual brief placement unless the brief text is provided
  - why this blocks progress: same-cycle signal generation requires the same-cycle brief artifact
  - blocked output: unattended same-cycle prep + signal execution

- the full autonomous path still depends on missing external daily inputs
  - why this blocks progress: the repo cannot invent publisher responses, rankings, or brief text that were never captured
  - blocked output:
    - a truly unattended daily loop
    - reliable daily prep completeness
    - reliable signal-job completeness

## P31 — Active Beat Focus Audit (2026-04-07, superseded by 2026-04-22 contract)

### What was done

**Config audit (read-only verification)**
- Historical note: this audit was written when the strategy still used `infrastructure` + `quantum`.
- Current contract: active filing beats are `aibtc-network`, `bitcoin-macro`, and `quantum`.
- Current config check: `data/config/monitored-repos.json`, `data/config/monitored-sources.json`, `src/filing/signal-contract.ts`, `src/scoring/beat-coverage.ts`, and `docs/beat-editors/` now reflect the active three-beat model.

**Superseded gaps**

1. Old `agent-skills`, `deal-flow`, `agent-trading`, `bitcoin-yield`, and `onboarding` beat labels have been removed from active monitored configs.
2. `src/prep/daily-prep.ts` should be updated separately if it still emits old `infrastructure` / `agent-skills` focus text; do not use that stale wording as filing guidance.
3. `src/filing/quantum-map.ts` and `src/filing/quantum-intake.ts` remain quantum-specific support code inside the active `quantum` beat.

**Memory write-back spec**
- Proposed smallest `beatLessons` write-back shape for `editor-memory.json`:
  ```json
  "beatLessons": {
    "aibtc-network": [{ "date": "YYYY-MM-DD", "lesson": "string", "source": "daily-prep" }],
    "bitcoin-macro": [],
    "quantum": []
  }
  ```
- Insertion point: `daily-prep.ts` `applyManualOutcomeLoop`, after `appendDurableLessons`, filter `lessonsAdded` by beat keyword and push into `beatLessons[beat]` before `refreshEditorialMemory`.

**Quantum candidate intake schema**
- Defined `QuantumCandidateIntake` interface for pre-filing evaluation:
  - Required fields: `candidateId`, `intakedAt`, `headline`, `beat: "quantum"`, `subjectName`, `signalType`, `currentMapScore`, `proposedScore`, `primarySourceUrl`, `mapEntryFound`, `readyToFile`, `gateFailReason`
  - Target file: `src/filing/quantum-intake.ts` with single `evaluateQuantumCandidate(source, snapshot)` function
  - Feeds into `trackQuantumFiledSignal` when `readyToFile === true`

**Completed this chat**
- `src/filing/quantum-intake.ts` — created. `QuantumCandidateIntake` interface and `evaluateQuantumCandidate(source, snapshot)` function. Gates: subject in live map, score readable, `primarySourceUrl` present. `readyToFile: true` only when all gates pass. Feeds into `trackQuantumFiledSignal`. `tsc --noEmit` passes.
- `src/filing/quantum-intake.ts` gate logic fix — `mapEntryFound` and `currentMapScore` gates now only fire for `score_update_signal`. `quantum_signal` types (original threat intel) gate only on `primarySourceUrl`. Resolves false-reject for subjects like "AIBTC Correspondents" not present in the quantum map developer dataset. `tsc --noEmit` passes.

### Pending implementation (next chat)
- Remove `ai-agent-crew` from `monitored-repos.json`
- Remove 6 off-focus API snapshots from `monitored-sources.json`
- Add `beatLessons` field to `editor-memory.json` and `EditorMemory` type
- Write beat-keyed write-back in `daily-prep.ts` `applyManualOutcomeLoop`
- Regression test: `beat-coverage` with `specialistMode: true, targetBeatsPerWeek: 2` must return `targetBeatsPerWeek === 2` and recommendation must not contain `"11"`

---

## End-of-Build Reminder
After the MVP is working, consider whether external development tools should be used to improve ongoing maintenance and iteration.

Examples:
- `lgrep` for semantic code search, repo navigation, and refactor impact analysis
- `evals-skills` for evaluation audits, fixture generation, and testing quality checks

Keep both as external development tools unless there is a later reason to integrate them more closely.

## 2026-04-21 Brief Competition + Learning + Filing Safety Loop

- Implemented brief-competition contract in `create-signal`:
  - Added required `brief_competition` fields:
    - `why_this_beat_is_open`
    - `why_now`
    - `why_this_beats_same_day_competition`
    - `primary_source_proof`
    - `operator_action`
  - Added hard blockers when these are missing or weak.
  - Added strength checks for timing urgency, same-day displacement framing, anchored source proof, and explicit operator action.

- Tightened body safety and filing payload structure:
  - Kept soft body max hard-block at `900` chars.
  - Added terminal punctuation enforcement for `CLAIM`, `EVIDENCE`, and `IMPLICATION` in:
    - `src/prep/create-signal.ts`
    - `src/filing/signal-contract.ts`
    - `src/filing/helper-server.ts` normalization path.
  - Preserved mandatory `news_check_status` pre-submit enforcement in helper backend and UI flow.

- Strengthened approved-not-in-brief learning path:
  - Added `approvedNotInBriefCount` to optimization success metrics.
  - Increased demotion pressure for narrow same-beat fragments in packaging adjustments.
  - Added stronger promotion signal for broader same-beat packages with exact anchors.
  - Updated recommendations to explicitly push anchored broad packages in crowded lanes.

- Queue behavior for weak-but-valid candidates:
  - Added brief-competition proof evaluation in scoring.
  - Explicit weak/missing competition proof now blocks `file` and forces `hold` when these fields are provided but weak.
  - Legacy dry-run fixtures remain compatible unless explicit weak proof fields are present.

- Candidate generation and helper packaging updates:
  - `candidate-generator` now materializes `brief_competition` fields by default for canonical artifacts.
  - Updated helper/chat fixture inputs and seeds to satisfy current loop contracts (learning brief, outcome board, workflow context audit).

- Regression tests added/updated:
  - `tests/create-signal.test.js`
    - near-1000-char body rejection
    - terminal punctuation enforcement
    - missing brief-competition field rejection
    - weak brief-competition rejection
  - `tests/helper-server.test.js`
    - normalization rejection for missing terminal punctuation
  - `tests/scoring.test.js`
    - weak-but-valid submission held by competition-proof gate

- Verification run (targeted tests):
  - `tests/create-signal.test.js`
  - `tests/helper-server.test.js`
  - `tests/optimization.test.js`
  - `tests/chat-signal.test.js`
  - `tests/three-beat-helper-jsons.test.js`
  - `tests/scoring.test.js` (targeted to strongest-vs-weak + weak-but-valid-held cases)
  - Result: passing targeted suite for this change set.

- End-to-end loop verification run:
  - Ran `npm run daily-prep -- 2026-04-20`
  - Ran `npm run signal-loop -- --date 2026-04-20`
  - Outcome:
    - weak candidates were blocked before filing-ready promotion (`0` awaiting_human_approval survivors)
    - queue and trusted slate stayed fail-closed with explicit repair guidance
    - no filing attempt occurred (safety preserved)

- Updated operating sequence (now enforced in code/tests):
  1. Daily prep + learning refresh.
  2. Candidate creation must include strong brief-competition proof fields.
  3. Body must pass CLAIM/EVIDENCE/IMPLICATION + punctuation + length safety.
  4. Queue scorer holds weak-but-valid candidates early (before filing path).
  5. Helper normalization rejects malformed payloads and still requires pre-submit cooldown/status checks.
