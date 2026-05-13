# Session F summary (2026-04-23)

Follows session E (see `docs/session-2026-04-23-e-summary.md`).
Session E ended with v0.3 shipped at 313 libraries and 926
assertions on G5.

This session focused on **expanding the Node interface** to unlock
libraries blocked by missing compat — then sweeping up the libraries
the new shims could reach. Shipped v0.4 at 340 libraries; ended the
session at **364 libraries / 1041 assertions**.

## What shipped

### Runtime shims

| Addition | Rationale |
|---|---|
| WHATWG `URL` + `URLSearchParams` polyfill (~250 lines of JS) | Unlocks normalize-url, file-url, our own composition demos. Covers protocol/host/hostname/port/pathname/search/hash/origin/href + username/password + URLSearchParams get/getAll/has/set/append/delete/keys/values/entries/forEach/sort/toString. Not spec-complete but handles the 95%. |
| `util.promisify` + `.custom` symbol | Under our sync Promise polyfill, promisify(fn) returns immediately-settled promises for callback-style fn. Pairs with util.callbackify. |
| `util.types.*` + 13 legacy `util.isXxx` aliases | Libraries that predate TypeScript still pull `util.isString`, `util.isArray` etc. Node deprecated these but they're everywhere. |
| `supports-color` and `has-ansi` seeded as fake modules | `supports-color` reflects process.stdout.isTTY + TERM env. `has-ansi` is a 1-line regex predicate. Together they unlock chalk 1.x. |
| `safe-buffer` shim | Our Buffer already has alloc/allocUnsafe/from — the real safe-buffer just polyfills those for older Node. Re-export our built-in. |
| `Error.captureStackTrace` | V8-specific static. Error-ex and json-parse-even-better-errors require `.stack` as an own property (not prototype). Shim attaches it explicitly. |
| `global` alias alongside `window` / `self` | xmldoc and Node-ish UMD bundles test `typeof global !== 'undefined'`. |
| `process.hrtime()` / `.bigint` / `uptime` / `title` / `versions` / `release` / `memoryUsage` | Feature-gates and logging frameworks consult these heavily. `versions.node = '14.0.0'` lies slightly — we want libraries to pick their modern branches, which SM45 can handle. |
| `Uint8Array.isBuffer` hack | is-buffer legacy lib calls `obj.constructor.isBuffer(obj)`. Since our Buffer instances inherit Uint8Array's prototype, their constructor is Uint8Array — so we stamp isBuffer onto Uint8Array too. |
| MD5 added to `crypto.createHash` | Full RFC 1321 reference implementation inline. Now `createHash` accepts 'md5' + 'sha256' (+ 'SHA256' / 'sha-256' case variants). Verified against RFC 1321 test vectors. |

### Require resolver

The biggest single unlock of the session was the **vendor-path
fallback** in `__make_require__`:

When a bare specifier like `require('ansi-styles')` can't resolve
through the standard Node node_modules walk, the resolver now also
walks the caller's directory up to root, checking each level for
`<ancestor>/<spec>.js` or `<ancestor>/vendor/<spec>.js`. Plus a
global fallback to `cwd/test/vendor` and
`<exeDir>/../share/ionpower-node/vendor`.

This means any library vendored in the tree with bare requires
Just Works without patching. **Chalk 1.x** — which bare-requires
escape-string-regexp, ansi-styles, strip-ansi, has-ansi,
supports-color — loaded unchanged, emits real ANSI codes, and the
rest of the chalk ecosystem (boxen, log-symbols, etc) fell in
behind it.

### Build

- `Makefile` now passes `-isysroot /Developer/SDKs/MacOSX10.4u.sdk`
  to compile + link. Fixes builds on hosts with an incomplete
  `/usr/include/sys/` (G5 imacg52 was missing `sys/_types.h` this
  session — cause unknown, but pinning the SDK is the right long-
  term answer anyway). Configurable via `MACOSX_SDK`.

### Libraries: **313 → 364** (+51 this session)

Batches, roughly in order of execution:

| batch | +count | libraries |
|-------|-----|-----------|
| 13 (shim verification) | +3 | chalk, normalize-url, file-url |
| 14 (chalk ecosystem) | +4 | boxen, log-symbols, is-unicode-supported, strip-final-newline |
| 15 (spinners + paths + .mjs) | +7 | cli-spinners, env-paths, just-clone / safe-get / safe-set, iota-array, inline-style-parser |
| 16 (v0.4-ish mix) | +6 | rgbcolor, parse-duration, fast-safe-stringify, minipass, eastasianwidth, content-disposition (uses our safe-buffer shim) |
| 17 (after v0.4 tag) | +2 | dequal/lite, rrule |
| 18 | +5 | camelize, dashify, markdown-escape, is-json, iso8601-duration |
| 19 | +3 | string-template, readline-sync, escape-goat-CJS |
| 20 | +4 | url-template, make-error, prr, mnemonist/set |
| 21 | +7 | throttleit, lodash.throttle, lodash.debounce, valid-url, property-expr, filename-reserved-regex, toidentifier |
| 22 | +8 | is-buffer, to-buffer, list-to-array, once, wrappy, strict-uri-encode, decode-uri-component, isarray |
| 23 | +4 | pad-left, pad-right, mixin-deep, is-negative-zero |
| MD5 | +1 | md5-hex |

### Demos

