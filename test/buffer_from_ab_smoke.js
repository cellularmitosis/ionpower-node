// Buffer.from(ArrayBuffer) and Buffer.from(Uint8Array) — both should
// copy the bytes through. Up to v0.73 ArrayBuffer was treated as a
// generic array-like via the missing .length prop and produced a
// 0-byte Buffer, breaking fetch().arrayBuffer() -> Buffer.from(ab).

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// ---- ArrayBuffer with known content ----
var ab = new ArrayBuffer(5);
var view = new Uint8Array(ab);
view[0] = 0x1f; view[1] = 0x8b; view[2] = 0x08; view[3] = 0x00; view[4] = 0xff;

var buf = Buffer.from(ab);
assert(Buffer.isBuffer(buf), "Buffer.from(ab) returns a Buffer");
assert(buf.length === 5, "length matches AB byteLength (got " + buf.length + ")");
assert(buf[0] === 0x1f && buf[1] === 0x8b && buf[2] === 0x08 && buf[3] === 0x00 && buf[4] === 0xff,
       "bytes preserved through copy");
console.log("ok: Buffer.from(ArrayBuffer)");

// ---- Empty ArrayBuffer ----
var empty = Buffer.from(new ArrayBuffer(0));
assert(empty.length === 0, "empty ArrayBuffer -> 0-length Buffer");
console.log("ok: Buffer.from(empty ArrayBuffer)");

// ---- Uint8Array ----
var u8 = new Uint8Array([10, 20, 30, 40]);
var bufU8 = Buffer.from(u8);
assert(bufU8.length === 4, "Uint8Array.length = 4");
assert(bufU8[0] === 10 && bufU8[3] === 40, "values preserved");
console.log("ok: Buffer.from(Uint8Array)");

// ---- Buffer (typed array case) ----
var src = Buffer.alloc(3);
src[0] = 1; src[1] = 2; src[2] = 3;
var copy = Buffer.from(src);
assert(copy.length === 3, "copy.length = 3");
assert(copy[0] === 1 && copy[2] === 3, "values match");
// Verify it's a copy, not aliasing the same memory:
copy[0] = 99;
assert(src[0] === 1, "modifying copy doesn't affect source");
console.log("ok: Buffer.from(Buffer) is a copy");

// ---- Sliced typed array (byteOffset > 0) ----
var big = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
var slice = big.subarray(2, 6);  // [3, 4, 5, 6]
var sliceBuf = Buffer.from(slice);
assert(sliceBuf.length === 4, "sliced length");
assert(sliceBuf[0] === 3 && sliceBuf[3] === 6, "sliced contents");
console.log("ok: Buffer.from(typed array view at byteOffset)");

// ---- The headline case: round-trip through fetch().arrayBuffer() shape ----
// We don't actually fetch; just simulate the same shape: an
// ArrayBuffer carrying gzip magic.
var fakeAb = new ArrayBuffer(18);
var fakeView = new Uint8Array(fakeAb);
fakeView[0] = 0x1f; fakeView[1] = 0x8b; fakeView[2] = 0x08;
for (var i = 3; i < 18; i++) fakeView[i] = i;

var fakeBuf = Buffer.from(fakeAb);
assert(fakeBuf.length === 18, "round-trip length");
assert(fakeBuf[0] === 0x1f && fakeBuf[1] === 0x8b, "gzip magic survives");
console.log("ok: simulated fetch().arrayBuffer() -> Buffer.from(ab) round-trip");

console.log("\nbuffer_from_ab smoke: all assertions passed");
