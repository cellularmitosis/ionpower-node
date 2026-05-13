# Session P summary (2026-04-24)

Follows session O (v0.14 zlib compression, v0.15 library hunt wave 2).

Single-feature session: **scrypt** (RFC 7914). Completes the password-
hashing crypto surface.

Library count: 575+ (unchanged). Assertions ~1340+.

## What shipped

### scrypt (RFC 7914)

Pure JS, ~150 LOC:

- **Salsa20/8** — 8-round variant of the Salsa/20 core. 16 × 32-bit
  words, column + row rounds × 4. Expanded inline (no generic for-loop
  per word) for speed.
- **BlockMix** — the inner mixing step. Takes `2r` × 64-byte sub-
  blocks, XOR-and-Salsa them pairwise, reorder even/odd.
- **Integerify** — extracts a 32-bit index from the last sub-block.
- **ROMix** — memory-hard: fills `V[N]` with successive BlockMix
  outputs, then does N more iterations with random-access reads
  from V indexed by `integerify(X) mod N`.
- **scrypt** — `PBKDF2-HMAC-SHA256(password, salt, 1, p*128*r)`,
  ROMix each of the p blocks, `PBKDF2-HMAC-SHA256(password, B,
  1, dkLen)`.

RFC 7914 test vector 1 (`P="" S="" N=16 r=1 p=1 dkLen=64`) passes
byte-for-byte. Async/sync match. Parameter validation (N power of 2,
r*p < 2^30) enforced.

### Performance

Default Node params (N=16384, r=8, p=1):
- Memory: N × r × 128 = 16 MB. Comfortable on a G5, tight on a G3.
- CPU: 2N = 32,768 BlockMix calls, each 16 Salsa20/8 invocations.
  On a G3 (~800 MHz): maybe 30 seconds. On a G5 (~2 GHz): maybe 5-10
  seconds. PPC IonPower JIT helps but doesn't close the gap to modern
  x86.

For tests we use N=16 or N=2 — finishes in milliseconds.

### Smoke tests

`scrypt_smoke.js`:
- RFC 7914 vec 1 byte-for-byte match
- Small-param round-trip (N=2 r=1 p=1) matches Python's hashlib
- Parameter validation: N=3 throws
- Async/sync agreement

## Judgment calls

### Pure JS over native binding

A native binding against OpenSSL's EVP_KDF would be ~50 LOC of C++
and 100x faster. But:

- OpenSSL's scrypt is versioned (1.1+) and we want to stay portable.
- The pure-JS version exposes the full algorithm for educational
  value and debugging.
- Performance is adequate for typical use (password verification on
  login); bulk key derivation would be slow but rare.

### Default N=16384 over smaller

Node's crypto.scrypt defaults to N=16384 for real-world security.
Matching that means "slow but correct" rather than "fast but weak."
Library users can pass smaller N for tests. Documented.

### Salsa20/8 expanded inline vs looped

A generic 20-round loop with round-indexed array access would be
~30 LOC shorter. The unrolled version is ~70 LOC but 2-3× faster
on SM45 because typed-array indexed loads aren't cached. For a
function called 65,000+ times per scrypt run, the speedup matters.

## Not done

- Native OpenSSL EVP_KDF binding (faster; future)
- `crypto.createCipheriv` / AES (biggest missing primitive now)
- `crypto.sign` / `verify` (asymmetric; large)
- `crypto.generateKeyPair` (RSA/ECDSA, large)

## Hand-off state

* 575+ libraries, ~1340+ assertions.
* v0.16 tagged + released (triad pending).
* Next candidates: **AES / createCipheriv** (unlocks another crypto
  surface), **TLS** (big, multi-session), or more library hunt.
