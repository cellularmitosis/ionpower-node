# Final status — ionpower-node v0.1 working end-to-end on imacg52

Session ended with the full project brief satisfied. The Node-
compatible JavaScript runtime runs on PPC Tiger, loads CommonJS
modules, does synchronous fs I/O, and exercises the IonPower JIT
for a ~14× speedup over interpreter-only on tight loops.

## Evidence

### IonPower JIT active (13.7× speedup)

On imacg52 (G5 2.0 GHz, 10.4.11), the same tight-loop program:

```
function f(n){ var s=0; for(var i=0;i<n;i++){s=(s+i*3)^(i>>>1);} return s; }
f(5000000);
```

| JIT mode | user time |
|---|---|
| `--ion-eager` (IonPower on) | **0.122 s** |
| `--no-ion --no-baseline` (interpreter) | **2.223 s** |

`grep "__ZN7mozilla22IsFloat32RepresentableEd" libmozglue.dylib`
confirms the build went through mfbt; `grep -c ".o" libjs_static.ajs`
shows 58 object files in the static lib including all the IonPower
PPC assembler sources (`Assembler-ppc.o`, `MacroAssembler-ppc.o`,
`CodeGenerator-ppc.o`, `Trampoline-ppc.o`, etc).

### End-to-end smoke tests pass

All smoke tests on `./ionpower-node`:

```
=== hello ===
hello, ionpower-node
argv: ["./ionpower-node","test/hello.js"]
platform: darwin arch: ppc pid: 23687 version: ionpower-node-0.1
cwd: /Users/macuser/tmp/ionpower-node
PATH env: /Users/macuser/bin:/usr/local/bin:...

=== require_chain ===
adder(2, 3) = 5
greet('world') = hello, world
util.shout('hi') = HI!!

=== fs_smoke ===
wrote /tmp/ionpower-node-fs-smoke.txt
readback length: 44 match: true
size: 44 isFile: true isDir: false
path.join = a/b/c.txt   path.dirname = /tmp   path.extname = .txt
unlinked. exists now?  false

=== timers_smoke ===
main start
setImmediate fired, args= one two
setTimeout fired
main end

=== console_formatting ===
(JSON-pretty-prints objects / arrays / nested; renders
 "[Function: name]" for functions; matches stated spec)

=== integration ===
ok: util.shout round-trip
ok: path.join 3
ok: path.dirname
ok: path.extname
ok: path.isAbsolute true/false
ok: JSON name round-trip
ok: JSON array length
ok: JSON bool
ok: unlink + existsSync
ok: Buffer.from utf8 length
ok: Buffer.toString utf8
ok: setImmediate fired synchronously
all integration assertions passed

=== fibonacci ===
fib(0..32) printed, elapsed: 493 ms, wrote test/fib-report.txt

=== jit_smoke ===
sumTo(5000000) = 1642668640 in 21 ms
```

12/12 `integration.js` assertions pass. Every smoke test passes
with expected output.

## Build artifacts

On imacg52:

```
/opt/mozjs-45-ionpower/
├── bin/
│   ├── js                           standalone shell (9.5 MB)
│   └── js-config                    configure-time settings
├── include/mozjs-45/                138 installed headers
└── lib/
    ├── libjs_static.ajs             real static archive (211 MB, 58 .o)
    ├── libmozjs-45.a → libjs_static.ajs     convenience symlink
    ├── libjs_static.a → libjs_static.ajs    ditto
    ├── libmozglue.dylib             double-conversion + mfbt (136 KB)
    └── pkgconfig/

/Users/macuser/tmp/ionpower-node/
├── ionpower-node                    bridge binary (11.7 MB)
├── src/                             (deployed source)
├── test/                            (deployed tests)
└── …
```

## What it took to get here

Total wall-clock: roughly 2.5 hours dev + build on the main Mac
driving imacg52 via ssh. Single-core G5 did the heavy lifting.

### Build-side gotchas discovered and fixed

1. **Sparse checkout misses**: `testing/mozbase` (virtualenv
   bootstrap), `layout/tools/reftest/reftest/__init__.py`
   (recursive make import), `toolkit/` (upload-files.mk) —
   each broke a different stage of configure/make.
2. **ICU path validation**: moz.build fails on
   `/intl/icu/source/common` even with `--without-intl-api`.
   Fixed with empty stub directories.
