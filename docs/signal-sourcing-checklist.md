# Signal Sourcing Checklist

## Purpose
One document. Used before every signal and after every outcome.
Combines sourcing, qualification, publisher readiness, filing, and daily learning.

Sources: `docs/prd.md`, `docs/posting-guide.md`, `docs/first-live-signal.md`, observed aibtc.news approval data.

---

## Sourcing Method

Use this method every time. It exists to prevent weak candidates from surviving too long.

1. Read the primary source, not the summary
- [ ] Open the actual release body, changelog, filing, or primary document
- [ ] Do not stop at a repo push list, commit timestamp, or activity summary
- [ ] Look for the exact version, number, named entity, fix, or capability that could support a headline

2. Verify novelty before getting attached
- [ ] Check the daily brief before calling a candidate open
- [ ] Check the live signal feed before calling a candidate unfiled
- [ ] Confirm whether existing signals are actually about the same version, number, or event instead of just the same broad topic

3. Use the headline formula as a filter, not a formatter
- [ ] If the candidate does not naturally fit a strong headline formula, hold it early
- [ ] Do not use the formula at the end to dress up a weak candidate
- [ ] Prefer candidates that immediately produce a version-number-change-consequence headline

Short version:
- [ ] read primary sources instead of summaries
- [ ] verify novelty against the live feed explicitly
- [ ] use the headline formula to kill weak candidates before spending more time on them

---

## STEP 0 — Pull, Analyze, Set Strategy

Step 0 in the checklist is now the first thing that runs every day from tomorrow onwards. It has three sub-steps:

### 0a — Pull data
- [ ] Open yesterday's daily report in `data/reports/daily/`
- [ ] Review what was filed, outcomes, running sats, and leaderboard movement
- [ ] Look at yesterday's outcome before assuming anything
- [ ] Ask what actually made `In Brief` yesterday before sourcing anything new
- [ ] Note which approved signals were not selected for `In Brief`
- [ ] Note which agents won `In Brief`, and whether any of them won more than one slot
- [ ] Log repeat winners and same-day multi-winners in `docs/brief-winner-tracking.md`

### 0b — Analyze
- [ ] What was filed?
- [ ] What was the outcome?
- [ ] If approved or brief-included, what exact trait likely got it selected?
- [ ] If rejected, was it proof, timing, headline, beat mismatch, or another root cause?
- [ ] If duplicate-loss, what should have happened earlier?
- [ ] Did the headline read like something a publisher would actually select?
- [ ] Did the beat match how this kind of story is actually getting approved?

### 0c — Set strategy
Write four sentences before opening any source, so sourcing is intentional not random.

- [ ] Beat to prioritize today:
- [ ] Source to check first today:
- [ ] Pattern to avoid today:
- [ ] Signal shape worth filing today:

---

## STEP 1 — Pre-Source Check

Do this before looking for anything. Prevents wasted effort on stale or crowded signals.

- [ ] Ask which stories are already `In Brief` today or in the latest visible brief cycle
- [ ] Read today's `aibtc.news` daily brief — what is already covered?
- [ ] Pull the last 20 signals from the live feed — what was filed in the last 6 hours?
- [ ] Note which beats are flooded right now (3+ filings in same category today)
- [ ] Note which beats are open (0–2 filings today) — those are your lane
- [ ] Check your own last submission — approved, rejected, or duplicate loss?
- [ ] Ask whether a stronger same-beat story has already taken the brief slot
- [ ] Ask whether a repeat-winning agent already owns the best angle on this beat today
- [ ] Check `docs/brief-winner-tracking.md` before trying to outcompete an already-proven winner on the same beat

---

## STEP 2 — Signal Discovery

Check in order. Stop at the first strong candidate. Do not skip to lower tiers.

### Tier 1 — Highest approval rate (~65–82%)

**Infrastructure beat:**
- [ ] GitHub `aibtcdev/aibtc-mcp-server` releases — new version? Exact fix in changelog?
- [ ] GitHub `aibtcdev/x402-sponsor-relay` releases — same check
- [ ] GitHub `aibtcdev/agent-news` — recent commits or releases
- [ ] Any `aibtcdev` repo with a release or commit in the last 24 hours
- [ ] New MCP server launch from a known infra player (exchange, custody, wallet, protocol)
- [ ] Stacks mempool: `smart_contract` deployment in last 500 blocks with a follow-on interaction?
- [ ] Hiro API `/extended/v1/tx?type=smart_contract` — recent deploys with clear first-use

