# Quantum Beat — Sourcing and Drafting Rules

**Enforcement contract:** `docs/quantum-signal-contract.md`
**Schema:** `config/quantum-signal-schema.json`
**Audit:** `src/filing/pre-submit-audit.ts`

Use this doc before drafting. The contract tells you what blocks; this doc tells you what to look for and how to write it.

---

## 1. Source Discovery Heuristics

Run these in authority order. Stop at the first hit that produces a fileable signal.

### bitcoin-dev mailing list — highest authority
**URL:** `https://gnusha.org/pi/bitcoindev`

Search for: `post-quantum`, `PQC`, `BIP-360`, `CRQC`, `hash-based`, `lattice`, `ECDSA`, `quantum`

**A hit is fileable when:**
- A named developer makes a substantive argument, proposes a change, or changes a prior position
- A new BIP proposal, critique, or acceptance appears
- A specific qubit estimate or timeline claim is cited with a source

**Not fileable:**
- Forwarded announcements without developer commentary
- "+1" or acknowledgment-only replies
- Discussion that mentions quantum as background without a concrete claim

**Source format:** full thread URL, not the list homepage. Confirm the exact post date from the thread header.

---

### Delving Bitcoin — second authority tier
**URL:** `https://delvingbitcoin.org`

Search for: `post-quantum`, `BIP-360`, `PQ signatures`, `SHRIMPS`, `SHRINCS`, `hash-based`, `SLH-DSA`, `FALCON`

**A hit is fileable when:**
- A named researcher posts a new technical proposal, implementation result, or benchmark
- An existing proposal receives a substantive update (new numbers, revised design, merged follow-up)
- A PR or BIP is linked with a concrete implementation outcome

**Not fileable:**
- Threads that only reference external news without adding analysis
- Questions or speculation without a named author making a claim

**Source format:** direct thread URL including the slug. The thread title alone is not sufficient — the specific post must be linked.

---

### ePrint / arXiv — academic tier
**URL:** `https://eprint.iacr.org`, `https://arxiv.org`

Search for: `Bitcoin ECDSA quantum`, `secp256k1 quantum attack`, `hash-based signatures Bitcoin`, `CRQC timeline`, `fault-tolerant quantum Bitcoin`

**A hit is fileable when:**
- A paper gives a concrete new estimate for qubits required to break ECDSA-256
- A paper proposes, analyzes, or benchmarks a scheme that could apply to Bitcoin
- A peer-reviewed result materially changes the threat timeline or the known cost of an attack

**Not fileable:**
- Preprints that have not been through review and whose claims have not been independently reproduced
- Papers on PQC for other chains or systems unless they directly apply to secp256k1 or Bitcoin's signing model
- Survey papers without new results

**Source format:** DOI or arXiv ID required in the signal, not just the title. Confirm the submission date.

---

### BIP repository — implementation tier
**URL:** `https://github.com/bitcoin/bips`

Search for: open PRs and issues mentioning `360`, `post-quantum`, `PQC`, `signature scheme`; watch for authorship changes on existing BIPs

**A hit is fileable when:**
- A new BIP is opened, merged, or advanced that addresses PQC for Bitcoin
- BIP-360 (or a successor) receives a substantive edit, co-author addition, or formal status change
- A PR is explicitly linked to a mailing-list or Delving thread that provides the quoted rationale

**Not fileable:**
- Typo fixes, formatting PRs, or editorial corrections with no technical change
- Draft PRs with no discussion and no linked rationale

**Source format:** PR or issue URL. Record the PR number. Do not cite the BIP file itself — cite the PR that changed it.

---

### Named developer blogs — conditional authority
**Rule:** only fileable if the author is already on the developer map or is a named Bitcoin contributor with an established PQC position.

**Known names to monitor:** Neha Narula, Jonas Nick, Pieter Wuille, Adam Back, Luke Dashjr, Tadge Dryja, Lloyd Fournier, Tim Ruffing

**A hit is fileable when:**
- The developer explicitly states or revises a position on quantum risk, PQC urgency, or a specific scheme
- The post includes a quantitative claim (probability estimate, qubit count, timeline, failure scenario)
- The post date is verified — do not use a cached or undated version

**Not fileable:**
- Posts that only summarize or link to external news without adding the developer's own position
- Posts on adjacent topics (general cryptography, non-Bitcoin protocols) without an explicit Bitcoin connection

**Source format:** full post URL. Confirm the exact publication date from the page metadata, not from a link aggregator.

---

