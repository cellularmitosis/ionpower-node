# Session notes — 2026-04-29 session 1

Initial conformance sweep against two upstream test corpora:

1. **Web Platform Tests (WPT)** — `web-platform-tests/wpt`. WHATWG-spec
   tests for `URL`, `URLSearchParams`, `fetch`, `Streams`, `WebCrypto`,
   `TextEncoder/Decoder`, `Headers`, etc.
2. **Node.js parallel tests** — `nodejs/node` `test/parallel/`. Node's
   own per-module tests for `buffer`, `path`, `querystring`, `url`,
   `events`, `stream`, `crypto`, `zlib`, `fs`, `string-decoder`,
   `assert`.

User context (from previous session): "let's do an initial sweep of
both WPT and node.js's and see where we are at. document everything."

## Approach

### Corpora

Sparse-checked-out into `external/` (~300 MB total, sized for the
tests we'd actually run against this runtime, not the whole world):

- `external/wpt/{url,urlpattern,streams,WebCryptoAPI,encoding,fetch/api,resources}/`
  (180 MB)
- `external/node-tests/test/{common,fixtures,parallel}/test-{buffer,path,
  querystring,url,events,stream,crypto,zlib,fs,string-decoder,assert}-*`
  (124 MB)

These won't be committed to the runtime repo — they're upstream code
we're measuring against. (TODO: add to `.gitignore`.)

### Harness for WPT

Wrote `scripts/conformance/wpt-harness.js` (~360 LOC). Implements the
subset of WPT's testharness.js that url/, streams/, encoding/, and
WebCryptoAPI/ tests actually use:

- `test(fn, name)`, `promise_test(fn, name)`, `async_test(fn, name)`
- `assert_true`, `assert_equals`, `assert_array_equals`,
  `assert_object_equals`, `assert_throws_js`, `assert_throws_dom`,
  `assert_throws_exactly`, `assert_unreached`, `assert_in_array`,
  `assert_approx_equals`, `assert_class_string`,
  `assert_implements`, `assert_implements_optional`,
  `assert_regexp_match`
- `format_value`, `subsetTestByKey`, `shouldRunSubTest`
- 5-second timeout per `promise_test`/`async_test`
- Outputs JSONL: one line per test result, plus a `summary` line per
  file with pass/fail/skip/total/timeMs.
- META: pulls in `script=...` directives so tests with prelude deps
  (e.g. `subset-tests-by-key.js`) load.

### Harness for Node parallel tests

Wrote `scripts/conformance/node-common-shim.js` (~150 LOC) — a minimal
`test/common/index.js` replacing the upstream 1000+ LOC version that
depends on Node-internal APIs we don't have (`process.config`,
`util.getCallSites`, `worker_threads.MessageChannel`). Implements the
subset most parallel tests touch:

- `mustCall(fn, n)`, `mustCallAtLeast`, `mustNotCall`, `mustSucceed`
- `skip(reason)` (emits TAP `1..0 # SKIP` and exits 0)
- `expectsError(opts)`, `invalidArgTypeHelper(input)`
- Platform constants (`isOSX`, `isWindows`, `localhostIPv4`, ...)
- `platformTimeout(ms)` → `ms * 8` (G3 slow-CI factor)
- `getArrayBufferViews()`
- `hasIntl`/`hasFullICU`/`hasOpenSSL` etc. all set to false where
  appropriate.

Wrote `scripts/conformance/run-node-tests.js` to:
1. Save `external/node-tests/test/common/index.js` aside as `.orig`
2. Copy our shim over it
3. Spawn `./node test/parallel/test-<topic>-*.js` for each, capture
   exit code + stderr
4. Classify: TAP `1..0` → skip; exit 0 → pass; non-zero → fail; 30s
   timeout → fail with "30s timeout"
5. Restore original on completion

## Gotcha #1: SM45's parser rejects `async function`

