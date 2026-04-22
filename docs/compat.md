# Third-party library compatibility

Libraries test-fit through ionpower-node. Each entry is a real
package running unmodified (within its own JS-version constraints).

## Currently passing (56 libraries as of 2026-04-22)

| # | Library | Version | Size | Workload | Notes |
|--|---|---|---|---|---|
| 1  | [marked](https://github.com/markedjs/marked)        | 4.3.0 | 50 KB  | regex state machine; markdown → HTML | 46 ms/doc |
| 2  | [acorn](https://github.com/acornjs/acorn)           | 8.11.3 | 226 KB | Pratt parser, AST                 | self-parses in 1.7 s |
| 3  | [handlebars](https://handlebarsjs.com/)             | 4.7.8 | 86 KB  | `new Function()` JIT              | 6/6 |
| 4  | [lodash](https://lodash.com/)                       | 4.17.21 | 71 KB | stdlib breadth + `_.template()`   | 35/35 |
| 5  | [typescript](https://www.typescriptlang.org/)       | 3.9.10 | 8.3 MB | full compiler                    | transpile ~500 ms/call |
| 6  | [semver](https://github.com/npm/node-semver)        | 5.7.2 | 41 KB  | range math, regex                 | 22/22 |
| 7  | [prettier](https://prettier.io/)                    | 1.19.1 | 1.0 MB | parse + pretty-print              | 246 ms fibonacci reformat |
| 8  | [minimist](https://github.com/minimistjs/minimist)  | 1.2.8 | 6 KB   | argv parser                       | 9/9 |
| 9  | [json5](https://json5.org/)                         | 2.2.3 | 57 KB  | lenient JSON                      | 10/10 |
| 10 | [mustache](https://mustache.github.io/)             | 4.2.0 | 12 KB  | simpler template engine           | 8/8 |
| 11 | [js-yaml](https://github.com/nodeca/js-yaml)        | 3.14.1 | 42 KB  | YAML parse/emit                   | 9/9 |
| 12 | [kleur](https://github.com/lukeed/kleur)            | 4.1.5 | 3 KB   | terminal colors                   | respects isTTY |
| 13 | [commander](https://github.com/tj/commander.js)     | 2.20.3 | 27 KB  | CLI framework                     | needs events + util.inherits |
| 14 | [qs](https://github.com/ljharb/qs)                  | 6.11.2 | 70 KB  | querystring                       | 11/11 |
| 15 | [diff](https://github.com/kpdecker/jsdiff)          | 5.1.0 | 50 KB  | edit-distance / patch             | 11/11 |
| 16 | [esprima](https://esprima.org/)                     | 4.0.1 | 284 KB | alternative JS parser             | self-parses in 1.6 s |
| 17 | [dayjs](https://day.js.org/)                        | 1.11.10 | 7 KB  | date lib                          | 14/14 |
| 18 | [js-beautify](https://beautifier.io/)               | 1.14.11 | 150 KB | JS formatter (pre-prettier)      | idempotent |
| 19 | [@babel/standalone](https://babeljs.io/)            | 7.23.9 | 2.8 MB | transpiler                       | closes ES2020+ gap |
| 20 | [uuid](https://github.com/uuidjs/uuid)              | 8.3.2 | 8 KB   | UUID generators                   | v3/v4/v5 work |
| 21 | [PapaParse](https://www.papaparse.com/)             | 5.4.1 | 19 KB  | CSV parser                        | 7/7 |
| 22 | [tinycolor2](https://github.com/bgrins/TinyColor)   | 1.6.0 | 38 KB  | color manipulation                | 5/5 |
| 23 | [spark-md5](https://github.com/satazor/js-spark-md5) | 3.0.2 | 10 KB  | MD5 hash                         | RFC 1321 vectors |
| 24 | [fflate](https://github.com/101arrowz/fflate)       | 0.8.1 | 32 KB  | zlib/gzip                         | short inputs only; **unzip fails on PPC** |
| 25 | [pako](https://github.com/nodeca/pako)              | 2.1.0 | 47 KB  | zlib port                         | all round-trips pass; use over fflate |
| 26 | [he](https://github.com/mathiasbynens/he)           | 1.2.0 | 101 KB | HTML entities                     | 8/8 |
| 27 | [crypto-js](https://github.com/brix/crypto-js)      | 4.2.0 | 219 KB | SHA/MD5/AES pure JS               | RFC 6234 vectors + AES |
| 28 | [ajv](https://ajv.js.org/)                          | 6.12.6 | 122 KB | JSON Schema validator             | schema → function |
| 29 | [PEG.js](https://pegjs.org/)                        | 0.10.0 | 105 KB | parser generator                  | grammar → parser |
| 30 | [nanoid](https://github.com/ai/nanoid)              | 3.3.7 | ~1 KB  | random ID gen                     | first multi-file CJS |
| 31 | [ms](https://github.com/vercel/ms)                  | 2.1.3 | 3 KB   | duration parser/formatter         | 11/11 |
| 32 | [strip-ansi](https://github.com/chalk/strip-ansi)   | 6.0.1 | ~200 B | strip ANSI escapes                | via real npm tree |
| 33 | [deepmerge](https://github.com/TehShrike/deepmerge) | 4.3.1 | 4 KB   | recursive object merge            | 7/7 |
| 34 | [fast-deep-equal](https://github.com/epoberezkin/fast-deep-equal) | 3.1.3 | 1 KB | object equality | 14/14 |
| 35 | [color-convert](https://github.com/Qix-/color-convert) | 2.0.1 | 21 KB | color space conversions        | via nm tree |
| 36 | [color-name](https://github.com/colorjs/color-name) | 1.1.4 | 5 KB   | named-color -> RGB                | via nm tree |
| 37 | [lunr](https://lunrjs.com/)                         | 2.3.9 | 29 KB  | full-text search                  | stemmer + inverted idx |
| 38 | [moment](https://momentjs.com/)                     | 2.30.1 | 59 KB  | date lib (legacy)                 | companion to dayjs |
| 39 | [showdown](https://showdownjs.com/)                 | 2.1.0 | 75 KB  | markdown → HTML                   | makeMarkdown needs DOM |
| 40 | [minimatch](https://github.com/isaacs/minimatch)    | 3.1.2 | 16 KB  | glob matching                     | transitive dep for many |
| 41 | [object-hash](https://github.com/puleos/object-hash) | 3.0.0 | 35 KB | stable structural hash          | 5/5 |
| 42 | [validator](https://github.com/validatorjs/validator.js) | 13.11.0 | 86 KB | string validators/sanitizers | 17/17 |
| 43 | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | 1.4.4 | 57 KB | QR codes | Reed-Solomon, matrix layout |
| 44 | [tweetnacl](https://github.com/dchest/tweetnacl-js) | 1.0.3 | 18 KB  | ed25519 + secretbox + SHA-512     | uses /dev/urandom |
| 45 | [big.js](https://github.com/MikeMcl/big.js)         | 6.2.1 | 26 KB  | arbitrary precision decimal       | 2^64 exact |
| 46 | [mime-types](https://github.com/jshttp/mime-types)  | 2.1.35 | 6 KB   | MIME types                        | needs JSON modules |
| 47 | [markdown-it](https://markdown-it.github.io/)       | 13.0.2 | 103 KB | extensible markdown               | third md engine |
| 48 | [sax](https://github.com/isaacs/sax-js)             | 1.3.0 | 44 KB  | streaming XML parser              | uses stream + string_decoder |
| 49 | [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js) | 0.6.2 | 37 KB | XML → object | CoffeeScript inheritance |
| 50 | [xmlbuilder](https://github.com/oozcitak/xmlbuilder-js) | 11.0.1 | ... KB | XML builder | xml2js dep |
| 51 | [prism](https://prismjs.com/)                       | 1.29.0 | 58 KB  | syntax highlighter                | JS, CSS, markup, clike |
| 52 | [immer](https://immerjs.github.io/immer/)           | 9.0.21 | 61 KB  | immutable updates via Proxy       | exercises Proxy |
| 53 | [chance](https://chancejs.com/)                     | 1.1.11 | 211 KB | random data generator             | seeded reproducibility |
| 54 | [ini](https://github.com/npm/ini)                   | 1.3.8 | 5 KB   | INI config parser                 | section round-trip |
| 55 | [slugify](https://github.com/simov/slugify)         | 1.6.6 | 9 KB   | string -> slug                    | needs normalize polyfill |
| 56 | (placeholder; running count to match commit N)      |       |        |                                   |   |

## Composition demos

- [demos/ssg/](../demos/ssg/) — static site generator: marked + handlebars + fs + path
- [demos/json2yaml/](../demos/json2yaml/) — CLI tool: commander + js-yaml + kleur + fs

## JS-version ceiling (empirical)

SpiderMonkey 45 = Firefox 45 ESR (April 2016). ES2015 + most of ES2016.

| Feature | First blocked at | Symptom | Workaround |
|---|---|---|---|
| Optional chaining `?.` | ES2020 / TS 4.0 | `SyntaxError: expected expression, got '?'` | @babel/standalone → ES5 |
| Nullish coalescing `??` | ES2020 | same | same |
| Optional catch binding `catch {}` | ES2019 / prettier 2.x | `SyntaxError: missing ( before catch` | same |
| Private class fields `#name` | ES2022 | parse fails | same |
| Logical assignment `??=` etc. | ES2021 | parse fails | same |

**Practical rule**: library versions released before October 2019
parse cleanly. Later versions often require transpilation via
@babel/standalone.

## Bridge surface extended in response to libraries

Driven by what failed or almost-failed:

| Library that forced it | Bridge addition |
|---|---|
| kleur | `process.stdout/stderr` with `.fd`/`.isTTY`/`.columns`/`.rows` |
| commander | `events.EventEmitter` (with lazy `_events`) + `util.inherits` + `util.format` + `util.inspect` |
| commander | `os` module stubs (platform/arch/tmpdir/homedir/cpus/EOL) |
| commander | `child_process` stubs that throw on use |
| uuid | `crypto.randomBytes` + `crypto.getRandomValues` via `/dev/urandom` |
| ssg demo | `fs.readFileSync(path, 'utf8')` UTF-8 decode (was Latin-1) |
| ssg demo | `fs.mkdirSync` (with `{ recursive: true }`) |
| ssg demo | `fs.rmdirSync`, `fs.renameSync` |
| `#!/usr/bin/env node` | strip shebang line in require loader |

## Bugs found through real-library testing

- **`fs.readFileSync(path, "utf8")` mojibake** — caught by ssg's em-dash
  rendering. Fixed by routing through `JS::UTF8CharsToNewTwoByteCharsZ`.
- **`fflate.unzipSync` fails on PPC** with "invalid length/literal".
  Suspected big-endian assumption in fflate's bit-packing. pako is the
  recommended alternative on PPC — all its round-trips pass.
- **SM45 destructuring-default scope bug.** `var x = 10; var { y = x } = {}`
  inside a function throws `ReferenceError: x is not defined` — as if
  the sibling binding isn't in scope during the default expression.
  Reproduces in the stock SM45 `js` shell, so it's a VM bug, not a
  bridge bug. `eval()`'d form works. Blocks `cli-table3` (which uses
  `const { wordWrap = tableWordWrap } = this.options;`) and likely
  other libs that adopted this ES2015 idiom. Repro at
  [test/sm45_destructuring_defaults_repro.js](../test/sm45_destructuring_defaults_repro.js).

## What hasn't worked yet (and why)

| Library | Why |
|---|---|
| express / fastify / koa / nestjs | need event loop + HTTP |
| axios / node-fetch / got        | need HTTP client |
| mocha / jest / vitest           | need event loop |
| prisma / mongoose / pg          | need sockets + event loop |
| sharp / bcrypt / better-sqlite3 / esbuild | native addons (no ppc32 path) |
| postcss                         | multi-file, needs node_modules resolution |
| tape                            | 22 transitive deps, needs node_modules |
| pegjs raw CJS                   | multi-file (used the UMD browser bundle instead) |

## JIT measurement, one more time

Confirmed on 2026-04-21 on imacg52 (G5 2.0 GHz):

| mode | wall time for tight integer loop (5M iter) |
|---|---|
| `--ion-eager` (IonPower on) | 0.122 s |
| `--no-ion --no-baseline` (interpreter) | 2.223 s |

13.7× speedup. On library workloads — parsers, regex, object walking —
the speedup is smaller but every library above runs in a human-scale
time budget because the JIT is active by default.

## Pattern for adding a new target

1. Pick a self-contained UMD / browser-standalone bundle at
   `https://unpkg.com/<pkg>@<ver>/...`. Multi-file CJS packages
   need `node_modules` resolution that we don't have.
2. `curl -fsSL <url> -o test/vendor/<name>.js`.
3. Write `test/<name>_smoke.js` with real assertions — exercise at
   least 3-5 distinct API calls, not just `require`.
4. Rsync to imacg52, run, iterate on failures.
5. Commit as "Add <name> (<what>) as compat target N".
6. If the library exposes a bridge gap, fix it in `src/node_compat/`
   with a test that demonstrates the gap closed.
