// Immutable.js: persistent data structures.

var Immutable = require("./vendor/immutable.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var m = Immutable.Map({ a: 1, b: 2 });
var m2 = m.set("c", 3);

assert(m.size === 2, "original size 2");
assert(m2.size === 3, "updated size 3");
assert(m.get("c") === undefined, "original c not set");
assert(m2.get("c") === 3, "updated c = 3");
console.log("ok: Map.set immutable");

var l = Immutable.List([1, 2, 3, 4]);
var l2 = l.push(5);
assert(l.size === 4, "original 4");
assert(l2.size === 5, "pushed 5");
assert(l2.last() === 5, "last is 5");
console.log("ok: List.push immutable");

// Records.
var Point = Immutable.Record({ x: 0, y: 0 });
var p1 = new Point({ x: 3, y: 4 });
assert(p1.x === 3 && p1.y === 4, "record fields");
var p2 = p1.set("x", 10);
assert(p1.x === 3, "original unchanged");
assert(p2.x === 10, "new has updated");
console.log("ok: Record");

console.log("\nimmutable smoke: all assertions passed");