The first version of the WPT harness loaded test sources via
`(0, eval)(combinedSrc)`. SM45 rejects `async function` tokens
("async functions are not enabled in the parser"), so 13/36 encoding
tests + 98/103 WebCryptoAPI tests + 38/73 streams tests failed at
load time.

**Fix:** in `wpt-harness.js`, on `SyntaxError`, write the source to a
unique-per-call temp file in `os.tmpdir()` and `require(tmp)` it. The
require path goes through `__try_babel_transpile__` which Babel-lowers
async/let/const before SM45 sees it.

Initial version of the fallback used `delete require.cache[tmp]` to
let the same file be reloaded — but our runtime doesn't expose
`require.cache` (it's internal as `__require_cache__`). Replaced with
unique temp paths so the cache entry is never reused. Lesson: when
writing test glue, assume only the documented Node API surface.

## Gotcha #2: `fetch()`-based test data loading

A lot of WPT tests bootstrap by `await fetch('/url/resources/urltestdata.json')`
to load their data. Our `fetch()` works for `http://` / `https://` but
rejects file paths. Tests that depend on this are landing as
single-test-fail (the `await` throws "fetch: only http/https supported")
rather than meaningful pass/fail.

**Decision:** not pursuing a `file://` shim or fixture-server right
now — the test signal is "we don't yet have a fixture story for WPT,"
and that's an infrastructure gap, not a runtime gap. Documented in
findings.

## Gotcha #3: `BigUint64Array` not in SM45

`getRandomValues.any.js` exercises every typed-array view, including
`BigUint64Array` and `BigInt64Array`. SpiderMonkey 45 (2016) predates
BigInt by a year, so those constructors don't exist. Tests that
iterate the full set fail on the BigInt cases. Real runtime gap, not
a harness issue.

## Initial WPT numbers (first sweep, before Babel fallback)

```
TOTAL: 245 files, 218 pass, 1415 fail, 0 skip, 1633 total assertions, 188.9s

  streams         files=73 pass=52 fail=339 total=391 (13%)
  url             files=24 pass=46 fail=436 total=482 (10%)
  WebCryptoAPI    files=103 pass=23 fail=24 total=47 (49%)
  fetch/api       files=9   pass=0 fail=8 total=8 (0%)   [runner crashed in cp_spawn]
  encoding        files=36 pass=97 fail=608 total=705 (14%)
```

The 49% WebCryptoAPI rate looked great until I noticed only 47/103
files even loaded (the rest threw "async functions are not enabled").

## Re-sweep after Babel fallback (full numbers TBD)

Currently re-running with the Babel fallback in place. Rough expectation:
WebCryptoAPI passes a lot more (most files load now), encoding maybe
similar (the failures are real — UTF-16/Big5/GB18030/etc. that we don't
have), url similar (most "fails" are the fetch-data-file thing), streams
should improve a bit.

## Re-sweep results (with Babel fallback wired up)

```
TOTAL: 236 files, 560 pass, 8443 fail, 0 skip, 9003 total, 5338s

  category        files  errs   pass  total    pct
  streams            73     4    223   1147  19.4%
  url                24     1     46    482   9.5%
  WebCryptoAPI      103    42    175   6235   2.8%
  encoding           36     3    116   1139  10.2%
```

(`fetch/api` is excluded — the runner crashed in `cp_spawn` partway through
on the first sweep; haven't re-run.)

The 50 load errors that remain (down from 150) are mostly tests using
modern JS syntax beyond what our Babel pipeline lowers — see Gotcha #4.

## Failure-pattern analysis (after Babel fallback)

Bucketed `assert_*` failure messages by string template across the four
categories. Top patterns:

**WebCryptoAPI**: 175 / 6235 (2.8%)
- 1440 `Bad usages not supported` — our subtle accepts invalid
  key-usage combinations that should throw
- 1316 `Operation succeeded, but should not have` — same pattern; missing
  validation on key-type / key-usage / algorithm
- 868 `subtle.importKey: format` — missing key formats (`pkcs8`,
  `spki`, presumably others); we have `raw` and `jwk` only
- 586 `subtle.importKey jwk: missing k` — JWK validation: when given a
  non-JWK shape we throw the wrong error
- 244 `CryptoKey is not defined` — global is named `_CryptoKey` only;
  Node also exports it as `CryptoKey`
- 158 `buffer.buffer.transfer is not a function` — `ArrayBuffer.prototype.transfer` (ES2024) — SM45 too old
- 151 `SubtleCrypto is not defined` — global is missing
- 96 `subtle.generateKey: unsupported ML-KEM-N` — post-quantum, won't
  support
- 92 `subtle: unsupported hash` — Argon2 / KMAC variants

→ Realistic shippable wins: expose `CryptoKey` + `SubtleCrypto` globals
  (~395 tests), add pkcs8/spki key formats (~870 tests), tighten
  validation on key-usage / bad-key-length combinations (~2000+ tests).

**Streams**: 223 / 1147 (19.4%)
- 193 `promise_rejects_exactly is not defined` — harness gap
- 88 `timeout (5000 ms)` — async tests not completing
- 71 `flushAsyncEvents is not defined` — harness gap
- 70 `promise_rejects_js is not defined` — harness gap
- 50 `delay is not defined` — harness gap
- 34 `CountQueuingStrategy is not defined` — globalThis lookup; we
  expose under `stream/web` but not as a runtime global
- 31 `ReadableStream.from is not a function` — missing static method
- 16 `c.byobRequest is undefined` — BYOB streams not implemented
- 13 `garbageCollect is not defined` — V8 specific, not relevant

→ Adding the missing harness asserts (+ exposing CountQueuingStrategy as
  a runtime global) could land ~390 more passes — most of the
  streams gap is harness, not runtime.

**URL**: 46 / 482 (9.5%)
- 257 `assert_equals: property` — URL property values diverge
  (probably IDN / non-special schemes / exotic relative URLs)
- 35 `sp is not iterable` — URLSearchParams iteration broken
- 35 `Request is not defined` — fetch tests within url corpus
- 22 `params is not iterable`
- 14 generic `expected`
- 8 `URL.parse is not a function` — Node 21+ static method
- 8 `URL.canParse is not a function` — Node 18+ static method
- 5 `fetch: only http/https supported; got null` — tests using
  `fetch('//data')` for data-URL loading

→ Quick wins: add `URL.parse` + `URL.canParse` static methods
  (16 tests), make URLSearchParams iterable (~57 tests).

**Encoding**: 116 / 1139 (10.2%)
- 362 `assert_equals: expected` — non-UTF-8 codecs we don't have
  (UTF-16, GB18030, Big5, ISO-2022-*)
- 183 `label for encoding should match` — encoding-label aliases (e.g.
  `'utf8'` should resolve to `'utf-8'`)
- 142 `createBuffer is not defined` — harness gap
- 82 `assert_equals: N -> N` — numeric mismatches in stream cases
- 68 `TextDecoderStream is not defined` — modern stream wrappers
- 56 `did not throw` — error-condition tests
- 26 `XMLHttpRequest is not defined` — browser API
- 26 `TextEncoderStream is not defined`

→ Quick win: add `createBuffer` to harness (~142 tests). Real runtime
  work: TextEncoderStream / TextDecoderStream + label aliasing
  (~250 tests).

## Gotcha #4: Babel `presets: ['env']` doesn't lower async/await by default

Started running the Node test sweep. First few tests failed with
`SyntaxError: async functions are not enabled in the parser`, even
though the Babel-on-parse-failure path is engaged.

Root cause: `@babel/preset-env`'s default `targets` is the
`browserslist` defaults (`> 0.5%, last 2 versions, Firefox ESR, not
dead`), all of which natively support async/await — so Babel doesn't
lower it. Our `require.cpp` calls `babel.transform(src, { presets:
['env'] })` with no explicit targets, so we get the modern default.

Fix is one line in `globals.cpp`: add `targets: { ie: '11' }` (or
similar pre-async target) to the Babel transform call. Forces all
modern syntax to be lowered. Saving for a future session — it's a
rebuild + re-validate cycle and not in scope for this initial sweep.

This means the Node test numbers we get are pessimistic — many
"fail"s are actually "Babel didn't lower the test source" rather
than "ionpower-node behavior diverges from Node." Documented as
an asterisk on the headline number.

## Quick wins added to wpt-harness.js mid-session

Patched the harness to include the assert helpers that streams /
encoding tests pull in via `META: script=...`:

- `promise_rejects_exactly(t, value, fn)`
- `promise_rejects_js(t, ctor, fn)`
- `promise_rejects_dom(t, name, fn|ctor)`
- `flushAsyncEvents()` — microtask + setTimeout(0) drain
- `delay(ms)` — setTimeout-backed Promise
- `garbageCollect()` — no-op (no explicit GC available)
- `createBuffer(type, len)` — typed-array factory
- `fetch_tests_from_worker()` — no-op (no Workers)

Estimated impact when re-run: streams ~+390, encoding ~+142, plus
collateral wins where these helpers were the only blocker. Not
re-running this session — letting the Node sweep finish first.

## Next steps

(Captured for future-me.)

1. Patch require.cpp Babel call: `babel.transform(src, { presets:
   [['env', { targets: { ie: '11' } }]] })`. Forces async/let/const/
   optional-chaining/nullish-coalescing to all lower.

2. Re-run Node sweep after that lands. Pessimistic baseline current.

3. Re-run WPT after both: with the Babel fix + the harness assert
   additions, rough projection is +500-800 more passing.

4. Realistic shippable runtime wins from the WPT pattern analysis:
   - Expose `CryptoKey` + `SubtleCrypto` runtime globals
     (~395 WPT WebCrypto tests)
   - Add `URL.parse` + `URL.canParse` static methods
     (~16 WPT URL tests)
   - Make URLSearchParams iterable (~57 tests)
   - Tighten subtle validation: key-usage / key-length / algorithm
     compatibility checks (~2000+ WPT WebCrypto tests; biggest single
     bucket)
   - Expose `CountQueuingStrategy` / `ByteLengthQueuingStrategy` as
     runtime globals (currently only on `stream/web`)
   - Add `pkcs8` / `spki` key formats to subtle.importKey/exportKey
     (~870 WPT WebCrypto tests)

5. Realistic shippable wins from Node test sweep: TBD pending
   completed sweep + Babel fix.

## Files created this session

- `scripts/conformance/wpt-harness.js` (~430 LOC after assert helpers)
- `scripts/conformance/run-wpt.js`
- `scripts/conformance/node-common-shim.js`
- `scripts/conformance/run-node-tests.js`
- `docs/conformance/wpt-results/{summary.tsv,*.jsonl}` (sweep output)
- `docs/conformance/node-results/{summary.tsv,*.jsonl}` (sweep output)
- `docs/sessions/026-wpt-and-node-conformance/notes.md`
- `external/wpt/` (sparse, gitignored)
- `external/node-tests/` (sparse, gitignored)

## Files added so far

- `scripts/conformance/wpt-harness.js` (~360 LOC)
- `scripts/conformance/run-wpt.js` (~150 LOC; runner)
- `scripts/conformance/node-common-shim.js` (~150 LOC)
- `scripts/conformance/run-node-tests.js` (~150 LOC; runner)
- `external/wpt/` (sparse, gitignored)
- `external/node-tests/` (sparse, gitignored)
- `docs/conformance/wpt-results/`, `docs/conformance/node-results/`
  (output dirs; populated by runners)
