// Smoke test: base-x (configurable base encoder) on ionpower-node.
var baseFactory = require("./vendor/base-x.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Base58 (Bitcoin's alphabet).
var BASE58_ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var base58 = baseFactory(BASE58_ALPHA);

function strToBytes(s) {
    var a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; ++i) a[i] = s.charCodeAt(i) & 0xff;
    return a;
}
function bytesToStr(a) {
    var s = "";
    for (var i = 0; i < a.length; ++i) s += String.fromCharCode(a[i]);
    return s;
}

// encode / decode round-trip on various inputs.
var samples = [
    "hello",
    "PowerPC",
    "Mac OS X Tiger",
    "a"
];
for (var i = 0; i < samples.length; ++i) {
    var s = samples[i];
    var bytes = strToBytes(s);
    var encoded = base58.encode(bytes);
    var decoded = base58.decode(encoded);
    assert(bytesToStr(decoded) === s,
           "round-trip '" + s + "' via '" + encoded + "': got '" + bytesToStr(decoded) + "'");
    console.log("ok:", s, "->", encoded);
}

// Base64 custom (standard alphabet).
var base64 = baseFactory("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
var b64enc = base64.encode(strToBytes("hi"));
var b64dec = bytesToStr(base64.decode(b64enc));
assert(b64dec === "hi", "b64 roundtrip");
console.log("ok: custom base64 roundtrip");

console.log("\nbase-x smoke: all assertions passed");
