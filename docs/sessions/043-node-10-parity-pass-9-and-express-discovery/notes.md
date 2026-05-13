# Session notes — 043: Node 10 parity pass 9 + express discovery

Handoff: [`../042-node-10-parity-pass-8/handoff-pass-9.md`](../042-node-10-parity-pass-8/handoff-pass-9.md).
Pass-8 notes: [`../042-node-10-parity-pass-8/notes.md`](../042-node-10-parity-pass-8/notes.md).
Pass-8 release notes: [`../042-node-10-parity-pass-8/release-notes/v0.94.md`](../042-node-10-parity-pass-8/release-notes/v0.94.md).

Two-headed session. First half: close the 5 parked Node 10 stream
tests that pass 8 left under [`test/node10-streams/`](../../../test/node10-streams/)
unwired. Second half: discovery pass against the live npm registry
— `npm install express handlebars ws` on G3, catalogue every gap
that surfaces. Heavy lifting from express discovery is left for
pass 10.

## Plan

### Half 1 — parked stream tests

Per pass-9 handoff, in rough order of complexity:

1. `test-stream-readable-emittedReadable` + `test-stream-readable-resumeScheduled`
   — dynamic flag transitions on `_readableState.emittedReadable` /
   `.resumeScheduled`. Initial values landed in pass 8; need the
   set→clear transitions at emit / read / resume sites.
2. `test-stream-decoder-objectmode` — needs an `encoding` (utf16le)
   decoder. Wire `string_decoder` to Readable's `setEncoding` path.
3. `test-stream-push-order` — buffer ordering across multiple
   `process.nextTick` pushes. Diagnose first; may be tractable or
   may expose a real semantic bug.
4. `test-stream-pipe-cleanup` — legacy pipe listener-count
   accounting. Hardest; requires either dual pipe implementations
   (legacy + new) or accepting this test as deferred.

### Half 2 — express discovery

On ibookg37 (G3):

1. Install npm 6.14.18 cache + tarball if not already present.
2. `mkdir -p /tmp/express-discovery && cd /tmp/express-discovery`
3. `./node /opt/npm-6.14.18/lib/cli.js install express handlebars ws --registry=https://registry.npmjs.org`
4. Run-log every failure. For each:
   - Capture stack/error + which dep tripped it.
   - If <30 lines to fix, fix inline.
   - Else: detailed note for pass 10.
5. Once `node_modules/` populated, smoke-test `require("express")`,
   `require("handlebars")`, `require("ws")` against the v0.94 (or
   v0.95-if-cut) runtime.
6. Goal: a list of "blocked on:" gaps, prioritised, for the pass-10
   handoff.

## Working log

### Baseline survey

5 parked Node 10 stream tests in [`test/node10-streams/`](../../../test/node10-streams/):

1. `test-stream-readable-emittedReadable` — asserts the dynamic
   `_readableState.emittedReadable` flag transitions: false initially,
   true inside the 'readable' listener body, false after `read()`
   (but NOT after `read(0)`), always false in flowing mode.
2. `test-stream-readable-resumeScheduled` — asserts the dynamic
   `_readableState.resumeScheduled` flag: false initially, true
   synchronously after `r.resume()` / `r.pipe(w)` / `r.on('data', ...)`,
   false on nextTick (and inside the 'resume' event listener).
3. `test-stream-decoder-objectmode` — `new Readable({ encoding: 'utf16le',
   objectMode: true })`, push utf16le Buffers, expect read() to return
   decoded strings.
4. `test-stream-push-order` — pushes 6 items via two-at-a-time pattern,
   expects `s.readableBuffer.join(',') === '1,2,3,4,5,6'` (just buffer
   ordering — turned out to already work).
5. `test-stream-pipe-cleanup` — legacy `stream.Stream.prototype.pipe`
   listener-count assertions. Plain stream.Stream instances (not
   Readable/Writable subclasses), 100-loop end + close patterns,
   then a 2-pipeline A=r→d, B=d→w that checks the precise listener
   counts the legacy pipe installs (onend + cleanup on src.end,
   onclose + cleanup on src.close, etc.).

