# Product Requirements Document: AIBTC Onchain Signal Agent

## Product Name
AIBTC Onchain Signal Agent

## Document Purpose
This PRD defines the MVP requirements for an AIBTC agent that detects early, non-obvious onchain events, verifies their cause, and submits newsroom-ready one-line signals with full proof and disclosure.

It explains what the agent accepts, what it does, what it returns, what it must reject, and what is in scope for the first working version.

## Product Overview
The AIBTC Onchain Signal Agent is an early detection and verification system for the AIBTC network.

It is not a dashboard scraper, not a generic market commentator, and not a long-form reporting tool. Its role is to identify meaningful onchain changes before they become obvious, verify them directly from chain data, explain causality, and produce a newsroom-compatible signal that can be submitted to the AIBTC network.

The product is designed for a competitive environment where many agents may observe similar events, but only the strongest, clearest, earliest, and most verifiable signals are likely to be selected.

This product is intended to operate as a persistent autonomous agent with repo-side memory.

Implication:
- the system should preserve what it learns in code, docs, reports, state files, and outcome logs
- the next agent session should be able to continue from repo state without the user repeating the operating model
- strategy, losses, winning patterns, and candidate context should be written back into the repository whenever they materially affect future decisions

## Product Goal
The goal of the agent is to produce submission-ready news signals that outperform competing agents on:
- speed
- verifiability
- causal insight
- editorial clarity

The agent should consistently detect meaningful events before dashboards surface them, prove them with onchain evidence, and format them as one-line newsroom headlines with complete disclosure.

Operationally, the goal is not only to produce good signals in one session.
The goal is to build an agent that can run day after day with minimal user re-explanation.

## Business Objective
The business objective of the agent is to maximize approved signals, sats earned, BTC rewards earned, leaderboard position, and weekly bonus eligibility over the next 30 days.

The agent is not optimizing for raw submission volume. It is optimizing for high-probability signal selection and reward-adjusted output quality.

## Reward Model
The agent operates in a network where successful work can produce both:
- financial rewards
- progression and reputation outcomes

For this product:
- sats are the smallest unit of Bitcoin and act as the network's native payment and reward unit
- earned can mean either direct financial compensation or unlocked profile achievements

The PRD should therefore treat success as a mix of:
- approved news signal rewards
- leaderboard progression
- weekly bonus eligibility
- consistency and streak outcomes

## Primary Beneficiary
- AIBTC newsroom / publisher

## Secondary Beneficiaries
- agent operator
- downstream AIBTC workflows that may inspect or validate signals

## Primary Use Case
The agent continuously monitors raw onchain activity and adjacent protocol events, identifies a candidate event worth reporting, verifies the cause of the event using direct proof, converts it into a one-line headline, attaches proof and sources, validates the package against publication rules, and submits it only if it fully qualifies.

The system should also record whether the signal later generated an economic outcome such as approval, sats, BTC rewards, or leaderboard improvement.

## Product Scope
This is one agent with five tightly scoped layers:
- detection
- verification
- formatting
- validation
- submission

These are not separate products. They are parts of one signal pipeline.

## Product Boundaries
The MVP focuses on building a reliable signal decision system first.

The agent must:
- detect candidate events from raw or near-raw sources
- reject weak or duplicate candidates
- verify events with onchain proof
- explain causality
- produce a one-line newsroom headline
- attach proof, sources, and model disclosure
- prepare a submission-ready payload

The agent must not:
- rely primarily on dashboards
- submit reports instead of headlines
- submit unverifiable claims
- hide tools, sources, or reasoning steps
- optimize for volume over quality
- use real-money trading strategies as part of the MVP reward strategy

## Strategic Positioning
The agent should be positioned as an early onchain intelligence system for AIBTC.

Its edge comes from combining:
- upstream detection
- strict proof
- causal interpretation
- disciplined rejection logic

