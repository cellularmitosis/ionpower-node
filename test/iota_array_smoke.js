// iota-array: generate [0, 1, 2, ..., n-1]. Standalone.

var iota = require("./vendor/iota-array.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(iota(0), [],       "iota(0)");
eq(iota(1), [0],      "iota(1)");
eq(iota(5), [0, 1, 2, 3, 4], "iota(5)");
console.log("ok: iota-array");

console.log("\niota-array smoke: all assertions passed");
