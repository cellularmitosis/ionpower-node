// fast-equals: fast deep equality (alternative to fast-deep-equal).

var fe = require("./vendor/fast-equals.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", b, "got", a); process.exit(1); }
}

eq(fe.deepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }), true, "deep equal");
eq(fe.deepEqual({ a: 1 }, { a: 2 }), false, "different");
eq(fe.shallowEqual({ a: 1 }, { a: 1 }), true, "shallow equal");
eq(fe.shallowEqual({ a: { x: 1 } }, { a: { x: 1 } }), false, "shallow !== deep for objects");
eq(fe.strictDeepEqual({ a: undefined }, {}), false, "strict: undefined vs missing differs");
console.log("ok: 5 fast-equals forms");

console.log("\nfast-equals smoke: all assertions passed");
