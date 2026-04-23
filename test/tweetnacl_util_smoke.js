// tweetnacl-util: string <-> Uint8Array helpers for tweetnacl.

var util = require("./vendor/tweetnacl-util.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// UTF-8 helpers.
var bytes = util.decodeUTF8("hello");
assert(bytes instanceof Uint8Array && bytes.length === 5, "decodeUTF8 len");
assert(util.encodeUTF8(bytes) === "hello", "encodeUTF8 round-trip");
console.log("ok: UTF-8 round-trip");

// Base64 helpers.
var b64 = util.encodeBase64(bytes);
assert(b64 === "aGVsbG8=", "base64: " + b64);
var back = util.decodeBase64(b64);
assert(util.encodeUTF8(back) === "hello", "base64 round-trip");
console.log("ok: base64 round-trip");

console.log("\ntweetnacl-util smoke: all assertions passed");
