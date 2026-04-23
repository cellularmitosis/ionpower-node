// Promise-adjacent libraries that exercise our Promise polyfill.
//   p-each-series + pify + is-stream. p-map needs aggregate-error, skip.

var pEachSeries  = require("./vendor/p-each-series.js");
var pify         = require("./vendor/pify.js");
var isStreamMod  = require("./vendor/is-stream.js");
var isStream     = isStreamMod.isStream || isStreamMod.default || isStreamMod;

pEachSeries  = pEachSeries.default || pEachSeries;
pify         = pify.default || pify;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// p-each-series: serial each.
var seen = [];
pEachSeries([1, 2, 3], function (n) {
    seen.push(n);
    return Promise.resolve();
}).then(function () { /* noop */ });
eq(seen, [1, 2, 3], "p-each-series");
console.log("ok: p-each-series");

// pify: callback -> promise.
function addCb(a, b, cb) { cb(null, a + b); }
var promised = pify(addCb);
var p = null;
promised(5, 3).then(function (v) { p = v; });
assert(p === 8, "pify: 5+3=8; got " + p);
console.log("ok: pify");

// is-stream: returns false for most things (no real stream in our runtime).
assert(isStream({}) === false, "plain obj not a stream");
assert(isStream({ pipe: function(){}, on: function(){}, readable: true }) === true,
       "duck-typed stream");
console.log("ok: is-stream");

console.log("\npromise_utils smoke: all assertions passed");
