// array-union (sindresorhus flavor): dedupe + concat arrays.

var arrayUnion = require("./vendor/array-union.js");
arrayUnion = arrayUnion.default || arrayUnion;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(arrayUnion([1, 2, 3], [2, 3, 4]), [1, 2, 3, 4], "union");
eq(arrayUnion([1], [2], [3], [1, 2]), [1, 2, 3], "multi-source");
eq(arrayUnion(), [], "no args");
console.log("ok: 3 array-union forms");

console.log("\narray-union smoke: all assertions passed");
