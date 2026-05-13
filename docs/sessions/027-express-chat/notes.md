# Session 2026-04-29-2: express-chat demo

**Goal**: Build `demos/express-chat/` — anonymous chat board using real Express.js running on ibookg37 (iBook G3 900 MHz, Tiger 10.4.11).

**Started**: 2026-04-29
**Outcome**: Fully working — all 7 smoke checks pass on ibookg37.

---

## Phase 1: Vendor inventory

### What was already in `test/vendor/`:

Single-file bundles already present: `accepts.js`, `content-disposition.js`,
`content-type.js`, `encodeurl.js`, `escape-html.js`, `etag.js`,
`finalhandler.js`, `fresh.js`, `merge-descriptors.js`, `methods.js`,
`mime-types.js`, `on-finished.js`, `parseurl.js`, `path-to-regexp.js`,
`qs.js`, `range-parser.js`, `safe-buffer.js`, `safer-buffer.js`,
`statuses.js`, `type-is.js`, `utils-merge.js`, `vary.js`, `cookie.js`,
`cookie-signature.js`, `bytes.js`, `destroy.js`, `unpipe.js`,
`toidentifier.js`, `forwarded.js`, `ipaddr.js`, `negotiator.js`,
`handlebars.js`, `ms.js`, `qs-v6.js`.

### What had to be npm-packed fresh:

Express itself (4.22.1), `body-parser@1.20.5`, `depd@2.0.0`,
`http-errors@2.0.1`, `raw-body@2.5.3`, `iconv-lite@0.4.24`,
`inherits@2.0.4`, `proxy-addr@2.0.7`, `send@0.19.2`,
`serve-static@1.16.3`, `debug@2.6.9`, `ms@2.0.0` (for debug),
`ms@2.1.3` (for send), `mime@1.6.0`, `array-flatten@1.1.1`,
`path-to-regexp@0.1.12` (the vendored one was v6 — wrong API),
`accepts@1.3.8`, `negotiator@0.6.4`, `mime-types@2.1.35`,
`mime-db@1.54.0`, `type-is@1.6.18`, `media-typer@0.3.0`,
`content-disposition@0.5.4` (proper npm package with `package.json`),
`side-channel@1.1.0` (needed by `qs`).

### Vendor structure

All deps live at `test/vendor/express/node_modules/<dep>/`.

Two categories of entries:
1. **Proper npm packages** — extracted directly from `npm pack`. Used for
   deps that have sub-deps or relative `./lib/` requires (express, body-parser,
   depd, http-errors, raw-body, iconv-lite, send, serve-static, accepts,
   negotiator, mime-types, mime-db, type-is, media-typer, content-disposition,
   debug, ms, proxy-addr, etc.).

2. **Proxy wrappers** — a thin `index.js` that does
   `module.exports = require(__dirname + '/../../../<dep>.js')` plus a minimal
   `package.json`. Used for single-file vendors (encodeurl, escape-html, etag,
   finalhandler, fresh, methods, mime-types, on-finished, parseurl, qs, etc.)
   where the single-file vendor lives at `test/vendor/<dep>.js` and all their
   internal requires are relative paths that resolve correctly against
   `test/vendor/`.

