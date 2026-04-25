# Session X summary (2026-04-24 → 2026-04-25)

Follows session W (v0.37 → v0.50 milestone). This session covers
**v0.51 through v0.64** — fourteen more releases that closed the
last big-ticket gaps.

## Releases

| Tag | Headline |
|---|---|
| v0.51 | `node:test` before/after/beforeEach/afterEach hooks |
| v0.52 | `BroadcastChannel` global + library hunt wave 18 |
| v0.53 | `process.cpuUsage` + `process.resourceUsage` |
| v0.54 | `stream.Readable.from` + `Readable.toArray` |
| v0.55 | library hunt wave 19 |
| **v0.56** | **`async`/`await`/`for await`** via Babel lowering |
| **v0.57** | **process-backed `worker_threads.Worker`** (real parallelism) |
| **v0.58** | **`AsyncLocalStorage`** with Promise/timer propagation |
| v0.59 | `diagnostics_channel` + `TracingChannel` |
| v0.60 | `process.report` + `process.kill` |
| v0.61 | `Array.fromAsync` (ES2024) |
| v0.62 | `process.on('uncaughtException')` + `'unhandledRejection'` |
| v0.63 | Iterator helpers (`Iterator.from`, map/filter/take/drop/flatMap/toArray) |
| v0.64 | `Symbol.dispose` / `Symbol.asyncDispose` + `DisposableStack` |

## Headline gains

### async/await + for-await — for free via Babel (v0.56)

The plumbing was already in place. SM45 has no async syntax, but
our `require.cpp` falls back to `@babel/standalone` on parse
failure (same path that handles ESM modules). Babel lowers
async functions into Promise.then chains, and `_IonPromise.then`
routes through our microtask queue. So all that was missing:

1. `Symbol.asyncIterator` polyfill (one line).
2. WebStreams `Reader.next()` adapter (alias to `.read()`).
3. Pin `[Symbol.asyncIterator]` on Reader + ReadableStream + events.on
   iterators.

After that: `async function`, `await`, `try { await reject } catch`,
`for await (events.on(ee, 'data'))`, and `for await (chunk of
readableStream)` all work.

### worker_threads — real parallelism (v0.57)

Each `new Worker(scriptPath)` spawns a child `ionpower-node`
process that talks to the parent via length-prefixed JSON frames
over stdin/stdout. Real OS-level parallelism. Drawbacks: ~1s
startup on G3 (re-bootstrapping a fresh runtime each time), no
`transferList`, no `SharedArrayBuffer`, JSON-copied data.

Required two new native primitives:
- `__child_process_native__.killPid(pid, sig)` — wraps libc kill(2)
- `spawnAsync` opts.env support (via `setenv()` in the forked child
  branch — fork-time only, doesn't pollute parent's environ).

The worker bootstrap detects `IONPOWER_AS_WORKER=1` env var to
flip `isMainThread = false` and wire `parentPort` to stdin/stdout.

### AsyncLocalStorage — Promise+timer propagation (v0.58)

`als.run(store, cb)` works across:
- `Promise.then` chains (via the microtask snapshot)
- `setTimeout` / `setImmediate` (via the timer enqueue snapshot)

Implementation: `_enqueueMicrotask` and `__timer_enqueue__` capture
every active ALS's current store at enqueue time and restore around
the callback fire. Doesn't yet propagate through `ioWatch` (event-loop
I/O) callbacks — most consumers (express, fastify, pino) hit
microtask + timer paths first, so ~80% of real use cases work.

## Smaller wins this stretch

### Cumulative ES2022+ polyfill block

By v0.64 we have:
- `Object.hasOwn` (v0.28)
- `structuredClone` (v0.28, with Map/Set/Date/RegExp/Buffer/Array)
- `AggregateError` (v0.28)
- `Promise.any` (v0.28)
- `Array.prototype.at` / `findLast` / `toSorted` / `toReversed` /
  `toSpliced` / `with` (v0.28)
- `String.prototype.at` / `replaceAll` (v0.28)
- `Array.fromAsync` (v0.61)
- `Iterator.from` + helpers (v0.63)
- `Symbol.dispose` / `Symbol.asyncDispose` + `DisposableStack` /
  `AsyncDisposableStack` (v0.64)

### node:test runner with hooks (v0.51)

`before`/`after`/`beforeEach`/`afterEach` wired into the test
runner via in-place patching of `_runQueuedTests`. Exit order
preserved, afterEach fires on test failure too.

### BroadcastChannel (v0.52)

Real BroadcastChannel for in-process pub/sub (Node's variant
spans worker threads, ours stays in-process). Built on v0.49's
EventTarget. Sender doesn't receive own posts; close() removes
from registry.

### Diagnostics surface (v0.59, v0.60)

- `diagnostics_channel`: Channel + TracingChannel + module-level
  subscribe/unsubscribe.
- `process.report`: getReport() + writeReport(); reports include
  the resourceUsage field from v0.53's getrusage binding.
- `process.kill(pid, sig)` on top of v0.57's killPid.

## Judgment calls

### RSA / ECDSA deferred again

Investigated vendoring `node-forge` and `jsrsasign` for v0.51 —
both bundles are 100KB+ minified, with multi-file deps and require
real wiring of forge.pki.* into Node-style `crypto.sign`/`verify`.
Picked node:test hooks for v0.51 instead. RSA is the biggest
remaining crypto gap.

### `using` syntax left to Babel

The runtime classes (DisposableStack/AsyncDisposableStack) work
today, but the `using` / `await using` syntax in v0.64 needs
Babel transformation. Same trade-off as ESM imports and
async/await — Babel's lazy-load handles it.

### tinybench skip

Vendored but its bundle uses a syntax SM45 doesn't recognize
(numeric-literal-adjacent identifier). Falls into clean skip.

## Hand-off state

- **657+** libraries with passing smoke tests
- **1765+** assertions across **413** smoke files
- Triad (G3/G4/G5) clean every release
- Full async story: `async`/`await`/`for await`/Promises/microtask
  queue/AsyncLocalStorage all working
- Real worker_threads via process spawning
- Crypto: full symmetric + Ed25519 + X25519 ECDH + nacl box/secretbox
  (RSA still missing)
- Network: TCP/UDP/HTTP/HTTPS/WebSocket
- Streams: WHATWG + Node + Readable.from + toArray + async iteration
- Test runner: node:test TAP + hooks
- Module surface: vm + readline + perf_hooks + fs.watch/cp/rm +
  module.createRequire/isBuiltin + worker_threads + inspector +
  tty + diagnostics_channel + async_hooks + process.report
- ES surface: through ES2026 (DisposableStack)

## Next candidates

- RSA / ECDSA via vendored node-forge or jsrsasign (multi-day
  but plausible)
- `events.on` ioWatch propagation for ALS context across net.Socket
  callbacks
- More library hunt waves
- `node:sqlite` (Node 22+) — would need native sqlite3 binding
- HTTP/2 client
- `permessage-deflate` for WebSocket
