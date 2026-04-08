# Training Dataset

## Purpose
This dataset teaches the agent to optimize for the real newsroom objective:

- `in_brief` = best outcome
- `approved_not_in_brief` = passed editorial review but lost the slot
- `rejected` = not worth filing or packaged incorrectly

Use this dataset with:

- [`docs/rejection-rules.md`](./rejection-rules.md)
- [`docs/brief-win-rules.md`](./brief-win-rules.md)

## Files

- `data/training/in-brief.jsonl`
- `data/training/approved-not-in-brief.jsonl`
- `data/training/rejected.jsonl`

Each line is one JSON object.

## Schema

```json
{
  "label": "in_brief | approved_not_in_brief | rejected",
  "beat": "string",
  "headline": "string",
  "source_context": {
    "kind": "internal_operator_story | external_but_actionable_agent_story | external_descriptive_story",
    "scope": "aibtc_internal | broader_agent_environment | mixed",
    "proof_type": "release | pr | api | onchain | report | article | mixed"
  },
  "strengths": [
    "string"
  ],
  "weaknesses": [
    "string"
  ],
  "reason_tags": [
    "string"
  ],
  "fact_checker": {
    "exact_claim_supported": true,
    "source_match": true,
    "number_verifiable": true,
    "causality_supported": true,
    "operator_implication_supported": true
  },
  "brief_competition": {
    "same_day_competition_known": true,
    "broadest_story_on_beat": true,
    "lost_to_broader_same_beat_story": false
  },
  "scores": {
    "specificity": 1,
    "breadth": 1,
    "operator_consequence": 1,
    "publication_readiness": 1
  },
  "training_note": "short explanation of why this example belongs in this class"
}
```

## Scoring Guidance

Use `1-5`:

- `specificity`
  - `1` = vague, abstract, or padded
  - `5` = exact version, number, mechanism, or proof anchor

- `breadth`
  - `1` = narrow sub-update or isolated factoid
  - `5` = strongest same-beat story package for the day

- `operator_consequence`
  - `1` = little or no usable implication
  - `5` = clear action or decision change for agents/operators

- `publication_readiness`
  - `1` = filing note or raw observation
  - `5` = already reads like a real brief item

## Labeling Rules

### `in_brief`
Use when:
- the signal won the beat slot
- it reads like a finished article lead
- it is broader, stronger, or more complete than same-day alternatives

### `approved_not_in_brief`
Use when:
- the signal was real and valid
- it passed editorial review
- it likely lost to a broader or stronger same-beat story

### `rejected`
Use when:
- the publisher rejected it
- or it clearly violates the rules enough that it should have been rejected

## Fact-Checker Rules
Treat these as required fields when labeling examples:

- `exact_claim_supported`
- `source_match`
- `number_verifiable`
- `causality_supported`
- `operator_implication_supported`

If one of these is `false`, that should usually appear in `reason_tags`.

## Workflow

1. Add new examples to the correct JSONL file.
2. Copy the headline exactly.
3. Add reason tags from the rejection/win rules.
4. Keep the `training_note` short and concrete.
5. Prefer quality over volume.

## Current Goal
Grow a high-signal training set that teaches the agent:

- what gets rejected
- what gets approved but loses
- what actually wins the paid brief slot
