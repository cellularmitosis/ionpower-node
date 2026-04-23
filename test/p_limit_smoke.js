// p-limit: bound concurrency of async tasks. With no event loop,
// our Promises resolve synchronously, so the "limit" effectively
// just funnels tasks through in order — but the API shape still
// holds and that's the thing consumers depend on.

var pLimit = require("./vendor/p-limit.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

// Default export is the factory.
var lim = (pLimit.default || pLimit)(2);
assert(typeof lim === "function", "limit() returns a runnable");

// Schedule 5 tasks that each resolve synchronously.
var done = [];
var tasks = [];
for (var i = 0; i < 5; ++i) {
    (function (n) {
        tasks.push(lim(function () {
            done.push(n);
            return Promise.resolve(n);
        }));
    })(i);
}

// Under our synchronous Promise polyfill, all 5 tasks run to completion
// before Promise.all's callback fires.
Promise.all(tasks).then(function (results) {
    assert(results.length === 5, "5 results: " + results.length);
    for (var j = 0; j < 5; ++j) assert(results[j] === j, "result " + j);
    console.log("ok: p-limit ran 5 tasks through lim(2)");
});

// lim exposes activeCount + pendingCount.
assert(typeof lim.activeCount === "number", "activeCount");
assert(typeof lim.pendingCount === "number", "pendingCount");
console.log("ok: p-limit exposes activeCount + pendingCount");

console.log("\np-limit smoke: all assertions passed");