This is the core differentiator from agents that scrape visible dashboards or summarize public activity after it is already obvious.

## Competitive Strategy
The agent should maximize selection probability by focusing on signals that are:
- early enough to beat duplicates
- difficult to discover from dashboards
- strongly supported by direct proof
- easy to validate independently
- specific enough to fit a recognizable beat

The agent should prefer a small number of high-performing lanes over broad noisy coverage.

## Core Execution Loop
The agent must follow this operating loop:

1. Detect candidate events from raw blockchain activity, mempool data, direct queries, or protocol-level changes
2. Filter out events that are obvious, indexed, widely visible, weak, or likely duplicated
3. Verify the event with exact onchain evidence
4. Interpret the event by identifying the cause, trigger, or mechanism behind it
5. Format the result into a one-line news headline
6. Attach proof, sources, and model disclosure
7. Validate the full package against editorial and publication rules
8. Submit only if every required condition is satisfied
9. Observe whether the submission was approved, rewarded, ignored, or beaten by a competing signal
10. Update memory and strategy based on the result

Step 10 is mandatory.
If the agent learns:
- what won
- what lost
- why a signal missed In Brief
- which correspondents are setting the bar
- what candidate set is under active consideration

then that learning should be persisted into the repo so a future agent run can use it immediately.

If any stage fails, the signal must be rejected.

## Signal Categories
The agent may monitor multiple signal categories over time, but the category model should stay explicit.

Initial category set:
- protocol changes
- liquidity shifts
- yield opportunities
- incentive-related events
- market structure changes when directly provable

The MVP should support this category model even if only one category is implemented end to end first.

## Recommended First Signal Lane
The recommended first implementation lane is:
- protocol changes

Reason:
- more directly verifiable than many yield or liquidity claims
- less dependent on dashboard-style interpretation
- easier to prove with contract deployment, upgrade, or first-use evidence
- more resilient to duplication when tied to exact onchain triggers

The first implementation should begin with a fixture-backed raw source so the lane can be validated end to end before live external integrations are added.

## Secondary Experimental Lane
After the first signal lane is stable, the agent may test one secondary lane with controlled experimentation.

The purpose of the secondary lane is to discover whether a different category can improve approval rate or sats earned without weakening overall quality.

## Inputs
The MVP should define inputs at the candidate-event level.

The agent may accept or derive:
- raw chain events
- mempool observations
- direct query results
- contract analysis results
- beat or category context
- recent signal memory for deduplication

The internal pipeline should normalize these into a single candidate signal structure before validation.

## Request Flow
The internal request flow should work like this:

1. Receive a candidate event from a detection source
2. Normalize it into a candidate signal record
3. Enrich it with exact proof and source references
4. Determine whether there is a defensible causal explanation
5. Draft a one-line news headline
6. Run hard validation and rejection checks
7. Mark as `accepted_for_submission` or `rejected`
8. If accepted, return or file the submission payload

For the first implementation lane, the raw input may come from controlled fixtures that emulate protocol-update detections until live source integration is added.

## Output
The agent returns a submission decision object.

### Top-Level Output Sections
- headline
- proof
- sources
- model_disclosure
- validation_status
- submission_decision
- rejection_reasons
- outcome_tracking
- generated_at

## Output Contract
Every valid submission must include:

### Headline
- exactly one sentence
- news-style wording
- clear statement of what happened
- clear indication of why it matters or why it happened
- concise enough to scan instantly

### Proof
- transaction hash, contract reference, query result, or equivalent exact onchain evidence
- enough detail for independent verification

### Sources
- every public source used
- no hidden inputs

### Model Disclosure
- tools used
- reasoning or derivation steps at a high level

### Validation Status
- pass or fail

### Submission Decision
- submit or reject

### Outcome Tracking
- whether the signal was approved
- whether sats or BTC were earned
- whether leaderboard position improved
- whether the signal contributed to a streak or achievement

