// alea: small fast seeded PRNG.

var Alea = require("./vendor/alea.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var rng1 = new Alea("seed");
var rng2 = new Alea("seed");

// Reproducibility.
for (var i = 0; i < 10; ++i) {
    var a = rng1(), b = rng2();
    assert(a === b, "same seed at step " + i);
}
console.log("ok: 10 draws deterministic");

// Range.
var r = new Alea(42)();
assert(r >= 0 && r < 1, "range [0,1): " + r);
console.log("ok: range");

// uint32.
var u = new Alea(42).uint32();
assert(Number.isInteger(u) && u >= 0, "uint32 integer: " + u);
console.log("ok: uint32");

console.log("\nalea smoke: all assertions passed");