**Security beat:**
- [ ] DeFi exploit with confirmed $ amount, exact attack vector, named protocol — check Rekt.news, Chainalysis, TRM Labs
- [ ] Published audit finding documented as "known unfixed" — check Clarity Alliance, CoinFabrik, OtterSec
- [ ] Vulnerability class confirmed by security researcher with agent-specific exposure — check slowmist.io, samczsun.com
- [ ] Q-period crypto crime report with a first-of-kind stat change ($amount, category shift, method change)
- [ ] Prompt injection, key compromise, or oracle manipulation with confirmed mechanism and named victim
- [ ] Stacks-specific: aibtcdev security advisory, x402 relay fix with CVE or exploit reference

**Required for any security candidate:**
- exact $ amount OR named vulnerability class with reproduction steps
- named protocol or agent exposure (not generic "DeFi agents at risk")
- at least one concrete action agents should take now

### Tier 2 — Good but more competitive (~53–64%)
- [ ] Bitcoin fee market: current sat/vB, mempool size, divergence from price action
- [ ] Ordinals: floor movement, holder count shifts, fee-floor inscription patterns
- [ ] Regulatory: Senate vote, SEC ruling, or government action with exact vote count
- [ ] AI + Crypto: major lab or exchange shipping agent-related infrastructure today
- [ ] Agent Social: new standard, protocol, or first-of-kind agent coordination event

### Tier 3 — Lower priority, file only if very strong
- [ ] Bitcoin Macro: price moves only if tied to a specific structural trigger (ETF flows, hashrate, difficulty adjustment)
- [ ] Agent Economy / AIBTC Network: first-of-kind event only, needs a specific number
- [ ] World Intel: geopolitical only if directly Bitcoin or crypto-consequential with hard facts

---

## STEP 3 — Qualification Gate

One no = reject and move on. Do not rationalize past a no.

**Proof**
- [ ] I have an exact tx hash, contract address, block height, or version number
- [ ] Anyone can independently verify this from a public URL right now
- [ ] Primary source is raw chain data, a release, or a primary document — not a dashboard recap

**Causality**
- [ ] I can name the specific trigger that caused this event
- [ ] The cause is different from the event itself

**Novelty**
- [ ] This specific event has not appeared in the live signal feed today
- [ ] This has not appeared in today's daily brief
- [ ] I am early enough that most agents have not filed it yet

**Value**
- [ ] This is stronger than routine protocol noise
- [ ] This has a plausible path to selection — not just technical validity
- [ ] Submitting now is better than waiting for a stronger signal today
- [ ] This could improve sats earned, BTC rewards, or leaderboard position if selected

---

## STEP 4 — Headline Test

Read the draft headline against each line. Any fail = rewrite before continuing.

- [ ] One sentence exactly
- [ ] Contains at least one hard number, version, vote count, $ amount, or block height
- [ ] Uses active voice (ships, drops, hits, surges — not "was seen to increase")
- [ ] Has a `—` or `as` connecting the event to its significance
- [ ] States what happened AND why it matters in that one sentence
- [ ] Does not start with background or context
- [ ] Does not read like a report title or analysis header
- [ ] 25 words maximum, 15 preferred

**Beat packaging rule (from posting-guide.md):**
Keep proof and candidate selection inside `dev-tools`.
Package the headline in the style of the beat that is actually winning:
- version release + exact fix → **Dev Tools** style
- exploit + exact proof → **Security** style
- first-of-kind agent infra launch → **AI + Crypto** style

**Headline formulas that win:**
- `[tool] v[version] [ships/fixes/adds] [specific change] — [agent consequence]`
- `[protocol/company] launches [specific thing] — [what agents can now do]`
- `[metric] [moves by exact %] to [exact number] — [structural signal]`
- `[$amount] [protocol] exploit — [exact mechanism]`
- `[body] votes [exact count] to [action] — [consequence]`

---

## STEP 5 — Publisher Role Checks

Three perspectives. All three must pass.

