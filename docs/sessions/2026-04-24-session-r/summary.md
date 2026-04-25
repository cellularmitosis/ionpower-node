# Session R summary (2026-04-24)

Follows session Q (v0.17 AES-CBC).

Two-feature session: AES-CTR + HKDF. Both build on primitives landed
in Q (AES key expansion + encrypt block) and earlier sessions (HMAC
over all hashes). Each is ~30-40 LOC; both verified against RFC
vectors.

## What shipped

### AES-CTR mode

Uses the existing `_aes_encryptBlock` and `_aes_expandKey` from v0.17.
Core:

```
keystream[i] = AES_encrypt(counter)
out[i] = plaintext[i] XOR keystream[(i mod 16)]
counter++  (128-bit big-endian)
```

Wrapped as `_CipherCTR` with the same `.update/.final` API shape as
`_Cipher` (used for CBC). `setAutoPadding` is a no-op (CTR doesn't pad).

Decrypt == encrypt, so both `createCipheriv` and `createDecipheriv`
produce a `_CipherCTR` with identical semantics.

### HKDF (RFC 5869)

Standard Extract-then-Expand:

```
PRK = HMAC(salt, IKM)
T[1] = HMAC(PRK, info || 0x01)
T[2] = HMAC(PRK, T[1] || info || 0x02)
...
OKM = (T[1] || T[2] || ... || T[N])[0:keylen]
```

Handles empty salt (per RFC, replaced with a zero-string of hashLen).
Dispatches over every hash we support.

### Smoke test

`aes_ctr_hkdf_smoke.js`:
- **NIST SP 800-38A F.5.5** AES-256-CTR (byte-exact)
- AES-256-CTR encrypt→decrypt round-trip
- AES-128-CTR with non-block-aligned plaintext (length preserved)
- **RFC 5869 Test Case 1** HKDF-SHA256 (byte-exact)
- HKDF-SHA512 length check (64-byte output)
- HKDF async matches sync

## Judgment calls

### Same _Cipher/_CipherCTR API shape; different classes

CBC and CTR have different state requirements (padding toggle for CBC,
no padding for CTR) and different core loops. Sharing a base class
via `util.inherits` would save ~20 LOC but complicate padding
semantics. Two separate classes is clearer at this size.

### HKDF shares _hashBlockSize / _hashOutputSize

The new `_hashBlockSize(alg)` and `_hashOutputSize(alg)` helpers
(added in v0.12 for SHA-512) pay off again here: HKDF auto-dispatches
over any supported hash without per-alg branching.

### No GCM yet

GCM = CTR + GHASH (authenticated encryption). GHASH is GF(2¹²⁸)
multiplication with polynomial reduction — ~80 more LOC. Deferred
to v0.19 or later. No library in our vendor tree has bounced off
needing GCM.

## Not done

- **GCM** / authenticated encryption
- **CFB/OFB** modes (rarely used)
- **ECB** (deliberate; insecure and we don't want to encourage use)
- **sign/verify** (asymmetric; huge)

## Hand-off state

* 575+ libraries, 1352+ assertions.
* v0.18 tagged + released once triad validates.
* Crypto surface is now:
  - Hashes: md5, sha1, sha224, sha256, sha384, sha512
  - MAC: HMAC over all of the above
  - KDF: PBKDF2, scrypt, HKDF
  - Symmetric cipher: AES-128/192/256 in CBC and CTR
  - Entropy: randomBytes, randomUUID, randomInt
  - Misc: timingSafeEqual, createSecretKey
* Notably still missing: authenticated encryption (GCM), asymmetric
  (sign/verify), TLS.
