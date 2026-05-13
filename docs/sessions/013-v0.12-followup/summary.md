# Session L summary (2026-04-24)

Follows session K (v0.11 shipped — Promise microtask queue + pmacg5
bootstrap as new G5).

This session is **the batch release** — five independent features that
each would have been a single-release sessions in the past, grouped
together to amortize triad-validation cost:

1. SHA-512 / SHA-384 (+ HMAC + PBKDF2 over them)
2. `fetch` + `AbortController` + `AbortSignal` + `Headers` + `Response`
3. `dns` module
4. HTTP chunked server responses + keep-alive
5. `process.stdin` rewritten on `ioWatch`

Library count: 504 (unchanged). Assertions: 1231 → **1255+** (across
375 smoke files).

## What shipped

### SHA-512 / SHA-384 (RFC 6234)

64-bit arithmetic via `[hi, lo]` Uint32 pairs. Helpers: `_add64`,
`_xor64`, `_and64`, `_not64`, `_rotr64`, `_shr64` — all pure JS.
80 K constants, 80-round compression, 128-byte blocks.

- `createHash('sha512')` / `createHash('sha384')` (+ `sha-512` alias)
- `createHmac('sha512')` uses the correct 128-byte block size (parameterized
  via a new `_hashBlockSize(alg)` helper).
- `pbkdf2Sync` / `pbkdf2` now dispatch over all six hashes (md5, sha1,
  sha224, sha256, sha384, sha512).
- FIPS 180-4 vectors + RFC 4231 HMAC-SHA512/384 vectors + a PBKDF2-SHA512
  vector cross-checked against Python's `hashlib` pass inline.

One padding bug caught during bringup: SHA-512's 128-bit length field
goes in the last 16 bytes; I initially wrote the high 32 bits at
`[padLen-12..padLen-9]` and the low 32 at `[padLen-8..padLen-5]`,
leaving the last 4 bytes zero. Reordered to match the spec.

### fetch / AbortController / AbortSignal

Built on top of the async `http.request` landed in v0.10 + the
microtask queue from v0.11. Global `fetch`, `Headers`, `Response`
all installed; also exposed on `globalThis`.

- `Headers(init)` — case-insensitive; `get`/`set`/`has`/`delete`/`append`/
  `forEach`/`entries`/`keys`/`values`.
- `Response` — `.ok`, `.status`, `.statusText`, `.headers`, `.text()`,
  `.json()`, `.arrayBuffer()`, `.buffer()`, `.clone()`.
- `AbortSignal` — `.aborted`, `.reason`, `.addEventListener('abort')`,
  `.throwIfAborted()`, static `.abort(reason)` and `.timeout(ms)`
  factories.
- `AbortController.abort(reason)` wires the signal's listeners + sets
  `reason.name = 'AbortError'` when the user passes a plain Error.
- `fetch(url, { signal })` listens on the signal; if aborted, calls
  `req.abort()` and rejects with the signal's reason.
- HTTPS falls through to the sync curl helper (no TLS yet).

### dns

- Native `__net_native__.lookup(host)` returns `{address, family}` via
  `gethostbyname` (blocking; called from `setImmediate` so callers see
  async semantics).
- `dns.lookup(host[, opts], cb)` — `cb(err, address, family)` or
  `cb(err, [{address, family}])` with `{all: true}`.
