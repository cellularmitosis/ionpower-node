// has-values: "is this value non-empty in a sensible way?" Uses kind-of
// underneath so empty arrays / objects / strings are all false.

var hv = require("./vendor/has-values.js");
var hasValues = hv.default || hv;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// has-values treats null as a value (like 0 / false) — the point of
// the library is to distinguish "empty" containers from "present"
// primitives, not null-safety. Only undefined + empty containers
// are considered "has-no-values".
assert(hasValues(undefined) === false, "undefined -> false");
assert(hasValues("") === false, "empty string -> false");
assert(hasValues([]) === false, "empty array -> false");
assert(hasValues({}) === false, "empty object -> false");
assert(hasValues("x") === true, "non-empty string -> true");
assert(hasValues([1]) === true, "non-empty array -> true");
assert(hasValues({ a: 1 }) === true, "non-empty object -> true");
assert(hasValues(0) === true, "zero -> true (it's a value)");
assert(hasValues(false) === true, "false -> true (it's a value)");
assert(hasValues(null) === true, "null -> true (it's a value)");
console.log("ok: has-values (10 cases)");

console.log("\nhas-values smoke: all assertions passed");
