# Session plan: Node 10 parity, pass 2

## Read first

In order:

1. [`../2026-05-10-session-1-node-10-parity-pass-1/notes.md`](../2026-05-10-session-1-node-10-parity-pass-1/notes.md)
   — what pass 1 closed (8 wave-1 gaps + bonus
   `Module._nodeModulePaths`), what triad-build verified
   (458/458 PASS on G3), and the pass-2 list seeded at the bottom.
2. [`../2026-05-10-session-1-node-10-parity-pass-1/build-logs/npm-install-mri-v0.87.txt`](../2026-05-10-session-1-node-10-parity-pass-1/build-logs/npm-install-mri-v0.87.txt)
   — the npm experiment output that surfaced the new plateau, and
   the trimmed wrapper at
   [`../2026-05-10-session-1-node-10-parity-pass-1/build-logs/run-npm-v0.87.js`](../2026-05-10-session-1-node-10-parity-pass-1/build-logs/run-npm-v0.87.js).
3. [`../../plans/node-target-version.md`](../../plans/node-target-version.md)
   — the Node 10.24.1 parity target the project is now measured
   against.

## Context in one paragraph

ionpower-node v0.87 shipped (locally — release deferred per pass-1
plan) on 2026-05-10. The v0.86 → v0.87 run closed all of the wave-1
runtime gaps that had blocked npm 6.14.18 from leaving its own
bootstrap; npm now reaches deep into `lib/install.js` →
`npm-lifecycle/index.js` → `resolve-from`, where it dies on the
next plateau. Pass 2 closes that plateau and any cascade behind it,
then re-runs `npm install mri` end-to-end. Pass 2 is much smaller
than pass 1 — there's basically one gap, possibly two.

## Scope

### A. `Module._resolveFilename(spec, parent)`

`resolve-from` (called from `npm-lifecycle/index.js:21`) does:

```js
const Module = require('module');
const fileNameOrPath = Module._resolveFilename(moduleId, fakeParent);
```

Real Node has `_resolveFilename` as the canonical "resolve-only,
don't load" entry. We have a working C++ resolver
(`ResolveModule()` in `src/node_compat/require.cpp`) but no
JS-exposed resolve-only entry — only `__require_native__(dir, spec)`
which always loads.

**Plan:**

1. In `src/node_compat/require.cpp`, expose a new C++ function
   `__resolve_native__(dir, spec)` that calls `ResolveModule()` and
   returns the absolute resolved path as a string (or throws if not
   found). 5–10 lines, mirrors `RequireNative` minus the file-load
   step.
