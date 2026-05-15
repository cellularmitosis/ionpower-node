# Session archive

One directory per session, named `NNN-<slug>` with a zero-padded
monotonic counter (no date prefix). Each contains a narrative
(`summary.md` for legacy sessions ≤ 024, `notes.md` for newer ones)
and, where the session built/shipped releases, `build-logs/` per-host
build + smoke logs and `release-notes/` copies of GitHub release
prose.

Sessions 001–024 are the original April 21–25, 2026 push (then named
with a monotonic letter within a date, `session-a` through
`session-x`); sessions 025+ are the post-workflow-pivot stretch. The
counter format matches sibling projects `chibicc-book` and
`llvm-7-darwin-ppc`.

| # | Theme |
|---|---|
| 001 | Pickup notes — first continuation after the build host came up |
| 002–004 | Initial library hunt waves 1–3 + first HTTP client |
| 005–010 | v0.1 → v0.9 — triad goes green, Node-interface surface filled out, library count crosses 500 |
| 011 | v0.10 + v0.11 — real event loop, async I/O trifecta, Promise microtask queue |
| 012–013 | v0.12 — SHA-512, fetch, dns, HTTP chunked, stdin streaming (batch + followup) |
| 014–015 | v0.13 library hunt, v0.14 zlib compression |
| 016–020 | Symmetric crypto sweep — scrypt, AES-CBC, AES-CTR + HKDF, AES-GCM, `crypto.subtle` |
| 021 | v0.22 + v0.23 — JWK + AES-KW |
| 022 | v0.24–v0.36 — first asymmetric crypto, fourteen releases |
| 023 | v0.37–v0.50 — halfway to 1.0, fourteen more releases |
| 024 | v0.51–v0.65 — final big-ticket gaps (compaction-bridging session) |
| 025 | v0.66–v0.81 — asymmetric crypto marathon: RSA encrypt/decrypt, X509, ECDSA, ECDH, JWK round-trip, real DEFLATE, real `os.*`, top-level await + `import.meta` + dynamic `import()`, raw TTY, mozjs as release artifact, ibookg37 swap, chat + npm-fetch demos, pivot to `docs/sessions/<id>/` + `scripts/triad-build.sh` |
| 026 | WPT + Node conformance harnesses |
| 027 | Express chat demo |
| 028 | v0.82 release |
| 029 | HTTPS (TLS) |
| 030 | v0.84 |
| 031 | `__proto__` deopt investigation |
| 032 | Handoff from lumo-darwin8-ppc |
| 033 | npm 6 bootstrap |
| 034–037 | Node 10 parity, passes 1–4 |
| 038 | Node 10 parity pass 5 — planning + handoff |
| 039 | Node 10 parity pass 5 — execution |
| 040–042 | Node 10 parity, passes 6–8 |
| 043 | Node 10 parity pass 9 — close last 5 parked stream tests; first `npm install express` discovery |
| 044 | Node 10 parity pass 10 — tinflate Z_SYNC_FLUSH off-by-one fix; `npm install express` works end-to-end |
| 045 | Node 10 parity pass 11 — V8 CallSite + `Error.prepareStackTrace` shim; `require('express')` works end-to-end; `demos/express-chat-npm/` lands |
| 046 | Node 10 parity pass 12 — `package.json` top-level main resolver, `fs.promises.read/write` shape, `process.binding('uv').errname`; full express-chat-npm runs end-to-end on G3 |
| 047 | Node 10 parity pass 13 — survey of 10 top npm packages (8/10 work clean); fixes whole-file `package.json` read, dev-tree Babel discovery, TLA CJS guard, drops `preset-env` `loose: true`; `npm install express@5 && node server.js` works end-to-end on G3 |
