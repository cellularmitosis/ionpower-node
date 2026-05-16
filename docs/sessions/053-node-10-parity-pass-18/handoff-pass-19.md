# Session handoff: Node 10 parity, pass 19

## Pass 18 — v1.2 shipped

Pass-17 left three wave-3 small-fix candidates for pass 18.
[**v1.2**](https://github.com/cellularmitosis/ionpower-node/releases/tag/v1.2)
lands all three:

- **`Buffer.prototype.write(string[, off[, len]][, encoding])` +
  signed-int writes.** A1 was the documented gap; round-1 build
  showed pg-protocol also needed `writeInt32BE`, so the same kPatch
  picked up writeInt8 / writeInt16LE/BE / writeInt32LE/BE. Two's
  complement bytes are identical to the unsigned form at the same
  width, so these are one-line aliases of the unsigned variants.
- **`require('.')` and `require('..')`.** ResolveModule's relative
  gate widened to accept bare-dot specifiers; downstream resolution
  was already correct.
- **Pre-emptive babel for `for (let|const ...)`.** The headline
  surprise of the pass — A3 was misdiagnosed in pass-16 as a path-
  module enumerability gap, but the real issue is that SM45 doesn't
  per-iteration-bind `let`/`const` in any loop form. Babel preset-env
  at `targets: {ie:'11'}` lowers block-scoping correctly; we now
  trigger babel pre-emptively when the source contains
  `for (let|const ...)` on a cheap substring scan. Disk cache
  amortizes; `IONPOWER_NO_BABEL=1` opts out.

**Verified: 34 core + 495 libs = 529 PASS / 0 FAIL per triad host
(G3, G4, G5).** Three new smokes: buffer_write_smoke,
require_dot_smoke, for_loop_block_scope_smoke.

**Wave-3 OK rate: 16/28 (57 %) → 19/28 (68 %).** Matches the
pass-17 prediction.

## Read first

1. [`notes.md`](notes.md) — pass-18 narrative, including the A3 mis-
   diagnosis story, the writeInt32BE round-2 follow-up, and the
   extended wave-3 retry results.
2. [`release-notes/v1.2.md`](release-notes/v1.2.md) — what shipped.
3. [`../051-node-10-parity-pass-17/handoff-pass-18.md`](../051-node-10-parity-pass-17/handoff-pass-18.md)
   — the source of pass-18's punch list. Most of it landed.

## State at session end

- `main` at the v1.2 source commit (plus this docs commit landing
  the dir).
- Tag `v1.2` pushed; GitHub release created with G3/G4/G5 tarballs.
- `/opt/ionpower-node-1.2/` installed on all three triad hosts;
  `/opt/ionpower-node-1.1/` still present (side-by-side).
- `/tmp/v1.2-release/` on uranium has the three tarballs (throwaway).
- Wave-3 raw artefacts still on G3 at `/Users/macuser/tmp/survey-050/`.
- Babel disk cache `~/.ionpower-cache/babel-v1/` on G3 still warm
  (and now has fresh entries for pre-empt-triggered files).

## Punch list — pass 19

### A. Broaden the babel pre-empt heuristic

The pre-empt path closed an async-functions parse error on
**archiver** for free (file contained `for (let|const)` so it got
babel'd, which also lowered async). That suggests the heuristic
is under-triggering elsewhere. Pass-16's `archiver` (without
`for (let|const)`) and `tar` cases still fail on parse errors that
*should* trigger the existing parse-error fallback. Worth checking:

- Why does `tar` not fall back? Hypothesis: the parse error fires
  on a body line, but maybe `JS::Evaluate` doesn't report it as a
  pending SyntaxError. The fallback only fires when `ok == false`
  AND there's a pending exception that's a SyntaxError.
- Should we trigger pre-empt on any of `async function`, `await `,
  `class ` (private fields), `import.meta`, top-level `import` /
  `export`? Wider net, same disk cache.

Cost: a couple of hours to extend the heuristic + smokes for a
couple of canonical "parses but runs wrong / parses then errors"
patterns + retry tar to confirm.

### B. Module-API survey (still pending from pass-17 handoff)

Section §B from the pass-17 punch list — half-hour grep through
npm's `node_modules` for `require.X` / `module.X` patterns we don't
expose. Hottest:

- `module.parent` — meow may need it (pass-15 handoff).
- `module.loaded` — flag set after the wrapper returns.
- `module.children`, `module.paths`.
- `Module._load`, `Module._resolveFilename`, `Module._compile` —
  monkeypatch hooks used by proxyquire, ts-node.

Same cost estimate as before (couple of hours). The Module-API
shim audit in pass 16 was a half-day and surfaced a load-bearing
real fix; this is the natural continuation.

### C. Fix archiver's missing-dep issue (probably trivial)

After A3 cleared archiver's parse error, the retry hits
`Cannot find module 'compress-commons' from .../zip-stream`. The
npm install in the survey-050 tree didn't pull `compress-commons`
deep enough. Either:
- Re-install archiver with `npm install --force` to refresh its
  transitive deps, OR
- This is the npm-6 / npm-lifecycle interaction that pass-16's
  `require.main` shim fixed but only for *some* paths.

Worth a single 5-minute retry: `cd /Users/macuser/tmp/survey-050/pkgs
&& rm -rf archiver && mkdir archiver && cd archiver && npm install
archiver` against the v1.2 binary.

### D. ibookg37 mSATA swap

Still pending. Pre-emptive maintenance.

### E. From the lumo round-3 handoff

[`../052-handoff-from-lumo/handoff-from-lumo.md`](../052-handoff-from-lumo/handoff-from-lumo.md):

- **Real `vm.runInContext` capture-vars.** ~1 day native. Low
  priority — Lumo's bundle-side rewrite is stable; we're the only
  known consumer.
- **Mozjs prereq discoverability.** ~10 min (option 1: add a
  one-line prereq block to v1.2's release notes pointing to v0.73
  for the mozjs tarballs). Cheap win for newcomers.

Option 1 alone would be a nice 5-minute task to do at the top
of pass 19 — edit the existing v1.2 release notes via `gh release
edit v1.2 --notes-file ...` after adding the prereq line.

### F. Deferred (no fresh evidence this pass)

- **ES2018 regex polyfill** — still just got@11.
- **BigInt cost-out** — wave-3 surfaced 0 new BigInt cases. 4 known
  affected.
- **chalk@5 / boxen / jose** — ESM-only / Intl.Segmenter / ESM-in-
  CJS-dist. Userland workarounds. Skip.

## Notes / scratch

- Sessions: pass-18 is `053-`. The session-numbering convention is
  arrival order, so the off-by-one from pass-17 (which suggested
  052) carries on: pass-19 should use **054** (or higher if more
  lumo handoffs land first).
- All five v1.2 source commits + tag + release reachable from
  `main`.
- Babel cache is now hot for files containing `for (let|const)` —
  cold-cache cost for a v1.2 user is paid once per affected file.
  Worth measuring on a fresh package install to set expectations.
  Cheap to do as part of pass-19 §A.
- The fs_watch_smoke flake hit on G4 and G5 round-2 builds (both
  passed on retry). Same flake pass-16 saw. Always retries
  cleanly; not blocking but worth filing as a known-flake in
  TESTING.md (pass-19 nit, sub-15min).

## Path to this file (per memory convention)

[`docs/sessions/053-node-10-parity-pass-18/handoff-pass-19.md`](docs/sessions/053-node-10-parity-pass-18/handoff-pass-19.md)