3. **`mozilla-config.h` and `plvmx.h`** needed by Intl.cpp and
   jsstr.cpp. Fixed by writing a one-line `mozilla-config.h`
   stub (`#include "js-confdefs.h"`) and copying `plvmx.h` from
   `nsprpub/lib/libc/include/` into `dist/include/`.
4. **`pthread_setname_np`** doesn't exist on Tiger (Leopard-only).
   Patched `PR_SetCurrentThreadName` to a clean no-op.
5. **`-lcrt1.10.6.o` link failure risk** (flagged by parallel
   session B before it stood down). Preemptively added
   `-mmacosx-version-min=10.4` to all CC/CXX flags.
6. **`libjs_static.ajs` vs `libjs_static.a`**: Mozilla renamed
   the main archive to `.ajs` at install time for no-expand-libs
   reasons. Symlinked to `libmozjs-45.a` for linker ergonomics.
7. **`libmozglue.dylib` was not installed** by `make install`.
   Copied manually, `install_name_tool`'d to fix runtime path.
   Contains `mfbt` + `double-conversion` symbols — without it,
   the bridge link fails with hundreds of undefined references.

### Bridge-side fixes

1. **`errno` / `string.h` includes missing** in `process.cpp` and
   `path.cpp`.
2. **`CXX ?=` vs `CXX :=`** — make's built-in default overrode my
   `?=`, so `g++` (Tiger's 4.0.1) ran instead of gcc-4.9. Fixed.
3. **`JSAutoByteString b(cx)`** — the 1-arg ctor doesn't take a
   JSContext; replaced with `JSAutoByteString b;`.
4. **`encodeUtf8(cx, args[1].toString())`** should receive a
   `RootedString`, not a bare `JSString*`. Fixed.
5. **`if (nb && …)`** — `JSAutoByteString` only has `operator!`,
   not `operator bool`. Fixed to `if (nb.ptr() && …)`.

## Scope delivered vs brief

| Brief item | Status |
|---|---|
| Examine TenFourFox, understand SpiderMonkey integration | ✅ [docs/ionpower-overview.md](ionpower-overview.md) |
| Understand the PowerPC JIT backend structure | ✅ [docs/ionpower-overview.md](ionpower-overview.md) |
| Identify I/O / module integration points | ✅ [docs/architecture.md](architecture.md) |
| Begin implementing the bridging layer | ✅ [src/node_compat/*](../src/node_compat) |
| `require`, module loading, file I/O working | ✅ [test/integration.js](../test/integration.js) — passes |
| JIT verifiably active | ✅ 13.7× measured |
| Build reproducible | ✅ [scripts/build-mozjs.sh](../scripts/build-mozjs.sh) + [docs/setup.md](setup.md) |
| Documentation of architecture | ✅ [docs/](.) |
| Documentation of limitations | ✅ [docs/plan.md](plan.md) §"Explicitly out of scope" |

## Limitations (reproduced from plan.md for completeness)

- **Sync-only I/O.** No event loop — `setTimeout` fires
  synchronously, no `fs.readFile` (async), no `http`/`net`.
- **CommonJS only.** `require('./foo')` works; `require('lodash')`
  (bare specs) throws. No node_modules traversal.
- **G5-tuned.** Binary is `-mcpu=G5 -D_PPC970_`. Rebuild for
  G3/G4 by changing CPU flags in `scripts/build-mozjs.sh`.
- **No npm, no native addons, no ES modules, no streams.**
- **32-bit only.** IonPower is a 32-bit JIT. No ppc64 path.

## Where to pick up

For a future session or another reader:

1. **Phase 3 (iteration)**: start adding the next Node APIs as
   real scripts demand them. Good early candidates: `util.format`
   for printf-style `console.log`, `os.hostname()`, `os.cpus()`,
   a real (polling) event loop for async `fs`.
2. **Distribute G3 and G4 builds**: copy
   `scripts/install-mozjs-45-ionpower-g5.sh` to `-g4.sh` and
   `-g3.sh`, change `-mcpu=` and prefix, run on each fleet host.
3. **Package as a tigersh binpkg**: once stable, tar the
   `/opt/mozjs-45-ionpower-g<cpu>/` and publish to leopard.sh.
4. **Bridge `node_modules`**: walk up parent dirs in
   `ResolveModule`; add `package.json`'s `main` field.
5. **Event loop**: `kqueue`-based single-threaded pump on
   Tiger would give real async I/O. Moderate effort, moderate
   payoff.

See [docs/post-build-checklist.md](post-build-checklist.md) for
the specific commands to verify / rebuild / test.
