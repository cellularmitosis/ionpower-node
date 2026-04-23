// is-arrayish: does-it-look-like-an-array predicate.

var isArrayish = require("./vendor/is-arrayish.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(isArrayish([]) === true, "[]");
assert(isArrayish([1, 2]) === true, "[1,2]");
// is-arrayish actually requires BOTH length and splice to look like
// an array (stricter than pure duck-typing on .length alone).
assert(isArrayish({ length: 0, splice: function () {} }) === true, "array-like with splice");
assert(isArrayish({ length: 0 }) === false, "no splice -> not arrayish");
assert(isArrayish("string") === false, "string");
assert(isArrayish(null) === false, "null");
assert(isArrayish(undefined) === false, "undefined");
console.log("ok: is-arrayish (6 cases)");

console.log("\nis-arrayish smoke: all assertions passed");