### Fix 1 — `emittedReadable` transitions + `read(0)` consume bug

[`globals.cpp`](../../../src/node_compat/globals.cpp).

- `_scheduleReadable`: set `s.emittedReadable = true` immediately
  before `self.emit('readable')` inside the scheduled nextTick.
- `read(n)`: existing behavior was broken for `read(0)` — it consumed
  a chunk because the `n < s.buffer.length` branch shifted the buffer
  even when n is 0. Per Node's contract, `read(0)` is a refill-only
  call: schedule a `_read` if applicable, return null, don't consume,
  don't flip emittedReadable. Added an early-return `if (n === 0)
  return null` after the refill block.
- `read(n)` with non-zero n: set `s.emittedReadable = false` at end.

### Fix 2 — String → Buffer conversion in push(), Buffer → string via decoder

[`globals.cpp`](../../../src/node_compat/globals.cpp). Two halves of
the same readableAddChunk-style encoding pass:

- In non-objectMode with NO decoder set: a pushed string is converted
  to a Buffer (default encoding utf8, or the second arg if provided).
  Node v10 always does this; without it,
  `push('foo') + push('bar') + read()` returns the joined string,
  whereas test-stream-readable-emittedReadable expects
  `Buffer.from('foobar')`.
- In any mode with a decoder set: a pushed Buffer is decoded to a
  string via the encoding's StringDecoder.

This third item turned out to silently break
`test/stream_helpers_smoke.js`'s `from(string)` subtest. Node's
`Readable.from()` defaults to objectMode (so chunk identity is
preserved); our `stream.Readable.from` was constructing
`new _Readable()` (paused, non-objectMode) which meant the new
string→Buffer conversion now applied. Fixed by constructing
`new _Readable({ objectMode: true })` to match Node's contract.

### Fix 3 — Decoder constructor + setEncoding

[`globals.cpp`](../../../src/node_compat/globals.cpp):
- `_Readable` constructor reads `opts.encoding` and creates
  `s.decoder = new StringDecoder(opts.encoding)`.
- New method `_Readable.prototype.setEncoding(enc)` installs the
  decoder for an already-constructed stream.

The existing StringDecoder (utf8-aware with multibyte buffering, plus
a Buffer.toString(enc) passthrough for other encodings) handles
utf16le via the existing Buffer encoding path.

### Fix 4 — `resumeScheduled` flag + deferred `'resume'` emit

[`globals.cpp`](../../../src/node_compat/globals.cpp). The
test-stream-readable-resumeScheduled assertions create a four-way
constraint:

- Initial: `false`
- Inside the 'data' listener (which fires synchronously from
  `_emitFlow`): `false`
- Synchronously after `r.resume()` / `r.pipe(w)` / `r.on('data', ...)`
  returns: `true`
- On nextTick (and inside the 'resume' event listener): `false`

Implementation: keep `_emitFlow` synchronous (streams_smoke depends on
sync data emission after `on('data')`), but wrap it with state
bookkeeping. In `resume()`: clear `resumeScheduled = false` before
`_emitFlow` (so listeners observe the cleared flag), then set
`resumeScheduled = true` after sync flow completes, and schedule a
nextTick that resets it to false and emits `'resume'`. Deferring the
emit catches the test's `r.on('resume', ...)` listener that's
attached AFTER r.resume().

### Fix 5 — Legacy pipe-cleanup listener model

[`globals.cpp`](../../../src/node_compat/globals.cpp). `_Stream.prototype.pipe`
now installs the full Node v0.x legacy listener set, gated by
test-stream-pipe-cleanup's count assertions:

- `src.on('end', onend)` — existing.
- `src.on('close', onclose)` — NEW. Forwards close to `dest.destroy()`.
- `src.on('error', onerror)` — existing, but error path now calls
  `cleanup()` instead of the prior inline removeListener trio.
- `src.on('data', ondata)` — existing.
- `src.on('end', cleanup)` — NEW. Detaches the entire pipe footprint.
- `src.on('close', cleanup)` — NEW.
- `dest.on('error', onerror)` — NEW (error listener on both sides).
- `dest.on('close', cleanup)` — NEW.

`cleanup` is a per-pipe closure that removes ALL of the above, plus
itself. Per-pipe identity means sibling pipes' listeners are
untouched.

`unpipe()` also extended to remove `onclose` and `cleanup` from src
and `cleanup` from dest, so explicit unpipes don't leave dangling
listeners.

### Results

**All 5 parked tests pass** on G3. Verified the existing 17 wired
tests + streams_smoke + stream_helpers_smoke + full smoke suite.

Going into pass-9 we had 17 / 22 streams green; we exit at 22 / 22.

Final test count (G3 `make test-all`): **495 passing / 0 failing** (was 490 / 0 in v0.94).

## Half 2 — Express discovery

VERSION bumped to 0.95 (Makefile, process.cpp, README). G3 rebuilt;
G4 and G5 triad-built in parallel and confirmed clean
(see [`build-logs/`](build-logs/)). v0.95 tarballs ready under
`/tmp/ionpower-node-0.95-{g3,g4,g5}-ppc.tar.gz` on each host.

Discovery target on ibookg37 (G3):

    /Users/macuser/tmp/ionpower-node/node \
      /Users/macuser/tmp/npm-6.14.18/run-npm.js \
      install express --registry=https://registry.npmjs.org

Captured at
[`build-logs/express-discovery-v0.95-silly.log`](build-logs/express-discovery-v0.95-silly.log)
(silly log level — more verbose; gives a real stack instead of the
default "cb() never called!" message).

### Gap surfaced — `npm-fetch.body Data error` during registry metadata gunzip

Both default-loglevel and silly runs consistently fail with:

    npm ERR! Invalid response body while trying to fetch
    https://registry.npmjs.org/raw-body: Data error

(`raw-body` is a deep transitive dep of express's body-parser.)

`raw-body` is the FIRST package metadata fetch that fails — the
prior fetches (express, accepts, body-parser, finalhandler, etc.)
succeeded enough to surface the `notsup` warnings about their
newer-than-Node10 versions. Resolution gets several layers deep,
then trips on raw-body's metadata gunzip.

### Triage — bug is NOT in our gunzip or our HTTPS

Three isolation tests, all on G3 with the v0.95 binary, all run
against the same `https://registry.npmjs.org/raw-body` URL:

1. **`curl --compressed` → save to disk → our `zlib.gunzipSync`**
   - 23974 bytes compressed → 117822 bytes decompressed. ✓

2. **Our `https.get` → manual `res.on('data')` collect → `Buffer.concat` → `zlib.gunzipSync`**
   - 23974 bytes received → 117822 bytes decompressed. ✓

3. **Our `https.get` → `res.pipe(zlib.createGunzip())` → `on('data')` collect**
   - 117822 bytes decompressed correctly. ✓

So all three of: TLS layer, our stream engine, our gunzip, and the
res→gunzip pipe topology — each works in isolation.

### Triage — the bug is npm's specific pipe topology

The stack at the moment of failure (from
`build-logs/express-discovery-v0.95-silly.log`):

    npm verb stack FetchError@node-fetch-npm/src/fetch-error.js:30:3
    npm verb stack consumeBody/</<@node-fetch-npm/src/body.js:195:14
    npm verb stack put/<@make-fetch-happen/cache.js:187:23
    npm verb stack pump/destroys</<@pump/index.js:75:7
    npm verb stack eos/onclose@end-of-stream/index.js:48:45
    npm verb stack WriteStream.prototype.destroy@flush-write-stream/index.js:53:3
    npm verb stack destroyer/<@pump/index.js:45:1
    npm verb stack pump/destroys</<@pump/index.js:72:16
    npm verb stack eos/onerror@end-of-stream/index.js:43:3
    npm verb stack put/<@make-fetch-happen/cache.js:175:34
    npm verb stack put/<@make-fetch-happen/cache.js:174:34
    npm verb stack flush@<ionpower-node bootstrap>:6624:30
    npm verb stack _mkInflateTransform/</s.end/<@<ionpower-node bootstrap>:6655:30

