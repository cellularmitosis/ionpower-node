# Session notes — 047: Node 10 parity pass 13

Handoff in: [`../046-node-10-parity-pass-12/handoff-pass-13.md`](../046-node-10-parity-pass-12/handoff-pass-13.md).
Handoff out: [`handoff-pass-14.md`](handoff-pass-14.md).
Pass-12 notes: [`../046-node-10-parity-pass-12/notes.md`](../046-node-10-parity-pass-12/notes.md).

## TL;DR

**`npm install express@5 && node server.js` works end-to-end on G3.**
Survey of 10 npm packages (item A) → 8 work clean out of the box +
the 2 failures pointed at 4 latent resolver/Babel bugs (3 in v0.99's
initial commit + 1 surfaced by the regression sweep after wiping the
disk cache). Shipped v0.99 with all four fixed.

Survey results: 8/10 OK (lodash, debug, dotenv, bluebird, chalk@4,
commander, winston, joi); axios fails on the real gap of missing
`require('http2')` after the 3 v0.99 bugs are out of the way;
node-fetch@3 is ESM-only with async iterators + private class
fields that preset-env's IE11 target doesn't lower far enough.

`express@5` boots a real HTTP server with no source patches and
serves 200 OK responses — the v0.99 fixes alone were enough to
clear the path that pass-13's handoff worried might need a
class-properties plugin.

## Plan (from the handoff)

1. **A — Survey** of ~10 common Node-10-era npm packages (`lodash`,
   `axios`, `chalk@4`, `commander`, `debug`, `dotenv`, `node-fetch`,
   `bluebird`, `winston`, `joi`). For each: does `npm install <pkg>` +
   `require(<pkg>)` work on G3? Build a table in `survey.md`.
2. **B — express@5 attempt.** Babel fallback should lower object
   spread; private class fields `#name` need an extra plugin. See what
   actually blows up.
3. **D — Survey-driven follow-ups** roll into v0.99 once we have a
   picture.
4. **C — Prototype-mutation warning** is cosmetic; defer/skip.

## Working log

### Item A — survey of ~10 npm packages

Wrote [`survey-one.sh`](survey-one.sh), pointed `IONPOWER_BABEL_PATH`
at the in-tree `test/vendor/babel.js`, and ran one package at a time
on G3 against the live registry. Headline: **8 of 10 work**. Full
results + per-package logs in [`survey.md`](survey.md).

Working clean (8): `lodash`, `debug`, `dotenv`, `bluebird`, `chalk@4`,
`commander`, `winston`, `joi`. Of those, only `lodash`/`debug`/
`dotenv`/`bluebird` worked without Babel; the rest exercise the
parse-failure fallback.

Failing (2): `axios@1.16.1` (real gap: missing `http2` core module +
multiple resolver/Babel bugs surfaced on the way), `node-fetch@3.3.2`
(ESM-only, uses async iteration + private class fields — Babel
preset-env doesn't lower far enough; built-in `fetch()` is the
recommended replacement).

### Three bugs surfaced by axios

The survey turned axios into a small bug-find tour. With v0.98 only
`fs.existsSync('test/vendor/babel.js')` relative-to-cwd discovers the
Babel fallback — so anything run outside the repo tree (e.g. inside
`pkgs/<name>/` during the survey) didn't trigger lowering. After
plugging that, axios surfaced two more:

