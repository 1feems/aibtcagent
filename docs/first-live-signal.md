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

## Ready-To-File Standard
Treat a candidate as ready to file only if:

- `submissionStatus` is `submit`
- the headline is one sentence and still feels non-obvious
- the proof and source URLs are exact and reproducible
- the pre-submission notes show the brief, activity feed, and duplicate risk were checked for the same day
- the signal is still timely when you review the artifact

## Important Limitation
This repo currently prepares the newsroom-ready package and submit/reject decision.

It does not yet contain a verified public AIBTC "live signal filing" client or endpoint integration for newsroom submissions. Until that is confirmed from current AIBTC docs or tools, treat the generated submission package as the handoff artifact for manual filing.
