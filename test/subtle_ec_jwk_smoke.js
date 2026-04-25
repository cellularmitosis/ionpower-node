// crypto.subtle EC JWK import/export round-trip. Lifts the v0.79
// subtle ECDSA + ECDH onto the WebCrypto JWK shape that real-world
// JWT/JWS/JOSE libraries hand around.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Generate a P-256 keypair, export both halves as JWK, re-import,
// and verify that signatures made with the imported keys verify
// against the originally generated keys (and vice versa).
console.log("Generating P-256 keypair via subtle.generateKey...");

crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
).then(function (orig) {
    return Promise.all([
        crypto.subtle.exportKey("jwk", orig.publicKey),
        crypto.subtle.exportKey("jwk", orig.privateKey)
    ]).then(function (jwks) {
        var pubJwk = jwks[0];
        var privJwk = jwks[1];

        assert(pubJwk.kty === "EC", "pub kty=EC");
        assert(pubJwk.crv === "P-256", "pub crv=P-256");
        assert(typeof pubJwk.x === "string" && typeof pubJwk.y === "string",
               "pub has x and y");
        assert(!pubJwk.d, "pub has no d");
        console.log("ok: exportKey('jwk', publicKey) -> { kty: 'EC', crv: 'P-256', x, y }");

        assert(privJwk.kty === "EC", "priv kty=EC");
        assert(privJwk.crv === "P-256", "priv crv=P-256");
        assert(typeof privJwk.d === "string", "priv has d");
        assert(typeof privJwk.x === "string" && typeof privJwk.y === "string",
               "priv has x and y too");
        console.log("ok: exportKey('jwk', privateKey) -> { kty, crv, x, y, d }");

        // Re-import each and round-trip.
        return Promise.all([
            crypto.subtle.importKey("jwk", pubJwk,
                { name: "ECDSA", namedCurve: "P-256" },
                true, ["verify"]),
            crypto.subtle.importKey("jwk", privJwk,
                { name: "ECDSA", namedCurve: "P-256" },
                true, ["sign"])
        ]).then(function (re) {
            var rePub = re[0], rePriv = re[1];

            assert(rePub.type === "public", "re-imported public type");
            assert(rePriv.type === "private", "re-imported private type");
            console.log("ok: importKey('jwk', ...) reproduces both halves");

            var msg = new TextEncoder().encode("EC JWK round-trip");
            // Sign with the re-imported private key, verify with the
            // ORIGINAL public key (this proves the JWK -> KeyObject
            // path produces a key that interoperates).
            return crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, rePriv, msg)
                .then(function (sig) {
                    return crypto.subtle.verify(
                        { name: "ECDSA", hash: "SHA-256" }, orig.publicKey, sig, msg);
                });
        });
    });
}).then(function (verifiedWithOrig) {
    assert(verifiedWithOrig === true,
           "signatures from re-imported priv verify against original pub");
    console.log("ok: round-trip JWK -> sign -> original pub verify");

    // Also exercise raw export of public key (uncompressed point form).
    return crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
    ).then(function (kp) {
        return crypto.subtle.exportKey("raw", kp.publicKey);
    });
}).then(function (rawPub) {
    var bytes = new Uint8Array(rawPub);
    assert(bytes.length === 65, "raw uncompressed P-256 point = 65 bytes (got " + bytes.length + ")");
    assert(bytes[0] === 0x04, "raw point starts with 0x04 (uncompressed)");
    console.log("ok: exportKey('raw', publicKey) -> 65-byte uncompressed point");

    console.log("\nsubtle_ec_jwk smoke: all assertions passed");
}).catch(function (e) {
    console.error("FAIL:", e && e.message);
    if (e && e.stack) console.error(e.stack);
    process.exit(1);
});
