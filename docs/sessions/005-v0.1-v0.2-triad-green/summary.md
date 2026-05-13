# Session D summary (2026-04-23)

This session picked up after v0.1 shipped and the triad (G3 / G4 / G5)
went green. The goal: keep pushing library coverage toward 300, harden
the Node-compat layer for the libs we were about to add, and cut v0.2.

## What shipped

### Runtime

* **`process.umask`**: returns the Node default `0o022` so anything
  deriving a mode from `_0777 & ~process.umask()` no longer trips a
  `TypeError`. Needed for `mkdirp-classic` and any library that
  computes its own default file mode.
* **`global` alias**: alongside the existing `window` / `self`
  aliases in the bootstrap, `global` now resolves to `globalThis`.
  `xmldoc` branches on `typeof module !== 'undefined' && !global.xmldocAssumeBrowser`
  and most Node-ish UMD bundles do similar tests before picking a
  target — without the alias they ReferenceError'd at load time.
* **`fs` errors carry Node-compatible `.code` / `.errno` /
  `.syscall` / `.path`**: a new `ThrowFsError` helper in
  `src/node_compat/fs.cpp` constructs a real `Error` object via
  the JS-side `Error` constructor and attaches Node-style props.
  `JS_ReportError` leaves `.code` undefined, so the many libraries
  that branch on `err.code === 'ENOENT'` / `'EEXIST'` silently
  failed their recovery paths. Wired through `mkdirSync`,
  `statSync`, `unlinkSync`, `rmdirSync`, and `readFileSync`.

### Libraries

Three batches landed this session, each with a fresh smoke and each
validated on all three CPUs before the next one started:

| batch | count | highlights |
|-------|-------|------------|
| 1     | +3    | js-levenshtein, map-obj, mkdirp-classic |
| 2     | +10   | ansi-regex, strip-ansi, ansi-styles, is-glob, is-extglob, slash, shell-quote, normalize-path, sort-keys, hash-sum |
| 3     | +8    | string-width, is-fullwidth-code-point, strip-indent, redent, min-indent, pretty-ms, pupa, linkifyjs |
| 4     | +6    | camelcase-keys, decamelize-keys, quick-lru, xmldoc, is-email, color-hash |
| 5     | +3    | Case, twig, p-limit |

Total new libraries this session: **30**. Running total: **268**.
Full suite: **842 ok / 0 FAIL** on each of G3, G4, and G5.

### Composition demo

`demos/feed-report/report.js` — an offline RSS-to-colorized-text CLI
that chains six libraries (xmldoc, ansi-styles, strip-ansi,
string-width, color-hash, pretty-ms) end-to-end. Bundled
`sample.xml` means you can run the demo on any Tiger host with the
release tarball extracted, no network required.

## Judgment calls

### Libraries dropped

Each library I opened stood for about 30 seconds of "can I wire this
up without dragging in 4 more deps?" If the answer wasn't clear, I
dropped it and moved on. Deferred:

* `JavaScriptObfuscator`: 1.4 MB ES2020 webpack bundle; even after
  Babel lowering SM45 couldn't parse the output.
* `yaml`: multi-file ESM; each of the four imports would need its
  own sibling file shimmed.
* `date-fns`: every function is its own `./add/index.js` ESM; no
  aggregated bundle worth its size.
* `query-string`: 4-deep dep chain (strict-uri-encode, decode-uri-
  component, split-on-first, filter-obj). Reaches our built-in
  ceiling for "worth wiring up".
* `debug`: splits into browser.js / node.js sibling files at runtime
  and requires a terminal-color env detector we don't quite have.
* `validator`: 15+ sub-file requires.
* `form-data`: http/https/combined-stream.
* `p-queue`, `deepdash`, `parse-path`, `snakecase-keys`, `mem`,
  `fast-levenshtein`: each missing at least one non-trivial dep.

These are worth revisiting once we either get multi-file require
resolution smoother or pull in the missing core modules.

### parse-ms ESM → CJS

`parse-ms` vendored as ESM (`export default function`). Our Babel
pipeline handles ESM, but the result is `module.exports.default = fn`,
which breaks consumers that do `const parseMs = require('parse-ms')`
and treat the export as the function. For parse-ms specifically we
just rewrote it to `module.exports = function ...` — cheaper than
asking pretty-ms to learn the `.default` unwrap. General pattern:
for tiny ESM libraries that have exactly one consumer in our set,
convert them to CJS; for larger ones (yocto-queue), patch the one
consumer (`p-limit`) to do the unwrap.

### mkdirp-classic and friends

mkdirp-classic's sync recovery path is *built* on `err.code ===
'ENOENT'`. Without that, it tries to fall through to `statSync` on
a missing parent, which also throws, and the whole thing surfaces
the original error instead of quietly creating the parent chain. The
`ThrowFsError` helper was the smallest fix that also helps the
other 15-ish libraries that branch on `err.code`. Upside: we now
have a template for adding more Node-style error codes as more
libraries surface the need.

### linkifyjs's IIFE export

linkifyjs ships a browser bundle that leaks its result as a top-level
`var linkify = ...`. In a script wrapped by our require, that binding
stays inside the IIFE and never hits `module.exports`. Appending
`;module.exports=linkify;` to the vendored file is a one-line patch
and keeps the upstream source otherwise pristine.

## Not done

* Library count to 300: we reached 268, not 300. The remaining 32
  are achievable but each one takes roughly 5 minutes of triage +
  smoke-writing + retest. Worth another session on its own.
* tape: parked last session, still parked. Needs a real Writable
  stream implementation; our `through2` / `process.stdout` pipe
  machinery doesn't feed it a `.pipe()` that tape's internal
  reporter accepts.
* Test-all wallclock: 842 assertions on G3 takes ~12 minutes. We
  should split the suite into fast/slow tiers so quick iteration
  stays fast on the slow host.

## Hand-off state

* Clean working tree, 9 commits since v0.1.
* Triad build verified: G3 / G4 / G5 each reporting 842 ok / 0 FAIL.
* Next step from here: v0.2 tarball + GitHub release, then resume
  library push in a new session.
