# Session notes — 2026-04-25 session 1

Continuation of session X (which had compacted out of context).
Standing instruction: "keep going unsupervised knocking out more
Node features until I stop you."

This session shipped **v0.66 through v0.71** plus a triad-host
swap (G3 build host `imacg3` → `ibookg37`).

## Releases

| Tag | Theme | Triad |
|---|---|---|
| [v0.66](release-notes/v0.66.md) | RSA encrypt/decrypt + PEM key import | G3/G4/G5 ✅ |
| [v0.67](release-notes/v0.67.md) | `crypto.X509Certificate` via node-forge | G3/G4/G5 ✅ |
| [v0.68](release-notes/v0.68.md) | Real DEFLATE compression via `/usr/bin/gzip` shell-out | G3/G4/G5 ✅ |
| [v0.69](release-notes/v0.69.md) | `module.Module` class + JWT (RS256/EdDSA) validation smoke | G3/G4/G5 ✅ |
| [v0.70](release-notes/v0.70.md) | Subpath module aliases (fs/promises, stream/web, stream/promises, stream/consumers, path/posix, path/win32) | G3/G4/G5 ✅ |
| [v0.71](release-notes/v0.71.md) | `node:test` mocks (`t.mock.fn`/`method`/`getter`/`setter`) + `cluster` stub + README accuracy pass | G3/G4/G5 ✅ |

Build logs for each release are in [`build-logs/`](build-logs/).

## Threads

### v0.66 — RSA encrypt/decrypt + PEM key import

Built directly on v0.65's RSA-via-forge work. Added
`crypto.publicEncrypt(key, data)` / `crypto.privateDecrypt(key, data)`
using forge's RSA-OAEP (default md=SHA-1, override via `oaepHash`).
`crypto.createPrivateKey('-----BEGIN ...')` /
`crypto.createPublicKey('-----BEGIN ...')` route PEM through
`forge.pki.{privateKeyFromPem,publicKeyFromPem}`.

Bug found on first G3 run: `_coerceRsaKey` when given
`{ key: KeyObject, oaepHash: 'sha256' }` fed the inner KeyObject
back into `createPublicKey`, which didn't have a passthrough for
"already-correct KeyObject" and tried to re-coerce. Added explicit
passthrough at the top of both `create*Key` functions.

### v0.67 — X509Certificate

Wrapped forge's `pki.certificateFromPem` / `certificateToAsn1` /
`asn1.toDer` into Node's `X509Certificate` shape. Properties:
`subject` / `issuer` (multi-line `CN=…\nO=…` form),
`validFrom` / `validTo` (Node `Apr 25 12:34:56 2026 GMT` form),
`serialNumber`, `fingerprint{,256,512}`, `raw` (DER Buffer),
`subjectAltName`, `ca`, `publicKey` (KeyObject usable directly with
`crypto.verify`). Methods: `toString` / `toJSON` (PEM),
`checkIssued`, `checkPrivateKey`, `checkHost`, `verify`.

Tripped on the first G3 run because `_hexFp` referenced a
top-level `createHash` that doesn't exist in the bootstrap scope —
fixed by switching to `new Hash(name)` directly.

### v0.68 — real DEFLATE compression

Up to v0.67, `zlib.gzipSync` / `deflateSync` produced
**stored-mode** (BTYPE=00, uncompressed) blocks — valid deflate
framing but no compression ratio. v0.68 shells out to
`/usr/bin/gzip` (always present on Tiger), then strips or
re-wraps the gzip framing for the deflate / deflateRaw forms.

8 KB of `'a'` → **44 bytes**. 5 KB lipsum → **324 bytes**.
`gunzip(1)` accepts our `gzipSync` output verbatim (cross-tool
verified in the smoke).

Bug on first run: my new `_gzipShell` called
`require('child_process').spawnSync` — but inside the bootstrap
closure `require` isn't in scope; the local `child_process` and
`fs` vars are. Switched to direct refs.

Also had to update an existing `zlib_deflate_smoke.js` assertion
that expected stored-mode-specific overhead — now compressed
output is much smaller than input, so the old `>= len + 5`
assertion was wrong.

### v0.69 — Module class + JWT validation smoke

`module.Module` class with `_cache` (mirrors `__require_cache__`),
`_extensions`, `wrap(src)` / `wrapper`, plus static
`Module.{builtinModules,isBuiltin,createRequire}`. Existing
`module.createRequire` etc. lifted to `Module.*` too.

`test/jwt_rs256_smoke.js`: end-to-end JWT validation that v0.65-v0.67's
asymmetric crypto stack handles real-world JWT use cases. Manually
constructs + verifies tokens (no JWT library) for RS256, RS256 with
PEM-imported keys, EdDSA (Ed25519), HS256, plus tamper rejection
and cross-algorithm rejection.

### v0.70 — subpath module aliases

