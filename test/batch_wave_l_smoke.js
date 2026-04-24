// Batch smoke for a grab-bag of previously-vendored-but-unsmoked libs.
// Each section either tests the core API or confirms the module loads +
// exposes its advertised surface.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- indexof: Array.prototype.indexOf polyfill ----
var indexOf = unwrap(require("./vendor/indexof.js"));
eq(indexOf([1, 2, 3], 2), 1, "indexof: basic");
eq(indexOf(["a", "b", "c"], "c"), 2, "indexof: strings");
console.log("ok: indexof");

// ---- foreach: loop helper ----
var foreach = unwrap(require("./vendor/foreach.js"));
var seen = [];
foreach(["a", "b", "c"], function (v, i) { seen.push(i + ":" + v); });
eq(seen, ["0:a", "1:b", "2:c"], "foreach");
console.log("ok: foreach");

// ---- xtend-mutable: in-place Object.assign-style ----
var xtend = unwrap(require("./vendor/xtend-mutable.js"));
var t = { a: 1 };
xtend(t, { b: 2 }, { c: 3 });
eq(t, { a: 1, b: 2, c: 3 }, "xtend-mutable");
console.log("ok: xtend-mutable");

// ---- object-assign-v5 ----
var oa = unwrap(require("./vendor/object-assign-v5.js"));
eq(oa({}, { a: 1 }, { b: 2 }), { a: 1, b: 2 }, "object-assign v5");
console.log("ok: object-assign-v5");

// ---- is-obj ----
var isObj = unwrap(require("./vendor/is-obj.js"));
assert(isObj({}), "is-obj {}");
assert(isObj([]), "is-obj []");
assert(!isObj(null), "is-obj !null");
assert(!isObj("str"), "is-obj !string");
console.log("ok: is-obj");

// ---- is-primitive ----
var isPrim = unwrap(require("./vendor/is-primitive.js"));
assert(isPrim(42), "is-primitive num");
assert(isPrim("s"), "is-primitive str");
assert(isPrim(null), "is-primitive null");
assert(!isPrim({}), "is-primitive !obj");
console.log("ok: is-primitive");

// ---- min-indent ----
var minIndent = unwrap(require("./vendor/min-indent.js"));
eq(minIndent("  a\n    b\n  c"), 2, "min-indent mixed");
eq(minIndent("no indent\nhere"), 0, "min-indent zero");
console.log("ok: min-indent");

// ---- escape-string-regexp-v5 ----
var esre = unwrap(require("./vendor/escape-string-regexp-v5.js"));
eq(esre("a.b+c"), "a\\.b\\+c", "escape-string-regexp v5");
console.log("ok: escape-string-regexp-v5");

// ---- ms2 ----
var ms2 = unwrap(require("./vendor/ms2.js"));
eq(ms2("1s"), 1000, "ms2 parse 1s");
eq(ms2("2 hours"), 7200000, "ms2 parse 2h");
console.log("ok: ms2");

// ---- json-parse-safe ----
var jps = unwrap(require("./vendor/json-parse-safe.js"));
var r1 = jps('{"a":1}');
assert(r1.value.a === 1, "json-parse-safe ok");
var r2 = jps("not json");
assert(r2.error, "json-parse-safe err case");
console.log("ok: json-parse-safe");

// ---- json-stringify-safe ----
var jss = unwrap(require("./vendor/json-stringify-safe.js"));
var cyclic = { a: 1 };
cyclic.self = cyclic;
var out = jss(cyclic);
assert(typeof out === "string", "json-stringify-safe returns string");
assert(out.indexOf("[Circular") >= 0, "cycle marker");
console.log("ok: json-stringify-safe");

// ---- levenshtein ----
var lev = unwrap(require("./vendor/levenshtein.js"));
// Some versions export { get: fn } or a ctor; support both shapes.
var levFn = (typeof lev === "function") ? lev : (lev.get || lev.distance);
if (typeof levFn === "function") {
    assert(levFn("kitten", "sitting") === 3, "levenshtein 3");
    console.log("ok: levenshtein");
} else {
    console.log("skip: levenshtein shape not recognized");
}

// ---- sprintf-js ----
var sprintf = unwrap(require("./vendor/sprintf-js.js"));
var sp = sprintf.sprintf || sprintf;
eq(sp("%d + %d = %d", 1, 2, 3), "1 + 2 = 3", "sprintf basic");
eq(sp("%s!", "hi"), "hi!", "sprintf string");
console.log("ok: sprintf-js");

// ---- upper-case-first ----
var ucf = unwrap(require("./vendor/upper-case-first.js"));
var ucfFn = ucf.upperCaseFirst || ucf;
eq(ucfFn("hello world"), "Hello world", "upper-case-first");
console.log("ok: upper-case-first");

// ---- no-case ----
var nc = unwrap(require("./vendor/no-case.js"));
var ncFn = nc.noCase || nc;
eq(ncFn("camelCaseWords"), "camel case words", "no-case");
console.log("ok: no-case");

// ---- sentence-case ----
var sc = unwrap(require("./vendor/sentence-case.js"));
var scFn = sc.sentenceCase || sc;
eq(scFn("this is a sentence"), "This is a sentence", "sentence-case");
console.log("ok: sentence-case");

// ---- unpipe: utility for unpiping streams ----
var unpipe = unwrap(require("./vendor/unpipe.js"));
assert(typeof unpipe === "function", "unpipe is function");
// Don't actually call it (needs real streams); just surface assert.
console.log("ok: unpipe (surface)");

// ---- stream-shift ----
var streamShift = unwrap(require("./vendor/stream-shift.js"));
assert(typeof streamShift === "function", "stream-shift is function");
console.log("ok: stream-shift (surface)");

// ---- utils-merge-v1 ----
var um = unwrap(require("./vendor/utils-merge-v1.js"));
eq(um({ a: 1 }, { b: 2 }), { a: 1, b: 2 }, "utils-merge-v1");
console.log("ok: utils-merge-v1");

// ---- destroy (stream helper) ----
var destroy = unwrap(require("./vendor/destroy.js"));
assert(typeof destroy === "function", "destroy is function");
console.log("ok: destroy (surface)");

// ---- has-ansi ----
var hasAnsi = unwrap(require("./vendor/has-ansi.js"));
assert(hasAnsi("\x1b[31mred\x1b[0m"), "has-ansi detects");
assert(!hasAnsi("plain"), "has-ansi negative");
console.log("ok: has-ansi");

// ---- cli-boxes (data; topLeft/topRight, etc.) ----
var cliBoxes = unwrap(require("./vendor/cli-boxes.js"));
assert(cliBoxes && cliBoxes.single && typeof cliBoxes.single.topLeft === "string",
       "cli-boxes.single shape");
console.log("ok: cli-boxes");

// ---- url-alphabet ----
var urlAlphabet = unwrap(require("./vendor/url-alphabet/index.cjs"));
var ua = urlAlphabet.urlAlphabet || urlAlphabet;
assert(typeof ua === "string" && ua.length >= 40, "url-alphabet is a string");
console.log("ok: url-alphabet");

// ---- colorette ----
var colorette = unwrap(require("./vendor/colorette.js"));
var red = colorette.red || colorette;
if (typeof red === "function") {
    var out = red("x");
    assert(typeof out === "string" && out.indexOf("x") >= 0, "colorette.red wraps text");
    console.log("ok: colorette");
} else {
    console.log("skip: colorette shape");
}

console.log("\nbatch_wave_l smoke: all assertions passed");