### X / Twitter — lowest acceptable authority, requires confirmation
**Rule:** acceptable only with snowflake ID or date confirmed via snowflake ID. Never sole source for a score change.

**A hit is fileable when:**
- A named developer makes a quantitative or positional claim
- The tweet ID (snowflake) is recorded in `attribution_note`
- A primary-tier source (mailing list, Delving, blog post) backs the same claim

**Not fileable:**
- Anonymous or pseudonymous accounts
- Quote-tweets or retweets where the original author is not the claimed developer
- Threads where the key claim is in a reply that could be edited or deleted

**Source format:** full tweet URL with the numeric ID visible. Record as: `"attribution_note": "X post by [name], snowflake ID [id], date confirmed [YYYY-MM-DD]"`.

---

## 2. Signal Type Decision

| Situation | Signal type |
|-----------|-------------|
| Hardware milestone, new qubit count, new timeline estimate | `quantum_signal` |
| New PQ signature scheme proposed, benchmarked, or merged | `quantum_signal` |
| Bitcoin-vulnerable address count or value change | `quantum_signal` |
| Institution names Bitcoin in PQC migration announcement | `quantum_signal` |
| Named developer makes or updates a public stance on quantum risk | `score_update_signal` |
| Named developer retracts or downgrades a prior position | `score_update_signal` |

**When in doubt:** if you are not touching the developer map, use `quantum_signal`. If you are claiming a score changes, it must be `score_update_signal` with full `pre_signal_validation`.

---

## 3. Score Update — Pre-Draft Checklist

Run this before writing a single word of the signal. If any step fails, stop.

1. **Fetch the live dataset.** `GET https://quantum-power-map.p-d07.workers.dev/data.json`. Record the timestamp.
2. **Locate the subject.** Find the developer by name in the JSON. If not found, the signal cannot be a score update for that subject — stop.
3. **Record the current score.** This is `dataset_current_score` and `claimed_previous_score`. They must be equal.
4. **Verify the primary source.** Open the URL yourself. Confirm the exact claim is present at that URL, not inferred from a summary.
5. **Determine the new score.** The new score must differ from the current score and be an integer 1–5.
6. **Check for prior coverage.** Search `data/state/filed-signals.json` for any prior signal on this subject. If one exists and covers the same event, stop — this is a duplicate.
7. **Check source URLs.** Fetch each source URL and confirm HTTP 200. Record the status.
8. **Compute readiness math if needed.** If the signal will mention the readiness index, compute `after_index = before_index + score_delta` from the live dataset before writing.

**Do not draft the signal until all eight steps are complete.** The audit will block any signal where the baseline was assumed rather than fetched.

---

## 4. Generation Rules — `quantum_signal`

**Required before filing:**
- `beat_slug`: `quantum`
- `signal_type`: `quantum_signal` (set explicitly — do not omit)
- `tags`: must include `"quantum"`
- `headline`: ≤ 120 chars, no trailing period, specific date in the text
- `analysis`: 150–400 chars target, hard max 1000; claim → evidence → implication structure
- `sources`: all URLs must return HTTP 200; at least one primary-tier source
- `disclosure`: model name + tools used + steps taken

**Strongly recommended (`pre_signal_validation`):**
Include even when not technically required. The audit enforces it for `score_update_signal` but a filed `quantum_signal` without it is vulnerable to a fact-check correction.

Minimum recommended validation block for `quantum_signal`:
```json
{
  "dataset_url": "https://quantum-power-map.p-d07.workers.dev/data.json",
  "dataset_checked_at": "<ISO-8601 UTC timestamp>",
  "subject_name": "<developer name exactly as in data.json, or omit if no subject>",
  "source_urls": ["<url1>", "<url2>"],
  "url_checks": [
    { "url": "<url1>", "status": 200 },
    { "url": "<url2>", "status": 200 }
  ],
  "duplicate_check": { "checked": true, "duplicate_found": false },
  "scope_check": { "passed": true, "category": "<one of five enums>" },
  "bitcoin_relevance_check": { "passed": true, "bitcoin_named": true },
  "exact_claim_check": { "passed": true },
  "reviewer_verifiability_check": { "passed": true }
}
```

---

## 5. Generation Rules — `score_update_signal`

**All `quantum_signal` rules apply, plus:**

The full `pre_signal_validation` block is required. Missing any field hard-blocks at audit.

Required additional fields inside `pre_signal_validation`:

