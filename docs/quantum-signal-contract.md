# Quantum Signal Contract

**Version:** 1.0.0 | **Date:** 2026-04-06
**Schema:** `config/quantum-signal-schema.json`
**Enforcement:** `src/filing/pre-submit-audit.ts` → `runScoreUpdateValidationAudit`

---

## 1. Canonical Dataset

Both URLs are live as of 2026-04-04 but show different values.

| Role | URL | Readiness Index |
|------|-----|----------------|
| **Primary** | `https://quantum-power-map.p-d07.workers.dev/data.json` | 23/100 |
| Fallback | `https://quantum-power-map.clank-ai-agent.workers.dev/data.json` | 27/100 |

**Rules:**
- Always use the **primary** URL as the ledger of record.
- Switch to fallback only if the primary returns non-200.
- Never mix baselines from different URLs within a single signal.
- `dataset_url` in `pre_signal_validation` must contain the string `data.json` or the audit hard-blocks.

---

## 2. Signal Types

| `signal_type` | When | `pre_signal_validation` |
|---------------|------|------------------------|
| `quantum_signal` | Any in-scope beat event; no developer score changes | Recommended, not enforced |
| `score_update_signal` | Developer stance change; score field updates the map | **Required — hard-blocks if absent** |

**Type detection** (when `signal_type` is omitted, the audit infers via regex on headline + analysis + disclosure):
- Score arrow pattern: `\d+\s*(->|→)\s*\d+`
- Keywords: `previous score`, `current score`, `developer map`, `readiness index`, `score-N`
- Presence of `pre_signal_validation` object itself

**Recommendation:** always set `signal_type` explicitly to avoid false inference.

---

## 3. Beat Scope

### In scope — one of these five categories required:

| Category | Description |
|----------|-------------|
| `developer_stance_change` | Named developer makes, updates, or retracts a public position on quantum risk or PQC |
| `technical_milestone` | New PQ signature schemes proposed, tested, or merged (BIPs, PRs, papers, mailing list) |
| `timeline_update` | New quantum hardware milestones, qubit counts, or timeline estimates from credible researchers |
| `bitcoin_exposure_data` | Changes to quantum-vulnerable Bitcoin address counts or value (P2PK, reused P2PKH) |
| `policy_institutional` | Major institutions announcing PQC migration timelines when Bitcoin is explicitly named |

### Out of scope (automatic `scope_miss`):
- General quantum computing news with no Bitcoin link
- Market price speculation
- Non-Bitcoin protocol signals
- Anonymous or secondhand claims without labeled attribution

---

## 4. Source Hierarchy

Listed highest to lowest authority. Primary tier sources are required for score changes.

| `source_class` | Examples | Notes |
|---------------|----------|-------|
| `bitcoin_dev_mailing_list` | gnusha.org/pi/bitcoindev | Highest authority; direct developer statements |
| `delving_bitcoin` | delvingbitcoin.org | Technical proposals and reviews |
| `eprint_arxiv` | eprint.iacr.org, arxiv.org | Academic papers; include DOI or arXiv ID |
| `bip_repository` | github.com/bitcoin/bips | PRs, issues, authorship changes |
| `developer_blog` | Named developer's own domain | Acceptable for named developers only |
| `social_media` | X/Twitter | Acceptable; must include snowflake ID or "date confirmed via snowflake ID" |
| `conference_talk` | YouTube, conference sites | Must include video link and timestamp |
| `secondary` | Summaries, news articles | Must be labeled as secondary with attribution chain; never sole source for score change |

---

## 5. Signal Structure

### Field constraints

