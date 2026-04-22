// Smoke test: tweetnacl (ed25519 + secretbox + hash) on ionpower-node.
// tweetnacl refuses to work without a PRNG; we plug ours (via our
// crypto shim / getRandomValues) into nacl.setPRNG.

var nacl = require("./vendor/tweetnacl.js");

// Wire our crypto shim into nacl.
nacl.setPRNG(function (out, n) {
    // nacl calls into here asking for n random bytes into out.
    // globalThis.crypto was set by our bootstrap.
    var tmp = new Uint8Array(n);
    crypto.getRandomValues(tmp);
    for (var i = 0; i < n; ++i) out[i] = tmp[i];
});

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }
function eqBytes(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; ++i) if (a[i] !== b[i]) return false;
    return true;
}

// hash (SHA-512).
var msg = new Uint8Array([104, 101, 108, 108, 111]);   // 'hello'
var h = nacl.hash(msg);
assert(h.length === 64, "sha-512 = 64 bytes");
// Well-known test vector: SHA-512("hello")
//   9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043
assert(h[0] === 0x9b && h[1] === 0x71 && h[2] === 0xd2,
       "sha-512 'hello' first three bytes");
console.log("ok: sha-512 test vector");

// sign: generate key pair, sign, verify.
var pair = nacl.sign.keyPair();
assert(pair.publicKey.length === 32 && pair.secretKey.length === 64,
       "ed25519 key sizes: pub=32, sec=64");
var payload = new Uint8Array([1, 2, 3, 4, 5]);
var signed = nacl.sign(payload, pair.secretKey);
var opened = nacl.sign.open(signed, pair.publicKey);
assert(opened !== null, "sign verify ok");
assert(eqBytes(opened, payload), "sign message round-trip");
console.log("ok: ed25519 sign / verify");

// secretbox (XSalsa20-Poly1305).
var key   = nacl.randomBytes(32);
var nonce = nacl.randomBytes(24);
var ct    = nacl.secretbox(payload, nonce, key);
var pt    = nacl.secretbox.open(ct, nonce, key);
assert(pt !== null, "secretbox decrypt ok");
assert(eqBytes(pt, payload), "secretbox round-trip");
console.log("ok: secretbox encrypt / decrypt");

console.log("\ntweetnacl smoke: all assertions passed");
