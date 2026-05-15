# Session notes — 044: Node 10 parity pass 10 + npm install win

Handoff: [`../043-node-10-parity-pass-9-and-express-discovery/handoff-pass-10.md`](../043-node-10-parity-pass-9-and-express-discovery/handoff-pass-10.md).
Pass-9 notes: [`../043-node-10-parity-pass-9-and-express-discovery/notes.md`](../043-node-10-parity-pass-9-and-express-discovery/notes.md).

## TL;DR

`npm install express` works end-to-end. The blocker the pass-9
discovery surfaced — gunzip "Data error" during npm's metadata fetch
— turned out to be a one-character bug in our embedded tiny-inflate's
uncompressed-block byte-alignment. Fixed; cut v0.96.

`require('express')` itself doesn't yet load (`express@5` uses ES2018
object spread; `express@4`'s deps need V8's CallSite stack-frame API).
Those are the next-pass gaps — see "Carryover".

## The bug

`src/node_compat/zlib.cpp` `tinf_inflate_uncompressed_block` aligns
to a byte boundary by rewinding `sourceIndex` and decrementing
`bitcount` by 8 per buffered byte:

    while (d.bitcount > 8) { d.sourceIndex--; d.bitcount -= 8; }

When `bitcount` is an exact multiple of 8 (e.g. 24), the loop stops
one iteration early — at `bc=8` instead of `bc=0` — leaving
`sourceIndex` one byte past where the LEN low byte actually lives.

Servers that use `Z_SYNC_FLUSH` mid-stream insert empty stored
blocks (`00 00 ff ff`) between compressed chunks. The npm registry
(via Cloudflare) does this. Whether our path runs into the multiple-
of-8 case for any given block depends on the exact bit alignment of
the dynamic-Huffman block immediately preceding the marker. It hit
on `express`, `raw-body`, `react`, `body-parser`, …; it missed on
`lodash`. Random-data gzips never tripped it because they use only
btype=0 blocks with predictable alignment.

The fix: `>= 8` instead of `> 8`. One character.
[`src/node_compat/zlib.cpp`](../../../src/node_compat/zlib.cpp) gets
a fat comment explaining why; the original tiny-inflate had this
same off-by-one, so it's worth flagging clearly so the next person
upstreaming knows what's going on.

This is a real bug in upstream tiny-inflate (foliojs/tiny-inflate),
not just our embedding. We can file an issue once the dust settles.

## How we found it

Documented in detail in
[`debug-trace.md`](debug-trace.md) — the short version is:

1. **Pass-9 handoff hypothesis 1 (push() string→Buffer regression):**
   wrong. The chunks reaching gunzip in npm's path were already
   `Uint8Array`s and never strings.
2. **Pass-9 handoff hypothesis 2 (pump destroy timing):** wrong.
   `s.end`'s setImmediate ran fine; the syncFn itself threw.
3. **Defensive `_origBufferConcat` use in `s.end`:** kept (free
   defense vs minizlib's monkey-patch) but did NOT fix the bug.
4. **First isolation reproducer
   ([`repro-mfh.js`](repro-mfh.js)):** confirmed that one fetch via
   `make-fetch-happen` for `raw-body` *succeeded* — but `express`
   reproducibly *failed*.
5. **Comparison reproducer
   ([`repro-mfh-nocache.js`](repro-mfh-nocache.js)) WITHOUT the
   cache pump-tee:** initially appeared to make express succeed.
   Re-running showed it intermittent — depends on the exact
   compressed payload (the registry's content drifts every few
   seconds as new package versions land).
6. **Standalone capture
   ([`repro-capture-full.js`](repro-capture-full.js)) +
   `gunzipSync(buf)`:** confirmed the bug is content-specific and
   not topology-specific. Same bytes that fail in `gunzipSync`
   succeed via system `gunzip` and via real Node's `zlib.gunzipSync`.
7. **`tinflate-stress.js` over a corpus** of random + JSON +
   registry payloads: random/JSON all OK, registry mixed.
8. **In-tinflate trace:** logged per-block btype + sourceIndex +
   destLen; saw block 3 with btype=0 returning DATA_ERROR.
9. **Per-call bc trace inside `tinf_inflate_uncompressed_block`:**
   block 1 (worked) had pre-rewind `bc=22`, block 3 (failed) had
   pre-rewind `bc=24`. The off-by-one became obvious.

Total time-to-bug: ~1 hour from "what's the failing path" to "fix
landed". The instrumentation pattern (`__dbg`-gated `console.error`
inside hot bootstrap functions) is the right pattern for this kind
of bug — tinflate runs inside an embedded SM script, no debugger,
no source maps.

