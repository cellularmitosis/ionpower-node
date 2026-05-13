# Session notes — 2026-05-09 session 2: npm 6.14.18 bootstrap

Plan: [`plan.md`](plan.md). Source convo:
[`../../convos/claude-conversation-2026-05-01-6478620b.md`](../../convos/claude-conversation-2026-05-01-6478620b.md)
lines ~166-192 (npm-tooling discussion, including the
`ied` alternative we may try next if npm 6 turns out to be too painful).

Following the v0.86 session's release. Goal was a bring-up
experiment: does npm 6.14.18 even run on ionpower-node v0.86, and
if not, what's the gap?

## TL;DR

**Yes — npm 6.14.18 runs on the v0.86 runtime.**
`npm-cli.js --version` prints `6.14.18` against
`/opt/ionpower-node-0.86/bin/node` on a 1999 PowerBook G3 with only
**three small monkey-patches** in a 45-line wrapper script.

`npm install mri` partially executes — it gets through npm bootstrap,
through config load, into the actual `lib/install.js` command flow,
and as far as `pacote/extract.js` (the tarball-extraction layer)
before hitting more missing fs APIs. Each gap is small and well-scoped.
None of them require structural runtime work — they are individual
fs/process additions, ~5-15 lines each in our globals.cpp.

## Setup

- Downloaded `npm-6.14.18.tgz` from registry.npmjs.org on uranium
  (4.85 MB, 4215 files, 357 vendored deps in `node_modules/`).
- `tar xzf` extracted to `/Users/macuser/tmp/npm-6.14.18` on
  ibookg37 (29 MB unpacked).
- Wrote `/Users/macuser/tmp/npm-6.14.18/run-npm.js` — wrapper
  script that monkey-patches missing surface in JS before requiring
  `bin/npm-cli.js`. Snapshot at
  [`build-logs/run-npm.js`](build-logs/run-npm.js).
- All experimentation done with the installed v0.86 binary at
  `/opt/ionpower-node-0.86/bin/node`.

## Iteration log

Each step here is one round of "run, fail, capture exact error,
patch in wrapper, retry."

### 1. `process.version` semver gate

`npm-cli.js` calls `lib/utils/unsupported.js → checkVersion(process.version)`
which strips a `-suffix`, then calls `semver.satisfies(...)` against the
package.json's `engines.node` (`>=6 <11`).

Our `process.version` was `ionpower-node-0.86`. After
`replace(/-.*$/, '')` it became `ionpower` — semver throws
`Invalid Version: ionpower`.

**Patch:** in wrapper, set `process.version = 'v10.24.1'` (last of the
v10 series; pre-arborist npm targets Node 10) and seed
`process.versions.node = '10.24.1'`.

**Real fix candidate:** decide a project-level convention. Either
make our `process.version` a real semver (`v10.24.1+ionpower-node-0.86`,
prerelease form `v10.24.1-ionpower-node-0.86`, or just `v0.86.0` with a
separate identity field), or live with the wrapper patch indefinitely.
Affects every Node-version-sniffing library, not just npm. Worth a
dedicated decision doc.

### 2. `require('constants')` missing

`graceful-fs/polyfills.js:` does `var constants = require('constants')`
unconditionally, then guards on `constants.hasOwnProperty('O_SYMLINK')`.
We don't seed `constants` in `__require_cache__`.

**Patch:** in wrapper, `__require_cache__['constants'] = {}`. Empty
stub passes the hasOwnProperty guards (graceful-fs takes its
no-op-on-non-Linux branches).

**Real fix candidate:** add `require('constants')` to the seeded
builtins in `globals.cpp` (alongside `repl` / `v8` / etc.). Real Node
has it (deprecated alias for `os.constants`), so a real exposure is
better than a stub. ~10 lines.

### 3. `process.execPath` missing

`lib/npm.js:251` calls `which(process.argv[0], cb)`, which calls
isexe→fs.stat→graceful-fs polyfill→cb. The cb does
`node.toUpperCase() !== process.execPath.toUpperCase()`, but
`process.execPath` is `undefined` on our runtime.

**Patch:** in wrapper, `process.execPath = process.argv[0]`.

**Real fix candidate:** add `process.execPath` to `process.cpp`. Same
shape as `process.argv[0]` — the absolute path to the runtime
binary. ~5 lines. Real Node ALSO has this; we just never added it.

### 4. `index.json`-only modules don't resolve

`spdx-license-ids` and `spdx-exceptions` ship only an `index.json` (no
`index.js`) with no `"main"` in their `package.json`. Real Node's
resolver tries `<dir>/index.{js,json,node}` after package.json. Our
`TryModuleExtensions` only tries `<dir>/index.js` and `<dir>/index.cjs`.

**Patch:** in the npm install dir, wrote tiny `index.js`:
```js
module.exports = require("./index.json");
```
in both `node_modules/spdx-{exceptions,license-ids}/`.

**Real fix candidate:** add `<base>/index.json` to
`TryModuleExtensions` in `require.cpp`. ~3 lines. Worth doing; this
is a real Node behavior we're missing across the board.

### 5. `Gauge.setWriteTo` undefined-stream defense

