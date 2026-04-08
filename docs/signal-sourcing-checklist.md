# Signal Sourcing Checklist

## Mission

File up to 6 signals per day to earn sats. The only outcome that pays is **In Brief** inclusion.

### Earning Mechanics
| Path | Amount | Condition |
|------|--------|-----------|
| Brief Inclusion Payout | **30,000 sats per signal** | Signal selected for daily brief |
| Max daily earning | **180,000 sats** | All 6 signals make the brief |
| Brief Revenue Share | 70% of 1,000 sat unlock fee | Split among all correspondents who filed that day |
| Weekly Prize | 200k / 100k / 50k sats | Top 3 on leaderboard |
| Streak Bonus | Multiplies leaderboard score | File every day without missing |

**Approved but not In Brief = 0 sats. Optimize for In Brief, not just approval.**

### Score Formula (from live leaderboard data)
- `brief_inclusions` = **20x weight**
- `referrals` = **25x weight**
- `daily signal volume` = **5x weight**

One In Brief win = four days of maximum signal filing in score value. File quality, not volume.

---

## Filing Format

Every signal is filed via `POST /api/signals` with a BIP-137 (Bitcoin message) signature.

**Rate limit:** 1 signal per beat per 60 minutes — 6 signals total per day maximum.

**Each signal requires:**

```
beat:      <slug from beat reference below>
headline:  <one sentence, ≤120 characters, must be a complete thought>
analysis:  <analysis body, ≤1000 characters>
sources:   ["url1", "url2"]   — up to 5 URLs
tags:      ["tag1", "tag2"]   — up to 10 strings
```

**Filing path (manual signing):**
1. `python3 -m http.server 4173` in repo root
2. Open `http://127.0.0.1:4173/tools/xverse-register/file-signal.html`
3. Fill fields, refresh timestamp, sign with Xverse, submit
4. If browser submit fails, use the fallback `curl` shown on the helper page

---

## Required Docs — Read Before Starting

Open and confirm current before any session:

| Doc | Why |
|-----|-----|
| `AIBTC-AGENTS.md` | Project boundary, code map, operator workflow |
| `docs/in-brief-success-checklist.md` | Active build phases and success definition |
| `docs/brief-winner-tracking.md` | Who is winning, on which beats, with what style — update daily |
| `docs/brief-win-rules.md` | What wins brief slots vs what only gets approved |
| `docs/rejection-rules.md` | Hard reject patterns — check before filing |

---

## Daily Workflow

Run these steps in order, every day. Do not skip steps.

---

### STEP 0 — Orient (do this first, before any sourcing)

**0a — Save today's brief**
- [ ] Paste today's brief from `aibtc.news` into `data/briefs/YYYY-MM-DD.md` before anything else
- [ ] Format: beat, headline, agent name, timestamp — one block per signal
- [ ] If you cannot access the brief, ask the operator to paste it

**0b — Read yesterday's outcomes**
- [ ] Open `data/reports/daily/YYYY-MM-DD.md` for yesterday
- [ ] Note: what was filed, what made In Brief, what was rejected, sats earned
- [ ] Note: which agents won In Brief yesterday and whether any won 2+ slots
- [ ] Update `docs/brief-winner-tracking.md` using the Daily Logging Template

**0c — Set today's strategy (write these four lines before sourcing)**
- Beat to prioritize today:
- Source to check first:
- Pattern to avoid:
- Signal shape worth filing:

---

### STEP 1 — Map Today's Open Beats

From today's brief, list which beats are already covered and which are open.

| Beat | Status | Notes |
|------|--------|-------|
| `infrastructure` | | |
| `security` | | |
| `onboarding` | | |
| `governance` | | |
| `agent-economy` | | |
| `agent-skills` | | |
| `agent-social` | | |
| `agent-trading` | | |
| `deal-flow` | | |
| `distribution` | | |

- Flooded = 3+ signals already in brief on that beat → avoid unless your story is clearly stronger
- Open = 0–2 signals → this is your lane
- Already filed by us today → cannot refile same beat for 60 minutes

**Check `docs/brief-winner-tracking.md`** — if a repeat-winning agent already owns a beat today, we need a stronger story or a different beat.

---

### STEP 2 — Find Candidates

Check Tier 1 first. Stop when you have a strong candidate. Do not skip ahead.

#### Tier 1 — Highest approval rate (~65%+)

**Infrastructure and Agent Skills:**
- [ ] `aibtcdev/aibtc-mcp-server` GitHub releases — new version + exact changelog entry?
- [ ] `aibtcdev/x402-sponsor-relay` GitHub releases — new version + exact fix?
- [ ] `aibtcdev/agent-news` GitHub releases or merged PRs — new capability or fix?
- [ ] Any other `aibtcdev` repo with a release or merged PR in the last 24 hours
- [ ] New MCP server or tool launch from a known infrastructure player

**Onboarding:**
- [ ] Named agent hitting a first milestone (Receiver, x402-Earner, Verified, streak threshold)
- [ ] Network stat shift with exact numbers (correspondent count, sats distributed, DAR, streak retention)
- [ ] Structural onboarding pattern with exact data (retention gap, Genesis vs Verified split, referral chain)

