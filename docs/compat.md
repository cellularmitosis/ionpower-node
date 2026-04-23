# Third-party library compatibility

Libraries test-fit through ionpower-node. Each entry is a real
package running unmodified (within its own JS-version constraints).

## Currently passing (153 libraries as of 2026-04-22)

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
| 56 | [mitt](https://github.com/developit/mitt)           | 3.0.1 | 200 B  | pub/sub event emitter             | — |
| 57 | [ramda](https://ramdajs.com/)                       | 0.29.1 | ... KB | functional utilities              | — |
| 58 | [pluralize](https://github.com/plurals/pluralize)   | 8.0.0 | 5 KB   | English pluralization             | — |
| 59 | [debug](https://github.com/debug-js/debug)          | 4.3.4 | 5 KB   | logger (via nm tree)              | needs tty + ms |
| 60 | [base-x](https://github.com/cryptocoinjs/base-x)    | 4.0.0 | 2 KB   | configurable base encoder         | — |
| 61 | [moo](https://github.com/no-context/moo)            | 0.5.2 | 10 KB  | fast lexer                        | — |
| 62 | [clone](https://github.com/pvorb/clone)             | 2.1.2 | 4 KB   | deep clone utility                | — |
| 63 | [ejs](https://ejs.co/)                              | 3.1.10 | 21 KB | embedded JS templates             | — |
| 64 | [dequal](https://github.com/lukeed/dequal)          | 2.0.3 | 1 KB   | deep equal (Map, Set, etc.)       | — |
| 65 | [dotenv](https://github.com/motdotla/dotenv)        | 16.3.1 | 3 KB  | .env file loader                  | — |
| 66 | [sprintf-js](https://github.com/alexei/sprintf.js)  | 1.1.3 | 5 KB   | printf-style formatting           | — |
| 67 | [iconv-lite](https://github.com/ashtuchkin/iconv-lite) | 0.6.3 | ... KB | text encoding conversion       | required Buffer ucs2/latin1 upgrade |
| 68 | [nearley](https://nearley.js.org/)                  | 2.20.1 | 20 KB | parser combinator engine          | runtime-only (no lexer) |
| 69 | [bignumber.js](https://mikemcl.github.io/bignumber.js/) | 9.1.2 | 89 KB | arbitrary-precision decimal  | different API style than big.js |
| 70 | [decimal.js](https://mikemcl.github.io/decimal.js/) | 10.4.3 | 135 KB | arbitrary-precision decimal      | sqrt/ln precision ops |
| 71 | [camelcase](https://github.com/sindresorhus/camelcase) | 6.3.0 | 3 KB | case conversion                | transpiled via babel fallback (uses \\p{Lu}) |
| 72 | [pretty-bytes](https://github.com/sindresorhus/pretty-bytes) | 5.6.0 | 2 KB | human-readable byte sizes | — |
| 73 | [figlet](https://github.com/patorjk/figlet.js)      | 1.7.0 | 43 KB | ASCII banner fonts               | ships Standard.flf alongside |
| 74 | [fecha](https://github.com/taylorhakes/fecha)       | 4.2.3 | 15 KB  | small date format/parse          | alt to dayjs/moment |
| 75 | [randomcolor](https://github.com/davidmerfield/randomColor) | 0.6.2 | 12 KB | seeded pleasant color gen | — |
| 76 | [classnames](https://github.com/JedWatson/classnames) | 2.3.2 | 1 KB | conditional CSS class joining    | — |
| 77 | [tiny-emitter](https://github.com/scottcorgan/tiny-emitter) | 2.1.0 | 200 B | event emitter | alt to mitt |
| 78 | [fast-json-stable-stringify](https://github.com/epoberezkin/fast-json-stable-stringify) | 2.1.0 | 2 KB | deterministic JSON | — |
| 79 | [uniq](https://github.com/mikolalysenko/uniq)       | 1.0.1 | 1 KB   | array deduplication              | — |
| 80 | [JSZip](https://stuk.github.io/jszip/)              | 3.10.1 | 97 KB  | in-memory zip read/write         | Promises resolve sync for our single-threaded runtime |
| 81 | [hashids](https://github.com/niieani/hashids.js)    | 2.3.0 | 5 KB   | obfuscated short IDs             | needed bootstrap `self=global` alias |
| 82 | [jmespath](https://jmespath.org/)                   | 0.16.0 | 58 KB | JSON query language              | projections, filters, functions |
| 83 | [seedrandom](https://github.com/davidbau/seedrandom) | 3.0.5 | 8 KB  | seeded PRNG (MT / ARC4)          | — |
| 84 | [alea](https://github.com/coverslide/node-alea)     | 1.0.1 | 2 KB   | tiny fast seeded PRNG            | has .uint32() |
| 85 | [escape-html](https://github.com/component/escape-html) | 1.0.3 | 1 KB | HTML entity escaper           | — |
| 86 | [rfc6902](https://github.com/chbrown/rfc6902)       | 5.0.1 | 5 KB   | JSON Patch (create+apply diffs)  | — |
| 87 | [fast-memoize](https://github.com/caiogondim/fast-memoize.js) | 2.5.2 | 3 KB | function memoization | arity-1 fast path + multi-arg |
| 88 | [tiny-warning](https://github.com/alexreardon/tiny-warning) | 1.0.3 | 400 B | conditional console.warn | — |
| 89 | [htmlparser2](https://github.com/fb55/htmlparser2) | 8.0.2 | ~150 KB | HTML parser (SAX + DOM) | via full nm tree (domhandler, domutils, domelementtype, entities, dom-serializer) |
| 90 | [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | 9.0.2 | ~100 KB | JWT sign+verify | forced createHmac + KeyObject + real Buffer function + path canonicalization |
| 91 | [eventemitter3](https://github.com/primus/eventemitter3) | 4.0.7 | 10 KB | alt fast event emitter | — |
| 92 | [indent-string](https://github.com/sindresorhus/indent-string) | 4.0.0 | 700 B | prefix every line with N indents | — |
| 93 | [safe-json-stringify](https://github.com/debitoor/safe-json-stringify) | 1.2.0 | 1 KB | JSON.stringify that survives cycles | — |
| 94 | [leven](https://github.com/sindresorhus/leven) | 3.1.0 | 2 KB | Levenshtein distance | — |
| 95 | [strnum](https://github.com/NaturalIntelligence/strnum) | 1.0.5 | 5 KB | smart string-to-number coercion | — |
| 96 | [XRegExp](https://xregexp.com/) | 5.1.1 | 400 KB | named groups, Unicode classes | — |
| 97 | [htmlescape](https://github.com/zertosh/htmlescape) | 1.1.1 | 1 KB | JSON-in-script tag safe escape | — |
| 98 | [qhash](https://github.com/andrasq/node-qhash) | 1.2.0 | 6 KB | dotted-path get/set + helpers | — |
| 99 | [escape-regexp-component](https://github.com/mcollina/escape-regexp-component) | 1.0.2 | 300 B | escape regex specials | — |
| 100 | [object-path](https://github.com/mariocasciaro/object-path) | 0.11.8 | 8 KB | dotted get/set/has/del + array indices | — |
| 101 | [currency.js](https://currency.js.org/) | 2.0.4 | 7 KB | penny-safe money arithmetic | — |
| 102 | [arr-union](https://github.com/jonschlinkert/arr-union) + [arr-diff](https://github.com/jonschlinkert/arr-diff) | 3.1 / 4.0 | ~1 KB | set-algebra helpers (one test, 2 libs) | — |
| 103 | [deep-extend](https://github.com/unclechu/node-deep-extend) | 0.6.0 | 4 KB | recursive object merge | forced Buffer→real-function refactor (`val instanceof Buffer`) |
| 104 | [cookie](https://github.com/jshttp/cookie) | 0.6.0 | 5 KB | HTTP cookie parse+serialize | — |
| 105 | [cookie-signature](https://github.com/tj/node-cookie-signature) | 1.2.1 | 1 KB | HMAC-signed cookies | uses our crypto.createHmac |
| 106 | [bytes](https://github.com/visionmedia/bytes.js) | 3.1.2 | 4 KB | parse/format byte sizes | — |
| 107 | [content-type](https://github.com/jshttp/content-type) | 1.0.5 | 5 KB | HTTP Content-Type parse+format | — |
| 108 | [base64-js](https://github.com/beatgammit/base64-js) | 1.5.1 | 4 KB | Uint8Array ↔ base64 string | — |
| 109 | [json-logic-js](https://jsonlogic.com/) | 2.0.2 | 15 KB | nested-JSON rule engine | — |
| 110 | [is-plain-obj](https://github.com/sindresorhus/is-plain-obj) + [is-regexp](https://github.com/sindresorhus/is-regexp) | 4.1 / 3.1 | — | type predicates; load via babel (ESM default) | one test, 2 libs |
| 111 | [emoji-regex](https://github.com/mathiasbynens/emoji-regex) | 10.3.0 | 13 KB | detect emoji (incl. ZWJ) | — |
| 112 | [murmurhash](https://github.com/perezd/node-murmurhash) | 2.0.1 | 4 KB | non-crypto fast hash | forced TextEncoder polyfill |
| 113 | [xxhashjs](https://github.com/pierrec/js-xxhash) | 0.2.2 | 100 KB | xxHash32/64 pure JS; streaming | — |
| 114 | [jsbn](https://github.com/andyperlitch/jsbn) | 1.1.0 | 42 KB | Tom Wu's BigInteger | — |
| 115 | [crc-32](https://github.com/SheetJS/js-crc32) | 1.2.2 | 4 KB | classic CRC32 (RFC vector) | — |
| 116 | [fastest-levenshtein](https://github.com/ka-weihe/fastest-levenshtein) | 1.0.16 | 4 KB | fast edit-distance + closest match | — |
| 117 | [flatten](https://github.com/Two-Screen/flatten) | 1.0.3 | 500 B | flatten nested arrays to depth | — |
| 118 | [fnv-plus](https://github.com/tjwebb/fnv-plus) | 1.3.1 | 180 KB | FNV-1a at 32/64/128/256/512/1024 bit | — |
| 119 | [left-pad](https://github.com/left-pad/left-pad) | 1.3.0 | 1 KB | left-pad a string | :) |
| 120 | [just-pick](https://github.com/angus-c/just) + just-omit + just-compare | 4.2/2.2/2.3 | — | tree-shakable helpers (1 test, 3 libs) | — |
| 121 | [format-util](https://github.com/tmpfs/format-util) | 1.0.5 | 800 B | tiny printf-style formatter | — |
| 122 | [jsonpointer](https://github.com/janl/node-jsonpointer) | 5.0.1 | 2 KB | RFC 6901 pointer get/set | — |
| 123 | [traverse](https://github.com/ljharb/js-traverse) | 0.6.7 | 7 KB | walk/map nested structures | — |
| 124 | [Fraction.js](https://www.xarg.org/category/projects/fractionjs/) | 4.3.7 | 6 KB | exact rationals | — |
| 125 | [bit-buffer](https://github.com/inolen/bit-buffer) | 0.2.5 | 14 KB | packed-bit read/write on ArrayBuffer | — |
| 126 | [clsx](https://github.com/lukeed/clsx) | 2.0.0 | 400 B | smaller/faster classnames | — |
| 127 | [tiny-invariant](https://github.com/alexreardon/tiny-invariant) | 1.3.1 | 400 B | tiny throwing invariant | — |
| 128 | [diff-match-patch](https://github.com/google/diff-match-patch) | 1.0.5 | 78 KB | Google's diff/patch engine | — |
| 129 | [circular-json](https://github.com/WebReflection/circular-json) | 0.5.9 | 7 KB | JSON with ~ circular refs | — |
| 130 | [flatted](https://github.com/WebReflection/flatted) | 3.2.9 | 3 KB | successor to circular-json | — |
| 131 | [big-integer](https://github.com/peterolson/BigInteger.js) | 1.6.52 | 32 KB | arbitrary-precision int (100!, 2^256) | — |
| 132 | [diff-sequences](https://github.com/facebook/jest/tree/main/packages/diff-sequences) | 29.6.3 | 27 KB | Jest's Myers-diff engine | — |
| 133 | [reselect](https://reselect.js.org/) | 4.1.8 | 10 KB | memoized selectors (Redux) | — |
| 134 | [array-move](https://github.com/sindresorhus/array-move) | 3.0.1 | 500 B | immutable from/to move | — |
| 135 | [split-on-first](https://github.com/sindresorhus/split-on-first) | 3.0.0 | 500 B | split-first-occurrence helper | — |
| 136 | [array-differ](https://github.com/sindresorhus/array-differ) | 4.0.0 | 200 B | array difference multi-source | needs Array#flat polyfill |
| 137 | [arr-flatten](https://github.com/jonschlinkert/arr-flatten) | 1.1.0 | 400 B | recursive array flatten | — |
| 138 | [requires-port](https://github.com/unshiftio/requires-port) | 1.0.0 | 800 B | explicit-port predicate | — |
| 139 | [querystringify](https://github.com/unshiftio/querystringify) | 2.2.0 | 3 KB | tiny querystring parse/stringify | — |
| 140 | [url-parse](https://github.com/unshiftio/url-parse) | 1.5.10 | 21 KB | browser-ish URL parser | nm walk to requires-port + querystringify |
| 141 | [ipaddr.js](https://github.com/whitequark/ipaddr.js) | 2.1.0 | 34 KB | IPv4/IPv6 parse + range classify | — |
| 142 | [unorm](https://github.com/walling/unorm) | 1.6.0 | 143 KB | pure-JS Unicode normalization | — |
| 143 | [glob-to-regexp](https://github.com/fitzgen/glob-to-regexp) | 0.4.1 | 3 KB | glob → RegExp | — |
| 144 | [assert-plus](https://github.com/mcavage/node-assert-plus) | 1.0.0 | 5 KB | type-aware assertion wrappers | — |
| 145 | [longest-streak](https://github.com/wooorm/longest-streak) | 3.1.0 | 800 B | find longest repeating substring | — |
| 146 | [zero-fill](https://github.com/feross/zero-fill) | 2.2.4 | 600 B | left-pad integer with zeros | — |
| 147 | [ua-parser-js](https://github.com/faisalman/ua-parser-js) | 1.0.37 | 49 KB | UA → browser/os/cpu | IDs TenFourFox 45 on ppc/10.4 |
| 148 | [preact](https://preactjs.com/) | 10.19.3 | 11 KB | 3KB React-alike | VDOM only (no DOM) |
| 149 | [extend](https://github.com/justmoon/node-extend) | 3.0.2 | 3 KB | jQuery's shallow+deep merge | — |
| 150 | [doT.js](https://github.com/olado/doT) | 2.0.0-beta.1 | 7 KB | fast small templating | — |
| 151 | (counted under #150 just-pick/omit/compare) | | | | |
| 152 | (counted under #110 is-plain-obj/is-regexp) | | | | |
| 153 | (counted under #102 arr-union/arr-diff) | | | | |

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
| luxon                           | requires Intl, which we built `--without-intl-api` |
| date-fns                        | imports `@babel/runtime/helpers/interopRequireDefault` |
| node-html-parser                | multi-file TS output with many `require('./nodes/...')` |
| color-string                    | requires color-name + simple-swizzle (transitively) |
| hyperid                         | requires `./uuid-node` (multi-file) |
| isemail                         | requires `punycode` (not shipped) |
| object-sizeof                   | requires `./byte_size` + `buffer/` (multi-file) |
| json-stable-stringify           | pulls isarray, object-keys, call-bind (multi-file) |

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
