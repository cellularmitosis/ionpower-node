# Session log — pickup notes (2026-04-21)

## Where things are

- **30 third-party libraries** confirmed working (full matrix in
  [compat.md](compat.md)).
- **node_modules resolution** landed in commit `59a36bf`. Bare
  specifiers now walk up parent dirs looking for
  `<ancestor>/node_modules/<spec>`, reading `package.json` main. Test
  fixture at `test/mod/nm_root/`, harness at
  `test/nm_resolution_smoke.js`.
- **Crypto shim** uses `/dev/urandom` (commit `b503dff`). Opens uuid v4,
  and closes any library that feature-detects `crypto.getRandomValues`.
- **Bootstrap core modules** seeded in require cache: fs, path, events,
  util, os, child_process (stub), crypto.
- **Binary is `node`**; shebangs work (`#!/usr/bin/env node` with the
  binary symlinked into PATH on imacg52).

## Stashed WIP

`git stash list` has one entry:

```
stash@{0}: WIP: process.stdout/stderr.write() native — untested (no G5 net)
```

That's a `process.cpp` change adding a native `.write(data)` method to
`process.stdout` and `process.stderr`. Accepts string or Uint8Array,
writes via `write(fd, ...)` in a retry loop. Compiles locally but I
couldn't run it on imacg52 because the fleet network wasn't reachable
from my current network at the time (mDNS into `.local` wasn't
resolving from a hotspot uplink).

**To resume**:

```
git stash pop
~/bin/tiger-rsync.sh src/node_compat/process.cpp imacg52:/Users/macuser/tmp/ionpower-node/src/node_compat/
ssh imacg52 'cd /Users/macuser/tmp/ionpower-node && make && ./node -e "process.stdout.write(\"hi\n\")"'
```

If it works, commit with a message like
`process: add stdout/stderr.write() native`.

## Open ideas, ranked by impact

1. **Transpile-on-require hook**. Bolt `@babel/standalone` into the
   require loader so libs that use `?.` / `??` / class fields load
   transparently. Biggest multiplier for what "just works".
2. **Second CLI-style demo** — a tiny static blog pipeline using yaml
   frontmatter + marked + handlebars + fs (extends `demos/ssg/`).
3. **A log of libraries that failed** — keep a `docs/compat-fails.md`
   capturing the exact error per failed library, so the pattern of
   gaps is explicit. Useful when we triage the next batch.
4. **`fs.promises` stub that throws** — many libs feature-detect it.
5. **`process.version` that matches a real Node** (currently
   `"ionpower-node-0.1"`) so libs that parse the version string don't
   choke.
6. **`fs.appendFileSync`, `fs.copyFileSync`, `fs.chmodSync`** — trivial
   wrappers, covers a bunch of everyday patterns.
7. **Build G3/G4 SpiderMonkey variants** — only G5 is built so far;
   this unblocks fleet distribution.

## Libraries queued but not tried

Probably-work: mocha's own `diff` is already done, but mocha itself
needs glob + chokidar + yargs transitive tree — skip. tape has 22
deps, skip. `cheerio` needs entities + htmlparser2 + domelementtype
tree — moderate. `marked` newest (15.x) uses optional chaining —
blocked until transpile-on-require.

Low-hanging: `ms` (duration parser, tiny), `strip-ansi`, `wrap-ansi`,
`chalk-template`, `color-name`, `color-convert`, `qrcode-terminal`.

## Rebuild from zero

If something's catastrophically off and a fresh setup is needed:

1. `scripts/fetch-tenfourfox.sh` — repopulate `external/tenfourfox/`.
2. `scripts/build-autoconf-213.sh` on imacg52 — build autoconf 2.13.
3. `tiger.sh python2-2.7.18` on imacg52 — mozbuild needs Py 2.7.
4. Rsync source to imacg52; `scripts/build-mozjs.sh`.
5. After SpiderMonkey builds, `scripts/deploy-and-test.sh` handles
   the bridge build and smoke tests.

See [setup.md](setup.md) and [post-build-checklist.md](post-build-checklist.md)
for the full procedure.
