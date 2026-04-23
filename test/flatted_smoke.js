// flatted: successor to circular-json from the same author.

var flatted = require("./vendor/flatted.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var o = { name: "root" };
o.self = o;
o.arr = [1, 2, o];

var s = flatted.stringify(o);
assert(typeof s === "string", "stringify");
console.log("ok: stringify:", s);

var back = flatted.parse(s);
assert(back.name === "root", "name round-trip");
assert(back.self === back, "self circular");
assert(back.arr[2] === back, "arr[2] circular");
console.log("ok: parse reconstructed nested cycles");

console.log("\nflatted smoke: all assertions passed");