## Editorial Standard
The most important editorial rule is:
- the publisher wants news, not reports

Every signal must:
- be written as a single sentence
- read like a headline
- communicate the key event immediately
- avoid explanation-heavy formatting

If the output reads like a report, it fails.

## Publication Requirements
For a signal to qualify for publication, it must include:
- full model disclosure
- onchain provenance
- fully disclosed public sources
- universal verifiability
- public traceability

If any requirement is missing, the signal must not be submitted.

## Rejection Logic
The agent must reject a signal if any of the following are true:
- it comes primarily from a dashboard or indexed public data source
- it is likely duplicated by other agents
- it lacks exact onchain proof
- it does not explain causality
- it cannot be written as one sentence
- it lacks full source disclosure
- it lacks model disclosure
- it cannot be independently verified

These are hard rules, not soft preferences.

## Competitive Rules
The agent must behave as if it is operating under daily competition.

That means:
- early detection is required continuously, not occasionally
- advanced tools are effectively required for competitive signals
- dashboard-first discovery is a losing strategy
- combined change plus cause plus proof is preferred over simple event summaries
- consistency matters because leaderboard and streak outcomes compound over time
- winning the same category repeatedly is more valuable than spreading effort across weak categories

## Skills and Tooling
The agent should reuse AIBTC-native capabilities where possible instead of building every function from scratch.

Relevant AIBTC skills and tools include:
- `aibtc-news`
- `aibtc-news-protocol`
- `aibtc-news-deal-flow`
- `aibtc-news-correspondent`
- `aibtc-news-fact-checker`
- `aibtc-news-scout`
- `aibtc-news-sales`
- `aibtc-news-classifieds`
- `query`
- `mempool-watch`
- `validation`
- `clarity-audit`
- `yield-hunter`
- `tenero`
- `yield-dashboard`
- `defi`
- `paperboy`
- `agent-lookup`
- `reputation`

These tools and skills should be treated as execution capabilities. The agent remains responsible for deciding what counts as a valid signal and whether it should be submitted.

## Core Repositories
The agent should be built with awareness of the core AIBTC repositories that support uptime, payments, newsroom participation, and reputation tracking.

Relevant repositories include:
- `loop-starter-kit` for the autonomous loop and heartbeat-oriented runtime structure
- `x402-sponsor-relay` for gasless Stacks transaction support where applicable
- `agent-news` for newsroom mechanics such as beats, signals, and briefs
- `aibtc-mcp-server` for Bitcoin-native agent tooling across wallets, payments, DeFi, and related operations
- `skills` for reusable AIBTC execution capabilities
- `erc-8004-indexer` for tracking reputation and agent-network events
- `x402-api` for x402 payment and asset endpoints
- `landing-page` as an optional reference for a future public-facing interface

These repositories should inform implementation strategy even when the MVP only integrates a subset directly.

Archived or legacy repositories:
- `aibtcdev-backend` should be treated as archived reference material only and should not be a dependency for the active MVP

## Technical Stack
The agent should align with the dominant AIBTC implementation stack where practical.

Preferred stack assumptions:
- `TypeScript` for the core runtime, integrations, and agent logic
- `Shell` for setup and automation scripts where useful
- `Python` only when it clearly improves a bounded task
- `Clarity` for understanding and interacting with Stacks smart contracts when contract-level behavior matters

The MVP should stay TypeScript-first unless a specific integration requires otherwise.

## Hosting and Deployment Model
The technical design should support lightweight and low-cost deployment patterns that match the broader AIBTC ecosystem.

Preferred hosting assumptions:
- serverless-friendly components where possible
- Cloudflare Workers or similar lightweight runtimes for supporting services and indexers
- low-cost scheduled or looped execution for the main agent runtime
- GitHub-hosted automation as the default MVP execution path

The architecture should separate:
- the main agent loop
- supporting network or indexing helpers
- optional public-facing interface components

