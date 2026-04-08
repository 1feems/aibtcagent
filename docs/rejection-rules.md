# Rejection Rules

## Purpose
This document turns live publisher rejections into explicit training rules for the agent.

The goal is not to find technically true signals.
The goal is to find signals that the `aibtc.news` publisher would plausibly approve and potentially publish.

Use this document before drafting, before filing, and when labeling training data.

## Core Rule
Reject by default unless the candidate is:

- inside `aibtc` network activity
- supported by exact public proof for the exact claim
- written like a real beat post, not an internal note
- clear about what changed and what agents should do differently
- strong enough to improve approval odds, not just pass validation

## Hard Reject Rules

### 1. Not AIBTC-Native
Reject if the signal is mainly about external market, macro, regulatory, or industry news and only adds a thin agent angle.

Reject examples:
- Bitcoin mempool fees with no tied `aibtc` activity
- ETF flow stories
- government crypto policy
- general Stacks telemetry with no direct `aibtc` consequence

Allowed only if:
- the event directly changes `aibtc` agent operations, governance, payments, tooling, onboarding, or security
- that impact is stated with concrete internal evidence

Reason code:
- `not_aibtc_network_activity`

### 2. Raw Data Without Intelligence
Reject if the candidate only lists counts, snapshots, or movement without a thesis.

Reject examples:
- beat counts
- approved/submitted totals
- correspondent totals
- queue deltas with no implication

Required to survive:
- exact numbers
- what changed
- why it matters
- what an agent should do differently

Reason code:
- `raw_data_no_thesis`

### 3. Changelog Notification Without Capability
Reject if the candidate says a version shipped but does not explain the exact change and operator consequence.

Weak:
- "v1.46.0 deployed for enhanced stability"
- "infrastructure update shipped"

Stronger:
- "v1.24.0 adds O(1) malformed payload rejection — bad relay requests now fail before burning nonce capacity"

Required to survive:
- exact feature, fix, or failure mode
- what broke before
- what now works or what risk is reduced

Reason code:
- `changelog_without_agent_context`

### 4. Source Mismatch Or Unverifiable Claim
Reject if the source does not prove the exact headline claim.

Reject examples:
- citing a `skills` release for a relay claim
- using earnings totals to support inbox receipt breakdowns
- naming a source that discusses a different topic than the body

Required to survive:
- every number, feature, and causal claim can be checked from the linked source set

Reason codes:
- `source_mismatch`
- `unverifiable_claim`

### 5. Promotional Or Hype Framing
Reject if the signal reads like marketing, self-promotion, or mission-posting instead of news.

Reject examples:
- "first end-to-end realization of the mission"
- "this agent is actively monitoring"
- inflated certainty or triumphal language

Required to survive:
- neutral, factual wording
- downside, risk, or limitation included when relevant

Reason code:
- `promotional_framing`

### 6. Missing Concrete Number Or Specificity
Reject if the signal uses placeholders, vague claims, or abstract wording where a number or named change should exist.

Reject examples:
- `n/a members`
- "structure and timing view"
- "improves the network"

Required to survive:
- hard number, exact version, tx hash, contract, or named mechanism

Reason code:
- `missing_concrete_specificity`

### 7. Beat Mismatch
Reject or hold if the story is filed under a beat that does not match the actual content.

Examples:
- external market observations filed as Infrastructure
- payment economics filed as Onboarding
- internal distribution metrics filed as Agent Economy without a real network consequence

Required to survive:
- the beat should match how the publisher would likely classify the story

Reason code:
- `beat_mismatch`

### 8. Beat Saturation
Hold if the candidate is strong but the beat is already crowded or at its daily limit.

Important:
- this is not the same as weak quality
- strong candidates can still lose on timing

Action:
- label as hold, not file
- revisit the next day if still fresh

Reason code:
- `beat_limit_reached`

### 9. Sloppy Execution
Reject if the signal has avoidable trust-breaking mistakes.

Reject examples:
- typo in headline
- contradictory numbers
- truncated body
- empty body caused by wrong payload field
- wrong causal framing

Reason codes:
- `headline_typo`
- `contradictory_claims`
- `truncated_body`
- `empty_body`
- `causality_misframed`

## What Usually Survives
The best candidate shapes so far are:

- `aibtc` infrastructure release + exact fix/capability + operator consequence
- new contract or feature + first real use + exact proof
- internal network metric shift + concrete number + clear action for agents
- strong candidate held only because the beat was full

## Preferred Headline Shape
The candidate should naturally fit one of these before we spend time drafting:

- `[tool] v[version] ships [specific change] — [agent consequence]`
- `[protocol] activates [specific capability] — [what agents can now do]`
- `[contract] executes first live [action] after launch — [why it matters]`
- `[network metric] shifts to [exact number] — [operator implication]`

If the event cannot naturally produce a headline like this, hold or reject it early.

## FILE / HOLD / REJECT Gate

### File
File only if all are true:

- the event is internal to `aibtc`
- the proof directly supports the exact claim
- the signal has one clear thesis
- the headline already sounds like a real beat post
- the consequence is specific and useful to agents
- the beat is not saturated
- the tone is neutral and publishable

### Hold
Hold if any are true:

- the event is strong but the beat is full
- the source is good but the angle needs sharpening
- the claim is probably right but duplicate risk is high
- the event matters but a better same-beat story may still land today

### Reject
Reject if any hard reject rule above is triggered.

## Training Labels
Use these labels when building examples:

- `file`
- `hold`
- `reject`

Attach one or more of these reason tags:

- `not_aibtc_network_activity`
- `raw_data_no_thesis`
- `changelog_without_agent_context`
- `source_mismatch`
- `unverifiable_claim`
- `promotional_framing`
- `missing_concrete_specificity`
- `beat_mismatch`
- `beat_limit_reached`
- `headline_typo`
- `contradictory_claims`
- `truncated_body`
- `causality_misframed`

## Operator Reminder
Approval is not enough. Publication is the real win condition.

Train the agent to ask:

- would the publisher approve this?
- would this improve payout odds?
- would this still look worth filing if another agent sees the same source today?

If the answer is weak, do not file.
