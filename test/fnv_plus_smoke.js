// fnv-plus: FNV-1a hash at multiple bit widths.

var fnv = require("./vendor/fnv-plus.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var h32 = fnv.hash("hello world", 32).hex();
assert(typeof h32 === "string" && h32.length === 8, "32-bit hex: " + h32);
assert(h32 === fnv.hash("hello world", 32).hex(), "deterministic");
assert(h32 !== fnv.hash("goodbye", 32).hex(), "different input differs");
console.log("ok: fnv32('hello world') = 0x" + h32);

var h64 = fnv.hash("hello world", 64).hex();
assert(h64.length === 16, "64-bit hex: " + h64);
console.log("ok: fnv64 = 0x" + h64);

// quick fast()
var f = fnv.fast1a32("ionpower-node");
assert(typeof f === "number", "fast1a32 number");
console.log("ok: fast1a32 =", f);

console.log("\nfnv-plus smoke: all assertions passed");
