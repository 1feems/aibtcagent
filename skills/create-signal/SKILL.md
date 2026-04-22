---
name: create-signal
description: "Use this skill when the user wants to create, repair, review, or prepare an AIBTC signal for filing: draft from a candidate or source set, check whether a draft is sendable, convert notes into the repo's canonical signal template, or produce a filing-ready artifact. Use it even if they do not say 'signal' directly but are asking for an AIBTC filing draft, editorial review, beat-aligned rewrite, or filing-readiness check. Do not use it for recording outcomes or analyzing patterns across many signals."
metadata:
  author: "OpenAI"
  user-invocable: "true"
  entry: "create-signal/SKILL.md"
  tags: "aibtc, signals, editorial, filing"
---

# Create Signal

## Skill Role

- Category: `signal skill`
- Scope: create, repair, review, validate, and prepare one signal artifact
- Use this when: the task is about one signal or one filing-ready package
- Current implementation reference: `docs/build-plan.md`

Use this skill for any request like:
- "give me a signal"
- "create a signal"
- "draft a signal"
- "repair this signal"
- "is this signal sendable"
- "prepare filing-ready"

This skill is repo-local to `aibtcagent`. Do not use global skill copies as source-of-truth when the same material exists in this repo.

## Local Architecture Override — 2026-04-15

The repo now uses an artifact-first signal contract. This section overrides any older guidance below when there is a conflict.

- canonical creation owner: `src/prep/create-signal.ts`
- canonical artifact validator: `src/filing/validate-artifact.ts`
- canonical filed-signal ledger: `data/state/signal-history.json`
- compatibility mirrors only: `data/state/filed-signals.json`, `data/outcomes/approvals/*.json`
- canonical narrative field: `body`
- compatibility alias: `analysis = body`
- canonical fileable unit: JSON with `kind: "create_signal_artifact"`, `status: "in_queue"`, non-empty `body`, matching `analysis`, `{url,title}` sources, disclosure, tags, and full passing `filing_gate`
- non-fileable intermediate unit: JSON with `kind: "intermediate_candidate_artifact"`, `fileable: false`, `non_fileable: true`, `intended_use: "ranking_only"`, `canonical_artifact_required: "create_signal_artifact"`

Never treat dry-run submissions, queue rows, daily report notes, helper form state, or chat drafts as fileable. They must either be converted through `createSignalArtifact()` and pass `validateArtifact()`, or stay explicitly non-fileable.

Before trusting any older instructions in this skill, refer to `docs/build-plan.md` to see what exists now and which constraints are active.

## Goal

Create AIBTC signals through one repeatable loop instead of ad hoc drafting.

Always anchor signal work in the repo's aggregated memory plus the canonical template and beat-specific publisher rules.

Primary business objective:

- every filed signal should be drafted for `brief_included`, not merely `approved`
- `approved_not_in_brief` is a failed business outcome
- helper-safe JSON, validator-safe payloads, and beat-correct formatting are guardrails, not the success condition
- do not stop at "this is valid JSON" — ask "is this likely to make the brief on this beat today?"

## Required Inputs

- beat slug if known
- candidate event, story, or source set
- report date if the user is asking for a dated filing artifact

If the beat is not given, infer the best fit from repo strategy and current beat rules. Do not force a misfit beat.

## Always Load First

Read these files before drafting or judging a signal:

- `docs/document-map.md`
- `docs/workflow.md`
- `docs/build-plan.md`
- `docs/in-brief-success-checklist.md`
- `data/state/editorial-memory.json`
- `data/state/signal-history.json` (canonical filed-signal ledger)
- `data/state/filed-signals.json` (compatibility mirror only when older paths still need it)
- latest dated brief artifact in `data/briefs/` (`.md` or `.json`, whichever is current for the cycle)
- `data/training/in-brief.jsonl` (winning examples)
- `data/training/rejected.jsonl` (rejection patterns)
- `data/training/approved-not-in-brief.jsonl`

Then load the current beat guidance:

- matching beat editor guidance in `docs/beat-editors/` when it exists
- `docs/beat-strategy.md`
- `src/filing/template-rules.ts`
- `src/types/filing-gate.ts`

If beat-specific editor guidance does not exist yet, use the shared template and repo validators, then say the beat has no custom editor overlay yet.

If the beat is `quantum`, you must load `docs/beat-editors/quantum-zen-rocket.md` and apply it as required formatting and validation guidance for the draft. Do not treat the Quantum beat editor guidance as optional.