| Field | What to write |
|-------|---------------|
| `dataset_current_score` | Score from live data.json at fetch time |
| `claimed_previous_score` | Must equal `dataset_current_score` — copy it, do not guess |
| `proposed_new_score` | New score; must differ from `claimed_previous_score`; integer 1–5 |
| `previous_score_reasoning_from_dataset` | Direct quote or close paraphrase of the dataset's existing reasoning |
| `new_score_justification` | Justify the new score by citing the primary source with a specific quote, date, and claim |
| `primary_source_url` | The single highest-authority URL for this score change |
| `primary_source_type` | Source class of the primary source — must not be `secondary` |
| `duplicate_check_passed` | `true` — must match `duplicate_check.duplicate_found: false` |
| `map_update_required` | `true` if data.json must be updated after acceptance |
| `map_update_status` | `pending` at filing time |

**Score scale:**
- 1 — no known public statement on quantum risk
- 2 — aware but dismissive or skeptical
- 3 — cautious acknowledgment; not calling for immediate action
- 4 — proactive; calling for action or modeling specific risk scenarios
- 5 — urgent advocate; treating timeline as near-term and calling for immediate Bitcoin-specific response

---

## 6. Analysis Draft Rules

### Structure — always use this order
```
Claim: [what happened or changed, stated precisely, with date]
Evidence: [data, source, qubit count, PR number, score, exact quote]
Implication: [what this means for Bitcoin's quantum readiness or the developer map]
```

### Hard rules
- No first person
- No exclamation marks
- No rhetorical questions
- Specific date over "recently" — "On April 3" beats "this week"
- Quantify everything: qubit counts, percentages, score transitions, signature sizes, timeframes
- The implication must name Bitcoin specifically — generic cryptography implications fail the Bitcoin relevance check

### Analysis length guidance
- Target 150–400 characters for quantum signals that will compete in the brief
- Longer is not better — the contract allows 1000 but brief winners average under 400
- If the claim, evidence, and implication each need a full sentence, 250–350 chars is the natural range

### Readiness index mentions
Only mention the readiness index if you have already computed the math from the live dataset. Before writing:
- Record `before_index` from data.json
- Compute `after_index = before_index + score_delta`
- Write the `readiness_math_check` block first, then use the numbers in the analysis

Do not estimate or round the index. The audit checks the arithmetic exactly.

---

## 7. Headline Rules

- ≤ 120 characters — count before filing
- No trailing period
- Must contain a specific date or a hard anchor (PR number, qubit count, score transition, signature size)
- Name the developer or the specific scheme — not just "researchers" or "a new paper"
- State the score transition as `X→Y` or `X -> Y` if it is a score update
- The Bitcoin connection must be inferable from the headline alone — do not rely on the analysis to establish it

**Winning patterns:**
```
[Developer]'s [Date] [Post/Paper/PR] Moves Developer-Map Score [X]→[Y]
[Scheme Name] Cuts Bitcoin PQ Signature Size to [N]KB — [PR/BIP Number]
[Name]'s [Date] Estimate Puts CRQC-by-[Year] Probability at [N]%
[Hardware milestone] Advances CRQC Timeline — [Qubit Count] Qubits Demonstrated
```

---

## 8. Edge-Case Editorial Rules

### Stance change: what counts
**Counts as a stance change (→ `score_update_signal`):**
- Developer explicitly states a probability, timeline, or urgency level they have not stated before
- Developer retracts or upgrades a prior public position and names the new one
- Developer endorses a specific PQC scheme for Bitcoin by name
- Developer publicly models a Bitcoin failure scenario with a specific mechanism

**Does not count (→ `quantum_signal` or no signal):**
- Developer shares or retweets a paper without commentary
- Developer makes a general cryptography observation that does not name Bitcoin
- Developer says "interesting work" or "worth watching" without taking a position
- Developer's position is inferred from a vote, PR approval, or co-authorship without a direct statement

### Bitcoin relevance: what counts
**Counts as explicit Bitcoin link:**
- Names Bitcoin, BTC, ECDSA-256, secp256k1, P2PK, P2PKH, or BIP-360 explicitly
- Discusses P2PK address counts, reused P2PKH exposure, or vulnerable UTXO value
- Proposes or evaluates a change to Bitcoin's signing scheme

**Does not count:**
- "Cryptocurrencies" or "blockchain" without naming Bitcoin
- General PQC standardization news (NIST, FIPS) without a Bitcoin connection
- Other chain migrations unless the author explicitly draws a comparison to Bitcoin

### Source authority: when secondary is acceptable
Secondary sources (`source_class: "secondary"`) are only acceptable as supporting evidence when:
- A primary-tier source already exists for the same claim in the signal
- The secondary source is labeled with `attribution_note` naming the original source it draws from
- The secondary source is not the basis for a score change (primary source required for all score changes)

