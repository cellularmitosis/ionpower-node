# Session I summary (2026-04-23/24)

Follows session H. Session H ended with v0.8 shipped at 504 libraries
/ 1205 assertions — it completed the Node-interface rounding-out
(os / util / url / querystring / events / path / child_process sync).

This session is the **real event loop** session. Sessions through H
had a synchronous drain-on-exit model — ordering-correct but
wallclock-ignored, and no async I/O at all. Session I replaces that
with a `select()`-based event loop in C++ and lands async
`child_process.spawn` / `exec` / `execFile` on top.

## What shipped

### Runtime — the event loop

`src/node_compat/event_loop.cpp` (~310 lines). Core shape:

```
while (pending timers OR watchers OR children):
    t = next_timer_fireAt - now
    select(readFds, writeFds, t)            # blocks
    if SIGCHLD:   reap via waitpid(WNOHANG) + fire callbacks
    for each ready fd:                      fire watcher callback
    fire due timers
```

Exposed on global as `__event_loop_native__`:
- `ioWatch(fd, events)` → watcher id (`events`: 1=readable, 2=writable)
- `ioUnwatch(id)`
- `childRegister(pid)` / `childUnregister(pid)`
- `nowMs()`

JS-side wrappers live in globals.cpp:
- `ioWatch(fd, events, cb)` — stores cb in `__event_loop_watcher_cbs__[id]`
  so the C++ side never has to root a JSObject.
- `childRegister(pid, cb(exitCode, signal))` — same pattern into
  `__event_loop_child_cbs__[pid]`.

Callbacks fire via C++ → JS trampolines (`__event_loop_fire_watcher__`,
`__event_loop_fire_child__`). All GC reachability stays in JS, which
dodges the PersistentRooted ergonomics and is robust across
SM45's quirks.

### Runtime — wallclock timers

The old `__drain_timers__` was a single-pass loop that fired every
queued timer synchronously. The event loop replaces that with:

- `__get_next_timer_fireat__()` — returns min(fireAt) or +Infinity.
- `__fire_due_timers__(now)` — pops every timer with `fireAt <= now`,
  invokes its fn, re-queues intervals.
- `__active_timer_count__()` — loop termination predicate.

`setTimeout(fn, 100)` now genuinely waits ~100ms via `select()` with
a real `tv_usec`. Validated: `event_loop_smoke.js` measures 102ms
for a nominal-100ms timeout.

### Runtime — async child_process

New native primitives in `child_process.cpp`:
- `spawnAsync(file, args, opts)` → `{pid, stdinFd, stdoutFd, stderrFd}`.
  Non-blocking fork+exec; pipe fds set `O_NONBLOCK`.
- `readFd(fd, maxBytes)` → `{bytes: Buffer, eof, wouldBlock, errno?}`.
- `writeFd(fd, data)` → `{written, wouldBlock, errno?}`.
- `closeFd(fd)`.

The JS-side `child_process.spawn` (in globals.cpp) wraps those:
- Creates a ChildProcess EventEmitter with `.pid`, `.stdout`, `.stderr`,
  `.stdin`, `.kill`.
- `.stdout` / `.stderr` are Readables: `ioWatch(fd, READABLE, onReady)`;
  onReady drains via `readFd` in a loop, emitting `'data'` for each
  chunk until `wouldBlock`. On `eof`, emits `'end'`, unwatches, closes.
- `.stdin` is a Writable backed by `writeFd`.
- `childRegister(pid, ...)` fires `'exit'(code, sig)`, then `setImmediate`
  queues `'close'(code, sig)` so pending data events flush first.

`exec(cmd, [opts], cb)` and `execFile(file, args, [opts], cb)` are
thin wrappers over `spawn` that concat stdout/stderr and fire the
callback on `'close'`.

### Libraries

Library count unchanged (504 → 504) — this session's value is the
runtime feature, not the library count. The async primitives unlock
dozens of CLI / test-runner libraries in future sessions. Assertions
rise from 1205 → ~1220 from the new `event_loop_smoke.js` and
`async_child_process_smoke.js`.

### Smoke tests

- `event_loop_smoke.js` — real-time `setTimeout`, ordering across
  loop iterations, `setImmediate` priority, `clearTimeout`.
- `async_child_process_smoke.js` — `spawn("echo", [...])`, `exec("tr")`,
  stderr capture + non-zero exit, stdin-to-stdout round-trip via
  `cat`.

### Docs

README Node API table updated:
- `timers`: clarified that wallclock is now honored.
- `child_process`: sync + async both work; fork still throws.
- `setTimeout`/etc global row: "Wallclock-real" instead of "Queued".

