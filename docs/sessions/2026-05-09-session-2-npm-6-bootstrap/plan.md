# Session 2 plan: npm 6.14.18 bootstrap experiment

## Context

Following up on the npm-tooling discussion captured in
[`../../../docs/convos/claude-conversation-2026-05-01-6478620b.md`](../../../docs/convos/claude-conversation-2026-05-01-6478620b.md)
(lines ~166-192). Two candidate npm tracks were proposed:

1. **npm 6.14.18** — last of the pre-`arborist` era. Targets Node
   10. "Closer to a JS app that does the registry dance than the
   workspace-aware monster npm became." Tarball URL:
   `https://registry.npmjs.org/npm/-/npm-6.14.18.tgz`.
2. **ied** — small abandoned-2017 alternative pkg manager.
   Closest existing match to "lightweight npm" in the ecosystem.

Picking option 1 first per user direction. ied stays as a fallback
if npm 6 turns out to be too painful — the abandoned-in-2017 dating
of ied means it predates a lot of modern syntax that'd trip SM45,
which is genuinely interesting.

## Why this matters

Today the runtime supports the npm ecosystem via:

- 660+ vendored libraries in `test/vendor/` and
  `test/vendor/nm/node_modules/` (pre-`npm pack`'d on a modern
  machine).
- A 165-line proof-of-concept at `demos/npm-fetch/install.js` that
  installs a single package end-to-end (registry HTTP -> tar
  extract -> `node_modules/` write -> `require()`) but doesn't
  recurse into dependencies.

What's missing: an end-user-facing `npm install <pkg>` workflow
that walks the dependency graph. If npm 6.14.18 runs at all on the
runtime, even slowly, that closes the gap without us writing a
custom resolver.

## Scope

A **bring-up experiment**, not a release. The success criteria are:

| Step | Success | Failure |
|---|---|---|
| 1. Download + extract npm-6.14.18.tgz | tarball lands on ibookg37 | -- |
| 2. `./node npm-cli.js --version` | prints `6.14.18` | capture exact error, identify root cause |
| 3. `./node npm-cli.js install mri` | installs to `node_modules/mri/` and stops | partial-success counts; document what worked |

The interesting part is step 2's failure mode. Most likely outcomes:

- **Parse error** in some dep — Babel fallback should catch most
  modern syntax; what survives that is the real gap.
- **Missing Node API** — npm 6 calls `something.someMethod` we don't
  have. List of these is the real output of this experiment.
- **Bundled deps surprise** — npm vendors most of its deps in
  `node_modules/`, so we're testing several hundred packages at
  once. Some will hit gaps.
- **Performance** — the runtime is slower than V8 by a meaningful
  factor. "Works in 5 minutes" is a useful answer; "works in 5
  hours" is also a useful answer.

If step 2 fails outright with no easy fix path, the answer is
"try ied next." If step 2 works but step 3 fails on registry HTTP
or extract, that's a runtime-API gap we already know how to
plug. If step 3 mostly works, we have a real path forward.

## Working order

1. Download tarball locally on uranium. Extract to /tmp. Inspect
   structure: `package.json`'s `main` and `bin`, presence of
   `node_modules/` (bundled deps), rough size.
2. `rsync -av` to `ibookg37:/Users/macuser/tmp/npm-6.14.18/`.
3. `ssh ibookg37 './node /Users/macuser/tmp/npm-6.14.18/bin/npm-cli.js --version'`.
   Capture stdout + stderr.
4. If --version works: try `./node ... npm-cli.js install mri`
   in an isolated temp dir.
5. Loop on whatever breaks. Time-box at ~2 hours of bring-up before
   pivoting to ied.
6. Write up findings in `notes.md` (what worked, what broke, what
   would unblock it, recommendation: continue / pivot / shelve).

If npm 6 works, the followup is a "one-shot install workflow doc"
plus possibly a `bin/npm` symlink in the install layout. Out of
scope for THIS session — bring-up only.

## Risk

ibookg37 is a PowerPC fleet test machine — high risk tolerance per
CLAUDE.md. Free to install, extract, run experimental Node code.
Not free to modify the in-flight v0.86 build state under
`/Users/macuser/tmp/ionpower-node/` (active source tree) — keep npm
extraction in a sibling dir.
