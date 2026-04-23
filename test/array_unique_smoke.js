// array-unique: in-place de-dupe that preserves insertion order.

var unique = require("./vendor/array-unique.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(unique([1, 2, 3, 2, 1]),       [1, 2, 3],        "dedupe numbers");
eq(unique(["a", "b", "a", "c"]),  ["a", "b", "c"],  "dedupe strings");
eq(unique([]),                    [],                "empty");
eq(unique([1]),                   [1],               "single elem");
console.log("ok: array-unique (4 cases)");

console.log("\narray-unique smoke: all assertions passed");
