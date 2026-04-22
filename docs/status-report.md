# ionpower-node status report

**Session length:** unsupervised run starting 2026-04-21, working from
the project brief in the initial message.
**State at write:** Phase 1 build in progress on imacg52 (G5); bridge
source for Phase 2 complete and waiting to link.

## What was asked

Build a Node.js-compatible JavaScript runtime for 32-bit PowerPC Mac
OS X 10.4 by reusing TenFourFox's IonPower JIT + SpiderMonkey 45, and
layering a Node-shaped API bridge on top. Explore the TenFourFox
codebase, draft a plan doc, and get started on implementation.

## Deliverables produced

- **[docs/plan.md](plan.md)** — architecture plan covering scope, Node
  API surface, build strategy, phase breakdown, risk register, and
  success criteria.
- **[docs/architecture.md](architecture.md)** — runtime architecture:
  layers, startup sequence, require() design, native-binding pattern,
  memory/rooting rules.
- **[docs/build-notes.md](build-notes.md)** — running log of build
  discoveries on imacg52 (missing sparse paths, ICU path stubs, etc.)
- **[README.md](../README.md)** — project overview, layout, build
  recipe.
- **[scripts/build-autoconf-213.sh](../scripts/build-autoconf-213.sh)**
  — installs autoconf 2.13 into `/opt` on a Tiger host. Already ran,
  artifacts at `/opt/autoconf-2.13/`.
- **[scripts/build-mozjs.sh](../scripts/build-mozjs.sh)** — runs
  `autoconf213`, configures and builds standalone SpiderMonkey 45 from
  the sparse-checked-out TenFourFox tree into
  `/opt/mozjs-45-ionpower/`.
- **[Makefile](../Makefile)** — builds the ionpower-node binary on
  the target host by linking against a built mozjs.
- **[src/main.cpp](../src/main.cpp)** — runtime entry point.
- **[src/node_compat/](../src/node_compat/)** — Node-shaped API
  bridge (console, process, fs, path, Buffer, require, globals).
- **[test/](../test/)** — smoke tests: `hello.js`,
  `require_chain.js`, `fs_smoke.js`, `jit_smoke.js`, plus the
  ./mod/* fixtures the require test needs.
- **external/tenfourfox/** — sparse git checkout of the TenFourFox
  source tree (369 MB after scope expansions), used for reference
  and as the build source.

## What was learned in exploration

### TenFourFox's PPC JIT is complete

At `js/src/jit/osxppc/` in the repo:

```
Architecture-ppc.{cpp,h}     1.8K + 17K    - regs, stack, call conv
Assembler-ppc.{cpp,h}        65K + 50K     - PPC encoder
MacroAssembler-ppc.{cpp,h}   128K + 65K    - higher-level helpers
MacroAssembler-ppc-inl.h     6.4K
CodeGenerator-ppc.{cpp,h}    86K + 12K     - MIR -> asm
BaselineCompiler-ppc.{cpp,h} 602B + 775B   - template JIT entry
BaselineIC-ppc.cpp           11K           - baseline inline caches
Lowering-ppc.{cpp,h}         19K + 5.4K    - MIR -> LIR
LIR-ppc.h / LOpcodes-ppc.h   6.9K + 568B
Trampoline-ppc.cpp           56K           - entry/exit, bailouts
MoveEmitter-ppc.{cpp,h}      11K + 2.3K    - register shuffle
Bailouts-ppc.{cpp,h}         2.4K + 2.3K   - deoptimize to interp
SharedICHelpers-ppc.h        15K
SharedICRegisters-ppc.h      2.0K
AtomicOperations-ppc.h       6.4K
```

Self-description in `Architecture-ppc.h:17`:
`/* The new TenFourFox 32-bit PowerOpen-compliant JIT. */`

Notable details:
- `NUNBOX32_TYPE_OFFSET = 0, NUNBOX32_PAYLOAD_OFFSET = 4` — big-endian
  JSValue layout, opposite of the x86 case. Hardcoded for PPC.
- `BAILOUT_TABLE_ENTRY_SIZE = sizeof(void*)` — one `bl` per entry.
- GPR enum: `r0..r31` with `r1=sp`, `r12=addressTempRegister`,
  `r0=tempRegister`, and a deliberate lie where `lr` is listed as a
  GPR slot so the pushRegs machinery uses a consistent index scheme
  (comment says they never actually use r11).

Selection is via `CPU_ARCH=ppc` in configure.in, which sets
`JS_CODEGEN_PPC_OSX=1`. No simulator, no cross — darwin-ppc only.

### SpiderMonkey's standalone embedder shape

`js/src/shell/js.cpp` (7000 lines) is the canonical embedding
reference. Startup pattern we reproduced in `src/main.cpp`:

```
JS_Init();
JSRuntime* rt = JS_NewRuntime(heap, nursery);
JSContext* cx = JS_NewContext(rt, stack_chunk);
JS::CompartmentOptions opts;
RootedObject glob = JS_NewGlobalObject(cx, &class, nullptr,
                                       DontFireOnNewGlobalHook, opts);
