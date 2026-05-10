# Session plan: Node 10 parity, pass 3

## Read first

In order:

1. [`../2026-05-10-session-2-node-10-parity-pass-2/notes.md`](../2026-05-10-session-2-node-10-parity-pass-2/notes.md)
   — what pass 2 closed (7 waves of install-pipeline gaps), the npm
   install state at v0.88 (runs through commit phase, plateaus at
   network and minizlib internal-handle), and the pass-3 list at
   the bottom.
2. [`../2026-05-10-session-2-node-10-parity-pass-2/build-logs/npm-install-mri-tarball-v0.88.txt`](../2026-05-10-session-2-node-10-parity-pass-2/build-logs/npm-install-mri-tarball-v0.88.txt)
   — the run that surfaced minizlib's `_handle._processChunk` call.
3. [`../2026-05-10-session-2-node-10-parity-pass-2/release-notes/v0.88.md`](../2026-05-10-session-2-node-10-parity-pass-2/release-notes/v0.88.md)
   — what shipped, what's still broken, the contract for pass 3.

## Context in one paragraph

ionpower-node v0.88 shipped. npm 6.14.18 now runs deep into the
install pipeline: bootstrap → resolve-from / npm-lifecycle →
`Installer.run` → `loadCurrentTree` → `readLocalPackageData` →
`getAllMetadata` → `pacote.manifest`. Two distinct walls remain.
First, `pacote.manifest` makes an HTTPS call to
`registry.npmjs.org` and our TLS layer either hangs (the
real registry) or returns "decryption failed or bad record mac"
on response bodies (other Cloudflare endpoints). Second, even when
fed a local tarball (skipping the network), pacote pipes through
`minizlib`, which reaches into our zlib stream's `._handle._processChunk`
— a Node-internal C++-binding sync API we don't emulate. Either
fix unblocks roughly half of `npm install`. Both unblock end-to-end.

## Scope

### A. TLS stability for Cloudflare-fronted endpoints

Most strategic fix for any future HTTPS work — the npm registry,
GitHub raw, jsdelivr, unpkg, most modern public APIs.

**Repro one-liner** (against any Cloudflare-fronted endpoint):

```js
require('https').get('https://www.cloudflare.com/', function (res) {
  console.log('status:', res.statusCode);
  res.on('data', function (c) { /* SSL_read decryption error happens here */ });
  res.on('error', function (e) { console.log('err:', e.message); });
});
```

`https.get('https://example.com/')` works fine (status 200,
~500 ms). `https.get('https://registry.npmjs.org/')` hangs
forever (no error event, no status). `cloudflare.com` connects
(status 200) but body chunks fail with `SSL_read: error:1408F119:SSL
routines:ssl3_get_record:decryption failed or bad record mac`.

Hypotheses to investigate, in priority order:

1. **TLS record reassembly bug** — we may not handle multi-segment
   TLS records correctly (record header says N bytes but data
   arrives in two reads). Most likely cause given the "bad MAC"
   shape and the fact that small responses (example.com) work but
   larger ones (cloudflare) don't.
2. **ALPN missing** — Cloudflare may negotiate HTTP/2 when ALPN
   isn't sent and disconnect mid-stream. Check our `SSL_CTX_set_alpn_protos`
   call (or absence). Real Node sends `h2,http/1.1` by default;
   fallback to `http/1.1` only.
3. **SNI not set** — `SSL_set_tlsext_host_name(ssl, hostname)`
   needs to be called before handshake. Cloudflare requires SNI
   to route to the right cert. We may set it for some paths but
   not the connect-then-https path.
4. **Cipher suite negotiation** — registry.npmjs.org may require
   modern AEAD (AES-GCM-256, ChaCha20-Poly1305). Check our
   `SSL_CTX_set_cipher_list` config.

Look in [`src/node_compat/tls.cpp`](../../../src/node_compat/tls.cpp).
Probably the work is in the SSL_read loop or in TLS handshake setup.

**Smoke**: add `test/tls_cloudflare_smoke.js` that GETs
`https://www.cloudflare.com/`, asserts status 200, AND reads the
full body without error. The full-body assertion is what catches
the regression.

### B. Emulate `zlib._handle._processChunk` on our zlib streams

Less work than A but unlocks `npm install <local-tarball>` and
any other consumer of minizlib (which is widely vendored in npm
ecosystem tooling).

**What minizlib needs** (from `node_modules/minizlib/index.js:128`):

```js
const nativeHandle = this[_handle]._handle  // <-- NEEDS THIS
const originalNativeClose = nativeHandle.close
nativeHandle.close = () => {}
// ...
result = this[_handle]._processChunk(chunk, flushFlag)
// ...
this[_handle]._handle = nativeHandle  // restored
nativeHandle.close = originalNativeClose
```

So our `Gunzip` / `Gzip` / `Deflate` / `Inflate` / `DeflateRaw` /
`InflateRaw` streams need:

