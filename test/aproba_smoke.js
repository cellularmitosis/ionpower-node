// aproba: tiny arg-type validator. `validate('SN', [string, number])`.

var aproba = require("./vendor/aproba.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Good types pass silently.
aproba("SN", ["hello", 42]);
aproba("S", ["just a string"]);
aproba("A", [[1, 2, 3]]);
aproba("O", [{}]);
aproba("B", [true]);
aproba("F", [function () {}]);
console.log("ok: aproba accepts valid type strings");

// Bad types throw.
var threw = false;
try { aproba("S", [42]); } catch (e) { threw = true; }
assert(threw, "string required but number given throws");
console.log("ok: aproba rejects mismatched type");

threw = false;
try { aproba("SN", ["only one arg"]); } catch (e) { threw = true; }
assert(threw, "arity mismatch throws");
console.log("ok: aproba checks arity");

console.log("\naproba smoke: all assertions passed");
