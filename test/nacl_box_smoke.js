// tweetnacl box / secretbox authenticated encryption smoke.
// Relies on our require hook that lazy-loads tweetnacl with the
// PRNG wired to crypto.getRandomValues.

var nacl = require("tweetnacl");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// --- nacl.secretbox: symmetric authenticated encryption ---
(function () {
    var key   = nacl.randomBytes(32);
    var nonce = nacl.randomBytes(24);
    var msg   = new TextEncoder().encode("Hello nacl.secretbox");

    var ct = nacl.secretbox(msg, nonce, key);
    assert(ct.length === msg.length + 16, "secretbox ct = plaintext + 16-byte tag");

    var pt = nacl.secretbox.open(ct, nonce, key);
    assert(pt !== null, "secretbox.open returns plaintext");
    assert(new TextDecoder().decode(pt) === "Hello nacl.secretbox",
           "secretbox round-trip");

    // Tamper the ciphertext — .open must return null.
    var tampered = new Uint8Array(ct);
    tampered[0] ^= 1;
    assert(nacl.secretbox.open(tampered, nonce, key) === null,
           "secretbox tamper rejected");

    console.log("ok: nacl.secretbox round-trip + tamper");
})();

// --- nacl.box: asymmetric authenticated encryption (XSalsa20-Poly1305) ---
(function () {
    var alice = nacl.box.keyPair();
    var bob   = nacl.box.keyPair();
    assert(alice.publicKey.length === 32, "nacl.box keyPair pub = 32");
    assert(alice.secretKey.length === 32, "nacl.box keyPair priv = 32");

    var nonce = nacl.randomBytes(24);
    var msg   = new TextEncoder().encode("Hi Bob, it's Alice");

    // Alice encrypts with her secret + Bob's public.
    var ct = nacl.box(msg, nonce, bob.publicKey, alice.secretKey);

    // Bob decrypts with his secret + Alice's public.
    var pt = nacl.box.open(ct, nonce, alice.publicKey, bob.secretKey);
    assert(pt !== null, "box.open returns plaintext");
    assert(new TextDecoder().decode(pt) === "Hi Bob, it's Alice",
           "box round-trip");

    // Swap keys — should fail.
    var bogus = nacl.box.open(ct, nonce, bob.publicKey, bob.secretKey);
    assert(bogus === null, "box rejects wrong sender public");

    console.log("ok: nacl.box round-trip + wrong-sender rejected");
})();

// --- nacl.hash (SHA-512) ---
(function () {
    var msg = new TextEncoder().encode("abc");
    var out = nacl.hash(msg);
    assert(out.length === 64, "nacl.hash = 64 bytes (SHA-512)");
    // FIPS 180-4 "abc" digest starts with ddaf35a1...
    assert(out[0] === 0xdd && out[1] === 0xaf && out[2] === 0x35 && out[3] === 0xa1,
           "nacl.hash FIPS abc first 4 bytes");
    console.log("ok: nacl.hash (SHA-512)");
})();

// --- nacl.sign (detached) round-trip ---
(function () {
    var kp = nacl.sign.keyPair();
    var msg = new TextEncoder().encode("sign me");
    var sig = nacl.sign.detached(msg, kp.secretKey);
    assert(sig.length === 64, "Ed25519 sig = 64");
    assert(nacl.sign.detached.verify(msg, sig, kp.publicKey) === true,
           "Ed25519 verify ok");
    console.log("ok: nacl.sign.detached round-trip");
})();

console.log("\nnacl_box smoke: all assertions passed");
