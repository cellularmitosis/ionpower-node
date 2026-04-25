// RSA encrypt/decrypt + PEM key import smoke (v0.66).
// Uses 1024-bit for speed on PPC.

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// ---- Generate keypair (1024-bit for speed) ----
console.log("Generating RSA-1024 (slow on PPC)...");
var t0 = Date.now();
var pair = crypto.generateKeyPairSync("rsa", { modulusLength: 1024, publicExponent: 0x10001 });
console.log("keygen took", Date.now() - t0, "ms");

// ---- Round-trip publicEncrypt -> privateDecrypt ----
var msg = Buffer.from("attack at dawn", "utf8");
var ct = crypto.publicEncrypt(pair.publicKey, msg);
assert(Buffer.isBuffer(ct), "ciphertext is Buffer");
assert(ct.length === 128, "ciphertext is 128 bytes (1024-bit RSA-OAEP)");
assert(ct.toString("utf8") !== msg.toString("utf8"), "ct differs from pt");
console.log("ok: publicEncrypt produced 128-byte ciphertext");

var pt = crypto.privateDecrypt(pair.privateKey, ct);
assert(Buffer.isBuffer(pt), "plaintext is Buffer");
assert(pt.toString("utf8") === "attack at dawn", "round-trip plaintext matches");
console.log("ok: privateDecrypt round-trip");

// ---- Each encryption is non-deterministic (OAEP mask) ----
var ct2 = crypto.publicEncrypt(pair.publicKey, msg);
assert(!ct.equals(ct2), "two encryptions yield different ciphertexts");
var pt2 = crypto.privateDecrypt(pair.privateKey, ct2);
assert(pt2.toString("utf8") === "attack at dawn", "second decrypt also works");
console.log("ok: OAEP randomization");

// ---- Wrong-key decrypt fails (or yields garbage) ----
var pair2 = crypto.generateKeyPairSync("rsa", { modulusLength: 1024, publicExponent: 0x10001 });
var threw = false;
try {
    var bad = crypto.privateDecrypt(pair2.privateKey, ct);
    // Forge typically throws "Encryption block is invalid"; if it returns,
    // at least the bytes must not match.
    if (bad.toString("utf8") === "attack at dawn") {
        console.error("FAIL: decrypt with wrong key returned correct plaintext");
        process.exit(1);
    }
} catch (e) { threw = true; }
console.log("ok: wrong-key decrypt rejected (" + (threw ? "threw" : "garbage") + ")");

// ---- PEM round-trip via createPublicKey / createPrivateKey ----
var pubPem  = pair.publicKey.export({ format: "pem" });
var privPem = pair.privateKey.export({ format: "pem" });
assert(typeof pubPem === "string", "pubPem is string");
assert(typeof privPem === "string", "privPem is string");

var pubKO  = crypto.createPublicKey(pubPem);
var privKO = crypto.createPrivateKey(privPem);
assert(pubKO.type === "public" && pubKO.asymmetricKeyType === "rsa", "pubKO shape");
assert(privKO.type === "private" && privKO.asymmetricKeyType === "rsa", "privKO shape");
console.log("ok: createPublicKey / createPrivateKey from PEM");

// ---- Imported keys still work ----
var ct3 = crypto.publicEncrypt(pubKO, Buffer.from("imported rsa works", "utf8"));
var pt3 = crypto.privateDecrypt(privKO, ct3);
assert(pt3.toString("utf8") === "imported rsa works", "encrypt/decrypt with imported keys");
console.log("ok: encrypt/decrypt round-trip with PEM-imported keys");

// ---- Sign/verify with imported keys ----
var sig = crypto.sign("sha256", Buffer.from("signed", "utf8"), privKO);
var sigOk = crypto.verify("sha256", Buffer.from("signed", "utf8"), pubKO, sig);
assert(sigOk === true, "sign/verify with imported keys");
console.log("ok: sign/verify with PEM-imported keys");

// ---- createPublicKey from a private KeyObject (project) ----
var derivedPub = crypto.createPublicKey(pair.privateKey);
assert(derivedPub.type === "public" && derivedPub.asymmetricKeyType === "rsa", "derived pub shape");
var sig2 = crypto.sign("sha256", Buffer.from("project", "utf8"), pair.privateKey);
var ok2 = crypto.verify("sha256", Buffer.from("project", "utf8"), derivedPub, sig2);
assert(ok2 === true, "verify with derived public");
console.log("ok: createPublicKey(privateKO) projects to public");

// ---- oaepHash override ----
var ct4 = crypto.publicEncrypt({ key: pubKO, oaepHash: "sha256" }, Buffer.from("oaep256", "utf8"));
var pt4 = crypto.privateDecrypt({ key: privKO, oaepHash: "sha256" }, ct4);
assert(pt4.toString("utf8") === "oaep256", "oaepHash sha256 round-trip");
console.log("ok: oaepHash override (sha256)");

console.log("\nrsa_encrypt smoke: all assertions passed");