**Why proxies?** The single-file vendors were designed to be `require()`d
directly (relative path from test/). When loaded via the proxy, their
`__dirname` is still `test/vendor/` so all their `./foo.js` requires work.
Only bare specifiers (like `accepts.js`'s `require('negotiator')`) broke
the proxy model — those were replaced by proper npm packages.

### Gotcha: path-to-regexp version

`test/vendor/path-to-regexp.js` is v6.x (exports `{ pathToRegexp, ... }`).
Express 4 needs v0.1.x (exports the function directly as `module.exports`).
Had to pack `path-to-regexp@0.1.12` and install as a proper npm package
in `express/node_modules/path-to-regexp/`.

### Gotcha: qs version

`test/vendor/qs.js` has relative `./stringify`, `./parse`, etc. that don't
exist as sibling files. Used `test/vendor/qs-v6.js` instead (browserify
bundle, self-contained). The proxy for `qs` in `express/node_modules/qs/`
re-exports `qs-v6.js`.

---

## Phase 2: App structure

Files written:
- `demos/express-chat/server.js` — Express app + ws server on PORT+1
- `demos/express-chat/views/index.hbs` — Handlebars template
- `demos/express-chat/static/style.css` — dark theme matching demos/chat/
- `demos/express-chat/static/client.js` — browser WS + fetch posting

Used `path.join(__dirname, '../../test/vendor/express')` for the require
path (not `./test/vendor/express`) because our require() resolves relative
to `__dirname`, not cwd. Learned this from the first failed startup on ibookg37.

---

## Phase 3: Debug on ibookg37

### Issue 1: depd uses V8 structured stack trace API

First error on ibookg37:
```
test/vendor/express/node_modules/depd/index.js:268: TypeError: callSite.getFileName is not a function
```

`depd` calls `Error.prepareStackTrace` and uses V8's callSite objects
(`.getFileName()`, `.getLineNumber()`, etc.). SpiderMonkey 45 doesn't
implement this V8 API extension.

**Fix**: Replaced `depd/index.js` with a minimal shim that returns a
no-op deprecation function. Deprecation warnings are silenced (which is
fine for a demo). The function signature matches exactly what Express/body-parser
expect (`depd(namespace)` returns a callable that also has `.function`,
`.property` methods).

**Judgment call**: The plan says "never modify Express's source." `depd`
is a dependency, not Express itself. The shim lives in
`express/node_modules/depd/` and is the minimal correct fix. The alternative
would be adding V8 stack trace API support to the runtime (a C++ change),
which is explicitly disallowed.

### Issue 2: setprototypeof SpiderMonkey warning

Startup prints:
```
setprototypeof/index.js:3: mutating the [[Prototype]] of an object will cause
your code to run very slowly; instead create the object with the correct
initial [[Prototype]] value using Object.create
```

This is a **harmless** SpiderMonkey performance advisory, not an error. The
`setprototypeof` stub using `obj.__proto__ = proto` works correctly. Express
uses this to set up the req/res prototype chain. The G3 is slow enough that
the SM45 warning fires, but it doesn't break anything.

---

## Phase 4: Smoke test

Client smoke (`client.js`) adds 2100ms delays between tests to avoid hitting
the rate limiter on legitimate test posts. The timing dance is:
1. POST hello board (no prior posts, passes)
2. GET posts (no rate limit on GET)
3. sleep 2100ms — let rate limiter reset
4. POST with tripcode "secret" (passes)
5. sleep 2100ms
6. POST same tripcode (passes — same trip-hash K7gNU3sdo+)
7. POST too fast (429 — within 2s of step 6)
8. GET ?since=N (no rate limit)
9. sleep 2100ms
10. POST empty text (400 — not rate limited now)

All 7 checks pass on ibookg37 in ~10 seconds (mostly sleeping for rate limiter).

---

## Phase 5: README + commit

README.md includes validated transcript from ibookg37, architecture table,
vendoring notes, and known limitations (WS on PORT+1).

---

## Runtime gaps encountered

1. **V8 structured stack trace API** (`callSite.getFileName()`) — missing in SM45.
   Fixed via `depd` shim (no-op deprecation). Not a runtime C++ fix.
2. **`setprototypeof` `__proto__` mutation** — SM45 warns but works.
   No action needed.

No `src/node_compat/` changes were needed.

## Files created/modified

- `demos/express-chat/server.js` (new)
- `demos/express-chat/views/index.hbs` (new)
- `demos/express-chat/static/style.css` (new)
- `demos/express-chat/static/client.js` (new)
- `demos/express-chat/client.js` (new)
- `demos/express-chat/README.md` (new)
- `test/vendor/express/` (new directory tree — Express + all deps)
- `docs/sessions/027-express-chat/notes.md` (this file)
