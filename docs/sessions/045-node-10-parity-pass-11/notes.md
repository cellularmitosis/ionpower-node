# Session notes — 045: Node 10 parity pass 11

Handoff: [`../044-node-10-parity-pass-10/handoff-pass-11.md`](../044-node-10-parity-pass-10/handoff-pass-11.md).
Pass-10 notes: [`../044-node-10-parity-pass-10/notes.md`](../044-node-10-parity-pass-10/notes.md).

## TL;DR

`require('express')` works end-to-end on real PowerPC. A real Express
server boots, listens, serves JSON, closes cleanly. Cut v0.97.

The only meaningful gap from pass 10 was V8's structured `CallSite`
API — `depd` (transitive dep of express@4) calls
`Error.prepareStackTrace = fn; Error.captureStackTrace(obj); obj.stack`
and then iterates the result calling `.getFileName()` etc. Our prior
`Error.captureStackTrace` shim made `obj.stack` a plain string, so the
loop crashed at `cs.getFileName is not a function`.

The handoff plan listed a parallel "object spread → Babel" gap, but on
audit Babel-on-parse-error was already wired in (in `require.cpp` +
`__try_babel_transpile__`) and `express@4` doesn't use object spread
anyway. (`express@5` does, but we're focused on @4 since it's the
Node-10-era line.)

## What landed

### B. V8 CallSite + Error.prepareStackTrace shim

`src/node_compat/globals.cpp` — replaced the 25-line "set `.stack` to
a string" stub with a V8-shape implementation:

- Parse the SM45 stack string (`funcName@file:line:col\n…`) once at
  capture time into an array of CallSite-shaped objects exposing
  `getFileName / getLineNumber / getColumnNumber / getFunctionName /
  getEvalOrigin / getMethodName / getTypeName / isToplevel / isEval /
  isNative / isConstructor / getThis / getFunction / toString /
  getScriptNameOrSourceURL / isAsync / isPromiseAll / getPromiseIndex`.
- Make `target.stack` a lazy accessor: on first read, if
  `Error.prepareStackTrace` is a function, call
  `prepareStackTrace(target, frames)` and cache the result; otherwise
  cache a V8-style `Error[: msg]\n    at func (file:line:col)\n…` string.
- Honour `constructorOpt`: drop frames at and above the first frame
  whose `getFunctionName()` matches `constructorOpt.name`.
- Eval-frame detection: SM embeds `" line N > eval"` in the filename;
  strip it, set `isEval()` true, and stash the original in
  `getEvalOrigin()`.

Why JS-side: the C++ frame interface in SM45 is awkward to dance with
across compartments and rooting boundaries, and the SM stack-string is
already the canonical form we need. Parsing it once costs a sub-ms
regex pass — irrelevant next to the work the consuming library (depd,
mocha, sinon) is doing.

### Demo: `demos/express-chat-npm/`

Copies the structure of `demos/express-chat/` but uses plain
`require('express')` / `require('handlebars')` / `require('ws')` and
ships a `package.json` declaring those deps. The first run does
`npm install`; subsequent runs boot in a few seconds. Same client.js
smoke (POST/GET/tripcode/rate-limit/since/empty-text checks).

The `package.json` pins:

- `express@4.22.2` (Node-10 era, last release before @5's ES2018 spread)
- `handlebars@4.7.8`
- `ws@7.5.10` (Node-10 compatible)

### Smoke: `test/callsite_smoke.js`

7 assertions exercising the V8 idiom: default formatting returns a
string; with `Error.prepareStackTrace` set, `obj.stack` returns the
raw frame array; each frame implements the 13 V8 CallSite methods;
the top frame correctly reports its own enclosing function; the
`constructorOpt` cutoff works; the depd `callSiteLocation` pattern
returns the expected `[file, line, col]` shape; the lazy accessor
caches its result (one `prepareStackTrace` call across repeated reads);
explicit `obj.stack = ...` overrides the lazy accessor.

Added to `scripts/test-list-core.txt`.

## Verification

- All 14 core smokes pass on G3 — incl. the new `callsite_smoke.js`.
  ([`build-logs/ibookg37-g3-0.97-build.log`](build-logs/ibookg37-g3-0.97-build.log))
- `require('express')` on real `express@4.22.2` (the npm-installed
  tree from pass 10): module loads, `app = express()` constructs,
  three routes register, `app.listen(3789)` succeeds, a `GET /health`
  round-trips a JSON body, `server.close()` runs the callback.
  ([`build-logs/express-server-smoke.log`](build-logs/express-server-smoke.log))
- Triad-build G3 + G4 + G5 clean (per-arch logs in `build-logs/`).

## Carryover (not addressed)

- **`fs.promises.read` / `write` return shape** — still pending since
  v0.92.
- **`execa/lib/errname: unable to establish process.binding('uv')`**
  warning at end of `npm install`. Cosmetic.
- **`express@5` end-to-end**: Babel-on-parse-error is wired and the
  IE-11 preset target lowers object spread, but we haven't actually
  run `require('express')` against express@5 yet. The vendored
  `vendor/babel.js` should make this work in principle — punted to a
  follow-up.
- **prototype-mutation warning** in `node_modules/express/lib/router/index.js:51`
  — SM emits one warning at startup. Cosmetic; can't fix from outside
  express without monkey-patching `Object.setPrototypeOf`.
