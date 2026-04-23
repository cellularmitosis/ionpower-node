// prr: property definer wrapper (prr = PRivate PRoperty). Adds props
// with {enumerable: false, configurable: false, writable: false} by
// default — some older libs use it for "hidden" bookkeeping.

var prr = require("./vendor/prr.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var obj = {};
prr(obj, "hidden", 42);

assert(obj.hidden === 42, "value accessible");
assert(Object.keys(obj).length === 0, "not enumerable: " + JSON.stringify(Object.keys(obj)));
console.log("ok: prr single property");

// Bulk form.
var o2 = {};
prr(o2, { a: 1, b: 2, c: 3 });
assert(o2.a === 1 && o2.b === 2 && o2.c === 3, "bulk values");
assert(Object.keys(o2).length === 0, "none enumerable");
console.log("ok: prr bulk");

console.log("\nprr smoke: all assertions passed");
