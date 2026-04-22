# Sources

## Purpose

This document lists the current source pools used by the AIBTC signal agent.
It should match `data/config/monitored-sources.json`, `data/config/monitored-repos.json`, and the active beat set in `AGENTS.md`.

Active filing beats:

- `aibtc-network`
- `bitcoin-macro`
- `quantum`

Retired beat names such as `infrastructure`, `agent-skills`, `deal-flow`, `agent-trading`, `bitcoin-yield`, `onboarding`, `security`, `governance`, and `distribution` are historical only. Do not use them for new filing payloads unless the live beat contract changes.

## Source Usage Rules

- Treat feeds and repo hits as leads, not proof.
- Prefer primary proof: official docs, releases, PRs, commits, APIs, filings, explorer pages, or named research reports.
- Every fileable signal needs a concrete anchor: PR number, version, block height, txid, contract address, named metric, dated report, or equivalent.
- Use secondary media only when it adds verification, consequence, timing, or operator context.
- Check `data/briefs/YYYY-MM-DD.md`, `data/state/brief-winners-YYYY-MM-DD.json`, and `data/state/signal-history.json` before drafting to avoid duplicates.
- For metric-heavy claims, use timestamped evidence and multi-source confirmation when possible.

## Monitored News And RSS Feeds

These entries come from `data/config/monitored-sources.json` `newsFeeds`.

| Name | URL | Publication sentence |
| --- | --- | --- |
| CoinDesk RSS | `https://www.coindesk.com/arc/outboundfeeds/rss/` | CoinDesk is a crypto news publication used for Bitcoin, market structure, policy, custody, and infrastructure reporting. |
| Cointelegraph RSS | `https://cointelegraph.com/rss` | Cointelegraph is a crypto news publication used for market, regulation, wallet, compliance, and ecosystem leads that need primary-source verification. |
| Decrypt RSS | `https://decrypt.co/feed` | Decrypt is a crypto news publication used for security, wallet, agent, exploit, and ecosystem stories that may affect operators. |
| Bitcoin Magazine RSS | `https://bitcoinmagazine.com/.rss/full/` | Bitcoin Magazine is a Bitcoin-focused publication used for Bitcoin network, custody, fee, mining, wallet, and protocol context. |
| arXiv Quantum Bitcoin Search | `https://export.arxiv.org/api/query?search_query=all:(bitcoin%20OR%20secp256k1%20OR%20taproot)%20AND%20all:(quantum%20OR%20post-quantum%20OR%20PQC%20OR%20Dilithium)&start=0&max_results=20` | arXiv is a research preprint source used for Bitcoin-specific quantum, post-quantum, cryptography, and signature-risk papers. |
| NIST PQC News | `https://csrc.nist.gov/news` | NIST is a standards source used for post-quantum cryptography updates, FIPS publications, and PQC migration context. |
| The Block RSS | `https://www.theblock.co/rss.xml` | The Block is a crypto news publication used for funding, custody, security, market, and institutional crypto reporting. |
| PR Newswire Releases | `https://www.prnewswire.com/news-releases/news-releases-list/` | PR Newswire is a press-release distribution source used for official company announcements, funding, product launches, and partnerships. |
| Chainalysis Blog | `https://www.chainalysis.com/blog/` | Chainalysis is a blockchain analytics and security source used for crime, exploit, ransomware, fraud, and wallet-risk reports. |
| BleepingComputer RSS | `https://www.bleepingcomputer.com/feed/` | BleepingComputer is a cybersecurity publication used for malware, exploit, credential, Linux, wallet, and ransomware risk leads. |
| Infosecurity Magazine RSS | `https://www.infosecurity-magazine.com/rss/news/` | Infosecurity Magazine is a cybersecurity publication used for security, regulation, compliance, exploit, ransomware, and credential-risk leads. |

### Feed Filters

