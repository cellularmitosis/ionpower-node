// Smoke test: tinycolor2 on ionpower-node.
const tinycolor = require("./vendor/tinycolor.js");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// Parse hex.
var c = tinycolor("#3366cc");
assert(c.isValid(),                     "hex parsed");
assert(c.toHex() === "3366cc",          "toHex: " + c.toHex());
assert(c.toRgbString() === "rgb(51, 102, 204)", "toRgbString: " + c.toRgbString());
assert(c.toHslString().indexOf("hsl") === 0,    "toHslString shape");
console.log("ok: parse hex -> rgb/hsl");

// Parse named.
var red = tinycolor("red");
assert(red.toHex() === "ff0000", "named 'red' -> #ff0000");
console.log("ok: named color");

// Manipulation.
assert(tinycolor("#888").darken(20).toHex()  !== "888888", "darken changes hex");
assert(tinycolor("#888").lighten(20).toHex() !== "888888", "lighten changes hex");
console.log("ok: darken / lighten");

// Brightness / contrast.
var dark = tinycolor("#000");
var light = tinycolor("#fff");
assert(light.getBrightness() > dark.getBrightness(), "white brighter than black");
assert(tinycolor.readability("#000", "#fff") > 20, "contrast b/w black and white is ~21");
console.log("ok: brightness / readability");

// Mix.
var mid = tinycolor.mix("#ff0000", "#0000ff", 50);
assert(mid.toHex() === "800080", "mix red+blue 50% = purple, got " + mid.toHex());
console.log("ok: mix");

console.log("\ntinycolor smoke: all assertions passed");
