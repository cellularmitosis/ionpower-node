# Session S summary (2026-04-24)

Follows session R (v0.18 AES-CTR + HKDF).

Single feature: **AES-GCM**. With this, the symmetric crypto surface
is effectively complete for most Node-API compat use cases.

Library count: 575+ (unchanged). Assertions 1352 → 1356+.

## What shipped

### AES-GCM (NIST SP 800-38D)

~130 LOC pure JS:

- `_gmul(X, Y)` — GF(2¹²⁸) multiplication. Slow bit-wise (128
  iterations × 16 byte ops = 2048 ops/call). No table optimization
  yet.
- `_ghash(H, data)` — accumulator over 16-byte blocks: `Y_i =
  gmul(Y_{i-1} XOR B_i, H)`.
- `_aes_gcm_encrypt(key, iv, plaintext, aad)` — derives J0 (either
  IV||0³¹||1 for 96-bit IV, or GHASH-based otherwise), runs CTR
  from J0+1, computes tag = GHASH(...) XOR AES(J0).
- `_aes_gcm_decrypt(key, iv, ciphertext, authTag, aad)` — parallel
  path, constant-time tag compare, throws on mismatch.
- `_CipherGCM` class with `.setAAD()` / `.setAuthTag()` /
  `.getAuthTag()` — Node's Cipher-for-GCM API.

### Verified vectors

- **NIST GCM Test Case 3** (AES-128, K=0¹²⁸, IV=0⁹⁶, P=0¹²⁸):
  C = `0388dace60b6a392f328c2b971b2fe78`,
  T = `ab6e47d42cec13bdf53a67b21257bddf`. Byte-exact match.
- Round-trip AES-256-GCM with AAD.
- Tag-mismatch rejection: bad tag → throws.
- Wrong-AAD rejection: tag tampered via AAD → throws.

### Cumulative crypto surface (v0.8–v0.19)

Hashes: 6 algorithms  
HMAC: 6 algorithms  
KDF: 3 (PBKDF2, scrypt, HKDF)  
Cipher: AES in 3 modes × 3 key sizes = 9 combinations  
RNG: 3 variants  
Total: **~28 primitives** across the `crypto` API.

## Judgment calls

### Bit-wise GHASH over 4-bit tables

The standard speedup for GHASH is a 16-entry table of `H, 2H, 3H,
..., 15H` (precomputed once per key). That's ~4x faster than bit-
wise. I didn't implement because:

- GCM operations in practice are small (AAD + a few KB of ciphertext).
- Correctness was easier to verify without the table optimization.
- A future v0.20 can add the table if profiling shows GCM is a
  hotspot.

### J0 derivation covers both IV lengths

Per spec, 96-bit IV is the fast path (J0 = IV || 0³¹ || 1). Other
IV lengths require a GHASH pass over the IV first. Implemented both;
nothing in our vendor tree uses non-96-bit IVs, but spec-compliance
is cheap.

### Streaming `.update()` — still buffered

Same as v0.17: `.update()` buffers chunks and `.final()` runs the
whole pipeline. For GCM specifically, streaming output per block is
more complex (need to delay the last block for the tag pass in
decrypt). Our buffered model is simpler and correct.

### Constant-time tag compare

Written as XOR-accumulate of all byte diffs, branch-free. Defeats
timing-attack via response-time (though a pure-JS runtime isn't
exactly a perfect CT platform — JIT branch prediction and GC pauses
could still leak). Best-effort.

## Not done

- **Table-optimized GHASH**: ~4x speedup if needed.
- **sign / verify**: asymmetric crypto. RSA requires bignum, ECDSA
  requires elliptic curve math — both substantial.
- **generateKeyPair**: same story.
- **`crypto.subtle` WebCrypto**: wrapping our existing primitives
  in the WebCrypto API shape.

## Hand-off state

* 575+ libraries, 1356+ assertions.
* v0.19 tagged + released.
* Crypto module is now ✅ in the README API table.
