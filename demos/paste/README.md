# ionpower-node paste — JWT-secured encrypted paste server

A single-file web app that exercises the v0.65–v0.81 crypto + zlib +
http stack end-to-end on PowerPC Tiger. Every paste goes through:

```
client text
   |
   |  POST /paste { text }
   v
  AES-256-GCM encrypt  (96-bit IV, 128-bit tag)
   |
   v
  zlib.gzipSync
   |
   v
  fs.writeFileSync ./paste-store/<id>.bin
   |
   v
  ECDSA P-256 sign  ->  ES256 JWT { id, exp: now+24h }
   |
   v
client gets { url, token }
```

Retrieving:

```
client { url, token }
   |
   |  GET /paste/<id>  Authorization: Bearer <jwt>
   v
  crypto.verify("sha256", data, pubKey, sigDer)   <- ES256 JWT check
   |
   v
  fs.readFileSync ./paste-store/<id>.bin
   |
   v
  zlib.gunzipSync
   |
   v
  AES-256-GCM decrypt with auth-tag check
   |
   v
client gets plaintext
```

## Run it

```bash
ssh ibookg37 'cd /Users/macuser/tmp/ionpower-node && ./node demos/paste/server.js 8090'
# wait ~10 s for ECDSA P-256 keygen on G3
```

Then either:
- **Browser:** open `http://ibookg37:8090/` in any modern browser. The
  inline form has a paste-and-store textarea up top and a
  retrieve-with-bearer field below.
- **CLI client:** `./node demos/paste/client.js http://ibookg37:8090`
  runs an end-to-end POST + GET round-trip + unauthorized-GET
  rejection check.

## Validated transcript on ibookg37 (iBook G3 900 MHz)

```
$ ./node demos/paste/client.js http://127.0.0.1:8090
=== POST /paste ===
input:        297 bytes
post took:    1941 ms
url:          /paste/b45ef7579cbd920a
stored:       348 bytes (-7% saved)
token:        eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImI0N...

=== GET /paste/b45ef7579cbd920a ===
get took:     4479 ms
status:       200
ok: round-trip identity (297 bytes)

=== unauthorized GET (no bearer) ===
ok: rejected (HTTP 401) without bearer

paste round-trip smoke: ok
```

POST is dominated by ECDSA P-256 sign (~1.5 s on G3); GET is
dominated by ECDSA verify (~3.5 s) — bn.js bignum on PowerPC isn't
fast. AES-GCM + zlib are negligible. The "-7% saved" is gzip
overhead on a 297-byte payload; on real-sized pastes (~5 KB+)
compression actually wins.

## What's exercised on the server

| Phase | Subsystem | API |
|---|---|---|
| Request body | `http.createServer` + chunk reassembly | v0.66+ |
| Encrypt | AES-256-GCM with 96-bit nonce + 128-bit auth tag | `crypto.createCipheriv` / `getAuthTag` |
| Compress | Real DEFLATE via shell-out to `/usr/bin/gzip` | `zlib.gzipSync` (v0.68+) |
| Persist | Recursive mkdir + write | `fs.mkdirSync({recursive:true})`, `fs.writeFileSync` |
| Sign JWT | ECDSA P-256, SHA-256 hash | `crypto.sign("sha256", data, ecPriv)` (v0.75+) |
| Verify JWT | DER signature parse + ECDSA verify | `crypto.verify(...)` (v0.75+) |
| Decompress | tiny-inflate | `zlib.gunzipSync` |
| Decrypt | AES-256-GCM with auth-tag check | `crypto.createDecipheriv` / `setAuthTag` / `final()` |
| Banner | Real CPU + host info | `os.cpus()`, `os.hostname()` (v0.72+) |

## Ephemeral keys

Both secrets are generated at startup and never written to disk:

- ECDSA P-256 keypair (the JWT signing key) — slow on G3 (~100 ms keygen, but signing each token is ~3 s, so this demo will feel noticeably more sluggish than chat)
- 32-byte AES-256 master key (paste encryption key)

Restart the server and all old tokens become invalid + all old
pastes become undecryptable. Intentional for a demo: no key
management story to explain.

## Limitations

- Single-process, single-key. Real production needs a KMS or key
  rotation plan.
- All paste-store files are encrypted with the same AES key, just
  with per-paste IVs. Compromising the master key compromises every
  paste. Production designs use per-paste keys derived from a master
  via HKDF, but this is an end-to-end demo, not a security tutorial.
- 200 KB request cap to keep AES-GCM final() fast on a 600 MHz G3.
- Pastes never expire from disk; the JWT does (24 h) but the
  storage doesn't get cleaned up. Add a `cron` if you care.
