// object-assign: polyfill for Object.assign.

var assign = require("./vendor/object-assign.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

eq(assign({}, { a: 1 }, { b: 2 }), { a: 1, b: 2 }, "simple merge");
eq(assign({ a: 1 }, { a: 2, b: 3 }), { a: 2, b: 3 }, "later wins");
console.log("ok: 2 assign forms");

console.log("\nobject-assign smoke: all assertions passed");
