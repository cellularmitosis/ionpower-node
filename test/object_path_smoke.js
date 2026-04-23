// object-path: safe dotted-path get/set/has/del.

var op = require("./vendor/object-path.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var o = { a: { b: { c: 42 } } };

assert(op.get(o, "a.b.c") === 42, "get a.b.c");
assert(op.get(o, "a.b.missing", "default") === "default", "default");
console.log("ok: get");

op.set(o, "a.b.d", "new");
assert(o.a.b.d === "new", "set a.b.d");
console.log("ok: set");

assert(op.has(o, "a.b.c") === true, "has a.b.c");
assert(op.has(o, "a.b.missing") === false, "has missing");
console.log("ok: has");

op.del(o, "a.b.c");
assert(o.a.b.c === undefined, "del a.b.c");
console.log("ok: del");

// Array index.
var arr = { items: [10, 20, 30] };
assert(op.get(arr, "items.1") === 20, "array index");
op.set(arr, "items.1", 99);
assert(arr.items[1] === 99, "array set");
console.log("ok: array index");

console.log("\nobject-path smoke: all assertions passed");
