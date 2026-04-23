// heap: a classic binary heap.

var Heap = require("./vendor/heap.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var h = new Heap();
[5, 3, 8, 1, 9, 2].forEach(function (x) { h.push(x); });

var out = [];
while (h.size() > 0) out.push(h.pop());
assert(JSON.stringify(out) === JSON.stringify([1, 2, 3, 5, 8, 9]),
       "sorted: " + out);
console.log("ok: min-heap sorts");

// Max heap via custom comparator.
var mx = new Heap(function (a, b) { return b - a; });
[5, 3, 8, 1, 9, 2].forEach(function (x) { mx.push(x); });
var mxout = [];
while (mx.size() > 0) mxout.push(mx.pop());
assert(JSON.stringify(mxout) === JSON.stringify([9, 8, 5, 3, 2, 1]),
       "max sorted: " + mxout);
console.log("ok: max-heap via comparator");

console.log("\nheap smoke: all assertions passed");
