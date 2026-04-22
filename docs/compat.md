# Third-party library compatibility

Libraries test-fit through ionpower-node. Each entry is a real
package running unmodified (within its own JS-version constraints).

## Currently passing

| Library | Version | Size | Workload stressed | Status |
|---|---|---|---|---|
| [marked](https://github.com/markedjs/marked) | 4.3.0 | 50 KB | regex state machine, markdown→HTML | all assertions pass, 46 ms/doc |
| [acorn](https://github.com/acornjs/acorn) | 8.11.3 | 226 KB | Pratt parser, AST, error throwing | self-parses in 1.7 s |
| [handlebars](https://github.com/handlebars-lang/handlebars.js) | 4.7.8 | 86 KB | `new Function()`, eval-path JIT | all 6 assertions pass |
| [lodash](https://github.com/lodash/lodash) | 4.17.21 | 71 KB | stdlib breadth, `_.template()` | 35/35 assertions pass |
| [typescript](https://www.typescriptlang.org/) | 3.9.10 | 8.3 MB | compiler, visitor patterns, checker | 2 transpiles correct, 530 ms each |
| [semver](https://github.com/npm/node-semver) | 5.7.2 | 41 KB | range parsing, regex-heavy | 22/22 assertions pass |
| [prettier](https://prettier.io/) | 1.19.1 | 1.0 MB | parse + pretty-print | 246 ms to reformat a fibonacci block |

## Composition demo

[demos/ssg/](../demos/ssg/) is a minimal static site generator that
composes `marked` + `handlebars` + `fs` + `path`. Reads `input/*.md`,
renders through marked, wraps in a handlebars template, writes
`output/*.html`. Three content pages build in 205 ms on imacg52.

## JS-version ceiling (empirical)

SpiderMonkey 45 is Firefox 45 ESR (April 2016). It supports most
of ES2015 and ES2016. The features we've observed breaking:

| Feature | First blocked at | Symptom |
|---|---|---|
| Optional chaining `?.` | ES2020 / TS 4.0 | `SyntaxError: expected expression, got '?'` |
| Nullish coalescing `??` | ES2020 | same |
| Optional catch binding `catch {}` | ES2019 / prettier 2.x | `SyntaxError: missing ( before catch` |
| Private class fields `#name` | ES2022 | not tested, will fail parse |
| Logical assignment `??=` `&&=` `\|\|=` | ES2021 | not tested, will fail parse |
| Top-level await | ES2022 modules | N/A (we're CJS-only) |

**Practical rule**: pick the last library version released before
October 2019 for problem-free loading. Everything after that has
a nonzero chance of using ES2020 syntax in its bundled form.

Workaround for modern versions: transpile the bundle through
TypeScript first (we run TS 3.9.10 natively), targeting `es2018`.
Untested but should work — would let us load marked 12 / lodash 5
if we want to stay current.

## Pattern for adding a new target

1. Pick a library with a self-contained UMD / standalone bundle at
   `https://unpkg.com/<name>@<ver>/...`. Multi-file CJS packages
   need `node_modules` resolution that we don't have yet.
2. `curl -fsSL <unpkg url> -o test/vendor/<name>.js`.
3. Write `test/<name>_smoke.js` with real assertions (don't just
   call `require` — exercise at least 3–5 distinct API calls).
4. Rsync the vendor file and the smoke test to imacg52, run, iterate.
5. On success, commit as `Add <name> (<what>) as Nth compatibility
   target`. The commit message should say what workload it stresses
   that the previous ones didn't.

## What we haven't tried yet

High-value but not yet attempted:

- **prettier 2.x** — pure JS, CPU-bound, formats JS. Probably works.
- **@babel/standalone 7.x** — Babel with all plugins inlined. Very
  heavy; might need heap bump.
- **esprima / espree** — alternative JS parsers, good comparisons
  against acorn.
- **semver** — tiny, should be trivial.
- **yaml (eemeli/yaml)** — YAML parser; file-I/O-capable real task.

## Bugs found through real-library testing

- **`fs.readFileSync(path, "utf8")` returned mojibake.** Caught by the
  ssg demo: em-dashes (`—`, U+2014) rendered as `â` in the generated
  HTML. Root cause: JS_NewStringCopyN interprets bytes as ISO-Latin-1.
  Fixed by routing through `JS::UTF8CharsToNewTwoByteCharsZ`
  (js/CharacterEncoding.h) to decode UTF-8 → UTF-16 before building the
  JS string. Commit 09397fd.

Known to fail without bridge work (not yet attempted):

- **mocha / jest / vitest** — need event loop.
- **axios / node-fetch / got** — need http.
- **express / fastify / koa** — need http + event loop.
- **pg / mongoose / mysql2** — need sockets + event loop.
- **sharp / bcrypt / better-sqlite3** — need native addons (no
  path to this on ppc32 Tiger).
- **tape** — might work if the test doesn't use real async. Not
  confirmed.

## JIT effect, measured

One direct IonPower-on-vs-off comparison we've run (the tight
integer loop from test/verify_jit.js, executed via stock `js`
shell):

| mode | wall time |
|---|---|
| `--ion-eager` (IonPower on) | 0.122 s |
| `--no-ion --no-baseline` (interpreter) | 2.223 s |

**13.7× speedup** on a pure arithmetic loop. On the library
workloads above, the speedup is smaller — parsers/regex/string
ops don't get the same multiplier as hot integer loops — but
every library we've tested runs in a human-scale time budget
because of the JIT.
