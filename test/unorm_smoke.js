// unorm: pure-JS Unicode normalization (replaces our identity polyfill
// for the libraries that got passed it).

var unorm = require("./vendor/unorm.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Canonical decomposition: \u00E9 (é) -> e + \u0301 (combining acute).
var decomposed = unorm.nfd("café");
assert(decomposed.length > "café".length, "NFD expands precomposed: " + decomposed.length);
assert(decomposed.charCodeAt(decomposed.length - 1) === 0x0301, "last char is combining acute");
console.log("ok: nfd");

// Recompose.
var recomposed = unorm.nfc(decomposed);
assert(recomposed === "café", "NFC recomposes");
console.log("ok: nfc");

// NFKC: a-circle + ² compatibility.
var fancy = "\u2460\u2461\u2462";  // ①②③
var simple = unorm.nfkc(fancy);
assert(simple === "123", "NFKC ①②③ -> 123; got " + simple);
console.log("ok: nfkc");

console.log("\nunorm smoke: all assertions passed");
