# Session notes — 049: Node 10 parity pass 15

Handoff in: [`../048-node-10-parity-pass-14/handoff-pass-15.md`](../048-node-10-parity-pass-14/handoff-pass-15.md).
Pass-14 notes: [`../048-node-10-parity-pass-14/notes.md`](../048-node-10-parity-pass-14/notes.md).
Pass-14's v1.0 release notes draft (superseded by this session's):
[`../048-node-10-parity-pass-14/release-notes/v1.0.md`](../048-node-10-parity-pass-14/release-notes/v1.0.md).
This pass's release notes (the one we shipped): [`release-notes/v1.0.md`](release-notes/v1.0.md).

## State at the start

- Pass-14 left v1.0 source changes uncommitted in working tree on
  uranium (7 modified, 4 new test smokes, plus the `048-...` dir).
- G3 build had run through clean + link successfully but the
  `test-all` phase was killed before any smoke output reached the log.
- G4 and G5 had not been touched.
- Wave-2 survey artifacts intact under `../048-.../build-logs/`.

## Working order this pass

1. Resume triad build — G3 foreground first, then G4 + G5 in
   parallel. Capture full test-all output to
   `build-logs/g{3,4,5}-build.log` + `-tests.log`.
2. Spot-check fix candidates (luxon, meow, axios) on the v1.0
   binary; retry npm flakes (got@11, inquirer@8).
3. Update `release-notes/v1.0.md` Verification section with real
   numbers.
4. Commit + tag + push + gh release create v1.0.
5. Write handoff-pass-16.md.

## What actually happened — attempt 1 vs attempt 2

The "resume the build" item from the handoff became three rounds:

### Round 1 — G3 foreground, then G4 + G5 parallel (attempt 1)

G3 was clean: 25 core / 0 fail + 495 libs / 0 fail = 520 PASS,
including all four new smokes from pass 14
(`proto_warning_filter_smoke`, `require_subpath_json_smoke`,
`babel_lazy_parse_fallback_smoke`, `http2_stub_smoke`). G4 was also
clean on the first try. G5 had a one-shot
`proto_warning_filter_smoke` failure on the first test-all that
passed cleanly on the auto-retry — most likely a fork/exec timing
hiccup on pmacg5 (the smoke spawns a child process).

Pulled the v1.0 binary state, then ran the handoff's recommended
spot-checks against the G3 binary:

- `luxon` ✅ — `require('luxon')` returned the expected exports
  (DateTime, Duration, FixedOffsetZone, ...). The lazy-parse fix
  works.
- `axios` ✅ — `require('axios')` returned a function after a
  babel-cache wipe (4 min cold transpile). The http2 stub + lazy-
  parse fixes both work end-to-end. The initial fail (without cache
  wipe) was a stale cache from the pre-v1.0 binary; not a v1.0 bug.
- `meow` ❌ — fails at meow/index.js:15 with `REQUIRE_FAIL require.cache
  is undefined`. Pre-v1.0 meow was failing earlier (at
  spdx-license-ids/deprecated subpath JSON resolution). The pass-14
  subpath-JSON fix unblocked the resolver, but meow's
  `delete require.cache[__filename];` then hits a new wall:
  `require.cache` was never exposed on our per-module require.

### The require.cache gap (and why it took two binaries to find it)

Pre-v1.0 meow always failed at the resolver, so its module-load body
never ran. We never saw the require.cache use. Once the resolver
fix shipped, meow loaded far enough to hit
`delete require.cache[__filename];` — which throws
`cannot delete property of undefined`.

Fix lives in two places:

1. [`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp):
   the `__make_require__` factory now does
   `f.cache = __require_cache__;`. The internal cache is already
   keyed by absolute file path (`/Users/.../node_modules/meow/index.js`),
   which is exactly what `delete require.cache[__filename]` expects
   to delete.
2. [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp):
   the rewrap layer that adds bare-specifier / vendor-dir fallback
   was already propagating `req.resolve` but **not** `req.cache`.
   Without the propagation, user code only sees the wrapped require —
   so `wrapped.cache` was still undefined even with the require.cpp
   fix. Added `wrapped.cache = req.cache;` between the existing
   `wrapped.resolve = req.resolve;` and `return wrapped;`.

This bug was a small but instructive teach-moment: there are TWO
require shims in the build, an inner (require.cpp) and an outer
(globals.cpp rewrap), and any property added to the inner one is
silently lost unless the outer one explicitly forwards it. The
`resolve` field happens to be forwarded because someone hit the
same wall earlier; `cache` was new territory.

Smoke at
[`test/require_cache_smoke.js`](../../../test/require_cache_smoke.js)
exercises the round-trip: load a module, see it appear in
`require.cache`, mutate the source, `delete require.cache[absPath]`,
re-require, and assert the new exports come back.

### Round 2 — G3 attempt-2 (test-all FAILED twice)

The smoke discovered itself: the *first* G3 rebuild after the
require.cpp edit had the require.cpp fix on disk + in require.o, but
the running binary still didn't expose `require.cache`. The
require.cache smoke failed on the first test-all attempt AND on the
auto-retry, blowing the build.

Root cause: I'd only edited require.cpp, not globals.cpp. The outer
wrapper at globals.cpp:10470 was the actual blocker. After spending
about ten minutes proving it via `strings node | grep 'f.cache'`
(present), `__make_require__("/tmp").cache` (undefined),
`Object.getOwnPropertyNames(req)` (only `resolve,prototype,length,
name`), the chain became obvious: yes, require.cpp's factory was
running, but the rewrap in globals.cpp returned a brand-new closure
that carried over `resolve` but not `cache`.

Pushed globals.cpp via scp (it's already in the gremlin-workaround
list, so the explicit copy is paranoia) and ran a quick incremental
rebuild on G3 (just `rm -f globals.o node && make` — about 90 s)
to verify the fix before re-burning the full clean rebuild. Smoke
passed, meow loaded cleanly, all three handoff candidates worked.

### Round 3 — full clean triad rebuild in parallel

Pre-cleared the attempt-1 + failed-attempt-2 logs (renamed them to
`-attempt1.log` and `-attempt2-failed.log` in `build-logs/`), then
fired `g3 + g4 + g5` triad-build wrappers in parallel via
`run_in_background`. All three ran clean in ~30 min wall-clock:

| Host          | Arch       | Core  | Libs  | Total  | Retry triggered? |
|---------------|------------|-------|-------|--------|------------------|
| ibookg37 G3   | PPC 750    | 26/0  | 495/0 | 521/0  | No |
| emac G4       | PPC 7450   | 26/0  | 495/0 | 521/0  | No |
| pmacg5 G5     | PPC 970    | 26/0  | 495/0 | 521/0  | No |

All five v1.0 smokes pass on all three hosts. Tarballs pulled to
`/tmp/v1.0-release/`.

## Spot-check + flake-retry summary (final, against v1.0 binary)

| Package      | Pre-v1.0 result                              | v1.0 result | Notes |
|--------------|----------------------------------------------|-------------|-------|
| luxon        | REQUIRE_FAIL `invalid property id` (lazy-parse trap) | OK ✅       | Babel-cache wipe required to retrigger |
| meow         | REQUIRE_FAIL spdx subpath (pass-13 baseline) → REQUIRE_FAIL `require.cache is undefined` (after pass-14 subpath fix) | OK ✅ | Both gaps fixed in v1.0 |
| axios        | REQUIRE_FAIL `invalid property id` on http2 / cuid2 patterns (pass-13) | OK ✅ | Cache wipe required; load is 4 min cold |
| got@11       | INSTALL_FAIL `cb() never called` (pass-14 flake) | REQUIRE_FAIL `invalid regexp group` | New gap surfaced: normalize-url uses `(?<name>…)` + lookbehind — out of scope for v1.0 |
| inquirer@8   | INSTALL_FAIL `read errno 54` (pass-14 flake) | OK ✅       | Genuine flake; install + require both green on retry |

The got@11 finding adds a known gap to the v1.0 release notes:
**ES2018 named-capture / lookbehind regex** — SM45's regex engine
predates them, and Babel cannot transform regex literals (regex is
a primitive type, not syntax). This affects got's `normalize-url`
dependency. Other URL/parser packages that use these features will
hit the same wall.

## v1.0 fix list (final, as shipped)

Five fixes, all wired with smokes in `scripts/test-list-core.txt`:

1. **Disable lazy parsing** — [`src/main.cpp`](../../../src/main.cpp).
   `setDisableLazyParsing(true)` so SM45 reports parse errors at
   compile time, when the Babel-fallback path is still watching.
   Unblocks luxon, axios, and likely many other modern-syntax libs.
2. **Resolver — `<base>.json` subpath probe** —
   [`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp).
   Unblocks meow → spdx-license-ids/deprecated.