## Deprecation and Dependency Rules
The engineering plan should prefer active repositories and avoid building on archived components when an active replacement exists.

Specifically:
- do not rely on `aibtcdev-backend` as a core dependency
- route active Bitcoin, Stacks, payment, and skill operations through maintained components such as `aibtc-mcp-server`, `skills`, `loop-starter-kit`, and related active tooling

## Public Interface Direction
The MVP does not require a public dashboard, but if one is added later it should be treated as a separate optional layer.

If a public-facing interface is added, it may show:
- leaderboard position
- selected signals
- beat focus
- streak and activity status
- selected performance metrics

The `landing-page` repository may be used as a reference point for future public presentation, but it is not part of the MVP critical path.

## Runtime Infrastructure Strategy
The agent should prioritize low-cost, high-uptime infrastructure that supports:
- continuous heartbeat and activity presence
- reliable scheduled or looping execution
- low-friction updates
- persistent observability

The runtime should be designed so that uptime supports:
- active status
- streak progression
- inbound paid message opportunities
- continuous signal discovery

## Cost Efficiency Strategy
The agent should avoid unnecessary spending of earned sats.

When possible, the system should:
- use gas-efficient or gasless transaction paths
- preserve earned sats for high-value coordination or operations
- use secondary earnings to fund optional network actions
- avoid requiring the operator to deposit real money for normal operation

## Operational Requirements
The system must be designed to operate within the AIBTC network model.

That includes:
- agent installation and registration
- maintaining active runtime behavior
- joining or operating within a newsroom beat
- supporting authenticated signal filing
- preserving traceability of outputs and changes
- tracking whether the agent is receiving sats, approvals, streak progress, or other measurable rewards

The agent should be buildable as a continuous looped worker rather than as a one-shot script.

## Newsroom Beats
The agent should operate within a clearly defined editorial beat so that its output remains differentiated and strategically focused.

Relevant beat types include:
- protocol updates
- deal flow
- emerging stories / scout
- field correspondent
- fact-checking
- advertising sales
- classifieds

The agent should claim one primary beat first, then expand only after it demonstrates consistent performance in that lane.

## Paperboy Role
The network also supports a Paperboy distribution role, which is separate from the core signal-filing workflow.

Paperboy activity is valuable because it can:
- generate sats without waiting for a signal to be approved
- build a small treasury for paid messaging and other network actions
- provide a lower-risk support income stream while the main signal strategy matures

Known Paperboy incentives include:
- 500 sats per placement
- 2,000 sat referral bonus for each new correspondent referred

Known Paperboy skill endpoint:
- `agent-skills.p-d07.workers.dev/skills/paperboy`

The Paperboy role should be treated as a secondary operational mode, not the primary identity of this agent.

## Paperboy Scope Decision
For this product, Paperboy participation should be included as an optional secondary earnings path.

The agent may support Paperboy operations later if:
- the core signal pipeline is already stable
- the additional operational complexity does not distract from news-signal quality
- the sats earned can usefully fund messaging and coordination

The MVP should not prioritize Paperboy work ahead of strong newsroom signal generation.

## Authentication Requirement
Submissions must be attributable to the registered agent identity.

The design should therefore assume:
- a persistent agent identity
- authenticated filing
- integrity of submission payloads

The operator should also claim the agent on X where required for reward attribution.

## Source Scope
The agent must use public and reproducible sources only.

### In-Scope Sources
- mempool observations
- raw blockchain query results
- contract deployment or interaction data
- public explorer references
- AIBTC newsroom and skill interfaces
- public protocol documentation where needed for context
- AIBTC live activity feed
- aibtc.news daily brief
- inbound agent messages as lead sources only

### Out-of-Scope Sources
- private data
- unverifiable leaks
- hidden internal dashboards
- unsupported social claims without direct proof

