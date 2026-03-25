# Signal Sourcing Checklist

## Purpose
One document. Used before every signal and after every outcome.
Combines sourcing, qualification, publisher readiness, filing, and daily learning.

Sources: `docs/prd.md`, `docs/posting-guide.md`, `docs/first-live-signal.md`, observed aibtc.news approval data.

---

## STEP 0 - Pull, Analyze, Set Strategy

Do this first every day before opening sources. It keeps the loop grounded in outcomes instead of impulse.

### 0a - Pull data
- [ ] Open yesterday's daily report in `data/reports/daily/`
- [ ] Review what was filed, what happened, sats earned, BTC earned, and leaderboard movement
- [ ] Check whether any pending outcomes resolved since the last review

### 0b - Analyze
- [ ] Did the result come from proof quality, timing, headline strength, beat fit, or something else?
- [ ] If approved, what exact trait likely helped it get selected?
- [ ] If rejected, what exact weakness most likely hurt it?
- [ ] If duplicate-loss, could earlier sourcing or faster filing have avoided it?
- [ ] Did the proof anchor feel exact and reproducible?
- [ ] Did the headline sound like something a publisher would actually select?
- [ ] Did the chosen beat match how the story is actually getting approved?

### 0c - Set strategy
Write four sentences before opening any source:

- [ ] What beat or lane is most worth targeting today?
- [ ] What source tier will be checked first?
- [ ] What pattern should be avoided today based on yesterday's outcome?
- [ ] What kind of signal would be worth filing today if found?

---

## STEP 1 - Pre-Source Check

Do this before looking for anything. Prevents wasted effort on stale or crowded signals.

- [ ] Read today's `aibtc.news` daily brief - what is already covered?
- [ ] Pull the last 20 signals from the live feed - what was filed in the last 6 hours?
- [ ] Note which beats are flooded right now (3+ filings in same category today)
- [ ] Note which beats are open (0-2 filings today) - those are your lane
- [ ] Check your own last submission - approved, rejected, or duplicate loss?

---

## STEP 2 - Signal Discovery

Check in order. Stop at the first strong candidate. Do not skip to lower tiers.

### Tier 1 - Highest approval rate (~65-82%)
- [ ] GitHub `aibtcdev/aibtc-mcp-server` releases - new version? Exact fix in changelog?
- [ ] GitHub `aibtcdev/x402-sponsor-relay` releases - same check
- [ ] GitHub `aibtcdev/agent-news` - recent commits or releases
- [ ] Any `aibtcdev` repo with a release or commit in the last 24 hours
- [ ] New MCP server launch from a known infra player (exchange, custody, wallet, protocol)
- [ ] Stacks mempool: `smart_contract` deployment in last 500 blocks with a follow-on interaction?
- [ ] Hiro API `/extended/v1/tx?type=smart_contract` - recent deploys with clear first-use
- [ ] Security exploit with confirmed $ amount, exact attack vector, named protocol

### Tier 2 - Good but more competitive (~53-64%)
- [ ] Bitcoin fee market: current sat/vB, mempool size, divergence from price action
- [ ] Ordinals: floor movement, holder count shifts, fee-floor inscription patterns
- [ ] Regulatory: Senate vote, SEC ruling, or government action with exact vote count
- [ ] AI + Crypto: major lab or exchange shipping agent-related infrastructure today
- [ ] Agent Social: new standard, protocol, or first-of-kind agent coordination event

### Tier 3 - Lower priority, file only if very strong
- [ ] Bitcoin Macro: price moves only if tied to a specific structural trigger (ETF flows, hashrate, difficulty adjustment)
- [ ] Agent Economy / AIBTC Network: first-of-kind event only, needs a specific number
- [ ] World Intel: geopolitical only if directly Bitcoin or crypto-consequential with hard facts

---

## STEP 3 - Qualification Gate

One no = reject and move on. Do not rationalize past a no.

**Proof**
- [ ] I have an exact tx hash, contract address, block height, or version number
- [ ] Anyone can independently verify this from a public URL right now
- [ ] Primary source is raw chain data, a release, or a primary document - not a dashboard recap

**Causality**
- [ ] I can name the specific trigger that caused this event
- [ ] The cause is different from the event itself

**Novelty**
- [ ] This specific event has not appeared in the live signal feed today
- [ ] This has not appeared in today's daily brief
- [ ] I am early enough that most agents have not filed it yet

**Value**
- [ ] This is stronger than routine protocol noise
- [ ] This has a plausible path to selection - not just technical validity
- [ ] Submitting now is better than waiting for a stronger signal today
- [ ] This could improve sats earned, BTC rewards, or leaderboard position if selected

---

## STEP 4 - Headline Test

Read the draft headline against each line. Any fail = rewrite before continuing.

- [ ] One sentence exactly
- [ ] Contains at least one hard number, version, vote count, $ amount, or block height
- [ ] Uses active voice (ships, drops, hits, surges - not "was seen to increase")
- [ ] Has a `-` or `as` connecting the event to its significance
- [ ] States what happened AND why it matters in that one sentence
- [ ] Does not start with background or context
- [ ] Does not read like a report title or analysis header
- [ ] 25 words maximum, 15 preferred

**Beat packaging rule (from posting-guide.md):**
Keep proof and candidate selection inside `protocol-updates`.
Package the headline in the style of the beat that is actually winning:
- version release + exact fix -> **Dev Tools** style
- exploit + exact proof -> **Security** style
- first-of-kind agent infra launch -> **AI + Crypto** style

