# Brief Win Rules

## Purpose
This document defines the real optimization target for the agent.

The goal is not merely to get `approved`.
The goal is to get selected `In Brief`.

`In Brief` is the actual paid product.
Approved but not in brief means the signal passed editorial review but lost the publication slot to a broader, stronger, or better-packaged story on the same beat.

Historical winners are training examples, not permission slips.
The publisher may be stricter now than in earlier archive windows, so older winners teach story shape, but current filing decisions should be held to the latest visible bar.

Train the agent to maximize:

- probability of `in_brief`

Not merely:

- probability of `approved`

## Outcome Hierarchy
Use this hierarchy when labeling examples and teaching the agent:

1. `in_brief`
2. `approved_not_in_brief`
3. `rejected`

Interpretation:

- `in_brief` = won the beat slot
- `approved_not_in_brief` = valid, but outcompeted
- `rejected` = failed relevance, framing, sourcing, proof, or timing

## Core Rule
The agent should ask:

- is this true?
- is this provable?
- would the publisher approve it?
- would this beat other same-day stories on the beat?

If the last answer is weak, do not file unless there is no stronger candidate available.

## Regime Shift Rule
Assume editorial strictness can change over time.

Implication:
- an older `In Brief` winner may describe what used to clear, not what clears today
- current-day accepted stories and current-day rejections should outweigh archive-era intuition
- when the latest visible brief looks tighter than historical samples, raise the filing threshold immediately

Training rule:
- weight evidence in this order: `today's brief` > `latest approved/rejected feed` > `recent 7-day patterns` > `older archive winners`
- if the current brief is unusually selective, only file candidates that look stronger than the median historical winner

Reason tags:
- `strictness_regime_shift`
- `archive_bar_too_low`

## What Wins Brief Slots

### 0. Publication Winners Are Broader Than Simple Internal-Network Signals
`In Brief` winners are often not limited to raw `aibtc` internal telemetry.

The winning set includes:
- internal `aibtc` infrastructure and governance changes
- broader Bitcoin, Stacks, security, macro, and agent-tooling stories
- external developments that materially change how agents operate, trade, secure funds, onboard, or allocate capital

Training rule:
- do not overfit to `aibtc`-internal-only sourcing
- instead ask whether the story changes the operating environment for agents in a concrete way

Important nuance:
- raw external news still loses if the agent angle is bolted on
- external stories can win when they are packaged as a strong operator-facing article with exact implications

Reason tags:
- `broad_agent_environment_story`
- `thin_agent_angle`

### 1. The Most Complete Beat Story
The brief tends to pick the most comprehensive same-beat story, not the narrowest technically valid one.

Examples of winning shape:
- two related releases combined into one stronger infrastructure story
- a pricing, taxonomy, and governance change framed as one editorial decision
- a market or network shift tied to a broader structural implication

Training rule:
- prefer the fullest same-day story package over a single isolated sub-update

Reason tag:
- `broader_same_beat_story`

### 2. Finished Article Framing
Winning signals read like finished article leads, not filing notes.

They usually contain:
- a concrete change
- a hard number or exact anchor
- a structural consequence
- a reason agents should care now

Training rule:
- reject or hold signals that read like changelog fragments, dashboard captions, or raw observations

Reason tag:
- `not_article_shaped`

### 3. Structural Consequence Beats Surface Fact
The winner usually explains what the development changes in practice.

Weak:
- version shipped
- fees moved
- count increased

Stronger:
- reliability improved in a specific failure mode
- lower fees open a defined execution window
- taxonomy changes compress category structure and alter pricing or routing

Training rule:
- prefer stories with a mechanism and practical consequence over stories with only a surface fact

Reason tag:
- `structural_implication_present`

### 3b. Strong Macro Or External Stories Can Win If They Alter Agent Decisions
Several `In Brief` winners are not internal product updates at all.

They win because they answer:
- what changed in the market, protocol, legal, or security environment
- why that changes agent behavior now

Examples of winning external shapes:
- Bitcoin fee floor collapse opening a temporary execution window
- ETF or listing changes affecting capital flows and treasury expectations
- major security reports with exact dollar losses and attack-class implications
- protocol upgrades that change signer, contract, or activation requirements

Training rule:
- allow external candidates only when they create a concrete operator decision, risk window, execution window, or capital allocation shift
- reject external candidates that are merely interesting or descriptive

Reason tags:
- `operator_decision_window`
- `external_but_actionable`
- `external_but_descriptive`

### 4. Breadth Without Losing Precision
Winning signals are often broader than approved-only signals, but still precise.

They do not win by being vague.
They win by combining related facts into one strong narrative.

Training rule:
- combine same-day related developments only when they reinforce a single beat thesis
- do not combine unrelated items into a forced bundle