## Canonical Signal Template

Treat the repo's canonical template as:

- `headline`
- `CLAIM`
- `EVIDENCE`
- `IMPLICATION`
- `Directive`
- `sources`
- `disclosure`

The enforcement source is the repo code, not a hand-written one-off schema:

- `src/prep/create-signal.ts`
- `src/filing/validate-artifact.ts`
- `src/filing/template-rules.ts`
- `src/types/filing-gate.ts`
- `src/filing/filing-gate-validator.ts`

Default body framework:

```text
CLAIM: [one falsifiable assertion]
EVIDENCE: [exact source-backed proof]
IMPLICATION: [what changes for agents/operators/network]
Directive: [specific action]
```

Do not bypass this structure unless the repo validator explicitly supports another format.

## Create-Signal Loop

Run this loop every time:

1. Load memory
Read `data/state/editorial-memory.json`, `data/state/signal-history.json`, and the most recent dated file in `data/briefs/` first. Use `data/state/filed-signals.json` only as a compatibility mirror when a legacy path still requires it.

2. Select beat
Use the user-provided beat or infer the best fit from the candidate and `docs/beat-strategy.md`.

3. Load beat overlay
If matching beat editor guidance exists in `docs/beat-editors/`, apply it as a beat-specific overlay on top of the shared template.

4. Draft using the canonical template
Produce headline, `CLAIM`, `EVIDENCE`, `IMPLICATION`, `Directive`, sources, and disclosure.

5. Check factual integrity
Reject or repair if the draft fails any of these:
- source verification
- quantitative consistency
- temporal coherence
- structural red flags

6. Apply pre-filing checks from editorial memory
Read `data/state/editorial-memory.json` and locate the `preFilingChecks` array. These are rules auto-promoted from repeated rejection patterns (triggerCount >= 2). Every check in that array is a hard gate — fail any candidate that violates them before moving forward.

Key promoted checks to enforce (from recent loss patterns):
- Fail any headline that is truncated, incomplete, or ends mid-thought
- Fail metric-driven claims without explicit dated evidence, snapshot, or commit/PR/tx anchor
- Fail duplicate story shapes already in today's brief or a recent filed signal
- Fail candidates where the anchor (PR number, version, block height, exact sats) is NOT in the headline itself
- Fail any payload where `disclosure` field is empty or missing
- Filing payload must contain `body`; `analysis` is only a compatibility alias that must match `body`
- Sources must be `{url, title}` objects — never plain strings

7. Check editorial fit
Compare against:
- recent losses and wins in `data/state/signal-history.json`
- today's brief patterns in the latest dated brief artifact under `data/briefs/`
- winning examples in `data/training/in-brief.jsonl`
- reject or rewrite drafts that are technically valid but look weaker than current same-beat winners or crowded-beat incumbents

8. Check displacement and domain balance
If the beat or brief is crowded, require a displacement-level reason before recommending filing.

9. Emit one verdict
Return exactly one:
- `filing_ready`
- `repair_and_resubmit`
- `hold`
- `reject`

When the verdict is not `filing_ready`, explain the smallest concrete repair set.

`filing_ready` standard:

- do not use `filing_ready` for a signal that is merely schema-valid or helper-safe
- use `filing_ready` only when the draft is beat-correct, proof-strong, editor-aligned, and still looks plausibly `brief_included`
- if the signal is likely to pass helper checks but unlikely to win a brief slot, return `hold` or `repair_and_resubmit`

## Factual Integrity Gates

Every created or repaired signal must pass these gates before it is treated as filing-ready:

### Gate 1: Source Verification
- commit SHAs must resolve to real commits in cited repos
- PR or issue numbers must exist and match the described content
- CVE or GHSA identifiers must match official advisory records
- transaction hashes must resolve on-chain

### Gate 2: Quantitative Consistency
- percentages must be reproducible from source data
- TVL figures must match on-chain or protocol state within timing tolerance
- agent counts must match registry or network records
- payout amounts must match known schedules or configured rewards

### Gate 3: Temporal Coherence
- no future timestamps presented as completed events
- version progressions must follow real release order
- referenced issues, filings, or signals must predate the signal

### Gate 4: Structural Red Flags
- reject circular sourcing
- reject fake precision or suspiciously round technical metrics without proof
- reject vague "classified" or codename framing without verifiable specifics
- reject listing IDs, deal IDs, or references that do not resolve

## Cluster Occupancy Check

