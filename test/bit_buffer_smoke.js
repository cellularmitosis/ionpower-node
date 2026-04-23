// bit-buffer: read/write packed bits out of an ArrayBuffer.

var bb = require("./vendor/bit-buffer.js");
var BitView   = bb.BitView;
var BitStream = bb.BitStream;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var buf = new ArrayBuffer(4);
var bs  = new BitStream(buf);

bs.writeBits(0xA, 4);     // 1010
bs.writeBits(0x5, 4);     // 0101
bs.writeBits(0x12345, 20);

bs.index = 0;
assert(bs.readBits(4) === 0xA, "read 4 bits: 0xA");
assert(bs.readBits(4) === 0x5, "read 4 bits: 0x5");
assert(bs.readBits(20) === 0x12345, "read 20 bits: 0x12345");
console.log("ok: readBits/writeBits round-trip");

console.log("\nbit-buffer smoke: all assertions passed");
