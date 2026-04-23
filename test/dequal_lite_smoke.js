// dequal/lite: fast deep-equal, ≤1 KB. The /lite entry drops
// regex/date/error special-casing for speed.

var dequal = require("./vendor/dequal-lite.js");
dequal = dequal.dequal || dequal.default || dequal;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Primitives.
assert(dequal(1, 1) === true, "1 == 1");
assert(dequal("a", "a") === true, "a == a");
assert(dequal(1, 2) === false, "1 != 2");
console.log("ok: dequal primitives");

// Arrays.
assert(dequal([1, 2, 3], [1, 2, 3]) === true, "arrays equal");
assert(dequal([1, 2, 3], [1, 2, 4]) === false, "arrays differ");
console.log("ok: dequal arrays");

// Nested objects.
assert(dequal({ a: { b: 1 } }, { a: { b: 1 } }) === true, "nested equal");
assert(dequal({ a: { b: 1 } }, { a: { b: 2 } }) === false, "nested differ");
console.log("ok: dequal nested objects");

console.log("\ndequal_lite smoke: all assertions passed");
