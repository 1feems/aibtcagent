# Helper Bugs

Last updated: 2026-04-28

This file tracks filing-helper blockers that should be checked before giving a paste-ready signal JSON.

It must contain the real blocker text we hit in live filing, not just generic helper rules.
When reading this file before building a signal, the goal is to avoid recreating any signal that already failed for one of the reasons logged here.

## Read This First Before Building Any Signal

Do this before drafting any JSON:

1. Read the newest dated section in this file first.
2. Read `Story-Shape Blockers To Avoid Repeating`.
3. Check whether the candidate matches any blocked shape from today.
4. If it does, do not draft that signal family again.
5. Move to a different claim family before writing JSON.

Required pre-draft questions:

- Does this candidate repeat a blocked story shape from today?
- Does this candidate reuse the same metric family with only fresher numbers?
- Does this candidate repeat a previously rejected same-day claim family?
- If this is metric-heavy, do I have enough independent source support and not just one organization?
- Is the body safely below 900 characters before filing?
- Did I include `beat_slug` itself in `tags`?

If any answer is `yes`, stop and reshape before drafting.

## Pre-Draft Stop Signs

Do not build the signal yet if any of these are true:

- the candidate is "same story, newer numbers"
- the candidate is too close to a prior posted brief story shape
- the candidate is too close to an already-filed rejected signal
- the candidate is metric-heavy but only one organization proves the numbers
- the candidate body is 900 characters or longer
- the candidate is missing `beat_slug` in `tags`
- the candidate only passes helper syntax but not winner shape

## How To Use This File

When the operator says "read `docs/helper-bugs.md` first", the expected behavior is:

1. read the newest dated section
2. quote or summarize the exact blocker that applies
3. state what story family is blocked
4. avoid generating JSON in that blocked family
5. only then build the signal

If the blocker is about story shape, changing the headline alone is not enough.

## 2026-04-24

| Time UTC | Area | Verbatim helper or filing error | What caused it | Fix before next JSON |
| --- | --- | --- | --- | --- |
| 17:20 | Beat tag | Payload issue: Signal payload tags must include beat_slug as a primary tag. | The payload used valid lowercase tags, but did not include `beat_slug` itself as a primary tag. | Always include the beat slug in `tags`, usually as the first tag: `bitcoin-macro`, `quantum`, or `aibtc-network`. |
| 17:24 | Prior brief story shape | Template issue: Submission blocked: Headline looks too close to prior posted brief story shape in 2026-04-22 | The signal reused the same core `bitcoin-macro` story family: retarget / blocks remaining / fee-floor / carry consequence. New numbers were not enough to make it a new shape. | Do not reuse a recent winning story family with refreshed numbers. Change the claim family, not just the wording. For `bitcoin-macro`, switch source anchor, metric family, comparison frame, and operator implication. |
| 17:29 | Rejected-shape collision | Template issue: Submission blocked: Headline looks too close to already-filed signal a4f214c1-689a-464f-802c-92276f3196a9 (rejected) | The replacement still sat in the same mining-concentration cluster: top pools + low fees + concentration-risk framing. Even though it was not identical, it was still too close to a previously filed rejected shape. | Treat previously rejected same-day or recent shapes as burned. Do not file another story that uses the same source family + metric family + implication family. Leave the cluster entirely. |
| 17:34 | Body length | Template issue: Submission blocked: Template check failed: body is above 900 characters — shorten it before filing so the live API does not clip the stored signal | The payload body cleared drafting but entered the live clipping zone. The live API does not safely preserve overlong filing copy. | Keep filing copy in the safer 800-900 character range. Count the final `body` before output and trim before filing if it reaches 900 characters. |
| 17:38 | Metric-heavy source verification | Fact-check source verification failed: metric-heavy claim uses only one organization as evidence | The signal made a metric-heavy claim with comparisons or market-wide framing, but only one organization backed the numbers. One source was not enough to independently verify the combined claim. | For metric-heavy claims, require two independent organizations or source systems unless one canonical primary source fully proves the exact claim by itself. If comparison, baseline, or consequence needs a second source, do not draft until both are selected. |

## 2026-04-21

