# Session handoff: Node 10 parity, pass 8

## Read first

In order:

1. [`notes.md`](notes.md) — full pass-7 narrative. Three layered
   fixes landed (`_ClientRequest` no-socket-end, server-side
   eof-mode immediate-end, IM emit empty-buffer end). v0.93 shipped
   against the triad. **Registry-based `npm install <name>` works
   end-to-end now** — that goal is closed.
2. [`release-notes/v0.93.md`](release-notes/v0.93.md) — what
   shipped, plus the explicit "what's still pending" callout.
3. Pass-6 + pass-7 together turned up *four* stream-contract bugs
   in `_IncomingMessage` (pass-6: paused/flowing + gunzip buffer-
   until-listener + stdio-wrapped-as-Writable; pass-7: emit-end-
   when-buffer-empty). The handwoven `_Stream` / `_Readable` /
   `_Writable` / `_Transform` / `_IncomingMessage` chain in
   `globals.cpp` is leaky enough that **a Node-stream conformance
   pass is probably the highest-leverage next move**.

## Context in one paragraph

v0.93 closes the registry-based-install goal: `node npm-cli.js
install left-pad --registry=https://registry.npmjs.org/` runs to
`+ left-pad@1.3.0` from a cold cacache, and the installed module
works. That goal had been driving passes 5–7. The bigger picture
is now: with TLS solid and the http/streams layer producing real
results, the remaining gap to "Node-on-PowerPC for real" is the
collection of latent bugs in our stream contract that pass 5–7
turned up almost one at a time. Pass 8 should attack them as a
class rather than reactively, before more downstream libraries
trip on them.

## Scope

### A. Node-streams conformance pass (the strategic move)

Pull `node/test/parallel/test-stream-*.js` from the Node 10.24.1
source tree (which we already have around — same SpiderMonkey
target). Wire them into our test runner one batch at a time.
Pass-6 fixed three bugs; pass-7 fixed one more. There will be
more. Goal: turn the stream chain from "approximate" into "passes
the official conformance suite" (or at least: pin down which
parts don't, with documented reasons).

What's likely to surface:

- `_Stream.pipe` corner cases (already had ordering bugs in pass 6).
- `_Readable` push / unshift / encoding / objectMode (probably
  underbaked — pacote / cacache lean on these).
- `_Writable` _writev (probably not implemented), corking,
  bufferedRequest queueing.
- `_Transform` flush semantics (relevant for gunzip / chunked).
- backpressure: high-watermark / `.write()` returning false /
  'drain' event timing.

This is bigger than a single pass — but starting with the smallest
of the Node 10 stream tests and growing the green-list incrementally
is the right shape. Treat each test as one bug.

### B. (Smaller) extend demos/npm-install/ with a registry install demo

[`demos/npm-install/`](../../../demos/npm-install/) currently
demonstrates local-tarball install (pass 5). With v0.93's
registry path working, add `npm install left-pad --registry=...`
as the second demo. That's the customer-facing
"Node-on-PowerPC for real" demo.

### C. (Smaller) `fs.promises.read` / `fs.promises.write` `{bytesRead, buffer}` shape

Carryover from v0.92's "what's still pending" list. Not hit by
npm-6.14.18 install, but anything using modern `fs.promises` for
fd-level I/O (some test frameworks, the newer `node-fetch-npm`)
will need this. Small-shape fix.

### D. (Larger, optional) bigger registry install — express / koa / one of the cacache deps

`left-pad` is one-file. Pacote / cacache / mkdirp / etc. install
fine but those are pure-JS. The real test of "npm install for
real" is a package with a non-trivial dep tree. Pick one that
ships pure JS (no native modules) and try installing it. If it
works, great demo. If it doesn't, that's another investigation.

## Working order

Suggested:

1. Read `notes.md` + `release-notes/v0.93.md`.
2. **A** as the primary track. Start with one easy stream test
   (e.g. `test-stream-readable-flow-recursion.js` or
   `test-stream-pipe-event.js`); fix what breaks; commit.
   Repeat. Aim for ~10 tests in pass 8.
3. Run **B** anytime — it's just adding a demo dir, very low
   risk.
4. **C** as a "any time" task.
5. **D** is opportunistic; do it if A turns up nothing on a
   particular afternoon.
6. Triad-build whatever shipped, cut v0.94.

## Risk / blast radius

A: Touching `_Stream` / `_Readable` / etc. is the load-bearing
center of our http / fs / zlib / TLS layers. Pass-6 + pass-7
both touched these without regression because the diffs were
small and targeted. Stay disciplined: one bug per fix, smoke
each fix locally before the triad-build, watch the existing 473
for regressions.

B / C / D: low risk, additive.

## Current runtime state (start of pass 8)

- v0.93 shipped: 473/473 across G3 + G4 + G5.
- Tarballs uploaded as v0.93 GitHub release assets.
- `/opt/ionpower-node-0.93/bin/node` installed on G3 / G4 / G5
  with the pass-7 changeset.
- `npm install left-pad` works end-to-end on G3 against
  registry.npmjs.org from a cold cacache.
- VERSION in repo is `0.93`. Bump to `0.94` as the first pass-8
  edit (or leave at `0.93` if not cutting a release).

## Quick references

- pass-7 notes: [`notes.md`](notes.md)
- pass-7 release notes: [`release-notes/v0.93.md`](release-notes/v0.93.md)
- the three fixes:
  [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
  search `_ClientRequest.prototype._flushBody` (no socket.end),
  `srv.emit('request'` (RFC eof immediate-end, in both http and
  https servers), `_IncomingMessage.prototype.emit` (empty-buf
  fire-end).
- regression smoke:
  [`test/http_no_socket_end_smoke.js`](../../../test/http_no_socket_end_smoke.js).
- Node 10.24.1 stream test corpus (suggested source):
  `https://github.com/nodejs/node/tree/v10.24.1/test/parallel`
  (filter on `test-stream-*.js`). There are ~150 of them; pace
  yourself.