- **`demos/url-dashboard/`**: composition demo using the URL polyfill
  + chalk + sort-keys + string-width + strip-ansi + text-table +
  hash-sum + pretty-ms. Parses a list of URLs, buckets by host,
  renders a colorized aligned table with a custom rounded-corner
  ASCII frame. (Uses its own frame drawer rather than `boxen`
  because boxen's wrap-ansi code path for colored input hits ES2018
  named capture groups SM45 can't parse.)

### Docs

- **README**: new "Node API implementation status" section with
  tables for core modules / globals / CommonJS / seeded packages.
  Maintained as runtime grows; lets contributors pick which gap to
  fill next without spelunking through `src/node_compat/globals.cpp`.
  Library count line stays current per release.
- Session F summary (this doc).

### Release

**v0.3** (300 libs) was tagged last session's end.
**v0.4** (340 libs) cut this session, triad-validated at 1005 ok
/ 0 FAIL across G3/G4/G5, with tarballs and release notes.

Current tip (post-v0.4): 364 libs / 1041 ok on G5.

## Judgment calls

### The vendor-path resolver

The big decision of the session. Classic Node resolution walks
`node_modules` from the caller's dir up to `/`. Tiger doesn't have
`npm install`, so we don't maintain `node_modules` trees. The flat
`test/vendor/*.js` layout was fine as long as each smoke
hand-patched its test library's bare requires (`require('chalk')`
→ `require('./vendor/chalk.js')`).

That got tedious fast. Once chalk + ecosystem rolled in, every
library needed to touch multiple peers.

The fallback in `__make_require__` adds a second path to the
resolver: walk the caller's dir up looking for
`<ancestor>/<spec>.js` or `<ancestor>/vendor/<spec>.js`. For a
chalk.js at `test/vendor/chalk.js`, its bare `require('ansi-styles')`
finds `test/vendor/ansi-styles.js` on the first level.

This is **not** spec-compliant Node behavior, but it's a natural
extension: the fallback only fires if the standard walk failed.
Libraries designed to run under Node still resolve the same way;
only ones that would have thrown a "cannot find module" now get a
second chance.

### Promise.resolve() under sync Promise polyfill

Under the sync Promise polyfill, `setTimeout(fn, N)` fires
immediately. That's usually fine — libraries check "did the
callback fire" — but some designs recursively reschedule (lodash
debounce schedules a trailing-edge timer, which fires, which
reschedules...). Those libraries *load* but invoking them would
loop forever.

Chose to document this in the smoke tests rather than fix the
runtime: throttleit / lodash.throttle / lodash.debounce verify
load shape only. Promise-awaiting code under the sync polyfill
works for the common case of "await something that resolves once",
but isn't a substitute for a real event loop.

### Boxen vs. our own frame drawer in the demo

Boxen works on plain text. On colored text (chalked table), it
hands each line to wrap-ansi's ANSI-aware path, whose regex uses
ES2018 named capture groups (`(?<code>\d+)`) that SM45 can't
parse. The failure happens at regex-construction time, not
compilation, so babel can't help.

Rather than patch wrap-ansi to use numbered groups, the demo
draws a 12-line rounded-corner frame itself. Noted as a known
limitation in the README.

### Dropped libraries

Common reasons this session:
- **Multi-file `require('./lib/*')`**: toml, boxen-nameless deps,
  mem's map-age-cleaner, most @elastic/@maplibre/@paralleldrive/
  scoped packages, parse5 (parser/* + tree-adapters/*), cron-
  parser, braces/micromatch/picomatch.
- **Deep deps via node_modules conventions**: meow's minimist-
  options, clone-deep's shallow-clone, raw-body's http-errors +
  iconv-lite.
- **Requires native core modules we don't stub**: jsonpath-plus
  (vm), fast-xml-parser variants (xmlbuilder/libxmljs).
- **ES2020+ regex syntax**: most modern obfuscator / formatter
  bundles, wrap-ansi's ANSI path.
- **V8-specific APIs**: callsites / parent-module (need
  `Error.prepareStackTrace`).
- **Needs Intl**: luxon.
- **unpkg 404s** on the specific version I tried: many small
  utilities; usually one or two versions back works.

About 30 libraries got fetched-tried-dropped across the session.
Each cost ~2 min of triage + tree-walking and taught us nothing
new; worth capturing a better pattern for this in future sessions.

## Not done

- **Streams**: still a pass-through stub. tape still parked.
  A real Readable/Writable with .pipe() backpressure would unlock
  `tape` + ~20 more libraries but is a multi-hour investment
  (bigger than any single shim above).
- **Intl**: blocked until we rebuild SpiderMonkey 45 with ICU, or
  write a much larger polyfill.
- **Async fs**: `fs.readFile(path, cb)` etc. Easy to build with
  our sync backend + immediate callback, but haven't yet.
- **fetch / AbortController / AbortSignal**: would need some kind
  of event loop to be meaningful. Not a quick win.
- **`http`/`https` beyond sync-GET**: needs sockets + event loop.
- **v0.5 release**: we shipped v0.4 mid-session; post-v0.4 deltas
  would warrant v0.5 in a future wrap.

## Hand-off state

* 364 libraries, 1041 ok / 0 FAIL on G5.
* v0.4 is the current tagged release.
* README table tracks every status flag; use it as the contributor-
  facing index.
* Delta since v0.4: +24 libs + MD5 + crypto.createHash('md5') + one
  demo + one session doc + the README table refresh. Enough to tag
  v0.5 in the next wrap if another compat shim lands.
* G3 / G4 have NOT been re-validated for the post-v0.4 deltas yet.
  Still 1005 ok / 0 FAIL as of v0.4.
