// bn.js: big-number arithmetic. Used by crypto / key libraries.
// Complements big-integer / big.js / bignumber.js in our vendor set.

var BN = require("./vendor/bn-js.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Factorial 20! (way past Number.MAX_SAFE_INTEGER's 2^53).
var f = new BN(1);
for (var i = 2; i <= 20; ++i) f = f.muln(i);
assert(f.toString() === "2432902008176640000", "20! = 2432902008176640000; got " + f.toString());
console.log("ok: bn.js 20! exact");

// 2^256 - 1.
var m = new BN(1).shln(256).subn(1);
assert(m.toString() === "115792089237316195423570985008687907853269984665640564039457584007913129639935",
       "2^256 - 1");
console.log("ok: bn.js 2^256 - 1");

// Modular exponentiation (fundamental crypto primitive).
// 3^13 mod 17 = 12.
var base = new BN(3), exp = new BN(13), mod = new BN(17);
assert(base.pow(exp).mod(mod).toNumber() === 12, "3^13 mod 17 = 12");
console.log("ok: bn.js modexp");

console.log("\nbn.js smoke: all assertions passed");
