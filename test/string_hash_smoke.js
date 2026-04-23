// string-hash: tiny non-crypto string hash.

var hash = require("./vendor/string-hash.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var a = hash("hello");
var b = hash("hello");
var c = hash("world");

assert(typeof a === "number" && a > 0, "returns number: " + a);
assert(a === b, "deterministic");
assert(a !== c, "different input differs");
console.log("ok: hash('hello') =", a, "hash('world') =", c);

console.log("\nstring-hash smoke: all assertions passed");
