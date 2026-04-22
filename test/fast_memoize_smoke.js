// fast-memoize: function memoization.

var memoize = require("./vendor/fast-memoize.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var calls = 0;
var slow = memoize(function (n) { calls++; return n * n; });

assert(slow(5) === 25, "first call");
assert(slow(5) === 25, "second call same arg");
assert(calls === 1,    "one underlying call for two same-arg hits");
console.log("ok: memoization caches");

assert(slow(6) === 36, "new arg");
assert(calls === 2,    "new arg does a new call");
console.log("ok: distinct args don't collide");

// Arity 1 is fast-path in fast-memoize — try multi-arg too.
var multi = memoize(function (a, b) { calls++; return a + b; });
var c0 = calls;
multi(1, 2); multi(1, 2); multi(3, 4);
assert(calls - c0 === 2, "two underlying calls for 3 invokes (2 distinct pairs): delta=" + (calls - c0));
console.log("ok: multi-arg memoization");

console.log("\nfast-memoize smoke: all assertions passed");