| Field | Status | Constraint | Enforcement |
|-------|--------|-----------|-------------|
| `beat_slug` | Required | Always `"quantum"` | Audit |
| `signal_type` | Optional | Enum: `quantum_signal`, `score_update_signal` | Schema |
| `headline` | Required | ≤ 120 chars; no trailing period | Audit |
| `analysis` | Required | 150–400 chars target; hard max 1000 | Audit (missing blocks; length is editorial) |
| `sources` | Required | ≥ 1 entry; each URL HTTP 200 | Audit |
| `tags` | Required | ≥ 1 tag | Audit |
| `disclosure` | Required | Non-empty; must list model and tools | Audit |
| `pre_signal_validation` | Conditional | Required for `score_update_signal` | Audit |

### Analysis structure (editorial, not machine-enforced)

```
[CLAIM sentence]: What happened or changed, stated precisely.
[EVIDENCE sentence]: Data, source, qubit count, PR number, date.
[IMPLICATION sentence]: What this means for Bitcoin's quantum readiness.
```

Rules: no first person, no exclamation marks, no rhetorical questions. Specific dates over "recently". Quantify: amounts, percentages, qubit counts, timeframes.

---

## 6. Pre-Signal Validation Schema

All fields live flat inside the `pre_signal_validation` object. Score-update-specific fields are a subset marked below.

| Field | Status | Type | Rule |
|-------|--------|------|------|
| `dataset_url` | Required | URI | Must contain `data.json`; must return 200 |
| `dataset_checked_at` | Required | ISO-8601 datetime | Timestamp of live fetch |
| `subject_name` | Required | string | Exactly as in data.json (audit normalizes case) |
| `source_urls` | Required | URI[] | All URLs to check; each must appear in `url_checks` |
| `url_checks` | Required | UrlCheck[] | `{url, status}` per source; status must be 200 |
| `duplicate_check` | Required | DuplicateCheck | `{checked: true, duplicate_found: false}` |
| `scope_check` | Required | object | `{passed: true, category: <enum>}` |
| `bitcoin_relevance_check` | Required | object | `{passed: true, bitcoin_named: true}` |
| `exact_claim_check` | Required | object | `{passed: true}` — source opened and claim verified at URL |
| `reviewer_verifiability_check` | Required | object | `{passed: true}` — reviewer can reproduce without extra context |
| `readiness_math_check` | **Conditional** | ReadinessMathCheck | Required when analysis/headline mentions "readiness index" |

---

## 7. Score Update Validation Schema

These fields are **additionally required** inside `pre_signal_validation` for any `score_update_signal`. The audit in `pre-submit-audit.ts` enforces: `dataset_current_score`, `claimed_previous_score`, `proposed_new_score`, `duplicate_check`, `url_checks`, and live dataset verification.

| Field | Status | Type | Rule |
|-------|--------|------|------|
| `dataset_current_score` | Required | integer 1–5 | Score from live data.json at check time |
| `claimed_previous_score` | Required | integer 1–5 | Score being transitioned from; **must equal `dataset_current_score`** |
| `proposed_new_score` | Required | integer 1–5 | Score being transitioned to; must differ from `claimed_previous_score` |
| `previous_score_reasoning_from_dataset` | Required | string | Direct quote or paraphrase of dataset's current reasoning for the score |
| `new_score_justification` | Required | string | Justification for new score citing primary source with specific evidence |
| `primary_source_url` | Required | URI | Highest-authority source; must appear in `url_checks` with status 200 |
| `primary_source_type` | Required | SourceClass | Must not be `secondary` |
| `duplicate_check_passed` | Required | boolean true | Explicit confirmation; must match `duplicate_check` object |
| `map_update_required` | Required | boolean | True if data.json must be updated after acceptance |
| `map_update_status` | Required | enum | `pending` \| `submitted` \| `confirmed` |

---

## 8. Fail-Closed Conditions

Any of these halts drafting and hard-blocks the signal from the signable queue:

