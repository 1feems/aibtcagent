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

### Step 2B — Check What Already Won and What Failed
Operator will ask you what is the status of the signals sent to add to 
Read in this order:
1. `docs/homepage-brief-snapshots.md` — extract today's approved titles, their beat, and what made them win

### Step 2C — Comparison
Read 
`docs/homepage-brief-snapshots.md` — extract today's approved titles, their beat, and what made them win
docs/homepage-brief-snapshots.md
docs/helper-bugs.md

to complete a `docs/daily-brief-source-comparison.md` — extract which source types are working per beat and which story shapes lost

---

### Step 3 — Load Beat Editor Standards

Read the beat editor file for the target beat.

Extract exactly:
- The 90+ scoring example and the specific reason it scored high
- The checklist items required to reach 90+
- The instant rejection triggers for this beat

Do not answer beat-fit or scoring questions from memory. Read the file.

**Quantum — what winning looks like (from `docs/homepage-brief-snapshots.md`):**
- `arXiv:2604.02311 Cuts secp256k1 Attack Qubits to 1,333 from 2,124 -- Shor ECDLP Threshold Shrinks for bc1q Keys` — arXiv ID + before/after qubit numbers + Bitcoin address type
- `1 ECDSA Signature Added in Stacks Block 7697670 -- STX/sBTC Agents Remain on BIP-360 Draft Clock` — Hiro block anchor + exact count + missing migration path
- `[BIP-361] Draft Merged: Phase A "Deposit Freeze" and Phase B "Signature Sunset" Set 2029-2031 Deadlines` — BIP state change + phase names + deadline years
- `arXiv:2510.09271: ML-DSA Verifies at 0.14 ms vs ECDSA 0.88 ms -- BIP-361 Migration Tech Feasibility Confirmed` — arXiv ID + exact ms benchmark + migration conclusion

**Bitcoin Macro — what winning looks like:**
- `60,243 BTC Mempool Queue Holds Just 0.06 BTC Fees -- sBTC Peg-In Desks Can Recut Broadcast Caps` — exact tx count + exact fee total + sBTC operator action
- `1372 Blocks Left Before a -0.08% Retarget -- sBTC/STX Carry Desks Lose May Cost Premium` — blocks remaining + retarget % + carry desk consequence
- `Block 946,149 Earns 1.55M Sats -- 5.09x Block 946,148 as Fee Volatility Swings Across 8-Block Window` — block height + sat amount + multiplier + window size

**AIBTC Network — what winning looks like:**
- `PR #593 Extends Edge-Cache to N=4 Correspondent Endpoints -- Beat Fill, Rankings, Classifieds Hit <100ms vs ~3s` — PR number + what changed + before/after metric
- `x402-Relay #349 Merges Nonce-Gap Reconciler -- Stale Sender Queuing Blocks Fixed 5 Days After Pool Health Fix` — PR number + what fixed + timing context
- `Skills PR #343 Flags Hardcoded --sender in contract-preflight -- Agent Stacks Identity Wrong for 2 Days` — PR number + exact bug + impact duration

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

Read `docs/helper-bugs.md` before presenting any JSON.

**Run three checks in order. All three must pass.**

**Check 1 — Helper syntax (`getHeadlineAnchorPass` + `hasVerifiableSources`)**
- [ ] Headline contains an accepted anchor from the list in Step 5
- [ ] Every source URL matches the helper whitelist: arXiv abs, IACR ePrint, NIST, IBM Research, Google Quantum AI, gnusha bitcoindev, Delving Bitcoin, or any URL containing `github.com` · `/api/` · `explorer.` · `releases/tag/` · `issues/<n>` · `pull/<n>` · `bip-<n>` · `docs.`
- [ ] All tags are lowercase slugs — no uppercase, no spaces (`bip-361` not `BIP-361`)
- [ ] `body` and `analysis` contain identical text
- [ ] `CLAIM:` · `EVIDENCE:` · `IMPLICATION:` labels present
- [ ] `disclosure` is non-empty and names specific sources and date

