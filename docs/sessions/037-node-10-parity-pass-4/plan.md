# Session plan: Node 10 parity, pass 4

## Read first

In order:

1. [`../036-node-10-parity-pass-3/notes.md`](../036-node-10-parity-pass-3/notes.md)
   — what pass 3 closed (9 waves of stream / fs / EventEmitter
   gaps), the npm install state at v0.89 (extract action starts
   then hangs in cacache pump), and the pass-4 list at the bottom.
2. [`../036-node-10-parity-pass-3/release-notes/v0.89.md`](../036-node-10-parity-pass-3/release-notes/v0.89.md)
   — what shipped, what's still broken, the contract for pass 4.
3. [`../036-node-10-parity-pass-3/build-logs/npm-install-mri-tarball-v0.89-transformfinal.txt`](../036-node-10-parity-pass-3/build-logs/npm-install-mri-tarball-v0.89-transformfinal.txt)
   — the trace that surfaces the cacache pump hang.

## Context in one paragraph

ionpower-node v0.89 shipped. npm 6.14.18 now runs deep into the
install pipeline: bootstrap → resolve-from / npm-lifecycle →
Installer.run → loadCurrentTree → readLocalPackageData → pacote
manifest → ideal-tree resolution → executeActions → extract action
START. Two distinct walls remain. First, inside cacache's
`pump(fs.createReadStream(cpath), ssri.integrityStream(...),
passThrough)`, the multi-stage pipe never resolves nor errors —
just hangs. Each subset reproduces correctly in isolation; only
the full npm install context hangs. Second, TLS to Cloudflare-
fronted endpoints still trips `ssl3_get_record: decryption failed
or bad record mac` after the handshake completes (status 200
arrives but body reads fail). Pass-3's bytes-loss-in-bioWrite
hypothesis was ruled out.

## Scope

### A. The cacache pump hang

The most strategic fix — unblocks npm install end-to-end (combined
with everything pass 3 already shipped). The hang manifests only
in the full npm install context; every isolated subset works.
That's the hardest kind of bug to find.

**Repro shape**: `npm install /Users/macuser/tmp/mri-1.2.0.tgz`
on ibookg37 with v0.89's `/Users/macuser/tmp/run-npm-trace.js`
wrapper. After "trying file: by hash" silly log, npm hangs. Eventually
"Completed in Xms" timer fires and "cb() never called!" is logged.

Hypotheses to investigate:

1. **Bluebird scheduling state.** Pacote uses bluebird heavily. Our
   microtask queue may interact badly with bluebird's scheduler in
   the npm install context where many promises chain across many
   modules. Try: instrument bluebird's `Promise._pendingQueue` or
   add `process.on('unhandledRejection', ...)` to surface anything
   silently swallowed.
2. **Subtle Transform.end / pump destroy race.** Pass 3 made
   _Readable.destroy and _Writable.destroy idempotent and made
   _Transform.end set ws.ended=true BEFORE push(null). Maybe
   there's a fourth interaction we missed. Try: trace every
   stream's emit + destroy in cacache's pump pipeline with
   `console.error` patches.
3. **A listener interaction my newListener fix didn't fully cover.**
   Maybe `removeListener` isn't being respected somewhere, or
   the `'newListener'` recursion guard skips a needed emission.
4. **fs.createReadStream's setImmediate-driven chunking** doesn't
   compose well with downstream pipe consumers in this specific
   shape. Maybe the chunks emit AFTER the consumer has set up
   its destroy chain.

**Bisection approach**: aggressively patch
`pacote/lib/with-tarball-stream.js`, `pacote/extract.js`, and
`cacache/lib/content/read.js` with `console.error` per-event
tracing. Run npm install. Find the exact stream that's missing
its 'end'/'close'/'error'.

### B. TLS to Cloudflare-fronted endpoints

Pass 3 ruled out the bytes-loss hypothesis. Status 200 arrives but
body reads fail with `decryption failed or bad record mac`. New
hypotheses:

1. **ALPN missing.** Real Node sends `h2,http/1.1` by default;
   Cloudflare may negotiate HTTP/2 and disconnect mid-stream when
   ALPN's not advertised. Add `SSL_CTX_set_alpn_protos(ctx,
   "\x02h2\x08http/1.1", 12)` in tls.cpp's `JsCreateClientCtx`.
2. **Cipher list narrow.** Verify our cipher list against
   Cloudflare's modern AEAD requirements (AES-GCM-256,
   ChaCha20-Poly1305).
3. **TLS 1.3 record handling.** SSL_CTX_set_min_proto_version is
   TLS1_2; Cloudflare may serve TLS 1.3. Maybe handshake succeeds
   but app-data records are TLS 1.3-formatted and our SSL_read
   loop doesn't handle them right.
4. **Larger response handling.** example.com works (small body);
   cloudflare.com doesn't (large body). Maybe SSL records ARE
   correctly decrypted but a later chunk gets misaligned.

**Smoke**: re-add `test/tls_cloudflare_smoke.js` (deleted at end
of pass 3) once a fix lands.

### C. Out of scope (still deferred)

- `JS_ReportError` → `ThrowFsError` migration in `fs.cpp`
  (writeFileSync, appendFileSync, copyFileSync, chmodSync).
- Real `fs.promises.read` / `fs.promises.write` (need
  `{bytesRead, buffer}` return shape).
- ES modules first-class (still needs SM 60+).

## Working order

1. Read the three "Read first" docs.
2. **A first.** It's the install-pipeline blocker. If A lands,
   `npm install <local-tarball>` works end-to-end — first verified
   `npm install` from a tarball on PPC.
3. **B next.** TLS strategic for any future HTTPS work. With B
   landed, registry-based npm install becomes possible.
4. Cut v0.90 with whichever combination shipped.
5. If both shipped, propose `demos/npm-install/` with mri tarball
   install as the demo.

## Risk / blast radius

A: The cacache pump hang is in the stream/promise interaction
layer — adding instrumentation to npm vendored code is safe (just
add then revert). The actual fix may need to touch our
EventEmitter, _Readable, _Writable, or _Transform code — same
fragility as pass 3. Strategy: keep all existing tests green
(467 baseline); add focused regression smokes for any new fix.

B: TLS code is sensitive. Same caution as pass 3 — keep all TLS
smokes green (axios, https-server, https-get, wss). Add the
cloudflare smoke as the new regression hook.

## Current runtime state (start of this session)

- Local repo `main` is at the commit that tagged v0.89.
- ibookg37 has `/opt/ionpower-node-0.89/bin/node` installed and
  `make test-all` shows 467/467 PASS.
- emac has v0.89 installed (G4 build).
- pmacg5 has v0.89 installed (G5 build).
- Tarballs `ionpower-node-0.89-{g3,g4,g5}-ppc.tar.gz` shipped as
  v0.89 GitHub release assets.
- VERSION in repo is `0.89`. Bump to `0.90` as the first pass-4 edit.

## Quick references

- pass-3 notes:
  [`../036-node-10-parity-pass-3/notes.md`](../036-node-10-parity-pass-3/notes.md)
- pass-3 release notes:
  [`../036-node-10-parity-pass-3/release-notes/v0.89.md`](../036-node-10-parity-pass-3/release-notes/v0.89.md)
- npm install hang shape:
  [`../036-node-10-parity-pass-3/build-logs/npm-install-mri-tarball-v0.89-transformfinal.txt`](../036-node-10-parity-pass-3/build-logs/npm-install-mri-tarball-v0.89-transformfinal.txt)
- TLS source to extend:
  [`../../../src/node_compat/tls.cpp`](../../../src/node_compat/tls.cpp)
- Stream / EventEmitter source:
  [`../../../src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
  (search for `_Readable`, `_Writable`, `_Transform`,
  `EventEmitter.prototype`).
- npm trace wrapper on ibookg37:
  `/Users/macuser/tmp/run-npm-trace.js`
- Local mri tarball on ibookg37:
  `/Users/macuser/tmp/mri-1.2.0.tgz`