- A `._handle` property that's an object.
- `._handle.close = function () {}` (must be reassignable).
- `._handle._processChunk(chunk, flushFlag) → Buffer` — sync.
  For our case it can call the matching `zlib.{gunzip,gzip,…}Sync`
  on the chunk and return the result (we're not really streaming —
  the bulk-decode mode is fine for tarball-sized inputs).
- The stream itself needs `.close = function () {}` (same dance).

**Plan**:

1. In [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)'s
   `_mkInflateTransform` / `_mkDeflateTransform`, add `s._handle`
   to the returned stream:

   ```js
   s._handle = {
     _processChunk: function (chunk, flushFlag) {
       return syncFn(chunk);  // syncFn is the bound _zlib_*Sync
     },
     close: function () {}
   };
   s.close = function () {};
   ```

2. Smoke `test/zlib_handle_smoke.js`: instantiate `new zlib.Gunzip()`,
   verify `.close === function`, `._handle._processChunk(gzippedBuf, 4)`
   returns the decompressed Buffer.

3. Re-attempt `npm install /Users/macuser/tmp/mri-1.2.0.tgz`
   end-to-end. If `node_modules/mri/` lands → first verified
   `npm install` from a tarball; capture timing in session notes.

### C. Re-run `npm install mri` (registry) once A + B are in

If A is actually a TLS record-reassembly fix and not deeper, this
just works. If A only partially closes (e.g. records OK but ALPN
still flaky), capture as pass 4.

### D. Try a single-dep package next

`is-number` (one dep) or `cuid` (small dep tree). Different code
paths around transitive deps.

## Out of scope for this session

- Fixing all the other `JS_ReportError`-instead-of-`ThrowFsError`
  sites in `fs.cpp` (writeFileSync, appendFileSync, copyFileSync,
  chmodSync). Same shape as wave-3 `readdirSync` fix. Not in the
  install pipeline hot path; defer to a maintenance pass when one
  hits a real consumer.
- Real `fs.promises.read` / `fs.promises.write` (need `{bytesRead,
  buffer}` return shape). Defer until something hits it.
- ES modules as first-class. Still punted (needs SM 60+).

## Risk / blast radius

A: TLS code is sensitive — touching SSL_read or handshake setup
can break working endpoints. Strategy: keep all existing TLS smokes
green (axios, https-server, node-fetch, wss). Add the new
Cloudflare smoke. Bisect by smoke regression if anything breaks.

B: Additive — new `._handle` property on existing streams. Lowest
possible blast radius (only affects code that reaches for `._handle`,
which is minizlib-or-similar).

## Working order

1. Read the three "Read first" docs.
2. **B first** (low-risk, fast win) — add `_handle._processChunk`
   to zlib streams + smoke. One commit.
3. Triad-build G3, smoke clean. Re-run
   `npm install /Users/macuser/tmp/mri-1.2.0.tgz`. If
   `node_modules/mri/` lands: VICTORY for tarball install.
4. **A** — TLS stability investigation. Start with smallest
   reproducer, instrument SSL_read return values + record sizes.
   Try ALPN/SNI fixes incrementally. Validate against the existing
   TLS smoke suite each step.
5. Triad-build G3 again, full sweep. Re-run
   `npm install mri` against the registry. If it works: VICTORY
   for end-to-end.
6. Cut v0.89 release with whichever combination shipped (B alone,
   B+A partial, or B+A complete).
7. Propose `demos/npm-install/` if both shipped.

## Current runtime state (start of this session)

- Local repo `main` is at the commit that tagged v0.88
  (after pass-1 + pass-2 bundled).
- ibookg37 has `/opt/ionpower-node-0.88/bin/node` installed and
  `make test-all` shows 463/463 PASS.
- emac has v0.88 installed (G4 build).
- pmacg5 has v0.88 installed (G5 build).
- Tarballs `ionpower-node-0.88-{g3,g4,g5}-ppc.tar.gz` shipped as
  v0.88 GitHub release assets.
- VERSION in repo is `0.88`. Bump to `0.89` as the first pass-3
  edit.

## Quick references

- pass-2 notes:
  [`../2026-05-10-session-2-node-10-parity-pass-2/notes.md`](../2026-05-10-session-2-node-10-parity-pass-2/notes.md)
- pass-2 release notes:
  [`../2026-05-10-session-2-node-10-parity-pass-2/release-notes/v0.88.md`](../2026-05-10-session-2-node-10-parity-pass-2/release-notes/v0.88.md)
- npm install tarball-shape failure:
  [`../2026-05-10-session-2-node-10-parity-pass-2/build-logs/npm-install-mri-tarball-v0.88.txt`](../2026-05-10-session-2-node-10-parity-pass-2/build-logs/npm-install-mri-tarball-v0.88.txt)
- Local mri tarball already on ibookg37:
  `/Users/macuser/tmp/mri-1.2.0.tgz`
- TLS source to extend:
  [`../../../src/node_compat/tls.cpp`](../../../src/node_compat/tls.cpp)
- zlib JS-side glue to extend:
  [`../../../src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
  (search for `_mkInflateTransform` / `_mkDeflateTransform`).
