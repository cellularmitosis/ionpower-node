# Session notes — 2026-05-12 session 1: Node 10 parity, pass 8

Handoff: [`../041-node-10-parity-pass-7/handoff-pass-8.md`](../041-node-10-parity-pass-7/handoff-pass-8.md).
Pass-7 notes: [`../041-node-10-parity-pass-7/notes.md`](../041-node-10-parity-pass-7/notes.md).
Pass-7 release notes: [`../041-node-10-parity-pass-7/release-notes/v0.93.md`](../041-node-10-parity-pass-7/release-notes/v0.93.md).

Pass-7 closed the registry-based `npm install <name>` goal that had
been driving passes 5–7. The handoff calls out that across pass-6
and pass-7 we landed *four* stream-contract fixes
(IM paused/flowing, gunzip buffer-until-listener, stdio-wrapped-
Writable, eof-mode emit-end-when-buffer-empty), and that a real
Node-stream conformance pass is the highest-leverage next move
before more downstream libraries trip on latent bugs in the
handwoven `_Stream` / `_Readable` / `_Writable` / `_Transform` /
`_IncomingMessage` chain in [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp).

User said "proceed" — operating in unsupervised mode per CLAUDE.md.

## Plan

Track A from the handoff is the strategic move: pull
`test-stream-*.js` from the Node 10.24.1 source tree, wire them
into the smoke runner, fix what breaks, one bug per commit. Aim
for ~10 tests in pass 8.

Order:

1. Bump VERSION to 0.94 (so smoke output and `process.versions`
   reflect the in-progress release).
2. Get the Node 10.24.1 test corpus onto disk (already lives at
   `/Users/macuser/tmp/node-10.24.1` on the build host, per
   pass-7 references). Pick a small batch of self-contained
   tests (no internal helper deps beyond `common.js` and a small
   shim).
3. For each picked test:
   - Add it under `test/stream/` (preserving the upstream name).
   - Stub out the bits of `common.js` it actually uses.
   - Run it locally via `make` build + the existing runner.
   - If it fails, fix the underlying `_Stream` /
     `_Readable` / etc. bug. One bug per commit.
4. Triad-build, cut v0.94.

Working log follows.

## Working log

### Setup

- Bumped VERSION 0.93 → 0.94 (Makefile, process.cpp, README).
- Confirmed G3/G4/G5 hosts reachable, v0.93 binary installed.
- Confirmed v10.24.1 tag fetched into `external/node-tests`
  (was at Node main / v20+); pulled the tag with
  `git -C external/node-tests fetch --depth=1 origin tag v10.24.1`.
- 121 `test/parallel/test-stream-*.js` files available at the tag.

### Test infrastructure

- New dir [`test/node10-streams/`](../../../test/node10-streams/).
- [`_common.js`](../../../test/node10-streams/_common.js) — minimal
  shim of upstream `test/common`'s surface (`mustCall`, `mustNotCall`,
  `mustCallAtLeast`, `expectsError`, `getArrayBufferViews`,
  `printSkipMessage`, platform flags, PIPE, hasCrypto). Mismatched
  `mustCall` counts → `process.exit(1)` via `process.on('exit')`.
- Vendored 10 tests verbatim from `v10.24.1:test/parallel/`:
  `test-stream-ispaused`, `test-stream-pipe-event`,
  `test-stream-readable-flow-recursion`, `test-stream-push-strings`,
  `test-stream-pipe-error-handling`, `test-stream-pipe-cleanup-pause`,
  `test-stream-pipe-multiple-pipes`, `test-stream-end-paused`,
  `test-stream-events-prepend`, `test-stream-readable-event`.
- Rewrote `require('../common')` → `require('./_common')`.
- Wired all 10 into `scripts/test-list-more.txt`. Coverage check
  in `scripts/check-test-coverage.sh` only globs `test/*.js`
  (top-level), so the subdir tests stay out of its scope but they
  do get picked up by the runner via the list-file.

