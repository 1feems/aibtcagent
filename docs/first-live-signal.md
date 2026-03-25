# First Live Signal

## Purpose
This runbook defines the shortest safe path from "we have a real candidate" to "we have a newsroom-ready package and can decide whether to file it."

## Current Reality
- registration is complete
- verification is complete
- heartbeat works manually
- GitHub Actions is the recurring non-signing runtime
- actual wallet signing remains local and manual
- the repo packages valid candidate signals, but live filing still depends on the current AIBTC submission path available to the operator

## Before A Live Run
- collect one real raw event JSON in `data/live-inputs/`
- collect one real pre-submission intelligence JSON in `data/live-inputs/`
- keep the beat focused on `protocol-updates`
- do not use fixture inputs for a real submission decision

## Suggested File Names
- `data/live-inputs/protocol-update-YYYY-MM-DD-001.json`
- `data/live-inputs/pre-submission-YYYY-MM-DD-001.json`

## GitHub Manual Run
Run `.github/workflows/dry-run-report.yml` with:

- `raw_path`: `data/live-inputs/protocol-update-YYYY-MM-DD-001.json`
- `pre_submission_path`: `data/live-inputs/pre-submission-YYYY-MM-DD-001.json`

## What To Inspect
After the run finishes, inspect the artifact files:

- `dry-runs/<date>/dry-run-summary.json`
- `dry-runs/<date>/<candidate-id>-submission.json`
- `reports/daily/<date>.md`
- `experiments/optimization/<date>.json`

## PRD Fit Checklist
Before treating any candidate as a real filing candidate, confirm:

- the event is early enough to beat likely duplicates
- the event is not obvious from common dashboards or generic activity summaries
- the signal is directly supported by exact onchain proof
- the causal trigger is explicit and defensible
- the event feels significant enough that a publisher might actually select it
- the event fits the `protocol-updates` beat more strongly than a broader or noisier beat
- the candidate is strong enough to improve expected payout odds, not just pass validation
- the candidate feels worth paying for in the next 30 days, not merely worth logging

Reject or hold the candidate if it is:

- technically valid but boring
- routine deploy noise without meaningful first-use significance
- easy to ignore in a daily brief
- likely to be crowded, duplicated, or already obvious

## Publisher Skill Checklist
Before any filing handoff, confirm the package can survive these role-based checks:

- `aibtc-news-protocol`:
  - the signal clearly belongs to the protocol-updates beat
  - the event is a real protocol change, launch, upgrade, or activation
- `aibtc-news-fact-checker`:
  - exact tx hashes, contract address, and source URLs are attached
  - the proof can be independently reproduced from public sources
  - the causal explanation does not overclaim beyond the proof
- `aibtc-news-publisher`:
  - the signal is interesting enough for a human reader to care
  - the signal is concise, sharp, and not padded with analysis fluff
  - the signal would not feel embarrassing if ignored publicly
  - the signal has a plausible chance of selection and payout

## Human Format Checklist
Before treating the publisher handoff as complete, confirm:

- `article_preview.title` reads like a strong newsroom title
- `article_preview.dek` explains the significance without hype
- `article_preview.lede` states what happened and why
- `article_preview.why_it_matters` sounds meaningful, not generic
- `article_preview.proof_summary` gives a human-readable proof anchor
- the package feels like something a publisher could compile for humans without major rewriting

## 30-Day Money Checklist
Because the goal is to maximize earnings over the next 30 days, confirm:

- the candidate is stronger than routine protocol noise
- the candidate has a plausible path to approval, not just technical validity
- the candidate is differentiated enough to avoid wasting a filing slot
- submitting it is better than waiting for a stronger signal
- the candidate supports leaderboard and payout goals, not just activity for its own sake

## Ready-To-File Standard
Treat a candidate as ready to file only if:

- `submissionStatus` is `submit`
- `editorial_review.ready_to_file` is `true`
- the PRD fit checklist above is satisfied by human review
- the publisher skill checklist above is satisfied by human review
- the human format checklist above is satisfied by human review
- the 30-day money checklist above is satisfied by human review
- the `protocol`, `fact_checker`, and `publisher` reviews do not hold the candidate
- the headline is one sentence and still feels non-obvious
- the proof and source URLs are exact and reproducible
- the pre-submission notes show the brief, activity feed, and duplicate risk were checked for the same day
- the signal is still timely when you review the artifact

## Important Limitation
This repo currently prepares the newsroom-ready package and submit/reject decision.

It does not yet contain a verified public AIBTC "live signal filing" client or endpoint integration for newsroom submissions. Until that is confirmed from current AIBTC docs or tools, treat the generated submission package as the handoff artifact for manual filing.
