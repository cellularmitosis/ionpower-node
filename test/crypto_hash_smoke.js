// crypto.createHash('sha256') + createHmac('sha256') smoke. The impls
// live in globals.cpp bootstrap (pure JS on top of Uint8Array); no
// OpenSSL dependency.

var crypto = require("crypto");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

// FIPS 180-2 test vector: SHA-256('abc')
var h = crypto.createHash('sha256').update('abc').digest('hex');
eq(h, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
   "SHA-256('abc') vector");
console.log("ok: SHA-256('abc') vector");

// Empty string: SHA-256("")
var h0 = crypto.createHash('sha256').update('').digest('hex');
eq(h0, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
   "SHA-256('') vector");
console.log("ok: SHA-256('') vector");

// 56-byte boundary message: 'a' * 56. Sanity: just verify shape.
var h56 = crypto.createHash('sha256').update('a'.repeat(56)).digest('hex');
eq(h56.length, 64, "56-char 'a' hash is 64 hex chars");
eq(/^[0-9a-f]{64}$/.test(h56), true, "is all-hex");
console.log("ok: SHA-256 block-boundary handling (shape): " + h56);

// Chunked update: should equal single-update.
var a = crypto.createHash('sha256');
a.update('Hello, '); a.update('world!');
var b = crypto.createHash('sha256').update('Hello, world!');
eq(a.digest('hex'), b.digest('hex'), "chunked == whole");
console.log("ok: chunked update");

// RFC 4231 HMAC-SHA-256 test vector #1:
//   key = 0x0b * 20, data = 'Hi There'
//   expected = b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7
var key1 = new Uint8Array(20);
for (var i = 0; i < 20; ++i) key1[i] = 0x0b;
var mac1 = crypto.createHmac('sha256', key1).update('Hi There').digest('hex');
eq(mac1, "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
   "HMAC-SHA-256 RFC 4231 vector 1");
console.log("ok: HMAC-SHA-256 RFC 4231 vector 1");

// RFC 4231 HMAC-SHA-256 test vector #2:
//   key = 'Jefe', data = 'what do ya want for nothing?'
//   expected = 5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843
var mac2 = crypto.createHmac('sha256', 'Jefe')
                 .update('what do ya want for nothing?').digest('hex');
eq(mac2, "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
   "HMAC-SHA-256 RFC 4231 vector 2");
console.log("ok: HMAC-SHA-256 RFC 4231 vector 2");

// Base64 digest.
var mac3 = crypto.createHmac('sha256', 'secret').update('payload').digest('base64');
eq(typeof mac3, 'string', 'base64 digest is string');
eq(mac3.length, 44, 'base64 sha256 len = 44'); // 32 bytes -> 44 base64 w/ pad
console.log("ok: base64 digest");

// timingSafeEqual
var a1 = new Uint8Array([1,2,3,4]);
var a2 = new Uint8Array([1,2,3,4]);
var a3 = new Uint8Array([1,2,3,5]);
if (crypto.timingSafeEqual(a1, a2) !== true) { console.error("FAIL: equal"); process.exit(1); }
if (crypto.timingSafeEqual(a1, a3) !== false) { console.error("FAIL: differ"); process.exit(1); }
console.log("ok: timingSafeEqual");

console.log("\ncrypto hash/hmac smoke: all assertions passed");