## Defensive concat fix

While we were at it, `s.end` of both `_mkInflateTransform` and
`_mkDeflateTransform` got changed from `Buffer.concat(chunks)` to
`_origBufferConcat(chunks)` — matches what `_processChunk` already
did. minizlib temporarily monkey-patches `Buffer.concat` to
`(args) => args` and *should* restore it synchronously, but the
`_origBufferConcat` reference is free defense and removes one class
of "what if minizlib's restore doesn't run for some reason". No
behavior change in normal operation.

## Verification

- All 14 core smokes pass on G3. ([`build-logs/ibookg37-g3-0.96-test.log`](build-logs/ibookg37-g3-0.96-test.log))
- All 495 / 0 libs smokes pass on G3 (includes the 22 Node 10 stream
  tests from pass-9). ([`build-logs/ibookg37-g3-0.96-test-libs.log`](build-logs/ibookg37-g3-0.96-test-libs.log))
- `tinflate-stress.js` clean on every payload that previously failed:
  raw-body, express-full, react-full, body-parser-full, ...
  (`OK` lines in [`build-logs/tinflate-stress-after.log`](build-logs/tinflate-stress-after.log))
- **`npm install express` end-to-end on G3, against the live
  registry**: `+ express@5.2.1` after 254s. ([`build-logs/express-install-success.log`](build-logs/express-install-success.log))
- **`npm install express@4`** also clean: `+ express@4.22.2` in 188s.
- Triad-built G3 + G4 + G5 cleanly (per-arch logs in `build-logs/`).

## Carryover for pass 11

### Loading express still hits SM45 syntax + missing-API gaps

Once the install completes, two more things have to land before
`require('express')` runs:

1. **Object spread (`{ ...a, ...b }`)** in
   `node_modules/express/lib/application.js:536`. ES2018; SM45
   doesn't parse it. Either:
   - install `express@4` (last Node-10-era), which avoids the spread
     in core but tickles (2) below, OR
   - run user code through Babel at require-time (we already have
     babel.js shipped with the runtime — wire it into the require
     hook, gated on a parse-error retry).
2. **V8 stack-frame `CallSite` API**:
   `node_modules/depd/index.js:268` calls
   `callSite.getFileName()` / `getLineNumber()` / `isEval()` /
   `getEvalOrigin()` / `getFunctionName()`. We expose
   `Error.captureStackTrace` as a stub, but `Error.prepareStackTrace`
   needs to be honored AND the structured frames need to expose the
   V8 CallSite shape. SM45 has its own stack-frame structure; we'd
   need to wrap it. ~1 day of work.

Either of these on its own won't be enough — depd is a transitive
dep of express@4 (and many other Node-10-era libs). The combined
"express@4 actually loads end-to-end" probably needs both fixed.

### `execa/lib/errname` warning at end of npm install

`execa/lib/errname: unable to establish process.binding('uv') {}`
prints at the end of every install. Cosmetic — install completed
successfully — but worth tracing. Probably wants a stub
`process.binding('uv')` returning the standard errname table.

### `fs.promises.read` / `fs.promises.write` return shape

Still pending since v0.92. Carry forward.

## Release state

- v0.96 published: <https://github.com/cellularmitosis/ionpower-node/releases/tag/v0.96>
- Triad: G3 (ibookg37), G4 (emac), G5 (pmacg5).
- ibookg37 was up the whole session — no spontaneous reboots
  (the mSATA swap is still planned but the host's been more stable
  this week).
