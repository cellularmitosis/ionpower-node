// crypto.subtle ECDSA / ECDH (P-256 / P-384 / secp256k1).
// Lifts the v0.75/v0.76 Node-shape ECDSA + ECDH into the WebCrypto
// subtle API, with proper r||s <-> DER conversion for sign/verify.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

function u8eq(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

console.log("Generating ECDSA P-256 keypair via crypto.subtle.generateKey...");
var t0 = Date.now();
crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
).then(function (pair) {
    console.log("keygen took", Date.now() - t0, "ms");
    assert(pair.publicKey && pair.privateKey, "keypair");
    assert(pair.publicKey.type === "public", "public type");
    assert(pair.privateKey.type === "private", "private type");
    assert(pair.publicKey._keyObject, "_keyObject attached");
    console.log("ok: subtle.generateKey ECDSA P-256");

    var msg = new TextEncoder().encode("subtle ECDSA");

    return crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, msg)
        .then(function (sigAB) {
            assert(sigAB instanceof ArrayBuffer, "sign returns ArrayBuffer");
            var sigBytes = new Uint8Array(sigAB);
            // WebCrypto raw r||s -- P-256 -> 64 bytes.
            assert(sigBytes.length === 64, "P-256 sig is 64 bytes raw r||s (got " + sigBytes.length + ")");
            console.log("ok: subtle.sign ECDSA -> raw r||s 64 bytes");

            return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, sigBytes, msg);
        }).then(function (ok) {
            assert(ok === true, "subtle.verify returns true for valid sig");
            console.log("ok: subtle.verify ECDSA");

            // Tamper test
            return crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, msg)
                .then(function (sigAB) {
                    var sig = new Uint8Array(sigAB);
                    sig[0] ^= 1;
                    return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, sig, msg);
                });
        }).then(function (badOk) {
            assert(badOk === false, "tampered sig fails verify");
            console.log("ok: subtle ECDSA tamper rejected");

            // ECDH
            console.log("Generating two P-256 keypairs for ECDH...");
            return Promise.all([
                crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]),
                crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])
            ]);
        }).then(function (pairs) {
            var alice = pairs[0], bob = pairs[1];

            return Promise.all([
                crypto.subtle.deriveBits({ name: "ECDH", public: bob.publicKey   }, alice.privateKey, 256),
                crypto.subtle.deriveBits({ name: "ECDH", public: alice.publicKey }, bob.privateKey,   256)
            ]);
        }).then(function (secrets) {
            var aSec = new Uint8Array(secrets[0]);
            var bSec = new Uint8Array(secrets[1]);
            assert(aSec.length === 32, "ECDH 256 bits = 32 bytes (got " + aSec.length + ")");
            assert(u8eq(aSec, bSec), "alice and bob agree (first 8 = " +
                Array.from(aSec.slice(0, 8)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("") + ")");
            console.log("ok: subtle.deriveBits ECDH P-256 round-trip");

            console.log("\nsubtle_ecdsa smoke: all assertions passed");
        }).catch(function (e) {
            console.error("FAIL:", e && e.message);
            if (e && e.stack) console.error(e.stack);
            process.exit(1);
        });
}).catch(function (e) {
    console.error("FAIL outer:", e && e.message);
    if (e && e.stack) console.error(e.stack);
    process.exit(1);
});