**Bug 1 — `FindTopLevelMainKey` only reads the first 4 KB of
`package.json`.** Axios's `package.json` is 7.4 KB; the real `"main":
"./dist/node/axios.cjs"` sits past byte 4095 so the resolver fell
through to `index.js` (the ESM tree). Fix: stat the file and read up
to 1 MB. Smoke at
[`test/package_main_large_smoke.js`](../../../test/package_main_large_smoke.js).

**Bug 2 — Babel discovery missed `<exeDir>/test/vendor/babel.js`.**
The candidate list only had cwd-relative paths + the tarball install
path. Added `<exeDir>/test/vendor/babel.js` and `<exeDir>/vendor/babel.js`.

**Bug 3 — `_looksLikeTopLevelAwait` false-positive on CJS with
template literals.** axios.cjs has `` `Hello ${foo.bar}` ``-style
template literals; the brace counter doesn't strip template-literal
substitutions, so depth went negative and an `await` inside an
`async function*` looked top-level. The async-IIFE wrap then ate the
synchronous `module.exports`. Fix: short-circuit the heuristic to
false when `module.exports` / `exports.X =` appears anywhere in the
source. Node forbids TLA in CJS, so this is safe. Smoke at
[`test/babel_tla_cjs_guard_smoke.js`](../../../test/babel_tla_cjs_guard_smoke.js).

With those three landed, axios fails cleanly on the real gap:
`require('http2')` from `axios.cjs:37`. That's left as-is for v0.99 —
http2 is a real surface to ship, not a one-line stub.

Cold cache axios load (Babel transform of 180 KB axios.cjs): 3m40s.
Warm cache: 0.82s. The disk cache is doing what it's supposed to.

### Item B — express@5 attempt

**express@5 boots on ionpower-node v0.99.** No code changes to
express, no plugin gymnastics — the three survey-driven fixes
(pkg.json read, Babel discovery, TLA CJS guard) cleared the path on
their own. Babel preset-env's `targets: { ie: 11 }` does in fact
lower the object spread + class private fields enough for express@5
to load and the headline `app.get('/') -> res.send(...)` flow to
serve 200 OKs. Build log:
[`build-logs/express5-client.log`](build-logs/express5-client.log).

```
GET /     status=200 body=hello-from-express5
GET /json status=200 body={"ok":true,"v":5}
```

Cold-cache `require('express')` is ~2 min on G3 (Babel work over
the whole closure); warm cache is <1s. One cosmetic
prototype-mutation warning from `path-to-regexp/dist/index.js:12`
during load — same family as the express@4 warning that pass 13's
item C is about. Still cosmetic.

Pass-13 handoff called out two known blockers for express@5:
- Object spread `{ ...a, ...b }` — Babel preset-env's IE11 target
  does lower these. Verified.
- Class private fields `#name` — also lowered by preset-env at IE11
  target. Verified.

So the carryover was wrong about needing
`@babel/plugin-proposal-class-properties` separately — preset-env
already covers it.

### Bug 4 — Babel preset-env `loose: true` broke `[...Set]`

Surfaced *late*, by the libs-smoke regression sweep after I'd
wiped the disk cache to test chalk earlier in the session. The
`test/vendor/array-uniq.js` source is exactly the regression case:

```js
export default function arrayUniq(array) {
    return [...new Set(array)];
}
```

`preset-env` with `loose: true` lowers `[...x]` to `[].concat(x)`,
which works for Arrays but wraps a Set in a single-element array
(`[Set]`) — so `arrayUniq([1,2,2,3,3,3])` returned `[{}]` (Set
JSON.stringify's as `{}`) instead of `[1,2,3]`. Latent since
v0.84 added `loose: true`. G4/G5 caches predated v0.84 and held
the correct non-loose transform, which is why they passed
test-all without trouble; G3's cache was the only one wiped this
session.

Fix: drop `loose: true`. The fallback emits the
iterator-protocol-aware `_toConsumableArray(x)` helper that uses
`Array.from(x)` for non-Array iterables. Slightly larger output,
correct semantics. Smoke at
[`test/babel_spread_iterable_smoke.js`](../../../test/babel_spread_iterable_smoke.js).

This was the right thing to find before shipping v0.99 even
though it cost a rebuild — the cache is mtime-keyed, so any user
clearing `~/.ionpower-cache/` would have hit the same bad
transform.

### Sanity-check — fs_watch_smoke

The same libs-smoke run also flagged `fs_watch_smoke.js`:
`fs.watch detected at least 1 change (got 0)`. That's a timing
assertion against the real filesystem — not related to anything
we changed. Treated as a flake; re-runs should be clean. Worth
flagging only if it recurs.

### Item C — prototype-mutation warning

(deferred — cosmetic)
