// split-lines: split on any line-terminator (\n, \r, \r\n, \u2028, \u2029).

var splitLinesMod = require("./vendor/split-lines.js");
var splitLines = splitLinesMod.default || splitLinesMod;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(splitLines("a\nb\nc"),     ["a", "b", "c"], "LF");
eq(splitLines("a\r\nb\r\nc"), ["a", "b", "c"], "CRLF");
eq(splitLines("single"),      ["single"],      "single line");
eq(splitLines(""),            [""],            "empty");
console.log("ok: split-lines (4 cases)");

// preserveNewlines keeps the terminator on each line.
var preserved = splitLines("a\nb\r\nc", { preserveNewlines: true });
eq(preserved, ["a\n", "b\r\n", "c"], "preserveNewlines");
console.log("ok: split-lines preserveNewlines");

console.log("\nsplit-lines smoke: all assertions passed");
