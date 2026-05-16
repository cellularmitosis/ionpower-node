# Session notes — 050: Node 10 parity pass 16

Handoff in: [`../049-node-10-parity-pass-15/handoff-pass-16.md`](../049-node-10-parity-pass-15/handoff-pass-16.md).
Pass-15 notes: [`../049-node-10-parity-pass-15/notes.md`](../049-node-10-parity-pass-15/notes.md).
v1.0 release notes (as shipped): [`../049-node-10-parity-pass-15/release-notes/v1.0.md`](../049-node-10-parity-pass-15/release-notes/v1.0.md).

## State at the start

- v1.0 shipped (tag + GitHub release + binaries installed on all three
  triad hosts at `/opt/ionpower-node-1.0/`).
- `main` is clean at `fb67db0`.
- Babel disk cache `~/.ionpower-cache/babel-v1/` on G3 warm with v0.99 +
  pass-14 + pass-15 + v1.0 transpiles (~1000 entries).
- Wave-2 survey artifacts live under
  `/Users/macuser/tmp/survey-048/` on G3 (intact, do not wipe).

## Working order this pass

Per the pass-16 handoff:

1. Wave-3 survey — 28 popular Node-10-era packages through
   `survey-one.sh` against the v1.0 binary on G3. Highest signal /
   hour.
2. Two-layer require shim audit — preemptively add `require.main`,
   `require.extensions`, `require.resolve.paths` propagation + smokes
   so future pass doesn't repeat the require.cache foot-gun.
3. Analyze wave-3 results, group failures by category. If two or
   more packages hit the same gap, that's pass-17 fuel.
4. Cost-out study of BigInt and/or ES2018-regex polyfills only if
   wave-3 surfaces fresh evidence we don't already have.

**Mid-session pivot**: at 23:26 a round-2 handoff from sister project
lumo-darwin8-ppc arrived at
[`../050-handoff-from-lumo/handoff-from-lumo.md`](../050-handoff-from-lumo/handoff-from-lumo.md)
with six small asks discovered during the Lumo 1.10.1 / CLJS 1.10.520
bring-up. After the original three items completed, the user
authorized folding all six lumo asks into pass 16 — so the pass scope
grew to also include MODULE_NOT_FOUND error codes, util/v8 stubs, and
a readline cluster (`emitKeypressEvents`, `_setRawMode`, auto-resume,
input/output aliases).

## What happened

### 1. Wave-3 survey

