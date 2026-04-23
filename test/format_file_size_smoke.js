// format-file-size: human-friendly bytes (123456 -> "120.56 KB").

var formatFS = require("./vendor/format-file-size.js");
formatFS = formatFS.default || formatFS;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var out = formatFS(1024);
assert(/KB|K/.test(out) || out.indexOf("1") !== -1, "1024 -> something KB-ish: " + out);
console.log("ok: format-file-size 1024 =", out);

var m = formatFS(1024 * 1024);
assert(/MB|M/.test(m), "1MB: " + m);
console.log("ok: format-file-size 1 MB =", m);

console.log("\nformat-file-size smoke: all assertions passed");
