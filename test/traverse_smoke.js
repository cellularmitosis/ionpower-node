// traverse: walk a nested object/array structure.

var traverse = require("./vendor/traverse.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var tree = { a: { b: { c: 42 }, d: [1, 2, 3] }, e: "leaf" };

// Map all numbers to their double.
var doubled = traverse(tree).map(function (v) {
    if (typeof v === "number") this.update(v * 2);
});
assert(doubled.a.b.c === 84, "c doubled: " + doubled.a.b.c);
assert(doubled.a.d[0] === 2 && doubled.a.d[2] === 6, "array doubled");
assert(doubled.e === "leaf", "leaf string untouched");
console.log("ok: map doubled numbers");

// Collect leaves as paths.
var paths = traverse(tree).paths();
assert(paths.length > 5, "path count: " + paths.length);
console.log("ok: paths:", paths.length);

// Find a specific key's path.
assert(traverse(tree).get(["a", "b", "c"]) === 42, "get path");
console.log("ok: get by path array");

console.log("\ntraverse smoke: all assertions passed");
