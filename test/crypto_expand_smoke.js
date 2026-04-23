// SHA-1 + PBKDF2 + HMAC-SHA1: newly added this session.

var crypto = require("crypto");

function eq(a, b, msg) { if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); } }
function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// SHA-1 (FIPS PUB 180-1 test vectors).
eq(crypto.createHash("sha1").update("").digest("hex"),
   "da39a3ee5e6b4b0d3255bfef95601890afd80709", "sha1 empty");
eq(crypto.createHash("sha1").update("abc").digest("hex"),
   "a9993e364706816aba3e25717850c26c9cd0d89d", "sha1 abc");
eq(crypto.createHash("sha1").update("The quick brown fox jumps over the lazy dog").digest("hex"),
   "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12", "sha1 quick brown fox");
console.log("ok: SHA-1 (3 FIPS vectors)");

// HMAC-SHA1 (RFC 2202 test vector).
eq(crypto.createHmac("sha1", "Jefe").update("what do ya want for nothing?").digest("hex"),
   "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79", "hmac-sha1 RFC 2202 vec 2");
console.log("ok: HMAC-SHA1 RFC 2202");

// HMAC-MD5.
eq(crypto.createHmac("md5", "Jefe").update("what do ya want for nothing?").digest("hex"),
   "750c783e6ab0b503eaa86e310a5db738", "hmac-md5 RFC 2104");
console.log("ok: HMAC-MD5");

// PBKDF2 (RFC 6070 test vector 1 for HMAC-SHA1).
var dk = crypto.pbkdf2Sync("password", "salt", 1, 20, "sha1");
eq(Buffer.from(dk).toString("hex"),
   "0c60c80f961f0e71f3a9b524af6012062fe037a6",
   "pbkdf2 RFC 6070 #1");
console.log("ok: PBKDF2-HMAC-SHA1 (RFC 6070 vec 1)");

// PBKDF2 (HMAC-SHA256).
var dk256 = crypto.pbkdf2Sync("password", "salt", 1, 32, "sha256");
eq(Buffer.from(dk256).toString("hex"),
   "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b",
   "pbkdf2 sha256 #1");
console.log("ok: PBKDF2-HMAC-SHA256");

// Async pbkdf2.
var asyncDone = false;
crypto.pbkdf2("password", "salt", 1, 20, "sha1", function (err, key) {
    assert(!err, "pbkdf2 async err: " + err);
    eq(Buffer.from(key).toString("hex"),
       "0c60c80f961f0e71f3a9b524af6012062fe037a6", "pbkdf2 async result");
    asyncDone = true;
});

// getHashes / getCiphers.
var hashes = crypto.getHashes();
assert(hashes.indexOf("md5") !== -1 && hashes.indexOf("sha256") !== -1,
       "getHashes lists md5 + sha256: " + hashes);
console.log("ok: crypto.getHashes");

process.on("exit", function () {
    assert(asyncDone, "async pbkdf2 completed");
    console.log("ok: async pbkdf2 completed");
    console.log("\ncrypto_expand smoke: all assertions passed");
});
