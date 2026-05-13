# Session 1 plan: Node 10 parity, pass 1

## Read first

In order:

1. [`../../plans/node-target-version.md`](../../plans/node-target-version.md)
   — the decision (made 2026-05-10) to target Node 10.24.1 and the
   roadmap framing this session is the first concrete pass at.
2. [`../033-npm-6-bootstrap/notes.md`](../033-npm-6-bootstrap/notes.md)
   — the npm 6.14.18 bring-up that surfaced the gap list this
   session is closing. Especially the iteration log and the
   "rough finish-line distance" estimate.
3. [`../033-npm-6-bootstrap/build-logs/run-npm.js`](../033-npm-6-bootstrap/build-logs/run-npm.js)
   — the 45-line wrapper script we used to monkey-patch the gaps in
   userland. Each patch in there points to a real runtime addition
   needed.

## Context in one paragraph

ionpower-node v0.86 shipped 2026-05-09 (lumo handoff: repl + v8
stubs + Babel `||=` plugin). Right after, we ran an experiment to
see if upstream npm 6.14.18 would run on the v0.86 runtime. It did
— `npm-cli.js --version` printed `6.14.18` on a 1999 PowerBook G3
with three monkey-patches. `npm install mri` then reached deep into
npm's install pipeline (`lib/install.js` → `lib/install/deps.js` →
`pacote/extract.js`) before hitting more missing fs APIs. Every
gap encountered is small and individually tractable. This session
closes the first wave of those gaps, in one runtime commit, then
re-runs the npm experiment to find the next plateau.

## Scope (one session, one runtime commit, no release this session)

The full first-wave gap list, in roughly the order each gap blocked
npm during the bring-up:

### A. `process.version` policy change

- `src/node_compat/process.cpp:299` — change `"ionpower-node-0.86"`
  to `"v10.24.1"` (the literal in `DefineStringProp(... "version", ...)`).
- `src/node_compat/process.cpp` — add a `process.versions` object
  with at least `node: "10.24.1"` and `'ionpower-node': "0.86"`.
  Use the same shape Node uses (an object on `process`, each value a
  string). The `'ionpower-node'` key needs the bracket form because
  of the dash.
- Bump VERSION to `0.87` in `Makefile` + `process.cpp` +
  `README.md`'s install snippet (this is the next release).
- Smoke: `test/process_version_smoke.js` — assert
  `process.version === 'v10.24.1'`,
  `process.versions.node === '10.24.1'`,
  `process.versions['ionpower-node'] === '0.87'`. Wire into
  `scripts/test-list-more.txt`.

### B. `process.execPath`

- `src/node_compat/process.cpp` — add a `process.execPath` that
  matches `process.argv[0]` (absolute path to the runtime binary).
  Real Node has this; we never added it.
- Smoke: assert `typeof process.execPath === 'string'` and
  `process.execPath.length > 0`.

### C. `process.binding(name)` stub

- `src/node_compat/process.cpp` — add `process.binding = function (name) { return {}; }`
  (or equivalent C++-side property). Empty stub: libraries that
  reach for `process.binding('fs')` (fs-minipass) get an object
  back so `require()` succeeds; if anything actually CALLS the
  binding's methods, it'll fail at use-time instead of load-time.
- We deliberately do not expose real internals via this API.
- Smoke: `process.binding('fs')` returns an object;
  `process.binding('constants')` returns an object.

### D. `require('constants')` real seed

- `src/node_compat/globals.cpp` — in `kBootstrapJS`, near the
  existing seeded modules, add `__require_cache__['constants'] = ...`.
  Real Node `constants` exposes O_RDONLY, O_WRONLY, O_RDWR, O_CREAT,
  O_TRUNC, O_APPEND, S_IFMT, S_IFREG, S_IFDIR, S_IFLNK, S_IFSOCK,
  errno values (EACCES, ENOENT, EEXIST, EINVAL, EPERM), signal
  numbers. For PASS 1, ship the fs subset (the O_* and S_IF* flags)
  + the common errno strings; punt signals to a later pass unless
  npm demands them.
- Add `'constants'` to `module.builtinModules` (next to `'repl'`,
  `'v8'` we added in v0.86).
- Smoke: assert `require('constants').O_RDONLY === 0`, etc.

### E. `index.json` resolution

- `src/node_compat/require.cpp` `TryModuleExtensions` —
  add the `<base>/index.json` candidate to the dir-fallback chain,
  after `<base>/index.cjs`. Real Node tries
  `index.{js,json,node}`; we miss `.json`.
- Smoke: a vendored package shaped like spdx-license-ids
  (`index.json` only, no `"main"` in `package.json`). Place under
  `test/vendor/` with a smoke that requires it and checks the value.

### F. `fs.readlink` / `fs.readlinkSync`

- `src/node_compat/fs.cpp` — add real `readlink(2)`-backed
  implementations. `readlinkSync(path)` returns the target string;
  `readlink(path, cb)` does the same async (we already have
  `_fsAsync` to wrap a sync impl into an async one). For Tiger
  PPC, `readlink(2)` is in `<unistd.h>`; the path buffer should be
  PATH_MAX, error path returns ENOENT/EINVAL/etc as appropriate.