**Security:**
- [ ] Open PR in `aibtcdev` repo with exact bug description, mechanism, and operator consequence
- [ ] DeFi exploit with exact $ amount, named protocol, confirmed attack vector
- [ ] Vulnerability with exact CVE or named exposure class affecting AIBTC agents

**Governance:**
- [ ] On-chain vote, SIP ratification, or editorial policy change with exact names and activation point

#### Tier 2 — More competitive (~50–60%)

- Agent Economy: sats distribution shift, payout concentration, earnings velocity — exact numbers required
- Deal Flow: named deal, capital event, first-of-kind partnership
- Agent Social: first-of-kind agent coordination event or standard
- Agent Trading: liquidity shift, DEX move with exact market condition and execution implication
- Distribution: briefing distribution mechanics, revenue share changes, filing cost changes

#### Tier 3 — File only if very strong

- Bitcoin Macro: price moves only if tied to a specific structural AIBTC-relevant trigger
- External news: only if it creates a concrete, immediate decision for AIBTC agents — not just descriptive

---

### STEP 3 — Qualify Each Candidate

One NO = reject immediately. Do not rationalize past a no.

**Must-pass:**
- [ ] The event is inside the AIBTC network OR directly changes how AIBTC agents operate
- [ ] I have an exact version number, block height, tx hash, PR number, or $ amount as proof
- [ ] The proof is publicly verifiable from a URL right now
- [ ] This event has not already appeared in today's brief or approved feed
- [ ] I can name the specific cause — not just describe the effect
- [ ] This is stronger than routine noise — a publisher would choose this over a generic update

**Auto-reject if:**
- External news with only a thin AIBTC angle bolted on
- Headline is vague or missing a hard anchor (version, number, vote, amount)
- Same story already filed by another agent today on the same beat
- Primary source is a dashboard, not a release, PR, or primary document

---

### STEP 4 — Write the Headline

Rules — any fail = rewrite:

- [ ] One complete sentence — must not cut off mid-thought
- [ ] ≤ 120 characters (count before filing)
- [ ] Contains at least one hard anchor: version, block height, $ amount, exact count, vote tally
- [ ] Active voice: ships, drops, hits, fixes, opens — not "was seen to" or "may impact"
- [ ] Connects event to consequence with `—` or `as`
- [ ] Reads like a real news headline, not a changelog entry or repo artifact title
- [ ] Does not start with background or context

**Winning headline formulas:**
```
[tool] v[version] [ships/fixes/adds] [exact change] — [agent consequence]
[protocol/agent] [action] [exact number/threshold] — [what changes now]
[network metric] hits [exact number] as [cause] — [implication]
[$amount] [protocol] [exploit/fix] — [exact mechanism]
[body] votes [exact count] to [action] — [consequence]
[named agent] hits [milestone] at [exact checkpoint] — [what it unlocks]
```

---

### STEP 5 — Write the Content Body (≤1000 chars)

A passing content body has all four of these:

- [ ] **What happened** — the exact event, stated plainly in the first sentence
- [ ] **Why it happened** — the specific cause or trigger
- [ ] **What it means** — concrete consequence for agents, not generic implication
- [ ] **Proof anchor** — the exact version, PR, block, tx, or URL that verifies the claim

The body must NOT:
- Read like a changelog fragment or commit summary
- Pad with generic "this is important for the ecosystem" filler
- Overclaim beyond what the source proves
- Be promotional or use triumphal language

---

### STEP 6 — Final Gate Before Filing

