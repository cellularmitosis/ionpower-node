// mixin-deep: deep merge.

var mixin = require("./vendor/mixin-deep.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// Mutates target, returns target.
var target = { a: { b: 1, c: 2 } };
mixin(target, { a: { c: 99, d: 3 } });
eq(target, { a: { b: 1, c: 99, d: 3 } }, "deep merge");
console.log("ok: mixin-deep");

// Multiple sources.
var t2 = { a: 1 };
mixin(t2, { b: 2 }, { c: 3 }, { d: { e: 4 } });
eq(t2, { a: 1, b: 2, c: 3, d: { e: 4 } }, "multiple sources");
console.log("ok: mixin-deep multi-source");

console.log("\nmixin-deep smoke: all assertions passed");
