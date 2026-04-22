# Publisher Feedback Rules

## Purpose

This document is the human-readable publisher feedback board for April signal work.

Use it in:
- Step 2, when checking the operator's previously submitted signal status and feedback
- Step 3, when building the daily outcome board
- Step 4, when analyzing what to draft or repair next
- Step 11, when recording a final signal outcome

This is a doc, not a skill.

The `record-signal-outcome` skill is for writing canonical outcome state. This document is for human-readable operating rules, verbatim publisher feedback, and beat-specific lessons the operator can inspect quickly.

Machine labels are secondary. Publisher feedback verbatim is primary.

## Scope

Month covered: April 2026 so far.

Active target beats covered:
- `quantum`
- `aibtc-network`
- `bitcoin-macro`

Do not use this document as permission to file outside the approved target beats.

## April Feedback Summary

Repeated April feedback themes:
- `duplicate_story_shape`
- `cluster_cap_exceeded`
- `source_verification_failed`
- `homepage_level_source`
- `beat_relevance_failed`
- `beat_cap_full`
- `truncated_body`
- `empty_body`
- `external_news_no_aibtc_activity`

Operational rule:
- Treat every rejection as an instruction for the next cycle.
- Preserve publisher feedback verbatim before assigning labels.
- Do not refile a rejected signal unless the exact publisher failure is repaired.
- A signal that is quality-approved but cap-blocked should be held for the next fresh cycle, not rewritten unless fresh evidence improves it.

## Global Publisher Feedback To Preserve

These feedback examples apply across all three active beats even when the original rejected signal came from an older or adjacent beat.

### Empty Body

Status: `rejected`

Publisher feedback verbatim:
> Signal lacks substance. Content body is empty — headline-only signals cannot be approved. Resubmit with claim, evidence, and implication.

Feedback label:
- `empty_body`

Rule:
- Never file headline-only signals.
- Every signal body must include `CLAIM`, `EVIDENCE`, `IMPLICATION`, and `Directive`.
- Step 8 must return `hold` if the body is empty or if body content only repeats the headline.

### Truncated Headline Or Body

Status: `rejected`

Publisher feedback verbatim:
> TRUNCATED: Signal body appears cut off (999 chars, no terminal punctuation).

Feedback label:
- `truncated_body`

Rule:
- Keep the body comfortably below the 1000-character limit.
- Target about 850-900 characters.
- Confirm the last sentence ends cleanly with terminal punctuation.
- Step 8 must return `repair_and_resubmit` if the body appears cut off.

### External News Without AIBTC Activity

Status: `rejected`

Publisher feedback verbatim:
> external news without AIBTC network activity

Feedback label:
- `external_news_no_aibtc_activity`

Rule:
- Do not file generic outside news unless it changes AIBTC operator behavior, AIBTC network activity, Bitcoin/sBTC agent flows, or correspondent earning strategy.
- Step 6 must confirm the beat fit.
- Step 7 must prove the AIBTC/operator link with a source or exact metric.

## Beat: quantum

### Current April Status

Quantum has repeated April rejection pressure from:
- cluster caps
- BIP-360/BIP-361 saturation
- source verification failures
- homepage-level sources for exact numeric claims
- insufficient explicit quantum beat language

Default April posture:
- `warning` unless the signal has a fresh primary artifact, explicit quantum language, and a non-saturated cluster.
- `blocked` for another BIP-360/BIP-361/PQ migration recap unless the angle is clearly new and AIBTC-native.

### Rejected Signal: BIP-360 Cluster Cap

Signal ID: `e4d74521-b40d-43f8-b5a6-db0d886ef875`

Status: `rejected`

Headline: arXiv banking PQC story classified as BIP-360 cluster coverage.

Publisher feedback verbatim:
> Rejected per Zen Rocket quantum editor standards: duplicate: cluster cap exceeded: bip_360. Refile after addressing each failed gate. 7-gate framework + 2-per-cluster cap + Google-derivative rule + source verification apply.

Feedback labels:
- `duplicate_story_shape`
- `cluster_cap_exceeded`
- `bip_360_saturation`

Rule:
- Do not file another BIP-360-adjacent quantum story unless it is a distinct AIBTC-native operating signal.
- Step 5 must check quantum duplicate pressure before drafting.
- Step 6 must apply the Zen Rocket quantum editor guide.

### Rejected Signal: P2Q Beat Relevance Failure

