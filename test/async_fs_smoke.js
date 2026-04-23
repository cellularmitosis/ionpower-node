// Async fs: wraps the sync versions, fires (err, val) cbs via the
// timer queue. Unlocks libraries written against the async API.

var fs = require("fs");
var path = require("path");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var tmpPath = "/tmp/ionpower-async-fs-" + Date.now() + ".txt";
var content = "hello async fs!\n";

// writeFile + readFile round-trip.
var writeDone = false;
fs.writeFile(tmpPath, content, function (err) {
    assert(!err, "writeFile cb err: " + err);
    writeDone = true;
    fs.readFile(tmpPath, "utf8", function (err, data) {
        assert(!err, "readFile cb err: " + err);
        assert(data === content, "round-trip: " + JSON.stringify(data));
        console.log("ok: async fs writeFile -> readFile");
        fs.unlink(tmpPath, function (err) {
            assert(!err, "unlink err: " + err);
            console.log("ok: async fs unlink");
        });
    });
});

// stat on a known-existing file.
fs.stat(__filename, function (err, st) {
    if (err) { console.error("FAIL: stat __filename:", err); process.exit(1); }
    assert(typeof st.size === "number", "stat has size");
    console.log("ok: async fs stat");
});

// access with callback.
fs.access("/tmp", function (err) {
    assert(!err, "/tmp should be accessible: " + err);
    console.log("ok: async fs access /tmp");
});

// exists (legacy).
fs.exists("/tmp", function (yes) {
    assert(yes === true, "/tmp exists");
    console.log("ok: async fs exists /tmp");
});

// fs.promises.
var promisesOk = false;
fs.promises.readFile(__filename, "utf8")
    .then(function (data) {
        assert(data.length > 0, "promises.readFile non-empty");
        promisesOk = true;
        console.log("ok: fs.promises.readFile");
    })
    .catch(function (e) { console.error("FAIL: fs.promises.readFile:", e); process.exit(1); });

// fs.constants.
assert(fs.constants.F_OK === 0, "F_OK=0");
assert(fs.constants.R_OK === 4, "R_OK=4");
console.log("ok: fs.constants");

// Verify that at exit, the async operations completed.
process.on("exit", function () {
    assert(writeDone, "writeFile completed");
    assert(promisesOk, "promises completed");
    console.log("\nasync_fs smoke: all assertions passed");
});
