// deep-freeze: recursively Object.freeze an object graph.

var deepFreeze = require("./vendor/deep-freeze.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var obj = { a: 1, b: { c: 2, d: [1, 2, 3] } };
deepFreeze(obj);

assert(Object.isFrozen(obj), "top-level frozen");
assert(Object.isFrozen(obj.b), "nested object frozen");
assert(Object.isFrozen(obj.b.d), "nested array frozen");
console.log("ok: deep-freeze: all nested containers frozen");

// Mutations must not stick (in strict mode they'd throw; in sloppy they're silent).
try { obj.a = 99; } catch (e) {}
assert(obj.a === 1, "top-level mutation silently ignored");

try { obj.b.c = 99; } catch (e) {}
assert(obj.b.c === 2, "nested mutation silently ignored");
console.log("ok: deep-freeze: mutations rejected");

console.log("\ndeep-freeze smoke: all assertions passed");
