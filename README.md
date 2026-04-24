# ionpower-node

![](docs/media/ionpower-node.jpg)

A Node.js-compatible JavaScript runtime for 32-bit PowerPC Mac OS X
10.4 (Tiger), built on top of the JIT-enabled SpiderMonkey that ships
in [TenFourFox](https://github.com/classilla/tenfourfox). We reuse
IonPower — TenFourFox's hand-written 32-bit PowerPC backend for
SpiderMonkey's Ion and Baseline JITs — and layer a small Node-shaped
bridge on top (CommonJS `require`, `console`, `process`, a sync
`fs`, `path`, and a Buffer shim).

## Status

**Pre-alpha.** Phase 1 of the plan in [docs/plan.md](docs/plan.md) is
in progress. The SpiderMonkey library is being built on imacg52
(G5) from the TenFourFox source tree. The Node-compat C++ bridge
source is written against the SpiderMonkey 45 JSAPI but not yet
linked/tested because the library is still building.

See [docs/build-notes.md](docs/build-notes.md) for a running log
of what we had to discover to configure the build on Tiger.

See [docs/status-report.md](docs/status-report.md) once available.

## Why

A useful JavaScript runtime on PowerPC needs a working JIT. Writing
a new 32-bit PPC JIT is weeks to months of work. TenFourFox already
ships one — `js/src/jit/osxppc/` in their tree is a complete
Baseline + Ion backend, production-tested via real Firefox browsing
on PPC through FPR32. This project piggybacks on that investment.

We are **not** re-implementing Node.js. We implement just enough of
Node's public surface to run simple CommonJS programs end-to-end.

## Layout

```
docs/           Design docs, build notes, status reports.
external/       Upstream source references (sparse-checked-out).
  tenfourfox/   Mozilla tree containing js/src/, js/public/, mfbt/, ...
scripts/        Scripts shipped to fleet hosts.
  build-autoconf-213.sh     Build autoconf 2.13 into /opt on a Tiger host.
  build-mozjs.sh            Configure+build standalone SpiderMonkey.
src/            C++ bridge source for the runtime.
  main.cpp                  Entry point: JS_Init, runtime, global, run.
  node_compat/              Node-shaped API surface.
    console.cpp             console.log/error/warn/info/debug.
    process.cpp             process.argv/env/cwd/exit/platform/...
    fs.cpp                  fs.readFileSync/writeFileSync/statSync/...
    path.cpp                path.join/dirname/basename/resolve/...
    buffer.cpp              Buffer.from/alloc over Uint8Array.
    require.cpp             CommonJS require() with relative resolution.
    globals.{cpp,h}         Install/wire it all onto the global.
Makefile        Target-host build rules (needs a built mozjs).
test/           Smoke tests: hello, require_chain, fs_smoke, jit_smoke.
```

## Build (target: imacg52)

```bash
# 1) Prereqs on the Tiger host (one-shot):
ssh imacg52 'tiger.sh python2-2.7.18'
scp scripts/build-autoconf-213.sh imacg52:/Users/macuser/tmp/
ssh imacg52 '/Users/macuser/tmp/build-autoconf-213.sh'

# 2) Ship the source:
~/bin/tiger-rsync.sh --delete --exclude=.git \
    external/tenfourfox/ imacg52:/Users/macuser/tmp/tenfourfox/

# 3) Build SpiderMonkey (takes hours on a G5, many more on a G3):
scp scripts/build-mozjs.sh imacg52:/Users/macuser/tmp/
ssh imacg52 'nohup /Users/macuser/tmp/build-mozjs.sh > /Users/macuser/tmp/build-mozjs.log 2>&1 &'

# 4) Build the bridge:
~/bin/tiger-rsync.sh --exclude=.git . imacg52:~/tmp/ionpower-node/
ssh imacg52 'cd ~/tmp/ionpower-node && make'

# 5) Run:
ssh imacg52 'cd ~/tmp/ionpower-node && ./node test/hello.js'
```

## Scope limits

Sync only. No event loop yet, so no `setTimeout`, no async `fs`.
No node_modules traversal; only relative paths for `require`. No
native addons. No `http`/`net`/`dns`/`child_process`. See
`docs/plan.md` for the explicit scope.

## Node API implementation status

A live accounting of which parts of the Node API the runtime
implements, approximates, or explicitly stubs. Updated as each
release lands.

### Core modules

| Module | Status | Notes |
|---|---|---|
| `fs` (sync) | ✅ Working | `readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`, `statSync`, `lstatSync` (alias), `unlinkSync`, `mkdirSync` (+ recursive), `rmdirSync`, `appendFileSync`, `copyFileSync`, `chmodSync`, `renameSync`, `realpathSync` (passthrough). Errors carry Node-style `.code`/`.errno`/`.syscall`/`.path`. |
| `fs` (async) | ✅ Working | Callback-style `readFile`/`writeFile`/`readdir`/`stat`/`lstat`/`unlink`/`mkdir`/`rmdir`/`rename`/`appendFile`/`copyFile`/`chmod`/`access`/`realpath`/`exists`. Each wraps the sync version + fires the callback via the timer queue. |
| `fs.promises` | ✅ Working | Promise-wrapped version of every callback form. |
| `fs.constants` | ✅ Working | `F_OK`/`R_OK`/`W_OK`/`X_OK`/`O_RDONLY`/`O_WRONLY`/`O_RDWR`. |
| `fs.createReadStream`/`WriteStream` | ❌ Missing | Would need streaming to/from OS fd; sync fs covers most CJS use. |
| `path` | ✅ Working | `join`, `resolve`, `normalize`, `dirname`, `basename`, `extname`, `relative`, `parse`, `format`, `sep`, `delimiter`, `isAbsolute`. |
| `os` | ✅ Working | `platform` (`darwin`), `arch` (`ppc`), `type`, `release`, `version`, `machine`, `endianness` (`BE`), `homedir`, `tmpdir`, `hostname`, `cpus`, `uptime`, `loadavg`, `freemem`, `totalmem`, `userInfo`, `networkInterfaces` (empty stub), `EOL`, `devNull`, `availableParallelism`, `constants.signals/errno/priority`. |
| `events` | ✅ Working | `EventEmitter` with `on`/`once`/`off`/`emit`/`addListener`/`removeListener`/`removeAllListeners`/`listenerCount`/`listeners`/`rawListeners`/`eventNames`/`prependListener`/`prependOnceListener`. Module exports `events.once(emitter, name)` (Promise), `events.getEventListeners`, `events.setMaxListeners`, `events.defaultMaxListeners`. |
| `util` | ✅ Working | `format`, `inspect` (depth-limited, cycle-safe), `inherits`, `promisify` (+ `.custom`), `callbackify`, `deprecate`, `types.*`, `isDeepStrictEqual`, `stripVTControlCharacters`, `parseArgs`, `TextEncoder`/`TextDecoder`, plus all the legacy `isX` predicates. |
| `buffer` | ✅ Working | `Buffer` class: `from` (string/array/Buffer/ArrayBuffer), `alloc`, `allocUnsafe`, `isBuffer`, `concat`, `byteLength`, `compare`, `isEncoding`. Instance: `toString`, `slice`, `write`, `copy`, `fill`, `indexOf`, `includes`, `equals`, `.length`. |
| `crypto` | 🟡 Partial | `randomBytes` (real entropy), `pseudoRandomBytes`, `randomUUID` (v4), `randomInt`, `createHash` (**md5/sha1/sha224/sha256**), `createHmac` (md5/sha1/sha224/sha256), `pbkdf2Sync`/`pbkdf2` across those, `timingSafeEqual`, `createSecretKey`, `getHashes`, `getCiphers`. No SHA-512 (needs 64-bit emulation), no `createCipheriv`, no `sign`/`verify`, no `scrypt` (stubs throw). |
| `http` | 🟡 Partial | Sync-only `getSync`/`requestSync` for simple GET. No `createServer`, no async request. |
| `https` | 🟡 Partial | Alias of `http` (curl handles both). |
| `net` | ❌ Missing | Would need sockets + event loop. |
| `dns` | ❌ Missing | |
| `child_process` | ✅ Working | All sync + async variants except `fork`. `execSync`/`spawnSync`/`execFileSync` via blocking fork+waitpid. `spawn`/`exec`/`execFile` return a `ChildProcess` (EventEmitter) backed by the event loop — `.stdout`/`.stderr` are Readables, `.stdin` is Writable, emits `'exit'`(code,sig) then `'close'`. |
| `stream` | ✅ Working | Real `Readable` / `Writable` / `Duplex` / `Transform` / `PassThrough` with buffering, `.pipe()`, `.read([n])` / `.push(chunk)` / `.end()`. `stream.pipeline()` and `stream.finished()` also implemented. Backpressure is nominally modeled but collapses to always-drained under the sync runtime; pipe auto-resumes whenever a `'data'` listener is added. |
| `string_decoder` | ✅ Working | `StringDecoder` over Buffer-to-UTF-8 with partial-multibyte buffering across `.write()` calls. |
| `querystring` | ✅ Working | `parse`/`stringify` with custom sep/eq, array-valued keys, `escape`/`unescape`/`encode`/`decode`. |
| `url` | ✅ Working | Legacy `parse` (full URL object shape), `format`, `resolve`, `fileURLToPath`, `pathToFileURL`, plus WHATWG `URL`/`URLSearchParams` globals. |
| `assert` | ✅ Working | `equal`, `strictEqual`, `notEqual`, `notStrictEqual`, `deepEqual`, `deepStrictEqual`, `throws`, `doesNotThrow`, `fail`, `ok`, `AssertionError`. |
| `timers` | ✅ Working | `setImmediate`/`setTimeout`/`setInterval` + matching clears enqueue into the event loop. `select()`-based loop blocks until the next `fireAt` (real wallclock), wakes on fd events or `SIGCHLD`, then fires due timers. `setTimeout(fn, 100)` really does wait ~100ms. Intervals re-queue themselves. |
| `tty` | 🟡 Stub | `ReadStream`/`WriteStream` exported as EE-derived stubs. |
| `module` | ❌ Missing | No `createRequire`, no `Module` class. |
| `worker_threads` | ❌ Missing | |
| `cluster` | ❌ Missing | |
| `zlib` | 🟡 Stub | `createGzip`/`createGunzip`/`createDeflate`/`createInflate` + their sync/async variants all throw a clear "not implemented" error. `zlib.constants.*` exported so library probes succeed. Real implementation deferred (needs pure-JS inflate/deflate or a native binding). |

### Globals

| Global | Status | Notes |
|---|---|---|
| `process` | ✅ Working | `argv`, `env`, `cwd`, `exit`, `exitCode`, `platform`, `arch`, `version`, `versions` (`node`/`ionpower`/`spidermonkey`/`v8`), `release`, `pid`, `stdout`/`stderr`/`stdin` (all with `.fd`/`.isTTY`; `stdin` is a Readable that drains `/dev/stdin` on first `'data'` listener), `nextTick` (synchronous), `umask`, `hrtime` (+ `.bigint`), `uptime`, `title`, `memoryUsage` (zero-filled), event-emitter surface (`on`/`once`/`off`/`emit` including `'exit'` flush). |
| `Buffer` | ✅ Working | See `buffer` above. |
| `console` | ✅ Working | `log`/`error`/`warn`/`info`/`debug`/`trace`/`dir`/`time`/`timeEnd`/`assert`. |
| `Promise` | ✅ Polyfill | **Synchronous** Promise (no microtask queue): executor + `.then`/`.catch`/`.finally` chains run inline. `Promise.resolve`/`reject`/`all`/`race`/`allSettled`. |
| `queueMicrotask` | ✅ Synchronous | Runs the callback immediately via `Promise.resolve().then(fn)`. |
| `setTimeout`/`setInterval`/`setImmediate` | ✅ Wallclock-real | Enqueue into the event loop; `select()` honors the next fireAt. `setTimeout(fn, N)` sleeps ~N ms before firing. Intervals self-requeue. |
| `TextEncoder`/`TextDecoder` | ✅ Working | UTF-8 only. |
| `URL`/`URLSearchParams` | ✅ Polyfill | Covers protocol/host/hostname/port/pathname/search/hash/origin/href + username/password, plus search-params get/getAll/has/set/append/delete/forEach/keys/values/entries/toString/sort. Not spec-complete for IDN / non-special schemes / exotic relative resolution. |
| `crypto` (WebCrypto) | 🟡 Partial | `crypto.getRandomValues`, `crypto.randomUUID`, `crypto.subtle` absent. |
| `fetch` | ❌ Missing | No async. |
| `AbortController`/`AbortSignal` | ❌ Missing | |
| `atob`/`btoa` | ✅ Working | |
| `Error.captureStackTrace` | ✅ Shim | Attaches `.stack` as an own property so error-ex / json-parse-even-better-errors work. |
| `globalThis` / `global` / `window` / `self` | ✅ All aliased | Any of the four resolves to the global object. |
| `Intl` | ❌ Missing | SM45 was built `--without-intl-api`. Blocks luxon, ICU-dependent date/number formatters. |
| `Symbol`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Proxy`, `Reflect`, typed arrays | ✅ Native | SpiderMonkey 45 provides these. |

### CommonJS

| Surface | Status | Notes |
|---|---|---|
| `require('./rel/path.js')` | ✅ Working | |
| `require('./rel/path')` | ✅ Working | Tries `.js`, `.cjs`, then `<dir>/package.json` main. |
| `require('./rel/data.json')` | ✅ Working | Parsed and returned. |
| `require('bare-module')` node_modules walk | ✅ Working | Standard upward search. |
| `require('bare-module')` vendor fallback | ✅ Working | If node_modules lookup fails, walks caller's dir up looking for `<ancestor>/<name>.js` or `<ancestor>/vendor/<name>.js`, plus global dirs (`cwd/test/vendor`, installed `share/ionpower-node/vendor`). Lets unpatched libraries' bare `require('chalk')` etc. resolve to vendored copies. |
| `require('node:fs')` prefix | ✅ Stripped | `node:` prefix stripped before lookup. |
| Seeded core modules | ✅ Working | `__require_cache__` pre-populated with fs / path / events / util / child_process / os / crypto / buffer / string_decoder / assert / stream / timers / querystring / supports-color / has-ansi / process. |
| ESM `import`/`export` | 🟡 Via Babel | Bootstrap lazily loads `@babel/standalone` on parse failure and re-evaluates the ESM-lowered source. Handles `import X from "y"`, `export default`, `export { X }`. Does **not** handle top-level `await`, dynamic `import()`, or `import.meta`. Cached on disk at `~/.ionpower-cache/babel-v1/`. |
| `import.meta` | ❌ Missing | |
| Top-level `await` | ❌ Missing | No async context. |
| Dynamic `import()` | ❌ Missing | |

### Compat shims seeded as fake packages

| Package | Provided | Why |
|---|---|---|
| `supports-color` | Built-in | Chalk family loads at runtime and reflects our `process.stdout.isTTY` + `TERM`. |
| `has-ansi` | Built-in | Predicate for strings containing SGR sequences. |
| `safe-buffer` | Built-in | Re-exports our Buffer (the real lib polyfills older Node). |
| `cli-boxes` | Vendored JSON + shim | Data-only; the `.js` wrapper reads `cli-boxes.json`. |

### Library count

Running total of third-party libraries with a passing smoke test:
**504** as of [v0.9](https://github.com/cellularmitosis/ionpower-node/releases/tag/v0.9).
Full suite: **1220+** assertions across 367 smoke files.

The full roster is the `test/*_smoke.js` + `test/vendor/*.js` trees;
see each smoke for exactly which surface the library exercises.
