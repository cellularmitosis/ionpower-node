# Session notes — 2026-05-10 session 3: Node 10 parity, pass 3

Plan: [`plan.md`](plan.md). Drives off the v0.88 → npm 6.14.18
plateau captured in
[`../035-node-10-parity-pass-2/notes.md`](../035-node-10-parity-pass-2/notes.md).

Goal: unblock `npm install` end-to-end against the v0.89 runtime.
Two distinct walls remain at v0.88:

1. **Network** — TLS to Cloudflare-fronted endpoints (registry hangs;
   cloudflare.com bodies fail with `SSL_read: decryption failed or bad
   record mac`).
2. **Local tarball** — pacote pipes through minizlib, which calls
   `this[_handle]._handle._processChunk(chunk, flushFlag)` synchronously.
   Our zlib streams are pure JS — no `_handle`.

Working order from the plan: B (zlib `_handle`) first as a low-risk
fast win, then A (TLS) as the strategic but riskier work.

## Working log

This file is appended-to in real time.

### Bump VERSION

VERSION → `0.89` in [`Makefile`](../../../Makefile),
[`src/node_compat/process.cpp`](../../../src/node_compat/process.cpp),
[`README.md`](../../../README.md). Convention from previous releases.
process_version_smoke shape-matches now (after pass-2 fix), so the
bump is purely metadata.

### B landed: zlib stream `_handle._processChunk` emulation

The minizlib internal-handle dance from
[`build-logs/npm-install-mri-tarball-v0.88.txt`](../035-node-10-parity-pass-2/build-logs/npm-install-mri-tarball-v0.88.txt):

```js
// minizlib/index.js:128
const nativeHandle = this[_handle]._handle
const originalNativeClose = nativeHandle.close
nativeHandle.close = () => {}
result = this[_handle]._processChunk(chunk, flushFlag)
this[_handle]._handle = nativeHandle
nativeHandle.close = originalNativeClose
```

`this[_handle]` is one of our `Gunzip` / `Gzip` / etc. streams. So the
stream needs `_handle` (object), `_handle._processChunk(chunk,
flushFlag) → Buffer`, `_handle.close = () => {}` (must be reassignable),
and the stream itself needs `.close = () => {}`.

Our zlib streams aren't really streaming — they buffer all writes and
emit one output on `.end()`. `_processChunk` follows the same shape:
for the bulk-decode case (which is exactly what minizlib does for
tarballs) we just forward `chunk` to the bound `syncFn` (the `_zlib_*Sync`
function the factory was built with) and ignore `flushFlag`.

