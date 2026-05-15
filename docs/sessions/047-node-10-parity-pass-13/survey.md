# Survey — popular Node-10-era npm packages on ionpower-node v0.98

Each package was tested on the G3 (iBook G3, ibookg37, ionpower-node
v0.98) via `npm install` from the live registry + `require()` smoke,
using [`survey-one.sh`](survey-one.sh). Per-package logs:
[`build-logs/survey-logs/`](build-logs/survey-logs/). Raw status:
[`build-logs/survey-summary.tsv`](build-logs/survey-summary.tsv).

Headline: **8 of 10 work** out of the box (`require()` returns the
expected exports). The two failures both involve modern ESM source +
core Node features we lack.

## Results

| Package          | Spec installed   | Install | Require  | Notes |
|------------------|------------------|---------|----------|-------|
| `lodash`         | `lodash@4.18.1`  | OK      | OK       | Clean. `typeof === 'function'`, `fnName=lodash`. |
| `debug`          | `debug@4.4.3`    | OK      | OK       | Clean. `typeof === 'function'`, `fnName=createDebug`. |
| `dotenv`         | `dotenv@17.2.3`  | OK      | OK       | Clean. `typeof === 'object'`. |
| `bluebird`       | `bluebird@3.7.2` | OK      | OK       | Two `unreachable code after return` warnings from `util.js:205` (cosmetic, SM45 strictness). |
| `chalk@^4`       | `chalk@4.1.2`    | OK      | OK (Babel) | Source uses object spread `{...styles}`; SM45 parse-fails, Babel lowers it. Took ~0s after first-cache populate. |
| `commander`      | `commander@14.0.3` | OK    | OK (Babel) | Latest commander (v14, declares Node 18+ engines) installed anyway. Requires Babel lowering for `const { … }` destructuring patterns it does internally — succeeds. ~86s on cold cache. |
| `winston`        | `winston@3.18.3` | OK¹    | OK (Babel) | One transient `npm ERR! cb() never called!` on first attempt, succeeded on second. Babel runs over a fair chunk of the dep closure. ~56s require. |
| `joi`            | `joi@18.2.1`     | OK      | OK (Babel) | Heavy Babel work — ~219s require on cold cache. Loads with full keys. |
| `axios`          | `axios@1.16.1`   | OK      | **FAIL** | Two distinct bugs and one real gap — see breakdown below. |
| `node-fetch`     | `node-fetch@3.3.2` | OK    | **FAIL** | Pulls `fetch-blob` which uses async iterators + private class fields. Babel preset-env doesn't lower far enough, and `node-fetch@3` is ESM-only anyway. Workaround: built-in `fetch()` is already wired in v0.96+. |

¹ Failed transiently with `npm ERR! cb() never called!` on first run;
clean on retry. Treated as install-OK.

## What the failures uncovered

### Bug 1 — `FindTopLevelMainKey` only reads the first 4 KB of `package.json`

[`src/node_compat/require.cpp`](../../../src/node_compat/require.cpp)
line ~167:

```c
char buf[4096];
size_t r = fread(buf, 1, sizeof(buf) - 1, f);
```

`axios@1.16.1`'s `package.json` is **7423 bytes**. The top-level
`"main": "./dist/node/axios.cjs"` lives past byte 4095, so the
resolver doesn't find it, falls through to `index.js`, and ends up
loading the ESM source (`lib/...`) instead of the proper CJS bundle
(`dist/node/axios.cjs`). Babel rescues the ESM, but only to
ultimately hit `require('http2')` — see below.

### Bug 2 — Babel discovery misses `<exeDir>/test/vendor/babel.js`

[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
`__babel_lazy_load__()` checks:

1. `IONPOWER_BABEL_PATH` env override.
2. `cwd + '/test/vendor/babel.js'`
3. `cwd + '/vendor/babel.js'`
4. `cwd + '/node_modules/@babel/standalone/babel.js'`
5. `<exeDir>/../share/ionpower-node/vendor/babel.js`

In a tarball install (#5) it works. In a raw git tree (`./node` from
`<repo-root>`, cwd inside `<repo-root>`), #2 works. **In a raw git
tree where cwd is *not* `<repo-root>`** — e.g. `cd /tmp/myapp; <repo>/node`
— none of the candidates match. The survey scripts hit exactly this
case (cwd inside `pkgs/<name>/`).

Workaround used during the survey: set `IONPOWER_BABEL_PATH` in
`survey-one.sh` to point at the in-tree babel.js. Real fix is to add
`<exeDir>/test/vendor/babel.js` to the candidate list.

### Gap — `require('http2')` is not implemented

`axios@1.16.1`'s `dist/node/axios.cjs` (and the ESM `lib/adapters/http.js`)
unconditionally do `var http2 = require('http2');` at top of file.
We don't ship `http2`, so the require fails even if Bug 1 is fixed.

Three options:

a) **Stub** `http2` as an empty/throwing module — axios.cjs would
   load (top-level require succeeds), then crash if user code
   actually tries an HTTP/2 request. Probably enough for the 95%
   case of "axios for HTTP/1.1 GET/POST".
b) **Implement** http2 properly — out of scope for parity pass 13.
c) **Document** the gap. User can `axios@^0.27` (last pre-http2
   axios line, Node-10-era native). That works today (already CJS,
   no http2 import).

Recommendation: combine (a) + (c) — stub http2 so it loads, document
`axios@^0.27` as the recommended pin for full functionality.

### Gap — `node-fetch@3` requires more than Babel preset-env lowers

`fetch-blob/index.js` has:

```js
async function * toIterator (parts, clone = true) { … }
for await (const part of toIterator(this.#parts, false)) { … }
```

The `for await…of` (async iteration) + `#parts` (private class fields)
combination needs `@babel/plugin-proposal-async-generator-functions`
*and* `@babel/plugin-proposal-class-properties`, neither of which our
`@babel/standalone` build pulls in via `targets: { ie: 11 }`.

`node-fetch@2` (CJS) probably works — but we already have a built-in
`fetch()` since v0.96. Recommendation: just document "use built-in
fetch."

## What this tells us

- **The runtime is broadly capable.** lodash, debug, dotenv, chalk,
  commander, winston, joi, bluebird — all standard Node-10-era
  staples — work *out of the box* from the npm registry.
- **Babel fallback is doing real work.** chalk@4, commander, winston,
  joi all fail without it (object spread, destructuring, etc.).
  Bug #2 (Babel discovery) is therefore higher-impact than it looks —
  whenever the runtime can't find babel.js, most modern packages
  silently break.
- **The pkg.json reader has been right "by accident."** Packages
  whose `"main"` field is in the first 4 KB just worked. Bigger
  package.json files (axios is the first we've hit) expose the
  truncation.
- **`http2` is the next compelling Node API to ship.** It's the
  single biggest reason axios fails. Several other Node 10 packages
  almost certainly hit the same wall (got, undici, etc.).

## Follow-ups to fold into v0.99

1. **Fix `FindTopLevelMainKey`** to read the entire `package.json`
   (stat + malloc, or at minimum bump to 64 KB).
2. **Fix Babel discovery** to add `<exeDir>/test/vendor/babel.js` to
   the candidate list so dev-tree usage works without env overrides.
3. **(Stretch) Stub `process.binding('http2')`** or, more simply,
   make `require('http2')` return a throwing-on-use stub so
   `axios@1.x` at least loads.

Items 1 and 2 are tiny. Item 3 is more open-ended — defer if time
runs short.
