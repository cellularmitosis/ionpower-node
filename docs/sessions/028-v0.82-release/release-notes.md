## What's new

### Demo: anonymous chat board on real Express 4

[`demos/express-chat/`](https://github.com/cellularmitosis/ionpower-node/tree/v0.82/demos/express-chat) — a 4chan / 8chan-style anonymous board, built on **real, vendored Express 4.22.1** (not a hand-rolled http server), running end-to-end on a 1999 iBook G3.

Features:
- Anonymous posting; no login, no accounts
- Optional **tripcodes** (`name#secret` → SHA-256 → 10-byte base64 hash) for persistent anonymous identity without signup. Same secret = same trip-hash, no state on server.
- Sequential post numbering, `>>N` auto-linking, in-memory ring buffer (last 200 posts)
- Per-IP rate limit (1 post / 2 s)
- Express 4 with `body-parser` / `accepts` / `cookie` / `etag` / `finalhandler` / `path-to-regexp` / etc. — about 25 vendored deps under [`test/vendor/express/node_modules/`](https://github.com/cellularmitosis/ionpower-node/tree/v0.82/test/vendor/express/node_modules)
- Real-time push via WebSocket on port+1 (same `ws` package as `demos/chat/`)
- Handlebars-rendered home page; static CSS + JS

Validated end-to-end on `ibookg37` (iBook G3 900 MHz):

```
$ ./node demos/express-chat/client.js http://127.0.0.1:8090
=== POST /api/post ===
ok  POST /api/post  shape

=== GET /api/posts ===
ok  GET /api/posts  post appears in feed

=== POST with tripcode "secret" ===
ok  POST with tripcode  trip field present

=== POST same tripcode -> same trip-hash ===
ok  POST same tripcode -> same trip-hash (K7gNU3sdo+)

=== POST too fast (rate limit) ===
ok  Rate limit -> HTTP 429

=== GET /api/posts?since=2 ===
ok  GET ?since=2  filtered correctly (1 posts)

=== POST empty text ===
ok  POST empty text -> HTTP 400

express-chat smoke: ok (7 checks passed)
```

Vendoring took one judgment-call shim worth flagging: `depd` (Express's deprecation-warning helper) uses V8's structured stack-trace API (`Error.prepareStackTrace` + `callSite.getFileName()`), which SpiderMonkey 45 doesn't implement. Replaced [`test/vendor/express/node_modules/depd/index.js`](https://github.com/cellularmitosis/ionpower-node/blob/v0.82/test/vendor/express/node_modules/depd/index.js) with a 20-line no-op deprecate factory. Pure userland fix; no runtime change.

### Initial conformance sweep

[`docs/conformance/README.md`](https://github.com/cellularmitosis/ionpower-node/blob/v0.82/docs/conformance/README.md) — first-pass measurement of two upstream test corpora against ionpower-node v0.81 on `ibookg37`:

| Corpus | Pass | Total | Pct |
|---|---|---|---|
| **WPT** (URL/Streams/Encoding/WebCryptoAPI) | 560 | 9,003 | 6.2% |
| **Node parallel-tests** (9 of 11 topics) | 49 | 557 | 8.8% |

Pessimistic baselines — most failures cluster around clearly fixable categories (the biggest single bucket is `crypto.subtle` accepting bad-usage / bad-key-length input that should throw; ~2,750 WebCryptoAPI assertions). The doc breaks down failure clusters per category and ranks the runtime gaps by impact. New scaffolding for re-running:

- [`scripts/conformance/wpt-harness.js`](https://github.com/cellularmitosis/ionpower-node/blob/v0.82/scripts/conformance/wpt-harness.js)
- [`scripts/conformance/run-wpt.js`](https://github.com/cellularmitosis/ionpower-node/blob/v0.82/scripts/conformance/run-wpt.js)
- [`scripts/conformance/node-common-shim.js`](https://github.com/cellularmitosis/ionpower-node/blob/v0.82/scripts/conformance/node-common-shim.js)
- [`scripts/conformance/run-node-tests.js`](https://github.com/cellularmitosis/ionpower-node/blob/v0.82/scripts/conformance/run-node-tests.js)

### TLS roadmap doc

[`docs/plan-tls.md`](https://github.com/cellularmitosis/ionpower-node/blob/v0.82/docs/plan-tls.md) — three-phase plan for closing the last 🟡 in the README. Phase A: forge.tls 1.0/1.1 wired to net.Socket. Phase B: TLS 1.2 with ECDHE + AES-GCM (building on v0.75 ECDSA, v0.76 ECDH, v0.79 subtle). Phase C: TLS 1.3 by adapting a pure-JS stack onto our `net.Socket` + `crypto.subtle` (which v0.79+ made WebCrypto-shape-compatible).

## Runtime changes

**None.** The runtime binary is identical to v0.81 except the embedded `process.version` string. This release is bundled demos + docs + conformance scaffolding; no behavioural change. Existing v0.81 tarballs continue to work — re-installing the runtime is optional.

## Setup (unchanged from v0.73)

```bash
# One-time mozjs install (skip if you already did this)
curl -L -O https://github.com/cellularmitosis/ionpower-node/releases/download/v0.73/mozjs-45-ionpower-g3.tar.gz
sudo tar xzpf mozjs-45-ionpower-g3.tar.gz -C /opt/

# v0.82 runtime
curl -L -O https://github.com/cellularmitosis/ionpower-node/releases/latest/download/ionpower-node-0.82-g3-ppc.tar.gz
sudo tar xzpf ionpower-node-0.82-g3-ppc.tar.gz -C /opt/
/opt/ionpower-node-0.82/bin/node --version
```

(Ditto with `g4` / `g5`.)

## Triad

ibookg37 (G3 900 MHz), emac (G4 7450), pmacg5 (G5 970) — all green. Unchanged 1990+ assertions across 432 smoke files.

## Tarballs

| Arch | Tarball |
|---|---|
| G3 | `ionpower-node-0.82-g3-ppc.tar.gz` |
| G4 | `ionpower-node-0.82-g4-ppc.tar.gz` |
| G5 | `ionpower-node-0.82-g5-ppc.tar.gz` |
