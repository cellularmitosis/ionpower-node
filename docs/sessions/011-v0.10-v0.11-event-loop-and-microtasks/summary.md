# Session J summary (2026-04-24)

Follows session I. Session I ended with v0.9 shipped at 504
libraries / 1213 assertions — the real event loop landed and
async `child_process.spawn`/`exec`/`execFile` went with it.

This session is **async I/O top-to-bottom**. The session I
foundation (select()-based event loop + `ioWatch` primitive)
pays back: TCP sockets, HTTP client + server, file streams,
and real gzip decompression all layered on top.

Library count: 504 (unchanged). Assertions: 1213 → **1228**.
Triad-validated on G3 / G4 / G5.

## What shipped

### `net` — TCP sockets (new)

`src/node_compat/net.cpp` (~230 LOC). Native primitives:
- `socketCreate(family, type, proto)` — non-blocking socket + SO_REUSEADDR
- `bind(fd, host, port)` — resolves via `gethostbyname`, returns `{host, port}` post-bind
- `listen(fd, backlog)`
- `accept(fd)` — non-blocking; returns `null` on wouldBlock
- `connect(fd, host, port)` — returns `{done, wouldBlock, errno?}`
- `getError(fd)` — `SO_ERROR`; used after connect's `wouldBlock` to detect failure
- `getsockname(fd)` / `getpeername(fd)`
- `shutdown(fd, how)` / `closeFd(fd)` / `setNoDelay(fd, bool)`

JS-side `net.Socket` (Duplex-shaped EventEmitter) + `net.Server`:
- Connect: `connect()` → `EINPROGRESS` → `ioWatch(fd, WRITABLE)` → `getError` → emit `'connect'`
- Read: `ioWatch(fd, READABLE)` → readFd loop until wouldBlock/EOF, emit `'data'`/`'end'`
- Write: queued with back-pressure. Partial writes slice and retry; `wouldBlock` parks the write queue on `ioWatch(fd, WRITABLE)`
- Server: `accept` loop on the listen fd's readable watch

### `http` — real async (new)

Pure-JS HTTP/1.1 parser wired on top of `net.Socket`. Request +
status line parsing, header folding, body framing for both
Content-Length and Transfer-Encoding: chunked.

- `http.createServer(cb)` — builds on `net.createServer`, emits
  `'request'` with `IncomingMessage` + `ServerResponse`.
- `http.request(opts, cb)` / `http.get(opts, cb)` — `ClientRequest`
  connects, writes, parses response into `IncomingMessage`.
- `ServerResponse` buffers the body until `.end()` then emits
  `HTTP/1.1 N msg\r\n` + headers + Content-Length + body. Closes
  after. No keep-alive yet.
- Sync curl-backed `http.getSync`/`postSync` retained for HTTPS
  and offline-capable probes.

One bug caught during the smoke: the read callback's `while(true)`
inner loop called `readFd(self._fd)` even after a 'data' handler
had called `socket.end()` → `destroy()` (which set `_fd = -1`).
`readFd(-1)` returned EBADF. Fix: check `self._destroyed` at
the top of each loop iteration.

### `fs.createReadStream` / `createWriteStream` (new)

Whole-file-in-memory streams. Not true-streaming to disk, but
for realistic file sizes on Tiger-era kit that's fine. The native
`select()` on regular files always returns "ready" so there's
no benefit from a watcher-driven implementation anyway.

- `createReadStream(path, {highWaterMark, encoding, start, end})`:
  `fs.readFileSync`, slice to start/end, then emit chunks of up
  to `highWaterMark` bytes via `setImmediate` (one per tick) until
  done. `'open'` → `'data'`* → `'end'` → `'close'`.
- `createWriteStream(path, {flags})`: collect `.write()` chunks,
  flush to disk on `.end()` via `fs.writeFileSync` (flag `'w'`)
  or `appendFileSync` (flag `'a'`). `'finish'` → `'close'`.
- `.pipe()` works; tested end-to-end (readstream → writestream
  copies a 4390-byte source file correctly).

### `zlib` real inflate (new)

Embedded **tiny-inflate** (MIT, 375 LOC pure ES5) as a C++11 raw
string in `src/node_compat/zlib.cpp`, eval'd at bootstrap into
`__inflate_native__`.

JS-side wrappers:
- `inflateRawSync(buf)` — RFC 1951
- `inflateSync(buf)` — RFC 1950 (strip 2-byte zlib header + 4-byte adler trailer)
- `gunzipSync(buf)` — RFC 1952 (parse gzip header including FNAME/FCOMMENT/XLEN, use ISIZE trailer for buffer sizing)
- `createInflate()` / `createGunzip()` / `createInflateRaw()` — streaming Transforms (buffer-then-decompress on `.end()`)
- Compression variants (`gzipSync`, `deflateSync`, etc.) still throw clearly.

