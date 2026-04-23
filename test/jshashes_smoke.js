// jshashes: pure-JS MD5/SHA-1/SHA-256/SHA-512 + HMAC.

var Hashes = require("./vendor/jshashes.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Known vectors.
var md5 = new Hashes.MD5().hex("abc");
assert(md5 === "900150983cd24fb0d6963f7d28e17f72", "MD5(abc): " + md5);
console.log("ok: MD5");

var sha1 = new Hashes.SHA1().hex("abc");
assert(sha1 === "a9993e364706816aba3e25717850c26c9cd0d89d", "SHA-1(abc): " + sha1);
console.log("ok: SHA-1");

var sha256 = new Hashes.SHA256().hex("abc");
assert(sha256 === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
       "SHA-256(abc): " + sha256);
console.log("ok: SHA-256");

// HMAC.
var hmac = new Hashes.SHA256().hex_hmac("Jefe", "what do ya want for nothing?");
assert(hmac === "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
       "HMAC-SHA-256: " + hmac);
console.log("ok: HMAC-SHA-256 (RFC 4231)");

console.log("\njshashes smoke: all assertions passed");
