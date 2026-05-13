# Session handoff: Node 10 parity, pass 10

## Read first

In order:

1. [`notes.md`](notes.md) — pass-9 narrative. 5 stream-engine fixes
   in [`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp),
   closing the last 5 parked Node 10.24.1 stream tests
   (emittedReadable, decoder-objectmode, push-order, resumeScheduled,
   pipe-cleanup). 22 / 22 Node 10 stream tests pass. v0.95 shipped.
2. [`release-notes/v0.95.md`](release-notes/v0.95.md) — what shipped.
3. [`express-discovery.log`](build-logs/express-discovery.log) — raw
   output of `npm install express` against the live registry. The
   "Gaps surfaced" section below summarises.

## Context in one paragraph

v0.95 closes the streams conformance gap. The "Node-streams
conformance pass" goal that drove passes 8 and 9 is done — the
handwoven `_Stream` chain now matches Node v10's semantics across
the official 22-test surface. The bigger goal — `npm install express`
end-to-end from npmjs — got a discovery pass in this session. See
"Gaps surfaced" for the punch list. The pass-10 work is to close those
gaps so the headline "Express demo, now with real npm" demo can land.

## Gaps surfaced from express discovery

### Primary blocker — streaming gunzip "Data error" in npm's pipe topology

`npm install express` consistently fails ~141s in during the resolve
phase with:

    npm ERR! Invalid response body while trying to fetch
    https://registry.npmjs.org/raw-body: Data error

The error originates inside our `_mkInflateTransform.s.end()` setImmediate
callback at `<ionpower-node bootstrap>:6655` (in
[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
around line 7700).

**Triage notes** (full detail in [`notes.md`](notes.md) "Half 2 —
Express discovery" section):

- Standalone `gunzipSync(curl-saved-file)` ✓
- Streaming `https.get → res.on('data') → Buffer.concat → gunzipSync` ✓
- Streaming `https.get → res.pipe(zlib.createGunzip()) → on('data')` ✓
- npm's `make-fetch-happen/cache.js:174` pump-tee topology ✗

So the gunzip itself is fine. The bug is specific to the make-fetch-
happen pump-chain shape: response.body tees into both a gunzip→cache
write-stream AND a consumer stream.

**First experiment for pass 10**: instrument `_mkInflateTransform.write`
to log `(chunk.length, chunk.constructor.name, isFinite(...))` for
every chunk in both the working (`res.pipe(createGunzip())`) and
failing (npm's path) cases. The diff will pin the bug. Two leading
hypotheses:

1. **String chunk slipping through** — our new pass-9 `push()` converts
   strings to Buffers in non-objectMode. If something in
   make-fetch-happen's chain calls `setEncoding('utf8')` on the
   response, downstream Buffer chunks would arrive as strings to our
   gunzip's write, get `Buffer.from(s, 'utf8')`-converted, and binary
   data would be corrupted. Quick test: temporarily revert the
   string→Buffer conversion in `_Readable.prototype.push` and see if
   the npm install gets further.

2. **pump destroy timing** — `eos`/`pump`'s teardown might fire on
   end-of-stream BEFORE our gunzip's setImmediate(syncFn(concat))
   callback runs. The destroy would close the response.body, and our
   gunzip's still-pending concat-then-decompress would see truncated
   chunks. Quick test: change our `_mkInflateTransform.s.end` to do
   the syncFn synchronously instead of via setImmediate (only for the
   stream-mode gunzip path) — if that fixes it, we have our culprit.

### Carryover from prior passes

- `fs.promises.read` / `fs.promises.write` return shape
  (`{bytesRead, buffer}` / `{bytesWritten, buffer}`). Still pending
  since v0.92.

## Scope

### A. Close the gaps surfaced by express discovery

Each gap from the discovery log gets a fix. Ordered by:
- bytes of error log (proxy for blast radius)
- whether the gap blocks downstream deps from even loading

### B. The headline demo: `demos/express-chat-npm/`

Once `npm install express handlebars ws` works clean:

1. Copy `demos/express-chat/{server,client}.js`, `views/`, `static/`
   to `demos/express-chat-npm/`.
2. Replace the `require(path.join(VENDOR_DIR, "express"))` /
   `require(path.join(VENDOR_DIR, "handlebars.js"))` calls with plain
   `require("express")` / `require("handlebars")` / `require("ws")`.
3. Add a `package.json` declaring those three deps.
4. README: walk through the install + run on G3.
5. Smoke: a `make demo-express-chat-npm` target that builds
   node_modules, starts server, runs client, asserts a post round-
   trips. (Or keep it manual and just document.)

### C. Carryover

- `fs.promises.read` / `fs.promises.write` return shape
  (`{bytesRead, buffer}` / `{bytesWritten, buffer}`). Still pending
  since v0.92.

## Working order

1. Read `notes.md` + `release-notes/v0.95.md` + the discovery log.
2. **ibookg37 note**: the iBook G3 host is HDD-failing (see the
   `project_ibookg37_hdd_failing` memory). For this project, prefer
   `/Users/macuser/tmp/` over `/tmp/` for builds and artifacts since
   `/tmp/` is wiped on any spontaneous reboot. The default in
   [`scripts/triad-build.sh`](../../../scripts/triad-build.sh) still
   uses `/tmp/`; safer to inline the steps for G3 OR add a
   `--persistent-tmp` mode to the script.
3. Work through the gap punch list (A) — usually each is small (5-30
   line addition to `globals.cpp` or `fs.cpp`). Start with hypothesis
   (1): temporarily revert the string→Buffer conversion in push() and
   see whether the npm install gets further. That's a 2-minute
   experiment that disambiguates the two leading hypotheses.
4. Re-run discovery between groups of fixes; iterate until
   `node_modules` populates cleanly.
5. Land the demo (B). Triad-build, cut v0.96.
