// string-width: visual width of a string on a terminal. Handles
// ANSI, emoji, and fullwidth CJK characters.

var stringWidth = require("./vendor/string-width.js");
var isFull      = require("./vendor/is-fullwidth-code-point.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}
function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Plain ASCII.
eq(stringWidth("hello"), 5, "hello = 5 cells");
eq(stringWidth(""), 0, "empty = 0 cells");
// Color codes stripped first.
eq(stringWidth("\u001B[31mhello\u001B[0m"), 5, "red hello = 5 cells");
// Fullwidth CJK = 2 cells each. 3 chars = 6 cells.
eq(stringWidth("古池や"), 6, "hiragana = 2 cells each");
console.log("ok: string-width basic");

// is-fullwidth-code-point predicate.
assert(isFull("古".codePointAt(0)) === true, "古 is fullwidth");
assert(isFull("a".codePointAt(0)) === false, "a is not fullwidth");
console.log("ok: is-fullwidth-code-point");

console.log("\nstring_width smoke: all assertions passed");
