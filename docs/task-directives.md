# Task Directives

Compact session-opening instructions for Claude chats. Paste the relevant section(s) at the top of a new chat to establish context without loading full documentation.

---

## Memory model

Three canonical files. Read from these. Write to these. Nothing else.

| File | Contains |
|------|----------|
| `data/briefs/shared-context.json` | Brief titles, rejected titles, snippets, ranking notes — keyed by Pacific date |
| `data/training/brief-examples.json` | Full winner examples (title, body, sources, tags, disclosure) — keyed by Pacific date |
| `data/state/signal-history.json` | My filed signals and outcomes (pending / approved / rejected / brief_included / cap_blocked / unknown) |

**Deprecated:** `data/my-signals/` is not canonical. Do not read or write it. Personal signal outcomes live in `data/state/signal-history.json`.

**Rule:** When I paste brief context, winner examples, or signal outcomes — update the matching canonical file under the correct Pacific-date key. Do not create new standalone files.

---

## Merging source material

Pull brief titles and rejects from:
- `data/briefs/YYYY-MM-DD.md` (existing dated docs)
- User-pasted brief context in chat

Pull winner examples from:
- User-pasted examples in chat
- Clearly marked winner blocks in dated reports

Pull filed signal history from:
- `data/reports/signals/YYYY-MM-DD.md` → normalize into `data/state/signal-history.json` only if entry is missing

Only merge what is missing. Do not duplicate entries.

---

## Build plan reference

| Priority | Topic | Key file(s) |
|----------|-------|-------------|
| P9 | signal-guard / structured analysis body gate | `src/filing/signal-guard.ts` |
| P33 | Beat specialization: `infrastructure` + `quantum` | `src/scoring/beat-coverage.ts`, `data/state/objective-memory.json` |
| P39 | Quantum source / state / reporting | `src/filing/quantum-map.ts`, `data/state/quantum-tracker.json` |

Full details at `docs/build-plan.md` lines ~425 (P9), ~870 (P33), ~972 (P39).

---

## Signal body structure (P9 enforcement)

Any signal body must contain all three sections or it is blocked before filing:

```
CLAIM: <declarative statement of the specific change>
EVIDENCE: <verifiable artifact — PR/issue/block/API/sats amount>
IMPLICATION: <agent directive using: update|upgrade|avoid|redeploy|watch|pause|check|migrate|monitor>
```

Free-form bodies without this structure fail `hasStructuredAnalysis()` in `src/filing/signal-guard.ts`.

---

## Beat focus (P33)

Primary: `infrastructure`  
Secondary: `quantum`  
Avoid: Agent Economy, Agent Social, Onboarding

Score adjustments applied automatically by `candidate-queue.ts`:
- Primary beat: +8
- Secondary beat: +4
- Memory-deprioritized beat: −10
- Outside two learned lanes: −4

---

## Filing window

Target: **04:00–10:00 UTC** (before the 30-slot cap fills ~13:00 UTC)

If `news_file_signal` returns HTTP 429: set `cap_blocked = true` on the `FiledSignalRecord` in `data/state/signal-history.json`. Do not retry. Do not treat as a quality rejection.

Late-window gate: candidates detected ≥13:00 UTC require score ≥82 to file.
