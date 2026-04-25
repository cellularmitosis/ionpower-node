// node-forge: pure-JS PKI/crypto (X.509, PEM, ASN.1, AES/DES/RSA, etc.)

var forge = require("./vendor/node-forge");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Basic MD5 sanity.
var md = forge.md.md5.create();
md.update("abc");
var digest = md.digest().toHex();
assert(digest === "900150983cd24fb0d6963f7d28e17f72", "MD5('abc'): " + digest);
console.log("ok: MD5 vector");

// SHA-1.
var sha1 = forge.md.sha1.create();
sha1.update("abc");
var sd = sha1.digest().toHex();
assert(sd === "a9993e364706816aba3e25717850c26c9cd0d89d", "SHA-1('abc'): " + sd);
console.log("ok: SHA-1 vector");

// HMAC-SHA1 via forge.
var hmac = forge.hmac.create();
hmac.start("sha1", "Jefe");
hmac.update("what do ya want for nothing?");
var macHex = hmac.digest().toHex();
assert(macHex === "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79", "HMAC-SHA1 RFC 2202: " + macHex);
console.log("ok: HMAC-SHA1 RFC 2202 vector");

// ASN.1 DER encode.
var asn1 = forge.asn1;
var encoded = asn1.toDer(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, "hello"));
assert(encoded.length() > 0, "DER produced bytes");
console.log("ok: ASN.1 DER encode");

console.log("\nnode-forge smoke: all assertions passed");