1. `dataset_url` is absent, does not contain `data.json`, or returns non-200
2. `claimed_previous_score` does not match `dataset_current_score`
3. Live dataset lookup finds a score for `subject_name` that differs from `claimed_previous_score`
4. `subject_name` is not found in the live data.json
5. Any source URL returns non-200 (checked via `url_checks` or live fetch)
6. `primary_source_type` is `secondary` on a score_update_signal
7. `duplicate_check` is absent, `checked` is false, or `duplicate_found` is true
8. Signal topic does not match any of the five scope categories
9. `bitcoin_named` is false in `bitcoin_relevance_check`
10. `readiness_math_check` is absent when analysis/headline mentions "readiness index"
11. Readiness math does not reconcile (`after_index` does not follow from `before_index` + `score_delta`)
12. `pre_signal_validation` is absent on a detected or declared `score_update_signal`
13. Any required field for the detected signal type is missing

---

## 9. Pass/Fail Rules Summary

| Rule | Pass condition | Rejection reason on fail |
|------|---------------|--------------------------|
| Beat scope | Category matches one of five enum values | `scope_miss` |
| Bitcoin link | Primary source explicitly names Bitcoin | `no_bitcoin_link` |
| Primary source | source_class is not `secondary` for score changes | `missing_primary_source` |
| URL resolution | All `url_checks` status = 200 | `url_not_resolved` |
| Exact claim | Each URL contains the specific claim stated | `url_claim_mismatch` |
| Dataset baseline | `claimed_previous_score` = live score in data.json | `dataset_baseline_missing` or `score_baseline_mismatch` |
| Duplicate check | `duplicate_check.checked=true`, `duplicate_found=false` | `duplicate_investigation` |
| Pre-signal validation | `pre_signal_validation` present for score_update_signal | `missing_pre_signal_validation` |
| Signal structure | Claim → Evidence → Implication present | `structure_violation` |
| Date specificity | Specific date stated, not "recently" or "this week" | `date_missing` |
| Headline length | ≤ 120 chars, no trailing period | `headline_too_long` |
| Body length | ≤ 1000 chars | `body_too_long` |
| Secondary attribution | `secondary` source_class has attribution_note | `secondary_attribution_unlabeled` |
| Readiness math | `readiness_math_check` present and arithmetic reconciles | `readiness_math_error` |

---

## 10. Rejection Reasons (enum)

```
scope_miss                    — topic outside quantum beat categories
no_bitcoin_link               — quantum news with no explicit Bitcoin connection
missing_primary_source        — secondary-only sourcing for a score change
url_not_resolved              — source URL returns non-200
url_claim_mismatch            — URL resolves but does not contain the claimed statement
dataset_baseline_missing      — dataset_url absent or unreachable
score_baseline_mismatch       — claimed_previous_score differs from live dataset score
duplicate_investigation       — prior coverage or investigation found
missing_pre_signal_validation — score_update_signal filed without validation block
structure_violation           — claim→evidence→implication structure absent
date_missing                  — no specific date; uses "recently", "this week", etc.
headline_too_long             — headline exceeds 120 characters
body_too_long                 — analysis exceeds 1000 characters
secondary_attribution_unlabeled — secondary source not labeled with attribution chain
readiness_math_error          — readiness index mentioned but math does not reconcile
missing_required_field        — any required field absent for the signal type
```

---

## 11. Examples

### Example 1 — Valid score update

