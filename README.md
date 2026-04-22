# ionpower-node

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
