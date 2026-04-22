// Smoke test: nanoid 3.3.7 on ionpower-node.
// Multi-file CJS (nanoid.js requires ./url-alphabet/index.cjs).
// Tests our require resolution for .cjs extension.

const { nanoid, customAlphabet, urlAlphabet } = require("./vendor/nanoid.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Default nanoid
var id = nanoid();
assert(typeof id === "string", "nanoid returns string");
assert(id.length === 21,       "default length 21");
console.log("ok: nanoid():", id);

// Custom length
var short = nanoid(8);
assert(short.length === 8, "custom length");
console.log("ok: nanoid(8):", short);

// Uniqueness
var seen = {};
for (var i = 0; i < 100; ++i) {
    var x = nanoid();
    assert(!seen[x], "uniqueness: saw duplicate");
    seen[x] = 1;
}
console.log("ok: 100 nanoid() calls all unique");

// Custom alphabet
var hexId = customAlphabet("0123456789abcdef", 16);
var h = hexId();
assert(/^[0-9a-f]{16}$/.test(h), "custom hex alphabet: " + h);
console.log("ok: customAlphabet:", h);

assert(typeof urlAlphabet === "string" && urlAlphabet.length > 0, "urlAlphabet exported");
console.log("ok: urlAlphabet is " + urlAlphabet.length + " chars");

console.log("\nnanoid smoke: all assertions passed");
