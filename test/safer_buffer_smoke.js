// safer-buffer: a drop-in for Node Buffer with no-new-Buffer APIs.

var safer = require("./vendor/safer-buffer.js");
var Buffer = safer.Buffer;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// from / alloc.
var b = Buffer.from("hello", "utf8");
assert(b.length === 5, "Buffer.from utf8 length");
assert(b.toString("utf8") === "hello", "round-trip");
console.log("ok: safer Buffer.from / toString");

var a = Buffer.alloc(4);
a[0] = 0x41; a[1] = 0x42; a[2] = 0x43; a[3] = 0x44;
assert(a.toString("ascii") === "ABCD", "alloc + toString ascii");
console.log("ok: safer Buffer.alloc");

console.log("\nsafer-buffer smoke: all assertions passed");