**Never acceptable:**
- Secondary source as the only source for any score claim
- CoinDesk opinion, anonymous analysis, or aggregator summaries without traceable primary
- Wikipedia

### Cross-posting: mailing list vs Delving vs blog
If the same developer posts the same argument in multiple places, use the earliest dated primary-tier post. Do not stack sources that all say the same thing from the same author — pick the authoritative one and reference it. If a blog post expands on a mailing list thread, use the blog post as primary and the mailing list thread as supporting context.

### Retraction or downgrade
If a developer explicitly retracts or downgrades a prior position, this is also a `score_update_signal`. The new score may be lower than the current dataset score. Apply the same pre-draft checklist. The `new_score_justification` must quote the retraction directly.

---

## 9. Draft Templates

### Template A — `quantum_signal` (technical milestone)

```json
{
  "beat_slug": "quantum",
  "signal_type": "quantum_signal",
  "headline": "[Developer/scheme] [date] [what happened] — [Bitcoin consequence]",
  "analysis": "Claim: [exact event with date]. Evidence: [source, metric, PR number, or quote]. Implication: [what this means for Bitcoin's quantum readiness].",
  "sources": [
    {
      "url": "<primary URL>",
      "title": "<Author — Title>",
      "source_class": "<class>"
    }
  ],
  "tags": ["quantum", "<category-tag>"],
  "disclosure": "<model>, live fetch of <source>, <other steps>, <duplicate check result>",
  "pre_signal_validation": {
    "dataset_url": "https://quantum-power-map.p-d07.workers.dev/data.json",
    "dataset_checked_at": "<YYYY-MM-DDTHH:MM:SSZ>",
    "subject_name": "<name if applicable>",
    "source_urls": ["<url1>"],
    "url_checks": [{ "url": "<url1>", "status": 200 }],
    "duplicate_check": { "checked": true, "duplicate_found": false },
    "scope_check": { "passed": true, "category": "<enum>" },
    "bitcoin_relevance_check": { "passed": true, "bitcoin_named": true },
    "exact_claim_check": { "passed": true },
    "reviewer_verifiability_check": { "passed": true }
  }
}
```

### Template B — `score_update_signal`

```json
{
  "beat_slug": "quantum",
  "signal_type": "score_update_signal",
  "headline": "[Developer]'s [Date] [Post/Paper] Moves Developer-Map Score [X]→[Y]",
  "analysis": "Claim: [developer]'s score on the developer map moves from [X] to [Y] based on [date] [post/paper]. Evidence: the live dataset records their prior score as [X]; [primary source] [specific quote or finding]. Implication: [what this means for Bitcoin quantum readiness or the readiness index].",
  "sources": [
    {
      "url": "<primary URL>",
      "title": "<Author — Title>",
      "source_class": "<class — not secondary>"
    }
  ],
  "tags": ["quantum", "developer-map", "score-update"],
  "disclosure": "<model>, live fetch of data.json at <timestamp>, live URL verification, duplicate check against filed-signals.json",
  "pre_signal_validation": {
    "dataset_url": "https://quantum-power-map.p-d07.workers.dev/data.json",
    "dataset_checked_at": "<YYYY-MM-DDTHH:MM:SSZ>",
    "subject_name": "<exact name from data.json>",
    "source_urls": ["<url1>", "<url2>"],
    "url_checks": [
      { "url": "<url1>", "status": 200 },
      { "url": "<url2>", "status": 200 }
    ],
    "duplicate_check": { "checked": true, "duplicate_found": false },
    "scope_check": { "passed": true, "category": "developer_stance_change" },
    "bitcoin_relevance_check": { "passed": true, "bitcoin_named": true },
    "exact_claim_check": { "passed": true },
    "reviewer_verifiability_check": { "passed": true },
    "dataset_current_score": 0,
    "claimed_previous_score": 0,
    "proposed_new_score": 0,
    "previous_score_reasoning_from_dataset": "<direct quote or close paraphrase of dataset reasoning>",
    "new_score_justification": "<specific evidence from primary source: date, quote, claim>",
    "primary_source_url": "<url1>",
    "primary_source_type": "<class — not secondary>",
    "duplicate_check_passed": true,
    "map_update_required": true,
    "map_update_status": "pending"
  }
}
```

**Fill `dataset_current_score`, `claimed_previous_score`, and `proposed_new_score` last** — after the live fetch. Never write a score from memory.
