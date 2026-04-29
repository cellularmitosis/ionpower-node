# Session notes — 2026-04-25 session 1

Continuation of session X (which ran through compaction at v0.65).
Standing instruction at session start: "keep going unsupervised
knocking out more Node features until I stop you."

This session shipped **v0.66 through v0.81 — sixteen releases —**
plus a workflow pivot (per-session dirs + scripts in repo + mozjs as
release artifact + ibookg37 swap), two real demos, and ~270 legacy
`/tmp` artifacts pulled into the repo.

## Releases

| Tag | Theme |
|---|---|
| [v0.66](release-notes/v0.66.md) | RSA encrypt/decrypt + PEM key import |
| [v0.67](release-notes/v0.67.md) | `crypto.X509Certificate` via node-forge |
| [v0.68](release-notes/v0.68.md) | Real DEFLATE compression via `/usr/bin/gzip` shell-out |
| [v0.69](release-notes/v0.69.md) | `module.Module` class + JWT (RS256/EdDSA) validation smoke |
| [v0.70](release-notes/v0.70.md) | Subpath module aliases (`fs/promises`, `stream/web`, `stream/promises`, `stream/consumers`, `path/posix`, `path/win32`) |
| [v0.71](release-notes/v0.71.md) | `node:test` mocks + `cluster` stub + README accuracy pass |
| [v0.72](release-notes/v0.72.md) | Real `os.cpus`/`hostname`/`loadavg`/`freemem`/`totalmem` via sysctl + vm_stat |
| [v0.73](release-notes/v0.73.md) | Binary fetch fix (clear UTF-8-decode pending exception) + bundle mozjs tarballs |
| [v0.74](release-notes/v0.74.md) | `Buffer.from(ArrayBuffer)` + typed array fix |
| [v0.75](release-notes/v0.75.md) | ECDSA via vendored elliptic (P-256/384/521/secp256k1) |
| [v0.76](release-notes/v0.76.md) | NIST ECDH — asymmetric crypto roster complete |
| [v0.77](release-notes/v0.77.md) | Top-level `await` for entry-point scripts |
| [v0.78](release-notes/v0.78.md) | `import.meta` + dynamic `import()` via Babel pre-rewrite |
| [v0.79](release-notes/v0.79.md) | `crypto.subtle` ECDSA + ECDH |
| [v0.80](release-notes/v0.80.md) | Real `process.stdin.setRawMode` (tcsetattr) + `TIOCGWINSZ` columns/rows |
| [v0.81](release-notes/v0.81.md) | `crypto.subtle` EC JWK import/export |

Per-arch build logs for each release in [`build-logs/`](build-logs/).
Commit messages for v0.70+ in [`release-notes/`](release-notes/) as
`v0.NN-msg.txt`.

## Threads

### v0.66–v0.67 — RSA + X.509

Built directly on session-X's v0.65 RSA-via-forge work. v0.66 wires
`crypto.publicEncrypt(key, data)` / `privateDecrypt(key, data)` using
forge's RSA-OAEP (default md SHA-1, override via `oaepHash`); also
makes `createPrivateKey` / `createPublicKey` route PEM strings through
`forge.pki.{privateKeyFromPem,publicKeyFromPem}`. Bug found on first
G3 run: `_coerceRsaKey` when given `{ key: KeyObject, oaepHash: ... }`
fed the inner KeyObject back into `createPublicKey`, which had no
passthrough for "already-correct KeyObject" — added explicit
passthrough at the top of both `create*Key` functions.

v0.67 wraps forge's `pki.certificateFromPem` / `certificateToAsn1` /
`asn1.toDer` into Node's `X509Certificate` shape. All standard
properties + `checkIssued`/`checkPrivateKey`/`checkHost`/`verify`.
Tripped on first build because `_hexFp` referenced a top-level
`createHash` that doesn't exist in the bootstrap scope — fixed by
switching to `new Hash(name)` directly.

### v0.68 — real DEFLATE

Through v0.67, `zlib.gzipSync` / `deflateSync` produced **stored-mode**
(BTYPE=00, uncompressed) blocks: valid framing, no compression. v0.68
shells out to `/usr/bin/gzip` (always present on Tiger), then strips
or re-wraps the gzip framing for the deflate / deflateRaw forms. 8 KB
of `'a'` → **44 bytes**. 5 KB lipsum → **324 bytes**. `gunzip(1)`
accepts our `gzipSync` output.

