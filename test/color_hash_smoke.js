// color-hash: deterministic color for a string. Used in chat UIs to
// assign each username a stable color.

var ColorHashMod = require("./vendor/color-hash.js");
var ColorHash = ColorHashMod.default || ColorHashMod["default"] || ColorHashMod;
// The module may have both `default` and `ColorHash` exports — we just
// need whichever is the constructor.
if (typeof ColorHash !== "function") {
    ColorHash = ColorHashMod.ColorHash;
}

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(typeof ColorHash === "function", "ColorHash is a constructor");
var ch = new ColorHash();

// hex() returns '#rrggbb'.
var color = ch.hex("ionpower-node");
assert(/^#[0-9a-f]{6}$/i.test(color), "hex format: " + color);
console.log("ok: color-hash hex:", color);

// Determinism.
assert(ch.hex("ionpower-node") === color, "determinism");

// Different inputs -> different colors (almost always).
assert(ch.hex("foo") !== ch.hex("bar"), "foo != bar");
console.log("ok: color-hash deterministic + distinct");

// hsl / rgb shapes.
var hsl = ch.hsl("ionpower-node");
assert(Array.isArray(hsl) && hsl.length === 3, "hsl is [h,s,l]");
var rgb = ch.rgb("ionpower-node");
assert(Array.isArray(rgb) && rgb.length === 3, "rgb is [r,g,b]");
console.log("ok: color-hash hsl + rgb shapes");

console.log("\ncolor-hash smoke: all assertions passed");
