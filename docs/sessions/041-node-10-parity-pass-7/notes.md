# Session notes — 2026-05-11 session 3: Node 10 parity, pass 7

Handoff: [`handoff-pass-7.md`](../2026-05-11-session-2-node-10-parity-pass-6/handoff-pass-7.md)
(in pass-6's session dir).
Pass-6 notes: [`../2026-05-11-session-2-node-10-parity-pass-6/notes.md`](../2026-05-11-session-2-node-10-parity-pass-6/notes.md).

Pass-6 (v0.92) closed three stream-contract bugs: `_IncomingMessage`
paused/flowing, `zlib.createGunzip()` buffer-until-listener, and
`process.stdout/stderr` wrapped as Writable. All three are in
[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp).

Pass-7 entry: `npm install <name>` from registry still hangs at
"cb() never called!" after `silly install readLocalPackageData`,
even though direct `pacote.manifest(spec, simpleOpts)` works. The
hang surfaces only when pacote's opts come from `figgy-config`
(carries `Promise: BB`, `cacheManager`, `agent`, retry, timeout).

User said "proceed" — operating in unsupervised mode per CLAUDE.md.

## Working log

### Setup

Created session dir + notes file. Confirmed baseline state on G3
matches handoff:

- `/opt/ionpower-node-0.92/bin/node` installed (pass-6 changeset).
- `/tmp/probe-pacote.js` (simple opts, works — but only because the
  cache dir had a hit from a prior pass-6 run).
- `/tmp/probe-fpm-noBB.js` (figgy-config opts, hangs).

### A — chase the figgy-config hang down to the wire

Started bisecting through figgy-config options as the handoff
suggested. Immediately tripped on something surprising: a probe with
identical *simple* opts to `probe-pacote.js` also hung when run
against a fresh cache dir. Re-ran `probe-pacote.js` with its own
cache dir freshly deleted: also hung.

**The "direct pacote.manifest works" baseline in the handoff was a
cache HIT, not a cold call.** With a cold cacache, pacote against the
real npm registry hangs ~50% of the time regardless of figgy/simple
opts.

#### Narrowing down the layers

Bisected through the network stack, fresh run each time:

|  layer  |  probe  |  result (passes / runs) |
|---|---|---|
| curl direct | `tigersh curl ... left-pad` | 10/10 |
| DNS+TCP only | `dns.lookup + net.connect 443` | 10/10 |
| TLS handshake only | `tls.connect(...) → secureConnect → end` | 10/10 |
| **raw TLS + raw HTTP/1.1** | `tls.connect; sock.write("GET .../1.1...")` | **10/10** |
| **`https.get(url, cb)`** | our high-level API | **~6/10** |
| **`https.request(opts, cb)`** | with explicit `Connection: close` | **~1/10** |
| pseudo-`_ClientRequest` (manual) | tls.connect + write headers in secureConnect cb + on('data')/on('end') | 10/10 |

So the bug is **specifically in `_ClientRequest`**, not in TLS, not
in DNS, not in the raw socket layer. Raw `tls.connect` + manual
`GET /left-pad HTTP/1.1` works every time; the same bytes wrapped
in `_ClientRequest` flakes.

#### Root cause

Instrumented `_ClientRequest` via monkey-patches and process.nextTick
peeks. The trace in a failing run:

    raw.connect +230ms
    raw.data 2721 +314ms       # ServerHello + cert
    sock.secureConnect +342ms  # handshake done
    raw.data 250 +344ms        # server ChangeCipherSpec + Finished
    [no further events for 15s]
    WD: raw fd=-1 connecting=false handshake=true

After secureConnect, the socket is destroyed (fd=-1) and no more
data arrives. No `'data'` event on the TLSSocket. No `'error'`. The
HTTP request bytes go on the wire (TLS write succeeds), but
Cloudflare just... never responds. Curl never sees this on the
same machine. So this is something about *our* request shape.

Looking at `_flushBody`:

```js
_ClientRequest.prototype._flushBody = function () {
  for (var i = 0; i < this._bodyChunks.length; ++i)
    this.socket.write(this._bodyChunks[i]);
  if (this._ending) this.socket.end();  // ← THE BUG
};
```

When `req.end()` has been called before headers are sent (the
universal pattern for `https.get(url, cb)`), `_ending=true` is set,
and as soon as the secureConnect callback fires, `_flushBody` does
`socket.end()`. On a `_TLSSocket`, `.end()` sends an **SSL
close_notify alert** AND does `raw.end()` (which does
`shutdown(SHUT_WR)` → TCP FIN). Both of these happen *immediately
after* we wrote the HTTP request, in the same event loop iteration.

Cloudflare's edge sometimes processes our close_notify+FIN before
its HTTP layer has handed the response back to the connection. When
that race fires the wrong way, the edge silently drops the
connection without sending us a response.

**Confirmation**: monkey-patched `req.socket.end = function(){}` (no-op)
on the same `https.request` call. **10/10** runs succeed. That's the
fix: don't half-close the socket from the client side. HTTP framing
(Content-Length, chunked terminator, or empty body for GET) already
tells the server the request is complete; we don't need a TLS- or
TCP-level close to signal it.

#### Fix

[`src/node_compat/globals.cpp`](../../../src/node_compat/globals.cpp)
`_ClientRequest._flushBody` and `_ClientRequest.end`: removed both
`this.socket.end()` calls. The response side already cleans up via
`feedBody → sock.destroy()` once Content-Length / chunked is
reached, or via the server's FIN for eof-mode responses. Pseudo-CR
runs proved this 10/10 with no socket-level close from our side.

### B — the cascade from fixing A

The client-side fix flipped the wire pattern that our own http
server was implicitly relying on. Two more bugs surfaced and got
fixed in the same pass:

#### B1 — server-side: eof-mode reader on REQUEST never emits 'end'

Built a regression smoke
([`test/http_no_socket_end_smoke.js`](../../../test/http_no_socket_end_smoke.js))
to lock in the A fix. axios_smoke + the regression smoke both hung
under it. Root cause: our http server, on a GET with no
Content-Length / Transfer-Encoding, configures the body reader in
`mode='eof'` — and only emits `'end'` on the request when the
client socket fires `'end'` (i.e. FIN). With A's fix the client
never sends FIN, so `req.on('end', () => res.end(...))` (the
axios echo server pattern; also npm/express/etc.) never runs and
the connection sits forever.

RFC 7230 §3.3.3 rule 6: a REQUEST with no Content-Length and no
Transfer-Encoding has body length zero. Eof-mode on the server
side should collapse to "no body, emit 'end' now."

Fix: in both `_httpCreateServer` and `_httpsCreateServer`, after
`srv.emit('request', request, response)`, if the reader is in
eof mode (or length mode with zero remain), immediately
`request.emit('end')` instead of waiting for sock 'end'.

#### B2 — `_IncomingMessage.emit('end')` queues forever when no 'data' listener

After B1 landed, the regression smoke STILL hung. Deeper root
cause: the pass-6 IM paused/flowing override buffers `'end'` in
`_imEndQueued` whenever `!_imFlowing`. `_imFlowing` only flips to
true when a `'data'` listener attaches. Server GET handlers
typically attach `'end'` ONLY (no `'data'`, since the body is
empty), so the queued `'end'` never drains.

Fix: in the emit override, when `'end'` is being emitted and the
buffer is empty, fire it directly (no order-violation risk since
there's no buffered data to deliver first). Only queue `'end'` if
there are pending data chunks. Preserves the pass-6 fix exactly
for the "data buffered, listener attaches late" case.

The three fixes go together: A on its own breaks local HTTP, B1
on its own doesn't trigger (we never reach eof-mode emit-end
before pass-7), B2 on its own doesn't trigger (always-resume in
the old code masked it). Pass-7 needs all three.

### End-to-end verification

With all three fixes baked into the G3 build:

- `pacote.manifest(...)` against `registry.npmjs.org/left-pad`,
  fresh `~/.npm/_cacache`: 3/3 success in ~4s each.
- `node npm-cli.js install left-pad --registry=https://registry.npmjs.org/`,
  fresh cache, fresh `/tmp/npm-test-install/`:

      + left-pad@1.3.0
      added 1 package from 1 contributor in 15.343s

  And the installed module works:

      $ node /tmp/verify-lp.js
      left-pad result: [0000hi]

  That closes the registry-based-install goal that pass-5 / pass-6
  / pass-7 have been pushing toward.

### Triad build

G3 first (foreground), then G4 + G5 in parallel via
`scripts/triad-build.sh`. Smoke runs include the new
`http_no_socket_end_smoke.js` regression guard. Tarballs land at
`/tmp/ionpower-node-0.93-{g3,g4,g5}-ppc.tar.gz`.