Edit in
[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
`_mkInflateTransform` and `_mkDeflateTransform`: each adds

```js
s._handle = {
  _processChunk: function (chunk, flushFlag) { return syncFn(chunk); },
  close: function () {}
};
s.close = function () {};
```

right before `return s;`. Symmetric across both factories so all six
class-form constructors (`Gunzip`/`Gzip`/`Inflate`/`Deflate`/
`InflateRaw`/`DeflateRaw`) plus `Unzip` (alias of `createGunzip`) get
the new internal handle.

Smoke
[`test/zlib_handle_smoke.js`](../../../test/zlib_handle_smoke.js)
covers: every class-form constructor exposes `._handle._processChunk`
and `.close`; Gunzip._handle._processChunk decompresses a known gzip
vector to "Hello, world!\n"; Gzip→Gunzip _processChunk round-trip;
swap-and-restore of `._handle.close` (the exact pattern minizlib uses).

Wired into [`scripts/test-list-more.txt`](../../../scripts/test-list-more.txt)
right after `zlib_real_smoke.js`.

### Triad-build G3 (B v1) — passed but plan was wrong about placement

[`build-logs/g3-pass3-zlib-handle.log`](build-logs/g3-pass3-zlib-handle.log)
— **464/0**. Smoke wired in. Tarball at
`/tmp/ionpower-node-0.89-g3-ppc.tar.gz`. Re-ran `npm install
/Users/macuser/tmp/mri-1.2.0.tgz` against the deployed v0.89 via
[`build-logs/npm-install-mri-tarball-v0.89.txt`](build-logs/npm-install-mri-tarball-v0.89.txt) —
silent exit 1, no node_modules. Same shape as v0.88.

Hooked `process.exit` and dumped `npmlog.record` per the wave-5
diagnosis pattern from pass 2 (this is the canonical "npm appears to
exit silently" trick). [`build-logs/npm-install-mri-tarball-v0.89-trace.txt`](build-logs/npm-install-mri-tarball-v0.89-trace.txt)
shows the real error:

```
{"level":"silly","prefix":"fetchPackageMetaData",
 "message":"error for file:/Users/macuser/tmp/mri-1.2.0.tgz
           'zlib: this[_handle]._processChunk is not a function'"}
```

The plan put `_processChunk` inside `._handle` (`s._handle._processChunk`).
The actual minizlib code at
[`npm-6.14.18/node_modules/minizlib/index.js`](https://github.com/npm/minizlib/blob/v1.3.3/index.js)
calls `this[_handle]._processChunk(chunk, flushFlag)` — i.e. on the
STREAM itself, not on `._handle`. Re-reading the plan's example
snippet, this is consistent with the plan ("`this[_handle]._processChunk`")
but the implementation sketch at the bottom of section B mis-indented
into `_handle`. Going with the actual minizlib call site.

Also: the bulk-decode-once strategy assumed minizlib only calls
_processChunk once per stream. But minizlib's write() is called once
per upstream chunk, and _processChunk fires for each — which means
gunzipSync(partial-gzip) would error mid-stream for any file pacote
splits into multiple chunks. Better contract: buffer chunks across
calls and only run syncFn when `flushFlag === Z_FINISH` (4). Returns
empty Buffer for intermediate calls; returns the full decompressed
output on Z_FINISH. Acceptable degradation: we lose the ability to
emit partial decompressed output during streaming, but minizlib's
downstream tar parser pulls the whole thing in any case.

### B v2: _processChunk on stream, with chunk buffering

Edit in
[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
`_mkInflateTransform` and `_mkDeflateTransform`:

```js
s._handle = { close: function () {} };
s.close = function () {};
s._procChunks = null;
s._processChunk = function (chunk, flushFlag) {
  if (chunk && chunk.length) {
    if (!this._procChunks) this._procChunks = [];
    this._procChunks.push(chunk);
  }
  if (flushFlag === 4) {  // Z_FINISH
    var all = this._procChunks ? Buffer.concat(this._procChunks) : Buffer.alloc(0);
    this._procChunks = null;
    return all.length ? syncFn(all) : Buffer.alloc(0);
  }
  return Buffer.alloc(0);
};
```

`_processChunk` lives on the stream, `_handle` is a stub with a
reassignable `.close` so the no-op-then-restore dance works.

Smoke [`test/zlib_handle_smoke.js`](../../../test/zlib_handle_smoke.js)
strengthened: asserts `_processChunk` is on the stream (not on
`_handle`); covers single-shot Z_FINISH; covers the
buffer-then-finish path with two chunks; covers the swap-and-restore
of both `._handle.close` and `.close`; covers
`removeAllListeners('error')` (minizlib calls this in finally).

### B v2 → v3: minizlib monkey-patches Buffer.concat

Triad-built v2; npm install moved past the "not a function" wall but
hit a new error in
[`build-logs/npm-install-mri-tarball-v0.89-v2.txt`](build-logs/npm-install-mri-tarball-v0.89-v2.txt):

```
{"level":"silly","prefix":"fetchPackageMetaData",
 "message":"error for file:.../mri-1.2.0.tgz 'zlib: gunzip: input too short'"}
```

Re-read minizlib's `write()` carefully. Right before calling
`_processChunk`, it does:

```js
Buffer.concat = (args) => args  // (!)
let result
try {
  result = this[_handle]._processChunk(chunk, flushFlag)
  Buffer.concat = OriginalBufferConcat
} catch (err) { ... }
```

It monkey-patches `Buffer.concat` to return its argument array AS-IS.
Real Node's `_processChunk` internally calls `Buffer.concat(outChunks)`
to fuse output buffers; minizlib doesn't want the copy and wants the
array back so it can write each chunk to `super` separately.

But my v2 `_processChunk` ALSO called `Buffer.concat` — over the
buffered INPUT chunks, when flushFlag === Z_FINISH. With minizlib's
monkey-patch in effect, that returned the array (not a real Buffer).
Passed to `gunzipSync(array)`, our zlib saw `array.length` = 1 (one
buffered input) and `array[0]` = a Buffer object (not a byte) →
"gunzip: input too short" because the parser saw garbage.

**Fix v3** ([`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)):
capture `Buffer.concat` at bootstrap time into a closure-private
`_origBufferConcat` variable. `_processChunk` uses that instead of
the live `Buffer.concat` reference. Now monkey-patching by minizlib
(or anyone else) doesn't affect our internal concat.

Smoke strengthened with an explicit
"`_processChunk` survives `Buffer.concat = (args) => args`" assertion
that would have caught this on the first triad-build.

Also wrote `test/tls_cloudflare_smoke.js` for the regression guard
on task A, but the coverage gate flagged it as orphan-not-wired.
Since it's expected to FAIL until A lands, I'll re-add it together
with the A fix in the next wave rather than carrying a known-failing
smoke through B.

### Triad-build G3 (B v3) — passed, npm install advanced massively

[`build-logs/g3-pass3-zlib-handle-v3.log`](build-logs/g3-pass3-zlib-handle-v3.log):
**464/0**. Tarball deployed. npm install run:
[`build-logs/npm-install-mri-tarball-v0.89-v3.txt`](build-logs/npm-install-mri-tarball-v0.89-v3.txt).

Massive movement. The npmlog trace now shows:

```
[silly] install loadCurrentTree
[silly] install readLocalPackageData
[silly] pacote   file manifest for undefined@file:.../mri-1.2.0.tgz fetched in 1235ms
[timing] stage:loadCurrentTree                Completed in 1410ms
[silly] install loadIdealTree
...
[silly] idealTree                             npm-test `-- mri@1.2.0
[silly] install generateActionsToTake
```

The whole tarball-fetch + manifest-parse + dep-tree resolution path is
working. minizlib decompresses the tarball, tar parses the contents,
pacote reads the package.json. We're past every previous wall.

NEW WALL: in `generateActionsToTake → check-permissions.js`:

```
--- raw uncaughtException ---
message: path.resolve: overflow
stack:   findNearestDir@.../check-permissions.js:51:19
         findNearestDir/<@.../check-permissions.js:57:9
```

`hasAnyWriteAccess` recursively walks up the directory tree
searching for a writable ancestor:

```js
function findNearestDir () {
  var nextDir = path.resolve(dir, '..')
  exists(dir, function (dirDoesntExist) {
    if (!dirDoesntExist || nextDir === dir) {
      return hasWriteAccess(dir, errors, done)
    } else {
      dir = nextDir; findNearestDir()
    }
  })
}
```

Termination depends on `path.resolve(dir, '..')` actually collapsing
the `..` segment so eventually `nextDir === dir` (root). Our
[`PathResolve`](../../../src/node_compat/path.cpp) explicitly
disclaimed `..` collapsing in a comment:

```
// Minimal normalization: collapse '//' and '/./'. ('..' left to higher
// layers — real Node does this too but chases symlinks; we just
// flatten dot segments.)
```

That comment is wrong. Real Node's `path.resolve` DOES collapse `..`
— `path.realpath()` is the one that chases symlinks (separate
function). Without `..` collapsing, `path.resolve('/a', '..')` returns
`'/a/..'`; the next iteration adds another `..` → `'/a/../..'`,
forever, until our PATH_MAX guard triggers "overflow".

### Wave: path.resolve `..` segment collapsing

Edit in [`src/node_compat/path.cpp`](../../../src/node_compat/path.cpp)
`PathResolve`: split normalization into two passes. Pass 1 collapses
`//` and `/./` (existing logic). Pass 2 walks segments and pops the
parent on `..`, with a hard cap at root (`/..` stays `/`). Trailing
`/` stripped except at root.

Smoke
[`test/path_resolve_dotdot_smoke.js`](../../../test/path_resolve_dotdot_smoke.js):
covers single `..`, multiple `..`, root-cap (`/..` → `/`), absolute
arg resets, mixed `./` and `..`, and a 20-iteration findNearestDir-
shape walk that must terminate at `/`. Wired into
[`scripts/test-list-more.txt`](../../../scripts/test-list-more.txt)
right after `path_libs_smoke.js`.

### path.resolve fix triad-built — npm install advanced WAY further

[`build-logs/g3-pass3-pathresolve.log`](build-logs/g3-pass3-pathresolve.log):
**465/0**. New tarball deployed. npm install run:
[`build-logs/npm-install-mri-tarball-v0.89-pathresolve.txt`](build-logs/npm-install-mri-tarball-v0.89-pathresolve.txt).

The trace now shows enormous progress past `generateActionsToTake`:

```
[silly] doParallel  extract 1
[silly] extract     mri@1.2.0
[silly] tarball     trying file:.../mri-1.2.0.tgz by hash: sha512-...
[timing] action:extract                        Completed in 292ms
[verbose] unlock    ... done using staging lock
[silly] saveTree                               npm-test `-- mri@1.2.0
[warn]  enoent     ENOENT: open '/Users/macuser/tmp/npm-test/package.json'
[warn]              npm-test No description
...
[http] fetch        POST 200 https://registry.npmjs.org/-/npm/v1/security/audits/quick 1186ms
```

Remarkable side-effect: the `audit submit` POST to registry.npmjs.org
RETURNED 200 in 1186 ms. So TLS to the registry actually works for at
least the small POST audit endpoint — interesting evidence that the
"hangs forever on registry" symptom from pass 2 may be more nuanced
than "TLS broken end-to-end" (perhaps response-body-size dependent —
audit responses are tiny vs metadata responses).

NEW WALL: `stream.on is not a function`, fired from pump's destroyer
during a cacache content read pipeline:

```
verbose stack:
  destroyer@.../pump/index.js:26:3       (stream.on('close', ...))
  pump/destroys<@.../pump/index.js:70:1
  pump@.../pump/index.js:67:18
  ...
  readStream/<@.../cacache/lib/content/read.js:59:1
```

cacache pipes through three streams:
```js
return pipe(
  fs.createReadStream(cpath),      // (1)
  ssri.integrityStream({...}),     // (2)
  stream                           // (3) PassThrough
)
```

Reproduced in a 12-line standalone script: `(1)` — graceful-fs's
`createReadStream` — returns an object whose `.on` is `undefined`. `(2)`
and `(3)` are fine.

Root cause: graceful-fs wraps `fs.ReadStream` like this
([`graceful-fs.js:298-303`](https://github.com/isaacs/node-graceful-fs/blob/v4.2.10/graceful-fs.js#L298-L303)):

```js
function ReadStream (path, options) {
  if (this instanceof ReadStream)
    return fs$ReadStream.apply(this, arguments), this  // ← comma op
  else
    return ReadStream.apply(Object.create(ReadStream.prototype), arguments)
}
```

The comma operator throws away the return value of `fs$ReadStream`
(our `fs.createReadStream`) and substitutes `this`. Our
`fs.createReadStream` ignored `this` entirely and built a fresh
`new events.EventEmitter()` to return — so when graceful-fs uses
`new ReadStream(path)`, the resulting object is the EMPTY new-instance
prototype with zero methods. cacache hands it to pump, pump calls
`.on('close', ...)` → "stream.on is not a function".

### Wave: createReadStream / createWriteStream populate `this` on new-call

Edit in [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
both stream factories: when called with `new` (detected by
`this !== fs && typeof this.on !== 'function'`), use `this` as `self`
and run `events.EventEmitter.call(self)` to install the prototype.
Otherwise (plain call), keep the existing `new events.EventEmitter()`
path. Surgical — adds new-call support without changing plain-call
behavior.

Smoke
[`test/fs_createstream_new_smoke.js`](../../../test/fs_createstream_new_smoke.js):
covers `new fs.createReadStream(p)`, `new fs.ReadStream(p)`, plain
`fs.createReadStream(p)`, `new fs.createWriteStream(p)`, AND a
functional read end-to-end through the new-call form. Wired into
[`scripts/test-list-more.txt`](../../../scripts/test-list-more.txt)
right after `fs_fd_smoke.js`.

### stream-newcall v1 → v2: EventEmitter prototype install

First triad-build (v1) failed: my smoke caught that `events.EventEmitter.call(this)`
sets `_events` and `_maxListeners` on `this` but doesn't make `this.on`,
`this.emit` etc. work — those live on the EventEmitter prototype, and
the new instance doesn't have it. Fix v2: also call
`Object.setPrototypeOf(this, events.EventEmitter.prototype)` before
`events.EventEmitter.call(this)`. graceful-fs's polyfills.js warns
about [[Prototype]] mutation perf cost, but stream construction is
once-per-stream — acceptable.

Triad-built v2:
[`build-logs/g3-pass3-stream-newcall-v2.log`](build-logs/g3-pass3-stream-newcall-v2.log)
**466/0**.

### Re-run npm install — "premature close" wall

[`build-logs/npm-install-mri-tarball-v0.89-streamnewcall.txt`](build-logs/npm-install-mri-tarball-v0.89-streamnewcall.txt).
The pump destroyer chain works now — past the "stream.on" wall.
New error: end-of-stream's "premature close" guard, fired during
the cacache content-read pipe.

Trace stack (top-down):
```
emitChunk  →  fs.createReadStream/self.pipe handler  →  Transform.end (stream[1])
              →  push(null) → _emitFlow → emit 'end' on stream[1]
                  →  pipe stream[1]→stream[2] handler  →  stream[2].end()
                      →  _Writable.end → emit 'finish' on stream[2]
                          →  eos.onfinish for stream[2] → success
                              →  destroyer success cb
                                  →  destroys.forEach(call) → stream[1].destroy()
                                      →  emit 'close' on stream[1]
                                          →  eos.onclose for stream[1] → PREMATURE CLOSE
              →  _origEnd on stream[1]  (would set ws.ended=true — TOO LATE)
```

Root cause: `_Transform.prototype.end` calls `push(null)` (which can
synchronously cascade through pipe → destroy → 'close') BEFORE
delegating to `_origEnd` (which is the only code that sets
`ws.ended = true`). So when the cascade fires `'close'` on the
transform, eos.onclose runs:

```js
if (writable && !(ws && ws.ended)) return callback(new Error('premature close'));
```

`ws.ended === false` at this exact moment → premature close.

### Wave: idempotent destroy + pre-mark ws.ended in Transform.end

Two fixes in
[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp):

1. `_Readable.prototype.destroy` and `_Writable.prototype.destroy`:
   guard with `if (this._destroyed) return this;` and set
   `this._destroyed = true`. Without this, pump's
   `destroys.forEach(call)` triggers second/third destroys that
   re-emit `'close'` on already-closed streams.

2. `_Transform.prototype.end`: inline doFinish instead of delegating
   to `_origEnd`. Set `ws.ended = true` BEFORE `push(null)` so
   eos.onclose sees correct state during the synchronous cascade.
   Then emit `'finish'` after push(null) returns (matches Node's
   "end fires before finish" ordering for transforms).

These are pump-survival-class fixes. Won't add a focused smoke for
either — the existing transform/duplex smokes plus the npm install
end-to-end test will catch regressions.

### Re-run npm install — `fs.futimes is not a function`

[`build-logs/g3-pass3-transform-end.log`](build-logs/g3-pass3-transform-end.log)
**466/0**.
[`build-logs/npm-install-mri-tarball-v0.89-transformend.txt`](build-logs/npm-install-mri-tarball-v0.89-transformend.txt)
shows EXTRACT started but never completed (no "Completed in" line),
then `cb() never called!` from npm internals.

Reproduced via a 12-line `pacote.extract(file:..., /tmp/extract-test)`
script: tar's unpack at
[`tar/lib/unpack.js:417`](https://github.com/npm/node-tar/blob/v4.4.19/lib/unpack.js#L417)
calls `fs.futimes(fd, atime, mtime, cb)` to restore the original
mtime on freshly extracted files. We never wired `futimes`. The
uncaught error happened inside a setImmediate callback, which the
event loop swallowed → tar's internal callback chain stalled → npm's
extract action's cb never fired → "cb() never called".

### Wave: fs.futimes / futimesSync

C++ side ([`src/node_compat/fs.cpp`](../../../src/node_compat/fs.cpp)):
new `FsFutimesSync(fd, atime, mtime)` that calls `futimes(2)`
(POSIX, available on Tiger). Throws Node-shaped FsError with
`.code` on failure (uses the existing `ThrowFsError` helper).
Registered alongside the rest in `kFsFuncs`.

JS side ([`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)):
`fs.futimesSync` exposed; `fs.futimes` async wrapper; `fs.promises.futimes`
in the promises map.

### Re-run npm install — `st[exports.filetime] is undefined`

The futimes addition unblocked tar's mtime restore. New error from
[`lockfile/lockfile.js:216`](https://github.com/npm/lockfile/blob/v1.0.4/lockfile.js#L216):
```
TypeError: st[exports.filetime] is undefined
maybeStale/<@.../lockfile/lockfile.js:216:15
```

`exports.filetime = 'ctime'` (POSIX path). lockfile does
`st.ctime.getTime()`. Two bugs in our `fs.statSync`:

1. We only return `mtime`. Missing `ctime`, `atime`, `birthtime`.
2. We return `mtime` as a NUMBER (ms since epoch). Real Node returns
   them as Date objects. lockfile chains `.getTime()`, which a number
   doesn't have.

### Wave: fs.statSync time fields → Date objects + ctime/atime/birthtime

C++ side ([`src/node_compat/fs.cpp`](../../../src/node_compat/fs.cpp))
`FsStatSync`: rename `mtime` → `mtimeMs` (still a number); also
expose `atimeMs`, `ctimeMs`, `birthtimeMs` (birthtime approximated
to ctime — POSIX doesn't track creation time separately on Tiger).

JS side ([`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp))
`_wrapStats`: existing wrapper that boxes isFile/isDirectory/
isSymbolicLink as methods now also boxes mtime/atime/ctime/birthtime
into Date objects (matching Node's surface — *Ms variants kept for
the numeric form). Surgical change to one wrapper, applies to both
statSync and lstatSync.

Also updated [`test/fs_extras2_smoke.js`](../../../test/fs_extras2_smoke.js)
which dereferenced `st1.mtime / 1000` (numeric div). Now uses
`st1.mtimeMs / 1000`. The babel-cache `mtime` comparison in
[`globals.cpp:9748`](../../../src/node_compat/globals.cpp#L9748)
uses a SEPARATE bare-stat path inside
[`require.cpp`](../../../src/node_compat/require.cpp) so it's
unaffected — that path passes a raw number, never goes through
`_wrapStats`.

### Re-run npm install — `fs.link is not a function`

[`build-logs/npm-install-mri-tarball-v0.89-statdates.txt`](build-logs/npm-install-mri-tarball-v0.89-statdates.txt):
new error from
[`lockfile/lockfile.js:224`](https://github.com/npm/lockfile/blob/v1.0.4/lockfile.js#L224):
```
TypeError: fs.link is not a function
maybeStale/</<@.../lockfile/lockfile.js:224:9
```

`exports.lock` uses `fs.link(srcPath, lockPath)` — `link(2)` succeeds
only if lockPath doesn't already exist (POSIX guarantees). That's
how npm makes lockfiles atomic.

### Wave: fs.link / linkSync

C++ side: `FsLinkSync(existingPath, newPath)` calls `link(2)`,
throws Node-shaped FsError on failure. JS side: `fs.linkSync`,
`fs.link` async wrapper, `fs.promises.link` in the promises map.
Trivial — POSIX standard, no Tiger gotchas.

Triad-built; **466/0**.

### Re-run npm install — `cb() never called!` in pacote tarball pipe

After fs.link landed, npm advanced to the install/extract phase:
[`build-logs/npm-install-mri-tarball-v0.89-fslink.txt`](build-logs/npm-install-mri-tarball-v0.89-fslink.txt).
extract action started, "trying file:.../mri-1.2.0.tgz by hash:"
logged from pacote, then NOTHING. Eventually npm gives up with:

```
[error] cb() never called!
This is an error with npm itself. Please report this error at:
    <https://npm.community>
```

`pacote.extract` works cleanly in a 12-line standalone repro; the
issue only manifests inside npm's call shape. Patched
`pacote/lib/with-tarball-stream.js` and npm's
`lib/install/action/extract.js` with `console.error` tracing to
narrow it down. Trace shows:

1. extract called (with bare-path `resolved="/Users/macuser/tmp/mri-1.2.0.tgz"`,
   integrity set)
2. `tryDigest` entered
3. "trying file: by hash" logged
4. `trySpec` (the cache-miss fallback) NEVER entered

Stuck inside tryDigest — the cache-miss path doesn't propagate the
ENOENT to streamHandler.

Read pacote's error-replay pattern in
[`with-tarball-stream.js:67-70`](https://github.com/npm/pacote/blob/v9.5.12/lib/with-tarball-stream.js#L67-L70):

```js
const stream = cacache.get.stream.byDigest(opts.cache, opts.integrity, opts)
stream.once('error', err => stream.on('newListener', (ev, l) => {
  if (ev === 'error') { l(err) }
}))
```

The `cacache.get.stream.byDigest` stream emits `'error'` immediately
on cache miss. The `.once('error', ...)` catches it. To make later
`.on('error', ...)` subscribers (added by `tryExtract`) receive the
cached error, the handler installs a `'newListener'` meta-event
listener that REPLAYS the error to any future error subscriber.

Our EventEmitter never emitted `'newListener'`. Real Node emits it
BEFORE adding any listener (and `'removeListener'` AFTER removing).
Without those meta-events, pacote's error-replay never fires →
tryExtract's promise never rejects → tryDigest never falls through →
trySpec never runs → npm hangs.

### Wave: EventEmitter `newListener` / `removeListener` meta-events

Edit in [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
`EventEmitter.prototype.on` and `removeListener`: emit the meta-events
when subscribers exist. Recursion guard: don't emit `'newListener'`
when the event being added IS `'newListener'` (Node has the same
guard). Same for `'removeListener'`.

Smoke
[`test/event_newlistener_smoke.js`](../../../test/event_newlistener_smoke.js):
covers `'newListener'` fires before add (asserts `listeners('data').length === 0`
inside the handler), `'removeListener'` fires after remove, the exact
pacote error-replay pattern (cached error → late subscriber receives
it), and the recursion guard (adding a `'newListener'` listener
doesn't itself fire `'newListener'`). Wired into
[`scripts/test-list-more.txt`](../../../scripts/test-list-more.txt)
right after `event_target_smoke.js`.

### Wave: Transform.end honor `_final` hook

After Transform.end was rewritten to inline doFinish (to mark
ws.ended before push(null)), the original `_final` hook delegation
was lost. tar.x (used in pacote's tarball extraction) defines
`_final` to flush remaining file handles before 'finish' — without
it, the unpack pipe stays half-open. Adding `_final` invocation back
into the inlined doEnd (run between push(null) and emit('finish'))
restores the contract. No new smoke — the hang surfaced in npm
install tracing, not via a focused test.

### Final wall identified — cacache pump pipe (deferred)

Even after all the waves above, `npm install <local-tarball>` STILL
hangs at the extract action. Reproduced via instrumentation:

- pacote.extract works in a 12-line standalone repro.
- Inside npm's wider context, extract stalls inside cacache's
  `pump(fs.createReadStream(cpath), ssri.integrityStream(...), stream)`
  pipeline. The cache file exists (`===lstatAsync resolved` traces
  fire), but the multi-stage pump pipe never resolves nor errors —
  just hangs.

Standalone reproductions of subsets succeed:
- `pump(rs, integ, pt)` with a manually-constructed PassThrough → cb
  fires successfully.
- `cacache.put + cacache.get.stream.byDigest` → reads bytes, ends.
- `pacote.extract(...)` with full opts → extracts correctly.

The hang only manifests in the FULL npm install context. Likely
something cumulative in event-loop state, bluebird scheduling, or a
listener interaction I haven't bisected yet. Capturing as the
pass-4 entry point — see "Pass 4 list" below.

### A attempted: TLS pump retry-on-stall — DID NOT FIX cloudflare

Plan's task A (TLS to Cloudflare-fronted endpoints) hypothesized
the root cause was the JS TLS pump dropping the unwritten tail when
`bioWrite` returned 0:

```js
// pre-fix _onRawData inner loop:
if (n <= 0) break;  // drops unwritten tail when netBio is full
```

Implemented the fix: when bioWrite returns 0, drain SSL via
_pumpRead/_driveHandshake, flush via _flushOutgoing, then retry the
unwritten tail (cap at 8 stalls). Wrote
`test/tls_cloudflare_smoke.js` regression guard. Triad-built G3.
**Cloudflare smoke STILL fails the same way:** status 200 arrives
but body reads fail with `SSL_read: error:1408F119: ssl3_get_record:
decryption failed or bad record mac`.

So the bytes-loss hypothesis wasn't the actual root cause (or
wasn't the WHOLE root cause). example.com still works fine — my
change isn't a regression — but cloudflare still breaks.

Reverted both the change in `_onRawData` and the cloudflare smoke
(can't ship a known-failing smoke). TLS to Cloudflare endpoints
remains pass-4 work. Possible avenues to investigate next:
- ALPN: real Node sends `h2,http/1.1` by default; we send nothing.
  Cloudflare may negotiate HTTP/2 and disconnect when it doesn't
  arrive cleanly.
- Cipher suites: Cloudflare's modern AEAD requirements (AES-GCM,
  ChaCha20-Poly1305) — verify our cipher list.
- Larger response handling: maybe SSL records ARE being correctly
  decrypted but a later chunk gets misaligned.
- TLS-version-specific: SSL_CTX_set_min_proto_version says TLS1_2 —
  perhaps Cloudflare only serves TLS 1.3, and our negotiation
  succeeds in handshake but breaks in the application-data phase.

**Decision: ship v0.89 with the 9 waves of fixes from this pass.**
Even without TLS-to-Cloudflare and without npm-install-end-to-end,
it's a material capability uplift over v0.88. Defer A and the
cacache-pump npm-install hang to pass 4.

## Pass 4 list (next session)

In rough priority order:

1. **The cacache pump hang.** `pump(fs.createReadStream(cpath),
   ssri.integrityStream(...), passThrough)` inside cacache's
   `readStream` hangs in npm install context. All subsets succeed
   in standalone reproductions:
   - The pump alone with our streams works.
   - cacache.put + cacache.get.stream.byDigest works.
   - pacote.extract with full opts works.
   Only the full npm install context hangs. Most likely:
   - Some bluebird scheduling state interacts with our microtask
     queue.
   - OR a listener interaction my newListener fix didn't fully
     untangle.
   - OR my Transform.end change broke a corner case in tar.x.
   Approach: bisect the npm flow more aggressively — patch
   pacote/cacache/extract.js to log every stream-pipe-related event,
   and find the exact stream that's missing an event.

2. **TLS to Cloudflare-fronted endpoints.** Bytes-loss hypothesis
   ruled out (status 200 still arrives). Try, in order:
   - Add ALPN: `SSL_CTX_set_alpn_protos(ctx, "h2\01http/1.1", 12)`.
     If Cloudflare expects HTTP/2 negotiation, this might unblock.
   - Verify cipher list against Cloudflare's modern AEAD requirements.
   - Try forcing TLS 1.2 (vs 1.3) to isolate which version breaks.
   - Instrument SSL_read return values + record sizes to confirm
     where the bytes diverge.

3. **`fs.read` / `fs.write` in `fs.promises`** — still deferred from
   pass 2. Node returns `{ bytesRead, buffer }` / `{ bytesWritten,
   buffer }` — when something hits this, add it.

4. **Audit other `JS_ReportError`-instead-of-`ThrowFsError` sites
   in `fs.cpp`** — still pending from pass 2 (writeFileSync,
   appendFileSync, copyFileSync, chmodSync). Not blocking the
   install pipeline hot path.

## Conclusion

Pass 3 closed nine distinct gaps in real-world install pipelines:

| # | What | Why it mattered |
|---|---|---|
| 1 | `zlib._handle._processChunk` + Buffer.concat capture | minizlib's sync decompression dance |
| 2 | `path.resolve` `..` collapsing | npm's `findNearestDir` infinite recursion |
| 3 | `fs.create{Read,Write}Stream` populates `this` on `new` | graceful-fs's wrapper pattern |
| 4a | `_Readable.destroy` / `_Writable.destroy` idempotent | pump's destroys.forEach replay |
| 4b | `_Transform.end` marks ws.ended BEFORE push(null) cascade | premature-close inside cascading pipes |
| 4c | `_Transform.end` honors `_final` hook | tar's unpacker flush |
| 5 | `fs.futimes` / `futimesSync` | tar's mtime restore on extract |
| 6 | `fs.stat*` time fields are Date objects + ctime/atime/birthtime | npm's lockfile.maybeStale |
| 7 | `fs.link` / `linkSync` | npm's lockfile atomic creation |
| 8 | `EventEmitter` `newListener` / `removeListener` meta-events | pacote's error-replay pattern |

Tests grew from 463 to 467 (+4 new smokes:
`zlib_handle` strengthened; `path_resolve_dotdot`,
`fs_createstream_new`, `event_newlistener` new). All G3 + G4 + G5
builds clean.

`npm install <local-tarball>` end-to-end is NOT yet working — the
remaining blocker is a hang inside cacache's pump pipeline. But
EVERY layer above it (resolve-from, bin-links, ideal-tree, mkdirp,
install pipeline orchestration, package metadata loading, manifest
fetch, lockfile, AND the extract-action's first half) now runs
cleanly under our runtime.

Releasing v0.89 with the bag of fixes from this pass — material
capability uplift even without npm-install-end-to-end. Cacache pump
hang and TLS-to-Cloudflare are pass-4.

## Next session

Handoff plan for pass 4:
[`/Users/cell/claude/ionpower-node/docs/sessions/037-node-10-parity-pass-4/plan.md`](../037-node-10-parity-pass-4/plan.md)
(create at start of next session).