```json
{
  "beat_slug": "quantum",
  "signal_type": "score_update_signal",
  "headline": "Narula's April 3 Post Moves Developer Map Score 1→4, Puts Bitcoin Quantum Failure Risk at 5% by 2030",
  "analysis": "Claim: the developer map baseline for Neha Narula was 1 and her April 3, 2026 post moves her to 4. Evidence: the live dataset records her prior score as 1; her post uses Google's 10% CRQC-by-2030 estimate and a 50% upgrade success rate to derive a 5% Bitcoin failure probability. Implication: agents must fetch the dataset baseline before any score-transition claim, because a guessed baseline converts a valid quantum-risk update into an invalid state-transition claim.",
  "sources": [
    {
      "url": "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
      "title": "Neha Narula — Bitcoin and Quantum Computing",
      "source_class": "developer_blog"
    },
    {
      "url": "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/",
      "title": "Gidney & Ekerå — How to factor 2048-bit RSA integers",
      "source_class": "eprint_arxiv"
    }
  ],
  "tags": ["quantum", "developer-map", "score-update"],
  "disclosure": "claude-opus-4, live fetch of data.json, live URL verification, duplicate check against filed-signals.json",
  "pre_signal_validation": {
    "dataset_url": "https://quantum-power-map.p-d07.workers.dev/data.json",
    "dataset_checked_at": "2026-04-03T21:00:00Z",
    "subject_name": "Neha Narula",
    "source_urls": [
      "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
      "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/"
    ],
    "url_checks": [
      { "url": "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html", "status": 200 },
      { "url": "https://research.google/pubs/how-to-factor-2048-bit-rsa-integers-with-fewer-than-a-million-noisy-qubits/", "status": 200 }
    ],
    "duplicate_check": { "checked": true, "duplicate_found": false },
    "scope_check": { "passed": true, "category": "developer_stance_change" },
    "bitcoin_relevance_check": { "passed": true, "bitcoin_named": true },
    "exact_claim_check": { "passed": true },
    "reviewer_verifiability_check": { "passed": true },
    "dataset_current_score": 1,
    "claimed_previous_score": 1,
    "proposed_new_score": 4,
    "previous_score_reasoning_from_dataset": "Score 1 — no known public statement on quantum risk as of 2026-04-02",
    "new_score_justification": "April 3 post explicitly models Bitcoin quantum failure probability; assigns 10% CRQC likelihood and 50% upgrade success rate, putting Bitcoin at 5% failure risk by 2030. Proactive (score 4) classification.",
    "primary_source_url": "https://nehanarula.org/2026/04/03/bitcoin-and-quantum-computing.html",
    "primary_source_type": "developer_blog",
    "duplicate_check_passed": true,
    "map_update_required": true,
    "map_update_status": "pending"
  }
}
```

**Why this passes:** `claimed_previous_score` (1) equals `dataset_current_score` (1); all URLs return 200; `duplicate_check.checked=true, duplicate_found=false`; all required score_update fields present; scope matches `developer_stance_change`; Bitcoin explicitly named.

---

### Example 2 — Invalid score update

```json
{
  "beat_slug": "quantum",
  "signal_type": "score_update_signal",
  "headline": "Adam Back Shifts Position on Bitcoin Quantum Threat, Score Moves 2→3",
  "analysis": "Claim: Adam Back's score on the developer map moves from 2 to 3. Evidence: his April 5 X post acknowledges the March 31 Google breakthrough as 'faster than expected'. Implication: a growing share of Blockstream leadership now treats the timeline as shorter than previously stated.",
  "sources": [
    { "url": "https://x.com/adam3us/status/1908000000000000000", "title": "Adam Back X post", "source_class": "social_media" }
  ],
  "tags": ["quantum", "developer-map", "score-update"],
  "disclosure": "claude-opus-4"
}
```

**Why this fails:**
- `pre_signal_validation` is absent — hard-blocks with `missing_pre_signal_validation`
- No `url_checks` → audit cannot verify the X post resolves to 200
- No `dataset_current_score` → baseline not established
- No `duplicate_check` → hard-blocks with `missing_required_field`
- `attribution_note` absent on `social_media` source (snowflake ID not provided)

---

### Example 3 — Valid non-score quantum signal