2. In `src/node_compat/globals.cpp` `kBootstrapJS`, add
   `Module._resolveFilename(spec, parent)`:
   - If `parent` has `.filename`, use `dirname(parent.filename)`.
   - Else fall back to `process.cwd()`.
   - Call `__resolve_native__(dir, spec)`.
   - Return the resolved path.
   - On not-found, throw an Error with `code: 'MODULE_NOT_FOUND'`
     (Node's contract).
3. Mirror onto the wrapper-object shape too:
   `module_core._resolveFilename = Module._resolveFilename`
   (resolve-from uses the wrapper-object form, same as
   `_nodeModulePaths` did in pass 1).
4. Smoke: `test/module_resolve_filename_smoke.js`. Cover:
   relative spec from a known directory, bare spec resolved via
   `node_modules/`, `node:` prefix stripped (real Node does
   this), MODULE_NOT_FOUND error shape.

### B. The "glob error" cascade (investigate)

The pass-1 npm run also surfaced:

```
glob error {
  "stack": "_fsAsync/<@<bootstrap>:95:19
            go$readdir@.../graceful-fs/graceful-fs.js:206:1
            ...
            mkdirP/</<@.../mkdirp/index.js:51:26
            callback@.../graceful-fs/polyfills.js:306:17
            _fsAsync/</<@<bootstrap>:96:44
            this.__fire_due_timers__@<bootstrap>:4689:13"
}
```

Likely a cascade from the `_resolveFilename` failure (one nextTick
blowup, then async callbacks fire on stale state). **First step in
pass 2: re-run npm install AFTER A lands; if the glob error is
gone, A was the root cause.** If it still appears:

- Capture the actual error message (not just the stack — the
  wrapper logs only the stack). Patch the wrapper to log
  `err.message` + `err.code`.
- Likely candidates: a missing fs op in the mkdirp chain, an
  errno code we don't map, or a graceful-fs polyfill that
  monkey-patches an fs API we exposed in pass 1 in an
  incompatible way.

### C. Re-run `npm install mri` end-to-end

After A (and B if needed), on ibookg37:

```
ssh ibookg37 'cd /Users/macuser/tmp/npm-test && \
  rm -rf node_modules package-lock.json && \
  /opt/ionpower-node-0.87/bin/node \
    /Users/macuser/tmp/npm-6.14.18/run-npm.js install mri'
```

(Or update `/opt/ionpower-node-0.87` → next bumped version if A+B
moves us to v0.88.)

If `node_modules/mri/` lands: VICTORY. Cut the v0.88 release with
the pass-1 + pass-2 changes bundled (since v0.87 was deferred).
Capture timing in the session notes. Propose `demos/npm-install/`
as a real installer demo (vs the existing single-package
`demos/npm-fetch/`).

If it hits a third plateau: capture as pass-3 list. Should be at
most one or two more gaps if the path is genuinely "install
pipeline" rather than "deeper module-class internals".

### D. Try a single-dep package next

If `mri` (zero deps) installs cleanly, try `is-number` (one dep)
or `cuid` (small dep tree). The transitive-deps code path is
slightly different and may surface a different gap subset. Queue
as session 3 if it falls out of scope.

## Out of scope for this session

- `Module._load`, `Module._compile`, the rest of the Module
  internals surface. Add when a real consumer surfaces.
- ES modules as first-class modules. Still punted (needs SM 60+).
- `process.binding('fs').writeBuffers` real implementation.
  Stub-returning-{} stands until something actually calls it.
- `os.constants` proper namespace (Node 12+ refinement). The
  `require('constants')` seed from pass 1 is the bridge; if a
  library actually needs `os.constants.signals`, queue that as
  pass 3+.

## Risk / blast radius

`Module._resolveFilename` is additive (new method). Same
risk profile as pass 1 — verify with full `make test-all` on G3.
The only existing thing it could break is a library that already
shipped its own `_resolveFilename` polyfill — and if such a
library was in our vendor tree, pass 1 would have already broken
when we added `_nodeModulePaths`.

## Working order

1. Read the three "Read first" docs.
2. Add A (`__resolve_native__` C++ + JS `Module._resolveFilename`)
   + smoke. One commit.
3. Triad-build on G3 via `scripts/triad-build.sh ibookg37 g3 0.88`
   (bumped from 0.87). `make test-all` must pass clean.
4. Re-run npm install. Confirm whether the glob error survives.
5. If glob error survives: investigate B per the steps above.
6. If end-to-end works: cut v0.88 release with pass-1 + pass-2
   bundled (since pass-1 was deferred). Tarball is on ibookg37
   already; just regenerate after the rebuild. Then propose
   `demos/npm-install/`.

## Current runtime state (start of this session)

- Local repo `main` is at commit `67189a1` (docs/sessions for v0.87)
  with `a95eda7` (v0.87 runtime) underneath.
- ibookg37 has `/opt/ionpower-node-0.87/bin/node` installed and
  `make test-all` shows 458/458 PASS as of the pass-1 build log.
  But it ALSO has the bonus `Module._nodeModulePaths` change that
  was rebuilt incrementally after the official triad-build —
  if you want a clean pass-1 baseline, re-run
  `scripts/triad-build.sh ibookg37 g3 0.87` first.
- Tarball `ibookg37:/tmp/ionpower-node-0.87-g3-ppc.tar.gz` exists
  (with the bonus change baked in). Not yet uploaded to GitHub.
- VERSION in repo is `0.87`. Bump to `0.88` as the first pass-2
  edit.

## Quick references

- pass-1 notes:
  [`../2026-05-10-session-1-node-10-parity-pass-1/notes.md`](../2026-05-10-session-1-node-10-parity-pass-1/notes.md)
- pass-1 release notes (deferred):
  [`../2026-05-10-session-1-node-10-parity-pass-1/release-notes/v0.87.md`](../2026-05-10-session-1-node-10-parity-pass-1/release-notes/v0.87.md)
- npm experiment output:
  [`../2026-05-10-session-1-node-10-parity-pass-1/build-logs/npm-install-mri-v0.87.txt`](../2026-05-10-session-1-node-10-parity-pass-1/build-logs/npm-install-mri-v0.87.txt)
- C++ resolver to extend:
  [`../../../src/node_compat/require.cpp`](../../../src/node_compat/require.cpp)
  (`ResolveModule`, `RequireNative`).
- JS Module class to extend:
  [`../../../src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
  (`kBootstrapJS` Module class block, around the
  `Module._nodeModulePaths` we added in pass 1).