**Check 2 — Winner shape (from `docs/publisher-feedback-board.md` and `docs/daily-brief-source-comparison.md`)**
- [ ] Story is not a duplicate of a signal already approved on the brief today
- [ ] Story matches a winning pattern for this beat, not just a technically-valid one
- [ ] Primary source is fresh (within 5 days for quantum; same UTC day for macro/network)

**Check 3 — Beat 90+ checklist (from Step 3 beat editor)**

*Quantum:*
- [ ] 3+ quantum keywords in body: `quantum` `post-quantum` `secp256k1` `ECDSA` `Schnorr` `SLH-DSA` `FALCON` `ML-DSA` `BIP-360` `BIP-361` `logical qubit` `NIST FIPS` `PQC` `ZKP`
- [ ] Hardware: logical qubit count (not physical) + threat gap vs 2,330 threshold
- [ ] PQC paper: signature size in bytes + Bitcoin tx weight impact + migration path
- [ ] Cluster cap not exceeded — max 4/day: `bip_360` `bip_361` `nist_pqc` `hardware`
- [ ] Headline anchor matches what the source actually states

*Bitcoin Macro:*
- [ ] Exact numbers from live source: sat/vB, block height, difficulty %, hashrate, ETF flow
- [ ] UTC snapshot or block time in EVIDENCE
- [ ] Agent or sBTC consequence in IMPLICATION
- [ ] Body ends with terminal punctuation

*AIBTC Network:*
- [ ] Specific PR number, version tag, or commit hash
- [ ] Shipped change only — not open proposals or bug reports
- [ ] Direct agent operator impact named

Return `filing_ready` only when all three checks pass. If any item fails → name the specific item and fix it before presenting JSON.

---

## Sources

### Tier 1 — Primary Proof (must resolve to exact claim)

**Quantum:**
| URL | Proves |
|---|---|
| `https://arxiv.org/abs/<id>` | Paper claims and results |
| `https://export.arxiv.org/api/query?id_list=<id>` | Category, date, author |
| `https://csrc.nist.gov/pubs/fips/<num>/final` | Signature sizes, PQC specs |
| `https://github.com/bitcoin/bips/blob/master/bip-<num>.mediawiki` | BIP state and scope |
| `https://gnusha.org/pi/bitcoindev` | Developer statements |
| `https://delvingbitcoin.org` | Named technical proposals |

**Bitcoin Macro:**
| URL | Proves |
|---|---|
| `https://mempool.space/api/v1/fees/recommended` | Live fee rates (sat/vB) |
| `https://mempool.space/api/v1/difficulty-adjustment` | Retarget %, blocks remaining |
| `https://mempool.space/api/v1/mining/hashrate/3d` | Hashrate |
| `https://farside.co.uk/btc/` | ETF daily flows |
| `https://mempool.space/block/<hash>` | Block fee and confirmation data |
| `https://api.mainnet.hiro.so/v2/info` | Stacks chain state |

**AIBTC Network:**
| URL | Proves |
|---|---|
| `https://github.com/aibtcdev/x402-sponsor-relay` | Relay changes and versions |
| `https://github.com/aibtcdev/agent-tools-ts` | SDK and tooling changes |
| `https://github.com/aibtcdev/aibtc-mcp-server` | MCP tool changes |
| `https://github.com/aibtcdev/agent-news` | Publisher and signal workflow changes |
| `https://github.com/hirosystems/stacks-blockchain-api` | Hiro API changes |
| `https://github.com/stacks-network/stacks-core` | Stacks node changes |

### Tier 2 — Verification Only
CoinDesk / Cointelegraph / Bitcoin Magazine / The Block — timing and consequence framing only.
IBM Research / Google Quantum AI — hardware leads, require arXiv backup.
Named researcher X posts — lead only, require Tier 1 corroboration.

### Tier 3 — Never Use as Primary
Wikipedia · opinion pieces · anonymous sources · `aibtc.news` as self-reference · homepage-level URLs · "various sources"
