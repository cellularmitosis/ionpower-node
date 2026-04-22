// figlet: ASCII banner fonts.
// We vendor the Standard.flf font alongside the library itself.

var fs     = require("fs");
var path   = require("path");
var figlet = require("./vendor/figlet.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var fontPath = path.join(__dirname, "vendor", "Standard.flf");
var fontData = fs.readFileSync(fontPath, "utf8");
assert(fontData.length > 10000, "Standard.flf loaded (" + fontData.length + " bytes)");

// Register the font so figlet.textSync can find it.
figlet.parseFont("Standard", fontData);

var banner = figlet.textSync("HELLO", { font: "Standard" });
assert(banner.length > 100, "banner has content (" + banner.length + " chars)");
assert(banner.indexOf("_") >= 0 || banner.indexOf("|") >= 0,
       "banner contains ASCII art characters");
console.log(banner);
console.log("ok: figlet rendered 'HELLO' in Standard font (" + banner.length + " chars)");

// Another shorter word.
var b2 = figlet.textSync("G5", { font: "Standard" });
assert(b2.length > 20, "G5 banner has content");
console.log(b2);
console.log("ok: figlet rendered 'G5'");

console.log("\nfiglet smoke: all assertions passed");
