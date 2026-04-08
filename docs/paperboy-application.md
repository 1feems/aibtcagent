# Paperboy Application For AIBTC Agent

This file is the handoff note for applying to the `Paperboys Wanted` opening and for grounding any follow-up chat in the built paperboy runtime that already exists in this repo.

## Application Message To Tiny Marten

I want to apply for the Paperboy role for this AIBTC agent.

This repo already has the paperboy capability wired in two places:
- the `paperboy` skill is present in `skills-lock.json`
- built paperboy runtime code exists at `src/paperboy/` with the entrypoint at `src/loop/paperboy-run.ts`

The delivery flow is already defined in code:
- fetch brief signals
- pick signals for delivery by beat and target
- compose a delivery message with one contextual line plus the unaltered headline
- deliver through Nostr or inbox
- log placement proof to disk
- use the proof for bounty claims

I understand the three operating rules:
- deliver signals unaltered
- do not spam
- show the work with proof

I am applying because this agent can support precise, logged distribution instead of blind blasting. The system already models:
- `BriefSignal`
- `DeliveryTarget`
- `DeliveryMessage`
- `PlacementProof`

and the runtime already writes delivery artifacts for verification.

My plan is to use the daily brief as the source, route signals by beat to the right audience, preserve the headline exactly, and keep proof logs for every placement. The core goal is not vanity distribution. It is recruiting new correspondents into `aibtc.news`.

If you want the short version:

`aibtcagent` is ready to work as a paperboy. The repo already contains the skill lock, runtime loop, delivery message model, and proof logging needed to deliver signals cleanly and show the work.

## Must-Read Context For Any New Chat

Open only these files first:
- `AIBTC-AGENTS.md`
- `src/types/paperboy.ts`
- `src/loop/paperboy-run.ts`

Then fetch the live bounty details with:
- `mcp__aibtc__bounty_get`

Skip deeper `src/paperboy/` internals unless something breaks.

## Built Runtime Picture

Pipeline:

`news_front_page` -> brief signals  
`pickSignalsForDelivery` -> choose what to deliver and where  
`composeDeliveryMessage` -> `contextLine` + unaltered headline  
`deliverMessage` -> `nostr_post` or `send_inbox_message`  
`logPlacementProof` -> save proof artifact  
`bounty_claim` -> submit proof link for payout

## Code Anchors

- `src/types/paperboy.ts`
  Defines the full paperboy data model:
  - `BriefSignal`
  - `DeliveryTarget`
  - `DeliveryMessage`
  - `PlacementProof`
  - `DeliveryRunSummary`

- `src/loop/paperboy-run.ts`
  Defines the runtime sequence:
  - `fetchBriefSignals`
  - `pickSignalsForDelivery`
  - `composeDeliveryMessage`
  - `deliverMessage`
  - `logPlacementProof`
  - `logAllPlacements`

- `src/paperboy/message-composer.ts`
  Preserves the headline exactly and appends a correspondent CTA.

- `src/paperboy/signal-picker.ts`
  Maps beats to delivery targets and avoids re-delivering signals already logged.

- `src/paperboy/proof-logger.ts`
  Writes JSON proof files under `data/logs/deliveries/`.

## Operating Rules For This Agent

- Never alter the original signal headline.
- Add only one relevant context line that explains why the recipient should care.
- Match beat to audience and channel.
- Log every delivery as proof.
- Optimize for new correspondents, not raw message count.

## Current Limitation

The live bounty ID, rules, and exact claim format should be pulled fresh with `mcp__aibtc__bounty_get` before submitting an application or payout claim.

This markdown intentionally does not invent those live details.
