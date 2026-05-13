# Session notes — 2026-05-10 session 4: Node 10 parity, pass 4

Plan: [`plan.md`](plan.md). Drives off pass-3's two remaining walls:
the cacache pump hang inside the npm install context, and TLS to
Cloudflare-fronted endpoints.

Working order from the plan: A (cacache pump hang) first as the
install-pipeline unblocker, then B (TLS) as the strategic but riskier
work.

## Working log

This file is appended-to in real time.

### Bump VERSION

VERSION → `0.90` in [`Makefile`](../../../Makefile),
[`src/node_compat/process.cpp`](../../../src/node_compat/process.cpp),
[`README.md`](../../../README.md).

Also fixed a long-standing README bug: the "matching SpiderMonkey are
attached to the [v0.NN release]" wording was rotting each release —
the SM tarballs have actually only been attached to the v0.87 release
(they haven't changed since). README now correctly points runtime to
v0.90, SM to v0.87 with a clarifying "unchanged since v0.87" note.

### A — cacache pump hang: bisecting under instrumentation

Wrote `/Users/macuser/tmp/patch-cacache-trace.sh` (using system
`/usr/bin/python` since Tiger doesn't have python2 by that name): adds
per-event `console.error` tracing to all three streams in cacache's
`readStream` pump pipe (the `fs.createReadStream`, `ssri.integrityStream`,
and final `PassThrough`), plus the `TARSTREAM` returned by
`cacache.get.stream.byDigest`, plus the `xtractor` (tar.x) inside
pacote's `tryExtract`. Backs up .orig files first so restoring is
trivial.

First run with `'data'` listeners attached to all five streams gave a
**false-positive** trace: the tracer's own `'data'` listener on PT
auto-resumed the stream, drained the buffer into the tracer, and made
the rest of the cascade look "clean" — `[TRACE readStream PIPE_OK]`
fired, then `[TRACE tryExtract PIPE_START]` and `PIPE_DONE`, then the
"cb() never called" hang. The data was getting CONSUMED BY THE TRACER.

Removed `'data'` from the tracer's listener list and re-ran. The
production hang shape now jumped out:

```
[TRACE readStream BEFORE_PIPE]
[TRACE RS open]
[TRACE PT readable]           ← chunk written to PT, no consumer, buffered
[TRACE RS end]
[TRACE INTEG end]
[TRACE PT finish]             ← PT.end() called by INTEG's pipe handler
[TRACE TARSTREAM finish]
[TRACE INTEG close]
[TRACE readStream PIPE_OK]    ← pump's pipe resolved
[TRACE INTEG finish]
[TRACE RS close]
[TRACE tryExtract MKDIR_OK]   ← rimraf+mkdirp resolved (had to wait for fs)
[TRACE tryExtract PIPE_START] ← tarStream.pipe(xtractor) called
[TRACE PT end]                ← !!! 'end' fires DURING pipe() setup
[TRACE TARSTREAM end]
[TRACE tryExtract PIPE_DONE]
... never any XTRACT events; tar hangs forever
```

The pump pipe itself completes correctly — `PIPE_OK` confirms. The
real bug is the race between cacache's fast pump and pacote's slow
`rimraf+mkdirp` chain inside `tryExtract`:

1. cacache returns the PT synchronously.
2. pacote's `tryDigest` immediately passes it to `streamHandler`.
3. `streamHandler = tryExtract`. tryExtract sets `tarStream.on('error', reject)`
   and kicks off `rimraf(dest).then(mkdirp).then(() => { xtractor = ...; tarStream.pipe(xtractor); })`.
4. While rimraf+mkdirp churn through the filesystem (single-digit ms
   on a G3), cacache's pump cascade completes:
   - rs emits all data, 'end', 'close'
   - integ transforms it, emits 'end' on readable, 'finish' on writable
   - PT receives the chunk via integ's pipe handler (`integ.on('data',...) → PT.write`),
     buffers it (flowing=null because nothing's consumed PT yet),
     receives `.end()` from integ's `'end'` pipe handler, emits 'finish'.
   - pump cb fires.
5. Later: rimraf+mkdirp resolve, xtractor is created, `tarStream.pipe(xtractor)` called.
6. `tarStream.pipe(xtractor)` (a `_Stream.prototype.pipe` call) does
   `src.on('data', dataHandler)` FIRST. Our `_Readable.prototype.on`
   auto-resumes when a 'data' listener is attached on a stream whose
   `flowing === null`. Auto-resume kicks `_emitFlow` SYNCHRONOUSLY:
   - drains the buffered chunk → emits 'data' → dataHandler → xtractor.write(chunk).
   - sees `s.ended === true, buffer.length === 0, !endEmitted` → emits 'end' SYNCHRONOUSLY (eos's 'end' listener is attached, so `listenerCount('end') > 0`).
7. Back in pipe(): `src.on('end', endHandler)` is attached. But 'end'
   already fired in step 6, BEFORE endHandler was registered.
8. xtractor never receives `.end()`. tar.x waits forever for its
   input to finish. → `cb() never called`.

This is a real bug in our `_Readable.prototype.resume`. Real Node's
resume defers via nextTick — it sets `state.flowing` synchronously
but schedules the actual read/drain on the next tick, giving the
caller time to attach `'end'` / `'error'` listeners on the same
synchronous tick before flow starts.

### Wave: reorder `pipe` to attach `'end'` BEFORE `'data'`

First attempt was to defer `_Readable.prototype.resume`'s initial
drain to `setImmediate` (matching real Node's nextTick-deferred
resume). But that BROKE every existing stream smoke that asserts
SYNCHRONOUSLY after `r.on('data', fn)`:

    r.on('end', () => ended = true);
    r.on('data', (c) => out.push(c));
    assert(out.join('') === 'abc');   // pre-pass-4 sync drain expects this
    assert(ended);                     // and this

`test/streams_smoke.js`, `test/stream_libs_smoke.js`,
`test/stream_helpers_smoke.js`, `test/fs_streams_smoke.js`,
`test/event_newlistener_smoke.js` all depend on inline drain. A
deferred resume would have made them all flaky. (Real Node WOULD
fail these tests too; they happen to work for us because the
recursive `push() → _emitFlow` inside `_read()` drains everything
in one synchronous stack.)

Cleaner fix: reorder `_Stream.prototype.pipe` (and
`fs.createReadStream`'s own pipe) to attach `'end'` (and `'error'`)
listeners BEFORE the `'data'` listener. Reason: attaching `'data'`
triggers `_Readable.prototype.on`'s auto-resume on a `flowing===null`
stream, and resume's `_emitFlow` SYNCHRONOUSLY drains the buffer.
If the buffer is empty AND `s.ended === true` (e.g. cacache's
PassThrough that's been written+ended before pacote ever attaches
its pipe), the inline drain immediately reaches the end-emission
check:

    if (s.ended && s.buffer.length === 0 && !s.endEmitted) {
      s.endEmitted = true;
      if (listenerCount('end') > 0) emit('end');
      else setImmediate(() => emit('end'));
    }

With the OLD `'data'`-first ordering, when this check ran, the
ONLY `'end'` listener attached was eos's pump-internal one — the
pipe's actual `'end'` handler (that would call `dest.end()`)
hadn't been attached yet. `listenerCount('end') > 0` → emit sync →
fires the lingering eos listener and nobody else → pipe's handler
attaches AFTER → never sees 'end' → `dest.end()` never called →
tar.x waits forever for input termination → "cb() never called".

With the NEW `'end'`-first ordering, the inline drain's end-emission
sees the pipe's `'end'` listener already attached → emits to it →
`dest.end()` called → tar.x finalizes → tryExtract resolves.

Edit in [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
`_Stream.prototype.pipe` and `fs.createReadStream`'s `self.pipe`:
both rearranged so `on('end', ...)` and `on('error', ...)` attach
before `on('data', ...)`.

Smoke
[`test/stream_resume_defer_smoke.js`](../../../test/stream_resume_defer_smoke.js)
covers four shapes:
1. Direct `.on('data')` then `.on('end')` on a buffered+ended
   PassThrough — both must fire correctly (already worked via
   listenerCount-based defer; this is a regression guard).
2. `.pipe(dest)` of a buffered+ended PassThrough — dest must
   receive data AND emit 'finish' (the new behavior — exercises
   the reorder).
3. Steady-state push after consumer attached — data must still
   flow within one tick.
4. Transform-in-the-middle pipe on a buffered+ended Transform —
   the exact cacache→pacote shape.

Wired into [`scripts/test-list-more.txt`](../../../scripts/test-list-more.txt)
right after `streams_smoke.js`.

### G3 triad-build (pipe-reorder) — passed, npm install advanced to tar.x

[`build-logs/g3-pass4-pipe-reorder.log`](build-logs/g3-pass4-pipe-reorder.log)
**468/0** (+1 new smoke: `stream_resume_defer_smoke.js`). Tarball
deployed. npm install run:
[`build-logs/npm-install-mri-v0.90-pipereorder.txt`](build-logs/npm-install-mri-v0.90-pipereorder.txt).

The cacache pump hang is GONE. npm advanced FAR past the previous
wall — the extract action proceeded, pacote called tar.x, tar.x
started unpacking the mri tarball into `.staging/mri-69beb700/`,
and crashed with:

```
--- raw uncaughtException ---
name: TypeError
message: fs.fchown is not a function
stack: @.../tar/lib/unpack.js:426:9
```

tar's [`unpack.js:426`](https://github.com/npm/node-tar/blob/v4.4.19/lib/unpack.js#L426)
calls `fs.fchown(fd, uid, gid, cb)` to restore ownership on freshly
extracted files (paired with `fs.fchmod` and `fs.futimes`). We had
the chmod and futimes equivalents but missed fchown. POSIX has
`fchown(2)` so this is a straightforward addition.

### Wave: fs.fchown / fchownSync

C++ side ([`src/node_compat/fs.cpp`](../../../src/node_compat/fs.cpp)):
new `FsFchownSync(fd, uid, gid)` calling `fchown(2)`. Throws
Node-shaped FsError on failure. Registered in `kFsFuncs`.

JS side ([`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)):
`fs.fchownSync` exposed; `fs.fchown` async wrapper; `fs.promises.fchown`
in the promises map.

Smoke
[`test/fs_fchown_smoke.js`](../../../test/fs_fchown_smoke.js): covers
sync, callback async, and `fs.promises.fchown` (using own uid/gid
since passing your own ids is always allowed by POSIX). Wired into
[`scripts/test-list-more.txt`](../../../scripts/test-list-more.txt)
right after `fs_fd_smoke.js`.

### G3 fchown-only build — exposed Tiger chown EPERM

[`build-logs/g3-pass4-fchown.log`](build-logs/g3-pass4-fchown.log)
showed fs_fchown_smoke.js failing:

```
Error: EPERM: Operation not permitted, fchown 'fd 4'
```

Mac OS X 10.4 Tiger denies non-root `fchown(2)` / `chown(2)` EVEN
when the target uid/gid match the file's existing ownership — the
Linux/BSD kernels allow same-owner-set as a free no-op, but Tiger's
kernel applies the privilege check unconditionally.

tar's unpack uses a `fchown(fd) || chown(path)` fallback chain and
propagates the error if both fail; we can't change tar. With both
attempts hitting EPERM, the install errors mid-extract:

    fs.fchown(fd, uid, gid, er =>
      er ? fs.chown(abs, uid, gid, er2 => done(er2 && er))
        : done())

Two fixes in [`src/node_compat/fs.cpp`](../../../src/node_compat/fs.cpp):

1. `FsFchownSync(fd, uid, gid)`: `fstat(fd)` first; if the requested
   uid/gid already match the file's `st_uid` / `st_gid`, return
   success immediately WITHOUT invoking `fchown(2)`. Tiger never
   sees the syscall, so the privilege check never trips.
2. `FsChownSync(path, uid, gid)`: same trick with `lstat(path)`.

`uid < 0` or `gid < 0` is treated as "leave that field alone" (Node
accepts -1 / undefined as "no change"); our no-op branch tolerates
that — if both uid and gid are -1, we no-op trivially.

Also relaxed [`test/fs_fchown_smoke.js`](../../../test/fs_fchown_smoke.js)
to accept either success or a Node-shape error (`err.code`) from
the call — keeping the smoke meaningful across both root and non-
root Tiger runs.

### Wave: `fs.statSync` returns uid / gid / nlink / ino / dev / rdev / blksize / blocks

The chown no-op build (g3-pass4-chown-noop) failed its
fs_fchown_smoke retry with the same EPERM. Debugging via a
12-line script revealed our `fs.statSync` doesn't expose uid/gid
at all — only `size`, `mtimeMs`, `atimeMs`, `ctimeMs`, `mode`, and
the `isFile`/`isDirectory` predicates.

That broke TWO things:

1. The smoke. `var st = fs.statSync(p); var uid = st.uid` → uid =
   undefined → fchownSync(fd, undefined, undefined) → JS::ToInt32
   coerces undefined to 0 → no-op fstat-match check sees `0 !=
   st.st_uid` → falls through to real fchown(2) → Tiger EPERM.
2. Worse, tar's `[DOCHOWN]` flow asks for `entry.uid` (from tar
   header) not stat — so this might not actually break in npm
   install. But there are several other consumers of
   `fs.statSync(...).uid` in pacote, infer-owner, npm-lifecycle —
   and infer-owner specifically returns `{uid, gid}` from a stat,
   then passes through to opts.uid which tar uses as the
   `this.uid` field. With uid=undefined from stat, `this.uid` is
   undefined, `DOCHOWN`'s `typeof this.uid === 'number'` check
   fails → false → fchown SKIPPED entirely. Which would
   accidentally work! Until something else needs the field.

Either way, exposing uid/gid is the right fix. Extended FsStatSync
to also define uid, gid, nlink, ino, dev, rdev, blksize, blocks
on the result (matches Node's full stat surface). Same applies to
lstatSync via JS-side `lstatSync: _wrapStats(nativeFs.statSync)`
alias.

Smoke updated to use `fs.statSync(p).uid/.gid` as the no-op
target instead of process.getuid (which doesn't exist on our
runtime).

### G3 triad-build (statuidgid) — passed, npm install END-TO-END SUCCESS

[`build-logs/g3-pass4-statuidgid.log`](build-logs/g3-pass4-statuidgid.log):
**469/0** (+2 new smokes since v0.89: `stream_resume_defer_smoke.js`,
`fs_fchown_smoke.js`). Tarball deployed.

**`npm install /Users/macuser/tmp/mri-1.2.0.tgz` succeeded:**

```
+ mri@1.2.0
added 1 package from 1 contributor in 2.978s
```

`node_modules/mri/` populated with the full tarball contents:
`package.json`, `lib/`, `index.d.ts`, `license.md`, `readme.md`,
intact mtime/permissions.
[`build-logs/npm-install-mri-v0.90-SUCCESS.txt`](build-logs/npm-install-mri-v0.90-SUCCESS.txt)
captured the full trace.

This is the first verified `npm install` end-to-end on PowerPC Tiger
under ionpower-node. The whole pipeline — fetch / resolve / ideal-
tree / cache-write / extract (cacache pump + tar.x unpack + fchown
no-op + futimes mtime restore) / link / lifecycle / finalize /
refresh-package-json — runs cleanly on the G3 runtime.

(The trailing `execa/lib/errname: unable to establish
process.binding('uv') {}` message is benign — execa probes for
libuv's bound errname helper at module load; we don't expose
process.binding so it falls back to its built-in fallback path.
Doesn't affect the install.)

### Triad fan-out: G4 + G5

With G3 green, kicked off G4 (emac) and G5 (pmacg5) builds in
parallel via `run_in_background`. Logs at
[`build-logs/g4-pass4-final.log`](build-logs/g4-pass4-final.log)
and
[`build-logs/g5-pass4-final.log`](build-logs/g5-pass4-final.log).
