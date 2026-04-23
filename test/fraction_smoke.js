// Fraction.js: exact rational numbers.

var Fraction = require("./vendor/fraction.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// 1/3 + 1/6 = 1/2
var f = new Fraction(1, 3).add(new Fraction(1, 6));
assert(f.n === 1 && f.d === 2, "1/3 + 1/6 = 1/2; got " + f.toString());
console.log("ok: 1/3 + 1/6 = 1/2");

// Fraction from decimal.
var f2 = new Fraction("0.5");
assert(f2.n === 1 && f2.d === 2, "'0.5' = 1/2");
console.log("ok: '0.5' = 1/2");

// toString.
var f3 = new Fraction(22, 7);
var s = f3.toString();
assert(s.indexOf("3") === 0, "22/7 ~ 3.14...; got " + s);
console.log("ok: 22/7 =", s);

// Divide.
var f4 = new Fraction(3, 4).div(new Fraction(2, 3));
assert(f4.n === 9 && f4.d === 8, "3/4 / 2/3 = 9/8; got " + f4.toString());
console.log("ok: 3/4 / 2/3 = 9/8");

console.log("\nfraction.js smoke: all assertions passed");