Bitcoin Macro feeds focus on Bitcoin, Stacks, security, wallets, custody, x402, agents, MCP, exploits, regulation, stablecoins, funding, or compliance. They exclude generic price-direction stories and weak market commentary unless there is a concrete agent-relevant consequence.

Quantum feeds focus on Bitcoin/secp256k1/Taproot plus quantum, post-quantum, PQC, Dilithium, Schnorr, or cryptography. They exclude generic price, ETF, market, and treasury stories.

## Monitored API Snapshots

These entries come from `data/config/monitored-sources.json` `apiSnapshots`.

| Name | URL | Source sentence |
| --- | --- | --- |
| mempool.space Fees | `https://mempool.space/api/v1/fees/recommended` | mempool.space fees provide live Bitcoin fee estimates for settlement-cost and timing claims. |
| mempool.space Difficulty | `https://mempool.space/api/v1/difficulty-adjustment` | mempool.space difficulty data provides Bitcoin mining and adjustment context for network-condition claims. |
| CoinGecko Trending | `https://api.coingecko.com/api/v3/search/trending` | CoinGecko trending data provides market-attention leads that require stronger primary proof before filing. |
| DexScreener Token Boosts | `https://api.dexscreener.com/token-boosts/top/v1` | DexScreener boost data provides token-market leads that require verification and a clear operator consequence. |
| Farside Bitcoin ETF | `https://farside.co.uk/btc/` | Farside provides Bitcoin ETF flow data for institutional demand, liquidity, and market-structure context. |
| LunarCrush Rankings | `https://lunarcrush.com/markets` | LunarCrush provides social and market ranking leads that require primary-source confirmation before filing. |
| Hiro Smart Contracts | `https://api.hiro.so/extended/v1/tx?type=smart_contract&limit=20&order=desc` | Hiro smart-contract data provides Stacks deployment activity for contract, protocol, and network-operation claims. |
| Stacks Core Info | `https://api.mainnet.hiro.so/v2/info` | Stacks Core info provides chain and node-state data for Stacks network condition checks. |
| DefiLlama Stacks | `https://api.llama.fi/chains` | DefiLlama chain data provides TVL and ecosystem context for Stacks and DeFi-related claims. |
| AIBTC Heartbeat | `https://aibtc.com/api/heartbeat?address=bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv` | AIBTC heartbeat data provides agent activity and check-in status for network participation claims. |
| AIBTC Leaderboard | `https://aibtc.com/api/leaderboard` | AIBTC leaderboard data provides agent rankings, scores, and competition context for network-performance claims. |
| AIBTC Achievements | `https://aibtc.com/api/achievements?btcAddress=bc1q0y4jqghkwkuv030n7ur6s2fejhu8tx7p78harv` | AIBTC achievements data provides badge and progress context for agent activity claims. |

## Monitored Repositories

These entries come from `data/config/monitored-repos.json`.

| Name | URL | Source sentence |
| --- | --- | --- |
| aibtcdev/x402-sponsor-relay | `https://github.com/aibtcdev/x402-sponsor-relay` | x402 sponsor relay changes are primary proof for payment, relay, sponsorship, and settlement workflow claims. |
| aibtcdev/agent-tools-ts | `https://github.com/aibtcdev/agent-tools-ts` | Agent tools changes are primary proof for TypeScript tooling, SDK, and operator workflow claims. |
| aibtcdev/aibtc-mcp-server | `https://github.com/aibtcdev/aibtc-mcp-server` | MCP server changes are primary proof for agent tool access, API behavior, and integration claims. |
| aibtcdev/agent-news | `https://github.com/aibtcdev/agent-news` | Agent News changes are primary proof for publisher, signal, brief, and filing workflow claims. |
| aibtcdev/aibtc-dev-tools | `https://github.com/aibtcdev/aibtc-dev-tools` | AIBTC dev-tools changes are primary proof for developer tooling and operator utility claims. |
| hirosystems/stacks-blockchain-api | `https://github.com/hirosystems/stacks-blockchain-api` | Hiro Stacks API changes are primary proof for API, indexing, and Stacks data-access claims. |
| hirosystems/clarinet | `https://github.com/hirosystems/clarinet` | Clarinet changes are primary proof for Clarity development, testing, and deployment workflow claims. |
| stacks-network/stacks-core | `https://github.com/stacks-network/stacks-core` | Stacks Core changes are primary proof for node, protocol, and chain behavior claims. |
| aibtcdev/ai-agent-crew | `https://github.com/aibtcdev/ai-agent-crew` | AI agent crew changes are primary proof for agent orchestration and workflow capability claims. |
| stacksgov/sips | `https://github.com/stacksgov/sips` | Stacks SIP changes are primary proof for governance, standards, and protocol proposal claims. |
| bitcoin/bips | `https://github.com/bitcoin/bips` | Bitcoin BIPs are primary proof for Bitcoin standards, including post-quantum or signing-related proposals. |

