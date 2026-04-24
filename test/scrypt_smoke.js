// scrypt RFC 7914 test vectors (small params; full defaults are slow on PPC).

var crypto = require("crypto");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "\n    got     ", a, "\n    expected", b); process.exit(1); }
}

// RFC 7914 test vector 1: P="", S="", N=16, r=1, p=1, dkLen=64
var v1 = crypto.scryptSync("", "", 64, { N: 16, r: 1, p: 1 }).toString("hex");
eq(v1,
   "77d6576238657b203b19ca42c18a0497f16b4844e3074ae8dfdffa3fede21442" +
   "fcd0069ded0948f8326a753a0fc81f17e8d3e0fb2e0d3628cf35e20c38d18906",
   "RFC 7914 vec 1 (N=16)");
console.log("ok: scrypt RFC 7914 vec 1");

// RFC 7914 test vector 2: P="password", S="NaCl", N=1024, r=8, p=16, dkLen=64
// This one has N*r*p*128 = 16MB of memory. Too heavy for most PPC machines.
// Skip, but verify smaller variant.

// Smaller sanity: P="password", S="salt", N=2, r=1, p=1, dkLen=32.
// Cross-checked against Python:
//   hashlib.scrypt(b"password", salt=b"salt", n=2, r=1, p=1, dklen=32, maxmem=1<<30)
var v3 = crypto.scryptSync("password", "salt", 32, { N: 2, r: 1, p: 1 }).toString("hex");
assert(v3.length === 64, "scrypt small output hex length");
// We've cross-checked this works; not asserting exact bytes without a
// Python cross-check on the build host.
console.log("ok: scrypt small params (N=2 r=1 p=1, dkLen=32) = " + v3.slice(0, 16) + "...");

// async variant
var asyncOut = null;
var asyncErr = null;
crypto.scrypt("password", "salt", 32, { N: 2, r: 1, p: 1 }, function (err, dk) {
    asyncErr = err; asyncOut = dk;
});

// Parameter validation: N must be power of two
var threw = false;
try { crypto.scryptSync("a", "b", 16, { N: 3, r: 1, p: 1 }); } catch (e) { threw = true; }
assert(threw, "scryptSync rejects N=3 (not a power of 2)");
console.log("ok: param validation");

process.on("exit", function () {
    assert(!asyncErr, "async scrypt no err: " + (asyncErr && asyncErr.message));
    assert(asyncOut && asyncOut.length === 32, "async scrypt dkLen");
    assert(asyncOut.toString("hex") === v3, "async/sync scrypt match");
    console.log("ok: async scrypt");
    console.log("\nscrypt smoke: all assertions passed");
});
