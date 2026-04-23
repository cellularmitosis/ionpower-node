// Tiny-utility batch: predicates + wrapping + URI coding + conversion.

var isBuffer  = require("./vendor/is-buffer.js");
var toBuffer  = require("./vendor/to-buffer.js");
var listToArray = require("./vendor/list-to-array.js");
var once      = require("./vendor/once.js");
var wrappy    = require("./vendor/wrappy.js");
var strictUriEncode = require("./vendor/strict-uri-encode.js");
var decodeUri = require("./vendor/decode-uri-component.js");
var isarray   = require("./vendor/isarray.js");

// ESM default unwrap.
strictUriEncode = strictUriEncode.default || strictUriEncode;
decodeUri = decodeUri.default || decodeUri;
isarray = isarray.default || isarray;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// is-buffer
assert(isBuffer(Buffer.from("x")) === true, "Buffer is buffer");
assert(isBuffer("x") === false, "string isn't");
assert(isBuffer([1,2,3]) === false, "array isn't");
console.log("ok: is-buffer");

// to-buffer
var b = toBuffer([1, 2, 3]);
assert(Buffer.isBuffer(b), "array -> Buffer");
assert(b.length === 3, "length=3");
console.log("ok: to-buffer");

// list-to-array: comma/space-separated string -> array.
eq(listToArray("a, b, c"), ["a", "b", "c"], "comma-separated");
eq(listToArray("x y z"),   ["x", "y", "z"], "space-separated");
eq(listToArray(["already","array"]), ["already","array"], "array passthrough");
console.log("ok: list-to-array");

// once: returns the wrapped fn's first result forever.
var calls = 0;
var o = once(function () { calls++; return "first"; });
eq(o(), "first", "first call returns value");
eq(o(), "first", "second call returns same");
assert(calls === 1, "underlying called once");
console.log("ok: once");

// wrappy: preserve fn name/props when wrapping (used by once).
var original = function add(a, b) { return a + b; };
original.marker = true;
var wrapped = wrappy(function (fn) {
    return function () { return fn.apply(this, arguments); };
})(original);
eq(wrapped(2, 3), 5, "wrapped still works");
assert(wrapped.marker === true, "properties preserved");
console.log("ok: wrappy");

// strict-uri-encode: encode ALL reserved chars (no passthrough).
var enc = strictUriEncode("hello world!");
assert(enc.indexOf("%20") !== -1, "space encoded: " + enc);
assert(enc.indexOf("%21") !== -1, "! encoded: " + enc);
console.log("ok: strict-uri-encode");

// decode-uri-component: safer decodeURIComponent.
eq(decodeUri("hello%20world"), "hello world", "decode space");
eq(decodeUri("caf%C3%A9"),     "café",        "decode café");
// Malformed input should not throw.
var malformed = decodeUri("bad%");
assert(typeof malformed === "string", "malformed returns string, not throw");
console.log("ok: decode-uri-component");

// isarray: polyfill for Array.isArray.
assert(isarray([]) === true, "[] is array");
assert(isarray({}) === false, "{} is not array");
console.log("ok: isarray");

console.log("\ntiny_utils smoke: all assertions passed");
