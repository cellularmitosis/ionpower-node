# Session handoff: Node 10 parity, pass 7

## Read first

In order:

1. [`notes.md`](notes.md) — full pass-6 narrative. Three stream-
   contract fixes landed (IM paused/flowing, gunzip buffer-until-
   listener, stdio wrapped as Writable). v0.92 shipped against the
   triad. registry-based `npm install <name>` is still NOT working
   end-to-end despite all three fixes — that's the pass-7 entry
   point.
2. [`release-notes/v0.92.md`](release-notes/v0.92.md) — what
   shipped, with the explicit "what's still pending" callout for
   the figgy-config / pacote hang.
3. [`build-logs/probe-narrowing-v0.91.txt`](build-logs/probe-narrowing-v0.91.txt)
   and the pass-6 `notes.md` "A3 re-verification" section — context
   on the chain of probes that narrowed the IM and gunzip bugs.
   Pass 7's investigation will build on this style.

## Context in one paragraph

v0.92 closed three layers of "stream emits to a not-yet-attached
listener" bugs that pass-5's TLS work needed to be useful:
`_IncomingMessage` (the byte drop right after `'response'`),
`zlib.createGunzip()` (the setImmediate emit racing the Promise
microtask), and `process.stdout`/`stderr` not being
`instanceof Stream` (which broke npm's config validator → cascade
into Gauge throwing TypeError → npm.load never completing). With
all three baked into globals.cpp, npm.load now completes cleanly
AND a direct `pacote.manifest(spec, simpleOpts)` returns the
manifest end-to-end against `registry.npmjs.org/left-pad`. BUT the
real `npm install <name>` path still hangs at "cb() never called!"
after `silly install readLocalPackageData`. The hang surfaces only
when pacote gets opts from `figgy-config` (`Promise: BB`,
`cacheManager`, `agent`, retry settings, etc.) — i.e. the full npm
config bundle. Picking up that investigation is the pass-7 entry
point.

## Scope

### A. Root-cause the figgy-config / pacote hang

This is the strategic remaining capability for finishing the
registry-based-install goal that pass-5/6 have been working toward.

What we know:

- npm.load completes cleanly (after the v0.92 stdio-Stream wrap).
- `silly install loadCurrentTree` fires.
- `silly install readLocalPackageData` fires.
- Then nothing for ~10-12 s.
- "cb() never called!" — npm's drain watchdog.

What we've ruled out:

- TLS layer (pass-5).
- Basic IncomingMessage / Promise / data-listener pattern (pass-6
  v0.92 fixes; isolated probes pass).
- gzip / gunzip decompression on the response (pass-6 fix).
- `fs.stat` for the cwd-relative `<name>/package.json` lookup
  (works).
- `mkdirp` + `readPackageTree` + `readShrinkwrap` in
  `lib/install.js:readLocalPackageData` (each works in isolation).
- `pacote.manifest(spec, simpleOpts)` with a hand-built simple
  opts object — succeeds.

What probably triggers it:

- `pacote.manifest(spec, figgyConfigOpts)` HANGS. figgyConfigOpts
  carries `Promise: BB`, `cacheManager: <path>`, `agent: ...`,
  `retry`, `timeout`, etc.
- The Promise/figgy/bluebird interop OR one of the http-layer
  options (proxy/agent/retry) is silently swallowing a callback.

Suggested narrowing approach (mirrors pass-6 probe style):

1. Start from `probe-fpm-noBB.js` shape:
   `pacote.manifest(spec, npmConfig({...}).concat({...overrides...}))`.
2. Bisect: try `.concat({Promise: Promise})` (rule out bluebird) —
   done in pass-6, didn't fix.
3. Try `.concat({cacheManager: false, cache: false})` — done,
   didn't fix.
4. Try `.concat({agent: false})` — NOT tried in pass-6. The agent
   is built by `make-fetch-happen/agent.js` from npm config; might
   be doing something with keepalive sockets that hangs our http
   layer.
5. Try `.concat({retry: {retries: 0}})` — rule out retry layer.
6. Try `.concat({timeout: 1000})` — see if a short timeout fires
   the error path (would prove the chain CAN fail, just not
   succeed).
7. If still hung, instrument `make-fetch-happen/index.js`
   `remoteFetch` to log per-attempt — does the http request even
   issue?

The pass-6 monkey-patch trial workflow is the right tool: load
the patched node, run npm install in trace mode
(`/tmp/run-npm-trace-all.js`), and watch where it stops emitting.

### B. (Stretch) demos/npm-install/ update

[`demos/npm-install/`](../../../demos/npm-install/) was added in
pass-5 with the local-tarball install demo. Once A lands, extend
it to demonstrate `npm install left-pad --registry=...` from the
real registry. That's the customer-facing demo for
"Node-on-PowerPC for real".

### C. (Stretch) full conformance against Node 10 streams test
suite

Pass-6 fixed three stream-contract issues. There are almost
certainly more — the `_Stream` / `_Readable` / `_Writable` /
`_Transform` chain in globals.cpp is a hand-rolled approximation
of Node's stream contract. If we ever want robust npm /
tar-pipeline / browser-fetch-equivalent support, a real
conformance pass against `node/test/parallel/test-stream-*` would
turn up more.

This is bigger than pass 7. Maybe pass 8+.

## Working order

1. Read the three "Read first" docs.
2. **A.** Bisect through figgy-config opts to find the one that
   makes pacote.manifest hang. Once isolated, find the bug in our
   runtime (likely in agent / proxy / retry / timeout interop) and
   fix.
3. **B.** Extend `demos/npm-install/` once A works.
4. Triad-build v0.93.

## Risk / blast radius

A: Probably another stream/event contract issue — same shape as
pass-6 fixes. Low risk to the runtime. Same probe-narrowing
discipline applies.

B: Demo-only. Risk near zero.

## Current runtime state (start of pass 7)

- v0.92 shipped (assuming the pass-6 triad-builds complete green
  and the release goes out): 472/472 across G3 + G4 + G5.
- Tarballs at `/tmp/v0.92-release/` locally; uploaded as v0.92
  GitHub release assets.
- `/opt/ionpower-node-0.92/bin/node` installed on G3 / G4 / G5
  with the full pass-6 changeset.
- VERSION in repo is `0.92`. Bump to `0.93` as the first pass-7
  edit (or leave at `0.92` if not cutting a release).
- The pacote-direct probe `/tmp/probe-pacote.js` on ibookg37 still
  works. The figgy-config one `/tmp/probe-fpm-noBB.js` still
  hangs. Good starting reference state.

## Quick references

- pass-6 notes:
  [`notes.md`](notes.md)
- pass-6 release notes:
  [`release-notes/v0.92.md`](release-notes/v0.92.md)
- The IM fix:
  [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
  search `_IncomingMessage.prototype.emit`.
- The gunzip fix:
  [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
  search `_mkInflateTransform`.
- The stdio-Stream wrap:
  [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
  search `_wrapStdStream`.
- The npm trace wrapper on ibookg37:
  `/tmp/run-npm-trace-all.js` (loads /tmp/run-npm-patched.js's
  monkey-patches are baked in now; the wrapper just adds the
  npmlog dump + process.exit hook).
- Pacote probes:
  `/tmp/probe-pacote.js` (works)
  `/tmp/probe-fpm-noBB.js` (hangs — start here)
