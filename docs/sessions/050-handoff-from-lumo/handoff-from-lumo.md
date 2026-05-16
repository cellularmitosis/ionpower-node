# Handoff from sister project lumo-darwin8-ppc — round 2

**Date:** 2026-05-15.
**From:** [`lumo-darwin8-ppc`](../../../../lumo-darwin8-ppc/) session
007 — got the real upstream Lumo 1.10.1 / ClojureScript 1.10.520
bundle running end-to-end on a Tiger G3 iBook under ionpower-node
v1.0.

**Status of that project:** Path B complete. The full Lumo bundle
boots + evaluates the 4-form smoke (`(+ 1 2 3)` / `(def square …)`
/ `(mapv square (range 1 6))` / `(clojure.string/upper-case
"hello")`) correctly on G3. Cold boot ~3 min on G3 (one-time per
session); per-form eval after boot is sub-second.

It works **with a 4-stub `lumo-wrapper.js`**. Five distinct gaps
in ionpower-node's API surface were discovered (and worked around)
during the bring-up. All five are small, well-defined, and worth
landing on the runtime side so any other Node-targeted CLJS bundle
(plus the broader ecosystem) doesn't have to ship its own wrapper.
The four-line wrapper that papers over them is at
[`../../../../lumo-darwin8-ppc/docs/sessions/007-lumo-upstream-bringup/lumo-wrapper.js`](../../../../lumo-darwin8-ppc/docs/sessions/007-lumo-upstream-bringup/lumo-wrapper.js).

## Five small asks

### Ask 1 (BIGGEST WIN): `require()` should set `e.code = 'MODULE_NOT_FOUND'` on miss

This is the one with the largest blast radius. Modern Node's
`require()` throws an `Error` whose `.code === 'MODULE_NOT_FOUND'`
when a module can't be resolved. Any library that catches
require-fails distinguishes this case from a real load-time error
inside the module's body by reading `.code` — that's the Node
contract.

