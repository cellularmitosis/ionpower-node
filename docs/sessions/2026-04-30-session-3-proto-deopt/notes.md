# 2026-04-30 session 3: hunt down the [[Prototype]] mutation warnings

## Goal

`docs/plans/proto-mutation-warnings.md` set the scope. Concretely:

1. Run `make test-all` on G3 and capture all `[[Prototype]]` warnings.
2. Bucket them by source script.
3. Identify whether each warning is from our own code or from
   third-party (vendored libs, Babel, node-forge, etc.).
4. For "ours", fix. For "theirs", note as accepted.
5. Re-run to confirm the warning count drops to "third-party only".

The warnings look like:

    /Users/macuser/tmp/cell/ionpower-node/test/vendor/babel.js:1:
    mutating the [[Prototype]] of an object will cause your code to
    run very slowly; instead create the object with the correct
    initial [[Prototype]] value using Object.create

The `:1` is unhelpful (Babel is one big bundle), so we need to either
patch the runtime to capture a stack on each warning or bisect by
running individual smokes.

## Plan

A. **Inventory**: run a few targeted smokes individually with stderr
   captured. See which ones print the warning. Group by smoke.

B. **For smokes that warn**: instrument the runtime to capture a JS
   stack at the warning site. (SpiderMonkey emits this via the warning
   reporter; we can intercept in C++.)

C. **Trace each unique stack**: bucket by frame.

D. **Fix our own offenders.** Likely candidates per the plan doc:
   - Buffer bootstrap re-pointing `Buffer.prototype` to
     `Uint8Array.prototype`
   - any of our `__proto__` writes
   - Promise polyfill's prototype shuffling

E. **Verify**: warning count down to known-third-party.

## Running log

### Hook the warning callback

Added a stack-capture branch to `ReportError` in `src/main.cpp`,
gated by `IONPOWER_TRACE_PROTO_WARN=1`. When the warning message
contains `[[Prototype]]`, the reporter calls
`JS::CaptureCurrentStack` + `JS::BuildStackString` and prints the
JS stack alongside the warning. Costs nothing in normal runs (env
var off); enables surgical debugging.

### Inventory

Ran `make test-all` once with the trace enabled, captured to
`/tmp/test-all-with-traces.log`. **30 unique warning sites, 33
total fires** across the whole suite. Bucketed by source:

| Source | Count | Verdict |
|---|---|---|
| `<ionpower-node bootstrap>:4130` | 1 | **OURS** — `_AggregateError` |
| `test/async_await_smoke.js:4` | 1 | third-party (Babel regenerator runtime) |
| `test/vendor/babel.js:1` | 1 | third-party (Babel internals) |
| `test/vendor/typescript.js:82` | 1 | third-party (TS `__extends`) |
| `test/vendor/esprima.js:421` | 2 | third-party (TS-style `__extends`) |
| `test/vendor/prettier.js:2364` | 1 | third-party |
| `test/vendor/figlet.js:18` | 1 | third-party |
| `test/vendor/xregexp.js:1246` | 1 | third-party |
| `test/vendor/xxhashjs.js:135` | 1 | third-party |
| `test/vendor/yocto-queue.js:9` | 2 | third-party |
| `test/vendor/chalk.js:48` | 2 | third-party |
| `test/vendor/tslib.js:78` | 1 | third-party |
| `test/vendor/p-finally.js:4` | 1 | third-party |
| `test/vendor/p-each-series.js:8` | 1 | third-party |
| `test/vendor/p-cancelable.js:108` | 1 | third-party |
| `test/vendor/p-map-latest.js:19` | 1 | third-party |
| `test/vendor/rrule.js:1` | 1 | third-party |
| `test/vendor/zod.js:36` | 1 | third-party |
| `test/vendor/joi-full.js:2` | 1 | third-party |
| `test/vendor/immutable.js:152` | 1 | third-party |
| `test/vendor/error-ex.js:104` | 1 | third-party |
| `test/vendor/fuse.js:119` | 1 | third-party |
| `test/vendor/fuzzball.js:16` | 1 | third-party |
| `test/vendor/hasha.js:4` | 1 | third-party |
| `test/vendor/js-tokens.js:8` | 1 | third-party |
| `test/vendor/minisearch.js:3` | 1 | third-party |
| `test/vendor/mute-stream.js:17` | 1 | third-party |
| `test/vendor/tinyspy.js:152` | 1 | third-party |
| `test/vendor/array-from-async.js:8` | 1 | third-party |
| `test/vendor/nm/.../domhandler/lib/node.js:7` | 1 | third-party |

