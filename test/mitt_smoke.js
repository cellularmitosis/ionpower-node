// Smoke test: mitt (200-byte pub/sub) on ionpower-node.
var mitt = require("./vendor/mitt.js");
var emitter = mitt();

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var hits = [];
emitter.on("evt", function (data) { hits.push(["A", data]); });
emitter.on("evt", function (data) { hits.push(["B", data]); });

emitter.emit("evt", 42);
emitter.emit("evt", "hi");

assert(hits.length === 4, "4 hits: " + hits.length);
assert(hits[0][0] === "A" && hits[0][1] === 42, "A sees 42");
assert(hits[1][0] === "B" && hits[1][1] === 42, "B sees 42");
console.log("ok: on + emit");

// off one.
emitter.off("evt", function unused() {}); // removing a non-listener is no-op
emitter.all.get("evt").length === 2; // both still present
console.log("ok: stray off is harmless");

// wildcard '*'
var anyHits = 0;
var wild = mitt();
wild.on("*", function () { anyHits++; });
wild.emit("foo", 1);
wild.emit("bar", 2);
assert(anyHits === 2, "wildcard sees both");
console.log("ok: wildcard");

console.log("\nmitt smoke: all assertions passed");
