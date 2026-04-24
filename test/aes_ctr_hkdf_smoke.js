// AES-CTR + HKDF smoke. Both RFC-spec'd with known test vectors.

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "\n    got     ", a, "\n    expected", b); process.exit(1); }
}
function hex(h) {
    h = h.replace(/\s+/g, "");
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < h.length; i += 2) out[i/2] = parseInt(h.substr(i, 2), 16);
    return Buffer.from(out);
}

// --- NIST SP 800-38A F.5.5 AES-256-CTR ---
// Key:     603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4
// IV:      f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff
// Block 1: 6bc1bee22e409f96e93d7e117393172a → 601ec313775789a5b7a7f504bbf3d228
var key = hex("603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4");
var iv  = hex("f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff");
var pt  = hex("6bc1bee22e409f96e93d7e117393172a");

var c = crypto.createCipheriv("aes-256-ctr", key, iv);
c.update(pt);
var ct = c["final"]();
eq(ct.toString("hex"), "601ec313775789a5b7a7f504bbf3d228",
   "NIST SP 800-38A F.5.5 AES-256-CTR");
console.log("ok: NIST AES-256-CTR vector");

// --- CTR is symmetric: decrypt == encrypt ---
var d = crypto.createDecipheriv("aes-256-ctr", key, iv);
d.update(ct);
var dp = d["final"]();
eq(dp.toString("hex"), "6bc1bee22e409f96e93d7e117393172a",
   "CTR decrypt round-trip");
console.log("ok: AES-256-CTR round-trip");

// --- Non-block-aligned (CTR doesn't need padding) ---
var msg = "hello world and more — not 16-aligned";
var c2 = crypto.createCipheriv("aes-128-ctr", hex("00112233445566778899aabbccddeeff"), hex("000102030405060708090a0b0c0d0e0f"));
c2.update(msg);
var ct2 = c2["final"]();
assert(ct2.length === Buffer.byteLength(msg, "utf8"), "CTR output length matches plaintext (no padding)");
var d2 = crypto.createDecipheriv("aes-128-ctr", hex("00112233445566778899aabbccddeeff"), hex("000102030405060708090a0b0c0d0e0f"));
d2.update(ct2);
eq(d2["final"]("utf8"), msg, "AES-128-CTR odd-length round-trip");
console.log("ok: AES-128-CTR odd-length");

// --- HKDF RFC 5869 Test Case 1 ---
// Hash: SHA-256
// IKM:    0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b (22 bytes)
// salt:   000102030405060708090a0b0c (13 bytes)
// info:   f0f1f2f3f4f5f6f7f8f9 (10 bytes)
// L:      42
// OKM:    3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865
var ikm  = hex("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b");
var salt = hex("000102030405060708090a0b0c");
var info = hex("f0f1f2f3f4f5f6f7f8f9");
var okm  = crypto.hkdfSync("sha256", ikm, salt, info, 42);
eq(okm.toString("hex"),
   "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865",
   "RFC 5869 Test Case 1 HKDF-SHA256");
console.log("ok: HKDF RFC 5869 TC1");

// --- HKDF with SHA-512 ---
// Quick check: length is correct, non-empty.
var okm512 = crypto.hkdfSync("sha512", ikm, salt, info, 64);
assert(okm512.length === 64, "HKDF-SHA512 length");
console.log("ok: HKDF-SHA512 derived 64 bytes");

// --- HKDF async ---
var asyncOut = null;
crypto.hkdf("sha256", ikm, salt, info, 42, function (err, dk) {
    asyncOut = dk;
});

process.on("exit", function () {
    assert(asyncOut && asyncOut.toString("hex") === okm.toString("hex"),
           "async hkdf matches sync");
    console.log("ok: hkdf async matches sync");
    console.log("\naes_ctr_hkdf smoke: all assertions passed");
});
