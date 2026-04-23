// just-* micro-libs: clone / safe-get / safe-set. Each is a tiny
// ESM-default export that we unwrap.

var jc = require("./vendor/just-clone.js");
var clone = jc.default || jc;
var jg = require("./vendor/just-safe-get.js");
var get = jg.default || jg;
var js = require("./vendor/just-safe-set.js");
var set = js.default || js;

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// clone
var orig = { a: 1, b: [2, 3], c: { d: 4 } };
var c = clone(orig);
eq(c, orig, "clone equal by value");
orig.c.d = 999;
eq(c.c.d, 4, "deep-clone independence");
console.log("ok: just-clone");

// safe-get
var deep = { a: { b: { c: 42 } } };
eq(get(deep, "a.b.c"), 42, "get deep");
eq(get(deep, "a.x.y"), undefined, "get missing");
eq(get(deep, "x.y", "default"), "default", "get with default");
console.log("ok: just-safe-get");

// safe-set
var target = {};
set(target, "a.b.c", 99);
eq(target, { a: { b: { c: 99 } } }, "set creates path");
console.log("ok: just-safe-set");

console.log("\njust_suite smoke: all assertions passed");