## Source Priority
For signal generation and validation, the agent should prefer:
1. direct onchain proof
2. raw query or mempool evidence
3. contract-level verification
4. public documentation for context
5. dashboard views only as secondary confirmation, never as the primary source

## News Sourcing Model
The agent does not summarize third-party articles as its primary workflow.

It generates original reporting from:
- mempool and unconfirmed transaction monitoring
- direct onchain queries
- contract and protocol analysis
- structured network skill outputs
- agent-to-agent tips that are independently verified before submission

The agent may use the following sourcing paths:
- `mempool-watch` for early Bitcoin transaction detection
- `query` for Stacks and protocol activity
- `clarity-audit` for contract-level interpretation and causal verification
- `tenero`, `yield-dashboard`, and `defi` for structured market and liquidity data, never as blind dashboard-only sourcing
- x402 inbox activity as a lead source for tips, bounties, and strategic intelligence

Editorial skills then convert verified findings into one-line news headlines.

## Memory and Observability
The agent must log and retain enough information to support auditability and iteration.

It should track:
- every candidate signal considered
- whether it was accepted or rejected
- why it was rejected
- tools used
- final output
- timing of successful submissions
- approved signal count
- sats earned
- BTC earned
- leaderboard movement
- streak and badge progress where visible
- category-level win rates
- duplicate-loss rates
- observed leaderboard movements
- daily brief topic patterns
- beat saturation signals from live activity
- whether pre-submission checks were completed
- whether inbox or network-intelligence inputs changed the submission decision

This supports debugging, adaptation, and future performance improvement.

## Network Intelligence Loop
The agent should continuously monitor public network meta-signals so it can adjust strategy without drifting from the source-of-truth rules.

Relevant network-intelligence inputs include:
- x402 inbox traffic for real-time operator and agent chatter
- the daily `aibtc.news` brief to analyze what was actually selected
- `agent-lookup` to observe active agents and registry activity
- `reputation` to inspect visible network standing and feedback
- the live activity feed to detect beat saturation, new opportunities, and changing agent behavior

These sources should influence:
- beat focus
- duplication avoidance
- headline phrasing calibration
- category prioritization
- submission timing

They must not override proof requirements.

## Pre-Submission Intelligence Checks
Before submitting any signal, the agent should run a final intelligence pass that combines editorial review, network awareness, and operational readiness.

The agent should check:
- whether the signal is still novel relative to the latest daily brief
- whether active competitors appear to be saturating the same beat
- whether inbox activity contains useful strategic hints
- whether there are open side-income opportunities worth noting
- whether the agent's own status and attribution are properly configured

These checks should improve selection probability without weakening the proof standard.

## Pre-Submission Checklist
Immediately before submission, the agent should verify:

### Signal Quality
- the headline is exactly one sentence
- the signal explains causality
- exact onchain proof is attached
- all sources are disclosed
- all tools used are disclosed
- the signal remains independently verifiable
- the signal does not rely primarily on dashboard-visible data
- the signal does not appear to be a near-duplicate

### What Is Already Winning
- the latest `aibtc.news` brief has been checked
- recently selected signals have been reviewed for duplication risk
- the headline style remains consistent with what the publisher is selecting

### Competition and Beat Saturation
- `agent-lookup` has been checked for active agents
- `reputation` has been checked for visible network standing
- the current beat does not appear oversaturated relative to alternatives inside scope

### Inbox and Side Opportunities
- x402 inbox activity has been checked for useful strategic hints
- inbound agent messages have been treated as tips, not proof
- open bounties or side-income paths have been noted when relevant

### Agent Status
- heartbeat is active
- reward attribution setup is complete
- identity configuration remains intact
- the agent has enough sats for necessary outbound coordination when needed

## Performance Model
The agent should evaluate itself primarily on real outcomes, not internal confidence alone.

Primary performance metrics:
- approved signals count
- sats earned
- BTC rewards earned
- weekly bonus attainment
- leaderboard movement
- streak continuity

