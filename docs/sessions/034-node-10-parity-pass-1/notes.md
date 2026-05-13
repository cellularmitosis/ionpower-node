# Session notes — 2026-05-10 session 1: Node 10 parity, pass 1

Plan: [`plan.md`](plan.md). Drives off the v0.86 → npm 6.14.18
bring-up captured in
[`../033-npm-6-bootstrap/notes.md`](../033-npm-6-bootstrap/notes.md).

Goal: close the first wave of runtime gaps surfaced by the npm 6
bootstrap experiment, then re-run `npm install mri` against the
new runtime.

## Working log

This file is appended-to in real time as the session progresses.

### Read-first context, picked up

- Decision: `process.version` becomes `'v10.24.1'`; runtime identity
  moves to `process.versions['ionpower-node']` (dashed key).
- Node 10 is the new parity target.
- Pass 1 work split into A–G groups; commits will be per-group for
  reviewability.

### Existing runtime surface, audited

Things the v0.86 runtime *already* has that the plan listed (so I
don't re-invent them):

- `fs.appendFileSync` (already in `src/node_compat/fs.cpp:405`,
  bound as `fs.appendFile` async via `_fsAsync` in
  `globals.cpp:164`).
- `fs.copyFileSync`, `fs.chmodSync`, `fs.renameSync`, `fs.unlinkSync`,
  `fs.statSync`, `fs.lstatSync` (alias of statSync — known approx),
  `fs.readdirSync`, `fs.mkdirSync`, `fs.rmdirSync`, `fs.rmSync`,
  `fs.cpSync`, `fs.realpathSync` (alias of path.resolve — known
  approx), `fs.accessSync`.
- `process.versions` ALREADY exists, populated from the JS bootstrap
  in `globals.cpp` ~line 5355. It currently lies as
  `node: '14.0.0'` and exposes `ionpower` (no dash). The pass-1
  policy change rewires this to `node: '10.24.1'` and dashed
  `'ionpower-node'`.

So G's actual list shrinks to the genuinely-missing APIs:
`truncate`, `chown`, `utimes`, `fchmod`, `symlink`. (`appendFile`
is already there.)

### Working order

1. ✅ A: VERSION bump + `process.version='v10.24.1'` +
   `process.versions = { node, 'ionpower-node' }` from C++,
   trim/refresh JS-side shim. Smoke
   [`test/process_version_smoke.js`](../../../test/process_version_smoke.js).
2. ✅ B+C+D: `process.execPath`, `process.binding(name) → {}`,
   real `require('constants')` seed (O_*, S_IF*, errno).
   Smokes [`test/process_extras_smoke.js`](../../../test/process_extras_smoke.js)
   and [`test/constants_smoke.js`](../../../test/constants_smoke.js).
3. ✅ E: `index.json` resolution in `require.cpp` —
   `TryModuleExtensions` now tries `<base>/index.json` after
   `index.cjs`. Fixture under
   [`test/vendor/index_json_pkg/`](../../../test/vendor/index_json_pkg/),
   smoke [`test/index_json_resolve_smoke.js`](../../../test/index_json_resolve_smoke.js).
4. ✅ F: real `fs.readlink` / `fs.readlinkSync` backed by
   `readlink(2)`. Smoke
   [`test/fs_readlink_smoke.js`](../../../test/fs_readlink_smoke.js).
5. ✅ G: `fs.{truncate,chown,utimes,fchmod,symlink}` (sync + async).
   `fs.appendFile` was already present pre-v0.87. Smoke
   [`test/fs_extras2_smoke.js`](../../../test/fs_extras2_smoke.js).
   Also added `fs.lchown(Sync) = fs.chown(Sync)` alias (matches
   our existing `lstat = stat` approximation).
6. ⏳ Triad-build on G3 via
   `scripts/triad-build.sh ibookg37 g3 0.87`.
   Log: [`build-logs/g3-pass1.log`](build-logs/g3-pass1.log).
7. ⏳ Re-run npm install experiment, record next plateau.

### G3 triad-build pass 1: 2 FAILs caught + fixed (mid-session)

First triad-build run on ibookg37 shipped 1 build-phase clean +
~456-passing-1-failing summary on the FIRST test pass, then began a
retry per the script. I killed it mid-retry, fixed the regressions
in source, and re-ran.

Two failures, both side-effects of the `process.version` policy
change:

1. **`test/yargs_parser_smoke.js`** — yargs-parser hard-throws
   `yargs parser supports a minimum Node.js version of 12` at
   module-load time. Under v0.86 the throw site silently passed
   because `process.versions.node` was the lie `'14.0.0'`. Now
   that we report `'10.24.1'` honestly, the check fires.
   **Fix:** the smoke now sets
   `process.env.YARGS_MIN_NODE_VERSION = '10'` before
   `require('./vendor/yargs-parser.js')`. yargs-parser honors that
   env var as an override (its source: `Number(env) || 12`).
   We're not patching the vendor; the smoke is the right place
   for the override since the override is yargs-parser-specific.

2. **`test/fs_readlink_smoke.js`** (one I just added) — the
   "readlink on non-link should throw EINVAL" branch came back as
   `code: 'UNKNOWN'`. The C++ `ErrnoToNodeCode()` switch in
   [`src/node_compat/fs.cpp`](../../../src/node_compat/fs.cpp)
   only mapped a handful of errnos. EINVAL wasn't there. **Fix:**
   added EINVAL, EBADF, EAGAIN, EINTR, EBUSY, ENOSPC, EROFS, ELOOP,
   EXDEV, EPIPE, ENXIO to the switch. These are all errnos the new
   readlink/truncate/symlink/chown/utimes/fchmod paths can return.

Build log of the killed first run:
[`build-logs/g3-pass1.log`](build-logs/g3-pass1.log).
Re-run log: [`build-logs/g3-pass1-rerun.log`](build-logs/g3-pass1-rerun.log).

### npm install experiment, v0.87 — significant progress + new plateau

After the green triad-build, ran on ibookg37:
```
ssh ibookg37 'cd /Users/macuser/tmp/npm-test && rm -rf node_modules package-lock.json && \
  /opt/ionpower-node-0.87/bin/node /Users/macuser/tmp/npm-6.14.18/run-npm.js install mri'
```

**Trimmed wrapper:** dropped patches that the runtime now carries
natively — `process.version`, `process.versions.node`,
`process.execPath`, `__require_cache__['constants']`,
`process.binding`, `fs.readlink`. Wrapper is now ~10 lines (was 45)
and only retains the upstream-unsafe `Gauge.setWriteTo` defense plus
an uncaughtException handler. Snapshot at
[`build-logs/run-npm-v0.87.js`](build-logs/run-npm-v0.87.js).

**npm reaches deep into the install pipeline before failing now**:
- npm bootstrap loads cleanly (semver parse on `process.version`
  succeeds; graceful-fs's `O_SYMLINK` probe finds the constant).
- `lib/npm.js` config-load chain runs further than v0.86 — gets
  past `which()`/`isexe()` (process.execPath now real).
- `lib/install.js` reaches deep into `require('npm-lifecycle/index.js')`
  → `resolve-from`, where it hit two new gaps in sequence:
  1. `Module._nodeModulePaths is not a function` — closed in
     this session as a bonus pass-1 addition (small, harmless,
     resolve-from-shaped). Smoke
     [`test/module_node_paths_smoke.js`](../../../test/module_node_paths_smoke.js).
     Both `require('module')._nodeModulePaths(...)` (wrapper) and
     `Module.Module._nodeModulePaths(...)` (class) shapes work.
  2. After that, **`Module._resolveFilename is not a function`** —
     this IS the next plateau. resolve-from calls
     `Module._resolveFilename(spec, fakeParent)` to get an absolute
     path without loading. Real Node has this on the Module class;
     we don't have it (we only have the C++-side resolver, exposed
     to JS via `__require_native__` which loads-on-resolve).

A "glob error" stack also surfaces in the same run, deep inside
`mkdirp/index.js → graceful-fs/polyfills.js → _fsAsync`. Likely a
cascade from the `_resolveFilename` failure (one nextTick blowup
breaks invariants downstream), but worth confirming once
`_resolveFilename` is in place.

**Result so far:** `node_modules/mri/` was NOT created. We're
substantially further than v0.86 but not at end-to-end install.

**Pass 2 list (next session):**

1. `Module._resolveFilename(spec, parent)` — new C++ entry
   `__resolve_native__(dir, spec)` that calls our existing
   `ResolveModule` but doesn't `LoadModuleFile`. Then JS-side
   `Module._resolveFilename(spec, parent)` peels `parent.filename`
   into a directory and delegates.
2. Investigate the "glob error" cascade. Probably resolves
   itself with #1, but if not, it's another mkdirp/graceful-fs
   gap to chase.
3. Re-run `npm install mri`. If it works, the same prompt against
   a single-package-with-deps (e.g. `is-number`) is the next test.

Per the plan's "Out of scope for THIS session": defer release if
end-to-end install doesn't work. Ship v0.87 anyway since the
runtime is materially more capable than v0.86 — but cut release
notes that honestly mark this as "wave 1 closed; install pipeline
gaps now visible" rather than "npm install works".

### Judgment calls

- **C++-side `process.versions` instead of pure JS shim.** The plan
  said to add it from `process.cpp`. The existing JS shim (now
  rewritten) used to skip when versions existed; I kept the
  spidermonkey/v8/openssl augmentation in the shim so the C++ side
  doesn't have to know about TLS init order. Cleaner separation —
  C++ owns "we are Node 10 / ionpower-node 0.87", JS owns the
  decorations.
- **`process.binding` as JS-evaluated IIFE rather than a native
  function.** A native JS function would need `JS_NewFunction` and
  manual return-empty-object. The IIFE is two lines and produces
  the same observable behavior. Tradeoff is one tiny eval per
  process startup, totally fine.
- **`fs.lchown` alias for `fs.chown`.** True lchown(2) exists on
  darwin but isn't wired through our native bindings yet. The
  alias matches the existing `lstat = stat` approximation; bring-up
  for real lchown (and a real lstat) goes in a later pass when a
  consumer specifically needs the symlink-vs-target distinction.
- **chown smoke uses `(file, -1, -1)` no-op trick.** We don't
  expose `process.getuid()` or `stat.uid`/`stat.gid` yet, so we
  can't read-then-restore. The `-1, -1` form is the documented
  POSIX no-op. Kept the EPERM tolerance for sandboxed environments.
- **README install snippet bumped to 0.87 even though release isn't
  cut yet.** Matches the v0.85→v0.86 convention from the previous
  release commit. Release URLs will 404 until v0.87 ships, but the
  snippet is what the user will run after the release cuts.
