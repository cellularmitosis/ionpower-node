// crc-32: classic CRC32 (SheetJS).

var CRC32 = require("./vendor/crc32.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Known test vector: CRC32 of "123456789" = 0xCBF43926.
var h = CRC32.str("123456789");
// Some impls return signed int.
var uh = h >>> 0;
assert(uh === 0xCBF43926, "'123456789' -> 0xCBF43926, got 0x" + uh.toString(16));
console.log("ok: CRC32('123456789') = 0xCBF43926");

// Empty.
var e = CRC32.str("") >>> 0;
assert(e === 0, "'' CRC32 = 0, got " + e);
console.log("ok: empty = 0");

// Bytes input.
var b = CRC32.buf([1, 2, 3, 4]) >>> 0;
assert(typeof b === "number", "bytes input ok");
console.log("ok: bytes input -> 0x" + b.toString(16));

console.log("\ncrc32 smoke: all assertions passed");