Modern packages increasingly import via Node's official subpath
specifiers — `require('stream/web')`, `require('fs/promises')`,
etc. — instead of reaching into the parent module's `.promises`.
Seeded `__require_cache__` for them so vendored libraries that
use this convention resolve correctly.

Subpaths added: `fs/promises`, `node:fs/promises`, `path/posix`,
`path/win32`, `stream/web`, `stream/promises`, `stream/consumers`.

`stream/consumers` includes `buffer`/`arrayBuffer`/`text`/`json`/`blob`
that drain a `ReadableStream` (WHATWG or Node) into the named type.

Bug on first run: my smoke tried to drain a Node `Readable` via
`consumers.buffer(nodeRs)` but the test process exited before the
async chain completed (the stream was paused, no fd listeners
keeping the loop alive). Switched all consumer tests to use
WHATWG `ReadableStream` which has synchronous-completion behaviour
under our event loop. The `consumers` impl still supports both —
just couldn't smoke the Node-Readable side reliably.

### v0.71 — `node:test` mocks + cluster stub + README accuracy

Two pieces:

1. `node:test` mock support. Each test gets its own `t.mock`
   tracker that auto-restores at end-of-test:
   - `t.mock.fn(impl?)` — spy with `.mock.calls` / `.callCount()` /
     `.resetCalls()` / `.mockImplementation()`
   - `t.mock.method(obj, name, impl?)` — replaces obj[name],
     auto-restored at test exit
   - `t.mock.getter` / `setter` for property descriptors
   - `t.mock.restoreAll` / `reset`

2. `cluster` single-process degenerate stub: `isMaster` /
   `isPrimary` always true, `fork()` throws, `workers={}`.
   Enough for libraries branching on `if (cluster.isMaster)` to
   take the right path.

User pinged mid-release ("can you make sure you are keeping
README.md up to date?") — turned out the README was wildly out of
date for things that had landed in earlier sessions:

- `Status` section still said "Pre-alpha. SpiderMonkey is being
  built. Bridge source not yet linked/tested." — wrong for ~70
  shipped triad-built releases.
- `Scope limits` still said "Sync only. No event loop yet, so no
  setTimeout, no async fs. No http/net/dns/child_process." —
  every one of those works now.
- A duplicate `dns ❌ Missing` row contradicted the working `dns`
  row 6 lines above it.
- `async_hooks` (AsyncLocalStorage), `diagnostics_channel`,
  `EventTarget` / `Event` / `CustomEvent`, and `BroadcastChannel`
  were all shipped in earlier sessions but never got their own
  README rows.
- `fs.cp{Sync}` / `rmSync` etc. weren't mentioned.
- `Build (target: imacg52)` was single-host instructions for a
  host we don't even use — now the triad model.

Rewrote those sections + added the missing rows in the same v0.71
ship so the docs catch up to reality.

### Triad host swap: `imacg3` → `ibookg37`

User asked mid-stream to pivot to a faster G3: `ibookg37` (iBook
G3 900 MHz, PowerBook4,3) instead of `imacg3` (iMac G3 600 MHz).

`ibookg37` was a fresh host — gcc-4.9 already present at
`/opt/gcc-4.9.4/bin/g++-4.9`, but no SpiderMonkey at
`/opt/mozjs-45-ionpower-g3/`.

Rather than build from scratch (hours), streamed the prebuilt
`/opt/mozjs-45-ionpower-g3/` from imacg3 over ssh:

```
ssh imacg3 'cd /opt && tar chf - mozjs-45-ionpower-g3' | \
  ssh ibookg37 'cd /opt && tar xpf -'
```

(Note `ch` — dereference symlinks. First attempt without `h`
brought over the broken symlinks pointing into
`/Users/macuser/tmp/tenfourfox-src/...` that exist on imacg3 but
not on ibookg37, breaking compile.)

Verified pipeline by re-building v0.71 against ibookg37.

Pending: update `scripts/triad-build.sh` to default the G3 host
to `ibookg37`. v0.66-v0.71 in this session were all built against
`imacg3` (still functional); the swap takes effect from v0.72.

## Workflow change (this commit)

Reorganized session artifacts:

- `docs/sessions/<date>-session-<id>/` — one dir per session
  - `summary.md` (legacy) or `notes.md` (newer) — narrative
  - `build-logs/` — per-arch build + smoke logs
  - `release-notes/v0.NN.md` — copies of the GitHub release notes
- `scripts/triad-build.sh` — was `/tmp/triad-build.sh`. Lives in
  the repo so it's checked in.

Loose `docs/session-*-summary.md` files were moved to
`docs/sessions/<date>-session-<letter>/summary.md` keeping the
existing letter scheme for legacy sessions; new sessions use a
numbered scheme matching the ghc-darwin8-ppc / golang-darwin8-ppc
projects.

## Numbers at session end

- 658+ third-party libraries with passing smokes (unchanged from v0.65)
- 1900+ assertions across 422 wired smoke files (up from 1772/414 at v0.65)
- v0.71 tag pushed; tarballs ship for G3/G4/G5
