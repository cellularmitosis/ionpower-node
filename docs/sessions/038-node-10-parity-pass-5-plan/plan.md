# Session plan: Node 10 parity, pass 5

## Read first

In order:

1. [`../037-node-10-parity-pass-4/notes.md`](../037-node-10-parity-pass-4/notes.md)
   — what pass 4 closed (pipe-reorder for buffered+ended streams,
   fchown/chown no-op for Tiger EPERM, statSync uid/gid + nlink + ino + …),
   plus the npm install end-to-end success on PPC.
2. [`../037-node-10-parity-pass-4/release-notes/v0.90.md`](../037-node-10-parity-pass-4/release-notes/v0.90.md)
   — what shipped, what's still broken (TLS to Cloudflare LARGE
   responses), the contract for pass 5.
3. [`../037-node-10-parity-pass-4/build-logs/npm-install-mri-v0.90-SUCCESS.txt`](../037-node-10-parity-pass-4/build-logs/npm-install-mri-v0.90-SUCCESS.txt)
   — the trace showing `+ mri@1.2.0, added 1 package`.

## Context in one paragraph

ionpower-node v0.90 shipped with `npm install <local-tarball>`
end-to-end working — first verified npm install on PowerPC Tiger
under our runtime. The remaining gap for FULL npm install
capability is registry-based install: TLS to Cloudflare-fronted
endpoints hangs on LARGE responses (cloudflare.com 301 redirect
works fine; www.cloudflare.com ~100KB HTML times out at SSL_read).
Pass-3's bytes-loss hypothesis and pass-4's quick ALPN probe both
ruled out; the failure mode is in our multi-record SSL_read flow
or in our HTTP chunked-encoding parser when fed across many TLS
records. There are also a couple of smaller carryover items.

## Scope

### A. TLS to Cloudflare-fronted endpoints (LARGE responses)

The strategic blocker for `npm install` from the public registry.
Approach: pin down the failure mode FIRST before changing TLS code.

**Probe shapes that worked in pass 4**:
- `https.get('cloudflare.com')` → 301, 167-byte body, OK
- `https.get('example.com')` → 200, 528-byte body, OK
- `https.get('www.cloudflare.com')` → handshake completes, no STATUS line
  ever appears, full TIMEOUT after 15s.

The handshake succeeds (we know from cloudflare.com working).
Something about the response — large enough to span multiple TLS
records, possibly with chunked encoding — breaks before the HTTP
response line is parsed.

**Investigations to try, in order**:

1. **Where does the request hang?** Instrument
   `_TLSSocket.prototype._pumpRead` and `_onRawData` with
   `console.error` per-call logs. Run against www.cloudflare.com.
   See whether bytes flow in but no SSL_read returns data, or
   bytes flow + SSL_read returns but the HTTP parser doesn't see
   the response line.
2. **Verify multi-record SSL_read.** Standalone test: connect to
   www.cloudflare.com, drive handshake, then loop SSL_read in
   chunks while feeding bioWrite from TCP. Count total decrypted
   bytes; verify it matches Content-Length (or that 'end' fires
   cleanly).
3. **Cipher list.** Cloudflare prefers TLS 1.3 with AEAD ciphers.
   Verify our negotiated cipher (via `SSL_get_current_cipher`)
   and confirm it's supported.
4. **TLS 1.3 0-RTT / early data?** Cloudflare may send 0-RTT data
   in the handshake response that our state machine doesn't
   reconstitute correctly. Try forcing TLS 1.2 via
   `SSL_CTX_set_max_proto_version(ctx, TLS1_2_VERSION)` as an
   isolation experiment.
5. **HTTP chunked encoding parser.** Once we know SSL_read decrypts
   correctly, check that our chunked decoder (in `globals.cpp`
   around line 7561) can stitch chunks across multiple `'data'`
   events without corruption. Pass-4's grep showed the parser
   path but didn't trace its behavior on large bodies.

**Smoke**: re-add `test/tls_cloudflare_smoke.js` (deleted at end of
pass 3 + pass 4) once a fix lands. Test against
`www.cloudflare.com` specifically — that's the failing shape.

### B. demos/npm-install/

A demo that showcases the local-tarball install capability. Shape:

    demos/npm-install/
      README.md          — what this demonstrates
      run.sh             — wrapper: mkdir tmp/, cd, npm install
                           ../fixtures/mri-1.2.0.tgz
      fixtures/
        mri-1.2.0.tgz    — small dep-free package (we already have
                           this on ibookg37; vendor it)

