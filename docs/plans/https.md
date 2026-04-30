# Plan: HTTPS support

Goal: wire `https.createServer` / `https.request` / `https.get` into the
runtime so an existing Node app that uses `https` Just Works on Tiger
PPC.

## OpenSSL dependency

We're going to link against a pre-built OpenSSL on each fleet host
rather than try to bundle it. Two ways for a user to land it on disk:

### Path 1: `tiger.sh`

`tiger.sh` (Jason's package manager for Tiger PPC) installs:

- `/opt/openssl-1.1.1t/`            — the library + headers
- `/opt/ca-certificates-20230110/`  — pulled in as a dependency

This is what the project's own build hosts (ibookg37, emac, pmacg5)
should use.

### Path 2: manual tarball install

For users who don't want to set up `tiger.sh`, the same artifacts are
available as plain tarballs from leopard.sh. For a G3 host:

```
cd /opt
curl http://leopard.sh/dist/ca-certificates-20230110.tar.gz | gunzip | tar x
curl http://leopard.sh/binpkgs/openssl-1.1.1t.tiger.g3.tar.gz | gunzip | tar x
```

For G4 / G5, swap `g3` in the openssl URL. (`ca-certificates` is
arch-independent.)

Document both paths in BUILDING.md once HTTPS lands.

## Implementation sketch (to be refined next session)

Open questions for the next session to nail down:

1. **Linking strategy** — link `node` itself against `/opt/openssl-1.1.1t/`,
   or build a thin shared lib and `dlopen` it lazily? Lazy load lets
   the runtime keep working on a host without OpenSSL installed.
2. **`tls` module surface** — minimum we need is `tls.connect`,
   `tls.createServer`, `TLSSocket`. Reuse `net.Socket` underneath
   (we already have `net`).
3. **`https` module** — thin wrapper over `http` + `tls`, mirroring
   Node's layout. Most apps use `https.request` / `https.get` /
   `https.createServer`.
4. **CA bundle wiring** — point OpenSSL at
   `/opt/ca-certificates-20230110/cacert.pem` by default; allow
   override via `NODE_EXTRA_CA_CERTS` and the `ca:` option.
5. **`crypto.subtle` overlap** — we already have `node-forge` powering
   `crypto.subtle`. Decide: does `tls.*` use OpenSSL while
   `crypto.subtle` keeps using forge? Probably yes (forge is pure-JS
   and predictable; OpenSSL is the right tool for actual TLS).
6. **Smoke targets** — at minimum:
   - `https.get('https://example.com')` round-trip
   - `https.createServer` with a self-signed cert + a client request
     against it
   - The `paste` and `express-chat` demos converted to HTTPS variants
     (or new `paste-https` / `express-chat-https` demos)

## Risk / unknowns

- **OpenSSL ABI on Tiger** — 1.1.1t is well past Apple's last shipped
  OpenSSL on Tiger (0.9.7l). Confirm headers compile cleanly with
  `gcc-4.9` and that we don't need shims for missing system headers.
- **`gyp` / build wiring** — adding a new optional dep to the Makefile.
  Decide between `pkg-config` and a hardcoded `OPENSSL_PREFIX` knob
  matching our existing `MOZJS_PREFIX` pattern.
- **Cert chain validation** — do we trust OpenSSL's default verify
  callback or do we need to override (e.g. for SNI on old hostnames)?
- **Performance** — OpenSSL on a G3 600 MHz is going to be noticeably
  slow for handshake. Probably fine; flag if it isn't.

## Out of scope for first cut

- HTTP/2 — TLS only, no ALPN h2 negotiation
- mTLS / client certs — server-side cert verification only
- Custom cipher suites — OpenSSL defaults
- OCSP stapling

## Pre-flight before implementing

1. Confirm `/opt/openssl-1.1.1t/` is installed on `ibookg37` (or
   install via `tiger.sh`).
2. `pkg-config --libs openssl` (or equivalent) on the host.
3. Smoke compile: a 5-line C program that opens a TLS connection to
   `https://example.com` against `/opt/openssl-1.1.1t/`. Confirms
   the dep is sound before we commit to wiring it through the
   runtime.

— captured 2026-04-30