| Time UTC | Area | Verbatim helper or filing error | What caused it | Fix before next JSON |
| --- | --- | --- | --- | --- |
| 08:43 | Disclosure | Payload issue: Signal payload disclosure is required. | The payload reached signal guard without a disclosure field populated. | Always include a non-empty disclosure before helper testing or live submission. Name the model, docs checked, date, and what was verified from which source. |
| 08:52 | Template labels | Template issue: Signal template is incomplete. Add the missing labels: EVIDENCE:, IMPLICATION: | The body did not include the full required signal template labels. | Keep `body` and `analysis` identical and always include `CLAIM:`, `EVIDENCE:`, and `IMPLICATION:` before filing. |
| 08:54 | Headline anchor | Template issue: Headline must include an exact anchor such as a PR, issue, version, endpoint, error code, block height, or hard metric. | The headline did not contain a helper-recognized exact anchor. | Test the headline against the accepted anchor list before JSON output. Use a PR, issue, version, endpoint, block height, sats/dollar amount, percentage, or another helper-recognized hard metric. |

## 2026-04-20

| Time UTC | Area | Verbatim helper or filing error | What caused it | Fix before next JSON |
| --- | --- | --- | --- | --- |
| 13:23 | Helper static asset | ENOENT: no such file or directory, open '/Users/feems/Desktop/aibtcagent-workspace/duplicateaibtcagent2/tools/xverse-register/favicon.ico' | The helper page requested `favicon.ico`, but the file did not exist at the expected helper path. | Add or stub `tools/xverse-register/favicon.ico`, or make the helper return `204` for favicon requests so the missing asset does not pollute helper-error review. |

## 2026-04-17

| Time UTC | Area | Verbatim helper or filing error | What caused it | Fix before next JSON |
| --- | --- | --- | --- | --- |
| 05:44 | Helper static asset | ENOENT: no such file or directory, open '/Users/feems/Desktop/aibtcagent-workspace/duplicateaibtcagent2/tools/xverse-register/favicon.ico' | The helper page requested `favicon.ico`, but the file did not exist at the expected helper path. | Add or stub `tools/xverse-register/favicon.ico`, or make the helper return `204` for favicon requests so the missing asset does not pollute helper-error review. |
| 05:44 | Filing-ready artifact path | ENOENT: no such file or directory, open '/Users/feems/Desktop/aibtcagent-workspace/duplicateaibtcagent2/data/filing-ready/2026-04-16/manual.json' | The helper attempted to load a filing-ready artifact path that did not exist. | Confirm the staged filing-ready JSON path exists before loading it into the helper. If the path is stale, regenerate the artifact or point the helper to the current file. |
| 09:15 | Headline anchor | Template issue: Headline must include an exact anchor such as a PR, issue, version, endpoint, error code, block height, or hard metric. | The headline did not contain a helper-recognized exact anchor. | Test the headline against the accepted anchor list before JSON output. Use a PR, issue, version, endpoint, block height, sats/dollar amount, percentage, or another helper-recognized hard metric. |
| 09:15 | Metric-heavy source verification | Template issue: Submission blocked: Fact-check source verification failed: metric-heavy claim uses only one organization as evidence | The signal made a metric-heavy claim using only one organization as evidence. | For metric-heavy claims, require two independent organizations or source systems unless one canonical primary source fully proves the exact claim by itself. |

## 2026-04-16

| Time UTC | Area | Verbatim helper or filing error | What caused it | Fix before next JSON |
| --- | --- | --- | --- | --- |
| 02:40 | Source verifiability | Submission blocked: Template check failed: sources must be primary and computationally verifiable — use live APIs, exact GitHub PR/issue/release URLs, explorer tx links, or spec docs | The source set did not satisfy the helper whitelist for primary, computationally verifiable sources. | Use only helper-accepted source URLs such as live APIs, exact GitHub PR/issue/release/file URLs, explorer links, spec docs, or other accepted whitelisted source families. |
| 02:44 | Source verifiability | Submission blocked: Template check failed: sources must be primary and computationally verifiable — use live APIs, exact GitHub PR/issue/release URLs, explorer tx links, or spec docs | The URLs `https://x402-relay.aibtc.com/health`, `https://x402-relay.aibtc.com/status/sponsor`, and `https://x402-relay.aibtc.com/wallets` did not satisfy the helper's verifiable-source matcher. | `hasVerifiableSources` only accepts URLs matching `github.com`, `/api/`, `explorer.`, `releases/tag/`, `issues/<n>`, `pull/<n>`, `bip-<n>`, or `docs.`. Swap homepage or status URLs for an accepted primary artifact before filing. |

## 2026-04-07

