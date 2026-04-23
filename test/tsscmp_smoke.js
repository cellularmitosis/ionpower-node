// tsscmp: timing-safe string compare (uses crypto.createHmac underneath).

var tsscmp = require("./vendor/tsscmp.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

assert(tsscmp("hello", "hello") === true,  "equal");
assert(tsscmp("hello", "HELLO") === false, "case-sensitive");
assert(tsscmp("a", "abc") === false,       "length differs");
console.log("ok: tsscmp");

console.log("\ntsscmp smoke: all assertions passed");
