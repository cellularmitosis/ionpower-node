// circular-json: JSON with circular-reference support.

var CJS = require("./vendor/circular-json.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var o = { name: "root" };
o.self = o;

var s = CJS.stringify(o);
assert(typeof s === "string", "stringify produced string");
assert(s.indexOf("~") >= 0, "circular ref encoded with ~");
console.log("ok: stringify:", s);

var back = CJS.parse(s);
assert(back.name === "root", "round-trip name");
assert(back.self === back, "circular ref reconstructed");
console.log("ok: parse reconstructed cycle");

console.log("\ncircular-json smoke: all assertions passed");
