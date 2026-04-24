// AES-CBC smoke: round-trip + NIST test vector.

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "\n    got     ", a, "\n    expected", b); process.exit(1); }
}
function hex2buf(h) {
    h = h.replace(/\s+/g, "");
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < h.length; i += 2) out[i/2] = parseInt(h.substr(i, 2), 16);
    return Buffer.from(out);
}

// --- NIST SP 800-38A Appendix F.2.5 AES-256-CBC vector ---
// Key:  603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4
// IV:   000102030405060708090a0b0c0d0e0f
// PT:   6bc1bee22e409f96e93d7e117393172a  (first block only, no padding)
// CT:   f58c4c04d6e5f1ba779eabfb5f7bfbd6

var key = hex2buf("603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4");
var iv  = hex2buf("000102030405060708090a0b0c0d0e0f");
var pt  = hex2buf("6bc1bee22e409f96e93d7e117393172a");

// Encrypt WITHOUT padding (plaintext is exactly 16 bytes).
var cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
cipher.setAutoPadding(false);
cipher.update(pt);
var ct = cipher["final"]();
eq(ct.toString("hex"),
   "f58c4c04d6e5f1ba779eabfb5f7bfbd6",
   "NIST SP 800-38A F.2.5 AES-256-CBC first block");
console.log("ok: NIST AES-256-CBC vector");

// --- Round-trip with PKCS#7 padding ---
var msg = "The quick brown fox jumps over the lazy dog.";
var key2 = Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex");
var iv2  = Buffer.from("fedcba9876543210fedcba9876543210", "hex");
var enc = crypto.createCipheriv("aes-256-cbc", key2, iv2);
enc.update(msg);
var ciphered = enc["final"]();
assert(ciphered.length > 0, "encrypted length > 0");
assert(ciphered.length % 16 === 0, "encrypted length % 16 === 0");
var dec = crypto.createDecipheriv("aes-256-cbc", key2, iv2);
dec.update(ciphered);
var decoded = dec["final"]("utf8");
eq(decoded, msg, "AES-256-CBC round-trip with PKCS#7");
console.log("ok: AES-256-CBC round-trip (PKCS#7 padding)");

// --- AES-128-CBC round-trip ---
var key128 = Buffer.from("00112233445566778899aabbccddeeff", "hex");
var iv128  = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex");
var c2 = crypto.createCipheriv("aes-128-cbc", key128, iv128);
c2.update("hello world");
var ct2 = c2["final"]();
var d2 = crypto.createDecipheriv("aes-128-cbc", key128, iv128);
d2.update(ct2);
var pt2 = d2["final"]("utf8");
eq(pt2, "hello world", "AES-128-CBC round-trip");
console.log("ok: AES-128-CBC round-trip");

// --- Bad cipher name ---
var threw = false;
try { crypto.createCipheriv("aes-256-gcm", key, iv); } catch (e) { threw = true; }
assert(threw, "unsupported modes throw");
console.log("ok: unsupported modes throw");

// --- getCiphers ---
var ciphers = crypto.getCiphers();
assert(ciphers.indexOf("aes-256-cbc") >= 0, "getCiphers lists aes-256-cbc");
console.log("ok: getCiphers");

console.log("\naes_cbc smoke: all assertions passed");