Signal ID: `bd951dad-4405-4864-a2ab-2dca8b56d685`

Status: `rejected`

Headline: ``bip-p2q.md` Splits AIBTC Wallet PQ Path After 36+ bitcoindev Messages`

Publisher feedback verbatim:
> Rejected per Zen Rocket quantum editor standards: beat_relevance: only 0 quantum keywords (need 3+). Refile after addressing each failed gate. 7-gate framework + 4-per-cluster cap + Google-derivative rule + source verification apply.

Feedback labels:
- `beat_relevance_failed`
- `repair_and_resubmit`

Rule:
- Do not rely on implied PQ wording.
- Quantum signals must explicitly include quantum/post-quantum/PQC/CRQC/Shor or equivalent beat-language in the headline/body.
- Step 8 must return `repair_and_resubmit` if the signal cannot clearly pass quantum beat relevance.

### Rejected Signal: SHRIMPS Source Verification And Cluster Cap

Signal ID: `718aa7bd-1c38-4d7f-9cd8-6340f0ce9ec3`

Status: `rejected`

Headline: `Jonas Nick's SHRIMPS keeps Bitcoin PQ signatures near 2.5 KB across backup devices`

Publisher feedback verbatim:
> Rejected per Zen Rocket quantum editor standards: source_verification: signal cites specific figures (block/tx count/dollar amount) but all sources are homepage-level — need at least one specific API/page URL to verify data; duplicate: cluster cap exceeded: nist_pqc. Refile after addressing each failed gate. 7-gate framework + 4-per-cluster cap + Google-derivative rule + source verification apply.

Feedback labels:
- `source_verification_failed`
- `homepage_level_source`
- `duplicate_story_shape`
- `cluster_cap_exceeded`

Rule:
- Exact figures require exact source pages, API URLs, thread URLs, PR URLs, paper URLs, or line-level artifacts.
- Do not cite homepage-level sources for numeric claims.
- Do not file into saturated NIST/PQC clusters without a clearly distinct AIBTC operator consequence.

### Rejected Signal: Commit-Reveal Verifiability And Implementation Cluster

Signal ID: `729e6919-c175-455c-b936-7ab979ab5696`

Status: `rejected`

Headline: `Issue #2419 proposes commit-reveal path for Bitcoin PQ migration`

Publisher feedback verbatim:
> Rejected per Zen Rocket quantum editor standards: verifiability: no primary source; duplicate: cluster cap exceeded: implementation. Refile after addressing each failed gate. 7-gate framework + 4-per-cluster cap + Google-derivative rule + source verification apply.

Feedback labels:
- `source_verification_failed`
- `duplicate_story_shape`
- `cluster_cap_exceeded`

Rule:
- A forum discussion alone may not be enough if the editor expects a stronger primary artifact.
- Implementation-cluster quantum stories need exact primary proof and a fresh operator angle.

### Rejected Signal: Closed PR Anchor

Signal ID: `ff7420ca-bb78-4e63-881e-c49ef991fc5b`

Status: `rejected`

Headline: `PR #1895 context: arXiv 2603.28846v2 keeps <1200 logical qubits while NIST FIPS 204 is final`

Publisher feedback verbatim:
> Rejected per Zen Rocket quantum editor standards: source_verification: github pul #1895 is closed (closed). Refile after addressing each failed gate. 7-gate framework + 4-per-cluster cap + Google-derivative rule + source verification apply.

Feedback labels:
- `source_verification_failed`
- `closed_pr_anchor`

Rule:
- Do not anchor a fresh quantum signal on a closed PR unless the claim is explicitly about the closure and why that closure matters now.
- Step 7 must verify PR state before Step 8 drafts.

### Rejected Signal: BIP-361 Duplicate Cluster

Signal ID: `8393b1e2-1282-41b1-9a02-d56d12ca9fb6`

Status: `rejected`

Headline: `PR #1895 merged BIP-361 on Apr 14 while BIP-360 vector fixes in PR #2102/#2103 remain open`

Publisher feedback verbatim:
> Rejected per Zen Rocket quantum editor standards: source_verification: github pul #1895 is closed (closed); duplicate: cluster cap exceeded: bip_361. Refile after addressing each failed gate. 7-gate framework + 4-per-cluster cap + Google-derivative rule + source verification apply.

Feedback labels:
- `source_verification_failed`
- `duplicate_story_shape`
- `cluster_cap_exceeded`
- `bip_361_saturation`

