// color-convert + color-name via node_modules resolution.
var convert = require("color-convert");

function assert(cond, msg) {
    if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

// rgb <-> hex
assert(convert.rgb.hex(51, 102, 204) === "3366CC", "rgb.hex");
assert(JSON.stringify(convert.hex.rgb("3366CC")) === "[51,102,204]", "hex.rgb");

// rgb <-> hsl
var hsl = convert.rgb.hsl(255, 0, 0);
assert(hsl[0] === 0 && hsl[1] === 100 && hsl[2] === 50, "red -> hsl");

// ansi256
var ansi = convert.rgb.ansi256(255, 0, 0);
assert(typeof ansi === "number", "rgb.ansi256 returns number");

// Via color-name
var cnames = require("color-name");
assert(JSON.stringify(cnames.red)   === "[255,0,0]", "red name");
assert(JSON.stringify(cnames.green) === "[0,128,0]", "green name");

console.log("ok: color-convert (rgb.hex, hex.rgb, rgb.hsl, rgb.ansi256)");
console.log("ok: color-name (red, green)");
console.log("\ncolor-convert + color-name smoke: all assertions passed");
