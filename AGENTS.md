# Agent Instructions

## Goal

Produce signals that score 90+ with the publisher, earn brief inclusion, and advance the leaderboard. A filing is only worth executing if the signal can compete for brief inclusion.

---

## Prime Directive

This file controls all AIBTC signal work. Follow it first, always. Identify which step applies, start there. Do not run the full cycle unless the operator asks for it.

---

## Hard Rules

- Do not file if Step 5 returns `blocked`.
- Do not draft if Step 7 returns `hold`.
- Do not file if Step 8 does not return `filing_ready`.
- Do not draft without reading the 4-doc set.
- Do not repeat a story shape the publisher already rejected.
- Do not use a source that does not resolve to the exact claim made.

---

## Question Router

| Operator asks about | Start at |
|---|---|
| Beat capacity, slots, congestion, safe beats | Step 5 |
| Editor guide, beat fit, approval/rejection criteria | Step 6 |
| Source quality, anchor, duplicate check | Step 7 |
| Draft, repair, validate, file-ready JSON | Step 8 |
| Wallet cooldown, canFileSignal | Step 9 (only after Step 8 returns `filing_ready`) |
| Outcomes, publisher feedback, lessons | Step 11 |

---

## 4-Doc Read Set (Required Before Step 8)

Read all four before drafting any signal. If any is unread → return `hold`.

| Doc | What it gives you |
|---|---|
| `docs/beat-editors/<beat>.md` | Scoring rubric, checklist, rejection patterns, 90+ examples |
| `docs/publisher-feedback-board.md` | Real rejection reasons and score history for this address |
| `docs/beat-capacity-board.md` | Live slot count per beat |
| `docs/sources.md` | Tier 1/2/3 source rules and beat-specific source map |

---

## Signal Construction Formula

Every signal follows this exact structure.

### Headline (≤119 chars, no period)
`[Source ID] [What changed or was found] — [Bitcoin/sBTC/AIBTC agent implication]`

Must embed at least one concrete anchor: arXiv ID, PR number, version, block height, contract address, or named metric with a number.

### Body / Analysis (500–900 chars)

```
CLAIM: [Single precise statement of what changed. No vague language.]

EVIDENCE: [Primary source + exact verifiable data. Date, ID, number, URL. Comparison data when available.]

IMPLICATION: [What AIBTC agents / sBTC operators should do or watch. Must state a consequence.]
```

### Filing Payload

```json
{
  "beat_slug": "<beat>",
  "btc_address": "bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv",
  "headline": "<≤119 chars, anchor embedded, no period>",
  "body": "<CLAIM / EVIDENCE / IMPLICATION, 500–900 chars>",
  "analysis": "<same as body>",
  "sources": [
    {"title": "<Tier 1 source — resolves to exact claim>", "url": "<url>"},
    {"title": "<verification or comparison source>", "url": "<url>"}
  ],
  "tags": ["<beat keyword>", "<3+ relevant terms, all supported by body>"],
  "disclosure": "<model>; checked <docs> on <date>; verified <specific sources and data points>"
}
```

---

## 90+ Signal Checklist by Beat

### Quantum

Minimum to reach 90+:
- [ ] Primary source: arXiv paper, NIST FIPS publication, or BIP — dated within 5 days
- [ ] 3+ quantum keywords in body from: `quantum`, `post-quantum`, `secp256k1`, `ECDSA`, `Schnorr`, `Shor`, `SLH-DSA`, `FALCON`, `ML-DSA`, `BIP-360`, `BIP-361`, `logical qubit`, `NIST FIPS`, `PQC`, `ZKP`
- [ ] For hardware signals: logical qubit count (not physical), threat gap vs 2,330 threshold, timeline methodology stated
- [ ] For PQC paper signals: signature size in bytes, Bitcoin transaction weight impact, migration path feasibility (soft fork vs hard fork)
- [ ] Explicit secp256k1 / ECDSA / Schnorr connection
- [ ] AIBTC agent or sBTC operator implication in IMPLICATION sentence
- [ ] Cluster cap check — max 4 signals per cluster per day: `bip_360`, `bip_361`, `nist_pqc`, `hardware`
- [ ] Every tag is supported by body text — no padding tags

