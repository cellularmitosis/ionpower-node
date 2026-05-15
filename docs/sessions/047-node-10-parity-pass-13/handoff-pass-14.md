# Session handoff: Node 10 parity, pass 14

## Read first

1. [`notes.md`](notes.md) — pass-13 narrative. Started as a survey of
   ~10 top Node-10-era npm packages, turned into a four-bug bug-find
   tour that unlocked `express@5` end-to-end with no source patches.
2. [`survey.md`](survey.md) — the survey itself: 8 of 10 packages
   work clean (lodash, debug, dotenv, bluebird, chalk@4, commander,
   winston, joi); the two that fail surfaced the actual bugs.
3. [`release-notes/v0.99.md`](release-notes/v0.99.md) — what shipped.
4. [`build-logs/`](build-logs/) — per-host build + test output, plus
   `express5-client.log` (the `npm install express@5 && node
   server.js` end-to-end on G3) and `survey-logs/` (per-package).

## Context in one paragraph

v0.99 is the most surprisingly-impactful pass in a while. The
explicit punch-list item was "survey N popular packages." Doing that
exposed three resolver/Babel discovery bugs that, taken together,
were quietly costing us packages whose syntactic surface we already
*support*. Plugging them unblocked `express@5` end-to-end with zero
plugin gymnastics. The *fourth* bug — `preset-env` `loose: true`
mis-lowering `[...new Set(...)]` — had been latent since v0.84;
G4/G5 caches predated v0.84 and held the correct non-loose output,
which is why nobody noticed. Wiping G3's cache to debug chalk during
this session is what surfaced it.

## Punch list — pass 14

### A. `require('http2')` — the next real Node API gap

This is what stops `axios@1.x` on the survey path (after the v0.99
fixes get axios as far as `axios.cjs:37`). Likely also blocks
`got`, `undici`, and any other HTTP/2-aware HTTP client. Two
approaches:

1. **Throwing stub** — register `http2` as a built-in that returns
   `{}` (or throws on use). `axios.cjs`'s `var http2 =
   require('http2');` would succeed; only code that actually opens
   HTTP/2 sessions would fail. Probably enough for the 95% case.
2. **Real shim** — wrap our existing TLS layer to expose the
   minimum http2 API axios uses: `http2.connect(authority, opts)`,
   `session.request(headers)`, `req.on('response')`,
   `req.on('end')`. Larger surface. Defer until something other
   than axios needs it.

Recommendation: ship (1) plus a note that `axios@^0.27` is the
recommended pin for HTTP/1.1-only environments.

### B. Survey-wave 2 (50 more packages)

The v0.99 survey was 10 deliberately-popular packages. Worth
broadening to another 30-50 from npm's top-downloads list to see
what else is just-working-but-undocumented. Candidates:

- HTTP clients: `got@11`, `superagent`, `request-promise-native`,
  `phin`, `make-fetch-happen`
- Util: `fs-extra`, `glob@8`, `chokidar@3`, `minimatch`, `nanoid`,
  `uuid@8`, `pino@6`
- Async: `p-queue@6`, `p-retry@4`, `p-limit@3`, `async`
- Build/CLI: `meow@9`, `yargs@17`, `inquirer@8`, `ora@5`, `cli-progress`
- Data: `ajv@8`, `joi` (re-confirm), `yup`, `validator`
- Templating: `handlebars` (re-confirm), `pug`, `ejs`
- Datestamp: `date-fns`, `dayjs`, `luxon`
- Streams: `through2`, `pumpify`, `multistream`, `JSONStream`

Run with the `survey-one.sh` flow already shipped in v0.99 (see
`docs/sessions/047-.../survey-one.sh`). Capture per-package logs,
then group failures by root cause to decide v1.0 punch list.

### C. Item C from pass 13: prototype-mutation warning

Express (4 and 5) both emit the SM45 warning
`mutating the [[Prototype]] of an object will cause your code to
run very slowly` at module load. SM45 emits this via the JSAPI
error reporter, not `console.warn`, so it's not catchable from JS.
The fix is in `src/main.cpp`'s error reporter — filter that exact
string. Single regex match; small change. Still cosmetic — defer
unless you're chasing a "zero startup warnings" goal.

### D. Re-fill survey gaps that are now in scope

With v0.99's resolver fixes:

- `axios@1.x` reaches the http2 gap (was blocked further upstream
  on three separate bugs). Fixing http2 (item A) unlocks it.
- `node-fetch@3` is still gated on private class fields + async
  iteration that preset-env doesn't lower out of the box. Could
  add `@babel/plugin-proposal-class-properties` +
  `@babel/plugin-proposal-async-generator-functions` to the Babel
  config; need to check whether `@babel/standalone` includes them
  (it does, but presets-vs-plugins wiring needs checking).

## Working order

1. Read `notes.md` + `survey.md` + `release-notes/v0.99.md`.
2. **Survey wave 2 first.** Until we have the data, item A is
   speculative — maybe http2 turns out *not* to be the next gap.
3. **Then A or C**, depending on what wave 2 surfaces.
4. **B as a single bundled v1.0 release** if it shapes up that way,
   or split into v1.0/v1.1 if the surface is bigger than expected.

## Notes / scratch

- `/Users/macuser/tmp/survey-047/` on G3 still has the 10
  packages from pass 13 (lodash, axios, etc.) — handy if you want
  to re-confirm a specific failure mode without paying the install
  cost again. Same logic for `/Users/macuser/tmp/express5-attempt/`
  (the 66-package express@5 closure).
- The Babel disk cache at `~/.ionpower-cache/babel-v1/` on G3 is
  now fresh (~900 entries from the pass-13 sweep). DO NOT WIPE
  unless you want a ~45-min smoke run; warm cache makes the same
  sweep finish in ~20 min.
- Each cold-cache `require('axios')` is ~3.5 min; cache-warmed,
  <1s. If iterating on http2 shim work, get the cache populated
  first so you're not waiting on Babel each round.
- The hardware: G3 (ibookg37, 900 MHz iBook) is still up and
  stable. mSATA swap not yet done — still no symptom on the
  current HDD, but the prior session noted it's failing slowly.

## ibookg37 note

Stable for the entire pass-13 session (no banner-hang reboots, no
mid-run process death). HDD still on borrowed time; mSATA swap
still on the todo. Don't change it unless you've got time budget
for "the host disappears for 4 hours."
