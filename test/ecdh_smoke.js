// NIST ECDH key agreement: two parties each generate an EC keypair,
// exchange public keys, derive a shared secret, both arrive at the
// same bytes. Closes the last "Still missing" item in the asymmetric
// crypto roster.

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

function hex(b) { return b.toString("hex"); }

// ---- P-256 round-trip ----
console.log("Generating two P-256 keypairs...");
var t0 = Date.now();
var alice = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
var bob   = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
console.log("keygen took", Date.now() - t0, "ms");

console.log("Deriving shared secrets...");
t0 = Date.now();
var aliceSecret = crypto.diffieHellman({ privateKey: alice.privateKey, publicKey: bob.publicKey });
var bobSecret   = crypto.diffieHellman({ privateKey: bob.privateKey,   publicKey: alice.publicKey });
console.log("ECDH took", Date.now() - t0, "ms (both sides)");

assert(Buffer.isBuffer(aliceSecret), "alice secret is Buffer");
assert(aliceSecret.length === 32, "P-256 shared secret is 32 bytes (got " + aliceSecret.length + ")");
assert(hex(aliceSecret) === hex(bobSecret), "both sides derive the same shared secret");
console.log("ok: P-256 ECDH agree (" + aliceSecret.length + " bytes; first 8 = " +
            aliceSecret.slice(0, 8).toString("hex") + "...)");

// ---- Cross-party non-equality ----
var carol = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
var carolFromBob = crypto.diffieHellman({ privateKey: carol.privateKey, publicKey: bob.publicKey });
assert(hex(carolFromBob) !== hex(aliceSecret), "carol/bob secret != alice/bob secret");
console.log("ok: third party doesn't get the same secret");

// ---- secp256k1 round-trip ----
console.log("secp256k1 round-trip...");
var sa = crypto.generateKeyPairSync("ec", { namedCurve: "secp256k1" });
var sb = crypto.generateKeyPairSync("ec", { namedCurve: "secp256k1" });
var saSec = crypto.diffieHellman({ privateKey: sa.privateKey, publicKey: sb.publicKey });
var sbSec = crypto.diffieHellman({ privateKey: sb.privateKey, publicKey: sa.publicKey });
assert(saSec.length === 32, "secp256k1 shared = 32 bytes");
assert(hex(saSec) === hex(sbSec), "secp256k1 both sides agree");
console.log("ok: secp256k1 ECDH agree");

// ---- Curve mismatch rejected ----
var p384a = crypto.generateKeyPairSync("ec", { namedCurve: "P-384" });
var threw = false;
try {
    crypto.diffieHellman({ privateKey: p384a.privateKey, publicKey: alice.publicKey });
} catch (e) { threw = /curve mismatch/i.test(e.message); }
assert(threw, "curve mismatch rejected");
console.log("ok: curve mismatch rejected");

// ---- Reject non-EC keys ----
threw = false;
try {
    crypto.diffieHellman({ privateKey: "not-a-key", publicKey: alice.publicKey });
} catch (e) { threw = true; }
assert(threw, "non-key inputs rejected");
console.log("ok: non-key inputs rejected");

console.log("\necdh smoke: all assertions passed");