3. **http2 throwing stub** —
   [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp).
   `require('http2')` returns a stub object so axios@1.x and got@11
   can `var http2 = require('http2');` at top level.
4. **Proto-warning filter** — [`src/main.cpp`](../../../src/main.cpp).
   Cosmetic; silences SM45's `[[Prototype]]` warning by default
   (opt-in via `IONPOWER_TRACE_PROTO_WARN=1`).
5. **Expose `require.cache`** —
   [`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp)
   + [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp).
   `__make_require__` factory attaches `f.cache = __require_cache__`;
   the rewrap layer propagates `wrapped.cache = req.cache;`. Unblocks
   meow.

Smokes:

- [`test/proto_warning_filter_smoke.js`](../../../test/proto_warning_filter_smoke.js)
- [`test/require_subpath_json_smoke.js`](../../../test/require_subpath_json_smoke.js)
- [`test/babel_lazy_parse_fallback_smoke.js`](../../../test/babel_lazy_parse_fallback_smoke.js)
- [`test/http2_stub_smoke.js`](../../../test/http2_stub_smoke.js)
- [`test/require_cache_smoke.js`](../../../test/require_cache_smoke.js) ← new this pass

## Known gaps (documented in v1.0 release notes)

- **BigInt** — superagent (via cuid2), make-fetch-happen (via
  ip-address). SM45 has no BigInt primitive.
- **ES2018 regex** — got@11 (via normalize-url). Named capture +
  lookbehind. Out of scope.
- **yargs@17** — engine check at module load. Pin yargs@^16.
- **request-promise-native** — peerDep not auto-installed; package
  is deprecated upstream.

## Lessons / followups

- **Two-layer require shim is a foot-gun.** Anything added to
  `__make_require__` (inner factory in require.cpp) is invisible to
  user code unless the rewrap in globals.cpp explicitly forwards it.
  Worth a code-comment at the rewrap saying "remember to forward
  new properties." If we ever add `require.main`, `require.extensions`,
  etc. we'll hit this again. (Documented in the require.cache-fix
  commit, but a flag in the source would help next-future-Claude.)
- **Stale Babel cache masks fixes.** axios looked broken at first
  against the v1.0 binary because the cached pre-v1.0 transpile of
  axios.cjs still held the lazy-parse-broken output. A blanket
  cache wipe ("babel-v1 dir") is too aggressive — we'd lose the
  warm cache and pay 45 min for cold next time — but a targeted
  per-pkg wipe was the right move.
- **gremlin-workaround scp list is the rsync's single point of
  failure surrogate.** require.cpp wasn't in it; the rsync did
  actually update require.cpp (md5 matched on remote), so the bug
  wasn't there. But the next time I touch a file that ISN'T in the
  list and seems "not to take", remember: check the md5 first, the
  build order second; rsync is usually fine but the gremlin list
  exists because sometimes it isn't.

## Pull request / release shipped

Two commits this pass:

- `v1.0: ...` — source fixes + new smoke
- `docs/sessions/048+049: ...` — both session dirs + v1.0 release notes

Tag: `v1.0`. Tarballs in the GitHub Release.
