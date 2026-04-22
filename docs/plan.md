# ionpower-node: Node-compatible JavaScript runtime for PowerPC Tiger

Reuse the JIT-enabled SpiderMonkey engine that ships inside TenFourFox
to build a Node-like runtime that executes on 32-bit PowerPC Mac OS X
10.4. The hard thing about writing a JS runtime for a 20-year-old
architecture is the JIT. TenFourFox already shipped that — "IonPower,"
a hand-written 32-bit PowerOpen-compliant backend for SpiderMonkey 45.
We glue a Node-compat bridge onto it instead of building an engine.

## Definitions

- **SpiderMonkey**: Mozilla's JavaScript engine. Tree-shared with
  Firefox under `js/` in a Mozilla source tree.
- **Ion / IonMonkey**: SpiderMonkey's optimizing JIT.
- **Baseline**: SpiderMonkey's template JIT (one IR tier below Ion).
- **IonPower**: TenFourFox's 32-bit PowerPC backend for Ion + Baseline.
  Lives at `js/src/jit/osxppc/` in the TenFourFox tree. Announced by
  Cameron Kaiser as a from-scratch rewrite of the earlier PPCBC.
- **mozjs**: A tarball of just the JS subtree, intended for embedders.
  Mozilla has released `mozjs-45` and `mozjs-52`, etc.
- **JSAPI**: SpiderMonkey's public C++ embedding API. Headers in
  `js/public/`.
- **TenFourFox**: Cameron Kaiser's Firefox 45 ESR fork maintained for
  Power Macs. Upstream repo:
  <https://github.com/classilla/tenfourfox>, default branch `master`,
  current HEAD `51ec6270`. FPR32.5 is the last shipped release
  (pre-built binpkg exists at leopard.sh).

## Why IonPower is the right substrate

TenFourFox's JIT (from `js/src/jit/osxppc/Architecture-ppc.h`):

> /* The new TenFourFox 32-bit PowerOpen-compliant JIT. */

Complete backend: `Architecture-ppc.cpp/h`, `Assembler-ppc.cpp/h`
(~115 KB combined), `MacroAssembler-ppc.cpp/h` (~193 KB),
`CodeGenerator-ppc.cpp/h` (~98 KB), `Lowering-ppc.cpp/h`,
`BaselineCompiler-ppc`, `BaselineIC-ppc.cpp`, `Trampoline-ppc.cpp`
(56 KB), `MoveEmitter-ppc`, `Bailouts-ppc`, plus `SharedICHelpers`,
`SharedICRegisters`, `AtomicOperations`, `LIR-ppc`, `LOpcodes-ppc`.
That's a full, production-quality Baseline + Ion pair that powered
real Firefox browsing on PPC for years.

Writing this from scratch for a new runtime is beyond any reasonable
budget. Reusing it leaves us to build only the API surface.

## Scope: what "Node-compatible" means here

We are **not** re-implementing Node.js. Node's own bridging layer on
V8 is hundreds of thousands of lines (libuv, deps/, src/ in Node's
tree). We are implementing *enough* of Node's public shape to run
simple CommonJS scripts end-to-end on Tiger/PPC:

**Must-have (Phase 2):**
- `require()` for CommonJS modules (relative paths, no node_modules
  resolution yet).
