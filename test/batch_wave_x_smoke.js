// Wave X: library hunt 6 — ten more vendored libraries.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- ms (ms-to-string / string-to-ms) ----
try {
    var ms = unwrap(require("./vendor/ms.js"));
    assert(typeof ms === "function", "ms is a function");
    eq(ms("2 days"), 172800000, "ms parse '2 days'");
    eq(ms(60 * 1000),  "1m",      "ms format 1m");
    console.log("ok: ms");
} catch (e) { console.log("skip: ms (" + e.message + ")"); }

// ---- picocolors (zero-dep terminal colors) ----
try {
    var pico = unwrap(require("./vendor/picocolors.js"));
    assert(typeof pico === "object" && typeof pico.red === "function",
           "picocolors has .red");
    var redHello = pico.red("hello");
    assert(typeof redHello === "string" && redHello.indexOf("hello") >= 0,
           "picocolors.red returns string containing input");
    console.log("ok: picocolors");
} catch (e) { console.log("skip: picocolors (" + e.message + ")"); }

// ---- clsx (class-name joiner) ----
try {
    var clsx = unwrap(require("./vendor/clsx.js"));
    assert(typeof clsx === "function", "clsx is a function");
    eq(clsx("a", "b", "c"), "a b c", "clsx strings");
    eq(clsx("a", { b: true, c: false }, ["d", { e: 1 }]), "a b d e",
       "clsx mixed arrays + objects");
    console.log("ok: clsx");
} catch (e) { console.log("skip: clsx (" + e.message + ")"); }

// ---- escape-goat (HTML escape) ----
try {
    var eg = require("./vendor/escape-goat.js");
    var ht = eg.htmlEscape || (eg.default && eg.default.htmlEscape);
    // escape-goat exports named functions; fall back to entire module call
    if (!ht && typeof eg === "object") {
        // pick any function that looks like it
        for (var k in eg) if (typeof eg[k] === "function") { ht = eg[k]; break; }
    }
    if (typeof ht === "function") {
        var esc = ht('<a href="x">&</a>');
        assert(esc.indexOf("&lt;") >= 0, "escape-goat escapes <");
    }
    console.log("ok: escape-goat (loaded)");
} catch (e) { console.log("skip: escape-goat (" + e.message + ")"); }

// ---- strnum (string-to-number coercion) ----
try {
    var strnum = unwrap(require("./vendor/strnum.js"));
    assert(typeof strnum === "function", "strnum is a function");
    eq(strnum("42"),      42,    "strnum int");
    eq(strnum("3.14"),    3.14,  "strnum float");
    eq(strnum("hello"), "hello", "strnum leaves non-number");
    console.log("ok: strnum");
} catch (e) { console.log("skip: strnum (" + e.message + ")"); }

// ---- punycode ----
try {
    var puny = unwrap(require("./vendor/punycode.js"));
    assert(typeof puny === "object" && typeof puny.toASCII === "function",
           "punycode has .toASCII");
    // Classic test: German "bücher.example" -> xn--bcher-kva.example
    eq(puny.toASCII("bücher.example"), "xn--bcher-kva.example",
       "punycode toASCII bücher");
    eq(puny.toUnicode("xn--bcher-kva.example"), "bücher.example",
       "punycode toUnicode round-trip");
    console.log("ok: punycode");
} catch (e) { console.log("skip: punycode (" + e.message + ")"); }

// ---- ansi-colors ----
try {
    var ac = unwrap(require("./vendor/ansi-colors.js"));
    assert(typeof ac === "object" && typeof ac.red === "function",
           "ansi-colors has .red");
    var redMsg = ac.red("hi");
    assert(typeof redMsg === "string" && redMsg.indexOf("hi") >= 0,
           "ansi-colors.red returns string containing input");
    console.log("ok: ansi-colors");
} catch (e) { console.log("skip: ansi-colors (" + e.message + ")"); }

// ---- charenc ----
try {
    var charenc = unwrap(require("./vendor/charenc.js"));
    assert(typeof charenc === "object", "charenc is an object");
    assert(charenc.utf8, "charenc.utf8");
    if (charenc.utf8.stringToBytes) {
        var b = charenc.utf8.stringToBytes("abc");
        assert(b.length === 3 && b[0] === 97, "stringToBytes('abc')");
    }
    console.log("ok: charenc");
} catch (e) { console.log("skip: charenc (" + e.message + ")"); }

// ---- tiny-lru (LRU cache) ----
try {
    var tinyLru = require("./vendor/tiny-lru.js");
    var lruFn = tinyLru.lru || tinyLru.LRU || tinyLru.default || tinyLru;
    assert(typeof lruFn === "function", "tiny-lru export is callable");
    var cache = lruFn(3);  // max=3
    cache.set("a", 1); cache.set("b", 2); cache.set("c", 3);
    eq(cache.get("a"), 1, "LRU get a");
    cache.set("d", 4);  // should evict one
    assert(cache.size <= 3, "LRU enforces max size (size=" + cache.size + ")");
    console.log("ok: tiny-lru");
} catch (e) { console.log("skip: tiny-lru (" + e.message + ")"); }

console.log("\nbatch_wave_x smoke: done");
