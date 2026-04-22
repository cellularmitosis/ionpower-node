// Smoke test: crypto-js 4.2 (pure-JS SHA/MD5/AES) on ionpower-node.
const CryptoJS = require("./vendor/crypto-js.js");

function eq(label, got, want) {
    if (got === want) { console.log("ok: " + label); }
    else { console.error("FAIL: " + label + "\n  got:  " + got +
                                        "\n  want: " + want);
           process.exit(1); }
}

// Hash test vectors (RFC 6234 / NIST).
eq("SHA-1 'abc'",
   CryptoJS.SHA1("abc").toString(),
   "a9993e364706816aba3e25717850c26c9cd0d89d");
eq("SHA-256 'abc'",
   CryptoJS.SHA256("abc").toString(),
   "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
eq("SHA-512 'abc'",
   CryptoJS.SHA512("abc").toString(),
   "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a" +
   "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f");
eq("MD5 'abc'",
   CryptoJS.MD5("abc").toString(),
   "900150983cd24fb0d6963f7d28e17f72");

// HMAC.
eq("HMAC-SHA1 Jefe",
   CryptoJS.HmacSHA1("what do ya want for nothing?", "Jefe").toString(),
   "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79");

// Base64 encode/decode.
var words = CryptoJS.enc.Utf8.parse("Hello, PPC!");
eq("base64 encode", words.toString(CryptoJS.enc.Base64), "SGVsbG8sIFBQQyE=");
var dec = CryptoJS.enc.Base64.parse("SGVsbG8sIFBQQyE=");
eq("base64 decode", dec.toString(CryptoJS.enc.Utf8), "Hello, PPC!");

// AES round-trip.
var plaintext = "Top secret payload";
var key = "a secret key";
var cipher = CryptoJS.AES.encrypt(plaintext, key).toString();
var decrypted = CryptoJS.AES.decrypt(cipher, key).toString(CryptoJS.enc.Utf8);
eq("AES round-trip", decrypted, plaintext);

console.log("\ncrypto-js smoke: all assertions passed");
