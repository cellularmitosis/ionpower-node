// jsbn: Tom Wu's BigInteger (older API style; pre-BigInt).

var jsbn = require("./vendor/jsbn.js");
var BI = jsbn.BigInteger || jsbn;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// 2^100 - 1
var x = new BI("2", 10).pow(100).subtract(BI.ONE);
assert(x.toString() === "1267650600228229401496703205375", "2^100 - 1: " + x.toString());
console.log("ok: 2^100 - 1");

// Modular exponentiation: 3^10 mod 7 = 4
var r = new BI("3", 10).modPow(new BI("10", 10), new BI("7", 10));
assert(r.intValue() === 4, "modPow 3^10 mod 7: " + r.intValue());
console.log("ok: 3^10 mod 7 = 4");

console.log("\njsbn smoke: all assertions passed");
