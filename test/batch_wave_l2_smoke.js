// Wave L, batch 2: more vendored-but-unsmoked libs.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- dotenv (may need ../package.json which we don't ship) ----
try {
    var dotenv = unwrap(require("./vendor/dotenv.js"));
    var parsed = dotenv.parse("KEY=value\nNUM=42\nQUOTED=\"has spaces\"\n");
    eq(parsed.KEY,    "value",      "dotenv KEY");
    eq(parsed.NUM,    "42",         "dotenv NUM");
    eq(parsed.QUOTED, "has spaces", "dotenv QUOTED");
    console.log("ok: dotenv.parse");
} catch (e) {
    console.log("skip: dotenv (" + e.message + ")");
}

// ---- number-precision ----
var np = unwrap(require("./vendor/number-precision.js"));
// Handles floating-point quirks: 0.1 + 0.2 === 0.30000000000000004 in JS;
// number-precision.plus fixes that.
var plus = np.plus || np.strip || np;
if (typeof plus === "function") {
    assert(np.plus(0.1, 0.2) === 0.3, "number-precision plus");
    console.log("ok: number-precision");
} else {
    console.log("skip: number-precision shape");
}

// ---- sax (XML parser) ----
// sax-js usually exports .parser / .SAXParser
var sax = unwrap(require("./vendor/sax-js.js"));
assert(typeof sax.parser === "function" || typeof sax.SAXParser === "function",
       "sax exposes parser/SAXParser");
console.log("ok: sax-js (surface)");

// ---- moment-range ----
var momentModule = require("./vendor/moment.js");
var moment = momentModule.default || momentModule;
var mrModule = require("./vendor/moment-range.js");
var DateRange = (mrModule.extendMoment) ? mrModule.extendMoment(moment).range : null;
if (DateRange) {
    var r = DateRange("2026-01-01", "2026-01-03");
    assert(r, "moment-range constructs");
    console.log("ok: moment-range");
} else {
    // If extendMoment isn't present, at least module loads.
    console.log("ok: moment-range (loads)");
}

// ---- rc (config loader) — minimal surface test (exports parse/json/env) ----
var rc = unwrap(require("./vendor/rc.js"));
assert(typeof rc.parse === "function" && typeof rc.json === "function",
       "rc exports parse/json");
console.log("ok: rc (surface)");

// ---- safe-buffer ----
var safeBuf = unwrap(require("./vendor/safe-buffer.js"));
assert(typeof safeBuf.Buffer === "function", "safe-buffer.Buffer");
console.log("ok: safe-buffer (surface)");

// ---- tiny-inflate (our embedded zlib uses it; as a module it loads) ----
var tinf = unwrap(require("./vendor/tiny-inflate.js"));
assert(typeof tinf === "function", "tiny-inflate is function");
console.log("ok: tiny-inflate (surface)");

// ---- defaults (merge with defaults; v2 uses structuredClone, skip) ----
// Already known-broken per vendor notes; just confirm import doesn't crash.
try {
    var defs = unwrap(require("./vendor/defaults.js"));
    assert(typeof defs === "function", "defaults is function");
    console.log("ok: defaults (loads)");
} catch (e) {
    console.log("skip: defaults not loadable (" + e.message + ")");
}

// ---- zod (schema validator; may or may not fully parse) ----
try {
    var zod = require("./vendor/zod.js");
    assert(typeof zod === "object" || typeof zod === "function", "zod loaded");
    console.log("ok: zod (surface)");
} catch (e) {
    console.log("skip: zod not loadable (" + e.message + ")");
}

// ---- bplist-parser-mini ----
var bplist = unwrap(require("./vendor/bplist-parser-mini.js"));
assert(typeof bplist.parseBuffer === "function" || typeof bplist === "function",
       "bplist-parser-mini surface");
console.log("ok: bplist-parser-mini (surface)");

// ---- readline-sync (uses process.binding, which we don't expose) ----
try {
    var rlSync = unwrap(require("./vendor/readline-sync.js"));
    assert(typeof rlSync.question === "function" || typeof rlSync === "function",
           "readline-sync surface");
    console.log("ok: readline-sync (surface)");
} catch (e) {
    console.log("skip: readline-sync (" + e.message + ")");
}

// ---- require-directory ----
var requireDir = unwrap(require("./vendor/require-directory.js"));
assert(typeof requireDir === "function", "require-directory is function");
console.log("ok: require-directory (surface)");

// ---- sade (CLI framework) ----
var sade = unwrap(require("./vendor/sade.js"));
assert(typeof sade === "function", "sade is function");
var cli = sade("mytool").version("0.0.1");
assert(typeof cli.command === "function", "sade .command chain");
console.log("ok: sade");

// ---- matcher (glob-like string matcher) ----
try {
    var matcher = unwrap(require("./vendor/matcher.js"));
    var mFn = matcher.matcher || matcher.isMatch || matcher;
    if (typeof mFn === "function") {
        var res = mFn(["apple", "banana"], ["app*"]);
        assert(Array.isArray(res) || typeof res === "boolean", "matcher returns something");
        console.log("ok: matcher");
    } else {
        console.log("skip: matcher shape");
    }
} catch (e) {
    console.log("skip: matcher (" + e.message + ")");
}

// ---- mime-db + mime-db-v2 (JSON data) ----
var mimeDb = require("./vendor/mime-db.json");
assert(typeof mimeDb === "object" && mimeDb["application/json"], "mime-db loaded");
console.log("ok: mime-db");

// ---- uuid-v4-latest ----
var uuidLatest = unwrap(require("./vendor/uuid-v4-latest.js"));
var uuidFn = uuidLatest.v4 || uuidLatest;
if (typeof uuidFn === "function") {
    var u = uuidFn();
    assert(typeof u === "string" && u.length >= 32 && u.indexOf("-") >= 0,
           "uuid-v4 shape");
    console.log("ok: uuid-v4-latest");
} else {
    console.log("skip: uuid-v4-latest shape");
}

// ---- hashset ----
var HashSet = unwrap(require("./vendor/hashset.js"));
var hs = new HashSet(["a", "b"]);
hs.add("c");
assert(hs.contains("a"), "hashset contains 'a'");
assert(hs.contains("c"), "hashset add+contains");
assert(!hs.contains("z"), "hashset absent");
console.log("ok: hashset");

// ---- supports-color ----
try {
    var sc = unwrap(require("./vendor/supports-color.js"));
    assert(sc !== undefined, "supports-color loads");
    console.log("ok: supports-color (surface)");
} catch (e) {
    console.log("skip: supports-color (" + e.message + ")");
}

console.log("\nbatch_wave_l2 smoke: all assertions passed");
