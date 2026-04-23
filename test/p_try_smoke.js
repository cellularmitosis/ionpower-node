// p-try: Promise.resolve-style wrapper that catches sync throws.

var pTryMod = require("./vendor/p-try.js");
var pTry = pTryMod.default || pTryMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// sync value
var got = null;
pTry(function () { return 42; }).then(function (v) { got = v; });
assert(got === 42, "p-try sync value: " + got);
console.log("ok: p-try sync value");

// sync throw is caught in the returned promise
var rej = null;
pTry(function () { throw new Error("boom"); })
    .then(function () { rej = "no-catch"; })
    .catch(function (e) { rej = e.message; });
assert(rej === "boom", "p-try sync throw caught: " + rej);
console.log("ok: p-try sync throw caught");

// with args
var got2 = null;
pTry(function (a, b) { return a + b; }, 3, 4).then(function (v) { got2 = v; });
assert(got2 === 7, "p-try with args: " + got2);
console.log("ok: p-try forwards args");

console.log("\np-try smoke: all assertions passed");
