// decimal.js: third arbitrary-precision library after big.js and bignumber.js.
// Same API family, different tradeoffs.

var Decimal = require("./vendor/decimal.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Exact sum of floats that normal JS screws up.
var s = new Decimal("0.1").plus("0.2").plus("0.3").plus("0.4");
assert(s.toString() === "1", "0.1 + 0.2 + 0.3 + 0.4 = 1 exactly; got " + s.toString());
console.log("ok: exact float sum");

// Large integer multiply.
var p = new Decimal("123456789012345").times("98765432109876");
assert(p.toString().length >= 24, "big product length: " + p.toString());
console.log("ok: big multiply: " + p.toString());

// Square root.
Decimal.set({ precision: 20 });
var r = new Decimal(2).sqrt();
assert(r.toString().slice(0, 10) === "1.41421356", "sqrt(2) ~ 1.4142...; got " + r.toString());
console.log("ok: sqrt(2)");

// Logs.
var l = new Decimal(10).ln();
assert(l.toString().slice(0, 6) === "2.3025", "ln(10) ~ 2.3025...; got " + l.toString());
console.log("ok: ln(10)");

console.log("\ndecimal smoke: all assertions passed");
