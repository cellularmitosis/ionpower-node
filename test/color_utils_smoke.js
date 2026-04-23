// hex-rgb + rgb-hex + color-name: tiny color utilities.

var hexRgb = require("./vendor/hex-rgb.js");
hexRgb = hexRgb.default || hexRgb;
var rgbHex = require("./vendor/rgb-hex.js");
rgbHex = rgbHex.default || rgbHex;
var colorName = require("./vendor/color-name.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// hex -> rgb.
var r = hexRgb("#336699");
eq(r.red, 0x33, "red");
eq(r.green, 0x66, "green");
eq(r.blue, 0x99, "blue");
console.log("ok: hex-rgb");

// rgb -> hex.
eq(rgbHex(51, 102, 153), "336699", "rgb-hex");
eq(rgbHex("rgb(255,0,0)"), "ff0000", "rgb() string");
console.log("ok: rgb-hex");

// color-name.
eq(colorName.tomato, [255, 99, 71], "tomato");
eq(colorName.teal, [0, 128, 128], "teal");
console.log("ok: color-name");

console.log("\ncolor utilities smoke: all assertions passed");