**Protocol fit check** (`aibtc-news-protocol`)
- [ ] The signal clearly belongs to the protocol-updates beat
- [ ] The event is a real protocol change, launch, upgrade, or activation — not noise

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

## STEP 6 — Article Format Check

Required before treating the package as ready to file.

- [ ] `title` reads like a strong newsroom title
- [ ] `dek` explains the significance without hype
- [ ] `lede` states what happened and why in plain terms
- [ ] `why_it_matters` sounds meaningful, not generic
- [ ] `proof_summary` gives a human-readable proof anchor (not just a raw tx hash)
- [ ] The package reads like something a publisher could compile without rewriting

---

## STEP 7 — Pre-Submission Final Gate

- [ ] Signal is still novel — no duplicate filed in the last 30 minutes
- [ ] Beat is not currently flooded
- [ ] Proof links are publicly accessible right now
- [ ] All sources are disclosed (chain, explorer, GitHub, or primary source URL)
- [ ] Model disclosure is complete (tools used, derivation steps)
- [ ] Payload passes local validation (`submissionStatus: submit`, `editorial_review.ready_to_file: true`)
- [ ] The headline is still one sentence and still feels non-obvious after review
- [ ] Pre-submission notes confirm the brief, activity feed, and duplicate risk were checked today

---

## STEP 8 — File and Record

- [ ] Run GitHub Actions dry-run against the live input files
- [ ] Inspect artifacts: `dry-runs/<date>/dry-run-summary.json`, `<candidate-id>-submission.json`
- [ ] Confirm `submissionStatus` is `submit` in the artifact
- [ ] Ask one last time whether the candidate is already covered by an `In Brief` story or is likely to lose to one
- [ ] File via the current AIBTC submission path
- [ ] Default filing path: use `tools/xverse-register/file-signal.html` so Xverse signs locally without exposing the seed phrase
- [ ] Start `python3 -m http.server 4173` in the repo root, open `http://127.0.0.1:4173/tools/xverse-register/file-signal.html`, refresh timestamp, sign with Xverse, then submit
- [ ] If browser submit fails, use the fallback `curl` shown on the helper page with the already-captured signature
- [ ] Record the filing immediately using the log format below

---

## Daily Signal Log

One entry per signal, every day. Fill in what you know at filing time. Come back and update outcome fields when results are visible.

```
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

- [ ] `data/reports/daily/TEMPLATE.md` is the reusable template for every day. Six sections:
  - What was filed (signal log)
  - Outcomes (with running sats and leaderboard)
  - What happened (one line per signal)
  - What was learned (proof, timing, headline, beat, gate failures)
  - Strategy for tomorrow (four decisions written before day ends)
  - Running totals (today / week / all time so you can see the trend)
- [ ] `data/reports/daily/2026-03-25.md` is today's report. Fill in sections 1-4 tonight after your first filing. Section 5 becomes tomorrow morning's Step `0c`.
- [ ] Tomorrow morning: open `data/reports/daily/2026-03-25.md`, run through Step `0`, write `2026-03-26.md`, then start sourcing

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
4. No filing if the headline is more than one sentence
5. No filing if the primary source is a dashboard
6. No filing if any publisher role check fails
7. Always record the outcome — a rejection is signal data

---

## Beat Approval Reference

Current active beat slugs (post v1.17.0 restructuring):

| Beat slug | Approval Rate | Best use |
|---|---|---|
| `infrastructure` | ~65% | Version releases, relay/MCP fixes, new infra — formerly `dev-tools` |
| `security` | ~53% | Exploits with exact $ + mechanism, audit findings, key compromise |
| `agent-economy` | ~50% | Rewards, yield, earnings — first-of-kind events with hard numbers |
| `agent-skills` | ~55% | New skill releases with concrete new agent capability |
| `agent-trading` | ~47% | DEX moves, liquidity events — needs strong differentiation |
| `agent-social` | ~60% | Standards, protocols, first agent coordination events |
| `deal-flow` | ~55% | Named deals, capital events, first-of-kind partnerships |
| `governance` | ~60% | On-chain votes with exact count, named outcome |
| `onboarding` | ~55% | Structural changes that lower barrier for new agents |
| `distribution` | open | Currently 0–1 approved/day — widest open beat |

Do not use: `dev-tools` (renamed), any beat not in the list above.
