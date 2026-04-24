// p-try: Promise.resolve-style wrapper that catches sync throws.
// v0.11: Promises are microtask-queued, so assertions go in exit handler.

var pTryMod = require("./vendor/p-try.js");
var pTry = pTryMod.default || pTryMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var got = null;
pTry(function () { return 42; }).then(function (v) { got = v; });

var rej = null;
pTry(function () { throw new Error("boom"); })
    .then(function () { rej = "no-catch"; })
    .catch(function (e) { rej = e.message; });

var got2 = null;
pTry(function (a, b) { return a + b; }, 3, 4).then(function (v) { got2 = v; });

process.on("exit", function () {
    assert(got === 42,      "p-try sync value: " + got);
    console.log("ok: p-try sync value");
    assert(rej === "boom",  "p-try sync throw caught: " + rej);
    console.log("ok: p-try sync throw caught");
    assert(got2 === 7,      "p-try with args: " + got2);
    console.log("ok: p-try forwards args");
    console.log("\np-try smoke: all assertions passed");
});
