// rgbcolor: parse any CSS color string into {r, g, b}.

var RGBColor = require("./vendor/rgbcolor.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var red = new RGBColor("red");
assert(red.ok, "red parses");
assert(red.r === 255 && red.g === 0 && red.b === 0, "red = (255,0,0): " + red.toRGB());
console.log("ok: rgbcolor: red");

var hex = new RGBColor("#00ff00");
assert(hex.ok && hex.r === 0 && hex.g === 255 && hex.b === 0, "#00ff00 = (0,255,0)");
console.log("ok: rgbcolor: #00ff00");

var rgb = new RGBColor("rgb(50, 100, 150)");
assert(rgb.ok && rgb.r === 50 && rgb.g === 100 && rgb.b === 150, "rgb(...) parsed");
console.log("ok: rgbcolor: rgb(50,100,150)");

var bad = new RGBColor("not a color");
assert(!bad.ok, "invalid -> !ok");
console.log("ok: rgbcolor: invalid rejected");

console.log("\nrgbcolor smoke: all assertions passed");
