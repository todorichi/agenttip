# AgentTip — STATUS: ready for deploy preview

Built 2026-11-18. NOT deployed, NOT submitted. Nothing was broadcast.

## (a) Name-resolution route

- **VERIFIED WORKING — `baw wallet resolve-domain` (Binance backend).**
  Reinstalled baw 1.12.0 (`npm install -g @binance/agentic-wallet@1.12.0`);
  `baw wallet status` = CONNECTED (nycto.ai session persisted).
  `baw wallet resolve-domain --name nycto.ai --binanceChainId 56 --json` →
  `0x0d8c5bee45ef5816856448a338aa12fe5281fe9a`, isFallback false.
  `luqia.ai` → `0xd452e84a2caf0798ab81e97d8fececed144d0aed`, isFallback false.
  CLI-only — not usable from the web page; it is the operator route for
  verifying/growing the site's name index.
- **SPACE ID Web3 Name SDK v0.4.2 — DOES NOT resolve `.ai`.** Tested 4 ways
  (default, constructor rpcUrl, per-call rpcUrl, both): the TLD lookup for
  "ai" returns registry address(0), so `resolver(node)` is called on the
  zero address and fails deterministically. Also its docs are stale (dist
  needs viem 2.x for `toFunctionSelector`, docs say viem ^1.20). Do not use.
- **SPACE ID REST API — unreachable/unfound.** `nameapi.space.id`,
  `api.space.id`, `space.id/api` all timed out from this sandbox; guessed
  `/v1/*` paths 404. No documented public endpoint found.
- **On-chain verified:** `balanceOf` on the Agent ID contract
  `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` = 1 for nycto.ai and 1 for
  Luqia.ai. `tokenOfOwnerByIndex` reverts (not enumerable); BscScan page
  fetch blocked (403, not retried); public-RPC log scan over a 200k-block
  range rejected (limit exceeded).
- **Site design:** bundled `site/names.json` seeded with the two
  baw-verified pairs only; raw 0x address input with live on-chain
  `balanceOf` verification for both sides as the always-working fallback.
  The site shows the resolved address + Agent ID status before sending.
  No address is fabricated anywhere.

## (b) Submission channel — OPEN ITEM, not found

Searched twice + read the full announcement and the Binance Square post
(`binance.com/en/square/post/389517345917641`, all 334 lines). Neither
names a form/URL for PROJECT submissions — only the community X-post
survey link (`app.binance.com`). Do not guess a URL. The parent must find
the project submission channel before 2026-12-09 08:00 UTC (2026-12-09
15:00 WIB).

## (c) Contract + tests

- Source: `src/AgentTip.sol` (single file, no imports, Solidity 0.8.24,
  optimizer on, 200 runs). Source sha256:
  `a434b78848826499d93679317d49865459fd1940e4f2e299a263c1d1a9d0547c`.
- `tip(address recipient, string calldata message)` payable. Both sides
  must hold an Agent ID; no self-tip; min 0.0001 BNB; message <= 140
  bytes; full amount forwarded immediately; emits `Tip`; tracks
  `totalReceived` / `totalSent` / `tipCount` + `getStats`. NO owner/admin
  functions (ownerless by design).
- Tests: `forge test --fork-url https://bsc-dataseed1.binance.org` —
  **10/10 pass** (success path incl. event/totals/zero contract balance,
  min-tip + max-message boundaries, reverts: non-holder tipper,
  non-holder recipient, self-tip, low/zero value, 141-char message).
  Gas tests: **deploy 440,965 gas; tip 117,504 gas** (first tip, cold).
  One build lint warning only (strict equality on `balanceOf == 0` —
  standard check, harmless).

## (d) Site — ready

`site/` — `index.html`, `app.js`, `style.css`, `config.js`, `names.json`.
Static, no build step, GitHub-Pages-ready. Vanilla JS + ethers v6 via CDN.
Connect via `window.ethereum`, BSC 56; name → index lookup or raw 0x
address; on-chain Agent ID check on both sides before sending; user
confirms in own wallet; recent tips + leaderboard from `Tip` events;
irreversibility note; no returns promised; no Binance branding.
JS syntax checked (`node --check`), HTML tags balanced, `names.json`
valid. `config.js` has `CONTRACT_ADDRESS: ""` / `DEPLOY_BLOCK: 0` —
tipping/feed stay in "not deployed yet" state until those are set.
Git repo initialized with 3 commits (contract+tests, site, README/
LICENSE/STATUS). GitHub repo NOT created (parent does that via browser).

## (e) Deploy data for the parent's preview

- From: nycto.ai `0x0d8C5bEe45EF5816856448A338aA12fE5281Fe9a`
- Value: 0. Chain: BSC (56).
- Compiler: solc 0.8.24, optimizer enabled, 200 runs.
- Creation bytecode: `deploy/creation-bytecode.txt` (1,661 bytes, 3,322
  hex chars), sha256
  `8c5a5411c7e179fa30e5b057469072937d0916cb4af88f989a3b3143a780bcef`.
  Runtime bytecode 1,632 bytes.
