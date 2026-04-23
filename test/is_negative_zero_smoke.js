// is-negative-zero: distinguish -0 from +0.

var isNegZero = require("./vendor/is-negative-zero.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(isNegZero(-0) === true,  "-0 is -0");
assert(isNegZero(0)  === false, "+0 is not -0");
assert(isNegZero(42) === false, "42 is not");
assert(isNegZero(-1) === false, "-1 is not");
console.log("ok: is-negative-zero");

console.log("\nis-negative-zero smoke: all assertions passed");
