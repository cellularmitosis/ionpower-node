// ansi-escapes: terminal control-sequence helpers.

var ansi = require("./vendor/ansi-escapes.js");
ansi = ansi.default || ansi;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

assert(typeof ansi.cursorUp === "function", "cursorUp function");
var up = ansi.cursorUp(3);
assert(up === "\u001B[3A", "cursorUp(3) = ESC[3A; got " + JSON.stringify(up));
console.log("ok: cursorUp");

assert(ansi.clearScreen === "\u001Bc", "clearScreen constant");
console.log("ok: clearScreen");

var link = ansi.link("https://example.com", "example");
assert(typeof link === "string" && link.indexOf("example") >= 0, "link produces text");
console.log("ok: link");

console.log("\nansi-escapes smoke: all assertions passed");
