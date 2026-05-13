# Session 1 plan: handoff from lumo-darwin8-ppc

## Context

Sister project [`lumo-darwin8-ppc`](../../../../lumo-darwin8-ppc/)
has Path B (in-process CLJS compile-eval on Tiger) **working** on
ionpower-node v0.85 — a 5.3 MB simple-optimized `cljs.js` bundle
loads, parses, and round-trips `compile-str → eval` in ~7.7 s wall
on a G3 750FX. Their handoff doc is at
[`handoff-from-lumo.md`](handoff-from-lumo.md) in this same dir
(canonical source — read that first).

**None of the asks below are blocking lumo's current work.** The
v0.85 surface already lets them compile and evaluate CLJS forms
in-process today. These are improvements that would unblock or
de-friction work in their session 003+ (production Lumo bundle,
REPL UX, possibly dev-build Lumo).

## Scope for this session

Tackle the three cheap ones (items 1 / 2 / "Babel observation"),
defer the big one (item 3, real `vm` compartment isolation).

| # | Item | Effort | Status |
|---|------|--------|--------|
| 1 | `require('repl')` stub | ~30 min | in scope |
| 2 | `require('v8')` stub | ~30 min | in scope |
| obs | Babel preset for `\|\|=` (logical OR-assign) | ~30 min | in scope |
| 3 | Real `vm.runInNewContext` compartment isolation | ~1 day native | defer to followups |

Three small commits, each with a smoke wired into
`scripts/test-list-more.txt`. Build + test on G3 via
`scripts/triad-build.sh ibookg37 g3 0.86`. Cut v0.86 release at
the end (or hold for additional npm-exploration work if that's
queued first).

## Item-by-item

### 1. `require('repl')` stub

**Why.** Lumo's `src/js/cljs.js` references `repl` for interactive
REPL plumbing. Whether it's hard-required or only used in a
fallback path needs follow-up reading of the Lumo source — but
shipping a stub costs nothing and unblocks lumo session 003 if
they hit it.

**Where.** `src/node_compat/globals.cpp`, in `kBootstrapJS`. There's
a precedent for seeding fake packages — find the `__require_cache__`
seeding section (look for `'supports-color'` / `'has-ansi'` /
`'safe-buffer'`) and add `'repl'` alongside.

**Shape:**
```js
__require_cache__['repl'] = {
    start: function () { throw new Error('repl not implemented'); },
    REPLServer: function () {},
    Recoverable: function () {}
};
```

Most consumers feature-detect; the stub just lets `require('repl')`
not throw at module-load time.

**Smoke.** `test/repl_stub_smoke.js` — `require('repl')`, assert the
three properties exist, assert `start()` throws. Add to
`scripts/test-list-more.txt`.

### 2. `require('v8')` stub

**Why.** Lumo may use `v8.serialize` / `v8.deserialize` for an
analyzer cache (faster cold start) or `v8.getHeapStatistics` for
diagnostics. Both are optional; same trigger as `repl`.

**Where.** Same place as item 1.

**Shape:**
```js
__require_cache__['v8'] = {
    serialize:   function (o) { return Buffer.from(JSON.stringify(o)); },
    deserialize: function (b) { return JSON.parse(b.toString()); },
    getHeapStatistics: function () { return {}; }
};
```

JSON-roundtrip is lossy for non-JSON-serializable values, but
Lumo's analyzer-state cache contents are JSON-friendly anyway.

**Smoke.** `test/v8_stub_smoke.js` — round-trip a small
`{a:1, b:[2,3]}` through serialize+deserialize, assert
`getHeapStatistics()` returns an object. Add to
`scripts/test-list-more.txt`.

### Babel observation: missing `transform-logical-assignment-operators`

**Why.** lumo-d8p session 001 hit a single `||=` in Closure
Library output (`goog.html.TrustedResourceUrl.stringifyParams_`).
The Babel-on-parse-failure fallback **loaded** but the transformed
output still contained `||=` and SM45 still rejected it — which
means the preset list doesn't include
`transform-logical-assignment-operators`. They worked around in
their CLJS build with `:language-out :ecmascript5`; this would
let them keep more native syntax.

**Where.** Find where the Babel parse-failure fallback wires up
the preset/plugin list. Two likely candidates:
- `src/main.cpp` if the preset list is built C++-side and passed
  into the JS babel call.
