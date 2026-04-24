// Ed25519 sign/verify smoke (tweetnacl-backed).
//
// Node API:
//   const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
//   const sig = crypto.sign(null, data, privateKey);
//   const ok  = crypto.verify(null, data, publicKey, sig);

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// ---- generateKeyPairSync ----
var pair = crypto.generateKeyPairSync("ed25519");
assert(pair && pair.publicKey && pair.privateKey, "generateKeyPairSync returns a pair");
assert(pair.publicKey.type === "public", "public key type");
assert(pair.privateKey.type === "private", "private key type");
assert(pair.publicKey.asymmetricKeyType === "ed25519", "public asymmetricKeyType");
assert(pair.privateKey.asymmetricKeyType === "ed25519", "private asymmetricKeyType");
console.log("ok: crypto.generateKeyPairSync('ed25519')");

// ---- sign + verify round-trip ----
var msg = Buffer.from("hello, ed25519!", "utf8");
var sig = crypto.sign(null, msg, pair.privateKey);
assert(Buffer.isBuffer(sig), "sig is Buffer");
assert(sig.length === 64, "sig length 64");

var ok = crypto.verify(null, msg, pair.publicKey, sig);
assert(ok === true, "signature verifies");
console.log("ok: sign / verify round-trip");

// ---- tamper rejects ----
var bad = Buffer.from(sig);
bad[0] ^= 1;
assert(crypto.verify(null, msg, pair.publicKey, bad) === false,
       "tampered signature rejected");

// ---- different message rejects ----
var other = Buffer.from("bye, ed25519!", "utf8");
assert(crypto.verify(null, other, pair.publicKey, sig) === false,
       "wrong message rejected");
console.log("ok: tamper detection");

// ---- createPrivateKey / createPublicKey from raw bytes ----
var pkRaw = pair.publicKey.export();        // 32-byte Buffer
var skRaw = pair.privateKey.export();       // 64-byte Buffer
assert(pkRaw.length === 32, "exported public = 32 bytes");
assert(skRaw.length === 64, "exported private = 64 bytes");

var pk2 = crypto.createPublicKey(pkRaw);
var sk2 = crypto.createPrivateKey(skRaw);
var sig2 = crypto.sign(null, msg, sk2);
assert(crypto.verify(null, msg, pk2, sig2), "round-trip through createPrivateKey/createPublicKey");
console.log("ok: createPrivateKey / createPublicKey (raw bytes)");

// ---- 32-byte seed expansion ----
var seed = Buffer.alloc(32);
for (var i = 0; i < 32; i++) seed[i] = i;
var skFromSeed = crypto.createPrivateKey(seed);
var sigSeed = crypto.sign(null, msg, skFromSeed);
var pkFromPriv = crypto.createPublicKey(skFromSeed);
assert(crypto.verify(null, msg, pkFromPriv, sigSeed),
       "derived public from private signs correctly");
console.log("ok: 32-byte seed -> private key expansion");

// ---- JWK export / import round-trip ----
var jwkPriv = pair.privateKey.export({ format: "jwk" });
assert(jwkPriv.kty === "OKP" && jwkPriv.crv === "Ed25519", "JWK kty/crv");
assert(typeof jwkPriv.d === "string" && typeof jwkPriv.x === "string", "JWK d / x");

var pk3 = crypto.createPublicKey(pair.publicKey.export({ format: "jwk" }));
var sk3 = crypto.createPrivateKey(jwkPriv);
var sig3 = crypto.sign(null, msg, sk3);
assert(crypto.verify(null, msg, pk3, sig3), "JWK round-trip sign/verify");
console.log("ok: JWK export / import round-trip");

// ---- generateKeyPair (async) ----
crypto.generateKeyPair("ed25519", function (err, pub, priv) {
    if (err) { console.error("FAIL: async gen", err); process.exit(1); }
    assert(pub.type === "public",  "async pub type");
    assert(priv.type === "private", "async priv type");
    var s = crypto.sign(null, msg, priv);
    assert(crypto.verify(null, msg, pub, s), "async keypair sign/verify");
    console.log("ok: crypto.generateKeyPair (async)");
});

process.on("exit", function () {
    console.log("\ned25519 smoke: done");
});
