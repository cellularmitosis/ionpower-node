// natural-compare: sort comparator that handles "file10" > "file9".

var natural = require("./vendor/natural-compare.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var sorted = ["file10", "file2", "file1", "file11"].sort(natural);
assert(sorted[0] === "file1", "first is file1; got " + sorted[0]);
assert(sorted[1] === "file2", "second is file2; got " + sorted[1]);
assert(sorted[2] === "file10", "third is file10");
assert(sorted[3] === "file11", "fourth is file11");
console.log("ok: numeric-in-strings: " + sorted.join(", "));

// Regular string sort would give [file1, file10, file11, file2].
// We just verified natural-compare gets it right.
console.log("\nnatural-compare smoke: all assertions passed");
