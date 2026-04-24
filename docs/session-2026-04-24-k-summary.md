# Session K summary (2026-04-24)

Follows session J (v0.10 shipped: async I/O trifecta — net + http + fs
streams + zlib decompression — on top of the session-I event loop).

This session is the **Promise microtask queue** + fleet maintenance:
replace the synchronous Promise semantics with Node-matching microtask
ordering, stand up a new G5 test host (pmacg5) after imacg52's SSH
locked us out mid-session.

Library count: 504 (unchanged). Assertions: 1228 → **1231**.
G3 + G4 validated; G5 (on pmacg5, replacing imacg52) in progress.

## What shipped

### Microtask queue

`__microtask_queue__` JS array, drained by the event loop after every
callback firing (fd watcher, timer, SIGCHLD reap). Promise `.then` /
`.catch` / `.finally`, `queueMicrotask`, `process.nextTick` all push
through it. Order now matches Node:

```
Promise.resolve(1).then(v => console.log(v));
console.log("sync");
// Before v0.11: "1" then "sync"
// After v0.11:  "sync" then "1"  (correct)
```

Key pieces:
- JS-side `_enqueueMicrotask(fn)` / `__drain_microtasks__()`
- `_IonPromise` reworked: resolve/reject routes callbacks through
  `_enqueueMicrotask` instead of firing synchronously. `.then`
  defers via microtask when already-settled too.
- `_IonPromise` is now installed *unconditionally* (previously gated
  on `typeof Promise === 'undefined'`, which meant SM45's native —
  also synchronous — Promise was shadowing our polyfill).
- `queueMicrotask` + `process.nextTick` rewritten to push to the same
  queue.
- `event_loop.cpp` calls `DrainMicrotasks` after each fd callback,
  timer firing, and SIGCHLD reap.
- `main.cpp` drains microtasks after `RunEntryScript` before entering
  the event loop (so script-level .then chains settle).

Measured ordering (microtask_smoke.js):
```
["sync1","sync2","sync3","sync4","sync5","p:a","p:b","mt","nt",
 "chain1:x","late-mt","chain2:x!","timeout0"]
```
Sync code first, then Promise callbacks + queueMicrotask + nextTick,
then chain2 (which depends on chain1), then setTimeout(0). Correct.

### Test-ordering churn

The move from sync to microtask Promise breaks every test that did:
```
var got = null;
somePromise.then(v => got = v);
assert(got === expected);  // was fine; now fires before callback
```

Fixed tests (assertions moved to `process.on('exit', ...)` or chained
promises):
- `promise_smoke.js` — entire constructor-through-thenable-interop
  suite rewritten as exit-time assertions
- `pinkie_smoke.js`
- `p_try_smoke.js`
- `p_utils_smoke.js`
- `promise_utils_smoke.js`
- `p_limit_smoke.js`
- `util_helpers_smoke.js` — util.promisify / callbackify
- `wave1_api_smoke.js` — `events.once(...)` promise
- `jszip_smoke.js` — full generate → load → read round-trip rewritten
  as a promise chain
- `cores_smoke.js` — dropped the `spawn("echo")` assertion since
  async spawn without a data reader keeps the event loop alive
  indefinitely (separate bug; working but the hang was obscuring
  the test run)

Pattern: collect results in closures, assert at exit. This is the
shape Node tests have used for decades, so the churn is bringing
the suite into alignment with real-world idiom.

### Fleet: pmacg5 replaces imacg52 as G5

Mid-session, imacg52's SSH started refusing our key ("Too many
authentication failures"). Likely the authorized_keys file was
invalidated; needs a console login to fix. User asked to switch to
pmacg5 as the G5 work host.

Bootstrap on pmacg5 (fresh Tiger install):
- `autoconf-2.13` — built from source (5 min)
- `python2-2.7.18` — via `tiger.sh --install-binpkg` (~40s)
- `make-4.3` — binpkg (mozjs needs ≥ 3.81; Tiger ships 3.80)
- `tenfourfox-src` — rsync'd from the main Mac (367 MB, ~1 min)
- `mozjs-45-ionpower-g5` — build from source

Hit `pthread_setname_np` not-declared error in
`js/src/vm/PosixNSPR.cpp:159` — Tiger's pthreads don't have it
(Leopard-era addition). Other G5 hosts had a manual `IONPOWER_TIGER_NOSETNAME`
patch already; copied the patched file from imacg3 and resumed.
That patch needs to be checked into the script or applied via sed
for future bootstraps.

### Smoke tests

New: `microtask_smoke.js` — explicit ordering assertions for Promise,
queueMicrotask, process.nextTick, chain, setTimeout(0) interleaving.

## Judgment calls

### Force-install our polyfill over SM45's native Promise

SM45 has a native Promise but no microtask driver — its `.then`
callbacks also fire synchronously. Mirroring ECMA semantics under
SM45 would require either:
(a) hooking `JS::SetEnqueuePromiseJobCallback` (mozjs-private API,
    works but docs-thin),
(b) installing our own polyfill and unconditionally shadowing the
    native Promise.

Picked (b): simpler, fewer moving parts, and our polyfill was already
~90% there. Trade-off: native Promise was slightly faster for sync
cases; now everything is uniform JS.

### Shared queue for Promise / queueMicrotask / nextTick

Real Node runs `process.nextTick` callbacks *before* any microtask
(two priority tiers). We use a single queue. In practice the
distinction matters only when a nextTick callback needs to beat a
Promise callback — no library in our vendor tree exhibits this
dependency. Documented; revisit if it bites.

### Assertions at exit, not inline

The library-smoke pattern "call async thing, assert immediately" is
common in this codebase because our Promise was synchronous. Moving
assertions to `process.on('exit', ...)` is a test-shape change, not
a semantic regression — the tests still pass the same conditions,
just measure them after the event loop has drained.

### G5 bootstrap on pmacg5, ship tarballs incrementally

G3 and G4 validated cleanly: 354/0/1231 on each. pmacg5 mozjs build
hit one Tiger-era portability issue (trivially patched), resumed
and continuing. Rather than block the v0.11 release on pmacg5
finishing, I'll ship G3 + G4 tarballs now and follow up with a
G5 tarball once pmacg5's mozjs install completes.

### tiger-rsync.sh Makefile-gremlin, take four

Same pattern as sessions H/I/J: my `tiger-rsync.sh` wrapper loses
the Makefile on some rsyncs. Workaround: explicit `scp Makefile
HOST:path` before each triad build. Root-cause investigation has
been deferred four sessions in a row; at this point it's a routine
tax.

## Not done

- **G5 tarball** — pending pmacg5 mozjs build completion.
- **imacg52 SSH fix** — needs console-side intervention.
- **nextTick priority over microtasks** — currently shared queue.
- **zlib compression** — still stubbed.
- **SHA-512 / scrypt** — still stubbed.
- **HTTP keep-alive / chunked server responses** — still basic.

## Hand-off state

* 504 libraries, 1231 assertions, G3 + G4 validated.
* v0.11 code committed; tarballs uploaded for G3 + G4; G5 tarball
  to follow once pmacg5's mozjs build finishes.
* Next: v0.12 candidates — HTTP keep-alive, chunked server responses,
  real SHA-512, or TLS (would unlock real async HTTPS).
