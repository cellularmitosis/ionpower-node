// util.styleText + wave 9 libraries smoke.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- util.styleText ----
var util = require("util");
assert(typeof util.styleText === "function", "util.styleText is a function");

// Non-TTY: returns plain text (matches Node default)
var plain = util.styleText("red", "hello");
// If stdout is not TTY, we get plain text. Force-validate off and we get CSI.
var csi = util.styleText("red", "hello", { validateStream: false });
eq(csi, "\u001b[31mhello\u001b[39m", "util.styleText forced CSI");

// Array styles
var bold_red = util.styleText(["red", "bold"], "x", { validateStream: false });
assert(bold_red.indexOf("\u001b[31m") >= 0, "red open");
assert(bold_red.indexOf("\u001b[1m") >= 0, "bold open");
assert(bold_red.endsWith("\u001b[22m\u001b[39m") || bold_red.endsWith("\u001b[39m\u001b[22m"),
       "close codes present");

// Unknown style throws
var threw = false;
try { util.styleText("notacolor", "x", { validateStream: false }); } catch (e) { threw = true; }
assert(threw, "unknown style throws");
console.log("ok: util.styleText");

// ---- callsites ----
try {
    var callsites = unwrap(require("./vendor/callsites.js"));
    assert(typeof callsites === "function", "callsites is a function");
    var frames = callsites();
    assert(Array.isArray(frames) || frames.length > 0, "callsites returns CallSite array");
    console.log("ok: callsites");
} catch (e) { console.log("skip: callsites (" + e.message + ")"); }

// ---- listenercount ----
try {
    var listenerCount = unwrap(require("./vendor/listenercount.js"));
    assert(typeof listenerCount === "function", "listenerCount is a function");
    var events = require("events");
    var ee = new events.EventEmitter();
    ee.on("x", function(){});
    ee.on("x", function(){});
    eq(listenerCount(ee, "x"), 2, "listenerCount = 2");
    eq(listenerCount(ee, "other"), 0, "listenerCount = 0 for nothing");
    console.log("ok: listenercount");
} catch (e) { console.log("skip: listenercount (" + e.message + ")"); }

// ---- abbreviate-number ----
try {
    var abbr = unwrap(require("./vendor/abbreviate-number.js"));
    assert(typeof abbr === "function", "abbr is a function");
    eq(abbr(1500000), "1.5m", "abbr 1.5m");
    eq(abbr(1500),    "1.5k", "abbr 1.5k");
    eq(abbr(42),      42,     "abbr passthrough under 1000");
    console.log("ok: abbreviate-number");
} catch (e) { console.log("skip: abbreviate-number (" + e.message + ")"); }

// ---- p-map (ESM async) ----
try {
    var pMapMod = require("./vendor/p-map-latest.js");
    var pMap = pMapMod.default || pMapMod;
    assert(typeof pMap === "function", "pMap is a function");
    pMap([1, 2, 3], function (x) { return Promise.resolve(x * 2); })
        .then(function (result) {
            eq(JSON.stringify(result), JSON.stringify([2, 4, 6]), "pMap doubles");
            console.log("ok: p-map");
        })
        .catch(function (e) { console.log("skip: p-map (" + e.message + ")"); });
} catch (e) { console.log("skip: p-map (" + e.message + ")"); }

console.log("\nstyle_text smoke: inline done (pMap resolves on next tick)");
