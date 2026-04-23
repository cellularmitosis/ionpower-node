// arr-union + arr-diff: tiny set-algebra helpers.

var union = require("./vendor/arr-union.js");
var diff  = require("./vendor/arr-diff.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(union([1, 2, 3], [2, 3, 4]), [1, 2, 3, 4], "union");
eq(union(["a"], ["b"], ["a", "c"]), ["a", "b", "c"], "union multi-source");
console.log("ok: arr-union");

eq(diff([1, 2, 3, 4], [2, 3]), [1, 4], "diff");
eq(diff(["a", "b", "c"], ["b"], ["a"]), ["c"], "diff multi-source");
console.log("ok: arr-diff");

console.log("\narr-union/arr-diff smoke: all assertions passed");
