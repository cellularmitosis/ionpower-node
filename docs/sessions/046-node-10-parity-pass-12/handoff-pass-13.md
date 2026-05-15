# Session handoff: Node 10 parity, pass 13

## Read first

1. [`notes.md`](notes.md) — pass-12 narrative. Three small fixes
   (`require.cpp` `FindTopLevelMainKey`, `fs.promises.read/write`
   shape, `process.binding('uv').errname`) plus end-to-end validation
   of the `demos/express-chat-npm/` headline demo on real PowerPC.
2. [`release-notes/v0.98.md`](release-notes/v0.98.md) — what shipped.
3. [`build-logs/`](build-logs/) — per-host build + test output plus
   `express-chat-npm-smoke.log` (the 7-check client run against the
   npm-installed server on G3).

## Context in one paragraph

Through v0.98 we have the runtime hosting arbitrary Node-10-era
modules from npm — Express, body-parser, depd, ws, handlebars, the
whole closure — and a real demo running on hardware to prove it. The
runtime is "good enough" for many real applications. The remaining
known-unsafe areas are (1) ES2018+ surface that Babel-on-parse-error
doesn't lower out of the box (express@5 + similar), (2) ad-hoc
package gaps that surface only when you try a new dep, and
(3) cosmetic warnings that don't affect correctness.

## Punch list — pass 13

### A. Survey of common Node-10-era packages

Pick ~10 popular packages and try `npm install <pkg>` +
`require(<pkg>)` for each. Goal: build a list of which ones load
clean, which ones load with warnings, which ones fail. Candidates:

- `lodash` (no transitive deps, just utility functions)
- `axios` (we have axios via the vendor tree as `test/vendor/axios.js`;
  the npm version may diverge)
- `chalk` (terminal colors — ESM-only in recent versions, so v4 is
  the last CJS line)
- `commander` (CLI parsing)
- `debug`
- `dotenv`
- `node-fetch` (we have fetch built in, but node-fetch's
  AbortController integration is a known sharp edge)
- `bluebird` (Promise replacement — already exercised by npm itself
  in pass 12, so it works, but worth confirming directly)
- `winston` (logging)
- `joi` (validation)

For each: write a one-line line into
`docs/sessions/047-.../survey.md` with the result and a pointer to
the actual error message if it failed.

### B. express@5 attempt

Last attempt in pass 11 / 12 was deferred. The two known blockers:

1. Object spread `{ ...a, ...b }` at parse time —
   `__try_babel_transpile__` with `targets: { ie: '11' }` *should*
   lower these. Verify by actually running it.
2. Class private fields `#name` — Babel preset-env *can* lower these
   but only with the `@babel/plugin-proposal-class-properties` plugin
   wired in. We don't have it in `__try_babel_transpile__`. Look at
   what `vendor/babel.js` ships and decide whether to add the plugin
   or just declare express@5 out of scope.

### C. Prototype-mutation warning suppression

`node_modules/express/lib/router/index.js:51` runs
`proto.__proto__ = Function` at module load, and SM emits the
"mutating the [[Prototype]] of an object will cause your code to run
very slowly" warning. Suppressing it cleanly is harder than it looks
— SM emits the warning via the JSAPI error reporter, not via
`console.warn`, so it's not catchable from JS. The easiest path is
to filter that exact message string out of our error reporter in
`src/main.cpp`. Not high-priority unless it visibly annoys somebody.

### D. Survey-driven follow-ups

Whatever item A surfaces — wire fixes into v0.99 / v1.0 once you've
got a clear picture. If lodash works clean, that's a great win to
document; if chalk@4 breaks on something subtle, that's a fix to
land.

## Working order

1. Read `notes.md` + `release-notes/v0.98.md`.
2. **A first** — broaden the survey. We've been deep on Express;
   widening to lodash/chalk/commander/etc. gives a much better
   picture of what works and what doesn't.
3. **B** is contained — half-hour attempt, see what blows up,
   document, move on.
4. **C** is cosmetic; do it last or skip.

## Notes / scratch

- `/Users/macuser/tmp/express-chat-npm-test/` on G3 has a working
  full install of express@4.22.2 + handlebars@4.7.8 + ws@7.5.10 plus
  the demo source. ~25 MB. Don't blow it away — same reasoning as
  pass-10's express-discovery dir.
- `npm install <pkg>` from the live registry on G3 takes 1-5 minutes
  per closure; the gunzip + crypto bottleneck. Be patient.
- Run from `/Users/macuser/tmp/` not `/tmp/` since `/tmp/` gets
  reaped on reboot.

## ibookg37 note

Up the whole pass-12 session (no spontaneous reboots — the host's
been stable for two sessions running). The mSATA swap is still on
the todo but not urgent.