- `module.exports` / `exports` wiring.
- `console.log / error / warn` writing to stderr/stdout.
- `process.argv`, `process.env`, `process.exit`, `process.platform`,
  `process.version` (ours, not Node's), `process.cwd`.
- `fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync`,
  `fs.readdirSync`, `fs.statSync` (sync-only to start; async needs
  an event loop we're not building yet).
- `path.join`, `path.dirname`, `path.basename`, `path.extname`,
  `path.resolve`, `path.sep`.
- `Buffer` — bridged to SpiderMonkey's `Uint8Array` /
  `ArrayBuffer` with a veneer that exposes the Node API shape. No
  attempt at Node's full Buffer semantics on day one.
- Entry-point argv parsing: `ionpower-node script.js arg1 arg2`.

**Nice-to-have later (Phase 3+):**
- `os` (hostname, platform, cpus — most trivial).
- `util.inspect` for console output.
- `setTimeout` / `setInterval` / `setImmediate` — requires an event
  loop. SpiderMonkey has no built-in one; we'd need a simple
  poll/sleep loop.
- Stream-style `fs.createReadStream` etc. — out of scope for any
  tractable milestone.
- Native addon ABI (N-API / NAN) — completely out of scope.
- `http`, `net`, `dns`, `child_process` — listed only to say no.

**Explicitly out of scope forever (for this project):**
- ES modules (`import`) syntax compatibility — SpiderMonkey 45
  has early, incomplete module support; we target CommonJS only.
- Node's internal module cache quirks, Node's exact `require.resolve`
  algorithm past relative paths.
- Compatibility with any npm package that uses a native addon.

## Phase plan

### Phase 0 — Exploration and infrastructure (this session)

- Sparse clone of TenFourFox source — done, 209 MB at
  `external/tenfourfox/`.
- Identify IonPower JIT location — done, `js/src/jit/osxppc/`.
- Identify SpiderMonkey standalone shell — done,
  `js/src/shell/js.cpp` (7 KLOC, embeds via JSAPI). Good reference
  for how a downstream consumer drives a SpiderMonkey `JSRuntime` /
  `JSContext` / global object. `shell/OSObject.cpp` already exposes
  `os.file.readFile`, `os.file.writeTypedArrayToFile`, `os.getenv`,
  `os.system`, `os.getpid`, `os.spawn`, `os.waitpid`, `os.kill`,
  `os.path.isAbsolute`, `os.path.join` — roughly the set we want.
  We will reuse its pattern and some of its code.
- Install build prereqs on G5 (imacg52) — python2-2.7.18 (mozbuild
  requirement) installed; autoconf-2.13 (Mozilla configure.in is
  pinned to 2.13) building in background.

### Phase 1 — Standalone SpiderMonkey build

Build the SpiderMonkey standalone library (`libmozjs-45*.dylib`) and
`js` shell out of TenFourFox's tree on the G5.

Build command shape (from Mozilla `js/src/README.html` era docs +
TenFourFox's `G5.mozcfg`):

```
cd js/src
autoconf213   # regenerates configure
mkdir build_OPT.OBJ
cd build_OPT.OBJ
../configure \
    --prefix=$OPT_PREFIX \
    --disable-tests \
    --disable-cpp-exceptions \
    --disable-debug \
    --enable-optimize \
    --disable-jemalloc \
    --with-macos-sdk=/Developer/SDKs/MacOSX10.4u.sdk
make
make install
```

Unknowns we'll discover in practice:
- Will the `mozjs` standalone configure work *without* the
  surrounding Firefox tree? `js/src/configure.in` references only
  `../../mfbt`, `../../memory`, `../../config`, `../../mozglue`,
  `../../nsprpub` — all included in the sparse checkout.
- SDK 10.4 vs expected availability of modern syscalls — we already
  know from the imacg3-dev skill that `<Availability.h>` doesn't
  exist on Tiger and `getcontext` / `setcontext` are Leopard-only.
  The TenFourFox build *worked* on Tiger historically, so the
  fork's own workarounds should carry us; but a standalone
  SpiderMonkey config path may not enable them.
- NSPR: Mozilla traditionally builds the in-tree NSPR alongside JS.
  TenFourFox's tree has `nsprpub/`. The standalone `js/src/configure`
  should pick it up via `--with-nspr-prefix` or build it in-tree.

Host choice: **imacg52** (G5 2.0 GHz, 10.4.11, gcc-4.9.4 and
gcc-10.3.0 in `/opt`, 9.5 GB free on /). G5 is the fastest PPC
machine in the fleet; SpiderMonkey 45 is a multi-hour build on a
G3. Target arch is `-m32 -mcpu=G5` to match the original IonPower
target.

### Phase 2 — Node-compat bridge (C++)

A new C++ program that links against `libmozjs-45`, initializes a
`JSRuntime` / `JSContext` / global, and populates the global with a
Node-shaped API surface. Architecture:

```
+-- src/main.cpp                 // argv parsing, JS_Init, runtime,
|                                   entry point into user script.
+-- src/node_compat/             // All Node API emulation.
|   +-- console.cpp              // console.{log,error,warn,info,debug}
|   +-- process.cpp              // process.{argv,env,exit,cwd,...}
|   +-- fs.cpp                   // fs.{readFileSync,writeFileSync,...}
|   +-- path.cpp                 // path.{join,dirname,...}
|   +-- buffer.cpp               // Buffer shim over Uint8Array
|   +-- require.cpp              // CommonJS module loader
|   +-- globals.cpp              // attach all of the above to global
+-- src/node_compat/internal.js  // Pure-JS bits of the bridge (e.g.
|                                   the Module wrapper that gives you
|                                   `module`, `exports`, `__dirname`,
|                                   `__filename`, `require` as
|                                   function arguments).
+-- lib/                         // Pure-JS Node stdlib shims
|                                   (path.js can be mostly JS; some
|                                   fs.js too.)
```

The C++ half is thin: each of `fs`, `process`, etc. exposes ~5-20
native methods. The JS half (`internal.js` + `lib/`) does most of
the Node-shape work. This matches how real Node is built.

### Phase 3 — Iteration

- Run simple test programs (`test/hello.js`, `test/fs_smoke.js`,
  `test/require_chain.js`).
- Time IonPower JIT vs interpreter with `--no-ion --no-baseline`
  to confirm the JIT is actually active on our hosts.
- Measure against Duktape / QuickJS (which have no JIT) on the same
  G5 for perf narrative.
- Fill in missing APIs as test scripts demand them.

## Risk register

| # | Risk | Mitigation |
|---|------|------------|
| R1 | Standalone mozjs-45 build out of TenFourFox doesn't configure cleanly — its `configure.in` may require Firefox-tree-only variables. | Fall back to upstream `mozjs-45.9.0` tarball from Mozilla archive + cherry-pick `js/src/jit/osxppc/` as a patch on top. |
| R2 | Build fails on Tiger because of SDK gaps (Availability.h, getcontext/setcontext). | Work around per the imacg3-dev skill: rewrite Availability.h→AvailabilityMacros.h, define-out absent syscalls. TenFourFox itself builds on Tiger, so the in-tree recipe works. |
| R3 | G5 build takes too long to fit in one session. | Fire-and-forget in background (`tail -f` log), do bridge dev in parallel. If >6h, bisect which target is the pole (`js/src/jit/...` files). |
| R4 | IonPower assumes big-endian `JSValue` layout (`NUNBOX32_TYPE_OFFSET = 0, PAYLOAD_OFFSET = 4`), which is baked in for PPC. If we accidentally compile little-endian we break silently. | `CPU_ARCH=ppc` is set automatically by configure on darwin-ppc. Verify with `nm \| grep ppc` on the built `.a`/`.dylib`. |
| R5 | SpiderMonkey 45 wants Python 2.7 for `mozbuild`. Tiger ships Python 2.3. | `tiger.sh python2-2.7.18` — done, available via `/usr/local/bin/python2`. |
| R6 | Mozilla tree wants `autoconf 2.13` specifically. Tiger ships 2.59. | Building autoconf-2.13 into `/opt/autoconf-2.13` with `--program-suffix=213` — in progress. |
| R7 | SpiderMonkey 45 shell already exists and is what we'd ship. Node-compat layer may be redundant unless we truly wire `require`. | The shell *is* the milestone for Phase 1. Phase 2 wraps it. |
| R8 | "Node-compatible" is a bottomless pit. | Scope locked above. Pick the smallest set that runs a real CommonJS program and freeze it. |
| R9 | No event loop = no real `setTimeout`, no async `fs`. | Document the sync-only constraint upfront. Users who hit it can refactor to sync APIs. |

## Decisions captured

- **Target host for dev**: imacg52 (G5). Reason: fastest PPC in the
  fleet; still Tiger, which is the real target OS; has the 10.4 SDK
  and modern gcc via `/opt`.
- **Target architecture**: 32-bit PPC (`-m32`). IonPower is a 32-bit
  JIT; there is no 64-bit PPC JIT in this tree.
- **CPU tune**: build once for `g5` (imacg52) in Phase 1, later retune
  for `g3` / `g4` when distributing.
- **Build tree**: `js/src/build_OPT.OBJ/` (Mozilla convention).
- **Install prefix**: `/opt/mozjs-45-ionpower/`. Matches `tiger.sh`
  convention of versioned prefixes under `/opt`.
- **Node-compat install prefix**: `/opt/ionpower-node-0.1/` eventually.
- **Repo layout on main Mac**:
  - `docs/` — design docs (this file, build notes, status report).
  - `scripts/` — build scripts shipped to imacg52.
  - `src/` — C++ bridge source (Phase 2+).
  - `lib/` — JS stdlib shim source (Phase 2+).
  - `external/tenfourfox/` — sparse-checkout source reference
    (gitignored; fetch with `scripts/fetch-tenfourfox.sh`).

## Success criteria (copied from the brief, restated)

1. `ionpower-node hello.js` prints "hello, world" on imacg52 where
   `hello.js` is `console.log("hello, world")`.
2. `ionpower-node app.js` works where `app.js` does
   `const x = require("./x.js"); console.log(x.greet());` and
   `x.js` does `module.exports = { greet: () => "hi" };`.
3. `fs.readFileSync` round-trips a file's contents through a JS
   program.
4. JIT is verifiably active: the runtime advertises it, and
   `--no-ion --no-baseline` measurably slows a tight-loop benchmark.
5. Build reproducible: a single script on imacg52 produces the
   binary from clean checkout.
6. Docs explain the architecture, the build, and the known
   limitations.
