// hash-sum: deterministic 8-hex-char hash of any value. Used by Vue
// loader and many caching layers.

var hash = require("./vendor/hash-sum.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Produces a stable 8-char hex string.
var h1 = hash("hello");
assert(typeof h1 === "string", "returns string");
assert(h1.length === 8, "8 hex chars: " + h1);
assert(/^[0-9a-f]{8}$/.test(h1), "hex: " + h1);
console.log("ok: hash-sum string -> " + h1);

// Determinism.
assert(hash("hello") === h1, "determinism on string");
assert(hash({a: 1, b: 2}) === hash({b: 2, a: 1}), "object hashes are order-independent");
console.log("ok: hash-sum determinism + order-independence");

// Different values -> different hashes (usually).
assert(hash("hello") !== hash("world"), "distinct strings -> distinct hashes");
assert(hash({a:1}) !== hash({a:2}), "distinct objects -> distinct hashes");
console.log("ok: hash-sum discriminates");

console.log("\nhash-sum smoke: all assertions passed");
