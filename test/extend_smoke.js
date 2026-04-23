// extend: jQuery-style shallow / deep merge.

var extend = require("./vendor/extend.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// Shallow (default).
eq(extend({ a: 1 }, { b: 2 }), { a: 1, b: 2 }, "shallow");
eq(extend({ a: { x: 1 } }, { a: { y: 2 } }), { a: { y: 2 } }, "shallow replaces");

// Deep (first arg = true).
eq(extend(true, { a: { x: 1 } }, { a: { y: 2 } }), { a: { x: 1, y: 2 } }, "deep");
console.log("ok: 3 extend forms");

console.log("\nextend smoke: all assertions passed");
