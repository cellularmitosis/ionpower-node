// tiny-queue: minimal FIFO queue implementation.

var Queue = require("./vendor/tiny-queue.js");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var q = new Queue();
q.push(1); q.push(2); q.push(3);
assert(q.length === 3, "length=3; got " + q.length);
assert(q.shift() === 1, "shift 1");
assert(q.shift() === 2, "shift 2");
assert(q.length === 1, "length=1 after 2 shifts");
assert(q.shift() === 3, "shift 3");
assert(q.shift() === undefined, "empty yields undefined");
console.log("ok: tiny-queue FIFO");

console.log("\ntiny-queue smoke: all assertions passed");