make-fetch-happen's `cache.js` `put()` builds a pump-chain that
tees the response: response → gunzip → write-stream (the cache) AND
in parallel response → consumer-stream. So there are TWO consumers
of the same response.body. Per `pump`'s ownership model, the
response is `destroy()`ed when ANY consumer in the chain errors or
ends. When `_mkInflateTransform`'s `s.end()` runs (which decompresses
the buffered chunks at end-of-stream), it errors AND pump's destroy
cascade fires on response.body via end-of-stream's onclose, which
itself triggers `consumeBody` to FAIL — yielding the "Data error".

The frame `_mkInflateTransform/</s.end` plus our flush(self) IS the
proximate error origin in our code. Why does the buffered chunks
decompression fail when isolated tests of the same URL succeed?

Hypothesis (most likely): our `_mkInflateTransform.write` buffers
WHATEVER comes in. In make-fetch-happen's chain, something earlier
in the pipe writes chunks in a different shape than our `pipe` does
in the isolated test. For example, if a chunk is a string
(post-encoding) instead of a Buffer, our `write` does
`Buffer.from(c, enc || 'utf8')` which corrupts binary data.

A pass-9-introduced suspect: our new `push(string)` → Buffer
conversion in `_Readable.prototype.push`. If the response stream
is somehow getting a string chunk pushed (e.g., setEncoding called
on it from elsewhere), the new conversion lands.

Other plausible hypotheses:
- pump's `eos`/destroyer running BEFORE our gunzip's setImmediate
  callback fires, causing the buffered chunks to be partial.
- make-fetch-happen reading the response twice (caching layer)
  and our underlying response stream isn't repeatable.

This needs a focused pass-10 dive: add a debug log in
_mkInflateTransform.write that records chunk-by-chunk byte counts +
types in the npm path. Compare to the curl-bytes-saved-to-disk run.

### Other observations from the discovery run

1. **141 seconds wall time** to reach the failure. Most of it is
   metadata resolution — Cloudflare hits cache, ionpower-node walks
   the dep tree.
2. **`notsup` warnings are loud but harmless** — they correctly
   indicate that newer versions of body-parser / serve-static /
   merge-descriptors / etc. need Node 18+. npm correctly falls back
   to older versions during resolution.
3. **No `node_modules/` created.** Discovery never reached the
   tarball-download phase — the failure is in metadata phase.

### Express discovery — verdict

- Streams conformance pass closed (22/22) ✓
- v0.95 cut clean on all three architectures ✓
- npm install express **does NOT yet work** — blocked on the
  streaming-gunzip Data error during npm's resolve-phase metadata
  fetches.
- The bug is reproducible, narrow (specific to npm's pipe topology),
  and tractable for pass 10.

## Release state

- v0.95 published: <https://github.com/cellularmitosis/ionpower-node/releases/tag/v0.95>
- G4 + G5 tarballs uploaded.
- **G3 tarball is pending.** ibookg37 (the iBook G3) crashed during
  the tarball-pull phase after the build completed. After it came
  back briefly, /tmp had been wiped (the tarball lived there), so
  the rebuild was started. During that rebuild's test phase the
  iBook crashed AGAIN — this time ping responds but sshd is hung
  (banner exchange times out). The G3 binary HAS been built and
  tested clean in this session (see
  [`build-logs/ibookg37-g3-0.95.log`](build-logs/ibookg37-g3-0.95.log)).
  When the host recovers, rebuild + upload:

      scripts/triad-build.sh ibookg37 g3 0.95
      scp ibookg37:/tmp/ionpower-node-0.95-g3-ppc.tar.gz /tmp/
      gh release upload v0.95 /tmp/ionpower-node-0.95-g3-ppc.tar.gz