- `dns.resolve` / `dns.resolve4` / `dns.resolve6` / `dns.resolveMx`
  / `dns.resolveTxt` / etc. MX/TXT/CNAME/etc return empty arrays for
  compat (we don't run a real resolver).
- `dns.promises.lookup` / `resolve4` / etc.
- ENOTFOUND produced for unresolvable hostnames.

### HTTP chunked + keep-alive

`_ServerResponse` reworked:
- Picks framing mode at header-flush time:
  - `Content-Length` set → `length`
  - `Transfer-Encoding: chunked` set → `chunked`
  - `write()` called without Content-Length → `chunked` (auto)
  - Else (user just calls `end(body)`) → `buffered`
- `_writeFrame` emits a proper `SIZE\r\nBYTES\r\n` frame in chunked
  mode; `end()` writes the terminator `0\r\n\r\n`.
- Connection header driven by the incoming request:
  - HTTP/1.1 default → keep-alive (unless client sent `Connection: close`)
  - HTTP/1.0 → keep-alive only if `Connection: keep-alive`

`_httpCreateServer` rewritten around a per-connection state machine
that handles pipelined requests: after each response finishes, reset
parser state and try to parse the next request from any buffered bytes.

One bug: end() called _flushHeaders (which flushed pending body once),
then left the late `end("cc")` chunk in the queue. Fixed by flushing
pendingBody again from end() before emitting the chunked terminator.

### process.stdin rewrite

v0.10 had a drain-on-first-listener shim that called
`fs.readFileSync('/dev/stdin')` once. That worked but meant stdin
arrived as a single chunk after the whole input was buffered in kernel
pipes. With the event loop available, rewrote as:

- `ioWatch(0, READABLE, cb)` — registered on first `'data'` listener.
- `cb` loops on `readFd(0, 65536)`: emits `'data'` chunks as they
  arrive, `'end'` on EOF, stops on `wouldBlock`.
- `.pause()` unwatches; `.resume()` re-watches.
- `.pipe(dest)` wires `'data'` + `'end'` + calls `.resume()`.

Now CLI tools that expect stdin to stream (prompts, line-at-a-time
processors, `cat | my-script`) work properly.

### Smoke tests

- `sha512_smoke.js` — FIPS vectors + RFC 4231 HMAC + PBKDF2
- `fetch_smoke.js` — local server + fetch roundtrips + AbortController
- `dns_smoke.js` — lookup/resolve/promises + ENOTFOUND
- `http_chunked_smoke.js` — auto + explicit chunked + plain buffered
- `stdin_stream_smoke.js` — piped stdin streams + 'end' fires

### Docs

README updated:
- crypto: md5/sha1/sha224/sha256/sha384/sha512
- http: auto-chunked, keep-alive
- dns: new row ✅
- fetch / AbortController / AbortSignal: new row ✅
- process.stdin: note real streaming now

## Judgment calls

### Group five features into one release

Previous pattern was one headline feature per version. That gave clean
git history but made each release a ~1-hour triad-validation spend.
Five features × 1 hour each = 5 hours of triad babysitting. Landing
them in one release cuts that to one triad run, with only marginal
risk increase since everything here is additive (no semantics changes
to existing behavior beyond HTTP server framing, which is backward-
compatible).

### SHA-512 via Uint32 pairs

SM45 on 32-bit PPC has no BigInt and no native u64 arithmetic. The
standard technique is representing each 64-bit value as a
`[hi, lo]` pair of Uint32s. Reference impls exist for the six ops we
need (add, xor, and, not, rotr, shr) — ~30 LOC of helpers plus the
80 K constants. Worked cleanly; FIPS vectors passed on first try after
fixing the padding bug.

### SHA-224 sign reuse with SHA-256 core; not so for SHA-384/SHA-512

SHA-224 ran through `_sha256_core` with a different IV and truncated
output. Clean sharing. SHA-384 is *not* the same relationship with
SHA-256 — it shares with SHA-512. So I factored `_sha512_core` the
same way SHA-256 was factored, with SHA-384 passing its own IV and
outLen=48.

### AbortController listeners as a plain array

Real `AbortSignal` is an EventTarget. Our minimal subset stores
listeners in an array and only accepts the `'abort'` event. None of
the observed library usages cared about EventTarget's full API; they
all just do `signal.addEventListener('abort', cb)` and check
`signal.aborted`. Expandable later if a library bounces.

### fetch over net.Socket, HTTPS fallback to curl

Our `http.request` is pure-JS over `net.Socket`; `fetch` of an `http:`
URL layers cleanly on top. For `https:`, we don't have TLS in our net
stack — it would need OpenSSL/BoringSSL bindings, nontrivial effort.
`fetch` for HTTPS therefore falls through to the sync curl path used
by `http.getSync`, returning a synthesized `Response`. Users still
get `await fetch('https://...')` working, just without streaming.
Documented.

### HTTP server auto-chunking heuristic

The trigger for auto-chunking is: user called `.write()` before the
headers went out, and didn't set `Content-Length`. This matches Node's
behavior for dynamically-sized bodies. Users who want buffered
responses can either set `Content-Length` explicitly or just call
`.end(body)` without intermediate writes.

### dns.resolveMx etc return empty, not throw

A lot of libraries call `dns.resolveMx` opportunistically ("if the
hostname has no MX, try the A record directly"). Throwing would
bounce those libs on a machine that has no real DNS resolver.
Returning `[]` lets them fall through. Documented.

### process.stdin backward compat

The old drain-on-first-listener shim worked because it emitted
everything as one chunk. New behavior emits chunks as they arrive.
Libraries that concat chunks before processing still work
(`Buffer.concat(chunks)`). Libraries that expected the whole buffer
in a single 'data' event (unusual) would break; none seen.

## Not done

- **TLS / native HTTPS in net** — big lift (OpenSSL binding or a
  pure-JS TLS, neither small).
- **zlib compression** — still stubbed.
- **scrypt** — still stubbed.
- **Intl** — still missing.
- **`cluster` / `worker_threads`** — multiprocess stuff.
- **`nextTick` strict priority over microtasks** — shared queue.

## Hand-off state

* 504 libraries, 1255+ assertions, pmacg5 (G5) validated; G3/G4 triad
  to follow.
* v0.12 tagged + released once triad completes.
* Next: candidates include zlib compression (missing decoder half),
  SHA-512 already done, TLS (large), or a library hunt to finally
  move the library count above 504.
