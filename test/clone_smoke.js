var clone = require("./vendor/clone.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Primitives.
assert(clone(42) === 42,              "number clone identity");
assert(clone("hi") === "hi",          "string clone identity");
assert(clone(null) === null,          "null");

// Objects.
var obj = { a: 1, b: { c: [1, 2, { d: 3 }] }, e: new Date(0) };
var cp = clone(obj);
assert(cp !== obj,                    "new obj");
assert(cp.b !== obj.b,                "deep not shared");
assert(cp.b.c[2].d === 3,             "deep value preserved");
assert(cp.e.getTime() === 0,          "date cloned");
// Mutating cp doesn't affect obj.
cp.b.c[2].d = 99;
assert(obj.b.c[2].d === 3,            "mutation isolated");
console.log("ok: deep clone with date");

// Arrays.
var arr = [1, [2, [3, [4]]]];
var arrcp = clone(arr);
arrcp[1][1][1][0] = 999;
assert(arr[1][1][1][0] === 4,         "nested array mutation isolated");
console.log("ok: nested arrays");

// Regex.
var r = /abc/gi;
var r2 = clone(r);
assert(r2.source === "abc" && r2.flags === "gi", "regex cloned");
console.log("ok: regex");

console.log("\nclone smoke: all assertions passed");
