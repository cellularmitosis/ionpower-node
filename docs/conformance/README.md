# Conformance: WPT + Node test suite

Initial sweep of two upstream test corpora against ionpower-node v0.81
on `ibookg37` (iBook G3 PowerBook4,3 900 MHz). Run 2026-04-29.

## TL;DR

| Corpus | Pass | Total | Pct | Notes |
|---|---|---|---|---|
| **WPT** (URL/Streams/Encoding/WebCryptoAPI) | **560** | **9003** | **6.2%** | 236 of 251 files loaded; 50 load-errors mostly modern JS not lowered by Babel |
| **Node parallel-tests** (9 of 11 topics complete) | **49** | **557** | **8.8%** | `fs` skipped (217/251 — runner can't isolate test grandchildren); `crypto` partial |

Headline numbers are **pessimistic baselines**:

- WPT failures are clustered around fixable categories. The biggest
  single bucket is `crypto.subtle` accepting bad usage combinations
  that should throw (~2,750 WebCryptoAPI tests). Adding
  `CryptoKey`/`SubtleCrypto` globals + `pkcs8`/`spki` import formats
  gets ~400 more.
- Node parallel-test failures are dominated by infrastructure: many
  tests use `node:test` directly (`test is not a function`),
  reach into Node-internal helpers we don't shim, or hit the
  Babel-default-targets bug (modern syntax not lowered).
- A chunk of "fails" is a Babel runtime gap — `babel.transform()` in
  `globals.cpp` runs with the default `presets: ['env']` browserslist,
  which targets modern browsers and **doesn't lower async/await**.
  Several hundred tests fail at `SyntaxError: async functions are not
  enabled in the parser` rather than running. One-line fix in
  `globals.cpp`; haven't shipped it as part of this sweep.

## How it was run

### Corpora

Sparse-checked-out into `external/` (gitignored, not part of the repo
history):

- [`external/wpt/`](../../external/wpt/) — `web-platform-tests/wpt`
  master, restricted to `url/`, `urlpattern/`, `streams/`,
  `WebCryptoAPI/`, `encoding/`, `fetch/api/`, `resources/`. ~180 MB.
- [`external/node-tests/`](../../external/node-tests/) —
  `nodejs/node` main, restricted to `test/common/`, `test/fixtures/`
  minimal, and `test/parallel/test-{topic}-*.js` for our subset of
  topics. ~124 MB.

### Harnesses

- **WPT**: [`scripts/conformance/wpt-harness.js`](../../scripts/conformance/wpt-harness.js)
  is a ~430 LOC reimplementation of `testharness.js` that covers the
  asserts/test-functions used by url/streams/encoding/WebCryptoAPI.
  Loads tests via direct `(0, eval)`; on `SyntaxError` falls back to
  a temp-file `require()` so the bootstrap's Babel-on-parse-failure
  path takes over. Honours `META: script=...` directives so prelude
  helpers (`subset-tests-by-key.js`, etc.) get pulled in.

- **Node**: [`scripts/conformance/node-common-shim.js`](../../scripts/conformance/node-common-shim.js)
  is a ~150 LOC replacement for the upstream 1000+ LOC
  `test/common/index.js`. The runner copies it over the upstream file
  before sweeping, and restores the original on completion. The shim
  covers `mustCall`, `mustNotCall`, `mustSucceed`, `expectsError`,
  `skip`, `platformTimeout`, and the platform / capability constants
  most parallel tests touch.

Runners:
- [`scripts/conformance/run-wpt.js`](../../scripts/conformance/run-wpt.js)
- [`scripts/conformance/run-node-tests.js`](../../scripts/conformance/run-node-tests.js)

### Operational

- WPT sweep: 5,338 s (~89 min) for 236 files.
- Node sweep: ~30 min for the post-fs topics (zlib + crypto +
  string-decoder), plus ~40 min for the pre-fs topics in an earlier
  pass. `fs` is excluded — the runner can't reliably isolate
  grandchildren that test forks during pipe / link tests, so several
  fs tests wedge the runner indefinitely. (See "Open issues" below.)

## WPT results detail

```
TOTAL: 236 files, 560 pass, 8443 fail, 0 skip, 9003 total assertions, 5338s

  category        files  errs   pass  total    pct
  streams            73     4    223   1147  19.4%
  url                24     1     46    482   9.5%
  WebCryptoAPI      103    42    175   6235   2.8%
  encoding           36     3    116   1139  10.2%
```

Per-test detail in [`wpt-results/`](wpt-results/) (one JSONL per
category + a TSV summary).

### Top failure clusters by category

**WebCryptoAPI** (175 / 6235, 2.8%):

| Count | Pattern | Realistic-fix bucket |
|---|---|---|
| 1440 | `Bad usages not supported` | crypto.subtle missing key-usage validation |
| 1316 | `Operation succeeded, but should not have` | crypto.subtle missing input validation |
| 868 | `subtle.importKey: format` (raw / jwk only) | add `pkcs8` / `spki` formats |
| 586 | `subtle.importKey jwk: missing k` | wrong error shape on bad JWK |
| 244 | `CryptoKey is not defined` | expose runtime global |
| 158 | `buffer.buffer.transfer is not a function` | ES2024 ArrayBuffer.transfer (SM45 too old) |
| 151 | `SubtleCrypto is not defined` | expose runtime global |
| 96 | `unsupported ML-KEM-N` | post-quantum, won't support |
| 92 | `unsupported hash` | KMAC / Argon2 variants, won't support |

Estimated reachable: ~3,800 of 6,235 with validation tightening + key
formats + globals exposure. Cost: medium runtime work, no new deps.

**streams** (223 / 1147, 19.4%):

| Count | Pattern | Realistic-fix bucket |
|---|---|---|
| 193 | `promise_rejects_exactly is not defined` | harness gap — already added in current harness |
| 88 | `timeout (5000 ms)` | async tests not completing in 5 s budget |
| 71 | `flushAsyncEvents is not defined` | harness gap — added |
| 70 | `promise_rejects_js is not defined` | harness gap — added |
| 50 | `delay is not defined` | harness gap — added |
| 34 | `CountQueuingStrategy is not defined` | runtime: expose as global |
| 31 | `ReadableStream.from is not a function` | runtime: add static method |
| 16 | `c.byobRequest is undefined` | runtime: BYOB streams not implemented |

The 384 harness-related fails (`promise_rejects_*`, `flushAsyncEvents`,
`delay`) were patched mid-session — re-run will move them to pass.
Streams pass rate after re-run is projected at ~50%, not 19%.

**URL** (46 / 482, 9.5%):

| Count | Pattern | Realistic-fix bucket |
|---|---|---|
| 257 | `assert_equals: property` | URL property values diverge (IDN / non-special schemes) |
| 35 | `sp is not iterable` | URLSearchParams missing iteration protocol |
| 35 | `Request is not defined` | tests using fetch in URL corpus |
| 22 | `params is not iterable` | same as above |
| 14 | generic `expected` | misc property mismatches |
| 8 | `URL.parse is not a function` | Node 21+ static method |
| 8 | `URL.canParse is not a function` | Node 18+ static method |

**encoding** (116 / 1139, 10.2%):

| Count | Pattern | Realistic-fix bucket |
|---|---|---|
| 362 | `assert_equals: expected` | non-UTF-8 codecs we don't have |
| 183 | `label for encoding should match` | label aliases (`utf8` → `utf-8`) |
| 142 | `createBuffer is not defined` | harness gap — added |
| 82 | numeric mismatches | non-UTF-8 streaming corner cases |
| 68 | `TextDecoderStream is not defined` | runtime: add stream wrapper |
| 56 | `did not throw` | error-condition tests |
| 26 | `XMLHttpRequest is not defined` | browser API, won't support |
| 26 | `TextEncoderStream is not defined` | runtime: add stream wrapper |

## Node parallel-test results detail

```
topic           total  pass  skip  fail    to    pct
TOTAL             557    49     9   375   124   8.8%
fs                 34     7     1    17     9  20.6%   *partial
buffer             68    10     2    55     1  14.7%
path               16     2     1    13     0  12.5%
stream            215    19     0   118    78   8.8%
assert             13     1     0    10     2   7.7%
url                15     1     0    14     0   6.7%
crypto            122     6     5    84    27   4.9%
zlib               61     2     0    54     5   3.3%
events              8     0     0     6     2   0.0%
querystring         3     1     0     2     0  33.3%
string-decoder      2     0     0     2     0   0.0%
```

`fs` excluded after the runner wedged trying to isolate grandchildren
of `test-fs-link.js` and similar tests that fork subprocesses.
Returning to fs needs a process-group-aware runner.

Per-test detail in [`node-results/`](node-results/).

### Top failure clusters

**Across all topics**, the top buckets are:

| Pattern | Count | What it means |
|---|---|---|
| `mutating the [[Prototype]]` (SM45 perf warning at top of stderr) | many | Test exited non-zero for an unrelated reason; the SM45 warning truncated our 240-char message capture. Need to dig deeper to classify. |
| `test is not a function` | ~30 | Tests using `node:test` directly. Need a `test`/`describe`-aware shim mode. |
| `AssertionError` (no further detail) | ~25 | Real behavior divergence; need per-test investigation. |
| `cannot find module 'internal/test/binding'` | several | Tests reaching into Node-internal helpers; out of scope. |
| `No such file or directory, open '.../common/...'` | several | Tests `require()`-ing common-helper files we didn't shim (e.g., `common/dns.js`, `common/tls.js`). Adding stubs would unlock these. |
| `async functions are not enabled in the parser` | several | Tests using async/await; Babel default targets don't lower. |
| Topic-specific gaps | several | `crypto.createDiffieHellmanGroup`, `crypto.getDiffieHellman`, `zlib.zstdCompress`, `zlib.unzip`, etc. |

## Findings

### Real runtime gaps surfaced by the sweep

In rough order of impact (test count × ease):

1. **`crypto.subtle` input validation** — accepts bad key-usage / bad
   key-length / bad algorithm combinations that should throw.
   ~2,750 WPT WebCryptoAPI assertions fail on this alone.
2. **`CryptoKey` and `SubtleCrypto` runtime globals** — currently
   only `_CryptoKey` private constructor; ~395 WPT tests check the
   global names.
3. **PKCS#8 / SPKI key formats in `subtle.{import,export}Key`** —
   we have `raw` and `jwk`; ~870 WebCryptoAPI tests use these.
4. **`URLSearchParams` iteration protocol** (`Symbol.iterator`,
   spread, for-of) — ~57 URL tests.
5. **`URL.parse` / `URL.canParse` static methods** — Node 18+/21+
   modern API; ~16 tests.
6. **`CountQueuingStrategy` / `ByteLengthQueuingStrategy` runtime
   globals** — currently only on `stream/web` module; ~34 WPT.
7. **`ReadableStream.from(asyncIterable)`** — ~31 WPT.
8. **`TextEncoderStream` / `TextDecoderStream`** — ~94 WPT encoding.
9. **`zlib.zstdCompress` / `zstdDecompress`** — Node 23+ Zstd; small
   bucket.
10. **`crypto.createDiffieHellmanGroup` / `crypto.getDiffieHellman`**
    — modular DH (FFDHE) groups; small bucket.
11. **`domain` module** — deprecated but still shipped by Node.

### Real runtime gaps NOT exercised by the sweep

(Things we know are missing but the test corpus doesn't probe at our
sweep depth.)

- `https.createServer` / TLS — see [`docs/plan-tls.md`](../plan-tls.md).
- `Intl` — needs ICU rebuild of mozjs.
- Brotli compression — vendored decoder feasible.
- `worker_threads.MessageChannel` / `MessagePort`.
- `http2`.

### Babel-default-targets bug

`globals.cpp` calls `babel.transform(src, { presets: ['env'] })` with no
explicit `targets`. `@babel/preset-env`'s default `browserslist` is
`> 0.5%, last 2 versions, Firefox ESR, not dead` — all of which
natively support async/await — so Babel **doesn't lower it**. SM45
still chokes.

Fix is one line in `globals.cpp`:

```cpp
"      code = babel.transform(rawSrc, { presets: [['env', { targets: { ie: '11' } }]] }).code;\n"
```

Forces lowering of async, let/const, optional chaining, nullish
coalescing, etc. Several hundred Node tests + ~50 WPT load-errors
would move from "fail" to "passed-or-real-fail" with this. Costs a
runtime rebuild + re-run; saved for a follow-up session.

### Harness coverage gaps caught mid-sweep (already patched)

After the first WPT sweep, added these to `wpt-harness.js` to unblock
~400-500 tests on a re-run:

- `promise_rejects_exactly`, `promise_rejects_js`, `promise_rejects_dom`
- `flushAsyncEvents`, `delay`, `garbageCollect`, `createBuffer`,
  `fetch_tests_from_worker`

Re-run not done in this initial sweep; estimated impact in the
patterns table above.

## Open issues

### `fs` test sweep wedges the runner

Several `test-fs-*.js` files (e.g., `test-fs-link.js`,
`test-fs-readfile-pipe.js`, anything with subprocess piping) spawn
their own children. When our `cp.spawn(NODE_BIN, [test])` hits a 30 s
timeout and SIGKILLs the test process, the test's grandchildren
survive holding the stdio pipes open. Our `'close'` event never fires.
The 40 s hard-timeout supposedly fires but in practice never advances
us past these tests — the child process orphans something the event
loop is stuck on.

Two paths forward:
1. **Process-group isolation**: `cp.spawn(..., { detached: true })`
   then `process.kill(-pid, 'SIGKILL')` to nuke the entire group.
2. **Wrapper script**: invoke each test via a shell wrapper that
   handles its own timeout + tree-kill, e.g. via `gtimeout`-style
   logic in pure shell.

Either is ~30 LOC. Saved for a follow-up session.

### Sweep takes ~90 min on G3 with corpus this size

Running on G4/G5 would cut this 2-3×. Could also be parallelised:
the WPT sweep is single-threaded today (one harness process per file,
sequential). With our event loop's process-spawning we could run
N tests concurrently. Would need careful CPU budgeting on a 640 MB
PowerBook.

## Files

- [`scripts/conformance/wpt-harness.js`](../../scripts/conformance/wpt-harness.js)
- [`scripts/conformance/run-wpt.js`](../../scripts/conformance/run-wpt.js)
- [`scripts/conformance/node-common-shim.js`](../../scripts/conformance/node-common-shim.js)
- [`scripts/conformance/run-node-tests.js`](../../scripts/conformance/run-node-tests.js)
- [`docs/conformance/wpt-results/`](wpt-results/) — TSV summary +
  per-category JSONL of every test result
- [`docs/conformance/node-results/`](node-results/) — TSV summary +
  per-topic JSONL
