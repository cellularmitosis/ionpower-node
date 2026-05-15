# Session handoff: Node 10 parity, pass 11

## Read first

In order:

1. [`notes.md`](notes.md) — pass-10 narrative. One-character fix in
   [`src/node_compat/zlib.cpp`](../../../src/node_compat/zlib.cpp)
   (`while (d.bitcount > 8)` → `while (d.bitcount >= 8)` in
   `tinf_inflate_uncompressed_block`) closed the gunzip "Data error"
   that blocked `npm install express`. v0.96 shipped.
2. [`release-notes/v0.96.md`](release-notes/v0.96.md) — what shipped.
3. [`build-logs/`](build-logs/) — per-host build + smoke output for
   the triad.

## Context in one paragraph

`npm install express` works end-to-end on real PowerPC against the
live registry — 70-ish packages in 3-5 minutes. But `require("express")`
itself doesn't yet load. Two API gaps stand between us and a clean
"npm install + run express" demo. Pass 11 is to close those.

## Gaps to close — pass 11 punch list

### A. ES2018 object spread in modern user code

`express@5.2.1` `lib/application.js:536`:

    var renderOptions = { ...this.locals, ...opts._locals, ...opts };

SpiderMonkey 45 doesn't parse this — fails at script-load time with
`SyntaxError: invalid property id`. Many other Node-10-era and newer
libs use the same syntax (object spread is ubiquitous since 2018).

**Two options for fix**:

1. **Babel-on-parse-error (recommended)** — we already ship
   `vendor/babel.js` with the runtime (used by demos that opt in).
   Wire it into the require hook so that when a module fails to parse,
   we re-try after running it through Babel. Costs a few hundred ms
   per affected module on first load (cache the transformed output to
   `~/.ionpower-node/cache/<hash>.js` to amortize across runs).
2. **Bump SpiderMonkey** — TenFourFox does ship newer SM with some
   ES2018+ features. Not in scope for this session — much bigger
   change, breaks IonPower assumptions.

Go with option 1. Look at how the existing
`demos/express-chat-npm/` (pass-9 plan, not yet built) was supposed
to handle this — probably the same Babel-on-parse-error approach.

### B. V8 `CallSite` API for `Error.captureStackTrace` consumers

`express@4.22.2`'s `depd` dep `node_modules/depd/index.js:268`:

    function callSiteLocation (callSite) {
      var file = callSite.getFileName() || '<anonymous>'
      var line = callSite.getLineNumber()
      var colm = callSite.getColumnNumber()
      if (callSite.isEval()) {
        file = callSite.getEvalOrigin() + ', ' + file
      }
      ...
      site.name = callSite.getFunctionName()

We expose `Error.captureStackTrace(target, constructorOpt)` as a
stub (it sets `.stack` to a string). What `depd` and friends want
is the **structured** stack: `Error.prepareStackTrace = (err, frames) => ...`
gets called with an array of `CallSite` objects, each with
`getFileName()`, `getLineNumber()`, `getColumnNumber()`,
`getFunctionName()`, `isEval()`, `getEvalOrigin()`, `getThis()`,
`getFunction()`, `getMethodName()`, `getTypeName()`,
`isToplevel()`, `isConstructor()`, `isNative()`.

**Implementation sketch**: SM45 has its own stack-frame interface
(via `JS::DescribeScriptedCaller`, `js::CaptureStack`, etc).
`Error.prepareStackTrace = fn` should make our `.stack` getter call
`fn(this, frames)` where `frames` is an array of objects with the
V8 CallSite shape, populated from SM's frame data. ~300 lines of
C++ + JS bridge. Most consumers (depd, sinon, mocha, jest, ...)
only use `getFileName` / `getLineNumber` / `getColumnNumber` /
`getFunctionName` — implement those four first, stub the rest.

### C. Land `demos/express-chat-npm/` once A + B work

From the pass-10 handoff plan:

> 1. Copy `demos/express-chat/{server,client}.js`, `views/`, `static/`
>    to `demos/express-chat-npm/`.
> 2. Replace the `require(path.join(VENDOR_DIR, "express"))` /
>    `require(path.join(VENDOR_DIR, "handlebars.js"))` calls with plain
>    `require("express")` / `require("handlebars")` / `require("ws")`.
> 3. Add a `package.json` declaring those three deps.
> 4. README: walk through the install + run on G3.
> 5. Smoke: a `make demo-express-chat-npm` target that builds
>    node_modules, starts server, runs client, asserts a post round-
>    trips.

### D. Smaller carryover

- `fs.promises.read` / `write` return shape (since v0.92).
- `execa/lib/errname` warning at end of every npm install — cosmetic,
  but probably wants a `process.binding('uv')` stub returning the
  errname table.

## Working order

1. Read `notes.md` + `release-notes/v0.96.md`.
2. **A first** — Babel-on-parse-error in the require hook. Test by
   running `node -e 'require("express")'` after `npm install express`
   in `/Users/macuser/tmp/express-discovery/` on ibookg37; we want
   that command to print without `SyntaxError`. (It will fail later
   on depd's CallSite call — that's B.)
3. **B next** — minimal V8 CallSite shim. Test against `depd` directly
   (cheap repro: `node -e 'require("depd")("test")("hi")'`).
4. With both A + B in place, retry `node -e 'var e = require("express"); var app = e(); app.listen(3000)'` — the goal is the server actually listening on a port.
5. **C** — land `demos/express-chat-npm/`. Triad-build, cut v0.97.

## ibookg37 note

The host stayed up the whole pass-10 session — first time in a few
weeks. The mSATA swap is still planned (HDD has been throwing hints
for months) but the failure rate has dropped enough that you don't
need to baby it for another session unless you start seeing the
ssh-banner hangs again. Default to `/Users/macuser/tmp/` for
build/test scratch (still safer than `/tmp/`).

## Test/repro scratch on G3

Already in place at `/Users/macuser/tmp/`:

- `repro-mfh.js`, `repro-passthrough.js`, `repro-capture.js`,
  `repro-mfh-nocache.js`, `tinflate-stress.js`, `repro-require-express.js`
- `express-discovery/node_modules/` — fresh `express@4.22.2` install
  from pass 10. About 68 packages, ~25MB.
- `express-discovery/repro-require-express.js` — the failing
  `require('express')` test (currently `SyntaxError` if you point at
  express@5, `TypeError: callSite.getFileName is not a function` if
  express@4).

Don't blow these away if you can avoid it — they save a 3-5 min
re-install per iteration.