Reference numbers (cite these, do not invent):
- SLH-DSA-SHA2-128s (NIST FIPS 205): 7,856 bytes per sig, no native aggregation
- FALCON-512 (NIST FIPS 206): ~666 bytes per sig
- ML-DSA-44 (NIST FIPS 204): ~2,420 bytes per sig
- ECDLP threshold: ~2,330 logical qubits (Roetteler et al. 2017); ~2,048 with Gidney-Ekera optimizations
- P2PK exposure: ~22,000 addresses, ~1.8M BTC vulnerable at lower qubit threshold than P2PKH

Instant rejection triggers:
- Physical qubit count presented as logical
- "Bitcoin is vulnerable" without exact resource estimates
- Cluster cap exceeded
- Source URL does not resolve to the exact claim
- PQC paper with no Bitcoin transaction weight or migration path analysis
- Headline claims a BIP connection the paper does not state

### Bitcoin Macro

Minimum to reach 90+:
- [ ] Primary source: mempool.space API, Farside ETF, named report, or on-chain explorer — with exact timestamp
- [ ] Exact numbers: fee rate (sat/vB), block height, difficulty %, hashrate, or ETF flow ($)
- [ ] UTC snapshot time or block time stated in EVIDENCE
- [ ] AIBTC agent or sBTC operator consequence in IMPLICATION
- [ ] Body has terminal punctuation — not truncated

Instant rejection triggers:
- Body cut mid-sentence or missing terminal punctuation
- Price-direction story with no operational implication
- Quantum/PQC story filed here (route to quantum beat instead)
- Price claim not verifiable against live source at time of review

### AIBTC Network

Minimum to reach 90+:
- [ ] Specific PR number, version tag, commit hash, or contract address in a monitored repo
- [ ] Shipped change only — PR merged, version released, contract deployed (not open issues or proposals)
- [ ] Direct AIBTC agent operator impact: what breaks, what unlocks, what costs change
- [ ] Not a bug report (file as GitHub issue instead)

Instant rejection triggers:
- Repo update without a shipped change
- Bug report filed as signal
- API-only circular claim sourced only from aibtc.news
- Stacks Core update with no explicit AIBTC agent connection

---

## Sources

### Tier 1 — Primary Proof

Use as the primary source. Every claim requires at least one Tier 1 URL that resolves to the exact claim made.

**Quantum:**

| Source | What it proves |
|---|---|
| `https://arxiv.org/abs/<id>` | Paper claims, methodology, results |
| `https://export.arxiv.org/api/query?id_list=<id>` | Category, date, author — verification anchor |
| `https://csrc.nist.gov/pubs/fips/<num>/final` | PQC standard signature sizes, algorithm specs |
| `https://github.com/bitcoin/bips/blob/master/bip-<num>.mediawiki` | BIP state, scope, migration path |
| `https://delvingbitcoin.org` | Technical proposals with named author |
| `https://gnusha.org/pi/bitcoindev` | Bitcoin-dev mailing list, direct developer statements |
| `https://iacr.org/archive/...` | Cryptography preprints (IACR ePrint) |

**Bitcoin Macro:**

| Source | What it proves |
|---|---|
| `https://mempool.space/api/v1/fees/recommended` | Live fee rates (sat/vB) |
| `https://mempool.space/api/v1/difficulty-adjustment` | Retarget %, blocks remaining, estimated date |
| `https://mempool.space/api/v1/mining/hashrate/3d` | Network hashrate |
| `https://farside.co.uk/btc/` | Bitcoin ETF daily flows |
| `https://api.mainnet.hiro.so/v2/info` | Stacks chain state |
| `https://api.hiro.so/extended/v1/tx?type=smart_contract&limit=20` | Stacks contract deployments |
| `https://mempool.space/block/<hash>` | Specific block fee and confirmation data |

**AIBTC Network:**

| Source | What it proves |
|---|---|
| `https://github.com/aibtcdev/x402-sponsor-relay` | Relay changes, PR state, version |
| `https://github.com/aibtcdev/agent-tools-ts` | SDK and tooling changes |
| `https://github.com/aibtcdev/aibtc-mcp-server` | MCP tool changes |
| `https://github.com/aibtcdev/agent-news` | Publisher and signal workflow changes |
| `https://github.com/hirosystems/stacks-blockchain-api` | Hiro API changes |
| `https://github.com/stacks-network/stacks-core` | Stacks node and protocol changes |
| `https://github.com/stacksgov/sips` | Stacks governance and SIP proposals |
| `https://aibtc.com/api/openapi.json` | Live AIBTC API spec |

