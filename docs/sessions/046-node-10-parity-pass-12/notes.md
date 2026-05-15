# Session notes — 046: Node 10 parity pass 12

Handoff: [`../045-node-10-parity-pass-11/handoff-pass-12.md`](../045-node-10-parity-pass-11/handoff-pass-12.md).
Pass-11 notes: [`../045-node-10-parity-pass-11/notes.md`](../045-node-10-parity-pass-11/notes.md).

## TL;DR

`demos/express-chat-npm/` works end-to-end against the live registry on
a 900 MHz iBook G3: `npm install` succeeds, server boots, all 7
`client.js` smoke checks pass.

Driving the demo end-to-end uncovered one require-resolver bug
(`handlebars@4.7.8` shadowing the top-level `"main"`) plus the two
known carryovers (`fs.promises.read/write` return shape,
`process.binding('uv').errname`). All three landed; cut v0.98.

## What landed

### `package.json` top-level `"main"` resolver
[`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp)

Replaced `strstr(buf, "\"main\"")` with a brace-aware
`FindTopLevelMainKey()` that skips string literals and only matches
`"main"` keys at depth 1. handlebars@4.7.8 has a `"jspm":
{ "main": "handlebars" }` block before the real top-level
`"main": "lib/index.js"`; the old resolver was finding the nested
one. Smoke at
[`test/package_main_smoke.js`](../../../test/package_main_smoke.js)
builds a temp `node_modules/widget/` with that pattern and requires
it via a child process.

This bug was effectively invisible against the vendored
`test/vendor/*.js` tree (those don't nest "main") but immediately
fatal for npm-installed packages that do.

### `fs.promises.read` / `fs.promises.write` shape
[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)

Added `_promisifyFsRwShape(fn, countKey)` that wraps the
`(err, n, buffer)` callback into `{ [countKey]: n, buffer: buf }`.
Used for `fs.promises.read` (`bytesRead`) and `fs.promises.write`
(`bytesWritten`). Pending since v0.92. Smoke at
[`test/fs_promises_rw_smoke.js`](../../../test/fs_promises_rw_smoke.js)
writes 'abcdefghij' to a temp file, opens, reads 5 bytes, checks
shape, writes 'XYZ' back, checks `bytesWritten` shape, and verifies
the file contents.

### `process.binding('uv').errname(code)`
[`src/node_compat/process.cpp`](../../../src/node_compat/process.cpp)

Replaced the empty-`{}` `process.binding` stub with one that returns
`{ errname: function(code) { … } }` for `'uv'` and `{}` for other
names. The errname table covers ~40 common libuv codes (negative
errno space) and falls back to `'UV_UNKNOWN(' + code + ')'`.

execa was the visible caller — every `npm install` ended with
`execa/lib/errname: unable to establish process.binding('uv') {}`.
With the shim, that line disappears.

Smoke at
[`test/process_binding_uv_smoke.js`](../../../test/process_binding_uv_smoke.js).

### Demo: `demos/express-chat-npm/`

Pass-11 added the files locally but the v0.97 triad-build's rsync
step ran *before* the files existed on disk, so they didn't make it
to the remote hosts and didn't get installed into the v0.97 tarballs.
Verified working in pass 12 and shipping properly in v0.98.

## Verification

- All 17 core smokes pass on G3 (4 new ones + 13 pre-existing).
  ([`build-logs/ibookg37-g3-0.98-tests.log`](build-logs/ibookg37-g3-0.98-tests.log))
- All 495 / 0 libs smokes pass on G3 — no regressions from v0.97.
- **`npm install` + run + client smoke of `demos/express-chat-npm/`
  end-to-end on G3 against the live registry**:
  - `npm install` — 75 packages added in 219.451s
  - `server.js 8091` boots in <2s
  - `client.js` — all 7 checks pass (POST/GET/tripcode/rate-limit/since/empty-text)
  ([`build-logs/express-chat-npm-smoke.log`](build-logs/express-chat-npm-smoke.log))
- `execa/lib/errname` warning is gone from npm install output.
- Triad-built G3 + G4 + G5 cleanly.

## Working method note

When iterating the resolver fix, I patched `require.cpp` locally,
`scp`'d it to G3 alongside the new smoke, and ran an *incremental*
`make` (no `clean`) — finishes in ~30s. That's the cheapest feedback
loop for "edit-one-file-in-node_compat-and-test" iteration. Faster
than the full triad-build by ~10 min. Worth remembering.

Once the resolver, fs.promises shape, and process.binding shim were
all green locally, I did the full triad-build for the release.

## Carryover for pass 13

- **`express@5` end-to-end.** The Babel fallback should lower object
  spread; private class fields (`#name`) are a separate problem that
  Babel doesn't lower on their own without a plugin. Worth a
  half-hour attempt to see what blows up.
- **Prototype-mutation warning** at express startup. Cosmetic. Best
  fix is to filter that specific message out of our error reporter.
- **Other npm packages** known not to load: don't know yet. Probably
  worth running `npm install` of a handful of common Node-10-era
  things (lodash, axios, chalk, commander, debug, ws@8) and seeing
  which ones fail at require time.