Secondary performance metrics:
- total submissions
- approval rate
- time from detection to submission
- rejection rate
- duplicate-loss rate
- category win rate
- beat win rate

The agent should treat approved signals and earned rewards as the most important proof that the strategy is working.

## Leaderboard Optimization
The agent should explicitly optimize for leaderboard performance over the current 30-day window.

That means:
- maintaining daily operating consistency
- favoring signals with high expected selection probability
- avoiding low-value submissions that dilute approval rate
- preserving a repeatable beat identity
- using actual outcomes to refine focus quickly

The primary leaderboard strategy should remain approved-signal performance, while secondary network roles such as Paperboy may provide supporting sats and operational funding.

The agent should also monitor leaderboard and agent activity to infer:
- which beats appear crowded
- which agents are winning repeatedly
- which styles of signal are being selected
- whether it should stay the course or shift emphasis within its approved scope

## Secondary Earnings Strategy
The agent should maintain awareness of secondary earning paths that can strengthen its treasury without using the operator's real money.

Relevant secondary paths include:
- inbound x402 message earnings
- philanthropist drops when available
- bounties discovered through `bounty-scanner`
- Paperboy distribution work after the core signal lane is stable

These should support the main news strategy rather than replace it.

## Achievement and Progression Awareness
The network also exposes progression through badges, streaks, and visible activity markers.

For this product, those signals matter as secondary indicators of health and consistency, but they must not displace the primary goal of earning approval and rewards from strong news signals.

The system may track achievements such as:
- active status
- streak progress
- messaging-related badges
- inscription or other operational badges

These should be logged when visible, but the MVP should not optimize for badge farming ahead of signal quality.

## Missing Data Handling
The agent must not invent unsupported claims.

If a candidate event cannot be fully verified:
- reject it
- record the reason
- do not fill missing proof with inference

If context exists but proof is incomplete:
- keep it as internal candidate memory if useful
- do not submit it as a final signal

## MVP Scope
The first working version must:
- define one stable candidate signal structure
- define one stable submission payload structure
- implement hard validation and rejection logic
- generate a one-line headline
- support proof, sources, and model disclosure fields
- support deduplication checks
- support at least one real detection lane end to end
- produce a submit or reject decision reliably
- track whether submissions later produce approvals or rewards
- track basic performance metrics tied to leaderboard success
- support one clearly defined primary newsroom beat
- ingest public network meta-signals from the daily brief and live activity feed

## Out of Scope for MVP
The MVP does not need:
- polished frontend interfaces
- broad multi-beat orchestration
- support for every possible skill
- advanced ranking systems
- complex reputation-aware scoring
- autonomous strategy switching across many categories
- private data ingestion
- long-form analytics or report generation
- real-money trading strategies
- optimizing for non-news earning paths like speculation or lending
- Paperboy automation before the core signal lane is working well

## Failure Cases
The agent should explicitly handle these failure scenarios:
- event detected too late because source was already indexed
- proof exists but causality cannot be established
- causality is plausible but proof is incomplete
- signal is valid but likely duplicated
- headline is multi-sentence or too vague
- sources are incomplete
- tools produce conflicting interpretations
- event matters operationally but cannot be expressed as publishable news

In each case, the system should reject rather than degrade standards.

## Success Criteria
The MVP is successful if it:
- consistently rejects weak candidates
- produces valid one-line newsroom signals
- includes complete proof, sources, and disclosure
- supports one real signal lane from intake to final decision
- is easy to inspect, debug, and extend
- is clearly aligned with AIBTC newsroom rules
- can measure whether signals are actually getting approved and earning rewards
- gives the operator a clear view of what is working over the 30-day competition window

## Build Order
To reduce complexity and keep the MVP strong, implementation should happen in this order:

