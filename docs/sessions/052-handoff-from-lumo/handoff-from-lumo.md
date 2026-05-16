# Handoff from sister project lumo-darwin8-ppc — round 3

**Date:** 2026-05-16.
**From:** [`lumo-darwin8-ppc`](../../../../lumo-darwin8-ppc/) session
014.
**Status of that project:** [v1.0 is
out](https://github.com/cellularmitosis/lumo-darwin8-ppc/releases/tag/v1.0) —
upstream Lumo 1.10.1 / ClojureScript 1.10.520 running on Tiger G3
+ Leopard G4 under ionpower-node v1.1, with a 3-line wrapper and
3-patch bundle. Cold-boot 23.5 s on Tiger G3 / 14 s on Leopard G4
with the prewarmed `.lumo_cache/` (-K) shipped in the release
tarball. All six of v1.1's named "lumo asks" landed natively in
ionpower-node ([release
notes](https://github.com/cellularmitosis/ionpower-node/releases/tag/v1.1));
no stubs left in the wrapper. Thank you for the v1.1 work.

This note carries forward **one open ask + one ergonomics
question**. Neither is blocking — Lumo v1.0 ships and works
today. Filing them so they're visible.

## 1. (Open, deferred from round 1) Real `vm.runInContext` capture-vars on the supplied sandbox

This is the same ask that was item 3 of the [session 032 handoff
note](../032-handoff-from-lumo/handoff-from-lumo.md) and "carried
forward" in [session 050](../050-handoff-from-lumo/handoff-from-lumo.md).
Re-stating briefly with its post-v1.0 status.

**What.** Lumo's dev-mode `newClojureScriptContext` /
`newDevelopmentContext` calls
`vm.runInContext(source, sandbox)` and expects writes to
top-level vars in `source` to land on the supplied `sandbox`
object (Node's documented `vm` semantics). ionpower-node's
current JS `vm` shim parameterizes the sandbox as `Function()`
arg keys, so writes don't propagate back.

**Lumo's workaround.** Our v1.0 [bundle patch
script](https://github.com/cellularmitosis/lumo-darwin8-ppc/blob/main/docs/sessions/012-ionpower-node-1.1-uplift/patch-bundle.sh)
rewrites two call sites in `target/bundle.js`:

- `lumoEval` — `runInContext(source, sandbox)` →
  `runInThisContext(source)` (sandbox just happens to be the
  evaluator-global, so this is correct in practice).
- `newDevelopmentContext` — same rewrite, with an explicit
  pre-assignment `global.CLOSURE_IMPORT_SCRIPT = ...` and a final
  `vm.runInThisContext(<main.js>)` to seed the analyzer state.

**Plus** we force `NODE_ENV=production` in `lumo-wrapper.js` so
that Lumo's `__DEV__` branch is dead code, and the production-mode
context path runs (which uses `global` + `runInThisContext`
natively, no rewrite needed for that branch).

**Status post-v1.0.** The workaround is robust — both piped + pty
smokes are green on Tiger G3 and Leopard G4, jar-require from a
classpath works (see §3 below). It is *not* urgent.

But it is the **only** ionpower-node ask still requiring a
bundle-side workaround. Everything else is now native. If you
ever want to retire the last `sed` in our patch-bundle.sh, the
faithful fix is roughly what was sketched in 032's followups: a
native `vm.createContext(sandbox)` returning a JS object backed
by a sealed inner `[[GlobalObject]]`, plus a real
`vm.runInContext(code, ctx, opts)` that calls `JS::Evaluate`
against that inner global — and arranges for top-level
declarations in `code` to be enumerable properties on the
returned sandbox after the evaluation completes.

Estimated effort from 032: ~one day of native work. That estimate
is yours, not mine — flagging that we're still the only known
consumer who cares about this in dev-mode.

## 2. Ergonomics: discoverability of the mozjs-45-ionpower-{g3,g4,g5} install step

Not an ask for new code, an ask for clearer docs (or a packaging
tweak).

**What I tripped over.** In session 012 I tried to install
`ionpower-node-1.1-g4-ppc.tar.gz` on `pbookg42` (Leopard G4) and
hit `dyld: Library not loaded:
/opt/mozjs-45-ionpower-g4/lib/libmozglue.dylib`. I assumed
"there's no mozjs-g4 distribution" and filed it as an open
question. Today I re-checked
[`BUILDING.md`](../../../BUILDING.md) and the [v0.73 release
page](https://github.com/cellularmitosis/ionpower-node/releases/tag/v0.73) —
the mozjs-g3/g4/g5 tarballs DO exist there. So the answer was
"install mozjs from v0.73 first, then ionpower-node from v1.1."

That's a fine workflow once you know it. But the discoverability
gap is real: each new ionpower-node release page (v0.74 → v1.1)
lists three `ionpower-node-X.Y-{g3,g4,g5}-ppc.tar.gz` assets
without restating that they depend on a separate, stable mozjs
install pinned to the v0.73 release. Someone landing on the
v1.1 release page from a search hit (or from a sister project's
"install ionpower-node v1.1" instructions) has no signal that
they need to chase down v0.73 first.

**Three possible shapes of fix, in increasing maintenance cost:**

1. **Add a one-line "Prerequisites" block to each new release's
   notes** linking to the v0.73 mozjs assets. Cheapest;
   zero-code; works retroactively if you edit existing release
   bodies.
2. **Attach the mozjs tarballs to every ionpower-node release**
   in addition to v0.73's. ~200 MB of artifact storage per
   release; users get one-stop install but the mozjs blob isn't
   actually changing.
3. **Combined `ionpower-node-1.1-with-mozjs-g3-ppc.tar.gz`
   bundles** that unpack to both `/opt/mozjs-...` and
   `/opt/ionpower-node-1.1/`. Largest artifact but the most
   newcomer-friendly install command.

For lumo's purposes, #1 alone is enough — once a project's
install docs say "depends on ionpower-node v1.1," the user
following those instructions will land on the release page and a
prereq note would solve it. We can also unblock ourselves by
documenting the same prereq in lumo's own README's Quick start.
But this lands in your court to decide; flagging it as
maintainer-side ergonomics.

**Workaround in lumo for the moment.** Our v1.0 release uses the
**G3 ionpower-node binary on both G3 and G4 hosts** (PowerPC
backward compat — verified working at 14 s cold-boot on
pbookg42 in session 011/012). G4-host benchmarks are therefore
~10–20 % conservative; a native G4-binary deploy would be
faster. If the discoverability fix lands, we can rebenchmark with
the native G4 build and update lumo's Implementation Status.
**G5 hosts**: not yet measured at all — same gap, plus `pmacg5`
in our fleet was loaded the one time we tried.

## 3. Sanity-check measurement: jar-require on v1.1 + clean roger

Not an ask — just a thank-you data point worth landing in your
history. We carried forward a session 007 measurement that
`(require '[demo.core])` from a `demo.jar` classpath took **6 m
07 s** wall on a contended G3 (`ibookg37`). Re-ran today on
clean `roger-ibookg3` with v1.1 + prewarmed `.lumo_cache/` (-K):
**24.1 s** wall on run 2. The jar machinery adds ≈0.6 s on top
of the steady-state cold-boot (23.5 s); the rest of the original
6 m budget was contention + an unwarmed cache. v1.1 holds the
floor we measured in 011/012 unchanged when this load is added.

Full log: [`lumo-darwin8-ppc/docs/sessions/014-punchlist-cleanup/jar-require-smoke.log`](../../../../lumo-darwin8-ppc/docs/sessions/014-punchlist-cleanup/jar-require-smoke.log).

## Suggested triage

| # | Item | Effort | Priority for ionpower-node |
|---|---|---|---|
| 1 | Real `vm.runInContext` capture-vars | ~1 day native | low — Lumo's bundle-side rewrite is stable and the only known consumer |
| 2 | Mozjs prereq discoverability | ~10 min (option 1) — ~½ day (option 3) | low — but option 1 is cheap enough to be a near-free win |

(§3 is informational, no action.)

## Lumo's open punch list (for awareness, not asks)

Carried forward from session 012's HANDOFF, mostly **inside
lumo's own scope** — not ionpower-node-side:

- **Pre-compiled namespace activation cost.** `-K` warms macros
  (18 files / 320 KB). Pre-compiled bundled namespaces
  (`clojure.string`, etc.) still pay transit-decode + activation
  cost on first reference — ~90 s for `clojure.string` on G3.
  Worth measuring before designing; would need a different cache
  mechanism than `-K` (analyzer-state pre-decode at build time,
  or an XDR bytecode cache for `main.js` + bundle). The XDR cache
  angle might touch SM45 — would file a separate ask if so.
- **Three upstream Lumo PRs** queued for Antonio Monteiro
  (deleted jszip fork, async lower in dev bundle, nexe-only
  `lumo.internal.embedded` FS fallback). All independent of
  ionpower-node.

## How we used your work this round

ionpower-node v1.1 is the foundation under lumo v1.0. The 3-line
`lumo-wrapper.js` and the 3-patch bundle script in session 012
exist because all 6 of v1.0's "asks" became no-ops in v1.1.
Concretely:

| Was a wrapper stub in session 007 | Status in v1.1 |
|---|---|
| `process.binding('util').*Watchdog` | Native |
| `v8.setFlagsFromString` | Native |
| `readline.emitKeypressEvents` | Native |
| `readline.Interface.prototype._setRawMode` | Native |
| `process.stdin.resume()` after data listener | Native (auto-resume) |
| `require()` error `.code = 'MODULE_NOT_FOUND'` | Native |

That's a clean sweep of the round-2 ask list. Much appreciated.

## Source links

- Lumo v1.0 release:
  https://github.com/cellularmitosis/lumo-darwin8-ppc/releases/tag/v1.0
- Lumo session 014 (this session's home, where the jar-require
  re-measurement and this handoff originated):
  [`../../../../lumo-darwin8-ppc/docs/sessions/014-punchlist-cleanup/`](../../../../lumo-darwin8-ppc/docs/sessions/014-punchlist-cleanup/)
- Lumo session 012 (the v1.1 uplift itself — patch-bundle.sh
  details + per-host benchmarks):
  [`../../../../lumo-darwin8-ppc/docs/sessions/012-ionpower-node-1.1-uplift/`](../../../../lumo-darwin8-ppc/docs/sessions/012-ionpower-node-1.1-uplift/)
- Lumo's wrapper:
  [`../../../../lumo-darwin8-ppc/docs/sessions/012-ionpower-node-1.1-uplift/lumo-wrapper.js`](../../../../lumo-darwin8-ppc/docs/sessions/012-ionpower-node-1.1-uplift/lumo-wrapper.js)
- Lumo's bundle patch script:
  [`../../../../lumo-darwin8-ppc/docs/sessions/012-ionpower-node-1.1-uplift/patch-bundle.sh`](../../../../lumo-darwin8-ppc/docs/sessions/012-ionpower-node-1.1-uplift/patch-bundle.sh)
