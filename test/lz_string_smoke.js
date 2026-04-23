// lz-string: tiny LZ-based string compressor (browser-focused).

var LZString = require("./vendor/lz-string.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var input = "The IonPower JIT is a 32-bit PowerPC backend for IonMonkey. ".repeat(20);

var compressed = LZString.compressToBase64(input);
assert(compressed.length < input.length, "compression reduces size: " + input.length + " -> " + compressed.length);
console.log("ok: compress " + input.length + " -> " + compressed.length + " (" +
            Math.round(compressed.length / input.length * 100) + "%)");

var back = LZString.decompressFromBase64(compressed);
assert(back === input, "round-trip equals original");
console.log("ok: round-trip equals");

// EncodedURIComponent variant.
var u = LZString.compressToEncodedURIComponent(input);
assert(LZString.decompressFromEncodedURIComponent(u) === input, "URIComponent round-trip");
console.log("ok: URIComponent round-trip");

console.log("\nlz-string smoke: all assertions passed");
