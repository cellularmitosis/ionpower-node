// wordwrap: James Halliday's wrapper.

var wordwrap = require("./vendor/wordwrap.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var wrap = wordwrap(20);
var out = wrap("The quick brown fox jumps over the lazy dog");
var lines = out.split("\n").filter(function (l) { return l.length > 0; });
assert(lines.length >= 2, "wrapped to >= 2 lines: " + lines.length);
lines.forEach(function (l) {
    assert(l.length <= 20, "line under 20 cols: |" + l + "|");
});
console.log("ok: 20-col wrap to " + lines.length + " lines");

// Narrow mode.
var narrow = wordwrap(5, 10);
var n = narrow("hello world foo bar baz");
assert(n.split("\n").length >= 3, "narrow wrap");
console.log("ok: narrow wrap");

console.log("\nwordwrap smoke: all assertions passed");
