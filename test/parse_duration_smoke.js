// parse-duration: "5m30s" -> 330000 ms.

var parseMod = require("./vendor/parse-duration.js");
var parse = parseMod.default || parseMod;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(parse("1s"),     1000,       "1s");
eq(parse("1m"),     60000,      "1m");
eq(parse("1h"),     3600000,    "1h");
eq(parse("1.5s"),   1500,       "1.5s");
eq(parse("5m30s"),  330000,     "5m30s");
eq(parse("1d"),     86400000,   "1d");
console.log("ok: parse-duration (6 cases)");

console.log("\nparse-duration smoke: all assertions passed");
