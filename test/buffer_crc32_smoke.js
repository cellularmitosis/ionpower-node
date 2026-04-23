// buffer-crc32: CRC32 over a Buffer.

var crc32 = require("./vendor/buffer-crc32.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// CRC32 of '123456789' = 0xCBF43926 (classic vector).
var b = Buffer.from("123456789", "utf8");
var r = crc32.unsigned(b);
assert(r === 0xCBF43926, "'123456789' vector; got 0x" + r.toString(16));
console.log("ok: 0xCBF43926");

// Empty.
assert(crc32.unsigned(Buffer.alloc(0)) === 0, "empty = 0");
console.log("ok: empty");

console.log("\nbuffer-crc32 smoke: all assertions passed");
