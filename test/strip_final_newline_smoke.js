// strip-final-newline: trim one trailing \n or \r\n.

var mod = require("./vendor/strip-final-newline.js");
var strip = mod.default || mod;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(strip("hello\n"),     "hello",     "single LF");
eq(strip("hello\r\n"),   "hello",     "CRLF");
eq(strip("hello"),       "hello",     "no newline");
eq(strip("hello\n\n"),   "hello\n",   "only strips one");
eq(strip(""),            "",          "empty");
console.log("ok: strip-final-newline (5 cases)");

console.log("\nstrip-final-newline smoke: all assertions passed");
