# 2026-04-30 session 1: HTTPS support

## Goal

Implement HTTPS support in ionpower-node. From the brief in
`docs/plans/https.md`:

- Link against `/opt/openssl-1.1.1t/` (installed via `tiger.sh` or
  manual leopard.sh tarballs).
- Wire `tls.connect` / `tls.createServer` / `TLSSocket`.
- Wire `https.request` / `https.get` / `https.createServer`.
- CA bundle from `/opt/ca-certificates-20230110/cacert.pem`.
- A demo + smokes.
- Cut v0.83 if it lands clean.

User said work unsupervised, document everything, pull in JS libs as
needed.

## Plan of attack

1. **Recon** — map the codebase. How are existing native modules
   wired (node_compat layer)? Where do JS shims live? How is the
   Makefile structured? What's in node-forge that we already have?
2. **OpenSSL pre-flight** — confirm `/opt/openssl-1.1.1t/` on the
   build host. Smoke-compile a tiny C TLS client.
3. **Native binding** — minimal C++ wrapper around OpenSSL's TLS
   primitives: `SSL_CTX`, `SSL`, `BIO_pair`, handshake, read/write.
   Build it, link it.
4. **`tls.js`** — wrap the binding in Node's `tls.*` shape. Plumb
   onto our existing `net.Socket`.
5. **`https.js`** — thin wrapper over `http` + `tls`.
6. **Smokes + demo** — `tls_smoke.js`, `https_get_smoke.js`,
   `https_server_smoke.js`. New demo that does HTTPS end-to-end.
7. **Triad build + release** — v0.83 if all green.

## Key decision: native OpenSSL vs. forge.tls

User specifically pointed at `/opt/openssl-1.1.1t/`, so going native.
Forge is pure JS but unbearably slow on G3 for handshake (seconds).
Native is the right call even though it's a bigger lift.

## Documentation as I go

Will write running log here as I make decisions, hit dead ends, or
roll things back.

## Running log

### Recon (Explore agent)

Architecture map back from the agent: native modules expose
`__name_native__` to JS, all JS shims live in a single 8900-line
`kBootstrapJS` C string in `globals.cpp`, the JS-level `net.Socket`
wraps `__net_native__` + `__child_process_native__.{readFd,writeFd}`,
and the http parser is pure JS. No async/await, must respect
`-fno-exceptions -fno-rtti`. node-forge has a TLS impl but it's
pure-JS and would be unbearably slow on a G3. Native OpenSSL is the
right call.

### OpenSSL pre-flight

All three triad hosts (`ibookg37`, `emac`, `pmacg5`) have OpenSSL
1.1.1t installed at `/opt/openssl-1.1.1t/` with both `.a` and
`.dylib` libs, headers, and `/opt/ca-certificates-20230110/share/cacert.pem`.

Smoke-compiled a 50-line C TLS client on ibookg37 — TLS 1.3 with
AES-256-GCM-SHA384 to example.com:443, 798 bytes back. Linker
warning about `-mlong-branch` in Apple's stock crt1.o is benign.
Dep is sound.

### Native binding (`src/node_compat/tls.cpp`, ~530 LOC)

Design: opaque integer ctx/conn IDs (stored in `std::map`), memory
BIO pair so the JS side fully drives I/O.  Key API:

- `createClientCtx(opts)` / `createServerCtx(opts)` / `freeCtx`
- `createConn(ctxId, isServer)` / `freeConn` — allocates `SSL` + `BIO_pair`
- `setServername` (SNI)
- `handshake` — drives `SSL_do_handshake`, returns
  `'connected' | 'want_read' | 'want_write' | 'error'`
- `bioWrite` (push encrypted bytes from network),
  `bioRead` (pull encrypted bytes to send to network)
- `sslWrite` (push plaintext app bytes — encrypted into BIO),
  `sslRead` (pull decrypted plaintext)