### Tier 2 — Verification Only

Corroborate Tier 1 claims. Never use as the sole primary source.

| Source | Use for |
|---|---|
| CoinDesk / Cointelegraph / Bitcoin Magazine / The Block RSS | Timing confirmation, consequence framing |
| IBM Research / Google Quantum AI blog | Hardware announcements — require arXiv or benchmark backup |
| Chainalysis / BleepingComputer blog | Exploit leads — require primary report |
| Named researcher X/Twitter posts | Lead signal only — require Tier 1 corroboration |
| Quantinuum / IonQ / PsiQuantum announcements | Hardware — require technical metric or paper |

### Tier 3 — Never Use as Primary

- Wikipedia
- CoinDesk opinion pieces
- Anonymous sources or secondhand attribution presented as firsthand
- `aibtc.news` feed as circular proof
- Homepage-level URLs with no specific page or endpoint
- "various sources" or "internal data"

---

## Steps

### Step 1. Read Today's Brief
- Fetch brief, save to `data/briefs/YYYY-MM-DD.md`
- Extract: occupied beats, winning headline shapes, anchor types used, "what won today" note
- Update `data/state/brief-winners-YYYY-MM-DD.json` and `data/briefs/shared-context.json`

### Step 2. Signal Status Intake
- Read public feed filtered to this address + `data/state/signal-history.json`
- Read `docs/publisher-feedback-rules.md`
- Apply feedback labels to each signal, decide: repair / hold / resubmit / dead

### Step 3. Daily Outcome Board
- Compile from Step 2 + today's public approved/rejected signals
- Group repeated rejection patterns, carry repairability decisions forward

### Step 4. Outcome Analysis
- Identify repair candidates vs dead signals
- Promote repeated rejection patterns into pre-draft blockers for this cycle
- Choose winnable beats

### Step 5. Beat Saturation Check
Data source: `https://aibtc.news/api/signals?beat=<beat>` — all agents, not just this address.

Count `status ∈ {approved, brief_included}` within today UTC.

| Verdict | Condition | Action |
|---|---|---|
| Open | count ≤ cap − 2 | Yes, if signal fits |
| Warning | count = cap − 1 | Only if predicted score is 90+ |
| Blocked | count ≥ cap | No — wait until tomorrow |

If all target beats are blocked → return `HOLD`.

### Step 6. Beat Analysis
- Read `docs/beat-editors/<beat>.md`
- Confirm candidate fits this beat and not another
- Extract approval and rejection qualifiers
- If editor guide unread → return `hold`

### Step 7. Source Discovery
- Find one exact anchor: PR number, arXiv ID, version, block height, named metric with number
- Attach at least one Tier 1 URL resolving to that exact anchor
- Verify not duplicated in today's brief or `data/state/signal-history.json`
- Check cluster cap for the relevant topic cluster
- If anchor is weak or source is Tier 3 only → return `hold`

### Step 8. Create Signal
1. Read the 4-doc set
2. Apply the 90+ checklist for the chosen beat — every item must pass
3. Build the payload using the signal construction formula above
4. Return `filing_ready` only when all checklist items pass
5. Return `hold` with the specific failing item if any checklist item fails

### Step 9. File Signal
- Confirm `canFileSignal: true` from `news_check_status`
- Hand payload to operator for Xverse signing
- Wait for pasted confirmation output; parse signal ID + filed timestamp
- If no signal ID: wait 5s, run `news_list_signals` (address + pre-attempt timestamp). Found → success. Not found → wait 90s, one retry.

### Step 10. Helper Maintainer
- Classify root cause: content / workflow / helper bug / server bug
- Log, fix, add guard to prevent same failure next cycle

### Step 11. Record Outcome
- Read `docs/publisher-feedback-rules.md`
- Preserve publisher feedback verbatim in `docs/publisher-feedback-board.md`
- Assign labels, decide repairability, write one concrete lesson

### Step 12. Outcome Learner
- Convert lessons into named rules, count repeats
- Promote rules that hit threshold into hard pre-draft blockers for the next cycle
- End of cycle: restart at Step 1 with updated memory and outcomes
