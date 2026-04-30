# Testing ionpower-node

Three layers of test coverage, from fastest to longest:

1. **[Smoke suite](#smoke-suite)** (`make test-all`) — ~3-5 min. The
   project's primary regression net. ~432 wired smoke files,
   1990+ assertions.
2. **[Demo round-trips](#demo-round-trips)** — a few seconds each.
   Three demos (chat, paste, express-chat) with their own CLI clients
   that exercise an end-to-end pipeline.
3. **[Conformance sweeps](#conformance-sweeps)** — 30-90 min each.
   Run upstream WPT (Web Platform Tests) and Node's own
   `test/parallel/` corpora against the runtime. **Optional**;
   not part of the release gate.

Everything assumes you've already built (`./node` exists in the
source tree) — see [`BUILDING.md`](BUILDING.md).

---

## Smoke suite

The project's primary regression test. Wired into the Makefile.

```bash
# From the project root, with arch-specific flags:
make MOZJS_PREFIX=/opt/mozjs-45-ionpower-g3 CPU_FLAGS="-mcpu=750 -mtune=750" test-all
```

`test-all` is `make test` plus `make test-libs`. Run them separately
if you want:

### `make test` (the core)

13 fast smokes that exercise the runtime's primitives:

```
test/hello.js                  basic output + process exit
test/require_chain.js          CommonJS require resolution
test/nm_resolution_smoke.js    node_modules walk
test/fs_smoke.js               readFileSync / writeFileSync / etc.
test/fs_dirs_smoke.js          mkdir / rmdir / readdir / recursive
test/fs_extras_smoke.js        cp / rm / chmod / rename / link
test/timers_smoke.js           setTimeout / setInterval / setImmediate
test/console_formatting.js     util.format-style printf
test/util_inspect_smoke.js     util.inspect (depth, cycles, getters)
test/promise_smoke.js          Promise.{resolve,reject,all,race,allSettled}
test/cores_smoke.js            os.cpus / Buffer / TextEncoder / etc.
test/integration.js            multi-module round-trip
test/fibonacci.js              JIT warm-up
test/jit_smoke.js              IonPower JIT correctness
```

Total: under 5 seconds combined on G3.

### `make test-libs` (the broad sweep)

432+ smoke files covering the third-party libraries we vendor + the
Node-API surface we expose. Each file is one
`./node test/<thing>_smoke.js`. Output is the smoke's own
"ok: ..." prints; failure exits non-zero and stops the suite.

A few representative examples:

```
test/handlebars_smoke.js       Handlebars template render round-trip
test/marked_smoke.js           Markdown -> HTML
test/lodash_smoke.js           lodash chunk / pick / omit / etc.
test/moment_smoke.js           date format / parse
test/rsa_smoke.js              RSA generateKeyPairSync + sign + verify
test/ecdsa_smoke.js            ECDSA P-256 + secp256k1
test/ecdh_smoke.js             NIST ECDH key agreement
test/x509_smoke.js             self-signed cert generation + verify
test/jwt_rs256_smoke.js        manual RS256 + EdDSA JWT round-trip
test/zlib_real_smoke.js        gzip 8 KB -> ~44 bytes (real DEFLATE)
test/websocket_smoke.js        ws server + client round-trip
test/subtle_ecdsa_smoke.js     crypto.subtle ECDSA + ECDH via WebCrypto
test/subtle_ec_jwk_smoke.js    EC JWK import/export round-trip
test/dispose_smoke.js          Symbol.dispose + DisposableStack
test/diag_channel_smoke.js     diagnostics_channel
test/test_mock_smoke.js        node:test t.mock.fn / .method
... 400+ more
```

Total: ~3-5 min on G3, ~2 min on G4, under 1 min on G5.

### Per-test invocation

If `make test-libs` fails on a specific test, re-run just that one
to iterate:

```bash
./node test/handlebars_smoke.js
```

Each smoke is self-contained (no shared state). They emit
human-readable `ok: ...` lines and end with `<name> smoke: all
assertions passed` on success.

---

## Demo round-trips

Three demos under [`demos/`](demos/) with their own client smokes.

### `demos/chat` — multi-client WebSocket chat

```bash
# Server (one terminal)
./node demos/chat/server.js
# -> serves http://0.0.0.0:8080/, ws://0.0.0.0:8081/

# Browser test (any modern Mac browser)
open http://<host>:8080/
# Type a message; open a second tab, both see each other.
```

No CLI smoke — visual / browser test.

### `demos/paste` — JWT-secured encrypted paste server

```bash
# Server
./node demos/paste/server.js 8090
# (waits ~10 s for ECDSA P-256 keygen on G3)

# CLI client (second terminal)
./node demos/paste/client.js http://127.0.0.1:8090
# Round-trips POST + GET + auth-rejection.
# Exits 0 on success.
```

### `demos/express-chat` — anonymous chat board on Express 4

```bash
# Server
./node demos/express-chat/server.js 8090
# (similar startup wait)

# CLI client
./node demos/express-chat/client.js http://127.0.0.1:8090
# 7 checks: post shape, GET feed, tripcode hash, rate limit,
# ?since=N filtering, empty-text rejection.
# "express-chat smoke: ok (7 checks passed)" on success.

# Browser
open http://<host>:8090/
# Anonymous post + tripcode form. Real-time updates via ws://...:8091/
```

The `demos/express-chat` client smoke is the closest thing the project
has to an "is the whole stack working?" integration test — it
exercises Express 4 + body-parser + handlebars + node:crypto
(SHA-256) + http + ws across one round-trip.

---

## Conformance sweeps

Optional. Measure ionpower-node against two upstream test corpora:

- **Web Platform Tests (WPT)** — the WHATWG-spec corpus for `URL`,
  `URLSearchParams`, `fetch`, `Streams`, `WebCrypto`,
  `TextEncoder`/`Decoder`, etc. Used by every Web runtime.
- **Node's own `test/parallel/`** — Node's per-module tests for
  `buffer`, `path`, `querystring`, `url`, `events`, `stream`,
  `crypto`, `zlib`, `fs`, `string-decoder`, `assert`.

Headline numbers as of v0.82:

| Corpus | Pass | Total | Pct |
|---|---|---|---|
| **WPT** (URL/Streams/Encoding/WebCryptoAPI) | 560 | 9,003 | 6.2% |
| **Node parallel-tests** (9 of 11 topics) | 49 | 557 | 8.8% |

These are pessimistic baselines — failure pattern analysis lives in
[`docs/conformance/README.md`](docs/conformance/README.md) and ranks
the runtime gaps by impact.

### One-time corpus setup

Both corpora go under `external/` (gitignored).

#### WPT subset (~180 MB)

```bash
mkdir -p external/wpt && cd external/wpt
git init -q
git remote add origin https://github.com/web-platform-tests/wpt.git
git config core.sparseCheckout true
printf '/url/\n/urlpattern/\n/streams/\n/WebCryptoAPI/\n/encoding/\n/fetch/api/\n/resources/\n' \
    > .git/info/sparse-checkout
git fetch --depth=1 origin master
git checkout master
cd -
```

#### Node parallel-tests subset (~124 MB)

```bash
mkdir -p external/node-tests && cd external/node-tests
git init -q
git remote add origin https://github.com/nodejs/node.git
git config core.sparseCheckout true
printf '/test/common/
/test/fixtures/empty.js
/test/parallel/test-buffer-*
/test/parallel/test-path-*
/test/parallel/test-querystring-*
/test/parallel/test-url-*
/test/parallel/test-events-*
/test/parallel/test-stream-*
/test/parallel/test-crypto-*
/test/parallel/test-zlib-*
/test/parallel/test-fs-*
/test/parallel/test-string-decoder*
/test/parallel/test-assert-*
' > .git/info/sparse-checkout
git fetch --depth=1 origin main
git checkout main
cd -
```

### Running the sweeps

#### WPT (~90 min on G3)

```bash
./node scripts/conformance/run-wpt.js encoding url streams WebCryptoAPI
```

Per-test detail goes to `docs/conformance/wpt-results/*.jsonl` (one
file per category) plus a TSV at
`docs/conformance/wpt-results/summary.tsv`. The runner supports
**resume** — kill mid-sweep, re-run, picks up from where the
summary left off.

The harness is [`scripts/conformance/wpt-harness.js`](scripts/conformance/wpt-harness.js)
(~430 LOC). It implements the subset of WPT's `testharness.js` that
url/, streams/, encoding/, and WebCryptoAPI/ tests actually use,
with a Babel-on-parse-failure fallback for tests that use
`async function`.

#### Node parallel-tests (~60 min)

```bash
# fs is excluded by default — its tests fork subprocesses that hold
# stdio open after we SIGKILL them, which wedges the runner. List
# topics explicitly to skip it:
./node scripts/conformance/run-node-tests.js \
    assert buffer path querystring url events stream string-decoder zlib crypto
```

Per-test detail at `docs/conformance/node-results/*.jsonl`,
summary at `docs/conformance/node-results/summary.tsv`.

The runner copies our shim
([`scripts/conformance/node-common-shim.js`](scripts/conformance/node-common-shim.js),
~150 LOC) over Node's upstream 1000+ LOC `test/common/index.js`
during the sweep, then restores the original on completion.

### Aggregating results

The TSVs are easy to slice. Per-topic pass rates from the Node
sweep:

```bash
awk -F'\t' 'NR>1 { c[$1]++; if ($3=="pass") p[$1]++ }
            END  { for (t in c) printf "%-15s %5d / %5d (%5.1f%%)\n",
                       t, p[t]+0, c[t], (p[t]+0)*100/c[t] }' \
    docs/conformance/node-results/summary.tsv | sort
```

Top failure-message clusters per WPT category:

```bash
grep '"result":"fail"' docs/conformance/wpt-results/streams.jsonl \
  | sed -nE 's/.*"message":"([^"]*)".*/\1/p' \
  | sort | uniq -c | sort -rn | head
```

---

## What "all green" looks like in this project

For a release to ship, all three triad arches need a clean
`make test-all`:

```
$ make MOZJS_PREFIX=/opt/mozjs-45-ionpower-g3 CPU_FLAGS="-mcpu=750 -mtune=750" test-all
./node test/hello.js
hello world
./node test/require_chain.js
ok: chain a -> b -> c
...
./node test/cluster_stub_smoke.js
...
ok: cluster.disconnect (single-process)

cluster stub smoke: all assertions passed
```

The smoke suite stops at the first `process.exit(1)` from any
individual test. A clean run ends with the last smoke's "all
assertions passed" line and the make invocation exiting 0. Build
logs from every triad release live under
[`docs/sessions/`](docs/sessions/) for reference.

The conformance sweeps are **not** part of the release gate. They're
informational — the runtime ships green even with the WPT pass rate
at 6.2%, because most of those failures are clearly fixable
categorical gaps (input validation, missing globals) rather than
broken behaviour. See
[`docs/conformance/README.md`](docs/conformance/README.md) for the
ranked list.
