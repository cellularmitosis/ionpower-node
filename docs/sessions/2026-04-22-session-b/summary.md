# Session summary — 2026-04-22 (continuation B)

Second pass over the same day. Started from commit `f21f861` (67
libraries, 404 ok) and worked through the 7-item "Ideas for the next
session" list end-to-end.

## End state

- **88 third-party libraries** working (was 67). All 21 new ones have
  committed smoke tests + `make test-libs` entries.
- **480 `ok:`** assertion-level checks across `make test-all`;
  **zero FAIL**.
- **13 new commits** landed on `main` today.

## Items completed

### 1. Transpile-on-require hook for Babel

`require.cpp` now catches parse failures, calls a JS-side
`__try_babel_transpile__(absPath, rawSrc, mtime)`, and re-evaluates
the returned ES5 source. Babel is lazy-loaded from `test/vendor/babel.js`
(or `$IONPOWER_BABEL_PATH`). Results are memoized in-process and
persisted to `~/.ionpower-cache/babel-v1/<flattenedPath>.js` keyed by
source mtime. First-time transpile: ~5.6 s on G5. Cached: ~12 ms.
Opt-out via `IONPOWER_NO_BABEL=1`. `camelcase@6` is the first real
library that loads through it (uses `\p{Lu}` unicode regex).

### 2. Upgrade Buffer shim (iconv-lite decode)

`Buffer.from(str, enc)` and `Buffer#toString(enc)` now handle utf8,
ucs2/utf16le, latin1/binary/ascii, base64, hex. `Buffer.alloc(n, fill)`
respects the fill byte. `Uint8Array.prototype` patched with
`readUInt{8,16LE,16BE,32LE,32BE}`, `readInt*`, `writeUInt*`, `copy`,
`equals`, `fill`. iconv-lite smoke now round-trips latin1, utf8,
utf16-le, and win1252.

### 3. Blog generator demo

`demos/blog/` recursively walks `input/**/*.md`, renders via
markdown-it + prism, slugifies titles, emits per-post HTML with
prev/next links (date-sorted), builds an index page, and ships an
`rss.xml` via `xml2js.Builder`. Five sample posts in two
subdirectories. ~540 ms end-to-end on G5.

### 4. G3 and G4 SpiderMonkey build scripts

- `scripts/install-mozjs-45-ionpower-g3.sh` (`-mcpu=750 -mtune=750`)
- `scripts/install-mozjs-45-ionpower-g4.sh` (`-mcpu=7450 -mtune=7450`
  with `-falign-*=16`)

Three host-specific fixes baked in as idempotent in-place patches:
- `pthread_setname_np` short-circuit (Leopard-only, same as G5)
- mozbuild virtualenv.py pass `--system-site-packages --no-pip
  --no-setuptools` (bundled pip-6.0.6 wheel is broken)
