// seedrandom: seeded PRNG (Mersenne Twister and ARC4).

var seedrandom = require("./vendor/seedrandom.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var rng1 = seedrandom("42");
var rng2 = seedrandom("42");

// Reproducibility across two RNGs with same seed.
for (var i = 0; i < 5; ++i) {
    var a = rng1(), b = rng2();
    assert(a === b, "same seed -> same draw at step " + i);
}
console.log("ok: seed determinism across 5 draws");

// Different seed -> (almost certainly) different.
var rng3 = seedrandom("43");
assert(rng3() !== seedrandom("42")(), "different seed differs");
console.log("ok: seed sensitivity");

// Range check: 0 <= r < 1.
var r = seedrandom("x")();
assert(r >= 0 && r < 1, "range [0,1): " + r);
console.log("ok: range [0,1) respected");

console.log("\nseedrandom smoke: all assertions passed");
