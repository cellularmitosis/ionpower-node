// indent-string: prefix every line of a string with N indents.

var indent = require("./vendor/indent-string.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(indent("hi", 2), "  hi", "default 2 spaces");
eq(indent("a\nb", 1), " a\n b", "multiline");
eq(indent("hi", 3, { indent: "\t" }), "\t\t\thi", "custom tab indent");
eq(indent("a\n\nb", 2), "  a\n\n  b", "blank line default skipped");
console.log("ok: 4 indent-string forms");

console.log("\nindent-string smoke: all assertions passed");
