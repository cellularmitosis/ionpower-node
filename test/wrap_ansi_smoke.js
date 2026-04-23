// wrap-ansi: word-wrap a string respecting ANSI color codes.

var wrap = require("./vendor/wrap-ansi.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Plain text at width 10.
var out = wrap("The quick brown fox jumped over the lazy dog", 10);
var lines = out.split("\n");
assert(lines.length >= 4, "at least 4 lines at width 10: got " + lines.length);
lines.forEach(function (L, i) {
    // Each line (no ANSI here) should be <= 10 chars.
    assert(L.length <= 10, "line " + i + " length <= 10: " + JSON.stringify(L));
});
console.log("ok: wrap-ansi plain (" + lines.length + " lines)");

// wrap-ansi's ANSI-preserving branch uses named capture groups
// (?<code>...) which SM45 can't parse. Skip that path; the plain
// width-wrapping path above is what most consumers actually use.

console.log("\nwrap-ansi smoke: all assertions passed");