| Time UTC | Area | Verbatim helper or filing error | What caused it | Fix before next JSON |
| --- | --- | --- | --- | --- |
| 11:05 | Publisher/fact-checker guard | publisher/fact-checker guard failed: analysis must follow the signal template — use CLAIM / EVIDENCE / IMPLICATION / Directive or What changed / What it means / What to do; Headline looks too close to prior posted brief story shape in 2026-04-05 | The analysis read like weak packaging or release notes instead of the required signal template, and the headline collided with a recent prior brief story shape. | Use the exact analysis template with complete sections before filing, and switch to a different story family when the headline shape is already present in a recent brief. |

## 2026-04-24 Analysis

The main blocker today was not syntax. It was story-shape reuse.

What went wrong:

- A technically valid `bitcoin-macro` payload was built around the same shape that had already won or already been filed: retarget percentage + blocks remaining + fee-floor + carry repricing.
- When that shape was blocked, the next version moved into mining concentration, but still overlapped with an already-filed rejected concentration story.
- The payload then hit an avoidable schema issue because `beat_slug` was not also present in `tags`.
- Another payload was allowed to reach filing even though the body was above 900 characters, which risks live clipping.
- Another payload made a metric-heavy claim with only one organization as support, which failed fact-check source verification.

What this means:

- Passing helper syntax does not mean the signal is safe to file.
- A rejected prior filing still poisons that story shape for the day if the replacement is too close.
- The filing helper and publisher both effectively match on claim family, not just wording.
- Final filing copy must be measured, not assumed safe from drafting length alone.
- Metric-heavy claims need independent verification, not just one source with more numbers.

Decision rule learned:

- For `bitcoin-macro`, if a retarget story is blocked for prior brief shape, do not try another retarget story that only changes numbers or phrasing.
- If a mining-concentration story is blocked as too close to a previously filed rejected signal, do not try another pool-share / concentration / low-fee combination that day.
- After a shape collision, move to a different story family entirely, such as ETF flow, Lightning structure, or a different macro data family with a different operator implication.
- If the body reaches 900 characters, trim before filing. Do not rely on the live API to store it intact.
- If the claim is metric-heavy and uses multiple figures, comparisons, or market-wide framing, require a second independent organization unless one canonical primary source fully proves the exact claim.

## 2026-04-22

| Time UTC | Area | Verbatim helper error | What caused it | Fix before next JSON |
| --- | --- | --- | --- | --- |
| 12:45 | Headline anchor | Template issue: Headline must include an exact anchor such as a PR, issue, version, endpoint, error code, block height, or hard metric. | The headline used forms like `21-message`, `9 reused`, and `top-10`, which looked anchored to a human but did not match the helper's allowed headline regex. | Test the headline against `getHeadlineAnchorPass`. Use accepted anchors: `PR #123`, `issue #123`, `v1.2.3`, endpoint path, HTTP error, block height, dollar amount, percentage, sats, or accepted unit forms. |
| 12:55 | Source verifiability | Template issue: Submission blocked: Template check failed: sources must be primary and computationally verifiable — use live APIs, exact GitHub PR/issue/release URLs, explorer tx links, or spec docs | `https://pq-bitcoin.org/posts/bitcoin-qva-1` is editorially relevant but not accepted by `hasVerifiableSources`. | Use the canonical source artifact that matches the helper whitelist: `https://github.com/deadmanoz/pq-bitcoin-website/blob/main/_posts/bitcoin-qva-1.md`. |
| 13:10 | Live API tags | Invalid tags (array of lowercase slugs, 1-10 items, 2-30 chars each) | The helper allowed tags that the live API rejected: `CRQC`, `BIP-360`, and `BIP-361` were uppercase. | Normalize every tag to lowercase slug format before signing: `crqc`, `bip-360`, `bip-361`. |

## 2026-04-22 Analysis

The filed Quantum signal cleared helper gates after repairs, but the live score was only 68. The failure was not only syntax. The workflow drifted from "brief-winning signal" to "payload that submits." That is the wrong optimization target.

What went wrong:

- The story used a current bitcoindev thread, but the supporting metric source was an older QVA-1 article, so timeliness stayed weak.
- The angle was about wallet policy and address reuse, which is relevant to quantum exposure but less direct than today's winning patterns: BIP-361 migration state, exact Stacks block signatures, arXiv ECDLP resource changes, or live secp256k1 signing corpus.
- The first source set was editorially reasonable but not helper-whitelisted. The repair changed the source to GitHub, which fixed submission mechanics but made the signal feel more like source surgery than a stronger story.
- Tags were checked by the helper but not normalized for the live API, so the first live submission attempt failed even after helper checks passed.
- The Stacks-block replacement idea was rejected by local guard as a duplicate of today's brief and prior brief story shapes. That means "fresh block height" alone is not enough when the cluster is saturated.