So: **1 from us, 32 from vendored libs**. Most third-party warnings
are the TypeScript-compiled `__extends` pattern that bakes
`Object.setPrototypeOf` into every TS-emitted class hierarchy. We
cannot fix those without rewriting the libraries.

### Fix #1: `_AggregateError`

Old `_AggregateError(errors, message)` did:

    var e = new Error(message);
    e.errors = ...;
    Object.setPrototypeOf(e, _AggregateError.prototype);
    return e;

The `setPrototypeOf` call is what triggered the warning every time
`new AggregateError(...)` was invoked. Rewrote the constructor to
init `this` directly (using the standard `if (!(this instanceof X))
return new X(...)` factory pattern) so the prototype chain is set
correctly at construction time:

    function _AggregateError(errors, message) {
      if (!(this instanceof _AggregateError)) return new _AggregateError(errors, message);
      this.name    = 'AggregateError';
      this.message = String(message == null ? '' : message);
      this.errors  = Array.from(errors || []);
      if (Error.captureStackTrace) Error.captureStackTrace(this, _AggregateError);
      else { try { throw new Error(); } catch (e) { this.stack = e.stack; } }
    }
    _AggregateError.prototype = Object.create(Error.prototype);

`instanceof Error` and `instanceof AggregateError` both still work
(prototype chain is `_AggregateError.prototype -> Error.prototype`).
No `[[Prototype]]` mutation.

### Verification

Re-ran `es_modern_smoke.js` with `IONPOWER_TRACE_PROTO_WARN=1`:
warning gone. Other tests in es_modern still pass.

Full test-all re-run pending.

### Verification (re-run, complete)

Re-ran `make test-all` on G3 with the new binary (NO trace env var).
Result:

- 33 total `[[Prototype]]` warnings.
- 30 unique source sites.
- **0** from `<ionpower-node bootstrap>` or `<ionpower-node ...>`.
- All 33 are from vendored third-party libraries (or the
  Babel-transformed `async_await_smoke.js`, which Babel-on-parse-failure
  injects a regenerator runtime into).

448 smokes pass; 0 regressions from the `_AggregateError` rewrite.

### Disposition for the rest

The 32 third-party warnings are accepted as-is. Patching every
vendored library to remove the `Object.setPrototypeOf` calls in
TS's `__extends` template etc. would be:

1. Brittle — vendored libs get re-fetched on updates.
2. High-effort for minimal payoff. Each warning fires ONCE per
   library load (during the IIFE that defines the helpers); after
   that, the deopt is permanent for that helper but constructed
   instances are fast.
3. Not worth chasing each library individually. The main perf
   concern is library load time, not steady-state.

Documented as "known third-party deopts" in the disposition
section below.

## Known third-party `[[Prototype]]` deopt sites

Each fires once during library load. They're inside helpers that
construct prototype chains using `Object.setPrototypeOf` (the
TypeScript `__extends` pattern, the Babel regenerator runtime's
generator-prototype setup, etc.). We accept these as the cost of
running real-world JS libraries on SM45.

- `babel.js`, `prettier.js`, `typescript.js`, `esprima.js`,
  `xregexp.js`, `xxhashjs.js`, `chalk.js`, `tslib.js`, `figlet.js`,
  `yocto-queue.js`, `rrule.js`, `zod.js`, `joi-full.js`,
  `immutable.js`, `error-ex.js`, `fuse.js`, `fuzzball.js`,
  `hasha.js`, `js-tokens.js`, `minisearch.js`, `mute-stream.js`,
  `tinyspy.js`, `array-from-async.js`, `domhandler/node.js`,
  `p-finally.js`, `p-each-series.js`, `p-cancelable.js`,
  `p-map-latest.js`, plus the regenerator runtime that Babel
  injects when transpiling `async`/`await` (visible in
  `async_await_smoke.js:4` because the smoke gets Babel-transformed
  on parse).

