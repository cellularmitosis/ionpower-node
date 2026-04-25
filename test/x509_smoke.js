// X509Certificate smoke (v0.67). Generates a self-signed cert via
// vendored forge, then exercises the Node-style X509Certificate API
// over it.

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// We need to drive forge directly to generate a self-signed cert.
// Use the same lazy-load path the runtime uses.
function loadForge() {
    var roots = [process.cwd() + "/test/vendor/node-forge",
                 process.cwd() + "/vendor/node-forge"];
    var fs = require("fs");
    for (var i = 0; i < roots.length; i++) {
        if (fs.existsSync(roots[i] + "/lib/index.js")) {
            return require(roots[i] + "/lib/index.js");
        }
    }
    throw new Error("forge not found");
}

console.log("Generating RSA-1024 + self-signed cert (slow on PPC)...");
var forge = loadForge();
var t0 = Date.now();
var keys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
var cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = "01";
cert.validity.notBefore = new Date();
cert.validity.notAfter  = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
var attrs = [
    { name: "commonName",       value: "ionpower-node-test.example.com" },
    { name: "countryName",      value: "US" },
    { name: "organizationName", value: "ionpower-node" },
    { name: "organizationalUnitName", value: "test" }
];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.setExtensions([
    { name: "basicConstraints", cA: true },
    { name: "subjectAltName",
      altNames: [
        { type: 2, value: "ionpower-node-test.example.com" },
        { type: 2, value: "*.ionpower-node-test.example.com" },
        { type: 7, ip: "127.0.0.1" }
      ] }
]);
cert.sign(keys.privateKey, forge.md.sha256.create());
var pem = forge.pki.certificateToPem(cert);
console.log("cert generation took", Date.now() - t0, "ms");

// ---- Construct from PEM ----
assert(typeof crypto.X509Certificate === "function", "crypto.X509Certificate exposed");
var x = new crypto.X509Certificate(pem);
assert(x.subject.indexOf("CN=ionpower-node-test.example.com") >= 0, "subject CN: " + x.subject);
assert(x.subject.indexOf("O=ionpower-node") >= 0, "subject O");
assert(x.issuer.indexOf("CN=ionpower-node-test.example.com") >= 0, "issuer CN (self-signed)");
console.log("ok: subject + issuer");

// ---- Validity ----
assert(typeof x.validFrom === "string", "validFrom string");
assert(typeof x.validTo === "string", "validTo string");
assert(x.validFrom.indexOf("GMT") > 0, "validFrom contains GMT: " + x.validFrom);
assert(x.validTo.indexOf("GMT") > 0, "validTo contains GMT: " + x.validTo);
console.log("ok: validity (validFrom=" + x.validFrom + ")");

// ---- Serial number ----
assert(typeof x.serialNumber === "string", "serialNumber string");
assert(x.serialNumber === x.serialNumber.toUpperCase(), "serial uppercase");
console.log("ok: serialNumber=" + x.serialNumber);

// ---- Fingerprint ----
assert(/^[0-9A-F]{2}(:[0-9A-F]{2}){19}$/.test(x.fingerprint), "fingerprint sha1 shape: " + x.fingerprint);
assert(/^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/.test(x.fingerprint256), "fingerprint sha256 shape");
assert(/^[0-9A-F]{2}(:[0-9A-F]{2}){63}$/.test(x.fingerprint512), "fingerprint sha512 shape");
console.log("ok: fingerprint sha1/sha256/sha512");

// ---- raw (DER) ----
assert(Buffer.isBuffer(x.raw), "raw is Buffer");
assert(x.raw.length > 200, "raw DER non-trivial: " + x.raw.length);
console.log("ok: raw DER (" + x.raw.length + " bytes)");

// ---- Subject Alt Name ----
assert(typeof x.subjectAltName === "string", "subjectAltName string: " + x.subjectAltName);
assert(x.subjectAltName.indexOf("DNS:ionpower-node-test.example.com") >= 0, "SAN DNS");
assert(x.subjectAltName.indexOf("DNS:*.ionpower-node-test.example.com") >= 0, "SAN wildcard");
assert(x.subjectAltName.indexOf("IP Address:127.0.0.1") >= 0, "SAN IP");
console.log("ok: subjectAltName=" + x.subjectAltName);

// ---- ca flag ----
assert(x.ca === true, "ca true (basicConstraints set)");
console.log("ok: ca flag");

// ---- toString() / toJSON() === PEM ----
var s = x.toString();
assert(s.indexOf("-----BEGIN CERTIFICATE-----") >= 0, "toString is PEM");
assert(x.toJSON().indexOf("-----BEGIN CERTIFICATE-----") >= 0, "toJSON is PEM");
console.log("ok: toString / toJSON");

// ---- publicKey is a usable KeyObject ----
assert(x.publicKey, "publicKey present");
assert(x.publicKey.type === "public", "publicKey type=public");
assert(x.publicKey.asymmetricKeyType === "rsa", "publicKey asymmetricKeyType=rsa");

// Sign with the original private key (via crypto.sign), verify with cert's pub.
var msg = Buffer.from("certified", "utf8");
var privKO = crypto.createPrivateKey(forge.pki.privateKeyToPem(keys.privateKey));
var sig = crypto.sign("sha256", msg, privKO);
var ok = crypto.verify("sha256", msg, x.publicKey, sig);
assert(ok === true, "sign/verify with cert.publicKey");
console.log("ok: cert.publicKey usable for verify");

// ---- checkIssued (self-signed -> true) ----
assert(x.checkIssued(x) === true, "self-signed: checkIssued(self)");
console.log("ok: checkIssued");

// ---- checkPrivateKey ----
assert(x.checkPrivateKey(privKO) === true, "checkPrivateKey true for matching");
var otherKey = crypto.generateKeyPairSync("rsa", { modulusLength: 1024 });
assert(x.checkPrivateKey(otherKey.privateKey) === false, "checkPrivateKey false for non-matching");
console.log("ok: checkPrivateKey");

// ---- checkHost ----
assert(x.checkHost("ionpower-node-test.example.com") === "ionpower-node-test.example.com",
       "checkHost match");
assert(x.checkHost("not-a-match.example.org") === undefined, "checkHost mismatch");
console.log("ok: checkHost");

// ---- Construct from DER Buffer ----
var x2 = new crypto.X509Certificate(x.raw);
assert(x2.subject === x.subject, "DER reconstruction matches");
assert(x2.fingerprint256 === x.fingerprint256, "DER fingerprint matches");
console.log("ok: construct from DER Buffer");

// ---- Construct from PEM Buffer ----
var x3 = new crypto.X509Certificate(Buffer.from(pem, "utf8"));
assert(x3.fingerprint256 === x.fingerprint256, "PEM-as-Buffer fingerprint matches");
console.log("ok: construct from PEM Buffer");

console.log("\nx509 smoke: all assertions passed");
