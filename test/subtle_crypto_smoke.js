// crypto.subtle WebCrypto API smoke.

var crypto = require("crypto");
var subtle = crypto.subtle;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function abToHex(ab) {
    var u = new Uint8Array(ab);
    var h = "";
    for (var i = 0; i < u.length; ++i) h += ("0" + u[i].toString(16)).slice(-2);
    return h;
}

var digestResult = null;
var signResult = null;
var verifyResult = null;
var encResult = null;
var decResult = null;
var deriveResult = null;
var exportResult = null;

// --- digest ---
subtle.digest("SHA-256", new TextEncoder().encode("abc")).then(function (ab) {
    digestResult = abToHex(ab);
});

// --- generateKey + sign + verify for HMAC ---
subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, true, ["sign", "verify"])
    .then(function (key) {
        return subtle.sign("HMAC", key, new TextEncoder().encode("message"))
            .then(function (sig) {
                signResult = sig;
                return subtle.verify("HMAC", key, sig, new TextEncoder().encode("message"));
            })
            .then(function (ok) { verifyResult = ok; });
    });

// --- AES-GCM encrypt + decrypt ---
subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
    .then(function (key) {
        var iv = new Uint8Array(12); // all zeros for deterministic test
        var pt = new TextEncoder().encode("secret payload");
        return subtle.encrypt({ name: "AES-GCM", iv: iv }, key, pt)
            .then(function (ct) {
                encResult = ct;
                return subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
            })
            .then(function (pt2) {
                decResult = new TextDecoder().decode(pt2);
            });
    });

// --- deriveBits via PBKDF2 ---
subtle.importKey("raw", new TextEncoder().encode("password"),
                 { name: "PBKDF2" }, false, ["deriveBits"])
    .then(function (baseKey) {
        return subtle.deriveBits({
            name: "PBKDF2", hash: "SHA-256",
            salt: new TextEncoder().encode("salt"),
            iterations: 1000
        }, baseKey, 256);
    })
    .then(function (bits) {
        deriveResult = abToHex(bits);
    });

// --- importKey + exportKey (raw) ---
subtle.importKey("raw", new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]),
                 { name: "AES-CBC" }, true, ["encrypt"])
    .then(function (key) { return subtle.exportKey("raw", key); })
    .then(function (ab) { exportResult = abToHex(new Uint8Array(ab)); });

process.on("exit", function () {
    // SHA-256 of "abc"
    assert(digestResult === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
           "digest SHA-256(abc): " + digestResult);
    console.log("ok: subtle.digest");

    assert(signResult instanceof ArrayBuffer, "subtle.sign returned ArrayBuffer");
    assert(new Uint8Array(signResult).length === 32, "HMAC-SHA256 output 32 bytes");
    assert(verifyResult === true, "subtle.verify true");
    console.log("ok: subtle.sign + verify (HMAC-SHA256)");

    assert(decResult === "secret payload", "AES-GCM round-trip: " + decResult);
    console.log("ok: subtle.encrypt + decrypt (AES-GCM)");

    assert(deriveResult && deriveResult.length === 64, "PBKDF2 32-byte output");
    console.log("ok: subtle.deriveBits (PBKDF2-SHA256)");

    assert(exportResult === "0102030405060708090a0b0c0d0e0f10",
           "importKey/exportKey round-trip: " + exportResult);
    console.log("ok: subtle.importKey + exportKey (raw)");

    console.log("\nsubtle_crypto smoke: all assertions passed");
});
