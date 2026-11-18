# AgentTip — Tip any Agent ID holder by name (BNB)

Entry for the Binance Wallet + BNB Chain **Agent ID Hackathon**
(submission period 2026-11-18 → 2026-12-09 08:00 UTC).

**Status: deployed on BSC mainnet 2026-11-18. NOT submitted yet
(submission channel not found).**

## What it is

AgentTip lets one Agent ID holder tip another Agent ID holder in BNB by
typing their `name.ai` instead of a 0x address. The tip goes straight to
the recipient — the contract never holds funds, charges no fee, and has no
owner.

## The contract

`src/AgentTip.sol` — single file, no imports, Solidity 0.8.24, optimizer
200 runs.

- `tip(address recipient, string calldata message)` payable.
- Requires the **tipper holds an Agent ID** and the **recipient holds an
  Agent ID** (`balanceOf > 0` on the Agent ID contract
  `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, SPACE ID Agent ID, ERC-721).
- Requires recipient != tipper, `msg.value >= 0.0001 BNB`, message <= 140 bytes.
- Forwards the full `msg.value` to the recipient immediately, then emits
  `Tip(tipper, recipient, amount, message, timestamp)`.
- Tracks `totalReceived`, `totalSent`, `tipCount` (tips received) per
  address, plus a `getStats(address)` view.
- **Ownerless by design: there are NO owner/admin functions at all.**
  No pause, no withdraw, no fee setter, no allowlist — nothing to disclose
  under "owner permissions", because there are none.

Contract address: **0x2ecA02A56cF51928ED7d790a0F4d8cC745C2e893**
(BSC mainnet, deployed 2026-11-18, block 134316160;
[BscScan](https://bscscan.com/address/0x2ecA02A56cF51928ED7d790a0F4d8cC745C2e893)).
Deploy tx:
`0x4168dcf5ddd46c884509ebac3390e79954158a6e52520dc5e5f372ab7261236e`,
gas used 406,738. Live site: https://todorichi.github.io/agenttip/
(`site/config.js` holds the address and deploy block).

## Name resolution — verified facts and limits

- **Verified working (2026-11-18):** Binance Agentic Wallet CLI,
  `baw wallet resolve-domain --name nycto.ai --binanceChainId 56` →
  `0x0d8C5bEe45EF5816856448A338aA12fE5281Fe9a` (isFallback false);
  `luqia.ai` → `0xD452E84A2CaF0798aB81e97D8FeCECed144D0aED`.
  On-chain `balanceOf` on the Agent ID contract confirms both hold an
  Agent ID (1 each).
- **Does NOT work for `.ai`:** SPACE ID Web3 Name SDK v0.4.2 — its TLD
  registry lookup for "ai" returns address(0), so `getAddress("nycto.ai")`
  fails deterministically. (Also: the SDK dist needs viem 2.x, although its
  docs say viem ^1.20.) Do not use the SDK for `.ai` names.
- SPACE ID REST API hosts were unreachable from the build sandbox and no
  documented public endpoint was found.
- **Site design (honest fallback):** `site/names.json` is a bundled index
  seeded with the two verified names above; it grows only with names
  verified via `baw wallet resolve-domain` + on-chain `balanceOf`. A name
  not in the index yet can still receive tips by pasting the recipient's
  0x address — the site verifies that address holds an Agent ID on-chain
  before enabling the send button. No address is ever fabricated.

## Tests

Foundry, forked against BSC mainnet with the real Agent ID contract:

```sh
forge install foundry-rs/forge-std --no-git   # once, after cloning
forge test --fork-url https://bsc-dataseed1.binance.org
```

10/10 pass (`test/AgentTip.t.sol`): success path (event, totals,
recipient balance, zero contract balance), min-tip and max-message
boundaries, and reverts for non-holder tipper, non-holder recipient,
self-tip, low/zero value, and >140-char message. Gas measurements
(`test/AgentTipGas.t.sol`): **deploy 440,965 gas; tip 117,504 gas**
(first tip, cold storage). At 0.05 gwei that is ~0.000022 BNB to deploy.

## Deploy

Creation bytecode: `deploy/creation-bytecode.txt`
(1,661 bytes, sha256 `8c5a5411c7e179fa30e5b057469072937d0916cb4af88f989a3b3143a780bcef`).
Compiler: solc 0.8.24, optimizer on, 200 runs.
From: nycto.ai `0x0d8C5bEe45EF5816856448A338aA12fE5281Fe9a`, value 0.
Source sha256: `a434b78848826499d93679317d49865459fd1940e4f2e299a263c1d1a9d0547c`.

Note: `baw` has no deploy command, so the contract was deployed through
the Safe SingletonFactory deterministic deployment proxy
`0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7` via a normal `baw
contract-call` — calldata is exactly `salt (32 zero bytes) ++ initCode`
with NO function selector or ABI encoding. (Calling the factory's
`deploy(bytes,bytes32)` ABI instead deploys an EMPTY contract — do not do
that.) The deployed address is the exact CREATE2 prediction for salt
0x00..00. The source is verified on BscScan with the exact compiler
settings above.

## Site

Static, no build step, GitHub-Pages-ready: `site/` (`index.html`,
`app.js`, `style.css`, `config.js`, `names.json`). Vanilla JS + ethers v6
via CDN. Connects via `window.ethereum`, BNB Smart Chain (56). The user
confirms every tip in their own wallet — nothing is auto-signed and no
session is stored. Shows recent tips (reads `Tip` events) and a
leaderboard (top recipients / top tippers, aggregated from events).
States plainly that tips are irreversible and promises no returns.

## Hackathon compliance notes

- No web QR-code login, no session storage, no bypassing user
  confirmation, no unauthorized transfers, no credential collection.
- No "Binance" / "BNB" in the project name or domain (project: AgentTip).
- No promised returns anywhere; a tip is a gift, not an investment.
- Name resolution happens **only inside the send flow** (resolve → verify
  Agent ID → user confirms a payment). The site has no name directory,
  no search-by-name feature, and no bulk lookup — it is a payment tool,
  not a "look up other people's wallets by name" tool, which the rules
  forbid. Keep it that way.
- One project per team; this is the team's only entry.

## Open items

- **Project submission channel not found.** The announcement and the
  Binance Square post name no form/URL for project submissions (only the
  community X-post survey link). Find it before 2026-12-09 08:00 UTC.
- The Innovation Award needs **>= 30 Agent ID addresses** interacting
  with the contract during the submission period — that is distribution
  work (X posts etc.), not code.