After log.stream is set from `config.get('logstream')` (which can
return undefined when the config defaults haven't propagated correctly
on our setup), `npmlog`'s setter fires `gauge.setWriteTo(undefined,
undefined)`, and `gauge` derefs `writeTo.isTTY` → throws.

**Patch:** monkey-patch `Gauge.prototype.setWriteTo` in wrapper to
default writeTo to `process.stderr`.

**Real fix candidate:** none — this is upstream gauge being unsafe
about an `undefined` argument it shouldn't have received. Root cause
might be our config-defaults handling for `Stream`-typed values, but
that's a deeper-dive into npmconf. The patch is fine as-is.

### 6. `fs.readlink` missing

`read-package-tree/realpath.js:11` does `promisify(fs.readlink)`. Our
runtime has `fs.lstat` but not `fs.readlink`.

**Patch:** in wrapper, stub `fs.readlink` (and `fs.readlinkSync`)
that returns EINVAL — equivalent to "this isn't a symlink". The
realpath caller catches and treats the path as canonical.

**Real fix candidate:** add real `fs.readlink` / `fs.readlinkSync`
backed by the `readlink(2)` syscall. ~15 lines in `fs.cpp`. Worth
doing — symlinks are real on darwin and the EINVAL stub is wrong for
actually-symlinked paths.

### 7. `process.binding('fs')` missing

`fs-minipass/index.js:7` calls `process.binding('fs')` to grab
internal C++ binding methods (`writeBuffers`, `FSReqWrap`).

**Patch:** in wrapper, `process.binding = function (name) { return {}; }`.
Module load now succeeds; if anything actually calls
`binding.writeBuffers(...)` later, it'll fail there instead.

**Real fix candidate:** keep the empty-stub at runtime level — we
don't want to actually expose internal SpiderMonkey bindings via
`process.binding`. Mark the API as deprecated-on-our-runtime but
returning a benign stub. ~10 lines.

### 8. `fs.truncate` (and likely friends) missing

After all of the above, `pacote/extract.js:16` does
`BB.promisify(fs.truncate)`. Bluebird throws `expecting a function`
because `fs.truncate` is undefined.

**Stopped here** — this is the same pattern as readlink and probably
recurs for `fs.truncate`, `fs.appendFile`, `fs.chown`, `fs.utimes`,
`fs.fchmod`, etc. (every fs API a normal install path touches). All
small, all individually tractable.

## What WORKS today

- `npm-cli.js --version` → prints `6.14.18`
- All of npm's bootstrap loads:
  - `lib/utils/unsupported.js`, `npmlog`, `lib/npm.js`, `lib/config/core.js`,
    npmconf, semver, all of npm's deep require chain
  - `node-fetch-npm`, `which`, `isexe`, `graceful-fs`, `mkdirp`, `glob`
  - `gauge` (after the setWriteTo patch)
  - `read-package-tree`, `read-package-json`, `normalize-package-data`,
    `validate-npm-package-license`, `spdx-expression-parse`,
    `spdx-license-ids` (after the index.json workaround)
  - `bluebird` (with two "unreachable code after return statement"
    warnings from SM45 — perf-only, not correctness)
  - `tar`, `pacote/lib/extract-stream.js` (loads OK; fails at use of fs.truncate)
  - `lib/install.js`, `lib/install/deps.js`, `lib/fetch-package-metadata.js`
- The single [[Prototype]] warning we already knew about (one site in
  node-fetch-npm, perf-only).

## What's the rough finish-line distance?

Three categories of remaining work:

**Category A: small fs API additions (~30-90 min runtime work).**
Probably the rest of: `fs.truncate`, `fs.appendFile`, `fs.chown`,
`fs.utimes`, `fs.fchmod`, `fs.symlink`, `fs.realpath`. Each is a
~10-line darwin syscall + sync/async pair. Realistic to land in one
commit.

**Category B: `process.binding('fs')` fidelity (~30 min).**
fs-minipass uses `binding.writeBuffers(fd, chunks, position, cb)`
for batched writes. Could stub by routing through a JS for-loop
calling `fs.writeSync`. Lossy on perf, fine on correctness.

**Category C: configuration pipeline diagnosis (~unknown).**
The `Gauge.setWriteTo` undefined-stream issue might be a symptom of
npmconf defaults not propagating Stream-typed values correctly. Could
be a one-line config gap, could be deeper. Defer until categories A+B
unblock the install path.

If categories A and B clear up cleanly, we have an end-to-end
`npm install <single-package>` story (subject to recursive deps
making the same gaps reappear in transitive packages — but the gap
list will plateau quickly).

## Recommended next session

1. **One runtime commit** picking up the small fixes (`require('constants')`,
   `process.execPath`, `index.json` resolution, `fs.readlink`,
   `process.binding` stub, the fs.{truncate,appendFile,chown,utimes,fchmod,symlink}
   additions). Smokes for each.
2. Re-run the install experiment. Find the next plateau.
3. If it goes end-to-end on `mri` (which has zero deps), try a
   deps-having package like `is-number` (1 dep) and `cuid` (small).

The `process.version` decision (real fix #1) deserves its own
discussion — affects every Node-version-sniffing lib, not just npm.
Consider opening a plan doc with the options.

If the runtime work in step 1 turns out to be more than ~half a day,
pivot to the **ied** alternative captured in the v0.86 source convo.
ied is abandoned-2017 so it predates a lot of modern Node API surface
that npm 6 has accreted, and might actually have a *smaller* gap list
than npm itself.

## Artifacts

- [`build-logs/run-npm.js`](build-logs/run-npm.js) — the 45-line
  wrapper at the point where this session stopped (--version works,
  install reaches pacote/extract.js).
- Working tree on ibookg37: `/Users/macuser/tmp/npm-6.14.18/`
  (npm itself) + `/Users/macuser/tmp/npm-test/` (clean install dir).
