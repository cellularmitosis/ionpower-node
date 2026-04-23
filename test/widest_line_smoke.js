// widest-line: return the width of the widest line in a multi-line
// string. Uses string-width so emoji / fullwidth CJK work.

var widestLineMod = require("./vendor/widest-line.js");
var widestLine = widestLineMod.default || widestLineMod;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(widestLine("short\nmuch longer line\nmid"), 16, "widest line = 16 cells");
eq(widestLine(""), 0, "empty = 0");
eq(widestLine("oneline"), 7, "single line");
// Color codes shouldn't count.
eq(widestLine("\u001B[31mhello\u001B[0m"), 5, "color codes stripped for width");
console.log("ok: widest-line (4 cases)");

console.log("\nwidest-line smoke: all assertions passed");
