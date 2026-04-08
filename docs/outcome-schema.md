# Outcome Schema

## Purpose
This document defines the minimal structure for recording what the agent learns after each run or submission cycle.

## Schema

```json
{
  "run_id": "string",
  "run_at": "ISO-8601 timestamp",
  "beat": "string",
  "category": "string",
  "candidate_count": "number",
  "submitted_count": "number",
  "rejected_count": "number",
  "approved_count": "number | null",
  "sats_earned": "number | null",
  "btc_reward_earned": "string | null",
  "leaderboard_movement": "string | null",
  "badge_progress": ["string"],
  "duplicate_losses": "number",
  "brief_checked": "boolean",
  "activity_checked": "boolean",
  "agent_lookup_checked": "boolean",
  "reputation_checked": "boolean",
  "inbox_checked": "boolean",
  "notes": ["string"]
}
```

## Example

```json
{
  "run_id": "run-2026-03-25-01",
  "run_at": "2026-03-25T14:00:00Z",
  "beat": "protocol-updates",
  "category": "protocol-change",
  "candidate_count": 4,
  "submitted_count": 1,
  "rejected_count": 3,
  "approved_count": null,
  "sats_earned": 100,
  "btc_reward_earned": null,
  "leaderboard_movement": null,
  "badge_progress": [
    "active"
  ],
  "duplicate_losses": 0,
  "brief_checked": true,
  "activity_checked": true,
  "agent_lookup_checked": true,
  "reputation_checked": true,
  "inbox_checked": true,
  "notes": [
    "Protocol beat remained less crowded than deal-flow.",
    "One candidate was rejected because causality was weak."
  ]
}
```