- `shutdownConn`, `getPeerCert`, `getCipher`, `getProtocol`,
  `versionText`, `generateSelfSigned`

Compiled cleanly on G3 first try (the Explore agent's pattern guide
saved a lot of time).

### JS layer (kBootstrapJS additions, ~280 lines)

`_TLSSocket` extends EventEmitter, owns an inner raw `_Socket`. On
raw 'data' it `bioWrite`s, then either drives the handshake or
pumps `sslRead`+`sslWrite`. `connect()` mirrors `_Socket.connect`
shape; emits `'secureConnect'` after handshake. `tls.connect` and
`tls.createServer` follow the Node API.

For HTTPS I refactored `_ClientRequest` to accept an optional
`opts.createConnection(opts, onReady)` factory — minimal change,
default branch unchanged. `_httpsRequest` plugs in a TLS-backed
factory; `_httpsCreateServer` builds on `_tlsCreateServer` + the
existing http parser.

### Bugs hit + fixes

1. **`'end'` event firing twice.** SSL's `SSL_ERROR_ZERO_RETURN` and
   the underlying raw socket's `'end'` both triggered our `'end'`
   emit. Added `_emitEndOnce` guard.

2. **`tls conn not found: -1` errors after destroy.** In `_pumpRead`,
   after we emitted `'data'` the listener could synchronously call
   `sock.destroy()` (e.g. `_ClientRequest`'s `feedBody` does this on
   Content-Length completion). The next loop iteration would call
   `sslRead(-1)` and throw. Moved the destroyed check into the loop
   condition itself.

3. **The big one — `http.request` to remote servers silently
   returning no response.** Initially I thought this was a TLS bug,
   but reproduced with plain `net.createConnection + write + end`.
   Bisected: with a 50ms `setTimeout` between `write` and `end`,
   data arrives; without, the server FINs without responding.

   Root cause: on Tiger PPC's BSD TCP stack, `shutdown(SHUT_WR)`
   called in the same tick as `write()` to a non-blocking remote
   socket can drop the in-flight bytes — the peer receives FIN
   with no data and treats the request as malformed. (Pre-existing
   bug, not from my refactor; `http_async_smoke` only worked
   because it talks to a local server, where the loopback socket
   doesn't have this race.)

   Fixed in two places:
   - `_Socket._onConnected`: `setNoDelay(true)` by default. Disables
     Nagle so write isn't coalesced. (Mostly cosmetic — doesn't fix
     the bug on its own but reduces the timing window.)
   - `_Socket.end`: defer the actual `shutdown()` syscall by one
     timer tick (`setTimeout(0)`). Routes through the timer wheel,
     which enters `select()` once, giving the kernel a chance to
     transmit before the half-close request arrives. `setImmediate`
     is **not** sufficient — it doesn't wait for select.

   With both fixes, `http.request` to example.com works reliably,
   and so does `https.request` (which goes through the same path).

### Smokes

Three new smokes wired into `make test-libs`:

- `test/tls_smoke.js` — `tls.connect` to example.com:443; checks
  protocol, cipher, peer cert, GET round-trip (~800ms on G3).
- `test/https_get_smoke.js` — `https.get` to example.com; checks
  status, headers, body, "Example Domain" content (~800ms).
- `test/https_server_smoke.js` — `tls.generateSelfSigned` →
  `https.createServer` → `https.get` to self → JSON round-trip
  (~6.5s on G3, RSA keygen dominates).

### Demo (`demos/https/`)

- `server.js` — Self-signed HTTPS server with three routes (`/`,
  `/info`, `/echo`). Browser-friendly status page with TLS
  metadata; JSON inspection endpoint.
- `client.js` — CLI HTTPS client. Auto-`-k` for localhost, `-k`
  flag for explicit insecure mode. Prints headers, TLS info,
  body. Default URL targets the local server.
- `README.md` — usage walkthrough.

### Still to do

- Triad-build G4 + G5; cut v0.83 release.
- Update README front-page to mention HTTPS.
