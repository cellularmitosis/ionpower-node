// worker_threads round-trip smoke. Spawns a child node process per
// Worker, talks via length-prefixed JSON frames over stdin/stdout.

var fs = require("fs");
var path = require("path");
var worker_threads = require("worker_threads");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

// In the main thread we have isMainThread true.
assert(worker_threads.isMainThread === true, "main thread isMainThread");
assert(worker_threads.parentPort === null, "main parentPort null");
assert(typeof worker_threads.Worker === "function", "Worker ctor");

// Write a worker script that echoes incoming messages doubled.
var workerSrc = "var w = require('worker_threads');\n" +
    "var n = 0;\n" +
    "w.parentPort.on('message', function (m) {\n" +
    "  n++;\n" +
    "  if (m === 'echo-data') { w.parentPort.postMessage({ data: w.workerData, n: n }); return; }\n" +
    "  if (m && typeof m.x === 'number') { w.parentPort.postMessage({ doubled: m.x * 2, n: n }); return; }\n" +
    "  if (m === 'bye') { w.parentPort.close(); return; }\n" +
    "  w.parentPort.postMessage({ unknown: m, n: n });\n" +
    "});\n";
var tmpScript = "/tmp/ion_worker_" + process.pid + ".js";
fs.writeFileSync(tmpScript, workerSrc);

var got = [];
var done = false;
function finish(err) {
    if (done) return;
    done = true;
    try { fs.unlinkSync(tmpScript); } catch (e) {}
    if (err) { console.error("FAIL:", err.message || err); process.exit(1); }
    eq(got.length, 3, "received 3 messages");
    eq(got[0].doubled, 84, "first message doubled (42 -> 84)");
    assert(got[1].data && got[1].data.greeting === "hi", "workerData echoed");
    eq(got[2].doubled, 200, "third message doubled (100 -> 200)");
    console.log("ok: Worker round-trip postMessage");
    console.log("\nworker_threads smoke: all assertions passed");
}

var watchdog = setTimeout(function () {
    finish(new Error("worker_threads smoke timed out after 8s"));
}, 8000);

var w = new worker_threads.Worker(tmpScript, {
    workerData: { greeting: "hi", count: 7 }
});

w.on("message", function (m) {
    got.push(m);
    if (got.length === 3) {
        w.postMessage("bye");
    }
});

w.on("exit", function (code) {
    clearTimeout(watchdog);
    setImmediate(finish);
});

w.on("error", function (err) {
    clearTimeout(watchdog);
    finish(err);
});

w.postMessage({ x: 42 });
w.postMessage("echo-data");
w.postMessage({ x: 100 });
