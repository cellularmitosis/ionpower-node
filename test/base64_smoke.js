// base-64: yet another base64 lib (Mathias Bynens).

var b64 = require("./vendor/base-64.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

eq(b64.encode("Hello, World!"), "SGVsbG8sIFdvcmxkIQ==", "encode");
eq(b64.decode("SGVsbG8sIFdvcmxkIQ=="), "Hello, World!", "decode");
// Round-trip (Latin1-safe; base-64 lib rejects non-Latin1).
var input = "The IonPower JIT on a 32-bit PowerPC.";
eq(b64.decode(b64.encode(input)), input, "round-trip latin1");
console.log("ok: 3 base-64 forms");

console.log("\nbase-64 smoke: all assertions passed");
