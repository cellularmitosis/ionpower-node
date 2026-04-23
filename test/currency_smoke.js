// currency.js: penny-safe money arithmetic.

var currency = require("./vendor/currency.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Addition without FP rounding error.
var c = currency(0.1).add(0.2);
assert(c.value === 0.3, "0.1 + 0.2 = 0.3 exactly; got " + c.value);
console.log("ok: 0.1 + 0.2 exact");

// Divide.
var split = currency(100).distribute(3);
assert(split.length === 3, "distribute 3 parts: " + split.length);
var sum = split.reduce(function (a, b) { return a.add(b); }, currency(0));
assert(sum.value === 100, "split sums back to 100: " + sum.value);
console.log("ok: distribute sum-preserves");

// Format.
var s = currency(1234.5).format();
assert(s.charAt(0) === '$' || s.indexOf('1,234') >= 0, "format: " + s);
console.log("ok: format:", s);

console.log("\ncurrency.js smoke: all assertions passed");
