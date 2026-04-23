// big-integer: arbitrary-precision integer (predates native BigInt).

var bigInt = require("./vendor/big-integer.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// 100!
var fact = bigInt(1);
for (var i = 2; i <= 100; ++i) fact = fact.multiply(i);
var s = fact.toString();
assert(s.length > 150, "100! has >150 digits: " + s.length);
// Last 10 digits should be 0 (many trailing zeros from powers of 10).
assert(s.slice(-10) === "0000000000", "100! ends in 10 zeros: ..." + s.slice(-15));
console.log("ok: 100! =", s.slice(0, 20) + "..." + s.slice(-20));

// 2^256
var p = bigInt(2).pow(256);
assert(p.toString() === "115792089237316195423570985008687907853269984665640564039457584007913129639936",
       "2^256: " + p.toString());
console.log("ok: 2^256");

// GCD (static helper).
var g = bigInt.gcd(bigInt(48), bigInt(36));
assert(g.toString() === "12", "gcd(48,36) = 12; got " + g.toString());
console.log("ok: gcd");

console.log("\nbig-integer smoke: all assertions passed");
