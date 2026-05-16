# Session handoff: Node 10 parity, pass 18

## Pass 17 — v1.1 shipped

Pass-16's accumulated material landed as
[**v1.1**](https://github.com/cellularmitosis/ionpower-node/releases/tag/v1.1):

- **MODULE_NOT_FOUND error code** on `require()` / `require.resolve()`
  misses. Highest-blast-radius change in the release — any package
  that branches on `e.code === 'MODULE_NOT_FOUND'` in a `try/require`
  was silently broken before.
- **Module-API shim audit**: `require.main`, `require.extensions`,
  `require.resolve.paths`, `module.id`, `module.filename`. The
  `require.main` shim turned out load-bearing for npm-lifecycle, not
  just defensive — unblocks any package with an install hook.
- **Six lumo asks** (5 stubs + 1 real readline auto-resume bug) —
  a real Node-targeted CLJS bundle now runs on Tiger PPC.
- **5 new smokes**, all PASS on the triad.

**Verified end-to-end on all three triad hosts: 31 core + 495 libs
= 526 PASS / 0 FAIL per host.**

## Read first

1. [`notes.md`](notes.md) — pass-17 narrative. Tight pass — no
   surprises. Build wall-clock 28 min (G3 foreground 18 min, then
   G4+G5 in parallel ~9 min).
2. [`release-notes/v1.1.md`](release-notes/v1.1.md) — what shipped,
   plus the known-gaps list that becomes pass-18 fuel.
3. [`../050-node-10-parity-pass-16/notes.md`](../050-node-10-parity-pass-16/notes.md)
   — pass-16 narrative; wave-3 categorised failures live here and
   drive most of the punch list below.

## State at session end

- `main` is at
  [`245379a`](https://github.com/cellularmitosis/ionpower-node/commit/245379a)
  (v1.1 source) plus the docs commit that lands these dirs.
- Tag `v1.1` pushed; GitHub release created with G3/G4/G5 tarballs
  attached.
- `/opt/ionpower-node-1.1/` installed on all three triad hosts;
  `/opt/ionpower-node-1.0/` still present (the release tarballs are
  side-by-side; install snippets in README point at 1.1 now).
- `/tmp/v1.1-release/` on uranium has the three tarballs (throwaway
  — already attached to the GH release).
- Wave-3 raw artefacts still on G3 at
  `/Users/macuser/tmp/survey-050/`.
- Babel disk cache `~/.ionpower-cache/babel-v1/` on G3 still warm.
  **DO NOT WIPE.**

## Punch list — pass 18

### A. Wave-3 small-fix candidates (Recommended)

All have clear root causes from the pass-16 wave-3 categorisation.
Together they probably push wave-3 OK rate from 57 % to ~68 %
(pg + redis + figlet pass).

- **A1. `Buffer.prototype.write(string, offset, length, encoding)`** —
  pg-protocol's `buffer-writer.js:44` calls
  `this.buffer.write(string, offset)`. Add to
  [`src/node_compat/buffer.cpp`](../../../src/node_compat/buffer.cpp).
  ~20 lines. Smoke: `test/buffer_write_smoke.js`.
- **A2. `require('.')` resolver** — redis@4's
  `client/dist/lib/cluster` does `require('.')` to mean "this
  directory's `index.js`". Today the resolver rejects bare-dot. ~10
  lines in `require.cpp`'s `ResolveModule`. Smoke:
  `test/require_dot_smoke.js`.
- **A3. Built-in module property enumerability** — figlet's
  `_interopNamespaceDefault(require('path'))` iterates with `for-in`
  and gets nothing because path's methods aren't `JSPROP_ENUMERATE`.
  May need a sweep across all built-in modules (probably all have
  the same issue). Audit + add the flag.

If A1-A3 land cleanly, re-run wave-3 against the new binary to
confirm pg + redis + figlet pass. Then we can think about a v1.2
release.

### B. Module-API survey (small effort, possibly large payoff)

The require.main shim's load-bearing surprise (npm-lifecycle crash)
suggests there are MORE Module-API gaps that popular libs hit
silently. Half-hour grep through npm's `node_modules` for `require.X`
/ `module.X` patterns we don't expose. Hottest:

- `module.parent` — meow may need it (noted pass-15 handoff).
- `module.loaded` — flag set after the wrapper returns; some libs
  use it for circular-dep detection.
- `module.children`, `module.paths` — module-graph metadata; some
  CLI tools enumerate it.
- `Module._load`, `Module._resolveFilename`, `Module._compile` —
  monkeypatch hooks used by proxyquire, ts-node, etc.

Cost: a couple of hours to enumerate + add stubs, plus smokes. The
shim audit in pass 16 was a half-day and surfaced a load-bearing
real fix. Worth doing.

### C. Babel parse-fallback investigation

Two wave-3 failures look like the Babel fallback didn't kick in:

- **archiver** — `async functions are not enabled in the parser`
  on archiver/lib/core.js:9. Suggests a missing
  `JS::CompileOptions::setLanguageVersion` (or equivalent) call on
  the require-side compile path.
- **tar** — `missing : after property id`. Generic SM45 parse
  error; either Babel preset can't lower the syntax, or fallback
  silently no-op'd.

Half-day focused work:
- Run each file directly with `IONPOWER_TRACE_BABEL=1` to see if
  babel is being invoked.
- If async-functions: check `JS::CompileOptions` in `require.cpp`'s
  `wrapAndEval` vs. `main.cpp`'s bootstrap path. There may be a
  missing setter (we set
  `setDisableLazyParsing(true)` in v1.0; another option may be
  controlling async parsing).
- If tar's is unlowerable: document and recommend tar@6.

### D. Deferred (no fresh evidence in wave-3)

- **ES2018 regex polyfill** — still just one package (got@11).
  Wait until two more.
- **BigInt cost-out** — wave-3 surfaced 0 new BigInt cases. Still 4
  known affected (superagent, make-fetch-happen, cuid2, ip-address).
  Dedicate a day to the SM52 patch when ready.
- **`vm.runInContext` top-level-var capture** — the lumo handoff's
  heavier ask. Documented as v1.x+ aim, not v1.2.
- **chalk@5 / boxen** — ESM-only / `Intl.Segmenter`. Userland
  workarounds (pin chalk@4). Skip.

### E. ibookg37 mSATA swap

Still pending. No new symptoms during pass 17. Pre-emptive
maintenance.

## Notes / scratch

- The `050-` shared-prefix oddity carries on: `050-handoff-from-lumo/`
  and `050-node-10-parity-pass-16/` are both pinned at 050 by
  arrival order. Pass-17 is 051. Pass-18 should use **052**.
- `/Users/macuser/tmp/survey-050/` on G3 is intact — if you want
  to retry a failing package against the v1.1 binary (e.g. after
  A1-A3 land), the per-package install trees are still there.
- All five smokes added in v1.1 pass on the triad. No regressions.

## Path to this file (per memory convention)

[`docs/sessions/051-node-10-parity-pass-17/handoff-pass-18.md`](docs/sessions/051-node-10-parity-pass-17/handoff-pass-18.md)
