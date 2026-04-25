// ECDSA via vendored elliptic. v0.75 closes the asymmetric-crypto
// gap that was the last "Still missing" item alongside RSA + Ed25519.
//
// We test P-256 only here -- P-384 and P-521 work the same way but
// are slow on G3 (a single verify is ~13 s on 900 MHz, P-521 would
// be 30+ s).

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

console.log("Generating EC P-256 keypair...");
var t0 = Date.now();
var pair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
console.log("keygen took", Date.now() - t0, "ms");

assert(pair && pair.publicKey && pair.privateKey, "keypair returned");
assert(pair.publicKey.type === "public", "public type");
assert(pair.privateKey.type === "private", "private type");
assert(pair.publicKey.asymmetricKeyType === "ec", "asymmetricKeyType = ec");
assert(pair.publicKey.asymmetricKeyDetails &&
       pair.publicKey.asymmetricKeyDetails.namedCurve === "P-256",
       "asymmetricKeyDetails.namedCurve = P-256");
console.log("ok: generateKeyPairSync('ec', { namedCurve: 'P-256' })");

// ---- Sign + verify SHA-256 (ES256) ----
var msg = Buffer.from("ECDSA on PowerPC Tiger", "utf8");
console.log("Signing (ES256)...");
t0 = Date.now();
var sig = crypto.sign("sha256", msg, pair.privateKey);
console.log("sign took", Date.now() - t0, "ms");
assert(Buffer.isBuffer(sig), "sig is Buffer");
// DER-encoded ECDSA sig is variable length; for P-256 typically 70-72 bytes.
assert(sig.length >= 64 && sig.length <= 80, "sig is plausible DER length: " + sig.length);
console.log("ok: ES256 sign produced " + sig.length + "-byte DER signature");

console.log("Verifying...");
t0 = Date.now();
var ok = crypto.verify("sha256", msg, pair.publicKey, sig);
console.log("verify took", Date.now() - t0, "ms");
assert(ok === true, "verify true");
console.log("ok: ES256 verify");

// ---- Tamper rejected ----
var bad = Buffer.from(sig);
bad[0] ^= 1;
assert(crypto.verify("sha256", msg, pair.publicKey, bad) === false, "tampered sig rejected");
var other = Buffer.from("different msg", "utf8");
assert(crypto.verify("sha256", other, pair.publicKey, sig) === false, "wrong msg rejected");
console.log("ok: tamper rejected");

// ---- Sign with one key, verify with a different keypair fails ----
console.log("Generating second EC P-256 keypair for cross-key check...");
var pair2 = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
assert(crypto.verify("sha256", msg, pair2.publicKey, sig) === false,
       "verify with wrong public key fails");
console.log("ok: cross-key verify fails");

// ---- secp256k1 (Bitcoin curve) ----
console.log("Generating secp256k1 keypair...");
var k1pair = crypto.generateKeyPairSync("ec", { namedCurve: "secp256k1" });
assert(k1pair.publicKey.asymmetricKeyDetails.namedCurve === "secp256k1", "secp256k1 curve label");
var k1sig = crypto.sign("sha256", msg, k1pair.privateKey);
assert(crypto.verify("sha256", msg, k1pair.publicKey, k1sig) === true, "secp256k1 sign/verify");
console.log("ok: secp256k1 sign/verify");

console.log("\necdsa smoke: all assertions passed");
