# Session H summary (2026-04-23/24)

Follows session G. Session G ended with v0.7 shipped at 501 libraries
/ 1186 assertions — we crossed the 500-library mark.

This session was the **Node-interface rounding-out** push. Where G
expanded the event loop surface, H filled in the remaining utility
modules — `os` / `querystring` / `url` / `util` / `events` / `path`
polish — plus landed a real `child_process` via fork+exec+waitpid
and expanded `crypto` (SHA-224), polished `string_decoder` for
partial UTF-8. Library count moves from 501 → **504**; assertions
from 1186 → **1205**. v0.8 tagged + triad-validated + published.

## What shipped

### Runtime

Five waves of Node API rounding-out:

| Wave | Additions | Why it mattered |
|---|---|---|
| **1 — utility modules** | `os` (full — type/release/endianness/networkInterfaces/userInfo/constants), `querystring` (sep/eq/array-values/escape/unescape), `url` full (legacy parse/format/resolve + fileURLToPath/pathToFileURL), `util.parseArgs` + `isDeepStrictEqual` + `stripVTControlCharacters` + TextEncoder/Decoder, `events.once` Promise + `prependListener/prependOnceListener/rawListeners/eventNames`, `path.relative/normalize/parse/format/posix/win32/delimiter` | Libraries that pull `os.userInfo()` or `url.parse()` or `util.parseArgs()` used to bounce or behave weirdly; now they just work. |
| **2 — crypto + string_decoder** | SHA-224 (shared core with SHA-256, different IV + truncate), `crypto.randomInt`, `crypto.scrypt`/`scryptSync` stubs that throw clearly. `StringDecoder` with partial-multibyte UTF-8 buffering across `.write()` calls; `end()` emits `U+FFFD` for leftover bytes. | split2/through2 byte-at-a-time pipelines no longer corrupt non-ASCII on chunk boundaries. RFC 4231 HMAC-SHA224 vector verified. |
| **3 — zlib stub + stdin** | `zlib` module exposed with `createGzip`/etc + full `constants`; actual compress/decompress throws "not implemented". `process.stdin` Readable that drains `/dev/stdin` on first `'data'` listener (via `fs.readFileSync`). | Libraries that opportunistically `require('zlib')` (http clients that support gzip) no longer crash on import — only crash if they actually use it. CLI tools that read piped input via `stdin.on('data')` work. |
| **4 — child_process native** | New `src/node_compat/child_process.cpp` implementing `execSync`, `spawnSync`, `execFileSync` via real `fork`+`exec`+`waitpid`. Passes through `cwd`, `input` (stdin), `encoding` options. Non-zero `execSync` throws with `.status`/`.stdout`/`.stderr` on the error. `spawnSync` returns `{pid, status, signal, stdout, stderr}`. | Huge unlock: CLI tools that shell out to `git`, `grep`, `curl`, `sh -c` just work. `execSync("echo hi")` really does echo. Async `spawn`/`exec`/`fork` still throw (would need an event loop to do right). |
| **5 — library hunt** | Vendored and smoked three new CJS libs driven by the new surface: `filter-obj` (predicate/allowlist object filter), `is-relative-url` (inverse of `is-absolute-url`), `titleize`. Many other new APIs are exercised by already-vendored libs. | Library count 501 → 504. More importantly the new API code paths are exercised by real vendor code, not just in-house smokes. |

### Libraries: **501 → 504** (+3)

A modest +3 in raw count — the bigger win is that a lot of *existing*
libraries now hit the new API paths cleanly. Full suite: **1205 ok /
0 FAIL** on the triad.

### Docs

README Node API status table heavily revised:
- `os`: 🟡 Partial → ✅ Working (with full property list)
- `events`: added `.once()` Promise / `prependListener` / `eventNames`
- `util`: 🟡 Partial → ✅ Working (parseArgs / isDeepStrictEqual / stripVTControlCharacters landed)
- `child_process`: 🟡 Stub → ✅ Working (sync variants)
- `url`: 🟡 Via globals → ✅ Working (full legacy module)
- `querystring`: expanded notes (sep/eq/array-values/escape)
- `string_decoder`: noted partial-UTF-8 buffering
- `crypto`: added sha224 and randomInt, noted scrypt stubs
- `zlib`: ❌ Missing → 🟡 Stub (useful for library probes)
- `process.stdin`: new (was missing entirely)
- Library count: 501 → 504; assertion count: 1186 → 1205

### Release

v0.8 tagged, triad tarballs uploaded.

## Judgment calls

### SHA-512 deferred

SHA-224 was free (just a different IV + truncate on the existing
SHA-256 core). SHA-512 would need 64-bit arithmetic emulation via
hi/lo Uint32 pairs — doable but ~2-3 hours, and almost no library
*requires* SHA-512 (they all offer it as an option and fall back to
SHA-256 if not supported). Not worth the time-vs-reward compared to
getting the whole `child_process` story right.

### Zlib stub over real inflate/deflate

A real pure-JS inflate/deflate implementation (RFC 1950/1951) would
be 200-400 lines of non-trivial bit manipulation. Again, medium
payoff: most libraries only opportunistically use zlib (HTTP clients
that handle `Content-Encoding: gzip`), so stubbing with clear throws
lets them import without crashing and only fail if they actually
need compression. Added full `zlib.constants` so probes that gate on
e.g. `zlib.constants.Z_BEST_COMPRESSION !== undefined` succeed.

### child_process design: sync only

`spawn`/`exec`/`fork` (async) all throw with a clear message saying
"no event loop; use the sync variants." A real async child_process
would require:
- non-blocking pipe reads feeding 'data' events,
- waitpid-on-SIGCHLD via a signal handler or poll loop,
- integrating with our timer queue.

That's a legitimate piece of engineering and fits better with a
future "real event loop" push. For now, `execSync`/`spawnSync`
covers the 80% case: CLI tools that shell out to git/curl/grep,
test runners that invoke subprocesses, version probes.

### Buffer.toString UTF-8 invalid-input path

The existing `toString('utf8')` used `JS::UTF8CharsToNewTwoByteCharsZ`
which throws `JSMSG_BUFFER_TOO_SMALL` on invalid UTF-8. `StringDecoder`
sometimes decodes partial/invalid sequences during its flush, so we
changed `toString('utf8')` to fall back to the lossy converter
(`JS::LossyUTF8CharsToNewTwoByteCharsZ`, which emits U+FFFD) when
strict fails. Now invalid UTF-8 becomes replacement chars instead
of an exception — matches Node's behavior.

### `is-relative-url` needed a .default unwrap

The vendored `is-absolute-url` is the ESM build (`export default`).
Our vendor-path require resolves it but returns the ESM namespace
object, not the default export. Fixed inside the `is-relative-url`
vendor shim rather than making the require resolver ESM-aware (that's
a bigger change and risks breaking other consumers that expect the
namespace object).

## Not done

- **tape** still parked. Needs a real Readable `process.stdin`
  with backpressure + 8 sibling files.
- **Intl** still missing.
- **`http`/`https`/`net` async**: still sync-only.
- **SHA-512 / scrypt**: stubs throw.
- **zlib compress/decompress**: stubs throw.
- **module.createRequire**: still missing.

## Hand-off state

* 504 libraries with passing smokes, 1205 assertions on G3 / G4 / G5.
* v0.8 is the current tagged release; triad-validated; tarballs up.
* README has current API status.
* Session I next step: probably **real async child_process** (would
  require a mini event loop) or **SHA-512** (needed for some modern
  crypto libs) or **Intl polyfill** (multi-session; would unlock
  luxon, formatjs, etc.).
