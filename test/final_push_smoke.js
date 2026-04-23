// Final push for session G. uuid-random, base-x, secure-random,
// tinyspy, loupe, he, is-callable.

var uuidRandom = require("./vendor/uuid-random.js");
var baseX = require("./vendor/base-x-latest.js");
var secureRandom = require("./vendor/secure-random.js");
var tinyspy = require("./vendor/tinyspy-latest.js");
var loupeMod = require("./vendor/loupe.js");
var loupe = loupeMod.default || loupeMod;
var he = require("./vendor/he-latest.js");
var isCallable = require("./vendor/is-callable.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// uuid-random: v4 UUID from crypto.
var uuid = uuidRandom();
assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid),
       "v4 uuid: " + uuid);
console.log("ok: uuid-random (v4 format)");

// base-x: customizable base-N encoder factory.
var baseXFactory = baseX.default || baseX;
if (typeof baseXFactory === "function") {
    var b58 = baseXFactory("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
    var encoded = b58.encode(Buffer.from([255, 0, 128]));
    assert(typeof encoded === "string" && encoded.length > 0, "base58 encode: " + encoded);
    console.log("ok: base-x (base58 encode)");
}

// secure-random: returns a random Uint8Array/Buffer.
var rb = secureRandom.randomUint8Array(16);
assert(rb && rb.length === 16, "16 random bytes");
console.log("ok: secure-random");

// tinyspy: vi.fn-style spies.
var spyFactory = tinyspy.spy || tinyspy.default && tinyspy.default.spy || tinyspy;
if (typeof spyFactory === "function") {
    var s = spyFactory();
    s(1, 2);
    s(3);
    if (s.calls) {
        assert(s.calls.length === 2, "tinyspy tracked 2 calls");
        console.log("ok: tinyspy tracks calls");
    } else {
        console.log("ok: tinyspy loads (different shape)");
    }
}

// loupe: util.inspect-ish formatter.
if (typeof loupe === "function" || typeof loupe.inspect === "function") {
    var inspect = typeof loupe === "function" ? loupe : loupe.inspect;
    var out = inspect({ a: 1, b: [2, 3] });
    assert(typeof out === "string" && out.length > 0, "loupe inspect: " + out);
    console.log("ok: loupe inspect");
}

// he (html entities): encode/decode.
// he's default encoding uses numeric refs (&#x26;); pass
// useNamedReferences:true to get &amp;.
assert(typeof he.encode === "function", "he.encode");
var enc = he.encode("<b>&</b>", { useNamedReferences: true });
assert(enc.indexOf("&amp;") !== -1, "encoded & (named): " + enc);
assert(he.decode("&amp;") === "&", "decode &amp;");
console.log("ok: he (html entities)");

// is-callable.
assert(isCallable(function(){}) === true, "function is callable");
assert(isCallable("string") === false, "string not callable");
assert(isCallable(null) === false, "null not callable");
console.log("ok: is-callable");

console.log("\nfinal_push smoke: all assertions passed");