Before running the displacement formula, cross-check the candidate's domain cluster.

Cluster definitions:
- `governance`: governance, dao-watch, agent-economy
- `sbtc-stacks`: sbtc, stacking, bitcoin-yield, defi
- `sovereign-exposure`: agent-economy, governance, bitcoin-macro

Rule:
- If the cluster has fewer than 2 signals approved or in today's brief → cluster has room. Do not apply displacement scoring. Proceed to verdict.
- If the cluster already has 2+ signals → cluster is crowded. Run the displacement formula below before recommending filing.

Do not suppress a candidate on beat-level saturation alone if its cluster has room.

## Displacement Rule

When the cluster is crowded or brief capacity is effectively full, only recommend filing if the new signal clearly displaces a weaker incumbent.

Use this composite frame:

`(source_quality x 0.4) + (domain_coverage_gap x 0.3) + (timeliness x 0.2) + (cross_domain_value x 0.1)`

Operational rule:
- identify the weakest current slot
- displace only if the incoming signal is materially stronger
- do not remove the only representative of a domain cluster just to add a duplicate lane

If displacement evidence is weak, output `hold`.

## Output Contract

When asked to create a signal, return:

- the validated helper-ready JSON emitted by `npm run chat-signal -- --input <create-signal-input.json>`

Do not hand-write chat signal JSON. The chat answer must be generated by the pipeline:

1. build a `CreateSignalInput`
2. run `createSignalArtifact()`
3. run `validateArtifact()`
4. run `buildHelperReadySignalPackage()`
5. return `helperReady.json`

The helper-ready JSON contains `btc_address`, `beat_slug`, `headline`, `body`, `analysis`, `sources`, `tags`, and `disclosure`. Internal artifact fields such as `kind`, `status`, `candidateId`, `sourcePath`, and `filing_gate` are not chat output unless the user explicitly asks for the internal artifact.

When asked if an existing draft is sendable, do not rewrite first. Evaluate against the loop and return the verdict plus the minimal repair set.

## Confirmed Winner Patterns (derived from brief-included signals)

These are the structural patterns that produced every brief_included signal in this repo. Apply them:

**Headline:**
- Must embed the exact anchor: version number (v1.22.0), PR number (PR #190), SIP numbers (SIP-039/040/042), block height, or exact sats amount
- Must name the operator consequence in the same headline — not just the event
- Max 120 characters. Never truncate mid-thought.
- Examples that won: `x402 relay ships v1.24.0 + v1.25.0 same evening — bad payloads rejected early, gap txs queued before burning nonces`

**Body:**
- Field is `body`. `analysis` may exist only as a compatibility alias and must match `body`.
- Include exact commit SHAs when the source is a GitHub release
- Include exact release timestamps (ISO format from the GitHub release tag)
- State the before/after failure mode explicitly: what broke before, what the new behavior is
- Bundle related changes (multiple PRs, multiple versions in one release cycle) into one package story rather than filing each separately
- Max 1000 characters total

**Beat selection:**
- Infrastructure and Deal Flow are our two proven winning beats. Stay in them.
- Quantum is viable if the anchor is a real CVE, real BIP, or real protocol decision — not commentary
- Do not file into beats where we have zero wins unless the signal is exceptionally strong

**Sources:**
- Every source must be a `{url, title}` object — never a plain string
- GitHub release tag URLs and PR comparison URLs are the strongest sources
- Primary source must be external and independently verifiable

**Filing window:**
- File between 04:00 and 10:00 UTC. The 30-slot daily cap fills around 13:00 UTC — signals filed after that face structural HTTP 429 regardless of quality.

## Safety Rules

- Do not invent facts to satisfy the template.
- Do not use `aibtc.news` as circular proof for an `aibtc.news` event when a primary source is required.
- Do not recommend filing a signal absent from repo-backed reasoning.
- Do not treat daily snapshots as the main memory layer when the aggregated files above already exist.
- Do not bypass the repo's fail-closed validators.

## Repo References

Read these only as needed:

- `docs/document-map.md`
- `docs/workflow.md`
- `docs/build-plan.md`
- `src/prep/signal-job.ts`
- `src/prep/create-signal.ts`
- `src/filing/validate-artifact.ts`
- `src/filing/signal-guard.ts`
- `src/filing/filing-gate-validator.ts`
- `src/filing/template-rules.ts`
- `docs/beat-strategy.md`
- `docs/in-brief-success-checklist.md`