This is the user-facing "look, npm install works" demo. Keeps
nicely-bounded scope (single dep-free package, local tarball).
Pass-4's npm trace wrapper (`/Users/macuser/tmp/run-npm-trace.js`)
can be the optional debug entry.

Don't pursue this if A is going badly — A is the higher-impact
work.

### C. Carryover items (still deferred)

- **`process.getuid` / `getgid` / `geteuid` / `getegid`**. Tar's
  preserveOwner check gates on `process.getuid && process.getuid()
  === 0`; without our impl, preserveOwner is false (which is what
  we want for non-root anyway). pacote's selfOwner similarly
  short-circuits to `{uid: undefined}`. So we got away without
  these in v0.90 thanks to the chown no-op detection working off
  fstat directly. But these are tiny additions, and other code
  paths (e.g. npm-lifecycle running install scripts) may eventually
  need them. ~10-line C++ addition.
- **`JS_ReportError → ThrowFsError`** in `fs.cpp` (writeFileSync,
  appendFileSync, copyFileSync, chmodSync) — still pending from
  pass 2. Not blocking; cosmetic for error-shape consistency.
- **`fs.promises.read` / `fs.promises.write`** with `{bytesRead,
  buffer}` return shape — still pending from pass 2. Not hit by
  any caller in our npm-6.14.18 install path; add when something
  needs it.
- **ES modules first-class** — needs SM 60+, longer-term.

## Working order

1. Read the three "Read first" docs.
2. **A.** Instrument + investigate www.cloudflare.com hang. Aim for
   a concrete root cause before changing TLS code.
3. If A lands, registry-based `npm install <pkg-name>` becomes
   possible. Verify with `npm install left-pad` (small, no deps).
4. **B.** Add `demos/npm-install/` if A is shipping or already
   shipped. Don't block on A.
5. Cut v0.91 with whichever combination shipped.

## Risk / blast radius

A: TLS code is sensitive. Same caution as pass 3 / pass 4 — keep
all existing TLS smokes green (axios, https-server, https-get,
wss). Add the cloudflare smoke as the new regression hook.
Instrumentation-first means low risk: add console.error, observe,
remove. Code changes only after we understand the failure mode.

B: Pure additive. New files under `demos/`. No source changes.
Smoke included only if A landed.

## Current runtime state (start of this session)

- Local repo `main` is at the commit that tagged v0.90 plus the
  docs commit afterwards.
- ibookg37 / emac / pmacg5 each have `/opt/ionpower-node-0.90/bin/node`
  installed and `make test-all` shows 469/469 PASS.
- ibookg37's `/Users/macuser/tmp/npm-test/node_modules/mri/` is the
  surviving test fixture from the successful pass-4 install.
- Tarballs `ionpower-node-0.90-{g3,g4,g5}-ppc.tar.gz` shipped as
  v0.90 GitHub release assets.
- VERSION in repo is `0.90`. Bump to `0.91` as the first pass-5
  edit.

## Quick references

- pass-4 notes:
  [`../037-node-10-parity-pass-4/notes.md`](../037-node-10-parity-pass-4/notes.md)
- pass-4 release notes:
  [`../037-node-10-parity-pass-4/release-notes/v0.90.md`](../037-node-10-parity-pass-4/release-notes/v0.90.md)
- npm install success trace:
  [`../037-node-10-parity-pass-4/build-logs/npm-install-mri-v0.90-SUCCESS.txt`](../037-node-10-parity-pass-4/build-logs/npm-install-mri-v0.90-SUCCESS.txt)
- TLS source to instrument:
  [`../../../src/node_compat/tls.cpp`](../../../src/node_compat/tls.cpp)
- TLS JS pump:
  [`../../../src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
  (search for `_TLSSocket.prototype._pumpRead`, `_onRawData`,
  `_pumpRead`, the chunked-encoding body framing state machine
  around line 7561).
- npm trace wrapper on ibookg37:
  `/Users/macuser/tmp/run-npm-trace.js`
- Local mri tarball on ibookg37 (still cached + cached in
  `/Users/macuser/.npm/_cacache/`):
  `/Users/macuser/tmp/mri-1.2.0.tgz`
