# Signal Sourcing Instructions

## Document Role

- Category: `task contract`
- Scope: daily prep
- Use this when: the active step is daily prep and daily file generation
- Do not use this as: the only source for architecture or signal packaging behavior

## Purpose
Use this doc for the daily signal-sourcing loop.

Use it when Feems says it is time to do the daily work for signals.

This is the daily prep task.
It is separate from the signal task.
It may be run earlier than the signal task.
The signal task depends on the outputs created here.

This loop must be followed in order:

- ask Feems
- read
- update status
- analyze
- transcribe
- produce

## Goal
Primary goal:

- get into the weekly top 3 to earn more

Secondary goal:

- maximize brief inclusion, leaderboard position, and streak value

This is the controlling document for the daily signal-prep loop.

Start here and follow it exactly.

The outputs created by this task are required before `docs/daily-signal-job.md` can be run correctly for the same cycle date.

## Daily Task Contract
When this daily prep task is invoked, the chat must do the file work automatically.

Do not wait for Feems to separately ask for file creation.

The daily prep task must:

- create or update `data/reports/daily/YYYY-MM-DD.md`
- create or update `data/briefs/YYYY-MM-DD.md`
- use the active local cycle date for both files
- fill the daily report using the required template structure
- save the brief artifact separately from the daily report

Feems should only need to provide missing daily inputs.
Feems should not need to remind the chat to create the daily files.

## How Agents Earn
AIBTC News is built for agent economics. There are multiple earning paths for registered correspondents:

- Brief Revenue Share: when a reader or agent pays `1,000 sats sBTC` to unlock a compiled brief, `70%` is split among all correspondents who filed signals that day
- Brief Inclusion Payout: each signal compiled into a published brief earns `30,000 sats sBTC`; up to `6` signals per day per correspondent means up to `180,000 sats/day`
- Weekly Leaderboard Prizes: top correspondents earn weekly prizes of `200,000 sats` for 1st, `100,000 sats` for 2nd, and `50,000 sats` for 3rd
- Streak Bonuses: filing signals on consecutive days builds streak strength, which helps leaderboard position and weekly prize upside
- x402 Intel Sales: agents with compiled briefs can sell intelligence directly to other agents through x402 HTTP payments

This means the sourcing goal is not just "find interesting stories."
The sourcing goal is to run an effective daily loop that improves odds of brief inclusion, leaderboard gains, and earnings.

## Ask Feems
Before doing any sourcing work, ask Feems for any missing daily inputs.

Always ask Feems for:

- daily brief or briefs
- prior day's brief
- publisher responses on approved signals
- publisher responses on denied signals
- daily ranking
- Feems's ranking

Also ask Feems for these if they are not already included:

- top 6 correspondents
- latest approved signals
- latest rejected signals

Do not skip this step.

## Read
Once Feems provides the daily inputs, read these in order:

1. Daily brief or briefs
   Read these first.
   Use to see what actually won.
   Treat them as the primary template for today's headline shape, body shape, and consequence framing.
   Archive the actual brief used for the cycle in:
   - `data/briefs/YYYY-MM-DD.md`
   Keep the brief artifact separate from the daily prep report.

2. Prior day's brief
   Use to compare today's winners against the most recent prior cycle.
   Prefer a real archived prior brief file in:
   - `data/briefs/YYYY-MM-DD.md`
   Use a prior-day daily report only as a declared proxy when no prior brief artifact exists.

3. Publisher approved and denied responses
   Use to see what is converting and what is failing.

4. Daily ranking, Feems's ranking, and top 6 correspondents
   Use to understand leaderboard pressure and what kind of upside is needed today.

5. `docs/lean-signal-workflow.md`
   Use for the default low-token sourcing flow and fast-screen behavior.

6. `README.md`
   Read only:
   - `Top rejection reasons`
   - `What gets published (not just approved)`
   - `Publisher alignment rules`

7. `data/state/filed-signals.json`
   Use to see what was sent, what is unresolved, and what needs status updates.

8. `data/reports/daily/YYYY-MM-DD.md`
   Use the dated daily report file for the active cycle.
   If it does not exist yet, create it by copying:
   - `data/reports/daily/TEMPLATE.md`
   Then name the new file:
   - `data/reports/daily/YYYY-MM-DD.md`
   Read the prior day's `.md` for recent lessons and next-day adjustments.

9. `memory/learnings.md`
   Use for short operational reminders and avoidable mistakes.
   Treat its exclusions and prior failure patterns as hard filters before generating any new signal candidates.

10. `data/briefs/YYYY-MM-DD.md`
   Use the dated brief artifact file for the active cycle.
   If it does not exist yet, create it and save the exact brief text or exact brief reference used for the cycle.

## Update Status
Before analyzing new signals, update the current state.

This is required.

This is a blocking gate.

Do not move into fresh sourcing, deep reads, candidate generation, or new signal analysis until every recent filed item has either:

- a confirmed status
- an inferred status labeled as inference
- or an explicit `pending` / `unresolved` label

Use:

- today's brief
- prior day's brief
- publisher approved responses
- publisher denied responses
- `data/state/filed-signals.json`
- the current cycle daily report file: `data/reports/daily/YYYY-MM-DD.md`
- prior day's daily report

Check what Feems sent and update whether each recent signal is:

- `published`
- `approved_not_in_brief`
- `approved`
- `rejected`
- `denied`
- `pending`
- `duplicate_loss`
- `unresolved`

Do not move into fresh signal work until recent statuses are understood.

If a status cannot be fully confirmed from direct evidence, mark it as inference and state why.

## Write-Back Rules
After prep is complete, write back only the right information to the right files.

Write to:

- `data/briefs/YYYY-MM-DD.md`
  - archived actual brief text or exact brief reference used for the cycle
- `data/reports/daily/YYYY-MM-DD.md`
  - prep analysis, status review, substitutions, and handoff
- `memory/learnings.md`
  - durable lessons from the cycle
- `data/state/filed-signals.json`
  - confirmed status updates only

Hard rules:

- update `memory/learnings.md` only with durable lessons
- update `data/state/filed-signals.json` only for fully confirmed statuses
- do not overwrite inferred statuses in `data/state/filed-signals.json`
- if a status is inferred, keep it in the daily report only until confirmed
- if a brief artifact does not exist yet for the cycle, create `data/briefs/YYYY-MM-DD.md`
- keep brief artifacts separate from prep reports

## Analyze
After the daily inputs are read and recent statuses are updated, analyze all of the following:

1. What actually made the brief today.
2. What made the prior day's brief.
3. Who appeared on the brief more than once.
4. Whether any top-6 correspondent appeared more than once.
5. What Feems sent recently and whether it was published, approved, denied, rejected, or unresolved.
6. What kinds of stories were approved but not strong enough to dominate the brief.
7. What kinds of stories were denied and why.
8. What ranking pressure exists today.
9. What kind of story shape gives Feems the best chance to gain ground toward weekly top 3.

Tie ranking pressure and story-shape conclusions back to:

- brief payout odds
- leaderboard gain
- streak value
- weekly top-3 prize odds

## Deep Reads
Open these after the daily inputs are understood and a candidate survives the fast screen:

- `docs/signal-sourcing-checklist.md`
- `docs/first-live-signal.md`
- `data/reports/competitor-review/YYYY-MM-DD.md`
- `data/reports/competitor-review/YYYY-MM-DD.json`
- `docs/brief-winner-tracking.md`
- `data/reports/strategy/YYYY-MM-DD.json`
- `data/state/top_5_competitor_styles.json`

## Use The Right Doc For The Right Job

- `docs/signal-sourcing-checklist.md`
  - deeper qualification
  - headline shaping
  - signal construction

- `docs/first-live-signal.md`
  - final gate before treating a candidate as fileable

- `data/reports/competitor-review/YYYY-MM-DD.md` and `.json`
  - current competitor behavior
  - top-agent patterns

- `docs/brief-winner-tracking.md`
  - repeat winners
  - same-day multi-win behavior

- `data/reports/strategy/YYYY-MM-DD.json`
  - strategy behavior summary
  - one of the best references for what winning behavior looks like now

- `data/state/top_5_competitor_styles.json`
  - compact top-5 competitor style memory

## Transcribe
Transcribe the important daily findings into a simple internal model before writing:

- what Feems sent recently
- what changed in status since the last cycle
- winning beats today
- winning beats in the prior cycle
- repeat winners today
- top-6 pressure
- approval patterns worth copying
- denial patterns to avoid
- story shapes with the best weekly top-3 upside

Anchor the decision model to examples from the current cycle whenever possible.

Keep this transcription short and useful.
It is not the final answer.
It is the step that turns raw inputs into a decision model.

## Output Discipline
The daily prep summary must prove the loop was followed exactly.

Do not collapse the work into vague narrative prose.

The final prep output must be checklist-shaped and explicit.

Hard rules:

- always declare the exact cycle dates being compared
- always state which brief is being treated as `today's brief` and which is the `prior cycle`
- always separate what came from Feems versus what was found locally
- always state when a required input was satisfied by a substitute source
- always name any still-missing inputs explicitly
- if nothing is missing, write `none`
- always distinguish a true prior-day brief from a prior-day proxy such as a daily report
- always list the exact docs read
- always list the exact filed items reviewed before status updates
- always include a standalone `what Feems sent recently` section
- always map each reviewed item to one status
- always include the evidence used for that status
- always mark whether a conclusion is direct evidence or inference when that is not obvious
- always compare today's brief against the prior cycle directly
- always state explicitly whether any top-6 correspondent repeated on today's brief
- always break out approved review from rejected/denied review
- always break out `approved_not_in_brief` from generic `approved`
- always state why each `approved_not_in_brief` item likely lost the brief slot
- always report every required status bucket, even when empty
- if a bucket has no confirmed items, write `none confirmed`
- if `latest approved signals` or `latest rejected signals` were not provided as separate lists, explicitly say whether publisher responses were used as the substitute
- always tie conclusions back to payout, leaderboard, streak, or weekly top-3 odds
- always end the decision model with next-cycle operating rules
- always end prep-only work by stating that no signal candidates were produced
- do not claim the loop is complete unless every required output section is present

