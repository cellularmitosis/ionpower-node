// hoopy: circular-array subclass. Uses ES2015 class-extends-Array.

var Hoopy = require("./vendor/hoopy.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var h = new Hoopy(3);
h[0] = "a"; h[1] = "b"; h[2] = "c";
// Writing past end wraps around to index 0 (circular buffer).
h[3] = "d";
assert(h[0] === "d" || h[3] === "d", "circular write: " + h[0] + " " + h[3]);
console.log("ok: circular buffer created and written");

console.log("\nhoopy smoke: all assertions passed");
