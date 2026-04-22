// randomcolor: generate pleasant random colors.

var randomColor = require("./vendor/randomcolor.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var c = randomColor({ seed: 42 });
assert(typeof c === "string" && c.length === 7 && c[0] === "#",
       "hex color expected; got " + c);
console.log("ok: seeded hex color:", c);

// Same seed -> same result.
var c2 = randomColor({ seed: 42 });
assert(c === c2, "seeded reproducibility");
console.log("ok: seed reproducibility");

// Different seed -> (almost certainly) different.
var c3 = randomColor({ seed: 43 });
assert(c3 !== c, "seed 43 should differ from 42");
console.log("ok: different seeds differ");

// Hue.
var red = randomColor({ seed: 1, hue: "red" });
assert(red[0] === "#", "red still hex");
console.log("ok: hue:red ->", red);

// Count.
var arr = randomColor({ seed: 7, count: 5 });
assert(Array.isArray(arr) && arr.length === 5, "count produces array of 5");
console.log("ok: count:5 ->", arr.join(", "));

console.log("\nrandomcolor smoke: all assertions passed");