Bug on first run: the new `_gzipShell` called
`require('child_process').spawnSync` — but inside the bootstrap
closure `require` isn't in scope; the local `child_process` and `fs`
vars are. Switched to direct refs.

### v0.69 — Module class + JWT validation

`module.Module` class with `_cache` (mirrors `__require_cache__`),
`_extensions`, `wrap(src)` / `wrapper`, plus static
`Module.{builtinModules,isBuiltin,createRequire}`.

`test/jwt_rs256_smoke.js`: end-to-end JWT validation that v0.65-v0.67's
asymmetric crypto stack handles real-world JWT use cases. Manually
constructs + verifies tokens (no JWT library) for RS256, RS256 with
PEM-imported keys, EdDSA (Ed25519), HS256, plus tamper rejection +
cross-algorithm rejection.

### v0.70 — subpath module aliases

Modern packages increasingly import via Node's official subpath
specifiers — `require('stream/web')`, `require('fs/promises')`, etc.
— instead of reaching into the parent module's `.promises` property.
Seeded `__require_cache__` for them.

Bug on first run: my smoke tried to drain a Node `Readable` via
`consumers.buffer(nodeRs)` but the test process exited before the
async chain completed (the stream was paused, no fd listeners
keeping the loop alive). Switched all consumer tests to use WHATWG
`ReadableStream` which has synchronous-completion behaviour.

### v0.71 — node:test mocks + cluster stub + README accuracy

Two pieces. `t.mock.fn(impl?)` (spy with `.calls`/`.callCount()`/
`.resetCalls()`/`.mockImplementation()`), `t.mock.method(obj, name)`
(replaces, auto-restores), `t.mock.getter`/`setter`. Cluster
single-process stub: `isMaster`/`isPrimary=true`, `fork()` throws.

