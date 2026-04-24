# Agent Instructions

## Goal

Produce signals that score 90+ with the publisher, earn brief inclusion, and advance the leaderboard. Only file when a signal can compete for brief inclusion.

---

## Required Docs

Read these before every signal. No exceptions.

| Doc | Read at |
|---|---|
| `docs/beat-capacity-board.md` | Step 1 — before anything else |
| `docs/publisher-feedback-board.md` | Step 2 — check what failed and why |
| `docs/homepage-brief-snapshots.md` | Step 2 — see what already won today |
| `docs/daily-brief-source-comparison.md` | Step 2 — see which sources and patterns are working |
| `docs/beat-editors/quantum-zen-rocket.md` | Step 3 — quantum signals only |
| `docs/beat-editors/bitcoin-macro-ivory-coda.md` | Step 3 — bitcoin-macro signals only |
| `docs/beat-editors/aibtc-network-skill.md` | Step 3 — aibtc-network signals only |
| `docs/sources.md` | Step 4 — Tier 1/2/3 rules per beat |
| `docs/helper-bugs.md` | Step 6 — before presenting any JSON |

If any required doc for the target beat is unread → return `hold`.

---

## Steps

### Step 1 — Check Beat Capacity

Operator will ask you what are the status of the beats in terms of how many are filled to 10, you will use this skill ( node skills/beat-capacity-status/scripts/beat-capacity-status.mjs

For fastest : Use the beat-capacity-status skill and run:
node skills/beat-capacity-status/scripts/beat-capacity-status.mjs


| Beat             | Approved | Cap | Slots Open |
|------------------|---------:|----:|-----------:|
| `bitcoin-macro`  |       10 |  10 |          0 |
| `quantum`        |        6 |  10 |          4 |
| `aibtc-network`  |        4 |  10 |          6 |



---
### Step 2A — Check Whats in the Brief 
Operator will give you the pasted briefs and you would put it in the `docs/homepage-brief-snapshots.md` — extract today's approved titles, their beat, and what made them win. In the table format it is in

When the operator asks what is the status of the signals sent, read **only**:

1. `docs/homepage-brief-snapshots.md`

Do not read, inspect, or edit any other docs unless the operator explicitly names them.

Extract:
- today's approved titles
- their beat
- what made them win

Return the answer in the same table format used in `docs/homepage-brief-snapshots.md`.

### Step 2B — Check Signal Status

When the operator asks for the status of signals sent:

Read only:
- `docs/publisher-feedback-board.md`

Then:
1. Use the `Pending Review` table as the exact list of signals that still need status checks.
2. Check the live status for each signal in that table.
3. For any row that now has real publisher feedback:
   - remove it from `Pending Review`
   - add it to `Publisher Feedback Rows`
   - add a matching note to `Signal Content Review Notes`
4. For any row that still has no publisher feedback:
   - leave it in `Pending Review`
   - keep `Publisher feedback` as `Pending publisher review`
   - keep `Status` as `submitted`

Output rules:
- Always show results in the exact same 8-column table format used in `docs/publisher-feedback-board.md`
- Never switch to a custom summary table
- If the operator asks for pending signals, show only rows still pending
- If the operator asks for resolved former pending signals, show those rows in the same table format

Required table format:
`| Date | Signal ID | Beat | Title | One-line signal | Notes | Publisher feedback | Status |`

Status meanings:
- `submitted` = filing succeeded and is awaiting publisher review
- `approved` = publisher approved it
- `rejected` = publisher rejected it
- `replaced` = signal was later displaced/replaced
- empty/null `publisherFeedback` = no final publisher decision yet




### Step 2C — Complete Daily Brief Source Comparison

Read **only**:

1. `docs/homepage-brief-snapshots.md`
2. `docs/helper-bugs.md`
3. `docs/publisher-feedback-board.md`

Do not read, inspect, or edit any other docs unless the operator explicitly names them.

Use `docs/homepage-brief-snapshots.md` to extract:
- today's approved titles
- beat
- what made each signal win
- source types that appear in winning signals
- winning story shapes by beat

Use `docs/helper-bugs.md` to extract:
- story shapes that failed
- source or formatting patterns that caused problems
- helper-related failure patterns

Use `docs/publisher-feedback-board.md` to extract:
- Valiant Gryphon signal outcomes (approved, rejected, pending)
- publisher rejection reasons
- score breakdown patterns

Update **only**:

`docs/daily-brief-source-comparison.md`

Do not infer a different destination file.

In `docs/daily-brief-source-comparison.md`, record:
- source types working per beat
- winning story shapes per beat
- story shapes that lost
- source or helper patterns to avoid

Preserve the existing table format already used in `docs/daily-brief-source-comparison.md`.

---

### Step 3 — Load Target Beat Rules

Before judging or drafting a signal, identify the target beat:

- `quantum`
- `bitcoin-macro`
- `aibtc-network`

Read **only** the beat editor file for that target beat:

| Beat | Read this file |
|---|---|
| `quantum` | `docs/beat-editors/quantum-zen-rocket.md` |
| `bitcoin-macro` | `docs/beat-editors/bitcoin-macro-ivory-coda.md` |
| `aibtc-network` | `docs/beat-editors/aibtc-network-skill.md` |

Do not read the other beat editor files unless the operator explicitly asks.

From the target beat editor file, extract:
- what scores 90+
- what checklist items are required
- what triggers instant rejection

Then compare the candidate signal against today’s winning examples from:

`docs/homepage-brief-snapshots.md`

Use the examples only as pattern guidance, not as source material.

Return:
- target beat
- required 90+ checklist
- instant rejection triggers
- whether the candidate matches a winning pattern
- what must change before drafting
#### Winning Pattern Examples

Use these only as examples of shape and specificity. Do not copy them.

Quantum winners usually include:
- arXiv ID + exact qubit numbers + Bitcoin key/address implication
- block height + exact ECDSA signature count + missing migration path
- BIP state change + phase names + deadline years
- benchmark ID + exact performance number + migration conclusion

Bitcoin Macro winners usually include:
- exact mempool tx count + fee total + sBTC operator action
- blocks remaining + retarget percentage + carry desk consequence
- block height + fee amount + multiplier + comparison window

AIBTC Network winners usually include:
- PR number + shipped change + before/after metric
- PR number + fixed bug + timing context
- PR number + exact operational impact


---

### Step 4 — Find and Verify Source

Read `docs/sources.md`.

Requirements:
- One Tier 1 source URL that resolves to the exact claim made — not a homepage
- One concrete anchor in that source: arXiv ID, PR number, version, block height, or named metric with a number
- One verification or comparison source when the claim needs a benchmark

If no Tier 1 source resolves to the exact claim → HOLD.

---

### Step 5 — Build the Signal

**Headline** (≤119 chars, no period)
`[Source ID] [What changed or was found] — [Agent/operator implication]`

Anchor must be one of the helper-accepted forms (enforced by `getHeadlineAnchorPass`):
- `PR #123` · `issue #123` · `v1.2.3` · `CVE-2026-XXXX`
- backtick-wrapped code or path · `GET /api/name` · HTTP `4xx`/`5xx`
- `block 12345` · dollar amount · percentage · sats · bytes/kb/mb
- numeric units: hours, days, cycles, agents, signals, slots, blocks

**Body / Analysis** (500–900 chars)
```
CLAIM: [Single precise statement of what changed.]

EVIDENCE: [Primary source + exact data: date, ID, bytes, qubit count, sat/vB, block height, ms. Comparison figure when available.]

IMPLICATION: [What AIBTC agents or sBTC operators should do. Must name a consequence.]
```

**Full Payload**
```json
{
  "beat_slug": "<beat>",
  "btc_address": "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv",
  "headline": "<≤119 chars, anchor embedded, no period>",
  "body": "<CLAIM / EVIDENCE / IMPLICATION, 500–900 chars>",
  "analysis": "<same as body>",
  "sources": [
    {"title": "<Tier 1 — resolves to exact claim>", "url": "<url>"},
    {"title": "<verification or comparison source>", "url": "<url>"}
  ],
  "tags": ["<lowercase-slug>", "<all tags present in body>"],
  "disclosure": "<model>; checked <doc list> on <date>; verified <specific sources and data points>"
}
```

---

### Step 6 — Validate Before Filing

### Step 6 — Validate Before Filing

Read these before presenting any JSON:
- `docs/daily-brief-source-comparison.md`
- `docs/homepage-brief-snapshots.md`
- `docs/helper-bugs.md`
- `docs/publisher-feedback-board.md`
- `docs/beat-editors/quantum-zen-rocket.md` (Step 3 for quantum only)
- `docs/beat-editors/bitcoin-macro-ivory-coda.md` (Step 3 for bitcoin-macro only)
- `docs/beat-editors/aibtc-network-skill.md` (Step 3 for aibtc-network only)

Run three checks in order. All three must pass.

Check 1 — Helper syntax (`getHeadlineAnchorPass` + `hasVerifiableSources`)
- [ ] Headline contains an accepted anchor from Step 5
- [ ] Every source URL matches helper whitelist (arXiv abs, IACR ePrint, NIST, IBM Research, Google Quantum AI, gnusha bitcoindev, Delving Bitcoin, or URL containing `github.com` `/api/` `explorer.` `releases/tag/` `issues/<n>` `pull/<n>` `bip-<n>` `docs.`)
- [ ] All tags are lowercase slugs (no uppercase, no spaces)
- [ ] `body` and `analysis` are identical
- [ ] `CLAIM:` `EVIDENCE:` `IMPLICATION:` labels present
- [ ] `disclosure` is non-empty and names specific sources + date

Check 2 — Winner shape and duplicate guard (from publisher-feedback-board + daily-brief-source-comparison + homepage-brief-snapshots)
- [ ] Story is not a duplicate of a signal already approved on the brief today
- [ ] Duplicate check uses source-artifact + claim-shape, not headline-only:
      same arXiv ID / IACR ID / PR-issue-event + same numeric anchor => duplicate block
- [ ] Story matches current winning pattern for that beat (not merely technically valid)
- [ ] Primary source freshness passes: quantum <=5 days; macro/network same UTC day
- [ ] Cluster occupancy check passes for today (no same-cluster saturation / displacement-impossible shape)

Check 3 — Beat 90+ checklist (beat-editor specific)

Quantum:
- [ ] 3+ quantum keywords in body (`quantum`, `post-quantum`, `secp256k1`, `ECDSA`, `Schnorr`, `SLH-DSA`, `FALCON`, `ML-DSA`, `BIP-360`, `BIP-361`, `logical qubit`, `NIST FIPS`, `PQC`, `ZKP`)
- [ ] Hardware claim uses logical (not physical) qubits + threat gap vs 2,330 baseline
- [ ] If paper uses a different internal baseline (e.g., 2,124), percent claim must use that stated baseline; alternates must be labeled as context
- [ ] PQC paper claims include signature bytes + Bitcoin tx weight impact + migration path
- [ ] Cluster cap not exceeded (max 4/day: `bip_360`, `bip_361`, `nist_pqc`, `hardware`)
- [ ] Headline anchor matches exact source claim

Bitcoin Macro:
- [ ] Exact live numbers (`sat/vB`, block height, difficulty %, hashrate, ETF flow)
- [ ] UTC snapshot or block time in EVIDENCE
- [ ] Agent/sBTC consequence in IMPLICATION
- [ ] Body ends with terminal punctuation

AIBTC Network:
- [ ] Specific PR number, version tag, or commit hash
- [ ] Shipped change only (no open proposal/bug-only framing)
- [ ] Direct agent operator impact named

Return `filing_ready` only when all three checks pass.
If any item fails: return `filing_ready=false`, list failed items, and provide corrected JSON only after failures are fixed.

---

## Step 7 — Sources

### Core rule
Tier 1 source must resolve to the **exact claim anchor** used in headline/body (same ID, same number, same event).  
If the signal uses a percentage change, include the source that contains both baseline and new value.

### Tier 1 — Primary Proof (must resolve to exact claim)

**Quantum:**
| URL | Proves |
|---|---|
| `https://arxiv.org/abs/<id>` | Paper claims/results and cited baseline |
| `https://export.arxiv.org/api/query?id_list=<id>` | Publish date/category/author metadata |
| `https://eprint.iacr.org/<year>/<id>` | IACR paper claims/results |
| `https://csrc.nist.gov/pubs/fips/<num>/final` | NIST PQC standard details |
| `https://github.com/bitcoin/bips/blob/master/bip-<num>.mediawiki` | BIP state/scope text |
| `https://gnusha.org/pi/bitcoindev` | Primary developer statements |
| `https://delvingbitcoin.org` | Technical proposal/review statements |

**Bitcoin Macro:**
| URL | Proves |
|---|---|
| `https://mempool.space/api/v1/fees/recommended` | Live fee rates (sat/vB) |
| `https://mempool.space/api/v1/difficulty-adjustment` | Retarget %, blocks remaining |
| `https://mempool.space/api/v1/mining/hashrate/3d` | Hashrate |
| `https://mempool.space/api/blocks/tip/height` | Current tip height |
| `https://mempool.space/api/mempool` | Tx count, vsize, pending fees |
| `https://mempool.space/api/v1/fees/mempool-blocks` | Block-fee bands/ceiling |
| `https://farside.co.uk/btc/` | ETF daily flows |
| `https://www.sec.gov/edgar/` | Filing-level ETF proof when used |
| `https://api.mainnet.hiro.so/v2/info` | Stacks chain state |

**AIBTC Network:**
| URL | Proves |
|---|---|
| `https://github.com/aibtcdev/x402-sponsor-relay/pull/<n>` | Shipped relay change |
| `https://github.com/aibtcdev/agent-tools-ts/pull/<n>` | Shipped SDK/tooling change |
| `https://github.com/aibtcdev/aibtc-mcp-server/pull/<n>` | Shipped MCP change |
| `https://github.com/aibtcdev/agent-news/pull/<n>` | Shipped publisher/workflow change |
| `https://github.com/hirosystems/stacks-blockchain-api/pull/<n>` | Shipped Hiro API change |
| `https://github.com/stacks-network/stacks-core/releases/tag/<v>` | Versioned core release proof |
| `https://aibtc.news/api/*` | Network state corroboration (not sole proof for internal-code claims) |

### Tier 2 — Verification Only
CoinDesk / Cointelegraph / Bitcoin Magazine / The Block (timing/context only).  
IBM Research / Google Quantum AI announcements (must be paired with Tier 1 paper/spec).  
Named researcher X posts (lead only; require Tier 1 corroboration).

### Tier 3 — Never Use as Primary
Wikipedia, opinion pieces, anonymous sources, `aibtc.news` self-reference for the same claim, homepage/root URLs, generic repo root links, `"various sources"`.

### Hard blockers
- No homepage/root URL for metric-heavy claims.
- No closed PR as primary proof for a “change shipped” claim.
- No headline number without a source that contains that exact number.
- No source mismatch between claimed baseline and cited baseline.
