# Session summary — 2026-04-22

Unsupervised churn session. Overnight, driving the "rinse and repeat,
run more libraries, fix what breaks, document everything" loop the
user asked for.

## End state

- **67 third-party libraries** working end-to-end on ionpower-node
  (was 30 at the start of the session).
- **404 `ok:`** assertion-level checks across the full `make test-all`
  run; **zero FAIL**s. (`make test-libs` covers 63 of the 67 libs;
  the rest live as node_modules-resolution demos.)
- **86 git commits total** in the repo (was ~30 at session start).

## Bridge additions this session

Each one was forced by a library that wouldn't load without it:

| Subsystem | Forced by | Detail |
|---|---|---|
| `process.stdout.write` / `process.stderr.write` (native) | simple CLIs, kleur | string + Uint8Array, EINTR-retry write loop |
| Shebang-line stripping in require | `#!/usr/bin/env node` | rewrite shebang bytes to spaces |
| Binary renamed `ionpower-node` → `node` | user request | matches the real Node name on PATH |
| `node_modules` resolution | real npm packages | walk up parents, read `package.json` main |
| JSON module require | mime-db | `.json` files parsed via JS_ParseJSON |
| UTF-8 source loading | iconv-lite, ssg em-dash bug | Evaluate via UTF-16, not Latin-1 |
| `crypto.randomBytes` / `getRandomValues` | uuid v4 | `/dev/urandom`-backed |
| `String.prototype.normalize` polyfill | slugify | identity fallback (no ICU) |
| Core modules `events`, `util`, `os`, `assert`, `buffer`, `stream`, `string_decoder`, `timers`, `querystring`, `url`, `net`, `tty`, `child_process` | commander, xml2js, sax, debug | JS-level shims in bootstrap |
| `Buffer.isBuffer` native | js-yaml | delegates to `JS_IsUint8Array` |
| `events` module = `EventEmitter` constructor | xml2js CoffeeScript inheritance | Node-compat identity, not `{EventEmitter:fn}` wrapper |

## SM45 bugs documented

- **destructuring-default scope bug.** `var x = 1; var {y = x} = {};`
  inside a function throws `ReferenceError: x is not defined`.
  Repros in stock `js` shell too, so VM-level, not bridge. Blocks
  `cli-table3`. Repro at
  `test/sm45_destructuring_defaults_repro.js` (exits 0 on confirm).

## Libraries added this session (30 → 67)

In commit order:

    30. nanoid             — first multi-file CJS (.cjs extension)
    31. ms                 — duration parser
    32. strip-ansi         — via npm tree (ansi-regex)
    33. deepmerge          — object merge
    34. fast-deep-equal    — object equality
    35. color-convert      — color space conversion (via nm tree)
    36. color-name         — CSS named colors
    37. lunr               — full-text search
    38. moment             — legacy date lib
    39. showdown           — markdown alt
    40. minimatch          — glob matching (via nm tree)
    41. object-hash        — structural hash
    42. validator          — string validators
    43. qrcode-generator   — QR codes
    44. tweetnacl          — ed25519 + XSalsa20 + SHA-512
    45. big.js             — arbitrary precision decimal
    46. mime-types         — MIME types (JSON module)
    47. markdown-it        — third markdown engine
    48. sax                — streaming XML parser
    49. xml2js             — XML ↔ object
    50. xmlbuilder         — XML builder (xml2js dep)
    51. prism              — syntax highlighter
    52. immer              — immutable updates via Proxy
    53. chance             — random data generator
    54. ini                — INI config parser
    55. slugify            — URL-safe slugs
    56. mitt               — 200 B pub/sub
    57. ramda              — functional utilities
    58. pluralize          — English pluralization
    59. debug              — logger (via nm tree)
    60. base-x             — base-N encoding
    61. moo                — fast lexer
    62. clone              — deep clone
    63. ejs                — embedded JS templates
    64. dequal             — tinier deep equal (Map, Set)
    65. dotenv             — .env loader
    66. sprintf-js         — printf-style formatting
    67. (running count)

Libraries attempted but blocked (see compat.md):
- **zod** — object spread in class bodies (ES2018)
- **fs-extra** — object spread everywhere
- **cli-table3** — hit the SM45 destructuring-default bug
- **chalk 4/5** — object spread in class bodies
- **highlight.js** — optional chaining + export syntax
- **iconv-lite** — loads, but decode path has an internal issue
  with our Uint8Array-backed Buffer shim (encode works)

## Second demo

[demos/ssg/](../demos/ssg/) was upgraded to v2: now uses **js-yaml**
frontmatter + **markdown-it** body + **prism** syntax highlighting +
**slugify** slugs + **handlebars** layout. 7 libraries cooperating
in one 365 ms build-all on the G5.

## `make test-all` at end of session

    404 ok: checkpoints
    63 "smoke: ... passed" footers
    53 "all assertions passed"
    0 FAIL
    0 make errors

## Ideas for the next session

In rough priority order:

1. **Transpile-on-require hook.** Modern libraries that use `?.`, `??`,
   object spread, etc., still fail. With @babel/standalone already
   working, bolt it into `require()` as a preprocessor so `.js`
   files load transparently after transpilation. One of the highest
   compatibility multipliers we can add.
2. **Fix iconv-lite's decode path** by upgrading the Buffer shim.
   iconv expects a real Buffer with `.readUInt16LE`, slice, etc.
   Adding even a few methods opens the door to many more libs that
   round-trip through Buffer.
3. **A real blog/site generator demo** built on the ssg v2 pipeline —
   recursively walk an input tree, build navigation, etc. Would
   exercise fs.readdirSync + path.join + our other pieces in a
   bigger workflow.
4. **G3/G4 SpiderMonkey builds.** Only G5 variant exists. Building
   `-mcpu=7450` and `-mcpu=750` variants is script changes + wait time.
5. **`fs.appendFileSync`, `fs.copyFileSync`, `fs.chmodSync`.**
   Trivial bridge additions, covers common patterns.
6. **Better `util.inspect`** — ours is tiny. A fuller one unlocks
   prettier console output.
7. **More libraries queued**: `nearley`, `inquirer`, `ora` (spinner;
   async), `figlet`, `htmlparser2`, `jsonwebtoken` (needs Buffer
   polish), `jimp` (huge, probably no-go).

Resume from `docs/compat.md` which lists what works and the gaps.
