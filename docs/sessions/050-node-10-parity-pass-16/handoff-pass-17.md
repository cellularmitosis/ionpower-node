# Session handoff: Node 10 parity, pass 17

## Pass 16 — three shipped artefacts

1. **Two-layer require shim audit** —
   [`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp) +
   [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
   now expose `require.main`, `require.extensions`,
   `require.resolve.paths`, plus `module.id` and `module.filename`.
   Three new smokes in
   [`scripts/test-list-core.txt`](../../../scripts/test-list-core.txt).
2. **Wave-3 survey** — 28 packages against the v1.0 binary on G3.
   16 OK / 9 REQUIRE_FAIL / 3 INSTALL_FAIL. Artefacts under
   [`build-logs/`](build-logs/) and analysed in
   [`notes.md`](notes.md).
3. **Lumo round-2 asks (folded in mid-session)** — six small fixes
   from the cross-project handoff at
   [`../050-handoff-from-lumo/handoff-from-lumo.md`](../050-handoff-from-lumo/handoff-from-lumo.md):
   - `require()` / `require.resolve()` now throw a real `Error`
     with `.code === 'MODULE_NOT_FOUND'` + `.requireStack = []`
     (was `JS_ReportError` with no code, silently breaking any
     library that branches on the code).
   - `process.binding('util')` exposes `startSigintWatchdog` /
     `stopSigintWatchdog` / `watchdogHasPendingSigint` (no-ops).
   - `v8.setFlagsFromString` no-op stub.
   - `readline.emitKeypressEvents` no-op stub.
   - `_ReadlineInterface.prototype._setRawMode(mode)` delegates to
     input.setRawMode and returns previous `isRaw` (Node contract).
   - `_ReadlineInterface` constructor: auto-resume input after
     attaching the data listener (**real bug** — pty stdin sat
     paused otherwise), plus `this.input` / `this.output` aliases.
   Two new smokes
   ([`test/require_module_not_found_smoke.js`](../../../test/require_module_not_found_smoke.js) +
   [`test/lumo_asks_smoke.js`](../../../test/lumo_asks_smoke.js)).

**Verified end-to-end on all three triad hosts: 31 core + 495 libs
= 526 PASS / 0 FAIL per host.**

## Read first

1. [`notes.md`](notes.md) — pass-16 narrative. The interesting
   subplot is the **require.main shim turning out to be load-bearing**:
   bcrypt's INSTALL_FAIL on wave-3 was `require.main is undefined`
   inside *npm's own* npm-lifecycle code, not bcrypt's. Retrying with
   the shim binary clears that crash and reveals the next gap
   (child_process spawn stdio). The "defensive" audit had a real
   impact. Whole class of installs blocked on pre-v1.0.x binaries.
2. [`../050-handoff-from-lumo/handoff-from-lumo.md`](../050-handoff-from-lumo/handoff-from-lumo.md)
   — the cross-project round-2 handoff that grew pass 16's scope.
   The heavier "v1.x+, not v1.1" ask — `vm.runInContext(source,
   sandbox)` capturing top-level vars onto the sandbox — is
   deferred there.
3. [`build-logs/summary.tsv`](build-logs/summary.tsv) — 28-row
   per-package wave-3 outcome.
4. [`build-logs/survey-wave-3-logs/`](build-logs/survey-wave-3-logs/)
   — full npm + require logs per package, for any deep-dive you want
   to do.

## State at session end

- Working tree on uranium:
  - **Uncommitted** source changes:
    - `src/node_compat/require.cpp` (shim audit + MODULE_NOT_FOUND helper + resolve→__resolve_native__)
    - `src/node_compat/globals.cpp` (rewrap forwarding + v8.setFlagsFromString + readline cluster)
    - `src/node_compat/process.cpp` (process.binding('util') stubs)
    - `scripts/test-list-core.txt` (+5 smokes)
  - **Uncommitted** new smokes:
    - `test/require_main_smoke.js`
    - `test/require_extensions_smoke.js`
    - `test/require_resolve_paths_smoke.js`
    - `test/require_module_not_found_smoke.js`
    - `test/lumo_asks_smoke.js`
  - **Uncommitted** session dirs:
    - `docs/sessions/050-node-10-parity-pass-16/` (this pass)
    - `docs/sessions/050-handoff-from-lumo/` (the lumo handoff
      — landed in-place during the session)
- G3 / G4 / G5 source trees all have the changes installed (rsync'd
  + built); their `node` binaries have all six asks + the shim
  audit. The installed `/opt/ionpower-node-1.0/` binaries are still
  v1.0 and do **not** have these changes — until the next release
  ships, the released artefact is unchanged.
- Wave-3 raw artefacts still on G3 at
  `/Users/macuser/tmp/survey-050/`.
- Babel disk cache `~/.ionpower-cache/babel-v1/` on G3 is now warm
  with wave-2 + wave-3 contents. **DO NOT WIPE.**
- `main` is clean at `fb67db0`. Nothing committed this session.

## Punch list — pass 17

### A. Cut v1.1 (Recommended)

Pass 16 has more material than a v1.0.1 should carry — it
includes MODULE_NOT_FOUND (an Error-shape change that ecosystem
libraries depend on), six lumo asks, the shim audit, and 5 new
smokes. Cleanest release model: ship as **v1.1**.

Standard release flow per CLAUDE.md:

1. Bump VERSION in `Makefile`, `src/node_compat/process.cpp`, README.
2. `scripts/triad-build.sh ibookg37 g3 1.1` (foreground).
3. Once G3 green, G4 + G5 in parallel via `run_in_background`.
4. Pull tarballs to `/tmp/v1.1-release/`.
5. Commit + tag + push + `gh release create v1.1 ... <tarballs>`.

Wall-clock: ~45 min for full triad release.

The release notes should call out:

- **MODULE_NOT_FOUND**: silent unblock for any package using
  try/catch require to probe optional deps. The most consequential
  change in the release.
- **npm-lifecycle unblock**: packages with install hooks (bcrypt
  family, sharp, node-sass) get past `require.main is undefined`.
- **Lumo bring-up unblocked**: a real Node-targeted CLJS bundle
  runs on Tiger PPC.
- **Shim audit defensive add**: `require.main`, `require.extensions`,
  `require.resolve.paths`, `module.id`, `module.filename` — covers
  Module-API surface the ecosystem reaches for.

### B. Wave-3 small-fix candidates (post-v1.1)

These were surfaced as "small effort" in the wave-3 analysis. All
have clear root causes and small fixes. Together they probably
push wave-3 OK rate from 57 % to ~68 %.

- **B1. `Buffer.prototype.write`** — pg's pg-protocol uses
  `this.buffer.write(string, offset)`. Implementation: ~20 lines in
  [`src/node_compat/buffer.cpp`](../../../src/node_compat/buffer.cpp).
- **B2. `require('.')` resolver** — redis@4 cluster code does
  `require('.')` to mean "this directory's index.js". Today our
  resolver rejects `.`. ~10 lines in require.cpp's `ResolveModule`.
- **B3. path module enumerability** — figlet (and any package using
  `_interopNamespaceDefault(require('path'))`) iterates path keys
  with `for-in`. Add `JSPROP_ENUMERATE` to path's
  `JS_DefineFunction` / `JS_DefineProperty` calls. May need a
  sweep across all builtin modules — they probably all have the
  same issue.

If these land cleanly, pg + redis + figlet pass. Worth a wave-3
re-run after to confirm.

### C. Babel parse-fallback investigation

**archiver + tar** hit parse errors without triggering the babel
fallback. archiver reports `async functions are not enabled in
the parser` (suggests a missing SM CompileOptions flag), tar
reports `missing : after property id` (generic syntax error, may
be unlowerable by our preset). Worth a focused half-day:

- Run each file directly with `IONPOWER_TRACE_BABEL=1` to see if
  babel is even being invoked.
- If async functions: check `JS::CompileOptions` in require.cpp's
  `wrapAndEval` vs. main.cpp's bootstrap path. There may be a
  missing setter.
- If tar's unlowerable: document, recommend tar@6.

### D. Module-API survey (post-v1.1)

The require.main shim being load-bearing suggests there are MORE
Module-API gaps that npm or popular libs hit silently. Half-hour
grep through npm's node_modules for `require.X` / `module.X`
patterns we don't expose. The hottest candidates:

- `module.parent` — meow may need it (noted pass-15).
- `module.loaded` — flag set after wrapper returns.
- `module.children`, `module.paths` — module graph metadata.
- `Module._load`, `Module._resolveFilename`, `Module._compile` —
  monkeypatch hooks (proxyquire, ts-node).

### E. Deferred (no fresh evidence in wave-3)

- **ES2018 regex polyfill** — still just one package (got@11);
  defer until two more.
- **BigInt cost-out** — wave-3 surfaced 0 new BigInt cases. Still
  4 known affected (superagent, make-fetch-happen, cuid2,
  ip-address). Focus a dedicated day on the SM52 patch when ready.
- **`vm.runInContext` top-level-var capture** — the lumo handoff's
  heavier ask. Documented as v1.x+ aim, not v1.1.

### F. ibookg37 mSATA swap

Still pending. No new symptoms during pass 16. Pre-emptive
maintenance.

## Notes / scratch

- The `050-` prefix is shared between two session dirs:
  `050-node-10-parity-pass-16/` (this pass) and
  `050-handoff-from-lumo/` (the cross-project handoff that landed
  during the session). Both are at numbered position 050 by
  arrival. Pass 17 should use **051**.
- `/Users/macuser/tmp/survey-050/` on G3 is intact; if you want to
  retry a failing package (e.g. after B1-B3 land), the per-package
  install trees are still there.
- All five new smokes pass on the triad. No regressions.

## Path to this file (per memory convention)

[`docs/sessions/050-node-10-parity-pass-16/handoff-pass-17.md`](docs/sessions/050-node-10-parity-pass-16/handoff-pass-17.md)
