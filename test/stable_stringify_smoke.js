// fast-json-stable-stringify: deterministic JSON (keys sorted).

var fast = require("./vendor/fast-json-stable-stringify.js");

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Key-order independence.
eq(fast({ z: 1, a: 2, m: 3 }), fast({ m: 3, a: 2, z: 1 }), "same content -> same output");
eq(fast({ z: 1, a: 2, m: 3 }), '{"a":2,"m":3,"z":1}', "output is sorted");
console.log("ok: key-order independence + sorted output");

// Nested.
eq(fast({ b: { y: 1, x: 2 }, a: [3, 1, 2] }),
   '{"a":[3,1,2],"b":{"x":2,"y":1}}', "nested sorted");
console.log("ok: nested sort");

// Primitives round-trip unchanged.
eq(fast(42), "42", "number");
eq(fast("hi"), '"hi"', "string");
eq(fast(null), "null", "null");
eq(fast([1, 2, 3]), "[1,2,3]", "array");
console.log("ok: primitives");

// Custom comparator.
var r = fast({ c: 1, a: 2, b: 3 }, { cmp: function (a, b) { return b.key.localeCompare(a.key); } });
eq(r, '{"c":1,"b":3,"a":2}', "reverse sort via cmp");
console.log("ok: custom comparator");

console.log("\nstable-stringify smoke: all assertions passed");
