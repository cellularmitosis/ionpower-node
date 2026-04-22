// Smoke test: object-hash 3.x (stable hash of a JS value) on
// ionpower-node.
var hash = require("./vendor/object-hash.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Same shape -> same hash (across differently-ordered keys even).
var h1 = hash({ a: 1, b: [1, 2, { c: 3 }] });
var h2 = hash({ b: [1, 2, { c: 3 }], a: 1 });
assert(h1 === h2, "key order shouldn't matter; " + h1 + " vs " + h2);
console.log("ok: key-order-insensitive");

// Different shape -> different hash.
var h3 = hash({ a: 1, b: [1, 2, { c: 4 }] });
assert(h1 !== h3, "different values yield different hashes");
console.log("ok: shape-sensitive");

// Primitives.
var hn = hash(42);
var hs = hash("42");
assert(hn !== hs, "42 !== '42'");
assert(typeof hn === "string" && hn.length > 0, "hash returns a string");
console.log("ok: primitives");

// Fixed-vector reproducibility.
var fixed = hash("hello");
console.log("hash('hello') =", fixed);
assert(fixed === hash("hello"), "stable across calls");
console.log("ok: stable across calls");

// algorithm option
var md5 = hash("hello", { algorithm: "md5" });
assert(md5.length === 32, "md5 hash length 32 hex chars; got " + md5);
console.log("ok: md5 algorithm:", md5);

console.log("\nobject-hash smoke: all assertions passed");