- `PATH` prepends `/opt/make-4.3/bin/` (Tiger's 3.80 is rejected)

Full bootstrap sequence documented in `docs/g3-g4-builds.md`.

**Actual build status at session end**: imacg3 build running in
background (cc1plus deep inside `js/src/jit/osxppc/CodeGenerator-ppc.cpp`);
probably 1-2 hours to install completion. emac (G4) bootstrap not
started — the fleet host lacks tiger.sh, python2-2.7.18, and
autoconf-2.13, a full bootstrap that would take hours. Scripts are
ready to run there; documentation lists the steps.

### 5. fs.appendFileSync / copyFileSync / chmodSync

Pattern-matches the existing sync helpers. `test/fs_extras_smoke.js`
exercises create+grow, overwrite, 0600 ↔ 0644 chmod round-trip.

### 6. Better util.inspect

Depth-limited (default 2), cycle-safe. Date → ISO, RegExp → toString,
Error → `Name: message` + 3 stack frames, Function → `[Function: n]`,
Map/Set with size header + up to 20 entries, Uint8Array with 16-byte
preview, plain objects with a non-'Object' ctor prefix.

### 7. Library batch (+21 new)

Downloaded from unpkg as UMD/CJS into `test/vendor/`:

    68. nearley         parser combinator engine (no lexer)
    69. bignumber.js    arbitrary-precision decimal
    70. decimal.js      arbitrary-precision decimal (sqrt/ln)
    71. camelcase       string case (loads via babel fallback)
    72. pretty-bytes    human-readable byte sizes
    73. figlet          ASCII banner fonts + Standard.flf
    74. fecha           small date format/parse
    75. randomcolor     seeded pleasant color gen
    76. classnames      conditional CSS class join
    77. tiny-emitter    200-byte event emitter
    78. fast-json-stable-stringify  deterministic JSON
    79. uniq            array deduplication
    80. JSZip           in-memory zip read/write
    81. hashids         obfuscated short IDs (forced `self` alias)
    82. jmespath        JSON query language
    83. seedrandom      seeded PRNG (MT/ARC4)
    84. alea            tiny fast seeded PRNG
    85. escape-html     HTML entity escaper
    86. rfc6902         JSON Patch (RFC 6902)
    87. fast-memoize    function memoization
    88. tiny-warning    conditional console.warn

Blocked (documented in compat.md):
- **luxon** — requires Intl (we build `--without-intl-api`)
- **date-fns** — imports `@babel/runtime/helpers/interopRequireDefault`
- **node-html-parser** — multi-file TS output
- **color-string** — needs color-name + simple-swizzle (transitive)
- **hyperid** — multi-file (`./uuid-node`)
- **isemail** — requires `punycode` (not shipped)
- **object-sizeof** — multi-file (`./byte_size`, `buffer/`)
- **json-stable-stringify** — pulls isarray, object-keys, call-bind
- **dompurify** — needs DOM (`window.document`)

## Bridge additions this session (non-library)

| Subsystem | Trigger | Detail |
|---|---|---|
| Babel-on-require hook (`require.cpp` + bootstrap JS) | modern libs | catch parse failure, transpile, re-evaluate; mem + disk cache |
| `Buffer.from/toString` encodings + Uint8Array proto methods | iconv-lite decode | ucs2/latin1/base64/hex; read/write Int/UInt 8/16/32 LE/BE; copy/equals/fill |
| `fs.appendFileSync`, `copyFileSync`, `chmodSync` | item 5 | same sync-pattern as other helpers |
| `util.inspect` rewrite | item 6 | depth/cycles/Date/RegExp/Error/Map/Set/Uint8Array |
| `self` global alias | browser-UMD libs (hashids) | set `globalThis.self = globalThis` in bootstrap |

## `make test-all` at end of session

    480 ok: checkpoints
    0 FAIL
    0 make errors

## Ideas for the next session

1. **Finish the G3 build.** Check on imacg3 after a few hours; if
   `/opt/mozjs-45-ionpower-g3/bin/js` materializes, verify a
   `print("hello")` smoke and rebuild ionpower-node against the -g3
   prefix for a "runs on a real G3 iMac" milestone.
2. **Bootstrap emac and run the G4 build.** Install tiger.sh,
   python2-2.7.18, autoconf-2.13, make-4.3 (~15-30 min of host
   preparation, then the ~2-hour build).
3. **jsonwebtoken** — now that Buffer has ucs2/latin1/base64 support,
   try the JWT sign/verify path. Needs HMAC over the Buffer shim.
4. **htmlparser2** — vendor the node_modules tree (entities,
   domhandler, domutils, domelementtype) and try the full parse path.
5. **Add a simple HTTP client on top of curl.** Not a real event loop,
   just `http.getSync(url) -> {status, headers, body}` via
   `exec("/opt/tigersh-deps-0.1/bin/curl -s ...")` or a direct
   `CFHTTP*` wrapping. Would unblock node-fetch-style library loading.
6. **stringify-package/package-json** parsing utilities, 2-3 more tiny
   libs that might push the count to 100.
7. **Document the session B story.** This file is the start; a
   followup pass tidying `docs/compat.md`'s flow and linking the
   blog demo from README.md.
