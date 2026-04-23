---
name: beat-capacity-status
description: "Use this skill when the user asks for AIBTC beat status, beat capacity, accepted beats, approved fill, filled slots, slots open, or which active filing beats are saturated. Produces a table for bitcoin-macro, quantum, and aibtc-network by fetching approved signals from aibtc.news and grouping by the latest approved UTC day."
metadata:
  author: "OpenAI"
  user-invocable: "true"
  entry: "beat-capacity-status/SKILL.md"
  tags: "aibtc, beats, capacity, status, signals"
---

# Beat Capacity Status

## Purpose

Report the accepted AIBTC filing beats and current approved-slot capacity.

Accepted beats:

- `bitcoin-macro`
- `quantum`
- `aibtc-network`

Daily cap: `10` approved signals per beat.

## Fast Path

Run:

```bash
node skills/beat-capacity-status/scripts/beat-capacity-status.mjs
```

The script fetches:

```text
https://aibtc.news/api/signals?beat=bitcoin-macro&status=approved&limit=100
https://aibtc.news/api/signals?beat=quantum&status=approved&limit=100
https://aibtc.news/api/signals?beat=aibtc-network&status=approved&limit=100
```

Then it:

1. Reads each feed's `signals` array.
2. Finds the latest approved day using `utcDate`, falling back to the first 10 chars of `timestamp`.
3. Counts approved signals for that beat on that latest day.
4. Computes `slotsOpen = max(0, 10 - approvedCount)`.
5. Prints this table:

```markdown
| Beat | Approved on latest approved day | Cap | Slots open |
|---|---:|---:|---:|
```

## Manual Fallback

If the script cannot run, fetch the three URLs above directly and group each response by `utcDate`.

Use this table format:

```markdown
| Beat | Approved on latest approved day | Cap | Slots open |
|---|---:|---:|---:|
| `bitcoin-macro` | N | 10 | 10-N |
| `quantum` | N | 10 | 10-N |
| `aibtc-network` | N | 10 | 10-N |
```

Optionally include a short line above the table:

```text
As of <UTC timestamp>, using each beat's latest approved UTC day.
```

## Notes

- Do not use the public beat registry for capacity. It shows all platform beats, including retired ones.
- Do not use lifetime count endpoints for slot fill. Slot fill comes from approved signal feeds grouped by latest approved day.
- If a beat has no approved signals, report `0` approved and `10` slots open.
