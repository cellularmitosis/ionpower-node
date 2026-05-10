# Handoff from sister project lumo-darwin8-ppc

**Date:** 2026-05-09.
**From:** [`lumo-darwin8-ppc`](../../../../lumo-darwin8-ppc/) — bringing
self-hosted ClojureScript on Node.js up under ionpower-node on Tiger
PPC.
**Status of that project:** Path A (cross-compile CLJS on uranium →
run bundle on Tiger) green on G3 + G4. Path B (in-process CLJS
compile-eval loop on Tiger) **core mechanic verified** on ionpower-
node v0.85 — `cljs.js` (the bootstrap CLJS compiler) loads, parses,
and `compile-str → eval` round-trips in ~7.7 s wall on a G3 750FX
for a 5.3 MB simple-optimized bundle.

This handoff captures the three small ionpower-node-side asks that
came out of the lumo bring-up. **None of them is blocking** for
basic Path B work — the v0.85 surface is enough to compile and
evaluate CLJS forms in-process today. They're the things that
would be nice to have when we wire up an actual REPL UX (likely
session 003 in lumo-darwin8-ppc) or get to a full Lumo bundle.

## Context

Lumo's source `scripts/bundle.js` declares the following Node
modules as `external` (i.e. expected to be provided by the
runtime):

```
assert, crypto, fs, module, net, os, path, readline, repl,
stream, tty, v8, vm, zlib
```

Cross-checked against ionpower-node v0.85: **all of these except
`repl` and `v8` are already shipped**, including the `vm` JS shim
that ionpower-node already carries. The detailed walkthrough lives
in [`../../../../lumo-darwin8-ppc/docs/sessions/002-lumo-first-blowup/README.md`](../../../../lumo-darwin8-ppc/docs/sessions/002-lumo-first-blowup/README.md).

## Three asks, in priority order

### Ask 1 (lowest priority): `require('repl')` stub

Lumo's `src/js/cljs.js` references `repl` for its interactive REPL
plumbing. Whether it's a hard dependency or only used in a fallback
path needs follow-up reading of the Lumo source — this hasn't been
exercised yet (lumo-darwin8-ppc session 002 used `cljs.js` directly,
not the full Lumo bundle).

**Probable shape of the fix:** seed `__require_cache__['repl']`
with a minimal stub `{ start: function() { throw new Error('repl
not implemented'); }, REPLServer: function() {}, Recoverable:
function() {} }`. Most consumers do feature-detect.

**When to do it:** when lumo-darwin8-ppc actually tries to load a
production-built Lumo bundle and hits the missing module. Probably
session 003 or 004 of that project. Not urgent.

### Ask 2 (lowest priority): `require('v8')` stub

Same shape as `repl`. Lumo may use `v8.serialize` /
`v8.deserialize` for its analyzer cache (faster cold start), or
`v8.getHeapStatistics` for diagnostics. Both are optional.

**Probable shape of the fix:** seed `__require_cache__['v8']`
with `{ serialize: function(o) { return Buffer.from(JSON.stringify(o)); },
deserialize: function(b) { return JSON.parse(b.toString()); },
getHeapStatistics: function() { return {}; } }`. The serialize
shim is JSON-roundtrip — lossy for non-JSON-serializable values,
but Lumo's cache contents are CLJS analyzer state that's
JSON-friendly anyway.

**When to do it:** same trigger as `repl`.

### Ask 3 (eventual): real compartment isolation in `vm.runInNewContext`

ionpower-node's existing `vm` JS shim is enough for **production-
build Lumo**. Lumo's `src/js/cljs.js` lines 110, 127 use
`vm.runInThisContext(source, scriptOptions)` in its production
codepath, which is exactly what our `(0, eval)` shim handles.

The shim is **not** enough for **dev-build Lumo**, which uses
`vm.runInContext(source, ClojureScriptContext, ...)` with a shared
sandbox. The current shim (`runInNewContext = Function.apply with
sandbox-keys-as-args`) doesn't propagate writes back into the
sandbox, so the persistent compiler state would be lost between
forms. The smoke at [`test/vm_module_smoke.js:24-28`](../../../test/vm_module_smoke.js)
explicitly notes this.

**Probable shape of the fix:** a real native
`vm.createContext(sandbox)` that returns a JS object with a sealed
inner [[GlobalObject]], plus a real `vm.runInContext(code, ctx,
opts)` that calls `JS::Evaluate` against that inner global. ~a day
of native work. Not urgent — pursued only if we want to run
non-production Lumo builds, or if a downstream library that needs
real `vm` isolation surfaces (none has yet across ionpower-node's
660+ vendored libraries).

**When to do it:** discretionary. Useful for Lumo dev builds and
for any future library that exercises `vm` isolation. Not blocking
for production Lumo on Tiger.

## What's *not* asked

No request to change anything that's working today. No request to
change the `vm` JS shim's `runInThisContext` behavior — `(0, eval)`
is exactly right for production-Lumo's eval path. No request to
ship a Lumo-specific test case — lumo-darwin8-ppc's session
artifacts ([`002-lumo-first-blowup/build-logs/ibookg37-probe-run.log`](../../../../lumo-darwin8-ppc/docs/sessions/002-lumo-first-blowup/build-logs/ibookg37-probe-run.log))
already prove the v0.85 surface suffices.

One **separately-filed observation** worth a smoke at some point:

- In lumo-darwin8-ppc session 001, the Babel-on-parse-failure
  fallback **loaded** when SM45 hit a single ES2021 logical-OR-
  assignment (`||=`) in Closure Library output, but the
  Babel-transformed source still had the operator and SM45 still
  rejected it. Not blocking (we work around with
  `:language-out :ecmascript5` in the CLJS build), but it suggests
  the Babel preset list doesn't include
  `transform-logical-assignment-operators`. ~30 min to verify with
  a `b||=a` smoke and add the preset.

## Pointers back

- lumo-darwin8-ppc README: [`../../../../lumo-darwin8-ppc/README.md`](../../../../lumo-darwin8-ppc/README.md)
- Path B verification session: [`../../../../lumo-darwin8-ppc/docs/sessions/002-lumo-first-blowup/README.md`](../../../../lumo-darwin8-ppc/docs/sessions/002-lumo-first-blowup/README.md)
- The `cljs.js` probe source + bundle that proved Path B viable:
  [`../../../../lumo-darwin8-ppc/docs/sessions/002-lumo-first-blowup/`](../../../../lumo-darwin8-ppc/docs/sessions/002-lumo-first-blowup/)