### Baseline run (v0.94 = v0.93 + version bump only)

10 tests: 1 PASS (`test-stream-ispaused`), 9 FAIL.

Failure modes:

| Test | Failure | Root cause |
|---|---|---|
| `pipe-event` | `assert.ok(passed)` false | `pipe` doesn't emit `'pipe'` on dest |
| `events-prepend` | mustCall count 0 of 1 | same — `w.on('pipe', ...)` never fires |
| `pipe-multiple-pipes` | `readable.unpipe is not a function` | `unpipe` not implemented |
| `pipe-cleanup-pause` | mustCall count 0 of 3 | same `unpipe` gap (test path uses it) |
| `pipe-error-handling` | block 1 `gotErr` null | block 2: `dest.emit('error')` with no listener silently swallows; should throw and propagate |
| `readable-flow-recursion` | reads=1, expected 2 | `readableHighWaterMark` / `readableLength` getters missing; HWM bump on large `read(size)` |
| `push-strings` | `_chunks` not -1 | attaching `'readable'` listener doesn't trigger `_read` |
| `readable-event` | `_readableState.reading` flag wrong | `reading` accuracy across paths |
| `end-paused` | mustCall count 0 of 1 | paused stream with `push(null)` doesn't emit `'end'` on resume |

### Fix 1 — `pipe` emits 'pipe', `unpipe` lands

