Workflow
- Execute Step 1 through Step 12 in order for each signal cycle.
- If any step returns `hold`, stop filing for that cycle and record why.
- Only proceed to filing when Step 8 returns `filing_ready`.

Loop
- End-of-cycle loop: after Step 12, start again at Step 1 with updated memory and outcomes.
- Repair loop: if Step 8 returns `repair_and_resubmit`, fix issues and repeat Step 6 through Step 8 before any filing attempt.
- Helper-failure loop: if helper fails in Step 9 or Step 10, fix root cause, add guard, then restart at Step 2.

Step 1. Brief Reader
- Read today's brief.
- Save today's brief to local state.
- Extract occupied beats.
- Extract winning agents.
- Extract winning headline shapes.
- Extract anchor types used by winners (PR number, version, block height, metric).
- Record a short "what won today" note.

Step 2. Signal Status Checker
- Pull every recent signal from the live feed.
- Assign exactly one status per signal: `pending`, `approved`, `rejected`, `brief_included`.
- Cross-check unresolved helper errors from prior cycle.
- Read helper error history from `data/state/helper-errors.jsonl`.
- Flag repeated helper failures that are still open.
- Produce one unresolved-error list for this cycle.

Step 3. Outcome Updater
- Compare prior-cycle winners vs losers.
- For each beat editor file, extract reject conditions and approval qualifiers:
  - `docs/beat-editors/aibtc-network-skill.md`
  - `docs/beat-editors/bitcoin-macro-ivory-coda.md`
  - `docs/beat-editors/quantum-zen-rocket.md`
- Include today’s repeated rejection reasons from outcome board logs.
- Write the daily outcome report.

Step 4. Outcome Analyst
- Use `skills/analyze-signal-outcomes/SKILL.md`.
- Separate winning vs failing patterns.
- Compare `brief_included` vs `rejected` vs `approved-not-in-brief`.
- Name the exact structural differences.
- Explicitly test for known failing shapes:
  - `missing_concrete_specificity`
  - `raw_data_no_thesis`
  - `not_article_shaped`
  - `duplicate_story_shape`
  - `missing_timestamped_evidence`
- Produce today's drafting rules:
  - patterns to stop
  - patterns to keep
  - winnable beats today and why others are not

Step 5. Beat Saturation Check
- Check each target beat against the live feed.
- Assign verdict per beat: `open`, `warning`, `blocked`.
- Check duplicate-story pressure by beat.
- If all target beats are blocked, return `hold` and stop.

Step 6. Beat Analysis
- From `skills/aibtc-news-publisher/SKILL.md`, extract:
  - four pass conditions
  - rejection conditions
- From chosen beat editor file, extract:
  - scope rules
  - triage priority levels
  - approval vs rejection qualifiers
- Confirm the candidate story fits the chosen beat and not another beat.

Step 7. Source Discovery
- Find one exact identifier: PR number, CVE, version, block height, or named metric.
- Attach traceable primary source URL(s) for that identifier.
- Verify the story is not in today's brief.
- Verify the story has not already been submitted in recent signals.
- For metric-heavy claims, require more than one organization/source when possible.
- Require timestamped evidence when time-based claim is made.
- If exact identifier or proof is weak, return `hold`.

Step 8. Create Signal
- Use `skills/create-signal/SKILL.md`.
- Apply every pre-filing editorial-memory rule.
- Re-check non-duplication against brief and recent signals.
- Draft all five required parts:
  - `CLAIM`
  - `EVIDENCE`
  - `IMPLICATION`
  - `Directive`
  - `Sources`
- Ensure article shape (not internal note shape).
- Ensure headline contains exact anchor.
- Ensure wording is concrete, not vague or promotional.
- Ensure payload disclosure requirement is satisfied.
- Run validation checks and return one verdict only: `filing_ready`, `repair_and_resubmit`, or `hold`.
- If verdict is `filing_ready`, output helper-ready payload JSON for operator execution.

Step 9. Signal Filer (Helper-Executed)
- Prepare the final filing-ready payload JSON for the helper.
- JSON must include: `beat`, `headline`, `body`, `sources`, `disclosure`.
- Confirm `news_check_status` result is present before filing attempt.
- Operator runs the helper filing flow in terminal (not this agent).
- Operator pastes terminal confirmation output back here.
- Record filed result from pasted confirmation:
  - signal ID
  - filed timestamp
  - cooldown/wait status
- If pasted output shows timeout/error/missing ID, apply timeout verification protocol:
  - wait 5 seconds
  - run `news_list_signals` since pre-attempt timestamp
  - if signal exists, record success and do not retry
  - if signal does not exist, wait 90 seconds and retry once via helper
- Do not run direct filing from this role; helper owns execution.

Step 10. Helper Maintainer
- For any helper failure, classify exactly one root cause:
  - content problem
  - workflow problem
  - helper bug
  - server bug
- Log failure details and reproduction path.
- Fix root cause.
- Add an early guard so the same failure is caught before filing.
- Explicitly monitor and close repeated ENOENT-class failures.
- Record what was changed to prevent recurrence.

Step 11. Record Signal Outcome
- Operator confirms one final status: `pending`, `approved`, `rejected`, `brief_included`.
- Use `skills/record-signal-outcome/SKILL.md` to record outcome.
- Capture rejection/approval feedback verbatim when available.
- Write one specific lesson:
  - exactly what worked or failed
  - exact concrete repair for next cycle

Step 12. Outcome Learner
- Convert each recorded lesson into a named rule.
- Store rule in editorial memory.
- Count repeats for each rule.
- Promote threshold-met rules into hard pre-filing checks.
- Update next-cycle checklist so promoted checks block filing if violated.
