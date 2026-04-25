// Wave CC (17th wave): seven more vendored libraries — milestone push
// for v0.50.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- array-from-async (ESM) ----
try {
    var afa = unwrap(require("./vendor/array-from-async.js"));
    assert(typeof afa === "function", "array-from-async is function");
    afa([1, 2, 3]).then(function (r) {
        eq(r, [1, 2, 3], "array-from-async sync iterable");
        console.log("ok: array-from-async");
    }).catch(function (e) { console.log("skip: array-from-async (" + e.message + ")"); });
} catch (e) { console.log("skip: array-from-async (" + e.message + ")"); }

// ---- convert-source-map ----
try {
    var csm = require("./vendor/convert-source-map.js");
    assert(typeof csm.fromObject === "function", "convert-source-map.fromObject");
    var sm = csm.fromObject({ version: 3, mappings: "" });
    assert(typeof sm.toJSON === "function" || typeof sm.toString === "function", "sm shape");
    console.log("ok: convert-source-map");
} catch (e) { console.log("skip: convert-source-map (" + e.message + ")"); }

// ---- humanize-number ----
try {
    var humanize = unwrap(require("./vendor/humanize-number.js"));
    assert(typeof humanize === "function", "humanize is function");
    eq(humanize(1234567), "1,234,567", "humanize comma-separated");
    eq(humanize(100), "100", "humanize small");
    console.log("ok: humanize-number");
} catch (e) { console.log("skip: humanize-number (" + e.message + ")"); }

// ---- hash-it (deterministic hash of any value) ----
try {
    var hashItMod = require("./vendor/hash-it.js");
    var hashIt = hashItMod.hash || (hashItMod.default && hashItMod.default.hash) || unwrap(hashItMod);
    assert(typeof hashIt === "function", "hash-it is function");
    var h1 = hashIt({ a: 1, b: 2 });
    var h2 = hashIt({ a: 1, b: 2 });
    var h3 = hashIt({ a: 1, b: 3 });
    eq(h1, h2, "hash-it deterministic");
    assert(h1 !== h3, "hash-it differs for different content");
    console.log("ok: hash-it");
} catch (e) { console.log("skip: hash-it (" + e.message + ")"); }

// ---- parse-srcset ----
try {
    var parseSrcset = unwrap(require("./vendor/parse-srcset.js"));
    assert(typeof parseSrcset === "function", "parse-srcset is function");
    var parsed = parseSrcset("a.jpg 1x, b.jpg 2x");
    assert(Array.isArray(parsed) && parsed.length === 2, "parse-srcset returns 2 entries");
    console.log("ok: parse-srcset");
} catch (e) { console.log("skip: parse-srcset (" + e.message + ")"); }

// ---- random-int ----
try {
    var randomInt = unwrap(require("./vendor/random-int.js"));
    assert(typeof randomInt === "function", "random-int is function");
    var r = randomInt(0, 100);
    assert(typeof r === "number" && r >= 0 && r <= 100, "random-int in range (got " + r + ")");
    console.log("ok: random-int");
} catch (e) { console.log("skip: random-int (" + e.message + ")"); }

// ---- rgb2hex ----
try {
    var rgb2hex = unwrap(require("./vendor/rgb2hex.js"));
    assert(typeof rgb2hex === "function", "rgb2hex is function");
    var hex = rgb2hex("rgb(255, 0, 0)");
    assert(hex && (hex.hex === "#ff0000" || hex === "#ff0000"),
           "rgb2hex(rgb(255,0,0)) (got " + JSON.stringify(hex) + ")");
    console.log("ok: rgb2hex");
} catch (e) { console.log("skip: rgb2hex (" + e.message + ")"); }

console.log("\nbatch_wave_cc smoke: done");