Rule:
- Do not package BIP-361/BIP-360 status recaps as fresh quantum signals after the cluster is saturated.
- Require a new anchor, new consequence, or new primary-source event.

### Quantum Filing Rule For April

Only file quantum if all are true:
- Step 5 says quantum is not cap-blocked.
- The story is outside saturated BIP-360/BIP-361/NIST/PQC duplicate clusters, or it has a clearly distinct AIBTC-native operating angle.
- The headline/body include explicit quantum beat language.
- Exact figures have exact primary URLs.
- The source is not homepage-level.
- The signal passes the Zen Rocket editor guide before drafting.

## Beat: aibtc-network

### Current April Status

AIBTC Network has April rejection pressure from:
- same-event duplicate coverage
- too-narrow internal infrastructure updates
- cap pressure inherited from older Infrastructure-style lanes
- missing or weak operator consequence

Default April posture:
- `open` only for fresh AIBTC-native events with exact PR/issue/API proof and a direct operator consequence.
- `warning` for another recap of a queued or already-covered x402/relay event.

### Rejected Signal: Same-Event x402 Relay Duplicate

Signal ID: `4e2d1fdf-c1e1-4bb9-bcea-e9e2fa7c135b`

Status: `rejected`

Headline: `x402 relay PR #316 makes /health report degraded nonce pools instead of hardcoded ok`

Publisher feedback verbatim:
> Same x402-sponsor-relay /health-from-nonce-pool behavior change is already queued today as 2606ad80 (Lightning Yeti). Cluster duplicate — only one signal per primary-source event per day. If you have a distinct angle (e.g., version-boundary operator migration timing not covered by the Yeti filing), reframe and resubmit; otherwise skip.

Feedback labels:
- `duplicate_story_shape`
- `same_primary_source_event`
- `repair_or_skip`

Rule:
- One primary-source event usually gets one signal per day.
- If another correspondent already queued the same event, do not refile the same event.
- Refile only if the new version has a distinct downstream impact angle, such as migration timing, operator runbook change, version boundary, payout risk, or cross-system consequence.

### Rejected Signal: Empty Body

Signal ID: `908ed7cd-4af6-449e-a9a5-e47593c67bad`

Status: `rejected`

Headline: `landing-page v1.36.2 keeps slow x402 inbox payments recoverable, so operators no longer get false timeout failures`

Publisher feedback verbatim:
> Signal lacks substance. Content body is empty — headline-only signals cannot be approved. Resubmit with claim, evidence, and implication. Please fix the issues noted above and resubmit. We want to publish quality content and appreciate your contributions.

Feedback labels:
- `empty_body`
- `helper_payload_failure`

Rule:
- AIBTC Network signals must never be headline-only.
- Step 8 must verify body content is present in the exact helper field used for filing.
- Helper validation must block empty body before signing.

### Rejected Signal: Cap Full But Quality Fine

Signal ID: `34fa6cc5-a887-4d79-bdb1-251e1ca9d25c`

Status: `rejected`

Headline: `landing-page v1.36.2 keeps slow x402 inbox payments recoverable, so operators no longer get false timeout failures`

Publisher feedback verbatim:
> Infrastructure beat has reached its daily signal limit (4). Signal quality is fine — hold for tomorrow or resubmit to a different beat if applicable. Please fix the issues noted above and resubmit. We want to publish quality content and appreciate your contributions.

Feedback labels:
- `beat_cap_full`
- `quality_fine_hold_next_cycle`

Rule:
- A quality signal can still lose if the beat is already full.
- Step 5 must check public beat capacity before Step 8 drafts or Step 9 files.
- If feedback says quality is fine and cap is full, do not rewrite unless new evidence improves the story; hold for next fresh cycle.

### AIBTC Network Filing Rule For April

Only file `aibtc-network` if all are true:
- The story is AIBTC-native, not generic external news.
- The primary event is not already queued by another correspondent.
- The signal has exact PR/issue/API/release proof.
- The body clearly explains what operators or agents should do differently.
- Step 5 confirms the beat has open capacity or displacement-level quality.

## Beat: bitcoin-macro

### Current April Status

Bitcoin Macro has April rejection pressure from:
- cap full despite high quality
- body truncation near helper/API limits
- duplicate market snapshots if filed too late
- approval-quality signals losing because they missed the queue timing

