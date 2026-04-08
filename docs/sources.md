# Sources

## Purpose
This document lists the canonical public sources used to define the AIBTC Onchain Signal Agent.
It also captures the source patterns that appear in published AIBTC daily briefs, so the agent can
learn from what the publisher actually selects instead of treating every true update as worth
filing.

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

## Published Brief Source Pattern
Observed from published AIBTC daily briefs on March 25, March 26, and March 27, 2026:

- most selected signals use 2-4 sources, not just one
- the first source is usually the primary proof source
- the remaining sources usually serve one of three jobs:
  - verification
  - consequence/context
  - operator-action support
- published signals usually do not rely only on generic recap articles
- official releases, docs, GitHub releases, APIs, explorers, mempool data, and named research
  reports appear often
- secondary media is usually strongest when it sharpens consequence, money at stake, urgency, or
  external validation
- published briefs can use external stories when they create a direct wallet, signing, custody,
  compliance, security, or execution consequence for agents
- before pitching an external story, check whether the same topic is already in approved,
  submitted, or rejected feeds so we do not waste a filing on an occupied angle

## Source Role Rules
Every serious candidate should try to include:

- 1 `primary-proof` source
- 1 `verification` source
- optional 1 `context` source if it improves the operator takeaway

Avoid filing candidates where:

- all sources are secondary summaries of the same story
- there is no clear primary proof source
- the sources prove the event happened but do not help explain why it matters now
- the story depends on a weak blog post when an official release, API, filing, or report exists

## High-Value Runtime Sources
- direct onchain proof
- mempool and raw query results
- contract analysis
- daily brief
- live activity feed
- agent registry and reputation endpoints

## Beat Source Map
These are the source families we should actively monitor because they match the kinds of sources
used in published briefs.

### Agent Economy
Use when the story is about agent payments, x402 flows, wallet standards, registration/reputation,
or agent-to-agent economic infrastructure.

Primary sources:
- official product docs and launch pages
- protocol or company API docs
- x402 protocol docs and implementation repos
- wallet/provider announcements from the operator itself
- direct AIBTC endpoints for agent activity, identity, or payment context

Verification/context sources:
- CoinDesk
- The Block
- Bitcoin.com
- CryptoSlate
- major businesswire / PR distribution only when the source is the actual announcement

Examples from published briefs:
- x402 adoption stories
- wallet infrastructure for agents
- agent payment and identity standards

### Deal Flow
Use when the story is about money, contracts, ATS launches, sponsorships, funding, bounty flow, or
commercial expansion.

Primary sources:
- company press releases
- funding announcements
- official ATS / marketplace / custody launch pages
- SEC / FINRA / regulated market disclosures when available
- platform data showing stalled or completed bounty value

Verification/context sources:
- Axios
- The Block
- CoinDesk
- PRNewswire
- CNBC / Bloomberg / other major financial press

Strong signal shape:
- exact $ amount
- named round / contract / product
- clear commercial consequence

### Distribution
Use when the story is about brief distribution, correspondent recruitment, readership, and network
content reach.

Primary sources:
- aibtc.news and AIBTC APIs
- direct distribution dashboards or internal network metrics
- Paperboy logs and delivery records

Verification/context sources:
- direct public stats pages
- public readership / campaign analytics endpoints

Notes:
- do not file empty beat-count summaries
- prefer distribution stories that reveal network change, growth, or operator leverage

### Governance
Use when there is a vote, signer action, multisig operation, staking threshold shift, or formal
governance outcome with consequences.

Primary sources:
- official governance forums
- multisig or signer announcements
- Stacks governance docs
- onchain governance records
- explorer pages showing the executed change

Verification/context sources:
- official blog posts
- CoinDesk / The Block / Decrypt when they add timing or implications

Strong signal shape:
- exact vote count
- named proposal
- activation block or deadline

### Infrastructure
Use for tooling, API, relay, protocol, node, MCP, and dependency changes that operators depend on.
This beat should be selective. Routine web-tool updates are usually not enough.

Primary sources:
- GitHub releases
- GitHub PRs and compare views
- official release notes
- official docs and changelogs
- API docs and status pages
- Hiro Explorer / Hiro API
- mempool.space
- blockchain explorers when the operator consequence is visible onchain

Priority repos and vendors:
- `aibtcdev/x402-sponsor-relay`
- `aibtcdev/aibtc-mcp-server`
- `aibtcdev/agent-news`
- `aibtcdev/landing-page`
- `stacks-network/stacks-core`
- major wallet / custody / infrastructure providers only when the release changes operator behavior

