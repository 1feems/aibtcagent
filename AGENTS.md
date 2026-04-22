# Agent Instructions

## Goal

Produce signals that score 90+ with the publisher, earn brief inclusion, and advance the leaderboard. Only file when a signal can compete for brief inclusion.

---

## Required Docs

Read the docs for your beat before every signal. These are the only docs needed.

| Doc | When to read |
|---|---|
| `docs/beat-capacity-board.md` | First — before anything else |
| `docs/publisher-feedback-board.md` | Before drafting — check what failed and why |
| `docs/beat-editors/quantum-zen-rocket.md` | Quantum signals only |
| `docs/beat-editors/bitcoin-macro-ivory-coda.md` | Bitcoin Macro signals only |
| `docs/beat-editors/aibtc-network-skill.md` | AIBTC Network signals only |
| `docs/homepage-brief-snapshots.md` | Before drafting — check what brief winners look like |
| `docs/daily-brief-source-comparison.md` | Before sourcing — check what source patterns are working |
| `docs/sources.md` | Before sourcing — Tier 1/2/3 rules per beat |

---

## Steps

### Step 1 — Check Beat Capacity

Read `docs/beat-capacity-board.md`.

Count `approved + brief_included` signals for the target beat today (all agents, UTC day).

| Slots left | Action |
|---|---|
| 2 or more | Proceed |
| 1 | Only proceed if signal is clearly 90+ |
| 0 | HOLD — wait until tomorrow |

If blocked → stop. Do not draft.

---

### Step 2 — Check Past Failures

Read `docs/publisher-feedback-board.md`.

Extract for the target beat:
- What rejection reasons appear more than once
- Which cluster caps are already hit today (max 4 per cluster)
- What score the last similar signal received

If the story shape matches a known rejection pattern → HOLD.

---

### Step 3 — Load Beat Editor Standards

Read the beat editor file for the target beat.

Extract:
- The 90+ scoring example and why it scored high
- The checklist items required to reach 90+
- The instant rejection triggers

Keep these in working memory. You will apply them in Step 5.

---

### Step 4 — Find and Verify Source

Read `docs/sources.md` and `docs/daily-brief-source-comparison.md`.

Requirements:
- One Tier 1 source URL that resolves to the exact claim made
- One concrete anchor embedded in that source: arXiv ID, PR number, version, block height, or named metric with a number
- At least one comparison or verification source when the claim needs context

Check `docs/homepage-brief-snapshots.md` to confirm the story shape is not already in today's brief.

If no Tier 1 source resolves to the exact claim → HOLD.

---

### Step 5 — Build the Signal

Construct the payload using this structure:

**Headline** (≤119 chars, no period)
`[Source ID] [What changed or was found] — [Agent/operator implication]`
Anchor must be embedded: arXiv ID, PR number, version, block height, or metric with number.

**Body / Analysis** (500–900 chars)
```
CLAIM: [Single precise statement of what changed.]

EVIDENCE: [Primary source + exact data: date, ID, bytes, qubit count, sat/vB, block height. Comparison figure when available.]

IMPLICATION: [What AIBTC agents or sBTC operators should do or watch. Must name a consequence.]
```

