// ua-parser-js: user-agent string -> { browser, os, device }.

var UAParser = require("./vendor/ua-parser.js");
// Module shape: UAParser() is both callable + a .UAParser property on newer.
if (UAParser.UAParser) UAParser = UAParser.UAParser;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var ff = "Mozilla/5.0 (Macintosh; PPC Mac OS X 10.4; rv:45.0) Gecko/20100101 Firefox/45.0";
var ua = new UAParser(ff);
var res = ua.getResult();

assert(res.browser.name === "Firefox", "browser Firefox: " + res.browser.name);
assert(res.browser.version.indexOf("45") === 0, "browser 45: " + res.browser.version);
assert(res.os.name === "Mac OS", "os Mac OS: " + res.os.name);
assert(res.cpu.architecture === "ppc" || res.cpu.architecture === "powerpc",
       "cpu ppc: " + res.cpu.architecture);
console.log("ok: TenFourFox-45 UA parsed:", JSON.stringify(res.browser), JSON.stringify(res.os), JSON.stringify(res.cpu));

// Chrome on Windows.
var chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var ua2 = new UAParser(chrome);
var res2 = ua2.getResult();
assert(res2.browser.name === "Chrome", "chrome name: " + res2.browser.name);
assert(res2.os.name === "Windows", "win name: " + res2.os.name);
console.log("ok: Chrome on Windows parsed");

console.log("\nua-parser smoke: all assertions passed");
