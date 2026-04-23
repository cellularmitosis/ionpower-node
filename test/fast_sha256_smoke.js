// fast-sha256: SHA-256 + HMAC + HKDF + PBKDF2.

var sha = require("./vendor/fast-sha256.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

function bytesToHex(b) {
    var hex = "";
    for (var i = 0; i < b.length; ++i) hex += ("0" + b[i].toString(16)).slice(-2);
    return hex;
}

// FIPS test vector: SHA-256('abc').
var h = sha.hash(new Uint8Array([0x61, 0x62, 0x63]));
assert(bytesToHex(h) === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
       "SHA-256('abc'): " + bytesToHex(h));
console.log("ok: SHA-256");

// HMAC.
var key = new TextEncoder().encode("Jefe");
var data = new TextEncoder().encode("what do ya want for nothing?");
var mac = sha.hmac(key, data);
assert(bytesToHex(mac) === "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
       "HMAC-SHA-256: " + bytesToHex(mac));
console.log("ok: HMAC-SHA-256");

console.log("\nfast-sha256 smoke: all assertions passed");