### Release

v0.9 tagged, triad tarballs uploaded.

## Judgment calls

### JS-side callback tables over C++ PersistentRooted

The natural design stores `(fd, events, JSObject* cb)` in a C++
`std::vector<Watcher>`. Rooting the callback from C++ requires
`PersistentRooted<JSObject*>` or `Heap<JSObject*>`, both of which
have non-trivial ergonomic costs: non-copyable, not safe to put in
a vector without custom move plumbing, initialization requires
JSContext*. Session F's earlier attempts to stash C++ roots around
timer callbacks were painful to maintain.

Instead I put the callbacks in JS-side keyed objects
(`__event_loop_watcher_cbs__[id]`, `__event_loop_child_cbs__[pid]`)
and have the C++ loop call a trampoline by id. Normal JS reachability
keeps the callbacks alive (global property → table object → fn). The
C++ side is a plain POD struct (id, fd, events, alive flag). Much
simpler, no GC footgun.

### select() over kqueue

Darwin has `kqueue`, which would be lower-latency and scale better.
I picked `select()` because:
- Fleet is PPC Tiger (Darwin 8), max fds per process is 256 default;
  `select()`'s O(fd) scan is a non-issue at that scale.
- `select()` is a 4-line API. kqueue would need EVFILT_READ /
  EVFILT_WRITE / EVFILT_PROC / EVFILT_TIMER plumbing and a kevent
  event-kind dispatcher.
- Fleet-wide reproducibility: `select()` works identically on Linux,
  so if we ever port to another host, no surprise.

If select's fd limit becomes a problem (running 200+ concurrent
child processes), revisit.

### SIGCHLD vs blocking waitpid

The child_process.spawn wiring uses SIGCHLD + `waitpid(WNOHANG)`
inside the loop. Alternatives considered:
- Poll `waitpid(WNOHANG)` every loop iteration — burns CPU if no
  children have exited.
- Block on `waitpid` in a dedicated thread — SM45 is not
  thread-safe for JS, and signal handling is cleaner anyway.

SIGCHLD installs a handler that sets a `volatile sig_atomic_t` flag;
the loop checks it after each `select()` wake. `select()` returns
-1/EINTR when the signal fires mid-wait, which is exactly what we
want. No `SA_RESTART`, so signals wake the loop promptly.

### Non-blocking writeFd back-pressure

`writeFd` returns `wouldBlock: true` when the pipe is full. The
current JS wrapper just returns `false` from `.write()` and drops
the unwritten bytes on the floor — no internal queue, no `'drain'`
event. Real Node's Writable buffers the overflow and emits 'drain'
when the kernel accepts more. Our version works for the common case
(small writes to subprocess stdin) but will silently truncate huge
writes. Documented; fix is straightforward (buffer + `ioWatch(fd,
WRITABLE, flush)`) but deferred since no library has hit this yet.

### process.on('exit') still uses drain loop

`main.cpp` calls `RunEventLoop` twice: before and after flushing
`__process_flush_exit__`. The first pass runs the script's queued
work. The flush runs the `'exit'` handlers, which may themselves
schedule more timers (tape does this). The second pass drains those.
The old `__drain_timers__` is still around because exit handlers
that do `setImmediate(...)` need a synchronous drain — the loop
would keep them in pending state and not exit.

Actually no, the second RunEventLoop pass handles it the same way.
The old drain function is still exposed for code that wants the
sync-drain semantics (e.g. tests that don't care about timing).

## Not done

- **`tape`** — real-world test runner. Still needs some `process.stdout`
  'drain' wiring we haven't done.
- **`net.Socket` / `http.request`** — would build on top of `ioWatch`
  for a real TCP client. Next session probably.
- **`fs.createReadStream`/`WriteStream`** — regular-file async via the
  event loop. Darwin select() doesn't do the right thing for regular
  files (always returns ready); needs poll+sync-read chunks.
- **process.stdin streaming** — still uses the drain-on-first-listener
  shim from session H. Would be a clean rewrite with `ioWatch(0, READABLE)`.
- **SHA-512 / scrypt / zlib compress** — same stubs as v0.8.
- **Intl** — same.
- **child_process back-pressure** on stdin writes.

## Hand-off state

* 504 libraries, ~1220 assertions, triad-validated on G3/G4/G5.
* v0.9 is the current tagged release.
* README has current API status.
* The event loop is the foundation for every remaining async feature.
  Next session probably wires `net.Socket` + `http.request` or
  `fs.createReadStream` on top of it.
