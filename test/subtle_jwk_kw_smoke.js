// subtle.importKey/exportKey via JWK + AES-KW wrap/unwrap.

var crypto = require("crypto");
var subtle = crypto.subtle;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var jwkExported = null;
var jwkReimported = null;
var wrappedArrayBuffer = null;
var unwrappedKey = null;
var unwrappedEncrypted = null;

// --- Export + reimport via JWK ---
var raw16 = new Uint8Array(16);
for (var i = 0; i < 16; ++i) raw16[i] = i + 1;
subtle.importKey("raw", raw16, { name: "AES-CBC" }, true, ["encrypt", "decrypt"])
    .then(function (key) { return subtle.exportKey("jwk", key); })
    .then(function (jwk) {
        jwkExported = jwk;
        return subtle.importKey("jwk", jwk, { name: "AES-CBC" }, true, ["encrypt"]);
    })
    .then(function (key2) { return subtle.exportKey("raw", key2); })
    .then(function (ab) {
        jwkReimported = Array.from(new Uint8Array(ab));
    });

// --- AES-KW: wrap a 128-bit key under a 128-bit KEK ---
var kek = new Uint8Array([0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
                          0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10]);
var targetRaw = new Uint8Array([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
                                 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f]);

Promise.all([
    subtle.importKey("raw", kek, { name: "AES-KW" }, false, ["wrapKey", "unwrapKey"]),
    subtle.importKey("raw", targetRaw, { name: "AES-CBC" }, true, ["encrypt", "decrypt"])
]).then(function (keys) {
    var kekKey = keys[0], target = keys[1];
    return subtle.wrapKey("raw", target, kekKey, { name: "AES-KW" })
        .then(function (wrapped) {
            wrappedArrayBuffer = wrapped;
            return subtle.unwrapKey("raw", wrapped, kekKey, { name: "AES-KW" },
                                    { name: "AES-CBC" }, true, ["encrypt", "decrypt"]);
        })
        .then(function (uk) {
            unwrappedKey = uk;
            return subtle.exportKey("raw", uk);
        })
        .then(function (raw) {
            unwrappedEncrypted = Array.from(new Uint8Array(raw));
        });
});

// --- AES-KW tamper detection ---
var tamperCaught = false;
Promise.all([
    subtle.importKey("raw", kek, { name: "AES-KW" }, false, ["unwrapKey"])
]).then(function (keys) {
    var bad = new Uint8Array(24); // valid length but wrong bytes
    return subtle.unwrapKey("raw", bad, keys[0], { name: "AES-KW" },
                            { name: "AES-CBC" }, true, ["encrypt"])
        .then(function () { /* unexpected */ })
        .catch(function () { tamperCaught = true; });
});

process.on("exit", function () {
    assert(jwkExported && jwkExported.kty === "oct", "JWK has kty:oct");
    assert(typeof jwkExported.k === "string" && jwkExported.k.length > 0, "JWK has k");
    assert(jwkReimported && jwkReimported.length === 16, "JWK round-trip length");
    for (var i = 0; i < 16; ++i)
        assert(jwkReimported[i] === i + 1, "JWK round-trip byte " + i);
    console.log("ok: subtle JWK export/import round-trip");

    assert(wrappedArrayBuffer && wrappedArrayBuffer.byteLength === 24,
           "AES-KW wrap: 16 → 24 bytes");
    assert(unwrappedKey && unwrappedKey.type === "secret", "unwrapped CryptoKey");
    for (var i = 0; i < 16; ++i)
        assert(unwrappedEncrypted[i] === targetRaw[i], "AES-KW unwrap byte " + i);
    console.log("ok: subtle.wrapKey + unwrapKey (AES-KW)");

    assert(tamperCaught, "AES-KW unwrap detects tamper");
    console.log("ok: AES-KW tamper detection");

    console.log("\nsubtle_jwk_kw smoke: all assertions passed");
});
