// xxhashjs: xxHash32/64 in pure JS.

var XXH = require("./vendor/xxhashjs.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var seed = 0xDEADBEEF;

// 32-bit.
var h32 = XXH.h32("hello", seed).toString(16);
assert(typeof h32 === "string", "h32 string: " + h32);
assert(h32 === XXH.h32("hello", seed).toString(16), "deterministic");
assert(h32 !== XXH.h32("hello", 0x12345678).toString(16), "different seed");
console.log("ok: xxhash32('hello') = 0x" + h32);

// 64-bit (returns a UINT64 object with toString).
var h64 = XXH.h64("hello", seed).toString(16);
assert(typeof h64 === "string", "h64 string");
console.log("ok: xxhash64('hello') = 0x" + h64);

// Streaming.
var s = XXH.h32(seed);
s.update("foo"); s.update("bar");
var sd = s.digest().toString(16);
var single = XXH.h32("foobar", seed).toString(16);
assert(sd === single, "streaming matches single: " + sd + " vs " + single);
console.log("ok: streaming equals single-shot");

console.log("\nxxhashjs smoke: all assertions passed");
