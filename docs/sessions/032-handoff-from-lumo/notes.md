# Session notes — 2026-05-09 session 1: handoff from lumo

Plan: [`plan.md`](plan.md). Source: [`handoff-from-lumo.md`](handoff-from-lumo.md).

Three small additions on top of v0.85, driven by lumo-darwin8-ppc's
Path B bring-up:

1. `require('repl')` stub
2. `require('v8')` stub
3. Babel `transform-logical-assignment-operators` plugin (so `||=`
   `&&=` `??=` lower correctly when Babel-on-parse-failure kicks in)

Item 3 from the handoff (real `vm.runInNewContext` compartment
isolation) deferred — captured in the v0.86 followups.

Checked for parallel sessions: `lsof -p` of every live `claude-code`
process confirmed PID 11838 (this session) is the only one in
`/Users/cell/claude/ionpower-node`. Sister sessions are running
against `golang-darwin8-ppc`, `lumo-darwin8-ppc`, etc. — independent
working dirs.

Bumped VERSION to 0.86 in Makefile, src/node_compat/process.cpp, and
the install snippet in README.md. Left the "660+ as of v0.85"
vendored-lib stamp on README:300 alone — no new libs vendored this
session.

## Item 1: `require('repl')` stub

Seeded `__require_cache__['repl']` in
`src/node_compat/globals.cpp` next to the existing `vm` stub
(line ~6003 in `kBootstrapJS`):

    __require_cache__['repl'] = {
      start: function () { throw new Error('repl not implemented'); },
      REPLServer: function () {},
      Recoverable: function () {}
    };

Also added `'repl'` to `module.builtinModules` so `module.isBuiltin('repl')`
and `module.isBuiltin('node:repl')` both return true.

Smoke: [`test/repl_stub_smoke.js`](../../../test/repl_stub_smoke.js).
Wired into `scripts/test-list-more.txt`.

## Item 2: `require('v8')` stub

Same place. JSON-roundtrip `serialize`/`deserialize` and an opaque
`getHeapStatistics() → {}`. Added `'v8'` to `module.builtinModules`.

Smoke: [`test/v8_stub_smoke.js`](../../../test/v8_stub_smoke.js).
Wired into `scripts/test-list-more.txt`.

## Item 3: Babel `transform-logical-assignment-operators`

Investigation first: confirmed the vendored
`test/vendor/babel.js` (@babel/standalone) already ships this plugin.
A direct test on uranium with homebrew node — call
`babel.transform(source, { presets: [['env', { targets: { ie: '11' },
loose: true }]] })` against a sample with `||=` — does correctly
lower to `b || (b = 'fallback')`. So `preset-env` with `ie: '11'` *is*
pulling the plugin in.

But lumo-d8p session 001 reported the operator still appearing in
output. Most likely root cause: the operator was in code passed
through `(0, eval)(...)` rather than `require()` — and our Babel
fallback hook only runs from the `require()` path. The eval-path
fallback gap is captured in the v0.86 followups.

**Defensive change** to remove any preset-env compat-table dependency
for this specific operator, since it's been observed to bite us once
already: pinned
`plugins: ['transform-logical-assignment-operators']` explicitly in
the `babel.transform` call in `kBootstrapJS`. Closure Library
`:advanced` output sometimes contains a single one of these — this
guarantees we lower it regardless of preset-env's compat decision.

Verified all three operators (`||=` `&&=` `??=`) lower cleanly:

    a || (a = 'x');
    b && (b = 'y');
    (_c = c) != null ? _c : c = 'z';

Smoke: [`test/babel_logical_assignment_smoke.js`](../../../test/babel_logical_assignment_smoke.js)
+ [`test/vendor/logical_assignment_sample.js`](../../../test/vendor/logical_assignment_sample.js).
The sample lives in `test/vendor/` to match the existing
`babel_fallback_smoke.js` / `modern_sample.js` pattern.

## Triad build (G3)

Started `scripts/triad-build.sh ibookg37 g3 0.86` — log at
[`build-logs/ibookg37-triad.log`](build-logs/ibookg37-triad.log).

The local `tee | tail -100` pipe doesn't flush until the run ends, so
during the run we monitor by polling `/tmp/nodesmoke-*` entry count
on ibookg37 directly (`ssh ibookg37 'ls /tmp/nodesmoke-*/ | wc -l'`).
The G3 binary itself built clean — `node` 15.06 MB, all 16 .o
artifacts present at 19:51, no remaining gcc/g++ in flight.

