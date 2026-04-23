// is-unicode-supported: tests whether the terminal can render Unicode.
// Exercises the `require('node:process')` → our seeded process module.

var mod = require("./vendor/is-unicode-supported.js");
var isUnicodeSupported = mod.default || mod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var result = isUnicodeSupported();
assert(typeof result === "boolean", "returns boolean");
console.log("ok: is-unicode-supported =", result);

console.log("\nis-unicode-supported smoke: all assertions passed");
