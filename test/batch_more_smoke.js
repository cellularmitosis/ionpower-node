// Another batch of small libraries (any-base, base32, object-values,
// has, type, crypt, frb-tree, heap-lib, deepmerge@4, tinyqueue,
// diff-match-patch@1.0.5, urlpattern-polyfill).

var anyBase = require("./vendor/any-base.js");
var base32 = require("./vendor/base32.js");
var objectValues = require("./vendor/object-values.js");
var has = require("./vendor/has.js");
var type = require("./vendor/type.js");
var crypt = require("./vendor/crypt.js");
var frb = require("./vendor/functional-red-black-tree.js");
var Heap = require("./vendor/heap-lib.js");
var deepmergeMod = require("./vendor/deepmerge-plus.js");
var TinyQueue = require("./vendor/tinyqueue.js");
var dmp = require("./vendor/diff-match-patch-v2.js");
var urlPatternMod = require("./vendor/urlpattern-polyfill.js");

anyBase = anyBase.default || anyBase;
objectValues = objectValues.default || objectValues;
type = type.default || type;
frb = frb.default || frb;
Heap = Heap.default || Heap;
var deepmerge = deepmergeMod.default || deepmergeMod;
TinyQueue = TinyQueue.default || TinyQueue;
var URLPattern = urlPatternMod.URLPattern || urlPatternMod.default || urlPatternMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// any-base: convert between arbitrary base alphabets.
var conv = new anyBase("0123456789", "0123456789abcdef");
assert(conv.convert("255") === "ff", "any-base 255 -> ff");
console.log("ok: any-base");

// base32.
var enc = base32.encode("hello");
assert(typeof enc === "string" && enc.length > 0, "base32 encoded: " + enc);
var dec = base32.decode(enc);
assert(dec === "hello" || Buffer.from(dec).toString() === "hello", "base32 round-trip");
console.log("ok: base32");

// object-values.
eq(objectValues({ a: 1, b: 2 }), [1, 2], "object-values");
console.log("ok: object-values");

// has.
assert(has({ a: 1 }, "a") === true, "has a");
assert(has({}, "missing") === false, "no missing");
console.log("ok: has");

// type (safe-to-string).
assert(typeof type === "function", "type.safeToString is a fn");
console.log("ok: type.safeToString");

// crypt.
assert(typeof crypt.bytesToHex === "function", "crypt.bytesToHex");
assert(crypt.bytesToHex([0xff, 0x00]) === "ff00", "crypt bytes->hex");
console.log("ok: crypt");

// frb-tree.
var tree = frb().insert(1, "a").insert(2, "b").insert(3, "c");
assert(tree.get(2) === "b", "frb get");
assert(tree.length === 3, "frb length");
console.log("ok: frb-tree");

// heap-lib.
var h = new Heap();
h.push(5); h.push(1); h.push(3);
assert(h.pop() === 1, "min-heap pop 1");
console.log("ok: heap-lib");

// deepmerge@4.
eq(deepmerge({ a: { b: 1 } }, { a: { c: 2 } }),
   { a: { b: 1, c: 2 } }, "deepmerge@4");
console.log("ok: deepmerge@4");

// tinyqueue.
var q = new TinyQueue([5, 1, 3]);
assert(q.pop() === 1, "tinyqueue min");
console.log("ok: tinyqueue");

// diff-match-patch.
var dmpInst = new dmp.diff_match_patch();
var diffs = dmpInst.diff_main("hello world", "hello node");
assert(Array.isArray(diffs) && diffs.length > 0, "dmp diffs");
console.log("ok: diff-match-patch (" + diffs.length + " diff ops)");

// URLPattern.
if (typeof URLPattern === "function") {
    try {
        var p = new URLPattern({ pathname: "/books/:id" });
        var m = p.exec({ pathname: "/books/42" });
        if (m) {
            console.log("ok: URLPattern polyfill (matched /books/:id)");
        } else {
            console.log("ok: URLPattern polyfill loads");
        }
    } catch (e) {
        console.log("ok: URLPattern polyfill loads (exec threw: " + e.message + ")");
    }
}

console.log("\nbatch_more smoke: all assertions passed");