Staged in `/Users/macuser/tmp/survey-050/` on G3 (separate from
wave-2's survey-048 so both stay intact for cross-reference). 28
packages across 5 categories. Total wall-clock: 92 minutes, average
~200 s/package (npm install on G3 is the slow pole — babel-cache
warm meant require steps were fast).

**Final tally: 16 OK / 9 REQUIRE_FAIL / 3 INSTALL_FAIL.**

OK (16): commander@10, cosmiconfig, cli-table3, enquirer, mysql2,
ioredis, csv-parse, csv-stringify, xml2js, fast-xml-parser,
papaparse, bcryptjs, jsonwebtoken, extract-zip, unzipper, tar-stream.

REQUIRE_FAIL (9): update-notifier, boxen, chalk@5, figlet, pg,
redis@4, jose, archiver, tar.

INSTALL_FAIL (3): knex, cheerio (both `cb() never called` — npm
flake), bcrypt (native addon — `require.main is undefined` in
npm-lifecycle; see "Best finding" below).

Full per-package logs in
[`build-logs/survey-wave-3-logs/`](build-logs/survey-wave-3-logs/);
summary and progress TSVs at
[`build-logs/summary.tsv`](build-logs/summary.tsv) and
[`build-logs/progress.tsv`](build-logs/progress.tsv).

### 2. Two-layer require shim audit

Per the handoff: `require.main`, `require.extensions`, and
`require.resolve.paths` were missing from the shim. Pass-15 documented
the foot-gun: anything added to `__make_require__` inside
[`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp)
is invisible to user code unless the rewrap in
[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
(around line 10470) explicitly forwards it. Today the rewrap
forwards `resolve` + `cache`.

Implementation:

- **`require.cpp`**:
  - `LoadModuleFile`: enrich the module wrapper with `module.id` +
    `module.filename` (both = absolute path). Stash the very first
    constructed module as `__require_main_module__` (only the first
    writer wins) so it represents the entry script.
  - `InstallRequire`: build a shared `__require_extensions__` stub
    object with `.js` / `.json` / `.node` set to no-op functions
    (writes accepted, but custom handlers are not honoured — Node's
    own ecosystem treats this as deprecated).
  - `__make_require__`: attach `f.extensions = __require_extensions__`,
    `f.resolve.paths = function(spec) { ... }` (ancestor walk of
    `<dir>/node_modules`, or `null` for any builtin pre-seeded in
    `__require_cache__`), and a getter for `f.main` that reads
    `__require_main_module__` lazily (getter is needed because the
    entry's module is stashed AFTER `__make_require__` returns its
    closure but BEFORE the wrapper runs).

- **`globals.cpp` rewrap**:
  - Added `wrapped.extensions = req.extensions;` (plain copy — shared
    object).
  - Added `Object.defineProperty(wrapped, 'main', { get: ... })` —
    cannot plain-copy a getter or it freezes at rewrap time (which
    runs at bootstrap, before any module loads, so the cached value
    would always be null).
  - `wrapped.resolve.paths` rides for free on `req.resolve` already
    because `wrapped.resolve = req.resolve` shares the same function
    object — properties attached to that function are visible from
    either side. (Documented inline.)
  - Added a comment at the rewrap warning future-future-Claude that
    new factory properties MUST be forwarded here.

Three new smokes wired into
[`scripts/test-list-core.txt`](../../../scripts/test-list-core.txt):

- [`test/require_main_smoke.js`](../../../test/require_main_smoke.js)
  — asserts `require.main === module` for the entry script and
  `require.main.filename === __filename`.
- [`test/require_extensions_smoke.js`](../../../test/require_extensions_smoke.js)
  — asserts `.js`, `.json`, `.node` are present + readable as
  functions + writes don't throw.
- [`test/require_resolve_paths_smoke.js`](../../../test/require_resolve_paths_smoke.js)
  — asserts builtins → `null`, non-builtins → array of ancestor
  `node_modules` dirs.

Verification: incremental builds on all three triad hosts. **29 core
+ 495 libs / 0 fail on G3, G4, G5.**

### 3. Best finding — the require.main shim is load-bearing

During the wave-3 survey, bcrypt fell over INSTALL_FAIL with:

```
TypeError: require.main is undefined
  at lifecycle/</</<@/Users/macuser/tmp/npm-6.14.18/node_modules/npm-lifecycle/index.js:96:9
```

The crash is inside **npm's own** `npm-lifecycle` package — npm uses
`require.main` to compute the script working directory. Pre-pass-16
binaries silently shipped this gap, but it only manifested when a
package (bcrypt) had a `install` lifecycle script, since simple
require-only packages never hit `npm-lifecycle/index.js:96`.

After the shim audit landed, retrying bcrypt on G3 produces a
**different** failure — much further along:

```
TypeError: readStream.pipe is not a function
  at createLineStream@/Users/macuser/tmp/npm-6.14.18/node_modules/byline/lib/byline.js:53:3
  ... at runCmd_@.../npm-lifecycle/index.js:337:3
```

npm-lifecycle ran from line 96 past line 337 (where it spawns the
lifecycle child-process and pipes the stream into byline). The new
failure is `child_process.spawn().stdout.pipe` not existing — a
separate gap (probably our spawn return value lacks the stdio
streams, or `stdout` is null).

**Takeaway**: the shim was strictly defensive on paper, but it had a
practical impact too. Some packages were broken by *npm itself*
crashing on lifecycle hooks, not by the package's own code. That
class of failure won't surface in our test smokes but will surface
on any package that runs an install / preinstall / postinstall
script.

### 4. Wave-3 categorized analysis

#### A. Already fixed in pass-16's shim audit (1)

- **bcrypt** — was `require.main is undefined` in npm-lifecycle.
  Now fails further along (`readStream.pipe is not a function` —
  child_process spawn stdio gap). Bcrypt itself is a native addon
  that won't load on PPC even if install succeeds; the value of the
  fix is the unblocked npm-lifecycle, not bcrypt-the-package.

#### B. Genuine compat gaps, small-to-medium effort (3)

- **pg** — `this.buffer.write is not a function` in
  pg-protocol/dist/buffer-writer.js:44. Likely missing
  `Buffer.prototype.write(string, offset, length, encoding)` on our
  Buffer impl. Small fix if confirmed.
- **redis@4** — `cannot find module '.' from
  /.../client/dist/lib/cluster`. Our resolver doesn't handle the
  `require('.')` specifier (load `<dir>/index.js` or the directory's
  package.json `main`). Small fix.
- **figlet** — `path__namespace.dirname is not a function`. The
  Babel-style ESM-to-CJS interop builds a namespace via
  `for (const k in path) n[k] = path[k];` — if `path.dirname` isn't
  *enumerable* on our path module, it gets skipped. Likely path
  module exposes its methods via `JS_DefineProperty` without
  `JSPROP_ENUMERATE`. Small fix.

#### C. Babel parse-fallback didn't kick in (2)

- **archiver** — `async functions are not enabled in the parser`
  on archiver/lib/core.js:9. SM45's parser gates async-function
  syntax behind a flag; we have working `async`/`await` for our
  own bootstrap, but the parser flag may not be set for required
  modules. Worth investigating: is it a SM-options change in
  require.cpp's compile options, or is babel supposed to lower it
  and we're hitting the lazy-parse-style "babel never ran" trap
  on a non-syntax-error path?
- **tar@7** — `missing : after property id`. Generic SM45 parse
  error, which (post-pass-15) should immediately trigger babel
  fallback. Either babel's preset doesn't cover the syntax used
  (decorators, private class fields, etc.) or this is another
  fallback-skipped path. Both worth chasing.

If both are the same root cause ("babel didn't fire on a runtime
or compile path"), that's a single fix with broad reach. Pass-17
candidate.

#### D. Ecosystem ESM / modernity (3)

- **chalk@5** — ESM-only + uses package.json `"imports"` map for
  `#ansi-styles`. We don't support the imports map. Documented gap.
  No business pinning chalk@5 specifically; chalk@4 works.
- **jose** — `import declarations may only appear at top level of
  a module` on a `dist/webapi/...` CJS file. jose ships ESM in its
  CJS dir (oops on jose's side, or it's a webapi-only entry that
  the package's main field steers around — we may be hitting it
  via deep import).
- **boxen** — `Intl is not defined` from string-width. SM45's Intl
  is build-time-gated and our libjs_static.a doesn't include it.
  A polyfill is possible but `Intl.Segmenter` is non-trivial
  (Unicode grapheme cluster segmentation). Defer.

#### E. Genuine compat gap with significant cost (1)

- **update-notifier** — `util.promisify: fn must be a function`
  inside stubborn-fs/dist/index.js:21. stubborn-fs polyfills
  `fs.fsync` and other functions; if our `fs.fsync` isn't exposed
  as a function (we don't actually do fsync on Tiger), stubborn-fs
  tries to `util.promisify(undefined)` and our impl correctly
  rejects. Trade-off: should `util.promisify(non-function)` return
  a stub that throws when called (Node-compatible-ish) or throw at
  promisify-time (our current behaviour)? Node throws at
  promisify-time too — so this isn't our gap, it's stubborn-fs's
  bug. Mark as ecosystem.

#### F. npm flakes (2)

- **knex**, **cheerio** — `npm cb() never called` from the same
  bluebird unreachable-after-return code path that's bitten before.
  Retry has worked on similar flakes; both worth a single retry
  attempt at the start of pass 17.

#### G. Native addon (1)

- **bcrypt** — see category A. Won't load on PPC regardless; the
  shim cleared the install crash, but the runtime require would
  still fail at the native `.node` load step. Use bcryptjs (which
  wave-3 confirmed works).

### Score-card across two waves

| Wave | Total | OK | %     | REQUIRE_FAIL | INSTALL_FAIL |
|------|-------|----|-------|--------------|--------------|
| 2    |   32  | 24 | 75 %  | 4            | 4            |
| 3    |   28  | 16 | 57 %  | 9            | 3            |

Wave-3 is harder than wave-2 by design (CLI / TUI / DB / archive
categories pull in more bleeding-edge ESM packages and native
addons). The 57 % baseline is still decent for "yolo
require everything popular."

### 5. Lumo round-2 asks (six fixes folded in mid-session)

The handoff at
[`../050-handoff-from-lumo/handoff-from-lumo.md`](../050-handoff-from-lumo/handoff-from-lumo.md)
documented six API-surface gaps caught during the Lumo bring-up.
All six are small, well-scoped no-ops or thin shims. The user
authorized folding them into pass 16.

#### Ask 1 — `require()` MODULE_NOT_FOUND error code

Highest blast radius. Pre-pass-16 our `RequireNative` /
`ResolveNative` in
[`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp)
threw via `JS_ReportError` — which builds an Error whose `.code` is
undefined. Modern Node libraries branch on `e.code ===
'MODULE_NOT_FOUND'` to distinguish a missing optional dep from a
real load-time error; the missing code silently broke that branch.

Fix: new helper `ThrowModuleNotFound` modelled exactly on
`fs.cpp`'s `ThrowFsError` (same `JS_New`/`JS_DefineProperty`
pattern). Constructs a real `Error` object with
`.code = 'MODULE_NOT_FOUND'` + `.requireStack = []`. Routed both
`RequireNative` and `ResolveNative` through it.

While there, also switched `__make_require__`'s `f.resolve` from
the stub `(spec) => dir + '/' + spec` (which never threw) to call
`__resolve_native__` — so `require.resolve()` now throws
MODULE_NOT_FOUND on a miss, matching Node. Smoke at
[`test/require_module_not_found_smoke.js`](../../../test/require_module_not_found_smoke.js)
covers relative / absolute / bare specifiers plus `require.resolve`.

#### Asks 2-6 + bonus — process / v8 / readline shims

Five smaller surface tweaks, all in process.cpp + globals.cpp:

| Ask | Where | What |
|-----|-------|------|
| 2   | `process.cpp` (line ~402 binding switch) | `process.binding('util')` now returns `{ startSigintWatchdog, stopSigintWatchdog, watchdogHasPendingSigint }` no-ops — Lumo's `cljs.js` wraps `vm.runInThisContext` with these around every form |
| 3   | `globals.cpp` (v8 stub line ~6958) | `v8.setFlagsFromString` no-op — Lumo calls `--use_strict` at boot |
| 4   | `globals.cpp` (readline module line ~9758) | `readline.emitKeypressEvents` no-op — basic line input still works, interactive keypress decoding lost (acceptable for non-paredit use) |
| 5   | `globals.cpp` (`_ReadlineInterface` line ~9694) | `_ReadlineInterface.prototype._setRawMode(mode)` delegates to `input.setRawMode` and returns previous `isRaw` (Node contract) |
| 6   | `globals.cpp` (`_ReadlineInterface` constructor) | After `this._input.on('data', this._onData)`, kick the stream into flowing mode via `this._input.resume()`. **Real bug, not a stub** — pty stdin was sitting paused even with a 'data' listener attached, so eval output never appeared during interactive REPL use |
| Bonus | `globals.cpp` (`_ReadlineInterface` constructor) | Aliases `this.input = this._input; this.output = this._output;` — Lumo's bundle.js writes to `rl.output` for redraws |

Combined smoke at
[`test/lumo_asks_smoke.js`](../../../test/lumo_asks_smoke.js)
exercises all six surfaces using a FakeStream that tracks whether
`.resume()` was called (proves ask 6) and whether `.setRawMode()`
was invoked with the right value (proves ask 5).

#### Test-list adds (2 more)

[`scripts/test-list-core.txt`](../../../scripts/test-list-core.txt)
gained `require_module_not_found_smoke.js` and `lumo_asks_smoke.js`
on top of the three from the original shim audit. Five total new
smokes in pass 16.

#### Verification

G4 / G5 / G3 all rebuilt + full-sweeped with all six asks applied,
on top of the original shim audit. Final tally per host: **31 core
+ 495 libs = 526 PASS / 0 FAIL**.

The asks unblock the lumo bundle: with these landed, the
80-line `lumo-wrapper.js` shrinks to roughly `require('./bundle.js')`
plus possibly an env var. The patch-bundle.sh patches on the lumo
side become unnecessary except for genuine bundler-packaging issues
(async-strip, isBundled flat-path).

## Lessons / followups

- **Defensive shims sometimes fix real bugs.** The require.main
  audit was framed as "preemptive" but turned out to fix a real
  failure path in npm-lifecycle. Worth being more aggressive about
  filling in Node API surface where the cost is small — for any
  property documented in the Node 10 docs as part of Module /
  require, just ship a reasonable stub. Pass 17 punch list candidate:
  go through `require.*`, `module.*`, `process.*` and shim the
  cheap ones.
- **Two-layer-require-shim foot-gun is now documented in the source.**
  Both the inner factory (require.cpp:`__make_require__`) and the
  outer rewrap (globals.cpp line ~10470) have inline comments
  warning the next reader that new properties must be forwarded.
  Next-future-Claude should not repeat pass-15's `require.cache`
  trap.
- **Wave-3 surfaced two suspected babel-fallback misses
  (archiver, tar).** If a SyntaxError in module body doesn't
  trigger babel fallback, that's a regression we need to
  understand. The `setDisableLazyParsing(true)` from pass-15 should
  surface parse errors at compile time when the fallback is
  watching — but archiver and tar both reported parse errors that
  weren't lowered. First task pass 17: reproduce locally and figure
  out whether (a) babel preset can't handle the syntax or (b) the
  fallback isn't running.
