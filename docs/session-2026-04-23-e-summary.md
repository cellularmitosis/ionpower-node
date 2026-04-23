# Session E summary (2026-04-23)

Directly follows session D (see `docs/session-2026-04-23-d-summary.md`).
Session D ended with v0.2 shipped at 268 libraries. Session E pushed
past 300, shipped v0.3, and kept adding libraries into the 310s.

## What shipped

### Runtime

* **`Error.captureStackTrace` shim**: V8-specific static that
  error-ex and json-parse-even-better-errors call inside their
  custom Error subclass constructors. The shim builds a best-effort
  `.stack` string via `new Error().stack` and attaches it as an
  **own** data property (not a prototype getter), which matches V8's
  behavior. error-ex specifically calls
  `Object.getOwnPropertyDescriptor(this, 'stack')` and throws if the
  descriptor is undefined — so "own property" was the key detail.

### Libraries: **268 → 313** (+45 this session)

Grouped by batch:

| batch | count | highlights |
|-------|-------|------------|
| 1     | +2    | acorn-walk, bn.js |
| 2     | +8    | is-arrayish, ansi-align, cli-columns, micro-memoize, json-parse-even-better-errors, error-ex, astring, escape-string-regexp |
| 3     | +6    | p-try, delay, yargs-parser, is-absolute-url, remove-accents, widest-line |
| 4     | +6    | kind-of, type-detect, has-values, onetime, isobject, pinkie |
| 5     | +10   | array-unique, stable, lazy, indexof, split-lines, sentence-case, no-case, upper-case-first, escape-latex, bresenham-zingl, fuse.js, wrap-ansi (**crossed 300**) |
| 6     | +5    | aproba, deep-freeze, number-is-integer, is-finite, lodash.defaults, hooker |
| 7     | +4    | dot-prop, get-value, set-value, tiny-queue, linked-list |
| 8     | +4    | mime-types, Mime, text-table, utils-merge, uniqid |

Full suite: **926 ok / 0 FAIL** on G5 at session close (up from 842
at session start).

### Releases

* **v0.3** tagged + tarballed at 300 libraries. Released on GitHub
  with triad (G3/G4/G5) tarballs and the Error.captureStackTrace
  shim included.

## Judgment calls

### ESM-default compatibility decisions

When an ESM `export default X` gets CJS-consumed as
`require('…')`, babel produces `module.exports.default = X` — which
breaks consumers that treat the export as the function. Three ways
handled this:

1. **Convert the vendor file to CJS** (isobject, parse-ms).
   Cheap when the library is a one-liner and the upstream isn't
   coming back.
2. **Patch the one consumer** (p-limit / yocto-queue via
   `const Queue = QueueMod.default || QueueMod`). Works when the
   vendor file is canonical and lots of non-require consumers also
   exist in the smoke set.
3. **Drop the library** when the consumer-side pattern is deep and
   the library isn't worth the fix. (normalize-url, html-to-text,
   etc.)

No single rule here — the right call depends on how many consumers
touch the ESM'd export, and whether the library file came directly
from unpkg as canonical source.

### Dropped libraries (this session's triage)

Common drop reasons:
- **Multi-file ESM/CJS with sibling requires** (yaml, date-fns,
  deepdash, ml-distance, toml, html-to-text, cron-parser, negotiator,
  accepts, stream-transform)
- **Needs `Intl` global** (luxon) — SM45 built `--without-intl-api`
- **Needs WHATWG URL constructor** (normalize-url) — not polyfilled
- **Needs `Error.prepareStackTrace`** (callsites, parent-module) —
  V8-specific, not in SpiderMonkey
- **ES2018+ syntax the parser can't eat** (JavaScriptObfuscator
  webpack output, wrap-ansi's named-capture regex path)
- **Deep deps we don't want** (boxen → chalk; meow →
  minimist-options; clone-deep → shallow-clone; etc.)

### Things to test that I haven't

- Library **composition** beyond feed-report — something that
  chains 10+ libraries in one CLI would be a better capstone.
- **Performance** on G3 — 12 minutes for the full test-all is
  slow and the test list keeps growing. Worth a fast/slow split.
- **Triad validation** for library batches 6–8 only went through
  G5. G3/G4 were last validated at batch-5 for v0.3.

## Hand-off state

* 313 libraries in vendor tree; 926 ok / 0 FAIL on G5.
* v0.3 is the current tagged release (300 libs).
* Delta of 13 libs + no new compat shims since v0.3 — not cutting
  v0.4 this session. Accumulate a few more batches and the next
  compat fix, then re-cut.
* Outstanding: tape still parked (needs Writable stream), triad
  re-validation for recent batches, and the 4 libraries we have
  vendored-but-unsmoked (lazy, bresenham-zingl, dotenv@16, rc,
  joi-full, stream-shift, normalize-url).
