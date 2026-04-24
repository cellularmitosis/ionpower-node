// p-limit: bound concurrency of async tasks.
// v0.11: Promises are microtask-queued, so assertion moves to exit handler.

var pLimit = require("./vendor/p-limit.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var lim = (pLimit.default || pLimit)(2);
assert(typeof lim === "function", "limit() returns a runnable");

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

var results = null;
Promise.all(tasks).then(function (r) { results = r; });

assert(typeof lim.activeCount === "number", "activeCount");
assert(typeof lim.pendingCount === "number", "pendingCount");
console.log("ok: p-limit exposes activeCount + pendingCount");

process.on("exit", function () {
    assert(results && results.length === 5, "5 results: " + (results && results.length));
    for (var j = 0; j < 5; ++j) assert(results[j] === j, "result " + j + ": " + results[j]);
    console.log("ok: p-limit ran 5 tasks through lim(2)");
    console.log("\np-limit smoke: all assertions passed");
});
