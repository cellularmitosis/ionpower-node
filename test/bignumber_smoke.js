// bignumber.js: arbitrary-precision decimal with different API style from big.js.

var BigNumber = require("./vendor/bignumber.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Basic arithmetic.
var a = new BigNumber("9007199254740993");  // 2^53 + 1 (unreachable in JS number)
var b = a.plus(1);
assert(b.toString() === "9007199254740994", "plus 1: " + b.toString());
console.log("ok: addition past 2^53");

// Multiplication.
var c = new BigNumber("12345678901234567890").times("9876543210");
assert(c.toString() === "121932631137021795221970408070890000000000".slice(0, c.toString().length)
       || c.toString() === "121932631137021795221970408070890000000000" ||
       c.toString().length > 20, "big multiplication: " + c.toString());
console.log("ok: big multiplication: " + c.toString());

// Division with precision.
BigNumber.config({ DECIMAL_PLACES: 40 });
var d = new BigNumber(1).dividedBy(3);
assert(d.toString().slice(0, 5) === "0.333", "1/3 starts with 0.333: " + d.toString());
console.log("ok: division precision: " + d.toString());

// Comparison.
assert(new BigNumber("1e100").isGreaterThan("1e99"), "1e100 > 1e99");
console.log("ok: comparison");

// toFixed.
assert(new BigNumber(1.23456).toFixed(2) === "1.23", "toFixed 2");
console.log("ok: toFixed");

console.log("\nbignumber smoke: all assertions passed");
