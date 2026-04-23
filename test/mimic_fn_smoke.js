// mimic-fn: copy .name/.length/etc from one fn to another.

var mimicFn = require("./vendor/mimic-fn.js");
mimicFn = mimicFn.default || mimicFn;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

function original(a, b, c) { return a; }
var wrapper = function () { return arguments[0]; };
mimicFn(wrapper, original);
assert(wrapper.length === original.length, "length: " + wrapper.length + " vs " + original.length);
assert(wrapper.name === "original", "name mimicked: " + wrapper.name);
console.log("ok: mimic-fn");

console.log("\nmimic-fn smoke: all assertions passed");