- Measured deploy gas: **440,965**. At current 0.05 gwei ≈ **0.000022 BNB**;
  at 1 gwei ≈ 0.000441 BNB (still below nycto's 0.000625 BNB balance).
- **Caveat — deploy route unverified:** `baw contract-call preview`
  documents `--to` as required for EVM, so a creation may not go through
  the standard preview flow. Try first with
  `--to 0x0000000000000000000000000000000000000000`, `--value 0`,
  `--inputData 0x<creation bytecode>` and only proceed if the preview
  simulates a creation cleanly. The baw skill documents no deploy flow.
  Do NOT deploy any other bytecode. After deploy: verify source on
  BscScan with the exact compiler settings above, then set
  `CONTRACT_ADDRESS` + `DEPLOY_BLOCK` in `site/config.js`.

## (f) Deploy route — SOLVED 2026-11-18 ~19:40 WIB (parent verification)

- `baw` has NO deploy command (verified: `baw --help`, `baw contract-call preview --help` — `--to` required). A preview to address(0) with the creation bytecode only simulates a no-op call, NOT a creation — that requestId was NOT executed.
- Working route: **Safe SingletonFactory / deterministic deployment proxy
  0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7** (69-byte runtime, code verified
  live on BSC; disassembled with `cast disassemble` — it is a RAW proxy:
  calldata must be `salt (32 bytes) ++ initCode`, NO selector, NO ABI
  encoding. Calling its `deploy(bytes,bytes32)` ABI on it deploys an EMPTY
  contract — proven by a failing fork test first, then diagnosed from the
  runtime). SPACE ID Web3 Name SDK does NOT resolve `.ai` (unrelated).
- Fork test `test/FactoryRaw.t.sol` PASSED on BSC mainnet fork: raw call
  (salt 0 ++ creation bytecode) deploys AgentTip at
  **0x2ecA02A56cF51928ED7d790a0F4d8cC745C2e893** (exact CREATE2 prediction),
  gas 413,415, and a tip nycto→luqia 0.0001 BNB works on the deployed
  contract. Raw calldata saved at /tmp/agenttip-raw-calldata.txt (1,692 bytes).
- baw preview for the factory call: requestId b6f1a522f922485dace697013ab697f7
  (2026-11-18 ~19:40 WIB), simulation clean (no error, no balance/allowance/
  authority changes, no risks), value 0, gas ~413,415 ≈ 0.000021 BNB at
  0.05 gwei. Preview expires ~10 min after creation; re-run the IDENTICAL
  preview if it lapses after Rivaldo's Ya. Rivaldo's "Ya" at 19:20 WIB was
  BEFORE this preview existed and does NOT cover it — a fresh Ya on this
  preview is required before executing.

## Other open items for the parent / Rivaldo

- Innovation Award needs **>= 30 Agent ID addresses** interacting during
  2026-11-18 → 2026-12-09 — distribution work, not code.
- Compliance judgment call (documented in README): name resolution runs
  only inside the send flow (payment tool, not a lookup/directory tool).
  Keep it that way; do not add a name-search feature.
- `baw` and Foundry live outside the repo; `lib/forge-std` is gitignored
  (re-install with `forge install foundry-rs/forge-std --no-git`).

## (g) MAINNET DEPLOY — DONE 2026-11-18 ~20:04 WIB
- Route: Safe SingletonFactory 0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7, raw calldata (32 zero bytes ++ creation bytecode), via baw contract-call. Rivaldo chose this route ("Pakai factory via baw saja", 20:03 WIB) after the Remix+extension clarification.
- baw had vanished after a VM replacement; reinstalled (`npm install -g @binance/agentic-wallet@1.12.0`); session persisted, CONNECTED as nycto.ai.
- Fresh preview re-run (requestId 67f901114d6442ecb4aa380fac49a9f5): clean, no balance/allowance/authority changes, no risks. Executed immediately on his approval.
- Tx: 0x4168dcf5ddd46c884509ebac3390e79954158a6e52520dc5e5f372ab7261236e, block 134316160, status success. OrderId 26111800002063549826.
- Gas: used 406,738 (fork estimate 413,415), gasPrice 0.110496354 gwei (baw set it above the 0.05 spot), cost 0.000044943066033252 BNB. BNB after: 0.00058055333871946.
- Contract: 0x2ecA02A56cF51928ED7d790a0F4d8cC745C2e893 (exact CREATE2 prediction), 1,631 bytes runtime. Verified live: getStats(nycto.ai) = (0, 0, 0) — contract responds as AgentTip. (Note: totalReceived/totalSent/tipCount are mappings, so they take an address arg; a bare totalReceived() call reverts — that is expected, not a defect.)
- site/config.js updated: CONTRACT_ADDRESS + DEPLOY_BLOCK 134316160.
- NEXT: BscScan source verify (solc 0.8.24, optimizer 200 runs) → GitHub repo todorichi/agenttip + Pages → find submission channel → submit before 2026-12-09 15:00 WIB.
