// cookie-signature: signed-cookie helper (uses crypto.createHmac).
// Validates the new crypto.createHmac works for express-session-style
// signed-cookie flows.

var sig = require("./vendor/cookie-signature.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

var secret = "ionpower-secret";
var value  = "hello-session-42";

var signed = sig.sign(value, secret);
assert(signed.indexOf(value + ".") === 0, "signed starts with original value: " + signed);
console.log("ok: sign:", signed);

var unsigned = sig.unsign(signed, secret);
eq(unsigned, value, "unsign returns original");
console.log("ok: unsign round-trip");

var tampered = sig.unsign(value + ".invalid-hmac", secret);
eq(tampered, false, "tampered unsign returns false");
console.log("ok: tampered returns false");

var wrongSecret = sig.unsign(signed, "other-secret");
eq(wrongSecret, false, "wrong secret returns false");
console.log("ok: wrong-secret returns false");

console.log("\ncookie-signature smoke: all assertions passed");
