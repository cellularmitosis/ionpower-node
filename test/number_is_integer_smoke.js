// number-is-integer: is a value a finite integer? (plus tolerates strings
// that are integer-representable). Uses is-finite internally.

var niInt = require("./vendor/number-is-integer.js");
niInt = niInt.default || niInt;
var isFinite_ = require("./vendor/is-finite.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// number-is-integer
assert(niInt(42) === true, "42 is int");
assert(niInt(-3) === true, "-3 is int");
assert(niInt(0) === true, "0 is int");
assert(niInt(3.14) === false, "3.14 is not int");
assert(niInt(Infinity) === false, "Infinity is not int");
assert(niInt(NaN) === false, "NaN is not int");
console.log("ok: number-is-integer (6 cases)");

// is-finite
assert(isFinite_(42) === true, "42 finite");
assert(isFinite_(Infinity) === false, "Infinity not finite");
assert(isFinite_(NaN) === false, "NaN not finite");
console.log("ok: is-finite (3 cases)");

console.log("\nnumber_is_integer smoke: all assertions passed");
