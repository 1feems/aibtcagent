# JSON Schema: AIBTC Onchain Signal Agent

## Schema

```json
{
  "candidate_signal": {
    "candidate_id": "string",
    "detected_at": "ISO-8601 timestamp",
    "beat": "string",
    "category": "protocol-change | liquidity-shift | yield-opportunity | incentive-event | market-structure",
    "summary": "string",
    "significance": "string",
    "causality": "string",
    "detection_method": "mempool | raw-query | contract-analysis | agent-tip | mixed",
    "uses_dashboard_as_primary_source": "boolean",
    "likely_duplicate": "boolean"
  },
  "headline": "string",
  "proof": [
    {
      "chain": "string",
      "tx_hash": "string | null",
      "contract_address": "string | null",
      "query_name": "string | null",
      "query_result": "string | null",
      "block_height": "number | null",
      "proof_note": "string | null"
    }
  ],
  "sources": [
    {
      "source_type": "rpc | api | contract | explorer | documentation | inbox | brief | live-feed | other",
      "source_name": "string",
      "source_url": "string",
      "source_role": "primary-proof | verification | context | intel"
    }
  ],
  "model_disclosure": {
    "tools_used": ["string"],
    "derivation_steps": ["string"]
  },
  "validation_status": {
    "passed": "boolean",
    "checks": {
      "one_sentence_headline": "boolean",
      "onchain_proof_present": "boolean",
      "causality_present": "boolean",
      "sources_disclosed": "boolean",
      "model_disclosure_present": "boolean",
      "independently_verifiable": "boolean",
      "dashboard_primary_source_rejected": "boolean",
      "duplicate_rejected": "boolean"
    }
  },
  "pre_submission_intelligence": {
    "checks": {
    "daily_brief_checked": "boolean",
    "activity_feed_checked": "boolean",
    "leaderboard_checked": "boolean",
    "reputation_checked": "boolean",
    "inbox_checked": "boolean",
    "agent_status_checked": "boolean"
    },
    "notes": ["string"],
    "checked_at": "ISO-8601 timestamp"
  },
  "submission_decision": {
    "status": "submit | reject",
    "rejection_reasons": ["string"]
  },
  "outcome_tracking": {
    "approved": "boolean | null",
    "btc_reward_earned": "string | null",
    "sats_earned": "number | null",
    "leaderboard_movement": "string | null",
    "streak_or_badge_progress": ["string"]
  },
  "generated_at": "ISO-8601 timestamp"
}
```

## Example Output

```json
{
  "candidate_signal": {
    "candidate_id": "sig-2026-03-25-001",
    "detected_at": "2026-03-25T05:12:00Z",
    "beat": "infrastructure",
    "category": "protocol-change",
    "summary": "A new Stacks contract deployed with immediate first-use activity",
    "significance": "the contract appears live before broad public visibility",
    "causality": "the deployment was followed by a first funding and interaction transaction from a whale-sized address",
    "detection_method": "mixed",
    "uses_dashboard_as_primary_source": false,
    "likely_duplicate": false
  },
  "headline": "A newly deployed Stacks contract drew whale-sized first-use activity, signaling a live protocol launch before public dashboards catch up.",
  "proof": [
    {
      "chain": "stacks",
      "tx_hash": "0xabc123",
      "contract_address": "SP11WK0Y2549AKAPDNRKYXGWCHVPJJK2DFX547KGR.launch-v1",
      "query_name": "contract-deploy-and-first-use",
      "query_result": "deployment plus immediate funding interaction confirmed",
      "block_height": 182345,
      "proof_note": "First-use transaction followed deployment within the same monitoring window."
    }
  ],
  "sources": [
    {
      "source_type": "rpc",
      "source_name": "Stacks RPC",
      "source_url": "https://example-rpc.invalid/v2/transactions/0xabc123",
      "source_role": "primary-proof"
    },
    {
      "source_type": "explorer",
      "source_name": "Stacks Explorer",
      "source_url": "https://explorer.hiro.so/txid/0xabc123",
      "source_role": "verification"
    },
    {
      "source_type": "brief",
      "source_name": "AIBTC Daily Brief",
      "source_url": "https://aibtc.news",
      "source_role": "intel"
    },
    {
      "source_type": "live-feed",
      "source_name": "AIBTC Live Activity Feed",
      "source_url": "https://aibtc.com/activity",
      "source_role": "intel"
    }
  ],
  "model_disclosure": {
    "tools_used": [
      "query",
      "clarity-audit",
      "agent-lookup",
      "reputation"
    ],
    "derivation_steps": [
      "Detected deployment and first-use activity from direct chain queries.",
      "Confirmed the contract event and interaction sequence from public chain references.",
      "Checked daily brief and network activity to reduce duplicate risk before composing the headline."
    ]
  },
  "validation_status": {
    "passed": true,
    "checks": {
      "one_sentence_headline": true,
      "onchain_proof_present": true,
      "causality_present": true,
      "sources_disclosed": true,
      "model_disclosure_present": true,
      "independently_verifiable": true,
      "dashboard_primary_source_rejected": true,
      "duplicate_rejected": true
    }
  },
  "pre_submission_intelligence": {
    "checks": {
      "daily_brief_checked": true,
      "activity_feed_checked": true,
      "leaderboard_checked": true,
      "reputation_checked": true,
      "inbox_checked": true,
      "agent_status_checked": true
    },
    "notes": [
      "Latest brief reviewed for duplicate risk."
    ],
    "checked_at": "2026-03-25T05:14:00Z"
  },
  "submission_decision": {
    "status": "submit",
    "rejection_reasons": []
  },
  "outcome_tracking": {
    "approved": null,
    "btc_reward_earned": null,
    "sats_earned": null,
    "leaderboard_movement": null,
    "streak_or_badge_progress": [
      "active"
    ]
  },
  "generated_at": "2026-03-25T05:15:00Z"
}
```

## Notes

- `candidate_signal` captures the internal detection record before final submission.
- `headline` is the newsroom-ready one-line output.
- `proof`, `sources`, and `model_disclosure` are mandatory for publishable signals.
- `pre_submission_intelligence` records the final intelligence pass before filing.
- `outcome_tracking` is carried with the payload for compatibility, but canonical approval and reward results should be read from the outcome files in `data/outcomes/`.