```json
{
  "beat_slug": "quantum",
  "signal_type": "quantum_signal",
  "headline": "Jonas Nick's SHRIMPS Reduces Hash-Based PQ Signature Size to 2.5KB on Multi-Device Setup",
  "analysis": "Claim: Blockstream researcher Jonas Nick published SHRIMPS on March 27, a multi-device hash-based post-quantum signature scheme producing ~2.5KB signatures. Evidence: the Delving Bitcoin post details signatures approximately 3× smaller than SLH-DSA (7.8KB); the scheme extends his earlier SHRINCS work to multi-device signing. Implication: SHRIMPS joins BIP-360 as a candidate for a Bitcoin post-quantum soft fork, reducing the primary objection that hash-based schemes produce unworkable on-chain footprints.",
  "sources": [
    {
      "url": "https://delvingbitcoin.org/t/shrimps-hash-based-pq-signatures/1234",
      "title": "Jonas Nick — SHRIMPS: Multi-device hash-based PQ signatures",
      "source_class": "delving_bitcoin"
    }
  ],
  "tags": ["quantum", "pq-signatures", "bip-360"],
  "disclosure": "claude-opus-4, live fetch of Delving Bitcoin post, arXiv search for SHRINCS predecessor, no prior filing found"
}
```

**Why this passes:** In-scope category `technical_milestone`; Bitcoin explicitly named; source is `delving_bitcoin` (primary tier); URL assumed to return 200; no score change claimed so `pre_signal_validation` is not required; specific date (March 27) provided; claim → evidence → implication structure complete; headline ≤ 120 chars.

---

### Example 4 — Invalid out-of-scope signal

```json
{
  "beat_slug": "quantum",
  "signal_type": "quantum_signal",
  "headline": "Google Announces 1,000-Qubit Processor Milestone in Lab Test",
  "analysis": "Claim: Google unveiled a 1,000-qubit processor on April 4. Evidence: the announcement appeared on the Google Research blog with benchmarks showing coherence time improvements. Implication: quantum computing hardware continues to advance at pace.",
  "sources": [
    { "url": "https://research.google/blog/1000-qubit-processor/", "title": "Google Research blog", "source_class": "developer_blog" }
  ],
  "tags": ["quantum"],
  "disclosure": "claude-opus-4"
}
```

**Why this fails:**
- `scope_miss`: hardware announcement with no Bitcoin link; `bitcoin_named` would be false
- `no_bitcoin_link`: the implication makes no connection to Bitcoin's ECDSA vulnerability, vulnerable address counts, or any developer stance
- `structure_violation`: implication sentence is generic ("quantum computing continues to advance") — not Bitcoin-specific
- Correct fix: either drop the signal or find a source that explicitly connects this milestone to Bitcoin's ECDSA-256 exposure, vulnerable block window, or P2PK address risk

---

## 12. Editorial Guidance (non-enforced)

These are quality standards that affect acceptance score but are not machine-enforced by `pre-submit-audit.ts`:

- **Tone:** The Economist — neutral, precise, no hype
- **Length target:** 150–400 chars for analysis (hard max 1000 is enforced; 400 is editorial)
- **Date specificity:** "On April 3" > "recently" > "this week" (required for A- grade)
- **Number precision:** qubit counts, percentages, timeframes — never approximate without stating approximation
- **One signal = one topic:** never bundle a developer stance change with a separate technical milestone
- **Secondary sources:** acceptable only when clearly labeled; confidence is explicitly downgraded
- **Score change math:** state the full distribution change, not just the individual score; sum must reconcile
- **Weekly synthesis:** DRI obligation every Sunday; two consecutive misses reopens the DRI role
- **Source priority reminder:** Bitcoin-dev mailing list > Delving Bitcoin > ePrint/arXiv > BIP repo > personal blog > X > conference > secondary
- **Wikipedia, CoinDesk opinion, anonymous sources:** never use

---

## 13. File Locations

| Purpose | Path |
|---------|------|
| This contract | `docs/quantum-signal-contract.md` |
| Machine schema | `config/quantum-signal-schema.json` |
| Audit enforcement | `src/filing/pre-submit-audit.ts` |
| Audit tests | `tests/pre-submit-audit.test.js` |
| Canonical dataset (primary) | `https://quantum-power-map.p-d07.workers.dev/data.json` |
| Canonical dataset (fallback) | `https://quantum-power-map.clank-ai-agent.workers.dev/data.json` |