**Headline formulas that win:**
- `[tool] v[version] [ships/fixes/adds] [specific change] - [agent consequence]`
- `[protocol/company] launches [specific thing] - [what agents can now do]`
- `[metric] [moves by exact %] to [exact number] - [structural signal]`
- `[$amount] [protocol] exploit - [exact mechanism]`
- `[body] votes [exact count] to [action] - [consequence]`

---

## STEP 5 - Publisher Role Checks

Three perspectives. All three must pass.

**Protocol fit check** (`aibtc-news-protocol`)
- [ ] The signal clearly belongs to the protocol-updates beat
- [ ] The event is a real protocol change, launch, upgrade, or activation - not noise

**Fact-checker check** (`aibtc-news-fact-checker`)
- [ ] Exact tx hashes, contract address, and source URLs are attached
- [ ] The proof can be independently reproduced from public sources right now
- [ ] The causal explanation does not overclaim beyond what the proof shows

**Publisher check** (`aibtc-news-publisher`)
- [ ] The signal is interesting enough for a human reader to care
- [ ] The signal is concise, sharp, and not padded with analysis
- [ ] It would not feel embarrassing if it got ignored publicly
- [ ] It has a plausible chance of selection and payout

---

## STEP 6 - Article Format Check

Required before treating the package as ready to file.

- [ ] `title` reads like a strong newsroom title
- [ ] `dek` explains the significance without hype
- [ ] `lede` states what happened and why in plain terms
- [ ] `why_it_matters` sounds meaningful, not generic
- [ ] `proof_summary` gives a human-readable proof anchor (not just a raw tx hash)
- [ ] The package reads like something a publisher could compile without rewriting

---

## STEP 7 - Pre-Submission Final Gate

- [ ] Signal is still novel - no duplicate filed in the last 30 minutes
- [ ] Beat is not currently flooded
- [ ] Proof links are publicly accessible right now
- [ ] All sources are disclosed (chain, explorer, GitHub, or primary source URL)
- [ ] Model disclosure is complete (tools used, derivation steps)
- [ ] Payload passes local validation (`submissionStatus: submit`, `editorial_review.ready_to_file: true`)
- [ ] The headline is still one sentence and still feels non-obvious after review
- [ ] Pre-submission notes confirm the brief, activity feed, and duplicate risk were checked today

---

## STEP 8 - File and Record

- [ ] Run GitHub Actions dry-run against the live input files
- [ ] Inspect artifacts: `dry-runs/<date>/dry-run-summary.json`, `<candidate-id>-submission.json`
- [ ] Confirm `submissionStatus` is `submit` in the artifact
- [ ] File via the current AIBTC submission path
- [ ] Record the filing immediately using the log format below

---

## Daily Signal Log

One entry per signal, every day. Fill in what you know at filing time. Come back and update outcome fields when results are visible.

```text
---
date:
signal_id:
filed_at:                    # ISO timestamp
beat_filed_under:            # beat label used in submission
headline:
proof_type:                  # tx_hash | contract_address | version_number | vote_record | block_height
proof_anchor:                # the exact hash, version, block, or amount
source_tier:                 # 1 | 2 | 3
discovery_method:            # github_release | mempool | hiro_api | news_feed | manual_research
time_to_file_minutes:        # from when you found it to when you filed
dry_run_decision:            # submit | reject
filed:                       # yes | no | held
hold_reason:                 # if not filed
outcome:                     # approved | brief_included | rejected | duplicate_loss | pending
rejection_reason:            # if known, copy the publisher reason exactly
sats_earned:                 # number or null
btc_earned:                  # amount or null
leaderboard_change:          # up | down | flat | unknown
notes:                       # one sentence on what you would do differently
---
```

---

## Daily Report File

Use `data/reports/daily/TEMPLATE.md` to create the day's report.

The daily report has six sections:
- What was filed
- Outcomes
- What happened
- What was learned
- Strategy for tomorrow
- Running totals

At the end of each day:
- fill Sections 1-4 after filing and outcome review
- draft Section 5 before ending the session

The next morning:
- use yesterday's Section 5 as the starting point for Step `0c`
- create today's new daily report file before sourcing

---

## Daily Review (end of day, 5 minutes)

Answer these from the day's log entries.

**What happened**
- How many signals sourced today?
- How many passed the qualification gate?
- How many filed?
- How many approved, brief-included, rejected, or duplicate-loss?

**What to learn**
- Did any rejection come from a qualification gate failure I missed?
- Was any duplicate loss avoidable with a faster filing?
- Was the headline too weak, too vague, or missing a hard number?
- Did I check the brief and live feed before sourcing?

**Tomorrow**
- Which Tier 1 source produced the strongest candidate today?
- Which beat is open tomorrow that I can target?
- One thing to do differently:

---

## Weekly Review (5 minutes, once per week)

Pull from the daily log entries for the week.

| Metric | This week |
|---|---|
| Signals sourced | |
| Passed gate | |
| Filed | |
| Approved | |
| Brief-included | |
| Rejected | |
| Duplicate losses | |
| Sats earned | |
| BTC earned | |
| Leaderboard movement | |

**Beat performance this week**

| Beat | Filed | Approved | Rejected | Duplicate |
|---|---|---|---|---|
| | | | | |

**Sourcing performance**

| Source | Candidates found | Approved |
|---|---|---|
| | | |

**Adjustments for next week**
- Beat to prioritize:
- Beat to reduce:
- Tier 1 source to add:
- One headline pattern to improve:
- One gate failure to stop repeating:

---

## Hard Rules

Never break these regardless of time pressure.

1. No filing without an exact tx hash, contract address, version number, or vote record
2. No filing without a named causal trigger
3. No filing if a duplicate appeared in the live feed in the last 2 hours
