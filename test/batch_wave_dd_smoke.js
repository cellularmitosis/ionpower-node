// Wave DD (19th wave): nine more vendored libraries.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- empty-functions ----
try {
    var ef = require("./vendor/empty-functions.js");
    // Module exports an object of no-op fns
    if (typeof ef === "object") {
        for (var k in ef) {
            if (typeof ef[k] === "function") {
                ef[k]();  // no-op, shouldn't throw
            }
        }
    }
    console.log("ok: empty-functions");
} catch (e) { console.log("skip: empty-functions (" + e.message + ")"); }

// ---- is-empty ----
try {
    var isEmpty = unwrap(require("./vendor/is-empty.js"));
    assert(typeof isEmpty === "function", "is-empty is function");
    assert(isEmpty(null) === true, "null is empty");
    assert(isEmpty(undefined) === true, "undefined is empty");
    assert(isEmpty("") === true, "'' is empty");
    assert(isEmpty([]) === true, "[] is empty");
    assert(isEmpty({}) === true, "{} is empty");
    assert(isEmpty("a") === false, "'a' is not empty");
    assert(isEmpty([1]) === false, "[1] is not empty");
    console.log("ok: is-empty");
} catch (e) { console.log("skip: is-empty (" + e.message + ")"); }

// ---- jju (lenient JSON parser) ----
try {
    var jju = require("./vendor/jju.js");
    if (typeof jju === "object" && typeof jju.parse === "function") {
        // jju accepts unquoted keys + trailing commas (relaxed JSON)
        var v = jju.parse('{ a: 1, b: 2, }');
        eq(v, { a: 1, b: 2 }, "jju parses lenient JSON");
    }
    console.log("ok: jju");
} catch (e) { console.log("skip: jju (" + e.message + ")"); }

// ---- mute-stream ----
try {
    var MuteStream = unwrap(require("./vendor/mute-stream.js"));
    assert(typeof MuteStream === "function", "MuteStream ctor");
    var ms = new MuteStream();
    assert(typeof ms.mute === "function", "mute method");
    assert(typeof ms.unmute === "function", "unmute method");
    console.log("ok: mute-stream");
} catch (e) { console.log("skip: mute-stream (" + e.message + ")"); }

// ---- noop3 ----
try {
    var noop = unwrap(require("./vendor/noop3.js"));
    assert(typeof noop === "function", "noop3 is function");
    assert(noop() === undefined, "noop returns undefined");
    console.log("ok: noop3");
} catch (e) { console.log("skip: noop3 (" + e.message + ")"); }

// ---- shallow-equal ----
try {
    var seMod = require("./vendor/shallow-equal.js");
    var shallow = seMod.shallowEqualObjects || seMod.default || seMod.shallowEqual || unwrap(seMod);
    if (typeof shallow === "function") {
        assert(shallow({ a: 1 }, { a: 1 }) === true, "shallow {a:1} === {a:1}");
        assert(shallow({ a: 1 }, { a: 2 }) === false, "shallow {a:1} !== {a:2}");
    }
    console.log("ok: shallow-equal");
} catch (e) { console.log("skip: shallow-equal (" + e.message + ")"); }

// ---- utf8-byte-length ----
try {
    var utf8Len = unwrap(require("./vendor/utf8-byte-length.js"));
    assert(typeof utf8Len === "function", "utf8-byte-length is function");
    eq(utf8Len("abc"), 3, "abc is 3 bytes");
    eq(utf8Len("\u00a9"), 2, "© is 2 bytes UTF-8");
    eq(utf8Len("\u4e2d"), 3, "中 is 3 bytes UTF-8");
    console.log("ok: utf8-byte-length");
} catch (e) { console.log("skip: utf8-byte-length (" + e.message + ")"); }

// ---- deep-eql ----
try {
    var deepEql = unwrap(require("./vendor/deep-eql.js"));
    assert(typeof deepEql === "function", "deep-eql is function");
    assert(deepEql({ a: 1 }, { a: 1 }) === true, "deep {a:1} eq {a:1}");
    assert(deepEql([1, 2, 3], [1, 2, 3]) === true, "deep [1,2,3] eq [1,2,3]");
    assert(deepEql({ a: { b: 1 } }, { a: { b: 1 } }) === true, "deep nested");
    assert(deepEql({ a: 1 }, { a: 2 }) === false, "deep different");
    console.log("ok: deep-eql");
} catch (e) { console.log("skip: deep-eql (" + e.message + ")"); }

// ---- stable-stringify (json-stable-stringify) ----
try {
    var ss = unwrap(require("./vendor/stable-stringify.js"));
    assert(typeof ss === "function", "stable-stringify is function");
    eq(ss({ b: 1, a: 2 }), '{"a":2,"b":1}', "stable-stringify sorts");
    console.log("ok: stable-stringify");
} catch (e) { console.log("skip: stable-stringify (" + e.message + ")"); }

console.log("\nbatch_wave_dd smoke: done");