JSAutoCompartment ac(cx, glob);
JS_InitStandardClasses(cx, glob);
// ... define native functions ...
JS_FireOnNewGlobalObject(cx, glob);
// ... run user code ...
JS_DestroyContext(cx); JS_DestroyRuntime(rt); JS_ShutDown();
```

`js/src/shell/OSObject.cpp` already exposes `os.file.readFile`,
`os.file.writeTypedArrayToFile`, `os.getenv`, `os.system`,
`os.getpid`, `os.path.isAbsolute`, `os.path.join` — the exact
shape of our bridge minus the Node-naming veneer. We patterned
our native bindings on it.

## Build infrastructure now in place on imacg52 (G5)

- `/opt/autoconf-2.13/bin/autoconf213` — built from GNU tarball; the
  standard Mozilla `configure.in` requires *exactly* 2.13.
- `/opt/python2-2.7.18/` — installed via `tiger.sh python2-2.7.18`;
  `mozbuild` needs Python 2.7.
- `/opt/gcc-4.9.4/` — already present from a prior project; binaries
  are suffixed (`gcc-4.9`, `g++-4.9`), not plain `gcc`.
- `/Users/macuser/tmp/tenfourfox/` — 369 MB source rsync'd from the
  main Mac sparse checkout. Expanded beyond `js/src` as build
  errors revealed Python-sys.path dependencies:
  `testing/mozbase`, `layout/tools/reftest`, `dom/bindings`,
  `other-licenses/ply`, `xpcom/idl-parser`, `toolkit/` (for
  `upload-files.mk`), and empty stubs at `intl/icu/source/common`
  and `intl/icu/source/i18n`.

## Build progress at last check

Configure completed end-to-end. Build is compiling SpiderMonkey
sources, including the IonPower JIT. At checkpoint:

```
$ ls build_OPT.OBJ/js/src/*.o | head
Architecture-ppc.o
Assembler-ppc.o
Bailouts-ppc.o
BaselineCompiler-ppc.o
BaselineIC-ppc.o
CodeGenerator-ppc.o
...
26 object files; 5 of 43 unified groups
```

The build hit one structural issue along the way — `builtin/Intl.cpp`
unconditionally includes `mozilla-config.h`, a file generated only
by the top-level Firefox configure (not `js/src/configure`). Since
we configured with `--without-intl-api`, the file is useless to us.
Fix: commented out `builtin/Intl.cpp` in `js/src/moz.build` and
re-ran `config.status && make`. The build is now progressing past
it into `Unified_cpp_js_src1.cpp` (WasmIonCompile,
MacroAssembler). Details captured in
[docs/build-notes.md](build-notes.md).

Key milestone hit: **the PPC JIT sources compile cleanly** under
gcc-4.9.4 with our flags. The only noteworthy diagnostic is a
TenFourFox-intentional
`CodeGenerator-ppc.cpp:447: #warning using native POWER4/970
square root`, confirming the optimized `fsqrt` path for G5 is
being emitted.

Compile-time extrapolation from first 40 minutes: total build
time looks like 2–4 hours on this G5.

## Discoveries that shaped the plan

1. **Mozilla's `configure.in` is pinned to autoconf 2.13**. Modern
   autoconf (Tiger's 2.59, let alone `tiger.sh autoconf-2.71`) is
   rejected. Had to build 2.13 from the GNU tarball with
   `--program-suffix=213`.
2. **`mozbuild` Python packages live throughout the Mozilla tree,
   not just under `python/`.** `virtualenv.py` asserts
   `testing/mozbase/packages.txt` exists; `recursivemake.py` does
   `from reftest import ReftestManifest`, requiring
   `layout/tools/reftest/reftest/__init__.py`. These dependencies
   aren't visible in `configure.in` and have to be discovered by
   running the build and reading the traceback. Lesson captured
   in `docs/build-notes.md`.
3. **`configure.log` and `config.log` are two different files.**
   mozbuild wraps autoconf and writes its own log. Failures in the
   Python wrapper appear in `configure.log`; classical autoconf
   failures appear in `config.log`. Both must be checked.
4. **`MOZ_ICU_INCLUDES` is added to `LOCAL_INCLUDES` even with
   `--without-intl-api`.** `build/autoconf/icu.m4:23` sets it
   unconditionally. `js/src/moz.build:683` unconditionally adds to
   `LOCAL_INCLUDES`. We worked around with two empty stub
   directories rather than patch moz.build.
5. **`js/src/shell/js.cpp` references `shellmoduleloader.out.h`** —
   generated by a Python preprocessor during the build. Our
   runtime doesn't include this because we're not using SpiderMonkey
   ES modules; our `require()` is pure CommonJS handled in C++.

## What's in the Node-compat bridge (Phase 2, source complete)

Written but not yet compiled (depends on libmozjs-45 install):

- **console** — log / info / debug (stdout), warn / error (stderr).
  Space-separated, newline-terminated. No format specifiers yet.
- **process** — `argv` (argv[0]=binary, argv[1]=script, 2..=user),
  `env` (from `environ[]`), `platform='darwin'`, `arch='ppc'`,
  `version='ionpower-node-0.1'`, `pid`, `cwd()`, `exit(code)`,
  `getenv(name)`.
- **fs (sync)** — `readFileSync(p, 'utf8'|opts)` returns string or
  Uint8Array, `writeFileSync(p, data)` accepts string or Uint8Array,
  `existsSync`, `readdirSync`, `statSync` (size, mtime, mode,
  isFile, isDirectory), `unlinkSync`.
- **path** — `join`, `dirname`, `basename` (with optional ext
  stripping), `extname`, `resolve` (w/ cwd), `isAbsolute`, `.sep`.
- **Buffer shim** — `Buffer.from(string|arrayLike)` and
  `Buffer.alloc(n)` returning `Uint8Array`. Patches
  `Uint8Array.prototype.toString(enc)` to decode bytes as UTF-8.
- **require** — CommonJS relative-path loader with `.js` and
  `/index.js` inference. Module cache keyed by absolute path;
  cache entry is installed *before* the module body runs so
  circular imports see a live partial exports. Modules run inside
  a `(function (exports, require, module, __filename, __dirname)
  { ... })` wrapper compiled via `JS::Evaluate`. Core modules
  `'fs'` and `'path'` are seeded into the cache by the bootstrap
  JS so `require('fs')` works without filesystem lookup.

Files total ~1,200 lines of C++ and a compact block of bootstrap JS.

## Risks still open

- **The build may fail further in.** It has already surfaced
  several issues we caught (ICU stubs, missing Python modules).
  Likely remaining failure modes:
  - Incomplete sparse checkout — more paths are Python-sys.path
    deps and only surface deep in the build.
  - Tiger SDK vs post-Leopard syscalls: `getcontext`, `setcontext`,
    `Availability.h`. TenFourFox itself handles these with
    in-tree patches, but the standalone `js/src` config path may
    not auto-enable them. Mitigation: add `--disable-async` or
    similar if we see the relevant undefined-symbol link error;
    rewrite `Availability.h` → `AvailabilityMacros.h` if needed.
  - Modern C++ compile errors from gcc-4.9 vs what the Mozilla
    era expected. Mitigation: fall back to `tiger.sh gcc-4.8` if
    available, or tune `-fpermissive` as the `G5.mozcfg` does.
- **Link step may reveal missing NSPR or mozglue** because our
  configure may have built the wrong subset. We'll see after the
  build proper runs and we start linking.
- **IonPower JIT may not be enabled by default under a "standalone
  mozjs" configuration.** Its entry points are only reached when
  the top-level Firefox build drives them. If so, we'd need to
  either force `--enable-ion --enable-baseline` (if those exist in
  45-era configure) or patch the standalone config to route the
  PPC backend files in.

## Note on parallel session

A second Claude session (session B) was started in parallel by
accident. It detected the overlap early, cleaned up its own
duplicates (on both the main Mac and imacg52), and left a hand-off
at [docs/status-report-session-B.md](status-report-session-B.md)
with one actionable heads-up: that `-lcrt1.10.6.o` would trip a
link step on Tiger under gcc 4.9 without an explicit
`-mmacosx-version-min=10.4`. I applied the fix preemptively to
`scripts/build-mozjs.sh` and `Makefile`; both now set
`-mmacosx-version-min=10.4` on `CC`/`CXX` and export
`MACOSX_DEPLOYMENT_TARGET=10.4`. The fix hasn't been exercised yet
because we haven't reached link time.

Session B's file is preserved in the tree as paper trail; no
code or data from it is in conflict with this session's work.

## What's next when the build finishes

1. Verify artifacts: `/opt/mozjs-45-ionpower/bin/js` (shell),
   `/opt/mozjs-45-ionpower/lib/libmozjs-45*.dylib`,
   `/opt/mozjs-45-ionpower/include/mozjs-45/` headers.
2. Run `js --help | head` and confirm IonPower is referenced
   (looking for `ion-*` flags).
3. Run `test/jit_smoke.js` through the stock `js` shell first,
   with and without `--no-ion --no-baseline`, to confirm the JIT
   is active and measure speedup.
4. Rsync ionpower-node sources to imacg52, `make`, fix any
   compile errors (JSAPI 45 is slightly different from what I
   targeted from memory — e.g. `CompartmentOptions::behaviors()`
   may need `.setVersion()` which was renamed in 52).
5. Run `./ionpower-node test/hello.js` and resolve any bridge
   bugs.
6. Measure: time `test/jit_smoke.js` on ionpower-node (which
   enables the JIT by default) vs on the stock js shell with
   `--no-ion --no-baseline`. Expected: ~5-10× speedup.

## What's explicitly deferred

- Event loop (no `setTimeout`, no async fs).
- npm / node_modules resolution (bare `require('lodash')` throws).
- ES modules (`import` syntax).
- Native addon ABI (N-API).
- `http`/`net`/`dns`/`child_process`/streams.
- `util.format` / `util.inspect`.

## Known limitations of the IonPower substrate

- **32-bit only.** No 64-bit PPC JIT exists in this tree. imacg52
  is G5 and can run 64-bit kernels but we build `-m32` because
  that's what the JIT targets.
- **Big-endian JSValue layout is hardcoded.** Portability to
  little-endian PPC Linux or PPC FreeBSD would be a substantial
  effort.
- **No SIMD / asm.js.** AltiVec lanes are not used by the JIT
  (they're used elsewhere in TenFourFox for media decode).
- **No threading runtime provided by this bridge.** SpiderMonkey's
  own thread pool still exists but we don't expose any Worker-like
  API.