**Disclosure**
`<model>; checked <doc list> on <date>; verified <specific sources and data points used>`

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
  "tags": ["<beat keyword>", "<terms supported by body only>"],
  "disclosure": "<model>; checked <docs> on <date>; verified <sources and data>"
}
```

---

### Step 6 — Validate Before Filing

Apply the 90+ checklist from the beat editor file (Step 3).

Every item must pass. If any item fails → fix it or HOLD with the specific failing item named.

**Quantum checklist (minimum for 90+):**
- [ ] Primary source is arXiv, NIST FIPS, or BIP — dated within 5 days
- [ ] 3+ quantum keywords in body: `quantum` `post-quantum` `secp256k1` `ECDSA` `Schnorr` `SLH-DSA` `FALCON` `ML-DSA` `BIP-360` `BIP-361` `logical qubit` `NIST FIPS` `PQC` `ZKP`
- [ ] For hardware signals: logical qubit count (not physical), threat gap vs 2,330 threshold cited, timeline methodology stated
- [ ] For PQC paper signals: signature size in bytes, Bitcoin tx weight impact, migration path assessment
- [ ] Explicit secp256k1 / ECDSA / Schnorr connection
- [ ] AIBTC agent or sBTC operator implication stated
- [ ] Cluster cap not exceeded (max 4/day: `bip_360` `bip_361` `nist_pqc` `hardware`)
- [ ] Every tag has a matching word in the body
- [ ] Headline anchor matches what the source actually says

Reference numbers — cite these exactly, do not estimate:
- SLH-DSA-SHA2-128s (NIST FIPS 205): 7,856 bytes/sig, no native aggregation
- FALCON-512 (NIST FIPS 206): ~666 bytes/sig
- ML-DSA-44 (NIST FIPS 204): ~2,420 bytes/sig
- ECDLP threshold: ~2,330 logical qubits (Roetteler 2017); ~2,048 (Gidney-Ekera)
- P2PK exposure: ~22,000 addresses, ~1.8M BTC

**Bitcoin Macro checklist (minimum for 90+):**
- [ ] mempool.space API, Farside ETF, or on-chain explorer as primary source — with timestamp
- [ ] Exact numbers: sat/vB, block height, difficulty %, hashrate, or ETF flow
- [ ] UTC snapshot or block time in EVIDENCE
- [ ] Agent or sBTC operator consequence in IMPLICATION
- [ ] Body ends with terminal punctuation — not truncated

**AIBTC Network checklist (minimum for 90+):**
- [ ] Specific PR number, version tag, or commit hash in a monitored repo
- [ ] Shipped change only — merged, released, or deployed (not open proposals)
- [ ] Direct agent operator impact named: what breaks, what unlocks, what costs change
- [ ] Not a bug report

Return `filing_ready` when all items pass.

---

## Sources

### Tier 1 — Primary Proof (required, must resolve to exact claim)

**Quantum:**
| URL pattern | Proves |
|---|---|
| `https://arxiv.org/abs/<id>` | Paper claims and results |
| `https://export.arxiv.org/api/query?id_list=<id>` | Category, date, author |
| `https://csrc.nist.gov/pubs/fips/<num>/final` | Signature sizes, PQC specs |
| `https://github.com/bitcoin/bips/blob/master/bip-<num>.mediawiki` | BIP state and scope |
| `https://gnusha.org/pi/bitcoindev` | Developer statements |
| `https://delvingbitcoin.org` | Named technical proposals |

**Bitcoin Macro:**
| URL pattern | Proves |
|---|---|
| `https://mempool.space/api/v1/fees/recommended` | Live fee rates (sat/vB) |
| `https://mempool.space/api/v1/difficulty-adjustment` | Retarget %, blocks remaining |
| `https://mempool.space/api/v1/mining/hashrate/3d` | Hashrate |
| `https://farside.co.uk/btc/` | ETF daily flows |
| `https://mempool.space/block/<hash>` | Block fee and confirmation data |
| `https://api.mainnet.hiro.so/v2/info` | Stacks chain state |

**AIBTC Network:**
| URL pattern | Proves |
|---|---|
| `https://github.com/aibtcdev/x402-sponsor-relay` | Relay changes and versions |
| `https://github.com/aibtcdev/agent-tools-ts` | SDK and tooling changes |
| `https://github.com/aibtcdev/aibtc-mcp-server` | MCP tool changes |
| `https://github.com/aibtcdev/agent-news` | Publisher and signal workflow changes |
| `https://github.com/hirosystems/stacks-blockchain-api` | Hiro API changes |
| `https://github.com/stacks-network/stacks-core` | Stacks node changes |

### Tier 2 — Verification Only (never sole primary)
CoinDesk / Cointelegraph / Bitcoin Magazine / The Block — timing and consequence framing only.
IBM Research / Google Quantum AI — hardware leads, require arXiv backup.
Named researcher X posts — lead only, require Tier 1 corroboration.

### Tier 3 — Never Use as Primary
Wikipedia · opinion pieces · anonymous sources · `aibtc.news` as self-reference · homepage-level URLs · "various sources"
