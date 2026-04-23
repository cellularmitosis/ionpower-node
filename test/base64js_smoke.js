// base64-js: Uint8Array <-> base64 string.

var base64js = require("./vendor/base64-js.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Encode.
var bytes = new Uint8Array([72, 105, 33]); // "Hi!"
eq(base64js.fromByteArray(bytes), "SGkh", "encode Hi!");
console.log("ok: fromByteArray");

// Decode.
var decoded = base64js.toByteArray("SGVsbG8=");
eq(decoded.length, 5, "decode length");
eq(decoded[0], 72, "H=72");
eq(decoded[4], 111, "o=111");
console.log("ok: toByteArray");

// byteLength helper.
eq(base64js.byteLength("SGVsbG8="), 5, "byteLength Hello=5");
console.log("ok: byteLength");

console.log("\nbase64-js smoke: all assertions passed");