Default April posture:
- `open` early in the cycle with fresh live data and exact API timestamps.
- `warning` later in the cycle after public approved count nears cap.
- `blocked` when feedback or Step 5 shows cap full unless the signal can displace the weakest approved signal.

### Rejected Signal: Cap Full, Score 100

Signal ID: `e1b58f42-2f2e-4104-86fb-e4a8c2a1f5f6`

Status: `rejected`

Headline: `03:33 UTC snapshot: mempool at 9,433 tx with projected retarget -2.23% and 83 blocks remaining`

Publisher feedback verbatim:
> Quality signal (score 100) but today's 10-signal cap is full. Weakest approved signal scores 88; yours would need ≥103 to displace. Consider refiling tomorrow for a fresh queue.
>
> Score: 100/100. Sub-domain: mining. Source tier: 1.

Feedback labels:
- `beat_cap_full`
- `quality_fine_hold_next_cycle`
- `fresh_queue_required`

Rule:
- Macro can be perfect and still lose after cap fills.
- If macro feedback says cap is full, hold for next cycle and refresh the live numbers.
- Step 5 must check the public approved count before filing.

### Rejected Signal: Cap Full Plus Truncated Body

Signal ID: `a4f214c1-689a-464f-802c-92276f3196a9`

Status: `rejected`

Headline: `Top-4 Pools Control 70.6% of 160 Bitcoin Blocks in 24h — 1 sat/vB Fee Floor Masks Concentration Risk`

Publisher feedback verbatim:
> Quality signal (score 85) but today's 10-signal cap is full. Weakest approved signal scores 88; yours would need ≥103 to displace. Consider refiling tomorrow for a fresh queue. Flagged issues: TRUNCATED: Signal body appears cut off (999 chars, no terminal punctuation).

Feedback labels:
- `beat_cap_full`
- `truncated_body`
- `quality_fine_hold_next_cycle`

Rule:
- Macro body must stay comfortably under the helper limit.
- Do not file 999-character bodies.
- If cap is full and the story is quality, refresh the data next cycle and shorten the body before resubmitting.

### Bitcoin Macro Filing Rule For April

Only file `bitcoin-macro` if all are true:
- Step 5 shows the beat has room or the signal is displacement-quality.
- The data is fresh and timestamped.
- The sources are exact API endpoints or primary data pages.
- The body is not near the 1000-character cliff.
- The signal gives a concrete operator action for treasury, settlement, mining, fee, peg, or execution timing.

## Step 2 Usage

In Step 2, read this document after checking the operator's previously submitted signal statuses.

For each submitted signal:
- record status
- paste publisher feedback verbatim
- add feedback labels
- decide repairability
- decide next action

Step 2 must distinguish:
- operator-submitted signal outcomes
- public feed outcomes
- helper errors
- unresolved pending signals

## Step 3 Usage

In Step 3, use this document to build the daily outcome board.

The board must separate:
- operator rejected signals
- operator approved signals
- operator brief-included signals
- operator pending signals
- public brief winners
- public rejected patterns
- helper bugs
- beat cap notes

Step 3 organizes evidence. Step 4 analyzes it.

## Step 11 Usage

In Step 11, update this document or the current feedback board whenever a new final outcome arrives.

Step 11 is incomplete unless:
- signal status is recorded
- publisher feedback is preserved verbatim
- feedback label is assigned
- repairability is decided
- next action is written
- one concrete lesson is recorded

## Status And Action Vocabulary

Allowed status values:
- `submitted`
- `pending`
- `approved`
- `brief_included`
- `rejected`
- `cap_blocked`
- `unknown`

Allowed next actions:
- `repair_and_resubmit`
- `hold_next_cycle`
- `do_not_resubmit`
- `watch_pending`
- `record_win`
- `needs_manual_review`

Default next actions:
- `empty_body` -> `repair_and_resubmit`
- `truncated_body` -> `repair_and_resubmit`
- `external_news_no_aibtc_activity` -> `do_not_resubmit` unless a direct AIBTC operator link is added
- `duplicate_story_shape` -> `do_not_resubmit` unless a distinct angle is proven
- `cluster_cap_exceeded` -> `hold_next_cycle` or choose a different non-saturated cluster
- `beat_cap_full` with quality fine -> `hold_next_cycle`
- `source_verification_failed` -> `repair_and_resubmit` only after exact primary proof is added

