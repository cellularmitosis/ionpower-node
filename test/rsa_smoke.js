// RSA via node-forge: keygen + sign/verify smoke. Slow on PPC
// (1024-bit keygen ~10-30s on G3), so we use 1024-bit for speed.

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// ---- Generate a small RSA keypair ----
console.log("Generating RSA-1024 (this is slow on PPC)...");
var t0 = Date.now();
var pair = crypto.generateKeyPairSync("rsa", { modulusLength: 1024, publicExponent: 0x10001 });
var ms = Date.now() - t0;
console.log("RSA keygen took", ms, "ms");

assert(pair && pair.publicKey && pair.privateKey, "keypair returned");
assert(pair.publicKey.type === "public", "public type");
assert(pair.privateKey.type === "private", "private type");
assert(pair.publicKey.asymmetricKeyType === "rsa", "asymmetricKeyType = rsa");
console.log("ok: crypto.generateKeyPairSync('rsa')");

// ---- Sign + verify ----
var msg = Buffer.from("hello rsa from ionpower-node", "utf8");
var sig = crypto.sign("sha256", msg, pair.privateKey);
assert(Buffer.isBuffer(sig), "sig is Buffer");
assert(sig.length === 128, "sig is 128 bytes (1024-bit RSA)");

var ok = crypto.verify("sha256", msg, pair.publicKey, sig);
assert(ok === true, "verify true");
console.log("ok: crypto.sign / verify (sha256)");

// ---- Tamper rejected ----
var bad = Buffer.from(sig);
bad[0] ^= 1;
assert(crypto.verify("sha256", msg, pair.publicKey, bad) === false,
       "tampered sig rejected");
var other = Buffer.from("different msg", "utf8");
assert(crypto.verify("sha256", other, pair.publicKey, sig) === false,
       "wrong msg rejected");
console.log("ok: tamper rejected");

// ---- PEM export ----
var pubPem = pair.publicKey.export({ format: "pem" });
var privPem = pair.privateKey.export({ format: "pem" });
assert(typeof pubPem === "string" && pubPem.indexOf("BEGIN PUBLIC KEY") >= 0, "public PEM");
assert(typeof privPem === "string" &&
       (privPem.indexOf("BEGIN RSA PRIVATE KEY") >= 0 ||
        privPem.indexOf("BEGIN PRIVATE KEY") >= 0), "private PEM");
console.log("ok: PEM export");

// ---- DER export ----
var pubDer = pair.publicKey.export({ format: "der" });
assert(Buffer.isBuffer(pubDer), "public DER");
assert(pubDer.length > 100, "public DER is non-trivial");
console.log("ok: DER export");

console.log("\nrsa smoke: all assertions passed (keygen " + ms + " ms)");
