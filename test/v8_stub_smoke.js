// v8: stub. serialize / deserialize round-trip via JSON; that's
// lossy for non-JSON values but covers analyzer-cache style uses.
// getHeapStatistics is an opaque object — diagnostic, not load-bearing.

var v8 = require("v8");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", b, "got", a);
        process.exit(1);
    }
}

assert(typeof v8 === "object" && v8 !== null,           "v8 is an object");
assert(typeof v8.serialize === "function",              "v8.serialize is a function");
assert(typeof v8.deserialize === "function",            "v8.deserialize is a function");
assert(typeof v8.getHeapStatistics === "function",      "v8.getHeapStatistics is a function");
console.log("ok: v8 stub shape");

// Round-trip a small JSON-friendly object.
var input = { a: 1, b: [2, 3, "four"], c: { nested: true } };
var bytes = v8.serialize(input);
assert(Buffer.isBuffer(bytes), "serialize returns a Buffer");
var output = v8.deserialize(bytes);
eq(output, input, "serialize+deserialize round-trip");
console.log("ok: v8.serialize+deserialize round-trip");

var stats = v8.getHeapStatistics();
assert(typeof stats === "object" && stats !== null, "getHeapStatistics returns an object");
console.log("ok: v8.getHeapStatistics returns an object");

// module.isBuiltin should recognize 'v8'.
var Module = require("module");
assert(Module.isBuiltin("v8"),       "module.isBuiltin('v8')");
assert(Module.isBuiltin("node:v8"),  "module.isBuiltin('node:v8')");
console.log("ok: v8 is a builtin per module.isBuiltin");

console.log("\nv8 stub smoke: all assertions passed");
