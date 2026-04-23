// mnemonist/set: set theory helpers over ES6 Set.

var setops = require("./vendor/mnemonist-set.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var A = new Set([1, 2, 3, 4]);
var B = new Set([3, 4, 5, 6]);

// union
var U = setops.union(A, B);
assert(U.size === 6, "union size=6; got " + U.size);
assert(U.has(1) && U.has(6), "union contents");
console.log("ok: mnemonist/set.union");

// intersection
var I = setops.intersection(A, B);
assert(I.size === 2, "intersection size=2; got " + I.size);
assert(I.has(3) && I.has(4), "intersection contents");
console.log("ok: mnemonist/set.intersection");

// difference
var D = setops.difference(A, B);
assert(D.size === 2, "difference size=2; got " + D.size);
assert(D.has(1) && D.has(2), "difference contents");
console.log("ok: mnemonist/set.difference");

// Jaccard similarity (via intersectionSize / unionSize).
assert(typeof setops.jaccard === "function", "jaccard defined");
var j = setops.jaccard(A, B);
assert(j === 2/6, "jaccard A,B = 2/6; got " + j);
console.log("ok: mnemonist/set.jaccard");

console.log("\nmnemonist_set smoke: all assertions passed");
