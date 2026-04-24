# Session Q summary (2026-04-24)

Follows session P (v0.16 scrypt).

Single-feature session: **AES-CBC** via `crypto.createCipheriv` /
`createDecipheriv`. FIPS 197 pure JS.

Library count: 575+ (unchanged). Assertions ~1346+.

## What shipped

### AES (FIPS 197)

Pure JS, ~260 LOC:

- **S-box** + **InvS-box** — forward substitution and its inverse,
  as Uint8Array(256) tables.
- **Rcon** — round constants for key expansion.
- **Key expansion** (`_aes_expandKey`) — handles 128/192/256-bit keys
  (Nk=4/6/8 → Nr=10/12/14 rounds). Outputs a flat Uint8Array of
  (Nr+1) × 16 round keys.
- **Encrypt block** — AddRoundKey/SubBytes/ShiftRows/MixColumns
  pipeline, (Nr-1) full rounds plus final round without MixColumns.
  MixColumns uses `xtime` (GF(2⁸) mul-by-2 with 0x11b reduction).
- **Decrypt block** — inverse pipeline. InvMixColumns uses
  Me/Mb/Md/M9 multiplicand helpers (derived from xtime).
- **CBC mode** — IV-chained XOR + encrypt (or decrypt + XOR).
- **PKCS#7 padding** — auto by default; `.setAutoPadding(false)` for
  block-aligned plaintext.

### Cipher / Decipher Node-API shape

`createCipheriv(alg, key, iv)` and `createDecipheriv(alg, key, iv)`
validate the algorithm is one of `aes-{128,192,256}-cbc`, else throw.
The returned object is a Node-compat Cipher/Decipher:

- `.update(data, inputEnc)` — buffers chunks, returns empty Buffer
- `.final(outputEnc)` — processes the full buffer, emits result
- `.setAutoPadding(bool)` — toggles PKCS#7 padding

(The current impl is simpler than real Node's — it buffers all
`.update()` calls and processes everything on `.final()`. Real Node
can stream per-block output on each `.update()`. No library hit the
difference.)

### Verified vectors

- **NIST SP 800-38A Appendix F.2.5** AES-256-CBC (Key=0x603d…dff4,
  IV=0x0001…0f, PT=0x6bc1…72a) → CT=0xf58c…fbd6. Byte-exact.
- Round-trip on arbitrary plaintext with PKCS#7.
- AES-128-CBC round-trip.
- Error cases: unsupported algs throw.

## Judgment calls

### CBC only, no GCM

GCM (Galois/Counter Mode) is the modern default — but it needs
GF(2¹²⁸) ghash, which is another 100 LOC. CBC is still widely used
in legacy code, session cookies, password-derived key stores, etc.
Adding CBC first unlocks the majority of cipher-using libraries in
the vendor tree. GCM is a follow-up.

### Pure JS over native OpenSSL

Tiger ships with old OpenSSL; our `/opt/openssl-1.1.1t` is present
on all triad hosts. A native binding would be ~50 LOC of C++ and
would give hardware-accelerated AES on modern x86 (doesn't help PPC
since G3/G4/G5 don't have AES-NI). Keeping it pure JS:

- Same speed on PPC as native would be
- No library-path complexity (OpenSSL's EVP interface is chunky to
  bind)
- Easier to audit

If someone shows up needing 100MB/s+ AES throughput on PPC, we'll
revisit.

### .update() buffers vs streams

Real Node `Cipher.update()` returns the ciphertext for the current
full blocks, saving only the partial tail block for `.final()`. Our
version buffers everything and processes in one shot. Matters for:
- Streaming large files (our version needs full file in memory)
- Byte-level output timing (usually not observable)

Nothing we've vendored relies on streaming Cipher output. Documented
as a limitation.

## Not done

- **GCM / CTR / ECB modes** — CBC only for now.
- **Authenticated encryption** — GCM's auth tag not yet.
- **Native OpenSSL binding** for speed.
- **Streaming .update()** — we buffer everything until .final().

## Hand-off state

* 575+ libraries, ~1346+ assertions.
* v0.17 tagged + released once triad validates.
* Crypto surface is now substantially complete for Node-API
  compatibility: all hashes, all HMACs, PBKDF2, scrypt, AES-CBC,
  HKDF building blocks. Notably missing: sign/verify (asymmetric),
  GCM/CTR, TLS. Any of those is a valid v0.18 topic.