- Inside `kBootstrapJS` in `src/node_compat/globals.cpp` if the
  list lives in JS.

`grep -n 'preset\|plugin\|babel' src/main.cpp src/node_compat/globals.cpp`
will find it fast. Add `'transform-logical-assignment-operators'`
to the plugin list. (If it's a preset-env, set
`targets: { ie: '11' }` — already done per CLAUDE.md memory of
v0.84 — should already pull this plugin in. Need to check whether
the preset bundle even ships it; if not, add as a discrete plugin
require.)

**Smoke.** `test/babel_logical_assignment_smoke.js` — parse a tiny
script that uses `b ||= a`, `b &&= a`, `b ??= a` and a JS source
that triggers the parse-failure fallback. Assert the result
matches expected behavior (e.g. `b ||= a` only assigns when `b` is
falsy). Add to `scripts/test-list-more.txt`.

### Item 3 (deferred): real `vm.runInNewContext` compartment isolation

Captured in
[`docs/sessions/2026-04-30-session-3-proto-deopt/followups.md`](../../2026-04-30-session-3-proto-deopt/followups.md)
as a v0.86+ TODO. Native work — `vm.createContext(sandbox)` returns
a JS object with a sealed inner `[[GlobalObject]]`, plus a real
`vm.runInContext(code, ctx, opts)` that calls `JS::Evaluate`
against that inner global. ~a day. Needed only for dev-build Lumo
and for any future library that exercises `vm` isolation (none
across the 660+ vendored libraries today).

**When to revisit:** when lumo-d8p tries a dev-build Lumo, or when
another lib surfaces requiring real isolation. The existing JS
shim documents the limitation honestly in
`test/vm_module_smoke.js:24-28`.

## Working order

1. **Set up session.** Bump `Makefile` `VERSION` to `0.86` (also
   `src/node_compat/process.cpp`, `README.md`). Create
   `notes.md` in this session dir, write entries as you go.
2. **Item 1 (repl stub):** edit `globals.cpp`, add smoke, add to
   list, run `make test-libs` locally + verify on G3 via the
   triad-build script. One commit.
3. **Item 2 (v8 stub):** same flow. One commit.
4. **Babel preset:** poke around for the preset wiring, add
   plugin, smoke, verify the `||=` Closure-Library case unblocks.
   This one might surface surprises (preset-env vs explicit plugin
   list, plugin not in our vendored Babel build, etc.). One
   commit; if it gets messy, defer to its own session.
5. **Triad build + tests on G3** via
   `scripts/triad-build.sh ibookg37 g3 0.86` — same flow as v0.85.
   The `check-demo-deps` and `check-test-coverage` gates run
   automatically.
6. **Update `followups.md`** to mark items 1 / 2 / babel-preset
   done; leave item 3 captured for later.
7. **Cut v0.86 release** — re-cut tarballs, update GH release
   notes (mirror the install snippet from README, mention the
   three new things), append the matching `release-notes/v0.86.md`
   here. Hold the release if there's other v0.86 work queued.
8. **Update lumo-d8p.** Drop a short note at
   `../../../../lumo-darwin8-ppc/docs/sessions/` (likely the next
   session dir there) telling them v0.86 ships the stubs + the
   Babel preset, so they can drop the `:language-out :ecmascript5`
   workaround if they want.

## Quick references for future-Claude

- Test-list workflow: [`../../../../ionpower-node/CLAUDE.md`](../../../CLAUDE.md)
  "Test-list workflow" section.
- Triad-build flow: same CLAUDE.md, "Triad build flow" section.
- Bootstrap JS source: `src/node_compat/globals.cpp`
  `kBootstrapJS[]` (~9000 lines; use grep for landmarks).
- Existing fake-package precedent: search `globals.cpp` for
  `supports-color`, `has-ansi`, `safe-buffer`, `cli-boxes`.
- Sister-project handoff source: [`handoff-from-lumo.md`](handoff-from-lumo.md).
- lumo-d8p verification artifact:
  [`../../../../lumo-darwin8-ppc/docs/sessions/002-lumo-first-blowup/`](../../../../lumo-darwin8-ppc/docs/sessions/002-lumo-first-blowup/).
