// zero-fill: left-pad integer with leading zeros.

var zf = require("./vendor/zero-fill.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(zf(4, 42), "0042", "pad to 4");
eq(zf(6, 100), "000100", "pad to 6");
eq(zf(2, 1000), "1000", "no truncate");
console.log("ok: 3 zero-fill forms");

console.log("\nzero-fill smoke: all assertions passed");
