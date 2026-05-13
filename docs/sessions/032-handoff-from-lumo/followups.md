# Follow-ups from v0.86

Captured for post-v0.86 sessions.

## 1. Real `vm.runInNewContext` compartment isolation (carried from v0.84)

Original capture lives in
[`../031-proto-deopt/followups.md`](../031-proto-deopt/followups.md).

**Why.** The current JS shim of `vm` parameterizes the sandbox keys
as `Function()` args and invokes the resulting function. Good enough
for production-build Lumo (which uses `vm.runInThisContext`), template
engines, and JSON-path probes. **Not** good enough for dev-build Lumo,
which calls `vm.runInContext(source, ClojureScriptContext, ...)` with
a shared sandbox and expects writes to propagate back.

**Probable shape.** Native `vm.createContext(sandbox)` returning a JS
object backed by a sealed inner `[[GlobalObject]]`, plus a real
`vm.runInContext(code, ctx, opts)` that calls `JS::Evaluate` against
that inner global. ~one day of native work.

**Trigger.** Lumo dev-build attempt, or any future vendored library
that exercises real `vm` isolation. None across the 660+ libs today.
The existing JS shim documents the limitation in
[`test/vm_module_smoke.js:24-28`](../../../test/vm_module_smoke.js).

## 2. eval-path Babel lowering

Babel-on-parse-failure today only wraps the **require()** path —
`src/node_compat/require.cpp:386` catches the SyntaxError, asks
`__try_babel_transpile__` for an ES5-ish version, and re-evaluates
the wrapped form.

**Gap.** Code passed through `(0, eval)(...)`, `vm.runInThisContext`,
or `Function(...)` does not get the same treatment. If the input
contains ES2021+ syntax (`||=`, `?.()`, etc.) SM45's parser rejects
it on the spot and there's no second chance.

This came up in lumo-darwin8-ppc session 001: `cljs.js` evaluates the
output of `compile-str` directly — the `||=` slipped through into an
`eval` call rather than a `require()`, which is why the existing
require-path Babel fallback didn't help and they had to set
`:language-out :ecmascript5` in their CLJS build.

**Probable shape.** Wrap the indirect-eval and `runInThisContext`
implementations to retry through `__try_babel_transpile__` on
SyntaxError (using the source text directly, no path / mtime — so no
disk caching). Cheaper than a real native vm but covers a strictly
larger set of consumers than the require-path fallback alone.

**When to do it.** Same trigger as item 1 — when lumo or a vendored
library hits it. Probably worth one paired smoke that calls
`eval('var b = null; b ||= "x"; b')` and asserts `'x'`.

## Done in v0.86

- `require('repl')` stub seeded into `__require_cache__`.
- `require('v8')` stub seeded into `__require_cache__`
  (`serialize`/`deserialize` via JSON, opaque `getHeapStatistics`).
- `transform-logical-assignment-operators` plugin pinned explicitly
  in the Babel-on-parse-failure transform call so `||= &&= ??=`
  always lower regardless of preset-env's compat-table decisions.
- Added `repl` and `v8` to `module.builtinModules`.
