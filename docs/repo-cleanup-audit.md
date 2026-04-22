# Repo Cleanup Audit

## Document Role

- Category: `living implementation`
- Scope: concrete cleanup decisions for stale paths, duplicates, helper drift, and temporary compatibility layers
- Use this when: deciding whether a repo path should be deleted, migrated, or intentionally kept
- Do not use this as: the workflow contract or the filing contract

## Audit Date

- `2026-04-21`

## Decision Rule

Use this order:

1. `delete` when the file or path is not part of the canonical workflow and has no live readers
2. `migrate` when compatibility is still needed but the path is no longer canonical
3. `keep temporarily` only when the remaining dependency is explicit and current

## Exact Helper ENOENT Findings

### 1. Missing helper asset request

- Failure:
  - `data/state/helper-errors.jsonl`
  - `logs/signal-loop-analysis-2026-04-20.json`
  - `data/state/signal-learning-briefs/2026-04-20.json`
- Exact dead path:
  - `tools/xverse-register/favicon.ico`
- Cause:
  - browser default favicon request hit the helper server, but no asset existed there
- Fix:
  - helper pages now declare a no-op favicon
  - helper servers now return `204` for `/favicon.ico` instead of logging a fake server failure

### 2. Stale filing-ready query path

- Failure:
  - `data/state/helper-errors.jsonl`
- Exact dead path:
  - `data/filing-ready/2026-04-16/manual.json`
- Cause:
  - a stale `?date=2026-04-16&candidate=manual` helper URL was treated as a repo artifact lookup
- Fix:
  - `/api/local/filing-ready` now returns a friendly `404` JSON explanation for missing repo artifacts
  - the helper UI clears stale `date` / `candidate` query params after that failure instead of repeatedly retrying them

## Delete Now

These are dead or duplicate and not part of the active runtime/test path.

### Duplicate source files

- `src/scoring/brief-win-gate 2.ts`
- `src/scoring/conversion-tracker 2.ts`
- `src/signals/winner-gate 2.ts`
- `src/types/editor 2.ts`
- `src/types/filing-gate 2.ts`

Reason:
- duplicate copies with ` 2` suffix
- not referenced by the active import graph
- they only create duplicate compiled output in `dist/`

### Duplicate tests outside the active test glob

- `tests/context-memory.test 2.js`
- `tests/daily-prep.test 2.js`
- `tests/day-validation.test 2.js`
- `tests/editorial-regression.test 2.js`
- `tests/filing-gate-validator.test 2.js`
- `tests/filing-ready-append.test 2.js`
- `tests/heartbeat-reminder.test 2.js`
- `tests/leaderboard-recovery.test 2.js`
- `tests/outcome-ingestion.test 2.js`
- `tests/pre-submit-audit.test 2.js`
- `tests/report-date.test 2.js`
- `tests/runtime-enforcement.test 2.js`
- `tests/signal-guard.test 2.js`
- `tests/signal-job-selection.test 2.js`
- `tests/winner-gate.test 2.js`

Reason:
- `package.json` runs `tests/*.test.js` and `tests/editor/*.test.js`
- these files do not match the active test command
- several are byte-for-byte duplicates of the canonical tests

### Duplicate site assets

- `site/assets/dashboard 2.css`
- `site/assets/dashboard 2.js`
- `site/data/dashboard 2.json`

Reason:
- duplicate dashboard artifacts with ` 2` suffix
- canonical site uses `dashboard.css`, `dashboard.js`, and `dashboard.json`

### Empty stray artifacts

- `4`
- `data/editor/fixtures 2/`

Reason:
- empty stray file / directory with no readers

### Stale helper flow

- `tools/xverse-register/claim-viral.html`

Reason:
- retired standalone helper for an older viral-claim / Genesis progression flow
- no live repo references remained after cleanup

### Dead code path removed from source

- `src/filing/artifacts.ts`
  - removed `HELPER_READY_ARTIFACT_DIR`
  - removed `resolveHelperReadyArtifactPath()`

Reason:
- no readers remained for `data/helper-filing-ready`

## Migrate

These paths are not canonical, but a migration or mirror is still active.

- `data/state/filed-signals.json`
  Reason:
  - compatibility mirror for older readers and legacy workflows
  - canonical outcome ledger is `data/state/signal-history.json`

- `data/outcomes/approvals/*.json`
  Reason:
  - backward-compatible outcome mirror while migration finishes
  - canonical history is converging on `data/state/signal-history.json`

## Keep Temporarily

These are not ideal long-term, but they still have live reasons to exist.

- `src/signals/general-news.ts`
- `src/signals/infrastructure.ts`
  Reason:
  - older lane coverage and tests still reference them
  - current filing workflow is narrower, but these modules are not yet fully excised from supporting coverage

- `tests/infrastructure.test.js`
- `tests/submission.test.js`
- `data/fixtures/general-news-raw.json`
- `data/fixtures/protocol-update-raw.json`
  Reason:
  - still back test legacy lane behavior and packaging expectations
  - should be revisited only when corresponding source modules are retired

## Follow-Up Risks

- The legacy lane/test references have been removed from the active runtime surface; any remaining mentions should be treated as historical context only.
- Historical data under `data/filing-ready/` includes prior-beat artifacts; those are evidence/history, not current workflow guidance, and should not be treated as canonical templates without the current guards.