Known RFC 1951/1950/1952 vectors verified via `perl -MCompress::Zlib`
round-trip.

### Smoke tests

- `net_smoke.js` — single-process server + client, 11-byte echo round-trip
- `http_async_smoke.js` — `createServer` + `request`, both GET and POST with body
- `fs_streams_smoke.js` — read+pipe+write, encoding option, start/end slice
- `zlib_inflate_smoke.js` — gunzip/inflate/inflateRaw + streaming + compression-throws

### Docs

README Node API table updated:
- `net`: ❌ Missing → ✅ Working
- `http`: 🟡 Partial → ✅ Working (full async client + server)
- `https`: 🟡 (async fallback to sync curl for TLS)
- `fs.createReadStream`/`WriteStream`: ❌ Missing → ✅ Working
- `zlib`: 🟡 Stub → ✅ Working decompression (+ compression still stubbed)
- Library count: 504 (unchanged); assertion count: 1213 → 1228

### Release

v0.10 tagged, triad tarballs uploaded.

## Judgment calls

### Whole-file-in-memory fs streams

True streaming would need native `openSync`/`readSync`/`writeSync`/
`closeSync` primitives and tick-driven chunk reads. For regular
files on Tiger (where `select()` returns ready instantly and file
sizes are typically ≤ MB), buffering the whole file and trickling
chunks via `setImmediate` is simpler, delivers the same
user-visible API, and doesn't cap memory any worse than Node's
sync `readFileSync` does. If someone hits a GB file, we'll revisit.

### Embed tiny-inflate over writing one from scratch

RFC 1951 inflate is well-trodden. Writing a correct Huffman
decoder is 200-300 careful lines; using tiny-inflate (a clean
ES5 port of Ibsen's reference inflate) is 375 lines embedded as
a C++11 raw string. No contest. The raw-string embed means it
ships in the binary — libraries that `require('zlib')` get it
for free.

### No deflate (compression)

Deflate is the hard part: LZ77 + Huffman code table construction.
Another 600+ lines and nobody cares on a decompression-heavy use
pattern (HTTP responses, tar.gz, zip reading). Stubs throw with
a clear message. Compressing TO disk from a PPC Tiger machine is
not the day-one use case.

### HTTP client close-connection-per-request

Connection: close is always set on the outgoing request, and we
tear down the socket after the response. No keep-alive, no pipelining.
Keep-alive would need a per-host connection pool and idle-timeout
handling; punted until a library actually benefits.

### HTTP server: no chunked-response, always Content-Length

`ServerResponse.end()` buffers the entire body and writes a
Content-Length header. Real Node supports Transfer-Encoding:
chunked for streaming server responses. Not yet — matches our
whole-file-in-memory pattern and keeps the parser state simple.

### read-callback destroy-while-iterating bug

The `_Socket` read loop emits 'data' synchronously, and user
handlers can call `socket.end()`/`destroy()`. The loop then
continues calling `readFd` on a `-1` fd. Fix: check `_destroyed`
at every loop iteration. Documented; same pattern likely needs
copying to any future fd-loop (fs.createReadStream is close,
but setImmediate between chunks gives it a natural reschedule
gate).

### G4 Makefile-stale gremlin (triple-seen)

Three sessions in a row (H, I, J) G4's test-all run has completed
with an older Makefile than G3/G5 had. Root cause is probably
my `tiger-rsync.sh` wrapper losing the Makefile when the remote
host was also being sshed into for a build. Workaround for now:
explicit `scp Makefile emac:...` before each build kicks off.
Real fix would be to investigate `tiger-rsync.sh`.

### G5 SSH session dropped mid-test

During the first G5 parallel run the SSH pipe closed after ~115
lines of test output, likely a transient network drop. The
test-all had run cleanly but the result counts couldn't be read.
Reran solo and got 354/0/1228. No code fix needed; the retest
protocol handled it.

## Not done

- **Keep-alive HTTP** — each request closes the socket.
- **HTTP streaming response body on the server side** — always
  Content-Length.
- **zlib compression** — stubs throw.
- **TLS / real HTTPS** — still curl-backed.
- **SHA-512 / scrypt** — still stubbed.
- **Intl** — still missing.
- **process.stdin** — still drain-on-first-listener.
- **True-streaming fs** — whole-file-in-memory for now.

## Hand-off state

* 504 libraries, 1228 assertions, triad-validated on G3 / G4 / G5.
* v0.10 is the current tagged release.
* README has current API status.
* Next: v0.11 — real Promise microtask queue. Discovered during
  this session that SM45's native Promise also resolves
  synchronously (sub-turn-level), so the microtask queue is still
  needed for correctness alignment with Node's actual semantics.
