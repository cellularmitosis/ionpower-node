// SJCL: Stanford JavaScript Crypto Library.

var sjcl = require("./vendor/sjcl.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// SHA-256.
var h = sjcl.hash.sha256.hash("abc");
var hex = sjcl.codec.hex.fromBits(h);
assert(hex === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
       "SHA-256('abc'): " + hex);
console.log("ok: SHA-256 vector");

// HMAC. sjcl's misc.hmac takes a bitArray key, not a raw string. Convert.
var keyBits = sjcl.codec.utf8String.toBits("Jefe");
var mac = new sjcl.misc.hmac(keyBits).mac("what do ya want for nothing?");
var macHex = sjcl.codec.hex.fromBits(mac);
assert(macHex === "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
       "HMAC-SHA-256 vector: " + macHex);
console.log("ok: HMAC-SHA-256 vector");

// AES via ccm mode (encrypt + decrypt).
var pwd = sjcl.misc.cachedPbkdf2("password", { salt: sjcl.codec.utf8String.toBits("salt") });
var key = sjcl.codec.hex.fromBits(pwd.key);
assert(key.length > 40, "pbkdf2 key derived: " + key);
console.log("ok: pbkdf2");

// Roundtrip encrypt.
var cipher = sjcl.encrypt("secret-pass", "hello world");
var plain = sjcl.decrypt("secret-pass", cipher);
assert(plain === "hello world", "encrypt/decrypt round-trip");
console.log("ok: AES encrypt/decrypt round-trip");

console.log("\nsjcl smoke: all assertions passed");
