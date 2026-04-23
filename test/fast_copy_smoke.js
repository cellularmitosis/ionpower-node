// fast-copy: fast deep-copy.

var copy = require("./vendor/fast-copy.js");
copy = copy.default || copy;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

var orig = { a: 1, b: { c: 2, d: [3, 4] }, e: new Date(0) };
var dup = copy(orig);

eq(dup, orig, "dup equals orig");
// Not the same reference.
if (dup === orig) { console.error("FAIL: same reference"); process.exit(1); }
if (dup.b === orig.b) { console.error("FAIL: nested same reference"); process.exit(1); }

// Mutate original; dup unaffected.
orig.b.c = 999;
if (dup.b.c === 999) { console.error("FAIL: dup mirrored mutation"); process.exit(1); }
console.log("ok: deep copy independence");

console.log("\nfast-copy smoke: all assertions passed");