Reason tags:
- `bundled_for_brief_strength`
- `forced_bundle`

### 5. Strong Beat Fit
The signal should feel native to the beat and strong enough to occupy that beat's slot for the day.

Training rule:
- if a candidate is valid but feels secondary on the beat, downgrade it
- ask whether a publisher would spend the beat slot on this story today

Reason tag:
- `weak_for_beat_slot`

## What Approved-But-Lost Usually Means
Signals in this bucket are useful training examples.

They teach the agent what is good enough to pass review but not strong enough to win publication.

Common patterns:

- too narrow compared with the winning same-beat story
- single release when another agent filed the broader multi-release story
- valid proof but weaker headline
- accurate but less complete framing
- beat slot taken by a more useful operator-facing narrative

Use these reason tags:

- `narrower_than_winning_story`
- `lost_to_broader_same_beat_story`
- `weaker_headline_than_winner`
- `less_complete_than_winner`
- `passed_editorial_not_slot_quality`

## Comparison Questions Before Filing
Before filing any candidate, force the agent to answer:

1. What other stories on this beat could be filed today?
2. Is this the broadest useful version of the story?
3. Does this explain the mechanism, consequence, and operator action?
4. Would the publisher choose this over a more complete same-beat alternative?
5. If approved, is it still likely to lose the brief slot?

If the answer to `4` is no or `5` is yes, hold or keep sourcing.

## Brief-Slot Scoring
Teach the agent to score two different things:

### Editorial Pass Score
Can this get approved?

Questions:
- is it relevant?
- is it provable?
- is the beat correct?
- is the framing acceptable?

### Brief Slot Score
Can this win the beat slot?

Questions:
- is it the strongest same-day story on this beat?
- is it broader or more complete than likely competitors?
- does the headline feel publication-ready?
- does it contain structural consequence, not just event description?
- does it help readers more than a narrower filing would?

Training rule:
- do not file based only on editorial pass score
- file only when brief slot score is also high, or when the beat is otherwise open

## Preferred Winning Shapes
These patterns are especially valuable:

- two related infra changes combined into one operator-facing story
- governance or taxonomy change + exact size of change + network consequence
- internal network metrics + exact number + strong interpretation
- security issue + mechanism + concrete exposure
- onboarding or growth event + exact count + why the funnel changed
- macro or external market shift + exact number + immediate agent implication
- protocol or tooling launch + exact capability + what agents can now do

## Anti-Patterns For Paid Optimization
Avoid these if the goal is getting paid:

- single narrow update when a broader same-beat synthesis is possible
- true but boring signals
- exact proof with weak packaging
- signals that look likely to be approved but not likely to be chosen
- isolated factoids that do not occupy a beat slot convincingly

## Beat-Specific Publication Tendencies
Do not use one universal sourcing rule for every beat.

### Agent Economy
Often wins with:
- capital flows
- pricing changes
- fee regimes
- ETF or institutional plumbing
- yield concentration
- network growth with real numbers

Must include:
- exact number
- structural interpretation
- why agents, treasuries, or correspondents should care now

### Agent Trading
Often wins with:
- fee windows
- liquidity or liquidation shifts
- mempool or inscription regime changes
- market structure changes that affect execution conditions

Must include:
- exact market condition
- execution implication
- why this matters now, not eventually

### Security
Often wins with:
- concrete exploit amounts
- named vulnerability classes
- exact exposure windows
- operator or wallet risk with a direct protection takeaway

Must include:
- mechanism
- exposure
- operator consequence

### Infrastructure
Often wins with:
- exact release capability
- activation or upgrade deadlines
- platform/tooling expansions
- reliability changes tied to a known failure mode

Must include:
- exact feature or activation point
- what broke before or what agents can do now

## Updated Filing Heuristic
Before filing, classify the candidate into one of these buckets:

1. `internal_operator_story`
2. `external_but_actionable_agent_story`
3. `external_descriptive_story`

Default behavior:
- file `internal_operator_story` if strong
- file `external_but_actionable_agent_story` only if the operator implication is explicit and strong enough to win the beat
- reject `external_descriptive_story`

## Training Labels
Use these labels in the dataset:

- `in_brief`
- `approved_not_in_brief`
- `rejected`

Recommended extra fields:

- `beat`
- `same_day_competition`
- `winning_story_shape`
- `breadth_score`
- `specificity_score`
- `operator_consequence_score`
- `publication_readiness_score`
- `loss_reason`

## Operator Reminder
The target is payout, not just validation success.

Train the agent to prefer:

- strongest beat story
- broadest truthful same-day synthesis
- clearest operator consequence
- highest probability of publication

Not merely:

- technically valid filing
- approval-only quality
- isolated update with good proof
