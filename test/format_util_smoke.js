// format-util: tiny %s/%d/%j printf-style formatter.

var format = require("./vendor/format-util.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(format("hello %s", "world"), "hello world", "%s");
eq(format("%d + %d = %d", 1, 2, 3), "1 + 2 = 3", "%d");
eq(format("plain"), "plain", "no placeholders");
console.log("ok: 3 format-util forms");

console.log("\nformat-util smoke: all assertions passed");
