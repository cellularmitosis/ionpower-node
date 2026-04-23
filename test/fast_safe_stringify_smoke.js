// fast-safe-stringify: JSON.stringify that handles circular refs.

var stringifyMod = require("./vendor/fast-safe-stringify.js");
var stringify = stringifyMod.default || stringifyMod;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// Flat object.
var r = stringify({ a: 1, b: [2, 3] });
assert(JSON.parse(r).a === 1, "flat obj: " + r);
console.log("ok: fast-safe-stringify flat");

// Circular.
var circ = { a: 1 };
circ.self = circ;
var r2 = stringify(circ);
var parsed = JSON.parse(r2);
assert(parsed.a === 1, "circular: top-level preserved");
assert(parsed.self === "[Circular]" || typeof parsed.self === "string",
       "circular detected: " + JSON.stringify(parsed.self));
console.log("ok: fast-safe-stringify circular");

console.log("\nfast-safe-stringify smoke: all assertions passed");
