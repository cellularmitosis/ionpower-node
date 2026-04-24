# Session T summary (2026-04-24)

Follows session S (v0.19 AES-GCM).

Single feature: **`crypto.subtle`** (WebCrypto). Wraps all the
symmetric primitives landed across v0.8–v0.19 in the WHATWG
SubtleCrypto API shape.

Library count: 575+ (unchanged). Assertions 1356 → 1361+.

## What shipped

### `globalThis.crypto.subtle`

Full Node-style `crypto.*` mapped into WebCrypto shape:

- `digest` → `createHash().update().digest()`
- `sign`/`verify` → `createHmac()` over HMAC
- `encrypt`/`decrypt` → `createCipheriv()`/`createDecipheriv()` for
  AES-CBC/CTR/GCM; GCM tag appended to ciphertext per WebCrypto
  convention
- `generateKey` → `randomBytes(size)` wrapped in a CryptoKey
- `importKey`/`exportKey` → just holds the raw bytes; format `"raw"`
  only
- `deriveBits` → PBKDF2 and HKDF wrappers

### CryptoKey class

Stores `{ type, algorithm, usages, extractable, _raw }`. `exportKey`
respects `extractable` flag. All keys are `'secret'` (symmetric) —
no asymmetric yet.

### Verified

- `digest("SHA-256", "abc")` matches FIPS vector
- HMAC-SHA256 sign/verify round-trip
- AES-256-GCM encrypt/decrypt round-trip
- PBKDF2-SHA256 deriveBits returns 32 bytes
- importKey/exportKey raw round-trip

## Judgment calls

### WebCrypto GCM tag convention

Node's `createCipheriv('aes-256-gcm', ...)` gives the tag via
`.getAuthTag()` — a separate value. WebCrypto conventionally appends
the tag to the ciphertext. Our subtle wrapper does the concat/slice
transformation so consumers see Node-style on one side, WebCrypto-
style on the other.

### "raw" format only

Full WebCrypto supports `'raw'`, `'pkcs8'`, `'spki'`, `'jwk'` for
key import/export. PKCS#8 + SPKI are only meaningful for asymmetric
keys we don't support. JWK for symmetric keys is just a Base64URL
wrapper over raw — could add but no library has needed it.

### `importKey` on PBKDF2

WebCrypto requires importing the password as a PBKDF2 key before
`deriveBits`. We accept that shape but just stuff the raw bytes
into `_raw` — they're treated as IKM at derive time.

### Async via Promise

All subtle.* methods return Promises. Thanks to v0.11's microtask
queue, Promise chains behave correctly (resolve at the right spot).

## Not done

- **Asymmetric** (RSA, ECDSA, Ed25519, ECDH) — requires bignum
  and/or elliptic curve math. Each is nontrivial.
- **JWK format** — wrapper over raw for symmetric keys.
- **AES-KW** (key wrapping).

## Hand-off state

* 575+ libraries, 1361+ assertions.
* v0.20 tagged + released once triad validates.
* Crypto surface now comprehensive for symmetric + Node-style + WebCrypto.
