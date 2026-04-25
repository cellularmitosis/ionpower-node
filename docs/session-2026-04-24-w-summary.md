# Session W summary (2026-04-24)

Follows session V (v0.23 → v0.36). This session is the v0.37 → v0.50
stretch — **fourteen more releases**, capping the half-way-to-1.0
milestone with a fresh library-hunt wave.

## Releases

| Tag | Headline |
|---|---|
| v0.37 | WebSocket (RFC 6455) client + server |
| v0.38 | `Buffer.indexOf(string)` + library hunt wave 8 |
| v0.39 | `http.Agent` stub + `crypto.hash` one-shot + `AbortSignal.any` dispatch |
| v0.40 | `util.styleText` + library hunt wave 9 |
| v0.41 | `vm` module + `module.isBuiltin` + library hunt wave 10 |
| v0.42 | `worker_threads` / `inspector` / `tty` stubs + library hunt wave 11 |
| v0.43 | poll-based `fs.watch` + library hunt wave 12 |
| v0.44 | fs.watch flake fix + library hunt wave 13 |
| v0.45 | `fs.cp` / `fs.rm` + library hunt wave 14 |
| v0.46 | `timers/promises` + `dns/promises` + library hunt wave 15 |
| v0.47 | library hunt wave 16 |
| v0.48 | `events.on` async iterator |
| v0.49 | `EventTarget` / `Event` / `CustomEvent` globals |
| **v0.50** | **milestone — 648+ libs, 28 releases this day** |

Library count: 624 → 648+ (+24 new smokes). Assertions: 1580 →
1675+ across 399 smoke files (+19 new smokes added).

## Judgment calls this stretch

### `Buffer.indexOf(string)` was -1, fix moved into the codebase

WebSocket handshake parsing tripped on `buf.indexOf("\r\n\r\n") === -1`
because we inherited `Uint8Array.prototype.indexOf`'s strict-identity
byte-value behaviour. v0.38 wraps the prototype to accept string and
Buffer needles; the older `buf.toString('latin1').indexOf(...)`
workarounds in HTTP / WebSocket code stay (they work, no need to
churn).

### `events.on` without async generators

Node's events.on returns an async iterator. We have Promise +
microtask drain but no async generator syntax. v0.48 builds the
iterator object by hand:

- `.next()` returns Promise<{ value, done }> — resolved from the
  internal queue, or saved as a pending waiter that the next event
  fires.
- `.return()` cleans up listeners + resolves all waiters with done.
- `.throw()` rejects all waiters.
- `[Symbol.asyncIterator]` returns self so `for await` works once
  the engine supports it.

### EventTarget rolled in v0.49

Even though Node has its own EventEmitter, libraries crossing
browser boundaries (undici, jose, web-API polyfills) reach for
`new Event(...)` and `new EventTarget()` without checking. Easier
to expose globally than patch each consumer.

### fs.watch flake on Tiger HFS+

v0.43's smoke caught (via my retry-once loop) that Tiger HFS+
mtime is 1-second-grained — a single mutate inside the same
wall-clock second tripped only the size-delta check. v0.44 made
the smoke do three progressive writes (7→9→13→18 bytes) over
600ms with a 50ms poller, reliably observes 3 events.

### v0.50 = library hunt milestone

I deliberately picked library hunt for v0.50 rather than a big
new feature. The crypto-shaped, network-shaped, and module-shaped
work has been steadily landing every couple of releases through
v0.49; the half-way mark feels like a natural place to push the
"libraries that work" number forward as the headline (>= 650 was
the target — landed at 648+).

## Hand-off state

- **648+** libraries with passing smoke tests.
- **1675+** assertions across **399** smoke files.
- Triad-validated on G3/G4/G5 every release; explicit scp list
  guards against the tiger-rsync gremlin.
- main.cpp now honours `process.exitCode` on shutdown (v0.36).

## Next candidates (post-v0.50)

- RSA / ECDSA — biggest missing crypto piece. ~1k-line bignum +
  curve impl from scratch, OR vendor a pure-JS RSA library
  (`node-forge`, `jsrsasign`) and wire it in like tweetnacl.
- TLS — biggest missing network piece. No native lib; would need
  a pure-JS TLS implementation (`forge`'s tls.js?). Hard.
- More library hunt — always available.
- Async iteration on ReadableStream — for-await once we have it
  natively.
- HTTP/2 client — moderate.
- Buffer.compare across Buffers (already supported via .equals?).
