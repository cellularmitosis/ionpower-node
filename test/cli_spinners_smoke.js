// cli-spinners: catalog of spinner animations. Loads the spinners.json
// sibling via require('./spinners.json') — exercises our relative
// .json resolution.

var spinners = require("./vendor/cli-spinners.js");
spinners = spinners.default || spinners;

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

assert(typeof spinners === "object", "spinners is an object");
assert(spinners.dots, "dots spinner exists");
assert(Array.isArray(spinners.dots.frames), "dots.frames is array");
assert(spinners.dots.frames.length > 0, "dots has frames");
assert(typeof spinners.dots.interval === "number", "dots.interval is number");
console.log("ok: cli-spinners.dots has", spinners.dots.frames.length, "frames");

// random-pick variant (if exposed as an array list).
var names = Object.keys(spinners);
assert(names.length > 30, "over 30 spinner styles: " + names.length);
console.log("ok: cli-spinners has", names.length, "named styles");

console.log("\ncli-spinners smoke: all assertions passed");
