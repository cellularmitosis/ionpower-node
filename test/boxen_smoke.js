// boxen: draw an ASCII/Unicode box around a string. Chains chalk +
// string-width + widest-line + cli-boxes + camelcase. Good exercise
// of our vendor-resolver walk.

var boxen = require("./vendor/boxen.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var out = boxen("hello\nworld", {});
assert(typeof out === "string", "returns string");
var lines = out.split("\n");
assert(lines.length >= 4, "at least 4 lines (top, 2 content, bottom): got " + lines.length);

// Top + bottom should contain box-drawing chars (some non-ASCII).
var top = lines[0];
assert(top.length > 4, "top line has width");
console.log("ok: boxen default single border");

// Custom border style.
var rounded = boxen("x", { borderStyle: "round" });
assert(typeof rounded === "string", "round returns string");
console.log("ok: boxen round borderStyle");

// padding option increases height.
var padded = boxen("h", { padding: 1 });
var padLines = padded.split("\n");
var unpadded = boxen("h", {});
var unpadLines = unpadded.split("\n");
assert(padLines.length > unpadLines.length, "padding expands height");
console.log("ok: boxen padding");

console.log("\nboxen smoke: all assertions passed");
