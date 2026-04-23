// ansi-regex, strip-ansi, ansi-styles: the terminal-coloring trio that
// half of CLI-land depends on. Most color/spinner/progress libs want
// these as their base layer.

var ansiRegex  = require("./vendor/ansi-regex.js");
var stripAnsi  = require("./vendor/strip-ansi.js");
var ansiStyles = require("./vendor/ansi-styles.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// ansi-regex returns a RegExp that matches ANSI escape sequences.
var re = ansiRegex();
assert(re instanceof RegExp, "ansi-regex() returns a RegExp");
assert(re.test("\u001B[31mred\u001B[0m"), "matches SGR red sequence");
assert(!re.test("plain text"), "no match on plain text");
console.log("ok: ansi-regex");

// strip-ansi removes all ANSI codes.
assert(stripAnsi("\u001B[31mhello\u001B[0m") === "hello", "strip SGR red");
assert(stripAnsi("\u001B[1;33;42m warn \u001B[0m") === " warn ", "strip complex SGR");
assert(stripAnsi("no codes") === "no codes", "no codes -> identity");
console.log("ok: strip-ansi");

// ansi-styles: open/close codes. red = '\u001B[31m', reset = '\u001B[39m'.
// Don't touch the lazy color-convert paths — this project doesn't ship
// color-convert. Plain styles only.
assert(ansiStyles.red && ansiStyles.red.open === "\u001B[31m", "ansiStyles.red.open");
assert(ansiStyles.red.close === "\u001B[39m", "ansiStyles.red.close");
assert(ansiStyles.bold.open === "\u001B[1m", "ansiStyles.bold.open");
assert(ansiStyles.reset.open === "\u001B[0m", "ansiStyles.reset.open");
console.log("ok: ansi-styles");

console.log("\nansi_utils smoke: all assertions passed");
