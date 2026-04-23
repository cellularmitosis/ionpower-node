// sort-keys: deterministic JSON-like key ordering.

var sortKeys = require("./vendor/sort-keys.js");
var isPlainObj = require("./vendor/is-plain-obj.js");

function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Shallow.
eq(Object.keys(sortKeys({ c: 3, a: 1, b: 2 })), ["a", "b", "c"], "shallow sort");
console.log("ok: sort-keys shallow");

// Deep.
eq(Object.keys(sortKeys({ z: 1, a: { y: 1, b: 2 } }, { deep: true }).a),
   ["b", "y"], "deep sort applies recursively");
console.log("ok: sort-keys deep");

// Custom compare: reverse.
eq(Object.keys(sortKeys({ a: 1, b: 2, c: 3 }, { compare: function(a, b) { return b.localeCompare(a); } })),
   ["c", "b", "a"], "sort-keys custom compare");
console.log("ok: sort-keys custom compare");

// is-plain-obj
assert(isPlainObj({}) === true, "plain obj");
assert(isPlainObj({a: 1}) === true, "plain obj with keys");
assert(isPlainObj([]) === false, "array is not plain");
assert(isPlainObj(null) === false, "null is not plain");
assert(isPlainObj(new Date()) === false, "Date is not plain");
console.log("ok: is-plain-obj");

console.log("\nsort_keys smoke: all assertions passed");
