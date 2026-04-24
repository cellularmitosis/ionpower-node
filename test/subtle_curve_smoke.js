// WebCrypto SubtleCrypto: Ed25519 sign/verify + X25519 ECDH.
// Both backed by tweetnacl via the shared _naclLoad() bootstrap.

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// ---- Ed25519 generate -> sign -> verify (subtle) ----
crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]).then(function (pair) {
    assert(pair.publicKey  && pair.publicKey.type  === "public",  "Ed25519 pub CryptoKey");
    assert(pair.privateKey && pair.privateKey.type === "private", "Ed25519 priv CryptoKey");
    var data = new TextEncoder().encode("hello, subtle Ed25519!");

    return crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, data).then(function (sig) {
        assert(sig instanceof ArrayBuffer, "sign returns ArrayBuffer");
        assert(sig.byteLength === 64, "Ed25519 sig is 64 bytes");
        return crypto.subtle.verify({ name: "Ed25519" }, pair.publicKey, sig, data).then(function (ok) {
            assert(ok === true, "Ed25519 verify true");
            console.log("ok: subtle Ed25519 generate + sign + verify");

            // JWK round-trip: export public, import, verify again.
            return crypto.subtle.exportKey("jwk", pair.publicKey).then(function (jwk) {
                assert(jwk.kty === "OKP" && jwk.crv === "Ed25519" && jwk.x,
                       "Ed25519 JWK kty/crv/x");
                return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, true, ["verify"]);
            }).then(function (rePub) {
                return crypto.subtle.verify({ name: "Ed25519" }, rePub, sig, data);
            }).then(function (ok2) {
                assert(ok2 === true, "verify via JWK-imported public");
                console.log("ok: subtle Ed25519 JWK round-trip");
            });
        });
    });
}).catch(function (e) { console.error("FAIL: Ed25519", e && e.stack || e); process.exit(1); });

// ---- X25519 ECDH: two keypairs derive the same shared secret ----
Promise.all([
    crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]),
    crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"])
]).then(function (pairs) {
    var alice = pairs[0], bob = pairs[1];
    assert(alice.publicKey._raw.length === 32, "X25519 pub is 32 bytes");
    assert(alice.privateKey._raw.length === 32, "X25519 priv is 32 bytes");

    // Alice: derive using her private + bob's public.
    // Bob:   derive using his private + alice's public.
    return Promise.all([
        crypto.subtle.deriveBits({ name: "X25519", public: bob.publicKey },   alice.privateKey, 256),
        crypto.subtle.deriveBits({ name: "X25519", public: alice.publicKey }, bob.privateKey,   256)
    ]).then(function (secrets) {
        var a = new Uint8Array(secrets[0]);
        var b = new Uint8Array(secrets[1]);
        assert(a.length === 32, "shared secret 32 bytes");
        assert(b.length === 32, "shared secret 32 bytes (bob)");
        for (var i = 0; i < a.length; i++) {
            assert(a[i] === b[i], "shared secret mismatch at byte " + i);
        }
        console.log("ok: subtle X25519 ECDH shared-secret match");
    });
}).catch(function (e) { console.error("FAIL: X25519", e && e.stack || e); process.exit(1); });

process.on("exit", function () {
    console.log("\nsubtle_curve smoke: done");
});
