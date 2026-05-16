# Session notes — 048: Node 10 parity pass 14

Handoff in: [`../047-node-10-parity-pass-13/handoff-pass-14.md`](../047-node-10-parity-pass-13/handoff-pass-14.md).
Pass-13 notes: [`../047-node-10-parity-pass-13/notes.md`](../047-node-10-parity-pass-13/notes.md).
Pass-13 survey: [`../047-node-10-parity-pass-13/survey.md`](../047-node-10-parity-pass-13/survey.md).

## Working order (from handoff)

1. **Survey wave 2 first.** 30–50 more packages from npm's
   top-downloads to expand the picture of what's just-working and
   group the failures by root cause. Use `survey-one.sh` already
   shipped in pass 13.
2. **Then A (http2 stub) or C (proto-mutation warning)** depending
   on what wave 2 surfaces.
3. **Bundle as v1.0** if it shapes up that way.

## State at the start

- G3 (ibookg37) up, load 0.08, uptime 2 days. Stable.
- `/Users/macuser/tmp/ionpower-node/` at v0.99 (Makefile VERSION).
- `/Users/macuser/tmp/survey-047/` intact with 10 packages from
  pass 13 (lodash/debug/dotenv/bluebird/chalk/commander/axios/
  node-fetch/joi/winston in `pkgs/`) and `summary.tsv` with the
  pass-13 results.
- Babel disk cache at `~/.ionpower-cache/babel-v1/` on G3 is warm
  (per handoff: ~900 entries) — DO NOT WIPE. ~20 min for a clean
  smoke vs ~45 min cold.

## Plan for wave 2

Run packages one at a time via `survey-one.sh` into a fresh
`/Users/macuser/tmp/survey-048/`, log to per-package files, and
aggregate failures.

Candidate list from the handoff (32 entries):

- HTTP clients: `got@11`, `superagent`, `request-promise-native`,
  `phin`, `make-fetch-happen`
- Util: `fs-extra`, `glob@8`, `chokidar@3`, `minimatch`, `nanoid`,
  `uuid@8`, `pino@6`
- Async: `p-queue@6`, `p-retry@4`, `p-limit@3`, `async`
- Build/CLI: `meow@9`, `yargs@17`, `inquirer@8`, `ora@5`,
  `cli-progress`
- Data: `ajv@8`, `joi` (re-confirm), `yup`, `validator`
- Templating: `handlebars` (re-confirm), `pug`, `ejs`
- Datestamp: `date-fns`, `dayjs`, `luxon`
- Streams: `through2`, `pumpify`, `multistream`, `JSONStream`

(Re-confirms folded in — `joi` and `handlebars` already in pass-13
tree. Save churn: skip the re-confirms in wave 2 unless I'm
chasing a specific regression.)

## Item C (proto-warning filter) — done locally, awaiting triad build

The handoff calls this cosmetic but suggests it for "zero startup
warnings." v1.0 is the right target.

Edit at [`src/main.cpp:32`](../../../src/main.cpp): `ReportError`
now suppresses the `[[Prototype]]` warning by default. Set
`IONPOWER_TRACE_PROTO_WARN=1` to re-enable (same env var that
already turns on the stack-trace dump). Defense-in-depth: only
silences when `JSREPORT_IS_WARNING(report->flags)` is also true,
so a thrown `Error("[[Prototype]]")` from JS land would still
surface.

Smoke: [`test/proto_warning_filter_smoke.js`](../../../test/proto_warning_filter_smoke.js).
Spawns `process.execPath` on a `o.__proto__ = {...}` trigger and
asserts:
- default mode → no `[[Prototype]]` in stderr; child exits 0
- `IONPOWER_TRACE_PROTO_WARN=1` → both the warning and the stack
  trace appear.

Wired into [`scripts/test-list-core.txt`](../../../scripts/test-list-core.txt).

## Wave 2 — early findings (in progress)

After 4 packages:

| Package                  | Result        | Failure mode (if any) |
|--------------------------|---------------|------------------------|
| nanoid (5.1.11)          | OK            | — |
| got@11                   | INSTALL_FAIL  | `npm ERR! cb() never called!` — same flake as winston had in pass 13. Retry-able. |
| superagent (10.3.0)      | REQUIRE_FAIL  | Transitive dep `@paralleldrive/cuid2` uses BigInt literals (`8n`, `0n`, `BigInt(i)`). SM45 has no BigInt — real gap. |
| request-promise-native   | REQUIRE_FAIL  | `cannot find module 'request'` — peerDep not auto-installed. rpn is itself deprecated. User error. |

### Failure-category radar

So far we've seen one new category that doesn't appear in v0.99 docs:

- **BigInt** — used in cuid2, likely elsewhere (any package that
  computes large integers exactly: crypto, IDs, hashing helpers).
  Polyfilling BigInt is non-trivial because it's a runtime
  primitive type, not just syntax. Babel can lower literals (`8n`
  → `BigInt("8")`) but the constructor must return a real BigInt.
  A JS-only polyfill (jsbi-style) is possible but requires
  rewriting all `BigInt(...)` calls. Out of scope for v1.0.
  Document as a known gap.
- **npm flakes** — `cb() never called` recurs. Worth a retry
  pass at the end of the sweep.
- **peerDep absences** — not a runtime issue. Skip in failure
  triage.

(More to come as the sweep progresses.)

### Update at 22/32

Categories now visible:

