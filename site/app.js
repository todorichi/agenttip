// AgentTip site logic — vanilla JS + ethers v6 (CDN).
// The user always confirms the tip transaction in their own wallet.
// Nothing here signs, stores sessions, or moves funds automatically.
(function () {
  "use strict";
  var CFG = window.AGENTTIP_CONFIG;
  var AGENT_ID_ABI = ["function balanceOf(address account) view returns (uint256)"];
  var TIP_ABI = [
    "function tip(address recipient, string calldata message) payable",
    "function getStats(address account) view returns (uint256 received, uint256 sent, uint256 tips)",
    "event Tip(address indexed tipper, address indexed recipient, uint256 amount, string message, uint256 timestamp)"
  ];

  var $ = function (id) { return document.getElementById(id); };
  var resolvedRecipient = null; // { address, source: "name" | "address" }
  var signerAddress = null;
  var readProvider = null;
  var nameIndex = null;

  function setStatus(el, text, kind) {
    el.textContent = text;
    el.className = "status" + (kind ? " " + kind : "");
  }
  function shortAddr(a) { return a.slice(0, 6) + "…" + a.slice(-4); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // ---- read provider with RPC fallback ----
  function getProvider() {
    if (readProvider) return Promise.resolve(readProvider);
    var urls = CFG.RPC_URLS.slice();
    function tryNext() {
      if (!urls.length) return Promise.reject(new Error("all public RPCs failed"));
      var url = urls.shift();
      var p = new ethers.JsonRpcProvider(url, CFG.CHAIN_ID, { staticNetwork: true });
      return p.getBlockNumber().then(function () { readProvider = p; return p; }, tryNext);
    }
    return tryNext();
  }
  function agentIdContract(provider) {
    return new ethers.Contract(CFG.AGENT_ID_CONTRACT, AGENT_ID_ABI, provider);
  }
  function tipContract(providerOrSigner) {
    if (!CFG.CONTRACT_ADDRESS) return null;
    return new ethers.Contract(CFG.CONTRACT_ADDRESS, TIP_ABI, providerOrSigner);
  }
  function holdsAgentId(provider, addr) {
    return agentIdContract(provider).balanceOf(addr).then(function (b) { return b > 0n; });
  }

  // ---- name index ----
  function loadIndex() {
    if (nameIndex) return Promise.resolve(nameIndex);
    return fetch("names.json").then(function (r) { return r.json(); }).then(function (j) {
      nameIndex = j.names || {};
      return nameIndex;
    });
  }
  function normalizeName(raw) {
    var n = (raw || "").trim().toLowerCase();
    if (!n) return "";
    if (n.indexOf(".ai") === -1) n = n + ".ai";
    return n;
  }

  // ---- connect ----
  $("connect-btn").addEventListener("click", function () {
    if (!window.ethereum) { setStatus($("wallet-status"), "No wallet found in this browser. Install a wallet that supports BNB Smart Chain first.", "err"); return; }
    window.ethereum.request({ method: "eth_requestAccounts" }).then(function (accounts) {
      return window.ethereum.request({ method: "eth_chainId" }).then(function (chainId) {
        if (parseInt(chainId, 16) !== CFG.CHAIN_ID) {
          return window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] }).catch(function () {
            throw new Error("Please switch your wallet to BNB Smart Chain (chain 56) and try again.");
          });
        }
        return accounts;
      });
    }).then(function (accounts) {
      signerAddress = accounts[0];
      setStatus($("wallet-status"), "Connected: " + signerAddress, "ok");
      return getProvider().then(function (p) {
        return holdsAgentId(p, signerAddress).then(function (holds) {
          if (!holds) {
            setStatus($("wallet-status"), "Connected: " + signerAddress + " — this wallet does NOT hold an Agent ID, so it cannot send tips.", "err");
            return;
          }
          var c = tipContract(p);
          if (!c) { $("my-stats").textContent = "Agent ID confirmed. The tip contract is not deployed yet."; return; }
          return c.getStats(signerAddress).then(function (s) {
            $("my-stats").textContent = "Your stats — received: " + ethers.formatEther(s[0]) + " BNB · sent: " + ethers.formatEther(s[1]) + " BNB · tips received: " + s[2];
          });
        });
      });
    }).catch(function (e) { setStatus($("wallet-status"), "Connection failed: " + e.message, "err"); });
    refreshSendState();
  });

  // ---- resolve recipient ----
  $("resolve-btn").addEventListener("click", function () {
    var raw = $("recipient-input").value;
    resolvedRecipient = null;
    refreshSendState();
    if (!raw.trim()) { setStatus($("resolve-status"), "Type a name (e.g. nycto.ai) or a 0x address.", "err"); return; }
    if (ethers.isAddress(raw.trim())) {
      resolvedRecipient = { address: ethers.getAddress(raw.trim()), source: "address" };
      verifyRecipient();
      return;
    }
    var name = normalizeName(raw);
    loadIndex().then(function (idx) {
      var entry = idx[name];
      if (!entry) {
        setStatus($("resolve-status"), "“" + name + "” is not in the local name index yet. Paste the recipient's 0x address instead — the site will verify their Agent ID on-chain before you send.", "err");
        return;
      }
      resolvedRecipient = { address: entry.address, source: "name", name: name };
      verifyRecipient();
    }).catch(function () { setStatus($("resolve-status"), "Could not load the name index. Paste the recipient's 0x address instead.", "err"); });
  });

  function verifyRecipient() {
    setStatus($("resolve-status"), "Checking " + resolvedRecipient.address + " on-chain…");
    getProvider().then(function (p) {
      return holdsAgentId(p, resolvedRecipient.address).then(function (holds) {
        if (!holds) {
          setStatus($("resolve-status"), resolvedRecipient.address + " does NOT hold an Agent ID — tips to this address are not possible.", "err");
          resolvedRecipient = null;
        } else {
          var via = resolvedRecipient.source === "name" ? "“" + resolvedRecipient.name + "” → " : "address ";
          setStatus($("resolve-status"), "Resolved " + via + resolvedRecipient.address + " — Agent ID confirmed.", "ok");
        }
        refreshSendState();
      });
    }).catch(function (e) { setStatus($("resolve-status"), "On-chain check failed: " + e.message, "err"); });
  }

  // ---- send ----
  function refreshSendState() {
    var ok = !!CFG.CONTRACT_ADDRESS && !!signerAddress && !!resolvedRecipient;
    if (ok && resolvedRecipient && signerAddress && resolvedRecipient.address.toLowerCase() === signerAddress.toLowerCase()) ok = false;
    $("send-btn").disabled = !ok;
    if (!CFG.CONTRACT_ADDRESS) setStatus($("send-status"), "The tip contract is not deployed yet — tipping opens after deployment.");
  }
  ["amount-input", "message-input"].forEach(function (id) {
    $(id).addEventListener("input", refreshSendState);
  });

  $("send-btn").addEventListener("click", function () {
    if (!CFG.CONTRACT_ADDRESS) return;
    var amountStr = $("amount-input").value;
    var message = $("message-input").value || "";
    var amount;
    try { amount = ethers.parseEther(amountStr); } catch (e) { setStatus($("send-status"), "Invalid amount.", "err"); return; }
    if (amount < ethers.parseEther(CFG.MIN_TIP_BNB)) { setStatus($("send-status"), "Minimum tip is " + CFG.MIN_TIP_BNB + " BNB.", "err"); return; }
    if (new TextEncoder().encode(message).length > CFG.MAX_MESSAGE_LENGTH) { setStatus($("send-status"), "Message is too long (max 140 characters).", "err"); return; }
    if (!window.ethereum) { setStatus($("send-status"), "No wallet found.", "err"); return; }
    setStatus($("send-status"), "Confirm the transaction in your wallet…");
    var browserProvider = new ethers.BrowserProvider(window.ethereum);
    browserProvider.getSigner().then(function (signer) {
      var c = tipContract(signer);
      return c.tip(resolvedRecipient.address, message, { value: amount }).then(function (tx) {
        setStatus($("send-status"), "Sent! Transaction: " + tx.hash + " — waiting for confirmation…");
        return tx.wait(1).then(function () {
          setStatus($("send-status"), "Tip confirmed: " + tx.hash, "ok");
          loadFeed();
        });
      });
    }).catch(function (e) {
      var msg = (e && e.reason) || (e && e.message) || String(e);
      setStatus($("send-status"), "Transaction failed or rejected: " + msg, "err");
    });
  });

  // ---- feed + leaderboard ----
  function loadFeed() {
    var feedEl = $("feed"), boardEl = $("top-recipients"), tippersEl = $("top-tippers");
    if (!CFG.CONTRACT_ADDRESS || !CFG.DEPLOY_BLOCK) {
      setStatus($("feed-status"), "The tip contract is not deployed yet — no tips to show.");
      setStatus($("board-status"), "The tip contract is not deployed yet.");
      return;
    }
    setStatus($("contract-link"), "");
    $("contract-link").innerHTML = '<a href="https://bscscan.com/address/' + CFG.CONTRACT_ADDRESS + '" target="_blank" rel="noopener">' + CFG.CONTRACT_ADDRESS + '</a>';
    getProvider().then(function (p) {
      var c = tipContract(p);
      return c.queryFilter(c.filters.Tip, CFG.DEPLOY_BLOCK, "latest").then(function (events) {
        events.sort(function (a, b) { return b.blockNumber - a.blockNumber || b.index - a.index; });
        feedEl.innerHTML = "";
        if (!events.length) { setStatus($("feed-status"), "No tips yet — be the first."); }
        else {
          setStatus($("feed-status"), events.length + " tip(s) so far.");
          events.slice(0, 10).forEach(function (ev) {
            var li = document.createElement("li");
            li.innerHTML = "<b>" + esc(shortAddr(ev.args.tipper)) + "</b> tipped <b>" + esc(shortAddr(ev.args.recipient)) + "</b> " +
              esc(ethers.formatEther(ev.args.amount)) + " BNB" +
              (ev.args.message ? " — “" + esc(ev.args.message) + "”" : "") +
              ' <a href="https://bscscan.com/tx/' + ev.transactionHash + '" target="_blank" rel="noopener">tx</a>';
            feedEl.appendChild(li);
          });
        }
        var recv = {}, sent = {};
        events.forEach(function (ev) {
          var a = ev.args.amount;
          recv[ev.args.recipient] = (recv[ev.args.recipient] || 0n) + a;
          sent[ev.args.tipper] = (sent[ev.args.tipper] || 0n) + a;
        });
        function render(map, el) {
          var rows = Object.keys(map).map(function (k) { return [k, map[k]]; }).sort(function (x, y) { return y[1] > x[1] ? 1 : -1; }).slice(0, 5);
          el.innerHTML = "";
          rows.forEach(function (r) {
            var li = document.createElement("li");
            li.textContent = shortAddr(r[0]) + " — " + ethers.formatEther(r[1]) + " BNB";
            el.appendChild(li);
          });
          if (!rows.length) el.innerHTML = "<li>—</li>";
        }
        render(recv, boardEl);
        render(sent, tippersEl);
        setStatus($("board-status"), "");
      });
    }).catch(function (e) { setStatus($("feed-status"), "Could not load tips: " + e.message, "err"); });
  }

  refreshSendState();
  loadFeed();
})();
