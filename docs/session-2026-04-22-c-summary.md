# Session summary — 2026-04-22 (round C)

Third pass of the same day. Started from commit `d0d945a` (88
libraries, 480 ok, 0 FAIL; session B finished) and pushed the library
count into the mid-150s while landing an HTTP client, finishing the
G3 SpiderMonkey build infrastructure, and documenting a whole pile
of secondary Node-compat features.

## End state (so far)

- **155 third-party libraries** working (was 88 at session-B close).
- **643 `ok:`** assertion-level checks across `make test-all`;
  **zero FAIL**.
- G3 SpiderMonkey build running to completion on imacg3 in the
  background (last-step dsymutil at session-summary write-time).
  libmozjs-45.a + libmozglue.dylib have already been produced.
- Big JWT / htmlparser2 / HTTP / Buffer improvements.

## Bridge additions this session

Driven by what a particular library needed:

| Subsystem | Forced by | Detail |
|---|---|---|
| `crypto.createHash('sha256')` | jws / jwa / jsonwebtoken | FIPS 180-2 SHA-256 inlined in bootstrap JS; `'abc'` / `''` vectors byte-for-byte |
| `crypto.createHmac('sha256', key)` | jws / cookie-signature | RFC 4231 HMAC-SHA-256 vectors 1 and 2 pass; streaming update() + digest(enc) |
| `crypto.KeyObject` + `createSecretKey` + `createPrivateKey` + `createPublicKey` (stubs) | jsonwebtoken's sign.js `instanceof KeyObject` gate + jwa's `typeof createPublicKey === 'function'` check | instanceof-true for wrappers; createPrivate/Public throw (HMAC-only) |
| `crypto.timingSafeEqual` | ecdsa-sig-formatter path of jwa | constant-time byte compare over Uint8Array |
| `Buffer` is a real function (not a plain object) | safe-buffer `Object.create(Buffer.prototype)` + deep-extend's `val instanceof Buffer` | ctor function with .prototype = Uint8Array.prototype; `new Buffer(n)` works |
| `Buffer.allocUnsafe`, `Buffer.byteLength`, `Buffer.concat` | jws + deep-extend | thin wrappers over existing alloc/from; utf8 byte count |
| require path canonicalization | semver's `require('./foo')` infinite recursion | collapse `./` and `..` segments in ResolveModule so cache keys are unique per logical file |
| `stream` core module is the Stream ctor itself | jws `util.inherits(SignStream, Stream)` | was a wrapper object; now Stream.Readable / Writable / etc. are properties on the ctor (like Node) |
| `self` global aliases to `globalThis` | hashids UMD (`typeof self === 'object'`) | bootstrap sets self=global when undefined |
| `TextEncoder` / `TextDecoder` on top of Buffer | murmurhash | tiny wrapper; Encode/decode UTF-8 through existing Buffer.from / Uint8Array.toString |
| `Array.prototype.flat` / `flatMap` polyfill | array-differ | ES2019 addition; pure-JS fallback |
| `Object.entries` / `values` / `fromEntries` polyfills | future libs | ES2017/2019 |
| `String.prototype.trimStart` / `trimEnd` | future libs | aliases of existing trimLeft/Right |
| **http module** — `http.getSync(url, opts)` / `postSync(url, body, opts)` | natural next step | shells out to `/opt/tigersh-deps-0.1/bin/curl` via fork+exec; auto CA bundle detection; headers+body via tmp files; returns `{status, headers, body, bodyBytes}`. Sync-only. `http.request/createServer` throw. |
| `fs.appendFileSync` / `copyFileSync` / `chmodSync` | already landed in session B; kept | — |
| `http` and `https` seeded into `__require_cache__` | — | both resolve to the same curl-backed impl (curl speaks both) |

## Libraries landed this session (88 → 155)

Selected highlights:
- **htmlparser2** (89) — first big multi-file package shipped via a
  `test/vendor/nm/node_modules/` subtree checked into the repo; all its
  deps (entities, domhandler, domutils, domelementtype, dom-serializer)
  resolve via the node_modules walk-up.
- **jsonwebtoken** (90) — the big one. Forced: createHmac, KeyObject,
  path canonicalization, Stream-as-ctor, Buffer-as-function. Signs +
  verifies HS256 and rejects wrong secrets.
- **preact** (148) — a VDOM React clone; exercises h() / Fragment /
  cloneElement without a DOM.
- **ua-parser-js** (147) — correctly identifies TenFourFox 45 as
  Firefox 45 on Mac OS 10.4 / ppc.
- **diff-match-patch** (128) + **diff-sequences** (132) — real diff
  engines (Google's DMP; Jest's Myers).
- **xxhashjs** (113), **jsbn** (114), **crc-32** (115), **fnv-plus**
  (118), **fastest-levenshtein** (116), **murmurhash** (112) — a
  whole hash / distance cluster.
- **Fraction.js** (124), **big-integer** (131), **bignumber.js** (already
  had), **decimal.js** (already had) — all four arbitrary-precision
  number libs.
- **lz-string** (154), **parse-ms** (155).

Full row-by-row table lives in `docs/compat.md`.

## Items completed

- Item 4 (G3/G4 build): G3 build on imacg3 is running to completion
  (dsymutil stage when this was written; all .o files built, js
  shell linked). Scripts updated with a proper two-step pthread_
  setname_np patch and m4-1.4.19 / make-4.3 / /usr/local/bin
  on PATH. emac G4 bootstrap *partial*: tiger.sh + python2-2.7.18 +
  pip/setuptools + m4 + make-4.3 + autoconf-2.13 + gcc-4.9.4 +
  cctools-667.3 + ld64-97.17 all installed, but emac lacks Xcode
  2.5's /usr/lib/crt1.o and /Developer/SDKs/MacOSX10.4u.sdk, and
  installing those requires manual GUI work (`open` the Xcode
  Installer Launcher.app). Documented as a next-session follow-up.
- Item 7 (library batch): 155 total is +67 over the session start.

## Demo added

[demos/http-fetch/fetch-and-render.js](../demos/http-fetch/fetch-and-render.js)
— fetches a GitHub repo's README over HTTPS (via our http.getSync),
base64-decodes the API blob through `Buffer.from(blob, 'base64')`,
renders with markdown-it, writes HTML. Works end-to-end on imacg52
against the live api.github.com.

## `make test-all` at session write-up

    643 ok: checkpoints
    0 FAIL
    0 make errors
    ~130 smokes

## Ideas for the next session

1. **Finish the G3 build**: `/opt/mozjs-45-ionpower-g3/bin/js` smoke,
   rebuild ionpower-node against the -g3 prefix, confirm 643 ok on
   a G3 iMac.
2. **emac G4 bootstrap**: install Xcode 2.5 (GUI step) OR scp
   /Developer/SDKs/MacOSX10.4u.sdk and /usr/lib/crt*.o from imacg52
   — both would require sudo, which we don't have. A third option:
   cross-build the G4 variant on imacg52 using a separate tenfourfox
   source tree + OBJDIR (`build_OPT.OBJ.g4`).
3. **zlib / gzip via curl**: curl can decompress gzip response bodies
   via `--compressed`; we should pipe through that on http.getSync by
   default and expose a native gzip for non-HTTP bytes (alternative
   to pako's JS path, which works but is slow on PPC).
4. **WHATWG URL**: normalize-url wants a real URL global. Could map
   it to url-parse + wrap.
5. **Push toward 200 libraries**: plenty of single-file CJS bundles
   still left on unpkg.
