// flatten: flatten nested arrays to a depth.

var flatten = require("./vendor/flatten.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(flatten([1, [2, 3], [4, [5]]]), [1, 2, 3, 4, 5], "deep flatten");
eq(flatten([1, [2, [3]]], 1), [1, 2, [3]], "depth 1");
eq(flatten([]), [], "empty");
console.log("ok: 3 flatten forms");

console.log("\nflatten smoke: all assertions passed");
