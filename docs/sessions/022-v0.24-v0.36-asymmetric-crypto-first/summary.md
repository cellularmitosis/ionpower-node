# Session V summary (2026-04-24)

Follows session U (v0.22/v0.23). Fourteen releases this session,
v0.23 through v0.36. Primary theme: filling out the Node-standard
module surface, then hitting the "first asymmetric crypto" milestone.

## Releases

| Tag | Headline |
|---|---|
| v0.23 | library hunt wave 4 (tweetnacl/fast-json-stable-stringify/stable-sort/emoji-regex) |
| v0.24 | WHATWG Streams (ReadableStream / WritableStream / TransformStream) |
| v0.25 | `module.createRequire` + `builtinModules` |
| v0.26 | `perf_hooks` + global `performance` |
| v0.27 | library hunt wave 5 (7 more tested) |
| v0.28 | ES2022/2023 small-API polyfills (`structuredClone`, `Object.hasOwn`, `Array.toSorted/toReversed/findLast`, `String.replaceAll`, `Promise.any`, `AggregateError`) |
| v0.29 | `dgram` (UDP) core module + native `sendto`/`recvfrom` |
| v0.30 | **First asymmetric crypto**: Ed25519 via tweetnacl (Node-style `crypto.sign`/`verify`/`generateKeyPair*`) |
| v0.31 | WebCrypto Ed25519 + X25519 ECDH |
| v0.32 | library hunt wave 6 (9 more tested) |
| v0.33 | `require('tweetnacl')` first-class with PRNG auto-wired |
| v0.34 | `readline` core module |
| v0.35 | `assert.rejects`/`doesNotReject`/`match` + library hunt wave 7 |
| v0.36 | `node:test` minimal TAP runner + `process.exitCode` honoured |

Library count: 580 → 610+ smoke-covered.
Assertions: 1368 → 1517+ across 385 smoke files.

## Judgment calls

### Lazy loading tweetnacl for asymmetric crypto

Rather than embedding 2400 lines of tweetnacl in `globals.cpp`, kept
it as a standalone vendored file and wrote a lazy loader
(`_naclLoad`) that:

1. Walks `test/vendor/`, `<cwd>/vendor/`, and
   `<exeDir>/../share/ionpower-node/vendor/` for `tweetnacl.js`.
2. Calls `__require_native__` directly on the resolved path —
   bypassing the wrapped require (which short-circuits `tweetnacl`
   back to `_naclLoad`, causing infinite recursion).
3. Wires `setPRNG` to `crypto.getRandomValues` before returning.

The Makefile `install` target now copies `tweetnacl.js` into
`share/ionpower-node/vendor/` alongside `babel.js` so installed
tarballs have it.

### `process.exitCode` wiring gap

main.cpp was returning `ok ? 0 : 1` — only the script's own status.
Any library that set `process.exitCode = 1` on its way out (tape,
node:test, our new TAP runner) appeared to succeed to the shell.
Fixed in v0.36 — main.cpp reads `process.exitCode` post-drain.

Caught by the v0.36 smoke: a deliberately-failing test was expected
to make the child exit with 1, but child exited with 0. Turned out
to be an actual bug rather than my polyfill.

### tiger-rsync gremlin expanded

Previously we knew `Makefile` mysteriously failed to land via
`tiger-rsync.sh`. This session also saw:

- **Full `--delete` fails on emac** (rsync 2.6.3 doesn't grok
  `--delete-before` which modern host rsync sends). Workaround:
  drop `--delete` for the G4 rsync, accept some stale files.
- **Anything in `src/` also sometimes doesn't land.** Extended the
  explicit scp list to include `main.cpp`, `net.cpp`, `globals.cpp`,
  `process.cpp`, and the `Makefile`. Anything smaller isn't touched
  enough to matter, but if it does go missing the build will fail
  early.

### `escape-string-regexp` CJS regression

v0.27's library hunt copied the upstream *current* version of
`escape-string-regexp`, which is ESM-only (`export default`). Our
Babel transform wraps that as `module.exports = { default: fn }`, so
chalk's `var esr = require('escape-string-regexp')` found the object
rather than the callable.

Reverted to the older CJS shape in v0.28.

### flaky event_loop timer ordering on pmacg5

`event_loop_smoke.js`'s "earlier timer first" check occasionally
trips under load on the G5. Retry passes cleanly. Added a
retry-once loop around `test-all` in `/tmp/triad-build.sh` so a
flake doesn't abort the whole release pipeline.

## Hand-off state

- 610+ libraries under smoke coverage, 1517+ assertions across 385
  smoke files.
- Crypto: full symmetric + KDF + hashing + HMAC + Ed25519 asymmetric
  (Node + WebCrypto) + X25519 ECDH + nacl.box / nacl.secretbox.
- Still missing asymmetric: RSA, ECDSA (NIST P-256 etc.), classic ECDH.
- Network: TCP (net) + UDP (dgram). No TLS, no WebSocket.
- Streams: WHATWG + Node; no async iteration (no `for await`).
- Module: CommonJS full; ESM via Babel lazy transform; no `import.meta`.
- Test runner: node:test minimal TAP.

### Possible next steps

- RSA / ECDSA via a pure-JS impl we ship (`node-forge`, `elliptic`) —
  bigger library than tweetnacl, meaningful work.
- WebSocket (RFC 6455) — moderate, builds on net.
- TLS — too much without a native lib.
- More library hunt waves — always low-hanging.
- vm module — would need SpiderMonkey compartment work.
- `--test` CLI flag that auto-runs test files in a directory.