| Category                       | Packages                                          | v1.0 action |
|---------------------------------|---------------------------------------------------|-------------|
| OK out of the box               | nanoid, phin, fs-extra, glob, chokidar, minimatch, uuid, pino, p-queue, p-retry, p-limit, async, ora, cli-progress | — |
| BigInt (real gap)               | superagent (via cuid2), make-fetch-happen (via ip-address) | Document only; polyfill out of scope |
| Subpath JSON resolution         | meow (via spdx-license-ids/deprecated)            | **Fixable on our side — fixed in this pass** |
| Engine check at load time       | yargs@17 (yargs-parser refuses Node <12)         | Not fixable; document |
| npm install flakes (retry-able) | got@11 (`cb() never called`), inquirer@8 (`read errno 54`) | Retry at end of sweep |
| Missing peer dep                | request-promise-native (needs `request`)         | User-pattern; not a runtime gap |

## Item D (subpath .json) — done locally

Found via meow → spdx-license-ids/deprecated. Node's `LOAD_AS_FILE`
algorithm tries `X` → `X.js` → `X.json` → `X.node`. Our
`TryModuleExtensions` tried `.js` and `.cjs` but not `.json` for
the basename — only for `index.json`. Added `base + ".json"`
between the `.cjs` probe and the package.json `main` lookup at
[`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp).
Smoke at
[`test/require_subpath_json_smoke.js`](../../../test/require_subpath_json_smoke.js).

This should unblock meow without further changes, and any other
package that imports a sibling JSON file directly. Will re-test
meow after the rebuild.

## Wave 2 — done at 32/32

Categories at end of sweep (some packages double-counted in
summary.tsv because the canary `nanoid` run preceded the wave-2
list which also includes nanoid):

- **OK (23 distinct)** — nanoid, phin, fs-extra, glob, chokidar,
  minimatch, uuid, pino, p-queue, p-retry, p-limit, async, ora,
  cli-progress, ajv, validator, pug, ejs, date-fns, dayjs,
  through2, pumpify, multistream, JSONStream
- **BigInt gap (2)** — superagent (via cuid2), make-fetch-happen
  (via ip-address)
- **Subpath JSON resolution (1)** — meow (via
  spdx-license-ids/deprecated) — **fixed this pass**
- **SM45 lazy-parse trap (1)** — luxon (object-rest destructuring
  inside a function body got past the parse-failure fallback
  because SM45 lazy-parsed the wrapper). **Root cause found and
  fixed this pass.** Also explains the transient yup REQUIRE_FAIL
  earlier (yup retried manually and worked once the warm cache
  exercised its dependencies eagerly).
- **Engine refusal (1)** — yargs@17 (yargs-parser throws on Node
  <12 at module load) — userland; document
- **Peer dep absence (1)** — request-promise-native (no `request`
  installed) — user pattern; document
- **npm install flakes (2)** — got@11 (`cb() never called`),
  inquirer@8 (`read errno 54`) — retry-able

## v1.0 scope decided

Four runtime fixes land in v1.0, plus the http2 throwing stub:

1. **Proto-warning filter** — [`src/main.cpp:32`](../../../src/main.cpp). Silence
   the SM45 `[[Prototype]]` mutation warning by default; opt-in via
   `IONPOWER_TRACE_PROTO_WARN=1`. Cleans up startup output for
   express, path-to-regexp, graceful-fs, etc.
2. **Subpath `.json` resolution** — [`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp).
   `TryModuleExtensions` now probes `<base>.json` between `.cjs`
   and the package.json `main` lookup. Unblocks meow →
   spdx-license-ids/deprecated.
3. **Disable lazy parsing** — [`src/main.cpp:73`](../../../src/main.cpp).
   `CompartmentOptions::setDisableLazyParsing(true)`. SM45's lazy
   parser had been accepting the `(function (exports, ...) { ... })`
   require wrapper at compile time and deferring the body parse
   until call time, past our Babel parse-failure fallback. Eager
   parsing trades a small startup cost for "every parse error
   hits the fallback." Unblocks luxon (object-rest destructuring)
   and likely many other modern-syntax packages.
4. **http2 throwing stub** —
   [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp).
   `require('http2')` returns an object whose entry points throw
   with a clear pointer at the workaround. Top-level
   `var http2 = require('http2');` in axios@1.x and got@11 now
   succeeds. `module.builtinModules` also expanded to include
   the real built-ins we ship (http, https, http2, net, tls,
   dgram, url, zlib).

Smokes added (all in `scripts/test-list-core.txt`):

- [`test/proto_warning_filter_smoke.js`](../../../test/proto_warning_filter_smoke.js) — child-process; asserts default-off, env-on.
- [`test/require_subpath_json_smoke.js`](../../../test/require_subpath_json_smoke.js) — synthetic package with `deprecated.json` at root.
- [`test/babel_lazy_parse_fallback_smoke.js`](../../../test/babel_lazy_parse_fallback_smoke.js) — direct `const { a, ...rest } = opts;` trigger.
- [`test/http2_stub_smoke.js`](../../../test/http2_stub_smoke.js) — load, throw, constants, builtinModules.

## Out of v1.0 scope (documented as known gaps)

- **BigInt** — modern packages (cuid2, ip-address) use `8n` /
  `0n` literals and `BigInt(...)` constructor. SM45 has no
  BigInt primitive. Polyfilling is non-trivial (the JS type
  itself is missing, not just the syntax). Document the gap;
  affected packages: anything that does large-integer math
  (UIDs, IPv6, hashes, crypto).
- **yargs@17** — yargs-parser throws at module load when
  `process.version` is `<12`. We report 10.24.1 to match the
  Node API surface; lying about the version would break dozens
  of other detection patterns. Pin yargs@^16 or earlier.
- **request-promise-native** — peer-deps not auto-installed by
  npm 6; user must `npm install request request-promise-native`.
  The package is itself deprecated by upstream.



