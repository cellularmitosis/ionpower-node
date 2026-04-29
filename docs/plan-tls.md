# TLS roadmap

The `https` row is the last 🟡 in the README. Everything else in the
async / crypto / streams / http stack is real, but `https.request`
falls back to a sync curl shim and `https.createServer` throws.
This doc is the multi-session plan to actually have TLS in-process.

## Why this is the hardest remaining gap

TLS is unique in the project because:

1. **It's a state machine, not an algorithm.** Every other crypto
   feature we've shipped (RSA encrypt, AES-GCM, ECDSA, JWT) is a
   single-shot transform. TLS is a multi-round handshake with timing
   dependencies + protocol-version + cipher-suite negotiation +
   certificate-chain validation + record-layer framing.
2. **The web is mostly TLS 1.2/1.3 now.** Modern CAs and CDNs
   reject TLS 1.0/1.1. So a "TLS 1.0 only" implementation
   functionally won't talk to most endpoints, even though it would
   technically work.
3. **The vendored option (forge.tls) is TLS 1.0/1.1 only.** Forge's
   `lib/tls.js` was last meaningfully updated for 1.0 + 1.1 cipher
   suites. It does not implement TLS 1.2's AEAD-cipher handshake
   variations, and certainly not 1.3.
4. **No native bridge.** OpenSSL on Tiger PPC is ancient (LibreSSL
   forks aside). We don't have a C++ TLS we can shell into; the curl
   shim is currently the only real TLS we touch, and that's a
   fork+exec per request.

## Three phases

### Phase A (v0.82): forge.tls wired to net.Socket — minimum viable TLS

Goal: a TLS 1.0/1.1 client + server that handshakes against itself,
end-to-end. Not interop-with-modern-web; interop-with-our-own-stack.

Deliverables:
- `tls.createConnection(opts) -> tls.TLSSocket`: wraps `net.Socket`
  and runs forge.tls handshake state machine on top.
- `tls.createServer(opts, handler)`: same but accepts incoming.
- Self-signed cert + ECDSA private key option, both PEM strings (we
  already have v0.67's `X509Certificate`).
- A smoke that round-trips a small payload between in-process
  client + server, both running on the same G3.
- README: `https` row stops being 🟡.

What this **doesn't** unlock:
- Our `https.request('https://npmjs.org/...')` still uses the curl
  shim because forge.tls 1.0/1.1 won't negotiate with modern CDNs.
- Browsers won't connect to `https://ibookg37:8090/` from `phase A`
  because all current browsers reject TLS 1.0/1.1.

But it gets a real TLS handshake running on a 600 MHz G3, which
is a meaningful proof that the pieces fit together. And gives us
the in-process TLS-record-layer plumbing that 1.2 / 1.3 will reuse.

Estimated cost: 1 session.

### Phase B (v0.83+): TLS 1.2 with ECDHE + AEAD cipher suites

Goal: actually talk to modern endpoints. TLS 1.2 with the
`ECDHE-ECDSA-AES256-GCM-SHA384` / `ECDHE-RSA-AES256-GCM-SHA384`
cipher suites is the floor most CDNs still accept (alongside 1.3).

Building blocks already in place:
- ECDHE: v0.76's `crypto.diffieHellman` on P-256/384/521.
- ECDSA: v0.75 `crypto.sign('sha256', ..., ecPrivateKey)`.
- AEAD ciphers: AES-GCM via `crypto.createCipheriv('aes-256-gcm', ...)`.
- HKDF: already in `crypto.hkdfSync` (Node-style) — needed for the
  TLS 1.2 key schedule.
- Certificate chain validation: v0.67's `X509Certificate.verify`
  (delegates to `forge.pki.verifyCertificateChain`).

Missing:
- TLS 1.2 handshake state machine (different from 1.0/1.1's flow
  in subtle ways: encrypted handshake on 1.2 means the cipher
  install happens mid-handshake; transcript hashing differs).
- `Certificate Verify` message generation + signing.
- Proper `Finished` MAC with the 1.2 PRF (not the 1.0/1.1 one).

This is a multi-session arc. Probably 2-4 sessions of careful
implementation + testing against real public endpoints. The reward:
`fetch('https://api.example.com/...')` runs entirely in-process
without curl. Means we can write demos that talk to real web APIs
from the G3 without forking out.

### Phase C (v0.84+): TLS 1.3 — the long lift

TLS 1.3 is a different beast. Single-round handshake, redesigned
key schedule (HKDF-Extract / HKDF-Expand-Label), encrypted
extensions, separate cipher suites (`TLS_AES_256_GCM_SHA384`),
0-RTT. We have all the cryptographic primitives, but the state
machine is fully different from 1.2.

Pure-JS TLS 1.3 implementations exist (`tls13-js`, etc.) but they
target Web environments with WebCrypto and don't have a Node-shape
adaptor. Realistic plan:
1. Take a pure-JS TLS 1.3 stack as a reference.
2. Adapt the network I/O to our `net.Socket`.
3. Wire the cipher hooks to our existing `crypto.subtle` (which
   v0.79–v0.81 made compatible with the WebCrypto shape these
   implementations expect).

This is a 4-8 session arc.

## Interim recommendation

Don't block on TLS for general roadmap progress. Specifically:
- Keep shipping demos over plain HTTP / WS for the time being.
  The "wait, that's running on a G3?" punch lands either way.
- For internet-fetch demos, the existing curl-shim path works fine
  — it's a real TLS connection, just via fork+exec instead of
  in-process. The npm-fetch demo proves this works.
- When a Phase A session opens up, attack forge.tls 1.0 + a
  self-signed cert smoke. Set the bar at "smoke handshakes
  end-to-end on the G3," not "talks to npmjs.org over real TLS."

## Quick sanity-checks before Phase A starts

1. Does forge.tls's `createConnection` actually run on our SM45?
   (We've vendored forge but haven't exercised the TLS path.)
2. Does our `net.Socket` expose enough surface for forge.tls's
   `socket` option to drive (read/write hooks)?
3. Do we need to teach `forge.pki` about ECDSA certs (it's mostly
   RSA today), or is RSA-only TLS 1.0 acceptable as a starting
   point?