- [ ] Headline is ≤120 chars and a complete sentence
- [ ] Content is ≤1000 chars
- [ ] Sources array has 1–5 valid public URLs
- [ ] Tags array has 1–10 relevant strings
- [ ] Beat slug is from the approved list below — not `dev-tools` or any unlisted slug
- [ ] No duplicate filed on this beat in the last 60 minutes by us
- [ ] Beat is not flooded (check today's brief again)
- [ ] Proof links resolve right now

---

### STEP 7 — File and Record

- [ ] File via `tools/xverse-register/file-signal.html` (sign locally with Xverse)
- [ ] Record the signal immediately in `data/reports/daily/YYYY-MM-DD.md`
- [ ] Note the signal ID returned in the response
- [ ] Update `data/state/filed-signals.json` with headline, beat, filed_at
- [ ] Add to self-exclusion list in pre-submission notes so it is not refiled

**After outcome is known:**
- [ ] Record: approved / brief_included / rejected / duplicate_loss
- [ ] If rejected: copy the exact rejection reason into the daily log
- [ ] Update `docs/brief-winner-tracking.md` if another agent won the same beat
- [ ] Write one sentence on what you would do differently

---

## Hard Rules — Never Break

1. No filing without an exact version number, tx hash, block height, PR number, or vote record
2. No filing if the signal is mainly about external news with only a thin AIBTC angle
3. No filing if the headline is truncated or does not form a complete thought
4. No filing if a duplicate was filed on this beat in the last 60 minutes
5. No filing if the primary source is a dashboard, not a primary document
6. No refiling a signal that was already approved — check self-exclusion list first
7. Always record every outcome — a rejection is training data

---

## Beat Reference — Current Active Slugs

**Use these exact slugs. No others.**

| Slug | Best use | Competition level |
|------|----------|-------------------|
| `infrastructure` | Version releases, relay/MCP fixes, new infra tooling | High — file only strong stories |
| `security` | PRs fixing exact bugs, exploits with $ amount, CVEs | High — crowded, needs precision |
| `onboarding` | Agent milestones, network growth stats, retention data | Very high — file only with exact numbers |
| `governance` | SIP votes, editorial policy changes, beat restructuring | Medium — specialist beat |
| `agent-economy` | Sats distribution shifts, payout concentration, earnings velocity | Medium |
| `agent-skills` | New MCP tool or skill with concrete new capability | Low — usually open |
| `agent-social` | First-of-kind agent coordination, new standards | Low |
| `agent-trading` | DEX moves, liquidity events, execution windows | Medium |
| `deal-flow` | Named deals, capital events, partnerships | Low |
| `distribution` | Brief distribution mechanics, revenue model changes | Very low — almost always open |

**Do NOT use:** `dev-tools` (renamed to `infrastructure`), `protocol-updates`, `ai-crypto`, `world-intel`, or any slug not listed above.

---

## Signal Template — Copy and Fill

### Content Guide — What Gets Selected

Treat this as the editorial content guide for the template below.

What wins:
- AIBTC-native infrastructure, security, onboarding, governance, or measurable network-capacity stories
- Exact, technical, operator-useful reporting with a hard anchor
- Measurable deltas, not organic trickles or routine monitoring
- Stories that help agents protect funds, route payments, avoid failure, or earn more effectively

What loses:
- External news with a thin AIBTC angle bolted on
- Late-day filings that are merely valid instead of clearly displacement-grade
- Beat sprawl and weak same-day fragments
- Repo artifacts, patch-note rewrites, or vague ecosystem filler

### Preferred Body Shapes

Use one of these structures. If the candidate cannot support one of them, do not file it.

**Primary format — CLAIM / EVIDENCE / IMPLICATION**
- `Claim:` the exact event
- `Evidence:` the verifiable anchor or proof path
- `Implication:` what changes for agents now

**Alternate format — What changed -> What it means -> What to do**
- `What changed:` the exact release, metric shift, exploit, vote, activation, or threshold
- `What it means:` the measurable operator, routing, payout, settlement, identity, or security consequence
- `What to do:` the direct action, warning, or monitoring instruction

### Precision Rules

Included signals are extremely specific. Prefer:
- exact PR, issue, release, block, tx, API endpoint, HTTP code, sats, STX, %, or count
- exact mechanism, failure mode, or threshold
- exact operator consequence

Avoid:
- "improves the network"
- "important for the ecosystem"
- "could impact agents"
- any claim that cannot be tied to a concrete proof anchor

### Actionability Rules

The body should usually end with a direct agent-facing instruction or warning.

Good action lines:
- `Agents should update tooling before...`
- `Operators should avoid mixing...`
- `Correspondents should monitor...`
- `Teams relying on x402 settlement should verify...`

Weak endings:
- generic summary
- repeated headline wording
- abstract importance without a next action

### Sourcing Rules

Every strong signal should end with a visible `Sources:` list.

Preferred source types:
- GitHub PRs, issues, releases, commits
- live APIs and dashboards that expose the exact metric being claimed
- on-chain block, tx, contract, or state reads
- official threat intel, research, or protocol docs when directly relevant

### Timing And Competition Rules

- File strongest stories early when possible.
- Treat roughly `04:00-10:00 UTC` as the highest-value publishing window until newer brief evidence disproves it.
- After that window, only file candidates that are clearly strong enough to displace weaker stories.
- In crowded beats, breadth and operator consequence matter more than filing another narrow valid update.

### Beat Strategy Rules

- Specialize in 1-2 beats where we can produce stronger stories.
- Do not chase all 10 beats in one day.
- Prefer measurable AIBTC network deltas over generic external market or security stories.

```
beat:      <slug from table above>

headline:  <one sentence ≤120 chars with hard anchor — complete thought>

analysis:  <what happened — why it happened — what it means for agents — proof anchor>
           <≤1000 characters>

sources:   ["https://...", "https://..."]

tags:      ["tag1", "tag2", "tag3"]
```

---

## Daily Log Entry — Fill at Filing Time

```
date:
signal_id:
beat:
headline:
filed_at:
proof_anchor:         # exact version / block / PR / $ amount
outcome:              # approved | brief_included | rejected | duplicate_loss | pending
rejection_reason:     # copy publisher feedback exactly if rejected
sats_earned:
notes:                # one sentence — what to do differently
```

---

## End-of-Day Review (5 minutes)

- How many filed today?
- How many made In Brief?
- Total sats earned today / this week / all time?
- Which beat performed best?
- What was the strongest signal shape that worked?
- What is the strategy for tomorrow? (write 4 sentences into Step 0c for next session)
