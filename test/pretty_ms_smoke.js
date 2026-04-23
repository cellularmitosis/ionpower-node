// pretty-ms: render a millisecond duration in human form.

var prettyMsMod = require("./vendor/pretty-ms.js");
var prettyMs = prettyMsMod.default || prettyMsMod;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(prettyMs(1500), "1.5s", "1500ms = 1.5s");
eq(prettyMs(30000), "30s",  "30000ms = 30s");
eq(prettyMs(3600000), "1h",  "3600000ms = 1h");
eq(prettyMs(86400000), "1d", "86400000ms = 1d");
console.log("ok: pretty-ms");

console.log("\npretty_ms smoke: all assertions passed");