Verification/context sources:
- CoinDesk
- The Block
- Bitcoin Magazine
- CryptoSlate
- official provider docs or second release note

Only file when at least one is true:
- there is a mandatory upgrade
- there is breakage or outage risk
- the change fixes a real operational failure mode
- the change materially improves reliability, nonce handling, queueing, settlement, or deploy paths
- the release creates a new action operators should take now

Reject by default:
- predictable MCP launch coverage
- generic framework updates
- feature lists with no operational consequence

### Onboarding
Use when the story is about Genesis progression, registrations, referrals, first-time
participation, or network stratification after onboarding.

Primary sources:
- `https://aibtc.com/api/heartbeat`
- `https://aibtc.com/api/leaderboard`
- `https://aibtc.com/api/achievements`
- direct AIBTC profile / orientation endpoints
- agent registry pages

Verification/context sources:
- public leaderboard pages
- other public AIBTC endpoints that confirm counts or progression

Strong signal shape:
- exact count gap
- ranking split
- milestone threshold
- a non-obvious behavioral pattern from the network data

### Security
Use when the story involves exploits, vulnerabilities, wallet risk, supply-chain attacks, known
unfixed audit findings, or concrete mitigation needs.

Primary sources:
- vendor advisories
- official disclosures
- security researcher writeups
- audit reports
- incident postmortems
- Chainalysis / TRM / Elliptic reports
- direct onchain exploit traces or public forensic dashboards

Verification/context sources:
- CoinDesk
- The Block
- The Hacker News
- security vendor blogs
- forensic explainers from named firms

Priority research sources:
- Chainalysis
- TRM Labs
- Rekt.news
- SlowMist
- samczsun
- OtterSec
- CoinFabrik
- Clarity Alliance
- Halborn

Required shape:
- exact $ amount or named vulnerability class
- named victim / protocol / software exposure
- a concrete operator action or mitigation

### Agent Trading
Use when the story reveals a trading edge, structural market divergence, order-book asymmetry, or
 onchain trading setup that matters to operators.

Primary sources:
- CoinGecko API
- DexScreener API
- protocol trading dashboards
- exchange / market data APIs
- onchain position and liquidity data

Verification/context sources:
- official token pages
- market data providers
- one high-quality reporting source if it helps anchor the event

Notes:
- prefer structural trading signals over generic price commentary
- reject if the story is only "coin up/down" without a usable angle

### Agent Social
Use when coordination, collaboration, DMs, partnerships, or social reputation changes have direct
operational impact.

Primary sources:
- direct posts from the named parties
- official collaboration announcements
- public reputation / network signals

Verification/context sources:
- a second participant confirmation
- public AIBTC reputation or network evidence

Notes:
- this beat is weak unless the coordination changes money, access, reputation, or execution

### Agent Skills
Use sparingly. Based on published-brief review and current strategy, this beat should be deprioritized
unless the skill changes operator behavior in a concrete, non-predictable way.

Primary sources:
- official release notes
- official docs
- GitHub releases
- benchmark papers or reports

Verification/context sources:
- a second benchmark or practitioner source
- one strong secondary explainer

Reject by default:
- "tool now supports MCP"
- generic model or framework launches
- predictable web-product updates
- features without a clear human or operator consequence

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
- GitHub `aibtcdev/landing-page` — **only** when the release fixes a named x402 or inbox/payment failure mode with a concrete agent consequence. Version bumps, dependency patches, UI tweaks, and timeout adjustments without a named failure mode = auto-reject regardless of version number.
- Any `aibtcdev` repo release in the last 24 hours
- Stacks Core releases: `github.com/stacks-network/stacks-core`
- Hiro API changelogs and status page
- mempool.space when fee, hashrate, or difficulty conditions create an operator-relevant window

## Sources Observed In Published Briefs
These appeared repeatedly in the published examples and should be treated as strong source pools:

- GitHub releases and PRs
- official docs pages
- mempool.space
- Hiro Explorer / Hiro API
- DeFiLlama
- CoinGecko
- DexScreener
- Farside
- Glassnode
- LunarCrush
- Chainalysis
- TRM Labs
- major crypto reporting outlets: CoinDesk, The Block, Decrypt, Bitcoin Magazine, CNBC, Reuters

## Source Selection Rules For Future Filing
Before filing, ask:

- is there a primary source stronger than the article I am using now?
- do my sources prove both the event and the consequence?
- would the publisher trust this source mix enough to run it with minimal rewriting?
- am I using a source pattern that resembles already published AIBTC stories?

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
