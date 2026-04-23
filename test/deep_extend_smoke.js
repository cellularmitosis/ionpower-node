// deep-extend: recursively merge objects (alt to deepmerge).

var deepExtend = require("./vendor/deep-extend.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// Basic merge.
var target = { a: 1, b: { x: 1 } };
deepExtend(target, { b: { y: 2 }, c: 3 });
eq(target, { a: 1, b: { x: 1, y: 2 }, c: 3 }, "merge");
console.log("ok: deep merge");

// Multiple sources.
var t2 = {};
deepExtend(t2, { a: 1 }, { b: 2 }, { a: 3 });
eq(t2, { a: 3, b: 2 }, "later wins");
console.log("ok: multi-source");

// Arrays replace (don't merge).
var t3 = { list: [1, 2, 3] };
deepExtend(t3, { list: [9] });
eq(t3.list, [9], "arrays replace");
console.log("ok: array replace");

console.log("\ndeep-extend smoke: all assertions passed");
