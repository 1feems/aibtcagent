# Sources

## Purpose
This document lists the canonical public sources used to define the AIBTC Onchain Signal Agent.

## Primary AIBTC Sources
- https://aibtc.com/guide
- https://aibtc.com/activity
- https://aibtc.com/skills
- https://aibtc.com/install
- https://aibtc.com/agents
- https://aibtc.com/api/register
- https://aibtc.com/api/openapi.json
- https://aibtc.com/.well-known/agent.json
- https://aibtc.com/llms.txt

## GitHub References
- https://github.com/aibtcdev
- https://github.com/orgs/aibtcdev/repositories

## Important Repository References
- `loop-starter-kit`
- `aibtc-mcp-server`
- `skills`
- `agent-news`
- `x402-api`
- `x402-sponsor-relay`
- `erc-8004-indexer`
- `landing-page`

## Source-of-Truth Local Document
- `aibtc info.docx`

## Source Usage Rules
- use the local requirements doc as the main source of truth
- use AIBTC docs and repos to fill concrete implementation gaps
- prefer public reproducible sources
- do not rely on hidden or unverifiable inputs
- treat inbox or agent chatter as leads, not final proof

## High-Value Runtime Sources
- direct onchain proof
- mempool and raw query results
- contract analysis
- daily brief
- live activity feed
- agent registry and reputation endpoints

## Security Beat Sources
Where to find security candidates that match the approved signal shape:

- **DeFi exploit trackers**: Rekt.news, DefiLlama exploits feed, Chainalysis blog
- **Audit reports**: published audit PDFs from Clarity Alliance, CoinFabrik, Trail of Bits, OtterSec — look for "known unfixed" findings
- **Security research blogs**: slowmist.io, samczsun.com, paradigm.xyz/research
- **CVE / vulnerability disclosures**: relevant when a named protocol is affected and an exact $ amount or attack vector is documented
- **Q1/Q2/annual crypto crime reports**: Chainalysis, TRM Labs, Elliptic — look for first-of-kind stat changes
- **aibtc.news security feed**: `https://aibtc.news/api/signals?beat=security&status=approved` — check what is already filed before sourcing
- **Stacks-specific**: Hiro security advisories, aibtcdev GitHub security tab, x402 relay changelogs with security fixes

## Infrastructure Beat Sources
Where to find infrastructure candidates:

- GitHub `aibtcdev/aibtc-mcp-server` releases
- GitHub `aibtcdev/x402-sponsor-relay` releases
- GitHub `aibtcdev/agent-news` releases
- Any `aibtcdev` repo release in the last 24 hours
- Stacks Core releases: `github.com/stacks-network/stacks-core`
- Hiro API changelogs and status page

## Secondary Strategy Sources
- leaderboard activity
- active agent behavior
- beat saturation patterns
- bounty and Paperboy opportunities

## Development References
Optional development references and tools may be used during implementation to improve code search and QA efficiency.

Example:
- https://github.com/dennisonbertram/lgrep

## Future Runtime Reference
- https://agentic.hosting/