## Primary AIBTC References

- `https://aibtc.com/guide`
- `https://aibtc.com/activity`
- `https://aibtc.com/skills`
- `https://aibtc.com/install`
- `https://aibtc.com/agents`
- `https://aibtc.com/api/register`
- `https://aibtc.com/api/openapi.json`
- `https://aibtc.com/.well-known/agent.json`
- `https://aibtc.com/llms.txt`
- `https://aibtc.news`
- `https://aibtc.news/api/signals`

## Active Beat Source Map

### AIBTC Network

Use for AIBTC protocol, agent infrastructure, relay/payment, leaderboard, registration, governance, reputation, and operational network changes.

Strong primary sources:

- AIBTC APIs and docs
- GitHub repos in the `aibtcdev`, `hirosystems`, `stacks-network`, and `stacksgov` monitored list
- Hiro API and Stacks Core endpoints
- mempool.space when fees, difficulty, or Bitcoin settlement conditions affect agent operations
- onchain explorers for tx, contract, deployment, or settlement proof

Reject by default:

- generic ecosystem chatter with no AIBTC operator consequence
- repo updates without a shipped change, metric, failure mode, or action
- API-only circular claims sourced only from aibtc.news

### Bitcoin Macro

Use for Bitcoin market, fee, mining, ETF, regulatory, custody, security, and macro conditions that create a concrete agent operating implication.

Strong primary sources:

- CoinDesk, Cointelegraph, Decrypt, Bitcoin Magazine, The Block
- Farside Bitcoin ETF data
- Chainalysis, BleepingComputer, Infosecurity Magazine, and other named security/report sources
- official filings, company releases, or regulator pages when available

Reject by default:

- price went up/down stories with no operational implication
- unsupported macro claims
- weak secondary aggregators as the only proof
- quantum/post-quantum stories, which route to `quantum`

### Quantum

Use for Bitcoin-specific post-quantum cryptography, BIP-360/P2MR migration work, secp256k1/ECDSA risk analysis, quantum readiness deltas, and named research that changes Bitcoin or agent signing assumptions.

Strong primary sources:

- arXiv papers matching Bitcoin/secp256k1/Taproot and quantum/PQC terms
- NIST PQC updates
- `bitcoin/bips`
- Bitcoin Core or Delving Bitcoin discussions when paired with durable proof
- named research reports or official quantum/security publications

Reject by default:

- vague "quantum is coming" narratives
- proposal-thread-only evidence without a durable state artifact
- PR-page-only evidence without a shipped spec, commit, release, or maintainer-owned artifact
- claims that imply Bitcoin is currently broken without exact resource estimates and context

## Published Brief Source Pattern

Observed winning signals tend to use:

- one primary proof source first
- one verification or consequence source when available
- exact numbers, timestamps, versions, PR numbers, block heights, or named metrics
- article-shaped CLAIM / EVIDENCE / IMPLICATION / Directive structure

Avoid filing candidates where:

- all sources are secondary summaries of the same story
- the sources prove an event happened but not why it matters now
- the candidate is already covered in today's brief or recent signal history
- there is no clear operator action or watch item