ionpower-node's `RequireNative` in
[`src/node_compat/require.cpp`](https://github.com/cellularmitosis/ionpower-node/blob/main/src/node_compat/require.cpp)
(around line 658) throws via `JS_ReportError` with the message
`require: cannot find module '%s' from '%s'` — but **doesn't set
any error code property**. The wrapped JS exception has empty
`Object.getOwnPropertyNames` apart from `fileName`, `lineNumber`,
`columnNumber`, `message`.

Lumo's CLJS-compiled code does:

```js
try {
  var lumo_repl = require('lumo.repl');
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    // ok, fall through to in-bundle namespace lookup
  } else {
    throw e;
  }
}
```

…and with no `.code`, the catch reraises, the `node$module$lumo$repl`
indirection never gets wired up, and every subsequent eval that
references a namespace dies with `cljs.user.node$module$<ns> is
undefined`. Took ~30 minutes of session 007 to trace.

**Suggested fix:** in `RequireNative` (and the matching
`ResolveNative` — its message has `MODULE_NOT_FOUND:` as a
prefix already), construct the error as a proper `Error` object
with `.code = 'MODULE_NOT_FOUND'` set as a JS-side property. The
JS-level shape Node uses:

```js
var e = new Error("Cannot find module '" + spec + "' from '" + dir + "'");
e.code = 'MODULE_NOT_FOUND';
e.requireStack = [];   // optional, but matches Node 10+
throw e;
```

There's prior art in the file for how Node-shape errors get
constructed (the http2 stub from v1.0 does this, for instance).

Lumo's wrapper translates the existing error format via a regex on
the message, which works but is ugly:

```js
global.require = function (id) {
  try { return require(id); }
  catch (e) {
    if (e && typeof e.message === 'string' && !e.code &&
        /^require: cannot find module/.test(e.message)) {
      e.code = 'MODULE_NOT_FOUND';
    }
    throw e;
  }
};
```

### Ask 2: `process.binding('util').{start,stop}SigintWatchdog` + `watchdogHasPendingSigint`

Three no-op methods on the `'util'` binding. ionpower-node's
`process.binding` stub returns `{}` for every name except `'uv'`.
Lumo's `cljs.js` calls these around every `vm.runInThisContext`
to support `breakOnSigint` (Node-internal mechanism for SIGINT-
interrupts-a-running-form). SM45 has no equivalent, so no-ops are
the right semantics:

```js
'util': {
  startSigintWatchdog:       function () {},
  stopSigintWatchdog:        function () { return false; },
  watchdogHasPendingSigint:  function () { return false; }
}
```

Currently in `src/node_compat/process.cpp` around line 403, the
`binding` JS-side closure already has a name-switch — adding a
case for `'util'` is the natural spot.

### Ask 3: `v8.setFlagsFromString`

A no-op stub in `__require_cache__['v8']`. Lumo's `startCLI`
unconditionally calls `v8.setFlagsFromString('--use_strict')` at
boot, and again around `getGoogleClosureCompiler`. The current
`require('v8')` stub (globals.cpp:~6960) ships
`serialize`/`deserialize`/`getHeapStatistics` but not this. SM45's
strict-mode plumbing is incompatible with V8's anyway — a no-op
is correct, just not currently present.

```js
__require_cache__['v8'].setFlagsFromString = function () {};
```

### Ask 4: `readline.emitKeypressEvents`

Lumo wires its paredit-aware keypress handler via
`readline.emitKeypressEvents(process.stdin, rl)`. ionpower-node's
readline (globals.cpp:~9753) ships `Interface`/`createInterface`/
`cursorTo`/`moveCursor`/`clearLine`/`clearScreenDown` but not
this. For piped-stdin smoke a no-op suffices; for interactive
TTY use, this means paredit keybindings + history-search don't
fire — basic `'line'` events still work for one-line entry.

A proper implementation parses ANSI escape sequences off the
stream and emits `'keypress'` events with the right shape; even a
minimal version (decode arrow keys + Ctrl-* + plain printables)
would be enough for an interactive REPL.

```js
// Quick stub (no real keypress decoding):
readline.emitKeypressEvents = function () {};
```

### Ask 5: `readline.Interface.prototype._setRawMode`

Lumo's eval wrapper calls
`currentREPLInterface._setRawMode(false)` around every form
(Node-internal raw-mode suspend so the evaluating form sees stdin
in cooked mode). ionpower-node's `_ReadlineInterface` doesn't
have it. The expected semantics: change the underlying stream's
raw mode and return the previous state. Even returning a stable
`false` works (Lumo just restores the previous value at the end of
the form):

```js
_ReadlineInterface.prototype._setRawMode = function (mode) {
  if (this.input && typeof this.input.setRawMode === 'function') {
    var prev = this.input.isRaw;
    try { this.input.setRawMode(mode); } catch (_) {}
    return prev;
  }
  return false;
};
```

### Ask 6: pty stdin should auto-resume when a 'data' listener attaches

After landing asks 1-5 + the patch-bundle.sh patches, the piped
smoke works end-to-end on G3. But the pty smoke initially failed:
banner + prompt printed, expect sent a form, the tty echoed it,
but Lumo never printed the eval result. The lumo-darwin8-ppc
side traced this to a real ionpower-node bug with a 5-line
standalone repro:

```js
// stdin-pty-test.js
process.stdout.write('ready\n');
process.stdin.on('data', function (d) {
  process.stdout.write('got ' + d.length + '\n');
});
```

Spawn under expect, send `"hello\r"`. **Uranium fires `data`
events; G3 (ionpower-node) does not.** Same code, same expect,
different runtime.

Workaround: explicit `process.stdin.resume()` at user-code start.
This is the same shape as the session 004 issue
(`lumo-darwin8-ppc/docs/sessions/004-repl-tty-resume-bug-fix/`).
Real Node fires `'data'` automatically once a listener is added
to a Readable; ionpower-node requires the explicit resume on a
TTY fd.

Proper fix on the runtime side: either

1. Make `_ReadlineInterface` (globals.cpp:9689) call
   `this._input.resume()` after `this._input.on('data', ...)`,
   matching real Node's readline behavior. This is the cheaper
   fix and unblocks any library that uses readline.
2. Or make `process.stdin` enter flowing mode automatically on
   first listener-attach for TTY fds — that's the deeper
   stream-semantics fix and would also help any non-readline
   library that does `process.stdin.on('data', …)`.

Either fix would shrink our wrapper by one more line.

### Bonus: `_ReadlineInterface.output` for cooked-mode multi-line input

While pty smoke passed with the resume fix, there's a cosmetic
`io-watcher: TypeError: rl.output is undefined` printed once
during multi-line eval (between the third continuation prompt
and the eval result). The bundle source at
`bundle.js:13419` (approximately, see Lumo's repl-keystream
handler) tries to write to `rl.output` for a redraw, but our
readline Interface's `output` property may not be initialized
when input/output were passed as separate options. Suggested
fix in `_ReadlineInterface` constructor: also alias `this.output
= this._output` (and `this.input = this._input` since other
code paths read those).

## A heavier ask (for v1.x+, not v1.1)

### `vm.runInContext(source, sandbox)` should capture top-level vars

ionpower-node's `_vmRunInNewContext` (used as both `runInContext`
and `runInNewContext`) implements the sandbox as
`Function`-argument keys + values:

```js
var fn = Function.apply(null, keys.concat([fnBody]));
return fn.apply(sandbox, vals);
```

That works for "evaluate a small expression against a known-keys
sandbox" — but **can't capture top-level `var` declarations from
the script's body as properties on the returned sandbox**. The
vars become locals of the wrapper function and disappear.

Lumo's dev-mode `newDevelopmentContext` builds a sandbox and reads
properties off it afterward to find the CLJS engine:

```js
const ctx = vm.createContext({...});
new vm.Script(load$1('main.js'), {}).runInContext(ctx);
return ctx;   // <-- expects ctx.cljs.core etc. populated
```

Without faithful capture, `ctx.cljs` is undefined and the bundle
crashes. Session 007 worked around it by rewriting Lumo's
`newDevelopmentContext` to use `global` + `runInThisContext`
instead — which is what Lumo's tree-shaken-out production-mode
code path does. But "ditch the sandbox" isn't always available
to other libraries.

A faithful implementation needs to lift `var` declarations off
the script body before execution and project them onto the
sandbox after. SM45 has no native compartment notion, so this is
nontrivial. Documented here as a known gap; not asking for it
in v1.1.

## Verification path

The Lumo bring-up reproduces from scratch with these inputs:

1. `git clone --depth 1 --branch 1.10.1 https://github.com/anmonteiro/lumo`
2. Apply
   [`lumo-1.10.1-deps.patch`](../../../../lumo-darwin8-ppc/docs/sessions/007-lumo-upstream-bringup/lumo-1.10.1-deps.patch)
   (replaces deleted `anmonteiro/jszip` fork pin).
3. `yarn install --ignore-scripts`, then `boot --disable-watchers
   compile-cljs sift-cljs-resources 'cache-edn->transit'
   write-core-analysis-caches target` then
   `boot --disable-watchers bundle-js -d`.
4. Apply
   [`patch-bundle.sh`](../../../../lumo-darwin8-ppc/docs/sessions/007-lumo-upstream-bringup/patch-bundle.sh)
   to `target/bundle.js`. Four in-bundle patches: async-strip,
   `lumoEval` runInContext→runInThisContext,
   `newDevelopmentContext` rewrite + require-error-code wrap,
   `isBundled` flat-layout fix.
5. tar+scp the `target/` tree + the wrapper to G3, run
   `node lumo-wrapper.js` from cwd. Cold-boot ~3 min, banner +
   prompt + evals as expected.

If asks 1-5 above land, the wrapper shrinks from ~80 lines of
JS to just `require('./bundle.js')` plus possibly NODE_ENV=
production. The patch-bundle.sh patches all become unnecessary
*except* possibly the async-strip and the `isBundled` flat-path
(those are Lumo packaging issues, not ionpower-node).

## Cross-links

- Lumo session 007 README:
  [`../../../../lumo-darwin8-ppc/docs/sessions/007-lumo-upstream-bringup/README.md`](../../../../lumo-darwin8-ppc/docs/sessions/007-lumo-upstream-bringup/README.md)
- Lumo session 007 HANDOFF.md:
  [`../../../../lumo-darwin8-ppc/docs/sessions/007-lumo-upstream-bringup/HANDOFF.md`](../../../../lumo-darwin8-ppc/docs/sessions/007-lumo-upstream-bringup/HANDOFF.md)
- Earlier round-1 handoff (v0.85 era):
  [`../032-handoff-from-lumo/handoff-from-lumo.md`](../032-handoff-from-lumo/handoff-from-lumo.md)
