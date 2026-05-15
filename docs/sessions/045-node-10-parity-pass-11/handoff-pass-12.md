# Session handoff: Node 10 parity, pass 12

## Read first

1. [`notes.md`](notes.md) — pass-11 narrative. The single conceptual
   change in this session was the V8 `CallSite` shim in
   [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp).
2. [`release-notes/v0.97.md`](release-notes/v0.97.md) — what shipped.
3. [`build-logs/`](build-logs/) — per-host build + smoke output for
   the triad.

## Context in one paragraph

`require('express')` now works end-to-end on real PowerPC. A live
server boots, listens, serves JSON, closes. The headline demo
`demos/express-chat-npm/` ships, ready to be installed via
`npm install` directly on a Tiger box. The runtime can now host
the npm ecosystem in earnest, modulo the remaining ES2018+ syntax
gaps that Babel-on-parse-error handles for us.

## Punch list — pass 12

### A. End-to-end demo run on G3

We've smoke-tested `require('express') + listen + GET /health` but
we have **not** actually done a full `npm install` of
`demos/express-chat-npm/`'s `package.json` and then run `server.js`
through `client.js`. Do that. Concretely on `ibookg37`:

    ssh ibookg37
    cd /Users/macuser/tmp
    rm -rf express-chat-npm-test
    cp -r /opt/ionpower-node-0.97/share/ionpower-node/demos/express-chat-npm \
          express-chat-npm-test
    cd express-chat-npm-test
    /opt/ionpower-node-0.97/bin/node \
        /opt/ionpower-node-0.97/share/ionpower-node/test/vendor/nm/node_modules/npm/cli.js \
        install
    /opt/ionpower-node-0.97/bin/node server.js 8080 &
    sleep 5
    /opt/ionpower-node-0.97/bin/node client.js http://127.0.0.1:8080

Expected: all 7 client smoke checks pass. If anything fails, dig in
— this is the first time the demo's been driven end-to-end. Common
likely gaps:

- `handlebars@4.7.8` from npm may use ES2018+ that lowering by Babel
  handles partially. The `package.json` view loop in `views/index.hbs`
  is simple Handlebars — if compilation chokes, suspect the Babel
  pass on a vendor dep, not the template.
- `ws@7.5.10` may try to access bindings not in v0.97. We already
  ship a working `ws` in the vendor tree (used by
  `demos/express-chat/`) — if the npm copy diverges, port the
  differences over.

Once the full client smoke passes, consider:
- Capturing the client.js output as
  `build-logs/express-chat-npm-smoke.log`.
- Updating
  [`README.md`](../../../README.md) to mention the npm install path
  alongside the vendored one.

### B. express@5 end-to-end

Pass 11's TL;DR notes that Babel-on-parse-error should already lower
express@5's object spread, but we never drove the full path. The
v0.95 G3 still has `/Users/macuser/tmp/express5-discovery/` or you
can `npm install express@5` fresh; then write a tiny script that
does `require('express'); var app = express(); ...`. Anything that
trips will be A-class follow-up work.

Hypotheses for what'll surface:

1. The `__try_babel_transpile__` IE-11 preset might not lower
   *every* ES2018 construct express@5 uses (e.g. private class
   fields). Look at what the parse-error line reports.
2. express@5 dropped `depd` for `unpipe` and other deps that have
   their own structured-frame consumers — the CallSite shim should
   handle them but watch for `getThis()`/`getMethodName()` consumers
   that get `null`/`undefined` when they expected a real value.

### C. `fs.promises.read` / `write` return shape (parked since v0.92)

Real Node returns `{ bytesRead, buffer }` and `{ bytesWritten, buffer }`.
We currently return `bytesRead` / `bytesWritten` directly. Trivial
fix in
[`src/node_compat/fs.cpp`](../../../src/node_compat/fs.cpp);
needs a smoke covering both shapes and a destructure check.

### D. `process.binding('uv')` errname stub

`execa/lib/errname: unable to establish process.binding('uv') {}`
prints once at the end of every `npm install`. Cosmetic but
distracting. Add a `process.binding('uv')` stub that returns
`{ errname: (code) => 'UV_' + Math.abs(code) }` or, better, an
actual errno → name table cribbed from libuv. The function is the
critical bit — `execa` calls `binding.errname(-2)` style.

### E. Prototype-mutation warning at express startup

`node_modules/express/lib/router/index.js:51` does
`proto.__proto__ = Function;` which makes SM emit the slow-prototype
warning. Cosmetic. If we wanted to suppress it for the user-facing
output, the most surgical thing would be to intercept the warning
emission in our error reporter for that specific message.

## Working order

1. Read `notes.md` + `release-notes/v0.97.md`.
2. **A first** — drive the demo end-to-end. This is the cleanest
   validation that v0.97 actually works for users, not just for the
   pass-11 test rig.
3. **B** — express@5 attempt; just see what breaks.
4. **C + D** — small carryovers; either fits in a v0.98 micro-release.
5. **E** if you've got cycles left.

## ibookg37 note

Up the entire pass-11 session. Default to `/Users/macuser/tmp/` for
scratch. The mSATA swap remains pending but the host is stable
enough that you don't need to baby it.

## Test/repro scratch on G3

Still in place at `/Users/macuser/tmp/`:

- `express-discovery/node_modules/` — `express@4.22.2` install
  closure (~68 packages, ~25MB).
- `express-discovery/repro-require-express.js`,
  `express-discovery/server-test.js` — the working v0.97 reproducers
  (express loads, app listens, JSON round-trips, server closes).
- `repro-mfh.js`, `repro-passthrough.js`, `repro-capture.js`,
  `tinflate-stress.js` — pass-10 carryover, useful if a future
  zlib/gunzip path needs probing.

Don't blow these away if you can avoid it — they save a 3-5 min
install per iteration.