Decision rule learned:

- Do not submit a Quantum signal just because it passes helper checks. It must also pass winner shape: fresh primary source, non-duplicate cluster, explicit secp256k1/ECDSA/Schnorr or PQ migration consequence, and a direct AIBTC/STX/sBTC operator implication.
- When Quantum is full or near full, reject any candidate locally unless it can plausibly score 90+ or displace a current approved item.
- Before presenting JSON, run three checks: helper syntax, source whitelist, and duplicate/winner-shape review against today's brief.

## Current Guardrails

- Run or mentally apply `getHeadlineAnchorPass` before presenting JSON.
- Run or mentally apply `hasVerifiableSources` before presenting JSON.
- Include `beat_slug` itself in `tags`.
- Keep `body` and `analysis` aligned and below 900 characters; safer target is 800-900.
- Include `CLAIM:`, `EVIDENCE:`, and `IMPLICATION:` labels.
- Include non-empty `disclosure`.
- Keep `sources` as objects with `title` and `url`.
- Check `docs/homepage-brief-snapshots.md` and `docs/publisher-feedback-board.md` for prior story-shape collisions before returning any JSON.
- If a claim is metric-heavy, confirm there is enough independent source support and not just one organization.
- If a signal can be described as "same story, newer numbers," do not file it.

## Story-Shape Blockers To Avoid Repeating

These are not merely syntax issues. These are shapes that should be treated as blocked once they have already failed.

### Bitcoin Macro

The 2026-04-22 brief filled all 10 bitcoin-macro slots. Every shape from that day is treated as blocked until the brief window resets. The following shapes are ALL blocked — do not attempt any of them:

- `block X earns Y sats — Nx block Z` (block-fee volatility, block vs block multiplier)
- `mempool tx count + fee floor + sBTC cost/window`
- `blocks remaining + retarget % + carry desk consequence`
- `hashrate stabilizes + difficulty adjustment`
- `Lightning channel count WoW + average capacity`
- `fee floor all priority tiers + mempool clears`
- `mempool tx count + sBTC broadcast window`
- `difficulty epoch % + retarget % + carry edge lost`
- `mempool count + fee burn % reduction`
- `block confirms + % below prior block + volatility persists`
- `top pools concentration + low fee floor + concentration risk` (also blocked as already-filed rejected signal)

Avoidance rule:

- If any `bitcoin-macro` shape is blocked, do not retry within the same metric family.
- The 2026-04-22 brief covered: block-fee volatility, mempool metrics, retarget/difficulty, hashrate, Lightning channel count, fee floor — all of these families are blocked.
- "Block-fee volatility" was listed as a safe pivot in prior versions of this doc, but it is NOT safe when the 2026-04-22 brief already contains block-fee volatility shapes. Read `data/briefs/2026-04-22.md` before assuming any shape is safe.

Safe pivots after a `bitcoin-macro` shape collision (verified against 2026-04-22 brief):

- ETF / AUM / filing flow ← only shape family NOT on 2026-04-22 brief
- BTC futures basis / perpetual funding rate (Deribit API) ← not on 2026-04-22 brief
- BTC price action with institutional macro catalyst (Tier 1 sourced) ← not on 2026-04-22 brief
- Supply dynamics / exchange outflows (Glassnode/CryptoQuant) ← not on 2026-04-22 brief

Required: Read `data/briefs/2026-04-22.md` and `data/state/brief-winners-2026-04-22.json` before drafting any bitcoin-macro signal. Match every candidate shape against that file's approved headlines to confirm it is not a collision.

## Exact Helper Matcher Notes

The headline helper currently accepts these anchor patterns:

- `issue #123`
- `PR #123`
- `CVE-2026-1234`
- `v1.2.3`
- backticked code or path text
- API paths like `GET /api/name`
- HTTP `4xx` or `5xx`
- `CVSS 9.8`
- `block 12345` or `block height 12345`
- dollar amounts
- percentages
- numeric units for hours, days, cycles, agents, signals, slots, blocks
- sats
- bytes, kb, mb, gb

The source-verifiability helper currently accepts:

- arXiv abs URLs
- IACR ePrint URLs
- NIST URLs
- IBM Research URLs
- Google Quantum AI or Google Research URLs
- gnusha bitcoindev URLs
- Delving Bitcoin URLs
- generic URLs only when they include accepted substrings such as `github.com`, `/api/`, `explorer.`, `releases/tag/`, `issues/<n>`, `pull/<n>`, `bip-<n>`, or `docs.`