This means the final prep output must make it easy to verify:

- which exact cycle dates were used
- what inputs were provided by Feems
- what inputs were pulled from the local repo
- what inputs were satisfied by substitution
- what exact docs were read
- which recent filed signals were reviewed
- what Feems sent recently
- which status each signal received
- what actually won today versus the prior cycle
- whether any top-6 correspondent repeated
- what was approved but did not make the brief
- what was denied or rejected and why
- what ranking pressure exists today
- what short decision model should guide the next sourcing cycle
- what approved and rejected inputs were reviewed separately
- what pending items still need outcome checks
- what durable lessons should be written back
- what the next signal-generation handoff should be
- what files were updated during write-back
- whether the current cycle daily report file was created and updated
- what brief artifact file was created or used

## Required Output Format
Use this exact section structure for the daily prep summary.

If a section has nothing to report, write `none` instead of omitting it.

Write the completed daily prep summary to:

- `data/reports/daily/YYYY-MM-DD.md`

Archive the brief artifact used for this cycle in:

- `data/briefs/YYYY-MM-DD.md`

Use this file as the starting template:

- `data/reports/daily/TEMPLATE.md`

Replace `YYYY-MM-DD` with the active local cycle date for the prep run.

### Inputs gathered
- Cycle dates:
- Today's brief:
- Prior cycle brief:
- From Feems:
- From local repo:
- Substitute inputs used:
- Prior-day proxy used:
- Still missing:

### Input coverage check
- Latest approved signals:
- Latest rejected signals:
- Publisher approvals used as substitute:
- Publisher denials used as substitute:
- Inbox/chat content used as substitute:

### Brief artifacts used
- Current brief file/reference:
- Prior brief file/reference:

### Docs read
- exact file path or input source

### What Feems sent recently
- signal_id:
  headline:

### Filed items reviewed
- signal_id:
  headline:

### Status updates by item
- signal_id:
  headline:
  status:
  evidence:
  confidence:

### Status bucket check
- published:
- approved_not_in_brief:
- approved:
- rejected:
- denied:
- pending:
- duplicate_loss:
- unresolved:

### Approved signals reviewed
- signal_id:
  headline:
  source:
  note:

### Rejected signals reviewed
- signal_id:
  headline:
  source:
  note:

### Today vs prior-day brief
- Today:
- Prior cycle:
- Repeat winners:
- Top-6 repeaters:
- What changed:

### Approved review
- Published:
- Approved not in brief:
- Why approved-not-in-brief lost:
- Approval patterns worth copying:

### Rejected/denied review
- Denied:
- Rejected:
- Patterns to avoid:

### Ranking context
- Top 6:
- My rank:
- Earnings gap:
- Pressure:
- Payout implications:

### Decision model
- short operational model for the next sourcing cycle
- Next-cycle operating rules:

### Pending watchlist
- signal_id:
  headline:
  why_still_pending:
  what_to_recheck_next:

### Durable lessons to carry forward
- lesson:
  write_to:

### Signal-generation handoff
- Best beats to target next:
- Beats to avoid:
- Strongest story shapes:
- Unresolved items to recheck before sourcing:

### Write-back updates made
- `data/reports/daily/YYYY-MM-DD.md`:
- `memory/learnings.md`:
- `data/state/filed-signals.json`:
- Inferred statuses left only in daily report:
- `data/briefs/YYYY-MM-DD.md`:
- Other files:

### Prep-only boundary
- No signal candidates produced:

### Write-back updates made
- `data/reports/daily/YYYY-MM-DD.md`:
- `memory/learnings.md`:
- `data/state/filed-signals.json`:
- Other files:

## Produce
After asking, reading, analyzing, and transcribing, produce the final signal candidates.

Do not stop at analysis.
Synthesize and write.

Keep only the strongest candidates with real brief and leaderboard upside.

## Signal Output Format
Signals must be human-readable.

Each signal includes:

- `Headline`
- `Analysis`
- `Sources`
- `Tags`

The output should be easy for Feems to review quickly.

## Precision Rules
To save tokens and stay precise:

- ask Feems for the daily inputs first
- start with today's brief, the prior day's brief, publisher responses, rankings, and top-6 context
- read only the named `README.md` sections
- update recent signal statuses before sourcing fresh ideas
- use deep docs only after the daily inputs are understood
- use today's brief as the closest truth
- prefer short conclusions over long summaries

## One-Line Summary
Ask Feems.
Read.
Update status.
Analyze.
Transcribe.
Produce.
Optimize for weekly top-3 earnings.
