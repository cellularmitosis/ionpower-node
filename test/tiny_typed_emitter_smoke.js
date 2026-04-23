// tiny-typed-emitter: re-exports EventEmitter under a typed-safe alias.

var te = require("./vendor/tiny-typed-emitter.js");
var TypedEmitter = te.TypedEmitter;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Should be the EventEmitter class.
var e = new TypedEmitter();
var seen = [];
e.on("tick", function (n) { seen.push(n); });
e.emit("tick", 1); e.emit("tick", 2); e.emit("tick", 3);
assert(seen.length === 3 && seen[2] === 3, "emit x3");
console.log("ok: typed emitter fires");

console.log("\ntiny-typed-emitter smoke: all assertions passed");