Mid-release the user pinged about README staleness. Found the
**Status** section still saying "Pre-alpha. SpiderMonkey is being
built. Bridge source not yet linked/tested." for ~70 shipped
triad-built releases. **Scope limits** still claimed "Sync only. No
event loop. No http/net/dns/child_process." Duplicate `dns ❌
Missing` row contradicting the working dns row. AsyncLocalStorage,
diagnostics_channel, EventTarget, BroadcastChannel all shipped in
earlier sessions but never got their own README rows. Rewrote those
sections + added the missing rows in the same v0.71 ship.

### Workflow pivot (between v0.71 and v0.72)

User asked to consolidate the loose `docs/session-*-summary.md` files
into per-session directories matching the convention in sibling
projects (`golang-darwin8-ppc`, `ghc-darwin8-ppc`):

    docs/sessions/<date>-session-<id>/
        notes.md         (or summary.md for legacy sessions)
        build-logs/      per-host build + smoke output
        release-notes/   GitHub release prose copies

Migrated 24 loose summaries into per-session dirs (legacy letter
identifiers preserved: `session-a`, `session-b`, ..., `session-x`;
new sessions use the within-date counter form `session-1`,
`session-2`). `/tmp/triad-build.sh` moved to
[`scripts/triad-build.sh`](../../../scripts/triad-build.sh) with
per-arch host defaults baked in. `CLAUDE.md` documents the layout +
naming convention going forward.

User also asked to migrate `*.log`, `*.txt`, `*.md`, `*.sh` files
from `/tmp` that originated from this project into the appropriate
session dirs. Wrote two migration scripts (saved here as
[`scripts/migrate-legacy-tmp-artifacts.sh`](scripts/migrate-legacy-tmp-artifacts.sh)
and [`scripts/migrate-triad-build-logs.sh`](scripts/migrate-triad-build-logs.sh))
that mapped 270+ artifacts to sessions by version.

User then asked to rename `examples/` (which I'd named for the chat +
npm-fetch demos) to `demos/` — turned out there was already a
`demos/` directory with seven other demos. Consolidated.

### v0.72 — real os.* probes

`os.cpus()` was hardcoded to 'PowerPC G4' at 1000 MHz regardless of
the host. v0.72 wires the host-specific properties to real probes:
- `cpus()` → `sysctl -n hw.cpusubtype hw.cpufrequency hw.ncpu`,
  Mach-O subtype mapped to G3 (750) / G4 (7400/7450) / G5 (970)
- `hostname()` → `/bin/hostname`
- `loadavg()` → parse `/usr/bin/uptime`
- `totalmem()` → `sysctl -n hw.memsize`
- `freemem()` → `(Pages free + Pages speculative) * page size` from `/usr/bin/vm_stat`

On the new G3 host (ibookg37):
- `cpus()` → `[{ model: 'PowerPC G3 (750)', speed: 900, ... }]`
- `hostname()` → `'ibookg37.home'`
- `loadavg()` → `[1.02, 0.82, 0.7]`
- `totalmem()` → 671088640 bytes (640 MB)
- `freemem()` → 102739968 bytes (98 MB)

### Triad host swap: imacg3 → ibookg37

User asked to pivot from imacg3 (iMac G3, 600 MHz) to ibookg37 (iBook
G3 PowerBook4,3, 900 MHz) for the G3 slot. Streamed the prebuilt
`/opt/mozjs-45-ionpower-g3/` from imacg3 across the local fleet:

    ssh imacg3 'cd /opt && tar chf - mozjs-45-ionpower-g3' | \
        ssh ibookg37 'cd /opt && tar xpf -'

(Note `-h`: dereference symlinks. First attempt without it brought
broken symlinks pointing into `/Users/macuser/tmp/tenfourfox-src/...`
on imacg3 that don't exist on ibookg37, breaking compile.)

Validated by re-building v0.71 against ibookg37, then made the swap
permanent via `scripts/triad-build.sh` defaults.
[`v0.71-ibookg37-validate.log`](build-logs/v0.71-ibookg37-validate.log)
is the pipeline-validation log.

### v0.73 — binary fetch + mozjs tarballs

User flagged that consumers needed BOTH the runtime tarball AND a
matching SpiderMonkey install — undocumented and a download hassle.
Added one-time mozjs tarballs as v0.73 release artifacts (G3 90 MB,
G4 66 MB, G5 66 MB), with future runtime releases linking back.

In passing, hit a real bug while validating demo 2 (npm-fetch):
`fetch().arrayBuffer()` returned 0 bytes for any binary URL. The
HTTP getSync C++ tried to UTF-8 decode every body to populate
`r.body`; when that decode failed for binary content, it left a
pending JS exception on the SpiderMonkey context, which then caused
the subsequent `JS_DefineProperty(result, "bodyBytes", ...)` calls to
fail. Fixed by `JS_ClearPendingException(cx)` after the failed
decode.

### v0.74 — Buffer.from(ArrayBuffer) fix

Demo 2 STILL failed end-to-end after v0.73's fetch fix. Traced to
another bug: `Buffer.from(ab)` returned 0 bytes for any ArrayBuffer.
The native fell through to the array-like branch, which reads
`.length` — but ArrayBuffer has `.byteLength`. Patched `BufferFrom`
to explicitly handle ArrayBuffer (via `JS_GetArrayBufferData`) and
TypedArray (via `JS_GetArrayBufferViewData`). Sliced typed-array
views (`byteOffset > 0`) work correctly now.

After v0.74, demo 2 lands: `mri@1.2.0` from `registry.npmjs.org`,
fetched + gunzipped + untarred + required + exercised in **754 ms**
on ibookg37.

### Demos shipped

- [`demos/chat`](../../../demos/chat/) — multi-client WebSocket
  chat. HTTP server on `:8080` serves the inline HTML; ws server on
  `:8081`; multi-tab broadcast via EventEmitter; runtime banner
  shows real CPU/host info from v0.72's os.* probes. Validated
  end-to-end on ibookg37 with 3 simultaneous clients.
- [`demos/npm-fetch`](../../../demos/npm-fetch/) — `npm install` via
  the runtime: fetch from registry → gunzip → POSIX ustar parse →
  fs.writeFileSync → require + exercise. Takes ~750 ms for `mri` on
  ibookg37.

### v0.75 — ECDSA

Vendored `elliptic` (the standard JS ECC implementation, used by
jws/jwa/jsonwebtoken under the hood) plus its 6 deps (bn.js, brorand,
hash.js, hmac-drbg, minimalistic-assert, minimalistic-crypto-utils).
Total 452 KB in `test/vendor/elliptic/`. Wired into our existing
`crypto.{sign,verify,generateKeyPairSync}` API on `P-256` / `P-384` /
`P-521` / `secp256k1`.

Performance on ibookg37: keygen ~100 ms, sign ~3 s, verify ~13 s.
Slow because bn.js bignum isn't tuned for 32-bit PowerPC, but
functionally correct.

### v0.76 — NIST ECDH

`crypto.diffieHellman({ privateKey, publicKey })` for two EC
KeyObjects derives a shared secret. Closes the last "Still missing"
item in the asymmetric crypto roster.

### v0.77 — Top-level `await`

Pre-detection scanner (brace-depth-tracking, comment + string-literal
stripping) detects `await` at top level outside any `async function`
body and wraps the source in an async IIFE before handing it to
Babel. Works for entry-point scripts; CJS modules can't synchronously
export a value computed via TLA (a hard limit of CJS).

First trigger condition was wrong — SM45 reports the parse error as
"missing ; before statement", not "await is only valid". Switched to
pre-detection (always wrap if TLA is detected) instead of catching
Babel errors.

### v0.78 — `import.meta` + dynamic `import()`

Closes both remaining "Missing" CommonJS items. Both via regex
substitutions in the Babel-on-parse-failure preprocessor:

    import.meta.url       -> ("file://" + __filename)
    import.meta.filename  -> __filename
    import.meta.dirname   -> __dirname
    import.meta            -> { url, filename, dirname }
    import(spec)           -> __dynamic_import__(spec, require)

`__dynamic_import__` is a new global wrapping `require` in a Promise
that returns `{ default: ... }` to match ESM dynamic-import shape.

### v0.79 — `crypto.subtle` ECDSA + ECDH

Lifted v0.75/v0.76 ECDSA + ECDH into the WebCrypto subtle API for
browser-style code. Added `_ecdsaDerToRaw` + `_ecdsaRawToDer` to
convert between Node's DER signatures and WebCrypto's raw `r ‖ s`
(left-padded, with proper non-negative DER encoding when the high
bit is set).

### v0.80 — real `setRawMode` + TIOCGWINSZ

`process.stdin.setRawMode(true)` was a no-op stub. CLI prompt
libraries (inquirer, prompts) silently broke because they couldn't
actually put the terminal in raw mode. Real implementation via two
new natives in `process.cpp`:
- `process._setRawMode(fd, raw)` — `tcgetattr` + `tcsetattr` with
  Node's flag set; saves the original termios on first raw call
- `process._tty_size(fd)` — `ioctl(TIOCGWINSZ)` for `{columns,rows}`

Stream constructors in `process.cpp` now query the real terminal
size at install time instead of reporting hardcoded 80×24.

### v0.81 — `crypto.subtle` EC JWK import/export

Fills the JWK shape that real-world JOSE / JWT libraries hand around:
`{ kty: 'EC', crv: 'P-256', x, y, d? }`. Round-trip: export, re-import,
sign with re-imported private, verify with original public —
succeeds. Plus raw uncompressed-point export (`0x04 || X || Y`) for
public keys.

Closes the WebCrypto JWK story for EC keys.

## Numbers at session end

- 658+ third-party libraries with passing smokes (unchanged from
  start of session; library hunt was deliberately deprioritized)
- 1990+ assertions across 432 wired smoke files (up from 1772/414
  at session start)
- 16 tagged releases shipped to GitHub
- All three "Missing" CJS items (top-level await, import.meta,
  dynamic import) closed
- Asymmetric crypto roster feature-complete on supported curves:
  RSA + Ed25519 + X25519 + ECDSA + ECDH on both Node + WebCrypto APIs
- README accuracy passes: ~12 stale rows updated, 4 missing rows
  added, Status + Scope sections rewritten

## Remaining gaps (for future sessions)

Per the v0.81 README:

- `https.createServer` 🟡 Partial — TLS without OpenSSL is the last
  big piece. forge has a TLS 1.0/1.1 client+server impl that could
  be wired into our `net.Socket`; a TLS 1.3 implementation would
  need real work.
- `Intl` ❌ — needs rebuilding mozjs with ICU support; out of scope
  for the runtime layer.
- Brotli compression — vendoring `brotli` is 1.5 MB; could vendor a
  decoder-only impl to handle `Content-Encoding: br` responses.
- `worker_threads.MessageChannel` / `MessagePort` — currently throws.
- `http2` — major lift.
