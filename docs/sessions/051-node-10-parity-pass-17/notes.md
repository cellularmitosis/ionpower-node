# Session 051 — Node 10 parity, pass 17 (v1.1 release)

Handoff in: [`../050-node-10-parity-pass-16/handoff-pass-17.md`](../050-node-10-parity-pass-16/handoff-pass-17.md).

## State at the start

- Pass 16 left the working tree with uncommitted source + smokes:
  - `src/node_compat/{require,globals,process}.cpp` — MODULE_NOT_FOUND
    helper + Module-API shim audit + v8/util/readline shims (six lumo
    asks).
  - 5 new smokes under `test/` (4 require-shape + the combined lumo
    asks smoke).
  - `scripts/test-list-core.txt` extended with the five smokes.
  - Session dirs `050-node-10-parity-pass-16/` + `050-handoff-from-lumo/`
    untracked.
- `main` was clean at `fb67db0`. v1.0 binaries installed on triad
  hosts at `/opt/ionpower-node-1.0/`; the v1.0 release was already
  out.
- The pass-16 handoff recommended cutting v1.1 since pass-16's
  material was richer than a v1.0.1 should carry (an Error-shape
  change ecosystem libraries depend on, the shim audit, six lumo
  asks, five new smokes).

## Working order this pass

Followed the standard release flow from CLAUDE.md, no surprises:

1. Bump `VERSION` in `Makefile`, `src/node_compat/process.cpp`,
   README.md.
2. `scripts/triad-build.sh ibookg37 g3 1.1` in foreground (fastest
   failure feedback).
3. G3 green → fire G4 + G5 in parallel.
4. Pull tarballs to `/tmp/v1.1-release/`.
5. Commit source/version, tag `v1.1`, push, `gh release create`.
6. Commit session docs separately (v1.0 pattern).

## What happened

### Build timings (all three triad hosts)

Wall-clock from "clean + build" start to "DONE":

| Host         | Arch  | Start (UTC-ish) | End   | Notes |
|--------------|-------|-----------------|-------|-------|
| ibookg37 G3  | 750   | 00:48           | 01:06 | ~18 min, no flakes |
| pmacg5 G5    | 970   | 01:07           | 01:14 | ~7 min |
| emac G4      | 7450  | 01:07           | 01:16 | ~9 min |

G5 + G4 ran in parallel after G3 was green. Total wall-clock from
G3 start to triad-complete: ~28 minutes (slightly under the 45 min
the pass-16 handoff projected).

### Per-host test counts

All three hosts: **31 core + 495 libs = 526 PASS / 0 FAIL.**
Matches the projection from the pass-16 handoff.

Per-host logs in [`build-logs/`](build-logs/):

- `g3.log` / `g4.log` / `g5.log` — full triad-build stdout (rsync,
  scp, build, install, tarball).
- `g3-tests.log` / `g4-tests.log` / `g5-tests.log` — per-test PASS/FAIL
  records from `make test-all`.

### Commit + release

Commit split matches v1.0:

- [`245379a`](https://github.com/cellularmitosis/ionpower-node/commit/245379a)
  — source + version bump + smokes (11 files, +522 / -19). Tagged
  `v1.1`, pushed.
- This dir's commit (separate) will add the three session dirs and
  all build logs.

Release: <https://github.com/cellularmitosis/ionpower-node/releases/tag/v1.1>.
Three tarballs attached (G3 / G4 / G5 PPC). Release notes at
[`release-notes/v1.1.md`](release-notes/v1.1.md).

### Judgment calls

1. **G5 + G4 fired together after G3 green** rather than serially.
   Each host has its own remote tree + SpiderMonkey, so no
   contention. The triad-build script's `RSYNC_DELETE=` is the only
   thing that varies per-host (emac's rsync 2.6.3 lacks
   `--delete-before`), and that's per-script-invocation. Worked
   cleanly.
2. **README version bumps**: kept the convention from v1.0 — only
   bump the references in the install snippets + the SpiderMonkey
   reuse pointer. Did not retouch the architectural prose.
3. **Release-notes structure**: mirrored the v1.0 release-notes
   shape (headline → fix sections → known gaps → verification table
   → tarballs → session links). Headline is the MODULE_NOT_FOUND
   change because it's the largest behavior delta for ecosystem
   libraries.

## Followups for pass 18

Carried forward from the pass-17 punch list, now that v1.1 is out:

### B. Wave-3 small-fix candidates (most likely highest-ROI)

- **B1. `Buffer.prototype.write(string, offset)`** — pg's pg-protocol
  reaches for it. ~20 lines in `src/node_compat/buffer.cpp`.
- **B2. `require('.')` resolver** — redis@4 cluster code uses the
  bare-dot specifier for "this directory's index.js". ~10 lines in
  require.cpp's `ResolveModule`.
- **B3. Built-in module property enumerability** — figlet's
  `_interopNamespaceDefault(require('path'))` iterates with `for-in`.
  Likely a `JSPROP_ENUMERATE` sweep across all built-in modules.

If all three land, wave-3 OK rate moves from 57 % to ~68 % (pg +
redis + figlet pass).

### C. Babel parse-fallback investigation

archiver reports "async functions are not enabled in the parser",
tar reports "missing : after property id" — both without triggering
the Babel fallback. Worth a half-day focused investigation:
- Is babel being invoked at all? (`IONPOWER_TRACE_BABEL=1`)
- Is it a `JS::CompileOptions` mismatch between require.cpp's
  `wrapAndEval` vs. main.cpp's bootstrap path?

### D. Module-API survey

The require.main shim being load-bearing for npm-lifecycle suggests
more silent gaps. Half-hour grep through npm's node_modules for
`require.X` / `module.X` patterns we don't expose. Hottest:
`module.parent`, `module.loaded`, `module.children`, `module.paths`,
`Module._load`, `Module._resolveFilename`, `Module._compile`.

### E. Deferred (no fresh evidence)

- ES2018 regex polyfill (only got@11 affected — wait for two more).
- BigInt cost-out (4 known affected; defer until ready for a
  dedicated SM52 patch day).
- `vm.runInContext` top-level-var capture — heavier lumo ask,
  documented as v1.x+ aim, not v1.2.

### F. ibookg37 mSATA swap

No new symptoms during pass 17. Pre-emptive maintenance still
pending.

## Cross-links

- v1.1 release: <https://github.com/cellularmitosis/ionpower-node/releases/tag/v1.1>
- v1.1 release notes (in-repo): [`release-notes/v1.1.md`](release-notes/v1.1.md)
- Source commit: [`245379a`](https://github.com/cellularmitosis/ionpower-node/commit/245379a)
- Pass-16 handoff (incoming): [`../050-node-10-parity-pass-16/handoff-pass-17.md`](../050-node-10-parity-pass-16/handoff-pass-17.md)
- Pass-18 handoff (outgoing): [`handoff-pass-18.md`](handoff-pass-18.md)
