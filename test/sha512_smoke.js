// SHA-512 + SHA-384 RFC vectors, HMAC-SHA512, PBKDF2-SHA512.
// Implementation uses [hi, lo] Uint32 pairs for 64-bit arithmetic.

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "\n    got     ", a, "\n    expected", b); process.exit(1); }
}

// --- SHA-512 known vectors (FIPS 180-4) ---
// "abc"
eq(crypto.createHash("sha512").update("abc").digest("hex"),
   "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a" +
   "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
   "SHA-512 of 'abc'");

// empty string
eq(crypto.createHash("sha512").update("").digest("hex"),
   "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce" +
   "47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
   "SHA-512 of ''");

// 1000000 "a" — skipped (slow); would be:
// e718483d0ce769644e2e42c7bc15b4638e1f98b13b2044285632a803afa973ebde0ff244877ea60a4cb0432ce577c31beb009c5c2c49aa2e4eadb217ad8cc09b
console.log("ok: SHA-512 FIPS vectors");

// --- SHA-384 known vectors ---
eq(crypto.createHash("sha384").update("abc").digest("hex"),
   "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed" +
   "8086072ba1e7cc2358baeca134c825a7",
   "SHA-384 of 'abc'");

eq(crypto.createHash("sha384").update("").digest("hex"),
   "38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da" +
   "274edebfe76f65fbd51ad2f14898b95b",
   "SHA-384 of ''");
console.log("ok: SHA-384 FIPS vectors");

// --- HMAC-SHA512 (RFC 4231 test case 1) ---
// key = 0x0b * 20, data = "Hi There"
var key = Buffer.alloc(20); for (var i = 0; i < 20; ++i) key[i] = 0x0b;
var mac = crypto.createHmac("sha512", key).update("Hi There").digest("hex");
eq(mac,
   "87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cde" +
   "daa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854",
   "HMAC-SHA512 RFC 4231 TC1");
console.log("ok: HMAC-SHA512 RFC 4231 TC1");

// --- HMAC-SHA384 (RFC 4231 test case 1) ---
var mac384 = crypto.createHmac("sha384", key).update("Hi There").digest("hex");
eq(mac384,
   "afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59c" +
   "faea9ea9076ede7f4af152e8b2fa9cb6",
   "HMAC-SHA384 RFC 4231 TC1");
console.log("ok: HMAC-SHA384 RFC 4231 TC1");

// --- PBKDF2-SHA512 ---
// P="passwd", S="salt", c=1, dkLen=64 — cross-checked with Python's
// hashlib.pbkdf2_hmac("sha512", b"passwd", b"salt", 1, 64).
var out = crypto.pbkdf2Sync("passwd", "salt", 1, 64, "sha512").toString("hex");
eq(out,
   "c74319d99499fc3e9013acff597c23c5baf0a0bec5634c46b8352b793e324723" +
   "d55caa76b2b25c43402dcfdc06cdcf66f95b7d0429420b39520006749c51a04e",
   "PBKDF2-SHA512 ('passwd'/'salt'/1/64)");
console.log("ok: PBKDF2-SHA512");

// --- Alias 'sha-512' with hyphen ---
eq(crypto.createHash("sha-512").update("abc").digest("hex"),
   "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a" +
   "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
   "'sha-512' alias accepted");
console.log("ok: 'sha-512' alias");

// --- getHashes reports new algs ---
var hashes = crypto.getHashes();
assert(hashes.indexOf("sha512") >= 0, "getHashes has sha512");
assert(hashes.indexOf("sha384") >= 0, "getHashes has sha384");
console.log("ok: crypto.getHashes");

console.log("\nsha512 smoke: all assertions passed");
