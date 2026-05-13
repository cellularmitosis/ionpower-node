# Session handoff: Node 10 parity, pass 9

## Read first

In order:

1. [`notes.md`](notes.md) — pass-8 narrative. 11 stream-engine fixes
   in [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp),
   gated by 17 vendored Node 10.24.1 stream tests under
   [`test/node10-streams/`](../../../test/node10-streams/). v0.94
   shipped against the triad. 490 / 490 across G3 + G4 + G5.
2. [`release-notes/v0.94.md`](release-notes/v0.94.md) — what shipped,
   the EventEmitter `'error'` throw behavior shift callout, and the
   "what's still pending" list.
3. The 5 stream tests still parked unwired in
   [`test/node10-streams/`](../../../test/node10-streams/):
   `test-stream-decoder-objectmode`, `test-stream-pipe-cleanup`,
   `test-stream-push-order`, `test-stream-readable-emittedReadable`,
   `test-stream-readable-resumeScheduled`. These exercise deeper
   Node-internal semantics (encoding decoder, dynamic emittedReadable
   / resumeScheduled flag transitions, emitReadable timing) that
   pass 8 didn't tackle.

## Context in one paragraph

v0.94 closes the "Node-streams conformance pass" goal that the pass-7
handoff suggested. The handwoven `_Stream` / `_Readable` / `_Writable` /
`_Transform` chain has been refactored to follow Node v10's `flow()`
model: `_emitFlow` is the engine, doing both `_read` (pull) and
emit('data') (drain) in one loop; `push()` only buffers and re-enters
`_emitFlow`. The reading-state flag is honest (set true by
`read()`/resume's prime/_maybeReadMore, cleared only by `push()` on
real data arrival), which gates `_maybeReadMore` from over-firing
`_read` between consumer demand windows. With this in place 17 / 22
official Node 10 stream tests pass — and crucially, the pre-existing
473 smokes all still pass. The 5 parked tests are tractable but need
either deeper-semantics work (emittedReadable/resumeScheduled state
transitions) or a small new piece (utf16le string_decoder).

## Scope

### A. Close the 5 parked Node 10 stream tests

In rough order of complexity:

1. **`test-stream-pipe-cleanup`** — easiest if we adopt the legacy
   `Stream.prototype.pipe` listener model exactly: also install
   `'close'` listeners (for source close → unpipe) and a `'cleanup'`
   helper. Our current pipe is the new model; the legacy test asserts
   on specific listener counts the legacy pipe installs. Options:
   ship a separate `legacy_pipe` and bind it to the base `_Stream`
   prototype, or accept that this test is unfixable without adopting
   the legacy listener accounting.

2. **`test-stream-readable-emittedReadable`** + **`test-stream-readable-
   resumeScheduled`** — need dynamic flag transitions on
   `_readableState.emittedReadable` and `.resumeScheduled`. Initial
   values are correct (`false`); set them to `true` at the appropriate
   emit points and back to `false` during `read()` or after the
   scheduled resume fires. Mostly bookkeeping; should be ~30-50 lines.

3. **`test-stream-push-order`** — the test pushes via several
   `nextTick`s and asserts on the resulting `_readableState.buffer`
   array order. May need to look at how our buffer ordering differs
   from Node's. Could be cheap or could expose a real bug.

4. **`test-stream-decoder-objectmode`** — needs an `encoding` (utf16le
   in this test) decoder. Node uses `string_decoder` internally; we
   don't currently apply the encoding option on Readable. Adding a
   minimal decoder (or just wiring the existing
   `string_decoder` module) could fix this. ~40-80 lines.

### B. Vendor a third batch of Node 10 stream tests

The conformance corpus has 121 `test-stream-*.js` files. Pass 8 picked
22 (17 passing, 5 parked). Aim for 10-15 more in pass 9, picking
across:

- `test-stream-pipeline-*.js` (5 files) — exercise `stream.pipeline`.
- `test-stream-finished*.js` (4 files) — exercise `stream.finished`.
- `test-stream-transform-*.js` (8 files) — Transform edge cases.
- `test-stream-writev*.js` / `test-stream-writable*.js` — Writable
  details, `_writev` support.
- `test-stream-once-readable-pipe.js`,
  `test-stream-readable-needReadable.js` etc.

### C. (Smaller, anytime) — `fs.promises.read` / `fs.promises.write`
return shape

Carryover from v0.92 and v0.93 "what's still pending". Add the
`{bytesRead, buffer}` / `{bytesWritten, buffer}` return shape.

### D. (Smaller, anytime) — `demos/npm-install/` registry demo

The pass-7 handoff suggested adding a registry-based `npm install
left-pad` demo alongside the existing local-tarball one. Still
worth doing.

### E. (Larger, opportunistic) — install a non-trivial package via the
real npm registry path

`left-pad` is one-file. Picking a pure-JS package with a real dep
tree (express? body-parser? mri-style stack?) and running
`node npm-cli.js install <pkg> --registry=...` against the real
npmjs registry is the actual end-to-end "Node-on-PowerPC for real"
demo.

## Working order

Suggested:

1. Read `notes.md` + `release-notes/v0.94.md`.
2. **A2** first (emittedReadable / resumeScheduled) — small, easy
   wins, adds 2 tests to the green list.
3. **A4** (decoder-objectmode) — also small, adds 1 test.
4. **B** — vendor a batch of 10 new tests, see what surfaces.
5. **A1**, **A3** — harder; tackle if time.
6. **C** / **D** anytime they fit.
7. Triad-build, cut v0.95.

## Risk / blast radius

A2/A4 are very contained — they add fields / a decoder, no behavior
shift for existing code. A1 (legacy pipe) is bigger; it would touch
the load-bearing `pipe()` code. A3 may expose ordering bugs.

B is additive — vendoring tests doesn't change runtime behavior.

C / D are additive.

E is opportunistic.

## Current runtime state (start of pass 9)

- v0.94 shipped: 490 / 490 across G3 + G4 + G5.
- Tarballs uploaded as v0.94 GitHub release assets.
- `/opt/ionpower-node-0.94/bin/node` installed on G3 / G4 / G5
  with the pass-8 changeset.
- 22 stream tests vendored under `test/node10-streams/`; 17 wired,
  5 parked.
- VERSION in repo is `0.94`. Bump to `0.95` as the first pass-9
  edit (or leave at `0.94` if not cutting a release).

## Quick references

- pass-8 notes: [`notes.md`](notes.md)
- pass-8 release notes: [`release-notes/v0.94.md`](release-notes/v0.94.md)
- the 11 fixes:
  [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp).
  Key landmarks (line numbers approximate):
  - EventEmitter throw-on-unhandled-error: search
    `EventEmitter.prototype.emit`.
  - removeListener empty-array cleanup: search
    `EventEmitter.prototype.removeListener`.
  - pipe + unpipe + onerror cleanup pattern: search
    `_Stream.prototype.pipe` and `_Stream.prototype.unpipe`.
  - `_emitFlow` (read + drain engine): search
    `_Readable.prototype._emitFlow`.
  - push semantics: search `_Readable.prototype.push`.
  - read(n) refill / concat / HWM bump: search
    `_Readable.prototype.read`.
  - paused-mode 'readable' hook + lazy end: search
    `_Readable.prototype.on`.
  - `_maybeReadMore`: search `_Readable.prototype._maybeReadMore`.
  - no-`new` constructor wrappers: search
    `if (!(this instanceof _Stream)) return new`.
- regression smoke:
  [`test/streams_smoke.js`](../../../test/streams_smoke.js) (existing).
- vendored Node 10 tests:
  [`test/node10-streams/`](../../../test/node10-streams/).
- the upstream Node 10.24.1 test corpus:
  `git -C external/node-tests show v10.24.1:test/parallel/` (~150
  `test-stream-*.js` files; v10.24.1 tag was fetched in pass 8).