- Smoke: create a symlink in /tmp, readlink it, assert the target.

### G. `fs.{truncate,appendFile,chown,utimes,fchmod,symlink}` and the rest

- `src/node_compat/fs.cpp` — add the sync variants for each, then
  generate the async ones via the existing `_fsAsync(syncFn)`
  helper in globals.cpp.
- Each is one syscall: `truncate(2)`, `chown(2)`, `utimes(2)`,
  `fchmod(2)`, `symlink(2)`. `appendFile` is `open(O_APPEND|O_CREAT)`
  + `write(2)` + `close(2)`.
- The session-2 notes flag the specific call sites: bluebird's
  `BB.promisify(fs.truncate)` was the immediate wall after
  readlink. Iterate by re-running npm install after each batch and
  capturing the next gap.
- Smoke per API; existing `test/fs_extras_smoke.js` is a pattern
  to follow.

### H. Re-run the npm experiment, capture the next plateau

After A-G land + G3 triad-build green, on ibookg37:

```
ssh ibookg37 'cd /Users/macuser/tmp/npm-test && rm -rf node_modules package-lock.json && \
  /opt/ionpower-node-0.87/bin/node /Users/macuser/tmp/npm-6.14.18/run-npm.js install mri'
```

Trim the wrapper script as patches become unnecessary at runtime
level (process.execPath, constants, binding, gauge, readlink fixes
should be removable from `run-npm.js` once the runtime carries them).
The `process.version` and `Gauge.setWriteTo` stubs may need to stay
until further root-cause work (gauge is upstream-unsafe, not our
gap; the version is ours-by-policy).

If `install mri` runs to completion and writes
`node_modules/mri/`: VICTORY for pass 1. Capture timing, write
notes, propose `demos/npm-install/` (real installer demo, replacing
the single-package limitation in `demos/npm-fetch/`).

If it hits new gaps: capture them as the pass-2 list. Should be
much shorter than the pass-1 list — the npm bootstrap gaps are
done; pass-2 will be install-pipeline gaps only.

## Out of scope for THIS session

- The README "Node version compatibility" section + intentional-gaps
  list. That's its own focused doc-session — the punt list needs
  research per item before we commit it. Leave it captured in
  [`../../plans/node-target-version.md`](../../plans/node-target-version.md)
  for now.
- Recursive dep installation. Even if `install mri` works (mri has
  no deps), `install <something-with-deps>` exercises a different
  code path; queue separately.
- ied-as-fallback experimentation. Only relevant if the runtime
  fixes turn out to be more than ~half a day. They shouldn't be.
- A v0.87 GitHub release. Cut the release at the END of pass 1
  — once `install mri` works end-to-end. If it doesn't fit in one
  session, hold the version bump until it does.

## Risk / blast radius

All changes are additive. No existing API surface should break.
Verify with `make test-all` (full smoke list, 466+ tests as of
v0.86) on G3 via `scripts/triad-build.sh ibookg37 g3 0.87`.

The `process.version` change is the one thing a downstream library
could *theoretically* notice — if any vendored library was reading
the literal string `'ionpower-node-0.86'` to decide behavior, they'd
break. None do today (audit: `grep -r 'ionpower-node' test/vendor/`
returns no hits in actual library code, only in our own test
files).

## Working order

1. Read the three "Read first" docs above.
2. Bump VERSION to 0.87, add A (process.version + .versions) +
   smoke. One commit. (Standalone — verifies the policy change in
   isolation before piling on more changes.)
3. Add B + C + D (process.execPath, process.binding, constants
   real seed) + smokes. One commit.
4. Add E (index.json resolution) + smoke. One commit.
5. Add F (readlink) + smoke. One commit.
6. Add G (fs.{truncate,appendFile,chown,utimes,fchmod,symlink})
   + smokes. One commit.
7. Triad-build on G3.
8. Re-run npm install experiment. Trim run-npm.js to reflect what
   the runtime now carries. Capture next-plateau notes if it
   doesn't go end-to-end.
9. If end-to-end works: cut v0.87 release with the changes
   bundled. If not: commit notes, queue pass 2, defer release.

The five-commit split is for reviewability and revert-ability —
small focused commits per the v0.86 plan's spirit. If any commit
turns out to be tangled, collapse to one.

## Quick references

- Test-list workflow: [`../../../CLAUDE.md`](../../../CLAUDE.md)
  "Test-list workflow" section.
- Triad build flow: same CLAUDE.md, "Triad build flow" section.
- Bootstrap JS source for stubs: `src/node_compat/globals.cpp`
  `kBootstrapJS[]` (~9000 lines; grep for `__require_cache__`
  landmarks).
- fs additions: `src/node_compat/fs.cpp`. Existing pattern:
  syncFn defined C++-side, then `fs.foo = _fsAsync(fs.fooSync)`
  in `kBootstrapJS`.
- The bring-up wrapper script:
  [`../033-npm-6-bootstrap/build-logs/run-npm.js`](../033-npm-6-bootstrap/build-logs/run-npm.js)
  — every stub in there has an entry in the gap list above.
