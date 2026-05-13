# Session N summary (2026-04-24)

Follows session M (v0.13 shipped — library hunt 504 → 560+).

Small, focused session. Single feature: `zlib` compression via stored-
mode deflate. Completes the zlib story that started in v0.10 (tiny-
inflate embedded for decompression).

Library count unchanged (560+). Assertions: 1317 → **1330+**.

## What shipped

### Stored-mode deflate (RFC 1951 type 00)

Pure JS, embedded in the bootstrap. 40 lines for the core + ~20 for
checksums:

- `_deflateRaw_stored(bytes)` — splits input into ≤65535-byte blocks,
  emits 5-byte header per block (BFINAL + BTYPE=00 + LEN + ~LEN).
- `_adler32(bytes)` — RFC 1950 checksum, mod 65521, 5552-byte
  chunking for 32-bit arithmetic safety.
- `_crc32(bytes)` — precomputed table for the gzip trailer.

Wrapped:
- `gzipSync` → magic + CM=8 + FLG=0 + mtime(0) + XFL=0 + OS=0xff +
  raw-deflate + CRC-32 LE + ISIZE LE
- `deflateSync` → CMF=0x78 + FLG=0x01 + raw-deflate + Adler-32 BE
- `deflateRawSync` → raw stored blocks

Plus async variants (setImmediate-scheduled) and Transform-shaped
streams (`createGzip`/`createDeflate`/`createDeflateRaw`), following
the same buffer-then-emit shape as the decompression Transforms
added in v0.10.

### Round-trip correctness

- Our deflate + our inflate: small, >64KB, empty — all round-trip.
- Our gzip → real `gunzip(1)` on PPC Tiger decodes back to the
  original ASCII.

Both directions of the frame correctness problem are now solved.

### Smoke test

`zlib_deflate_smoke.js` — covers:
- deflateRaw → inflateRaw
- deflate → inflate (zlib-framed)
- gzip → gunzip
- 100KB input → multi-block stored deflate
- empty input
- createGzip + createDeflate Transforms

## Judgment calls

### Stored mode, not real compression

A full deflate encoder (LZ77 sliding window + Huffman coding) is ~600
more lines of careful code, with failure modes that are hard to
diagnose ("your output is 3 bytes longer than zlib's" vs "your output
doesn't decode"). Stored mode:

- 40 LOC
- impossible to get wrong (each block is a memcpy with a 5-byte header)
- produces valid deflate by every RFC-conforming decoder
- matches "correctness over compression ratio" priority for a retro
  target where CPU is scarce anyway

Consumers who need size savings can paper over with a larger disk or
come back when we ship a real encoder. No observed library *requires*
compression ratio.

### CRC-32 via precomputed table

The RFC 1952 crc polynomial (0xedb88320) is the same everyone uses.
Precomputing the 256-entry table costs 8KB of RAM and saves one bit-
shift loop per byte on the hot path. Well worth it.

### Adler-32 vs SHA-like hashing

Adler-32 is a weak checksum by modern standards but it's what zlib
uses; we're spec-compliant. Not to be confused with SHA — Adler-32
is for frame-integrity in zlib streams only.

### One Transform factory for both sides

Compression and decompression Transforms have identical shape: collect
writes in an array, on `.end()` run the sync function, emit the result
as one `'data'` event, then `'end'` + `'close'`. I considered sharing
the factory, but the two paths already exist as separate functions
(`_mkInflateTransform`, `_mkDeflateTransform`) for clarity — 12 LOC
each, not worth the DRY.

## Not done

- Real deflate compression (LZ77 + Huffman). Future work.
- Brotli. No library has bounced on it yet.
- `zlib.BrotliEncoder` / `BrotliDecoder` — stubs still throw.

## Hand-off state

* 560+ libraries, ~1330 assertions.
* v0.14 tagged + released (triad-validated).
* Next candidates: TLS / real HTTPS async (big), scrypt (medium), or
  another library hunt wave (diminishing).
