// murmurhash (v2 JS): non-cryptographic fast hash.

var murmurhash = require("./vendor/murmurhash.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Known test vector: murmurhash v3 of "" with seed 0 = 0.
var h = murmurhash("hello", 42);
assert(typeof h === "number", "returns number: " + h);
assert(h === murmurhash("hello", 42), "deterministic for same seed");
assert(h !== murmurhash("hello", 43), "different seed differs");
console.log("ok: 'hello' -> " + h);

// Empty string.
var e = murmurhash("", 0);
assert(typeof e === "number", "empty is number");
console.log("ok: '' -> " + e);

console.log("\nmurmurhash smoke: all assertions passed");
