// yocto-queue: O(1) linked-list queue (sindresorhus).

var Queue = require("./vendor/yocto-queue.js");
Queue = Queue.default || Queue;

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var q = new Queue();
q.enqueue(1); q.enqueue(2); q.enqueue(3);
assert(q.size === 3, "size 3");
assert(q.dequeue() === 1, "dequeue 1");
assert(q.dequeue() === 2, "dequeue 2");
assert(q.size === 1, "size 1 after 2 dequeues");
assert(q.dequeue() === 3, "dequeue 3");
assert(q.dequeue() === undefined, "empty yields undefined");
console.log("ok: FIFO");

console.log("\nyocto-queue smoke: all assertions passed");
