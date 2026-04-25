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
| `fs.createReadStream`/`WriteStream` | ✅ Working | `createReadStream(path, {highWaterMark, encoding, start, end})` emits `'open'`/`'data'`/`'end'`/`'close'`. `createWriteStream(path, {flags})` supports `'w'` (write) / `'a'` (append); flushes on `.end()`. Whole-file-in-memory under the hood — not truly streaming to disk, but fine for realistic file sizes on Tiger-era kit. `.pipe()` works. |
| `path` | ✅ Working | `join`, `resolve`, `normalize`, `dirname`, `basename`, `extname`, `relative`, `parse`, `format`, `sep`, `delimiter`, `isAbsolute`. |
| `os` | ✅ Working | `platform` (`darwin`), `arch` (`ppc`), `type`, `release`, `version`, `machine`, `endianness` (`BE`), `homedir`, `tmpdir`, `hostname`, `cpus`, `uptime`, `loadavg`, `freemem`, `totalmem`, `userInfo`, `networkInterfaces` (empty stub), `EOL`, `devNull`, `availableParallelism`, `constants.signals/errno/priority`. |
| `events` | ✅ Working | `EventEmitter` with `on`/`once`/`off`/`emit`/`addListener`/`removeListener`/`removeAllListeners`/`listenerCount`/`listeners`/`rawListeners`/`eventNames`/`prependListener`/`prependOnceListener`. Module exports `events.once(emitter, name)` (Promise), `events.getEventListeners`, `events.setMaxListeners`, `events.defaultMaxListeners`. |
| `util` | ✅ Working | `format`, `inspect` (depth-limited, cycle-safe), `inherits`, `promisify` (+ `.custom`), `callbackify`, `deprecate`, `types.*`, `isDeepStrictEqual`, `stripVTControlCharacters`, `parseArgs`, `TextEncoder`/`TextDecoder`, plus all the legacy `isX` predicates. |
| `buffer` | ✅ Working | `Buffer` class: `from` (string/array/Buffer/ArrayBuffer), `alloc`, `allocUnsafe`, `isBuffer`, `concat`, `byteLength`, `compare`, `isEncoding`. Instance: `toString`, `slice`, `write`, `copy`, `fill`, `indexOf`, `includes`, `equals`, `.length`. |
| `crypto` | ✅ Working | `randomBytes` (real entropy), `pseudoRandomBytes`, `randomUUID` (v4), `randomInt`, `createHash` (**md5/sha1/sha224/sha256/sha384/sha512**), `createHmac` across all of those, `pbkdf2Sync`/`pbkdf2` across all of those, `scryptSync`/`scrypt` (RFC 7914), `createCipheriv`/`createDecipheriv` (**AES-128/192/256 in CBC / CTR / GCM**; NIST SP 800-38A F.2.5 / F.5.5 + NIST GCM Test Case 3 vectors verified; PKCS#7 padding for CBC; setAAD/setAuthTag/getAuthTag for GCM), `hkdfSync`/`hkdf` (RFC 5869 across all hashes; TC1 verified), `timingSafeEqual`, `createSecretKey`, `getHashes`, `getCiphers`. No `sign`/`verify` (asymmetric). |
| `http` | ✅ Working | Real async `http.request`/`http.get`/`http.createServer` on top of `net.Socket` + an in-house HTTP/1.1 parser. Content-Length and chunked Transfer-Encoding on both sides. Server supports auto-chunked responses (stream `.write()` without Content-Length) and keep-alive pipelining. `IncomingMessage` / `ServerResponse` / `ClientRequest` classes present. Sync `http.getSync`/`postSync` retained (curl-backed, handles HTTPS). |
| `https` | 🟡 Partial | Async `https.request`/etc falls back to the sync curl shim (TLS without OpenSSL binding). |
| `dns` | ✅ Working | `lookup` / `resolve` / `resolve4` / `resolve6` / `promises.lookup` via `gethostbyname` (blocking under the hood; called from event-loop `setImmediate`). MX/TXT/CNAME/SRV/NS `resolve*` return empty arrays for compatibility. |
| `net` | ✅ Working | `net.Socket` (Duplex over event-loop `ioWatch`) + `net.createServer` / `createConnection`. BSD-socket primitives via `__net_native__`: `socketCreate`/`bind`/`listen`/`accept`/`connect` non-blocking. IPv4 only; `gethostbyname` for DNS. |
| `dgram` (UDP) | ✅ Working | `dgram.createSocket('udp4')` / `Socket#bind` / `send` / `close`. `'message'` / `'listening'` / `'error'` / `'close'` events. Receives via `ioWatch(fd, READABLE)` + `recvfrom`; sends via `sendto`. IPv4 only; auto-binds to an ephemeral port if `.send()` is called before `.bind()`. |
| `readline` | ✅ Working | `createInterface({ input, output })`, `'line'` / `'close'` events, `.question(prompt, cb)` (one-shot), `.pause`/`.resume`/`.close`, `.setPrompt`/`.prompt`. Cursor helpers (`cursorTo`, `moveCursor`, `clearLine`, `clearScreenDown`) emit ANSI CSI when the target stream is a TTY, no-op otherwise. |
| `node:test` / `test` | ✅ Working | Minimal TAP runner. `test(name, fn)`, `test.skip`/`test.todo`, async test functions, nested `t.test(sub, fn)`, `t.diagnostic(msg)`. Registers on import, runs on next tick, prints `TAP version 13` + plan + ok/not-ok + fail counts. Sets `process.exitCode = 1` on any failure. |
| `ws` / `WebSocket` | ✅ Working | RFC 6455 client (`new WebSocket(url)` — browser-style `.onopen`/`.onmessage`/`.onclose`/`.onerror`) + server (`require('ws').WebSocketServer({ port, host })`). Text + binary frames, ping/pong autorespond, close-frame handshake. Server and client share frame encode/decode; client frames are masked per spec. `ws://` only — no TLS (`wss://`) yet. |
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
| `zlib` | ✅ Working | Real RFC 1951 inflate via embedded tiny-inflate. Deflate in "stored" mode (uncompressed blocks with valid deflate framing); no compression ratio gain but produces output any RFC-conforming decoder (including `gunzip(1)`) accepts. `gzipSync`/`gunzipSync`/`deflateSync`/`inflateSync`/`deflateRawSync`/`inflateRawSync` + all matching async/Transform variants. Adler-32 (zlib) + CRC-32 (gzip) computed correctly. Brotli still throws. |

### Globals

| Global | Status | Notes |
|---|---|---|
| `process` | ✅ Working | `argv`, `env`, `cwd`, `exit`, `exitCode`, `platform`, `arch`, `version`, `versions` (`node`/`ionpower`/`spidermonkey`/`v8`), `release`, `pid`, `stdout`/`stderr`/`stdin` (all with `.fd`/`.isTTY`; `stdin` is a real Readable streaming via `ioWatch(0, READABLE)` + non-blocking reads, emits `'data'` chunks + `'end'` on EOF), `nextTick` (microtask-queued), `umask`, `hrtime` (+ `.bigint`), `uptime`, `title`, `memoryUsage` (zero-filled), event-emitter surface (`on`/`once`/`off`/`emit` including `'exit'` flush). |
| `fetch` / `AbortController` / `AbortSignal` | ✅ Working | WHATWG-minimal `fetch(url, init)` → `Response` with `.text()`/`.json()`/`.arrayBuffer()`/`.buffer()`. `Headers` Map-ish API. `AbortController.abort(reason)` propagates to an in-flight fetch. `AbortSignal.timeout(ms)` and `.abort(reason)` static factories. HTTPS delegates to the sync curl path. |
| `Buffer` | ✅ Working | See `buffer` above. |
| `console` | ✅ Working | `log`/`error`/`warn`/`info`/`debug`/`trace`/`dir`/`time`/`timeEnd`/`assert`. |
| `Promise` | ✅ Polyfill | `.then`/`.catch`/`.finally` callbacks are routed through the event loop's microtask queue; fire after the current synchronous code returns, before setTimeout-queued work. `Promise.resolve`/`reject`/`all`/`race`/`allSettled`. |
| `queueMicrotask` | ✅ Microtask-queued | Pushes onto `__microtask_queue__`; the event loop drains between callback firings. |
| `setTimeout`/`setInterval`/`setImmediate` | ✅ Wallclock-real | Enqueue into the event loop; `select()` honors the next fireAt. `setTimeout(fn, N)` sleeps ~N ms before firing. Intervals self-requeue. |
| `TextEncoder`/`TextDecoder` | ✅ Working | UTF-8 only. |
| `URL`/`URLSearchParams` | ✅ Polyfill | Covers protocol/host/hostname/port/pathname/search/hash/origin/href + username/password, plus search-params get/getAll/has/set/append/delete/forEach/keys/values/entries/toString/sort. Not spec-complete for IDN / non-special schemes / exotic relative resolution. |
| `crypto` (WebCrypto) | ✅ Working | `crypto.getRandomValues`, `crypto.randomUUID`, `crypto.subtle` with `digest`/`sign`/`verify`/`encrypt`/`decrypt`/`deriveBits`/`importKey`/`exportKey`/`generateKey`/`wrapKey`/`unwrapKey` over SHA-{1,256,384,512}, HMAC, AES-{CBC,CTR,GCM,KW}, PBKDF2, HKDF, **Ed25519** (sign/verify/generateKey/import/export), **X25519** (generateKey/deriveBits — curve25519 ECDH). `"raw"` and `"jwk"` key formats. Node-style `crypto.sign`/`verify`/`generateKeyPair{,Sync}`/`createPrivateKey`/`createPublicKey` also wired for Ed25519. Still missing: RSA / ECDSA / NIST ECDH. |
| `ReadableStream`/`WritableStream`/`TransformStream` | ✅ Polyfill | WHATWG Streams minimal shape. `ReadableStream` supports `start`/`pull`/`cancel` sources, `getReader().read()`, `locked`, `tee()`, `pipeTo`, `pipeThrough`. `WritableStream` supports `start`/`write`/`close`/`abort` sinks, `getWriter().write`/`close`/`abort`/`releaseLock`. `TransformStream` bundles the pair with `start`/`transform`/`flush`. Backpressure is best-effort (no explicit high-water-mark queue). |
| `atob`/`btoa` | ✅ Working | |
| `performance` (WHATWG) / `perf_hooks` core | ✅ Polyfill | `performance.now()` returns ms since `performance.timeOrigin` (Date.now() at process start). `mark`/`measure`/`clearMarks`/`clearMeasures`/`getEntries*` are callable stubs. `PerformanceObserver` constructs with no-op `observe`/`disconnect`/`takeRecords`. `require('perf_hooks')` returns `{ performance, PerformanceObserver, constants }`. Resolution is ms (no sub-millisecond precision). |
| `Error.captureStackTrace` | ✅ Shim | Attaches `.stack` as an own property so error-ex / json-parse-even-better-errors work. |
| `globalThis` / `global` / `window` / `self` | ✅ All aliased | Any of the four resolves to the global object. |
| `Intl` | ❌ Missing | SM45 was built `--without-intl-api`. Blocks luxon, ICU-dependent date/number formatters. |
| `Symbol`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Proxy`, `Reflect`, typed arrays | ✅ Native | SpiderMonkey 45 provides these. |
| ES2022+ small APIs | ✅ Polyfill | `Object.hasOwn`, `structuredClone` (deep clone — handles objects/arrays/Date/RegExp/Map/Set/Buffer), `AggregateError`, `Promise.any`, `Array.prototype.at`/`findLast`/`findLastIndex`/`toSorted`/`toReversed`/`toSpliced`/`with`, `String.prototype.at`/`replaceAll`. |

### CommonJS

| Surface | Status | Notes |
|---|---|---|
| `require('./rel/path.js')` | ✅ Working | |
| `require('./rel/path')` | ✅ Working | Tries `.js`, `.cjs`, then `<dir>/package.json` main. |
| `require('./rel/data.json')` | ✅ Working | Parsed and returned. |
| `require('bare-module')` node_modules walk | ✅ Working | Standard upward search. |
| `require('bare-module')` vendor fallback | ✅ Working | If node_modules lookup fails, walks caller's dir up looking for `<ancestor>/<name>.js` or `<ancestor>/vendor/<name>.js`, plus global dirs (`cwd/test/vendor`, installed `share/ionpower-node/vendor`). Lets unpatched libraries' bare `require('chalk')` etc. resolve to vendored copies. |
| `require('node:fs')` prefix | ✅ Stripped | `node:` prefix stripped before lookup. |
| Seeded core modules | ✅ Working | `__require_cache__` pre-populated with fs / path / events / util / child_process / os / crypto / buffer / string_decoder / assert / stream / timers / querystring / supports-color / has-ansi / process / module (with `createRequire` + `builtinModules`). |
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
**657+** as of [v0.55](https://github.com/cellularmitosis/ionpower-node/releases/tag/v0.55).
Full suite: **1715+** assertions across 404 smoke files.

The full roster is the `test/*_smoke.js` + `test/vendor/*.js` trees;
see each smoke for exactly which surface the library exercises.