1. define the submission contract
2. define validation and rejection logic
3. define the candidate event structure
4. implement one real detection lane
5. implement verification and causal enrichment
6. implement submission packaging
7. add memory, observability, and outcome tracking
8. measure approvals, rewards, and category performance
9. expand to additional categories only after the first lane works

## Implementation Checklist

### Phase 1: Lock the Core Contract
- define the candidate signal schema
- define the submission payload schema
- define literal validation fields
- define rejection reason codes

### Phase 2: Build the Validation Layer
- enforce one-sentence headline rule
- enforce proof requirement
- enforce source disclosure requirement
- enforce model disclosure requirement
- enforce no-dashboard-primary-source rule
- enforce duplicate rejection
- enforce causality requirement

### Phase 3: Build the First Detection Lane
- choose one category
- connect one raw detection source
- normalize raw detections into candidate events
- enrich with exact proof
- generate draft headlines

### Phase 4: Build Submission Packaging
- assemble the final payload
- include proof
- include sources
- include model disclosure
- include validation decision

### Phase 5: Add Observability
- log detections
- log rejections
- log accepted signals
- store reasoning traces at a high level
- store timestamps and tool usage
- store approval outcomes
- store sats and BTC earned when visible
- store category and beat performance
- store whether pre-submission checks were completed
- store which network-intelligence inputs influenced final submission decisions

### Phase 6: Validate MVP
- confirm at least one category works end to end
- confirm weak signals are rejected correctly
- confirm headlines remain newsroom-compliant
- confirm outputs are publicly verifiable
- confirm the system is extensible to more categories
- confirm outcomes can be measured against earnings and approvals
- confirm pre-submission checks are consistently enforced

## 30-Day Feedback Loop
The agent must adapt based on actual performance during the 30-day competition window.

It should learn from:
- which signals were approved
- which signals earned sats or BTC
- which categories produce the best approval rate
- which submissions lose due to duplication
- which headlines underperform despite strong proof

It should use that feedback to:
- prioritize stronger lanes
- tighten rejection thresholds
- improve timing
- refine headline composition
- reduce effort on low-performing categories

## MVP Must Work Before Expansion
Before adding more categories, beats, or strategy layers, the MVP must already prove that:
- one valid lane works end to end
- the output contract is stable
- rejection logic is reliable
- proof and disclosure are complete
- newsroom formatting stays intact

## Build Rule
Build the validation and decision system first.

Only after the agent can reject weak signals reliably should additional detection complexity be added.

This is the safest path because in AIBTC a weak submission is worse than no submission.

## Build Notes

### Build Principles
- keep the action space small
- use explicit schemas
- prefer reproducible proof over freeform reasoning
- reject aggressively when standards are not met
- add categories only after the first one is stable
- keep source disclosure complete and literal

### Filesystem as Working Memory
The implementation should use the filesystem or equivalent durable storage as working memory for:
- source notes
- candidate signal logs
- accepted and rejected outputs
- test fixtures
- example submissions

This improves reproducibility, debugging, and auditability.

### Stable Context
To reduce drift:
- keep the concept note stable
- keep the PRD stable
- keep schemas stable
- change prompts or agent instructions incrementally
- preserve example fixtures for regression checks

### Reproducible Verification
Whenever possible, use scripts, structured files, and deterministic tool calls for:
- chain data retrieval
- proof capture
- contract analysis
- candidate normalization
- payload generation

This is preferable to relying on one-pass reasoning because it is easier to inspect and validate.

### Safety Rule
Do not add complexity unless it clearly improves signal quality or reliability.

Avoid:
- too many signal categories at once
- too many moving parts before the first lane works
- broad dashboard integrations as primary inputs
- verbose output formats that break newsroom requirements

### Final Build Principle
Finish the smallest strong version first.

The MVP should:
- detect one category well
- validate rigorously
- reject weak signals reliably
- produce a newsroom-ready payload
- be easy to inspect and extend

Secondary earnings paths such as Paperboy can be added later if they support the main newsroom strategy without distracting from it.
