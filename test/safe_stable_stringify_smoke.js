// safe-stable-stringify: deterministic JSON + circular-safe.

var stringify = require("./vendor/safe-stable-stringify.js");
stringify = stringify.default || stringify;

function eq(a, b, msg) {
    if (a !== b) { console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a)); process.exit(1); }
}

// Deterministic key ordering.
eq(stringify({ z: 1, a: 2, m: 3 }), '{"a":2,"m":3,"z":1}', "sorted keys");
console.log("ok: sorted keys");

// Circular survives.
var c = { name: "root" };
c.self = c;
var s = stringify(c);
if (typeof s !== "string") { console.error("FAIL: circular: not string", s); process.exit(1); }
// Should have omitted or placeholder'd the cycle.
console.log("ok: circular: " + s);

// Primitives.
eq(stringify(42), "42", "num");
eq(stringify([1, 2, 3]), "[1,2,3]", "array");
console.log("ok: primitives + array");

console.log("\nsafe-stable-stringify smoke: all assertions passed");
