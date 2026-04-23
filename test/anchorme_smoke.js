// anchorme: auto-link URLs/emails inside text.

var anchorme = require("./vendor/anchorme.js");
anchorme = anchorme.default || anchorme;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var text = "Visit https://example.com and email hi@example.com";
var out = anchorme(text);
assert(out.indexOf("<a") >= 0, "wrapped in anchor tag: " + out);
// anchorme adds its own http:// prefix to already-http URLs; we just care
// that the anchor text is the URL.
assert(out.indexOf(">https://example.com</a>") >= 0,
       "URL preserved in anchor body: " + out);
console.log("ok: auto-link");

// list() returns structured metadata.
var m = anchorme.list(text);
assert(m.length >= 2, "found >=2 links: " + m.length);
console.log("ok: list() found " + m.length + " links");

console.log("\nanchorme smoke: all assertions passed");
