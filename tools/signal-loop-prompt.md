You are running the AIBTC signal loop for this repo.

Primary objective:
- File only signals that have a real chance to make `In Brief`.
- `approved_not_in_brief` is a miss.
- Empty slate is better than weak filings.

Non-goals:
- Do not optimize for volume.
- Do not optimize for GitHub activity by itself.
- Do not draft nice-sounding but non-competitive signals in chat.

Use the repo as source of truth. Do not rely on memory from other repos or earlier chats.

Repo-local skills to follow:
- `skills/create-signal`
- `skills/record-signal-outcome`
- `skills/analyze-signal-outcomes`

Treat those skills as operating instructions, not optional reference material.

Read these first, in this order:
1. `AGENTS.md`
2. `memory.md`
3. `docs/company-operating-model.md`
4. `skills/create-signal/SKILL.md`
5. `skills/analyze-signal-outcomes/SKILL.md`
6. `docs/workflow.md`
7. `docs/build-plan.md`
8. `data/briefs/<report-date>.md` if it exists, otherwise the latest dated brief file
9. `data/state/filed-signals.json`
10. `data/state/editorial-memory.json`
11. `data/training/in-brief.jsonl`
12. `data/training/rejected.jsonl`
13. `data/training/approved-not-in-brief.jsonl`

Operating rules:
- Our one job is to create filing candidates that can win a brief slot.
- Prefer one strong sendable story over five technically valid weak ones.
- Treat raw release notes, changelog fragments, and thin external-news angles as likely losses.
- Headlines must be human-news shaped and anchored with exact numbers, versions, dollar amounts, vote tallies, issue numbers, or other hard proof.
- Every filing body must contain:
  - `CLAIM:`
  - `EVIDENCE:`
  - `IMPLICATION:`
- Do not use legacy Q1-Q4 publisher guardrails.
- Use the active beat editor guidance document for the selected beat as the only editorial authority.
- Compare every candidate against current brief winners, rejected patterns, and approved-not-in-brief examples before recommending filing.
- Never attempt `news_file_signal` without first checking `news_check_status`.
- If filing times out or returns no signal ID, check the feed before retrying.

Execution loop (company-role contract):
1. If the operator pasted today's brief in chat, save it to `data/briefs/<report-date>.md` before running anything else.
2. Run `npm run signal-loop -- --date <report-date> --beat quantum --limit 3`.
2. Inspect the output plus these artifacts if they exist:
   - `logs/role-loop-summary-<report-date>.json`
   - `data/reports/signals/<report-date>-trusted.md`
   - `data/filing-queue/<report-date>.json`
   - `data/filing-ready/<report-date>/`
   - `data/reports/operator/<report-date>.md`
3. If there is a send-ready or clearly reviewable candidate, do not invent a new story yet.
   - Review whether it is actually competitive for `In Brief`.
   - Reject anything that looks like routine release noise, duplicate shape, weak beat fit, or missing operator consequence.
4. If the slate is empty or non-competitive, source exactly one stronger candidate.
   - Start with Tier 1 internal sources and open beats.
   - Only use external news if it creates a concrete operator decision or risk window for AIBTC agents.
   - Draft through the `create-signal` skill discipline, not freeform chat drafting.
   - Write the candidate as repo input, not as chat prose.
   - Save it under `data/manual-submissions/<report-date>/` in the repo's expected JSON shape.
5. Re-run `npm run signal-loop -- --date <report-date> --beat quantum --limit 3`.
6. Repeat until one of these is true:
   - there is one strong candidate worth approving for filing
   - there is no competitive story and the correct outcome is to wait

Approval standard:
- Stronger than today's visible brief patterns, not merely valid.
- Exact proof is public and reproducible now.
- Beat is publishable by the operator.
- Story has direct agent/operator consequence.
- The candidate sounds like a finished article lead, not an artifact title.
- The headline learned from real brief examples instead of reading like repo exhaust.
- You can explain why it should beat same-day competition on that beat.

When you report back in chat:
- Lead with the best candidate or the reason the slate should stay empty.
- Include exact file paths you updated.
- Explain briefly why the candidate can win `In Brief` or why current candidates should be killed.
- If a filing-ready artifact exists, name the candidate ID and the specific risk checks that still matter.
- Always include:
  - saved brief path
  - occupied clusters from today's outcome board
  - loop verdict from the research report
  - helper-ready JSON objects (up to 3 for `quantum`) when available
- Stop before filing. Do not run `news_file_signal` in this loop.

Do not stop at abstract advice. Run the loop, inspect artifacts, write repo inputs if needed, and re-run.