[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
`_Stream.prototype.pipe`: track each (src, dest) pair on
`src._pipes` and emit `dest.emit('pipe', src)` at hookup. Added
`_Stream.prototype.unpipe(dest?)` that detaches the specific (or
all) pipe(s), removing only the listeners that pipe() installed and
emitting `dest.emit('unpipe', src)`. Aliased `_Readable.prototype.unpipe`.

Results after fix 1: **5/10 passing**.
PASS adds: `pipe-event`, `events-prepend`, `pipe-multiple-pipes`,
`pipe-cleanup-pause`. Still failing: `pipe-error-handling`,
`readable-flow-recursion`, `push-strings`, `readable-event`,
`end-paused` — those need separate fixes.

Running full smoke suite to check for regressions ...

Smoke ran clean against the 473 pre-pass-8 tests; added 10 new
tests; 7 passed under the smoke runner (counts that ec=0 as pass).
The two that ec=0-but-fail-via-exit-handler-assertion
(`push-strings`, `readable-flow-recursion`) look like passes to the
runner — not great, but they don't regress anything.

### Fix 2 — end-emission re-architecture (paused stream end)

[`globals.cpp`](../../../src/node_compat/globals.cpp) `_Readable.prototype._emitFlow`
+ `on(ev, fn)`: replaced the eager `setImmediate(emit('end'))` fallback
with a `_endPending` flag that lazily delivers when an 'end' listener
attaches. The pass-7 setImmediate path was timing-fragile —
test-stream-end-paused does
`on('data',...); pause(); setTimeout(on('end',...);resume(),1)`, and
the deferred `setImmediate(emit('end'))` from the initial auto-resume
fired *before* the timer-attached 'end' listener was in place, so
endEmitted got set to true and the late listener was orphaned. New
contract: only set `endEmitted=true` when 'end' is actually delivered
to a listener; otherwise mark `_endPending` and let the on('end')
hook re-fire it.

Preserves the pass-6 "node-fetch attaches data first" case: the
on('end') hook schedules a setImmediate(emit('end')) when picking up
a `_endPending` state.

Result: **6/10 passing**. (added `test-stream-end-paused`).

### Fix 3 — paused 'readable' mode machinery

[`globals.cpp`](../../../src/node_compat/globals.cpp): added the
plumbing that paused-mode readers (`on('readable')` + `r.read()`)
need:

- `push(chunk)` now flips `state.reading=false` (acknowledges that a
  prior `_read` delivered data) and calls `_maybeReadMore` so the
  stream eagerly refills below HWM. Empty non-objectMode chunks
  (e.g. `push('')`) don't buffer but DO acknowledge `_read` and
  trigger another fetch — matches Node v10's
  `readableAddChunk` and test-stream-readable-event subtest 4.
- `_scheduleReadable` debounces 'readable' emits to `process.nextTick`
  so multiple synchronous pushes coalesce into one notification —
  without this, `push()` inside the `_read` triggered from inside a
  'readable' listener re-entered the listener and busy-looped.
- `_maybeReadMore`: on `nextTick`, loop call `_read` while the
  buffered byte count is below HWM and the stream isn't
  flowing/ended/reading. Mirrors Node v10's
  `lib/_stream_readable.js`.
- `_bufferedBytes()`: byte sum across the buffer (chunk count in
  objectMode). HWM comparisons need bytes, not chunk count —
  `[Buffer.from('blerg')]` has 1 chunk but 5 bytes, which exceeds
  HWM=3. Test-stream-readable-event subtest 1 caught this.
- `on('readable')` hook: attaching a 'readable' listener kicks off a
  `_read` on `nextTick` if the buffer is empty, or schedules a
  'readable' emit if data is already buffered.
- `read(n)`: refills via `_read` when below HWM (regardless of buffer
  emptiness — for the read-concat pattern). Returns concatenated
  buffer when no `n` is given (`Buffer.concat` for buffers, `''.join`
  for strings). After delivering a chunk, if buffer is empty and
  ended, fires 'end' via the lazy `_fireEndIfPending` path.
- `read(n)` HWM bump: when `n > highWaterMark`, bump HWM to the next
  power of 2 ≥ n. test-stream-readable-flow-recursion expects
  `readableHighWaterMark === 8192` after `read(5000)` over an
  initial HWM=2.
- `readableHighWaterMark` / `readableLength` getters: prototype
  Object.defineProperty, mirror `_readableState`.

Result: **9/10 passing**. (added `push-strings`, `readable-event`,
`readable-flow-recursion`).

Re-running full smoke against the pass-8 changeset to confirm the
pipe / readable / push / maybeReadMore changes don't regress any of
the 473 prior tests ...

### Second batch — vendor 12 more, see what surfaces

While the smoke runs, vendor 12 more tests (pipe-flow, pipe-manual-resume,
pipe-without-listenerCount, objectmode-undefined, unpipe-event,
readable-emittedReadable, readable-resumeScheduled, transform-flush-data,
push-order, pipe-same-destination-twice, decoder-objectmode, pipe-cleanup).

First run: 2 PASS (pipe-flow, transform-flush-data), 10 FAIL.
Failure modes:

| Test | Failure | Underlying gap |
|---|---|---|
| pipe-manual-resume | `rs is undefined` | `stream.Readable({...})` called without `new` |
| pipe-without-listenerCount | mustCall count 2 vs 1 | pipe re-emits 'error' on dest even when src has a user listener — Node legacy pipe only re-emits if no other listener |
| objectmode-undefined | mustCall count 2 vs 1 | `_emitFlow` re-calls `_read` after each push, double-emitting data |
| unpipe-event | timer assertion | unpipe event semantics (TBD) |
| readable-emittedReadable | `undefined !== false` | `_readableState.emittedReadable` field missing |
| readable-resumeScheduled | `undefined !== false` | `_readableState.resumeScheduled` field missing |
| push-order | `s.readableBuffer is undefined` | `readableBuffer` alias missing |
| pipe-same-destination-twice | (TBD) | likely related to pipe dual-call |
| decoder-objectmode | `:0: AssertionError: a` | encoding (utf16le) decoder missing |
| pipe-cleanup | `1 !== 0` | legacy `pipe` listener accounting (end + close + cleanup listeners) |

### Fix 4 — EventEmitter throws on unhandled 'error'

[`globals.cpp`](../../../src/node_compat/globals.cpp): `emit('error', err)`
when no listener is registered now throws (per Node spec). Non-Error
arguments are wrapped in an `Unhandled "error" event.` Error with the
original payload on `.context`.

### Fix 5 — pipe onerror: cleanup-then-conditional re-emit

[`globals.cpp`](../../../src/node_compat/globals.cpp) `_Stream.prototype.pipe`'s
onerror: detach all pipe-installed listeners from src and remove the
pipe-entry from `src._pipes`. Then, only if src has no other 'error'
listener, re-emit on dest (which will trigger the EE throw if dest
also has none). Mirrors Node's legacy `Stream.prototype.pipe` and the
new `Readable.prototype.pipe`. Avoids the prior bug where every pipe
re-emitted on dest unconditionally — that caused
test-stream-pipe-without-listenerCount to over-fire dest's error
listener.

Uses `src._events.error` directly because the test
deliberately clobbers `src.listenerCount` to undefined.

### Fix 6 — Readable/Writable/Duplex/Transform callable without `new`

[`globals.cpp`](../../../src/node_compat/globals.cpp): each constructor
now self-corrects:
`if (!(this instanceof _X)) return new _X(opts);`. Several Node tests
(test-stream-pipe-manual-resume) call `stream.Readable({...})` without
`new`, which Node supports because its internal classes also forward.

### Fix 7 — state fields + `readableBuffer` alias

Added `emittedReadable: false`, `resumeScheduled: false`,
`encoding: opts.encoding || null` to the initial `_readableState`. Added
a `readableBuffer` accessor on the prototype that returns the underlying
state buffer.

(Initial-value parity only; the dynamic semantics that
`test-stream-readable-emittedReadable` exercises are deferred.)

### Fix 8 — `_emitFlow` purely drains; `_maybeReadMore` drives all pulls

The pass-7 `_emitFlow` had its own inner `_read` call ("buffer drained,
ask source for more"). Combined with `resume()` also calling `_read`,
that caused 2x `_read` and 2x `'data'` emissions per cycle in flowing
mode (test-stream-objectmode-undefined caught it). Refactor: `_emitFlow`
ONLY drains the buffer; `resume()` does one prime `_read`; subsequent
pulls happen via `_maybeReadMore` scheduled from `push()`. `_emitFlow`
keeps the lazy 'end' emission tail (sync if listener attached, else
mark `_endPending`).

`_maybeReadMore` now fires for BOTH flowing and paused mode (was
guarded `!s.flowing` before). In flowing mode the push → emit('data')
→ _maybeReadMore → next _read cycle is what keeps a sync-source pipe
flowing past the first chunk. The `state.reading` flag honestly
tracks "_read in-flight, didn't push yet" — `read()` and the
'readable' on-hook no longer reset `state.reading=false` after `_read`
returns. Only `push()` resets it (on actual data delivery). That gate
prevents `_maybeReadMore` from over-firing _read between consumer
demand windows (test-stream-push-strings's setTimeout-based source
relied on this — we used to fire `_read 4` (case 0 → push(null))
before the 100ms `push("last chunk")` could land).

### Fix 9 — auto-unpipe on src `'end'`; `_readableState.pipes/pipesCount` tracking

Node auto-tears down a pipe when src ends (`Readable.prototype.pipe` →
onend → unpipe). Our `onend` now also calls `src.unpipe(dest)`, which
emits 'unpipe' on dest and decrements `_readableState.pipesCount`.
`_readableState.pipes` mirrors Node's `null/dest/[dest...]` shape:
null for 0 pipes, the dest itself for 1, an array for 2+.

Reordering in pipe(): register the pipe + emit `'pipe'` BEFORE attaching
the 'data' listener. Attaching 'data' auto-resumes (our flowing-mode
trigger), which can synchronously run `_read → push(null) → emit('end') →
onend → unpipe`. If 'pipe' / `_pipes` weren't set up first, the
'pipe' event would fire AFTER 'end' (or never), and pipesCount accounting
would be wrong (test-stream-unpipe-event subtest 1 caught it).

### Fix 10 — `removeListener` deletes empty arrays

`EventEmitter.prototype.removeListener` now deletes the event key from
`_events` when the listener array empties. Some libs + tests check
`emitter._events.foo === undefined` (test-stream-pipe-same-destination-
twice's `assert.strictEqual(passThrough._events.data, undefined)`).

### Results

**17 of 22** vendored stream tests pass on G3:

|  | tests |
|---|---|
| PASS | end-paused, events-prepend, ispaused, objectmode-undefined, pipe-cleanup-pause, pipe-error-handling, pipe-event, pipe-flow, pipe-manual-resume, pipe-multiple-pipes, pipe-same-destination-twice, pipe-without-listenerCount, push-strings, readable-event, readable-flow-recursion, transform-flush-data, unpipe-event |
| FAIL (deferred) | decoder-objectmode (utf16le encoding decoder gap), pipe-cleanup (legacy Stream.prototype.pipe listener-count accounting — 'close' + 'cleanup' listeners we don't install), push-order (depends on emitReadable internal timing), readable-emittedReadable (dynamic emittedReadable flag semantics — not just initial value), readable-resumeScheduled (dynamic resumeScheduled flag semantics) |

The 5 failing tests are vendored under
[`test/node10-streams/`](../../../test/node10-streams/) but **not**
wired into `scripts/test-list-more.txt` — they're known-failing parking
spots for pass 9 (or later). The runner sees the 17 passing tests as
part of `make test-libs`.

### Fix 11 — `_emitFlow` is the engine (refactor v2)

The fix-8 refactor (where `_emitFlow` purely drains and `resume()` does
the prime) caused `streams_smoke.js` to regress: it pushes one chunk
per `_read` call (sync source) and expects all chunks emitted
synchronously after `on('data', ...)`. The fix-8 design only emitted
one chunk per cycle (next tick for next pull).

Final design (matches Node v10's `flow(stream)` pattern): `_emitFlow`
runs `while (s.flowing) { if buffer empty → _read; if still empty → exit;
else drain one chunk }`. Single loop, single `_read` per drain
iteration. Key property: emit('data') happens INSIDE this loop, NOT
inside `push()`. A `_read` that pushes both `chunk` AND `null` (e.g.
test-stream-objectmode-undefined) emits 'data' exactly once — the
outer loop exits when ended=true on the next iteration. Sync sources
loop through all chunks in one call. Async sources exit with empty
buffer (state.reading stays true since push didn't fire), and re-enter
via `push()` calling `_emitFlow` when the deferred push fires.

`resume()` just calls `_emitFlow` now — no separate prime.

### Results

**17 of 22** vendored stream tests pass on G3, **and** no regressions
across the existing 473 (`streams_smoke.js` re-greens after the
fix-11 refactor).

|  | tests |
|---|---|
| PASS | end-paused, events-prepend, ispaused, objectmode-undefined, pipe-cleanup-pause, pipe-error-handling, pipe-event, pipe-flow, pipe-manual-resume, pipe-multiple-pipes, pipe-same-destination-twice, pipe-without-listenerCount, push-strings, readable-event, readable-flow-recursion, transform-flush-data, unpipe-event |
| FAIL (deferred) | decoder-objectmode (utf16le encoding decoder gap), pipe-cleanup (legacy Stream.prototype.pipe listener-count accounting — 'close' + 'cleanup' listeners we don't install), push-order (depends on emitReadable internal timing), readable-emittedReadable (dynamic emittedReadable flag semantics — not just initial value), readable-resumeScheduled (dynamic resumeScheduled flag semantics) |

The 5 failing tests are vendored under
[`test/node10-streams/`](../../../test/node10-streams/) but **not**
wired into `scripts/test-list-more.txt` — they're known-failing
parking spots for pass 9 (or later).

Final test count: G3 `make test-all` = 490 / 490.

Triad build incoming ...


