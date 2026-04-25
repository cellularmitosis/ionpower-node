// fs.watch / watchFile + wave 12 libs smoke.

var fs = require("fs");
var path = require("path");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}
function unwrap(m) { return (m && m.default) || m; }

// ---- fs.watch shape ----
assert(typeof fs.watch === "function", "fs.watch is a function");
assert(typeof fs.FSWatcher === "function", "fs.FSWatcher ctor");
assert(typeof fs.watchFile === "function", "fs.watchFile");
assert(typeof fs.unwatchFile === "function", "fs.unwatchFile");

// ---- Watch + change roundtrip ----
// Tiger HFS+ stores mtime at 1-second granularity, so if the "initial"
// write and the "mutate" write land in the same wall-clock second, only
// the size change will trigger 'change'. Writing progressively longer
// strings guarantees a size delta on every mutation.
var tmpPath = "/tmp/ionpower_watch_test_" + process.pid + ".txt";
try { fs.unlinkSync(tmpPath); } catch (e) {}
fs.writeFileSync(tmpPath, "initial");

var fired = [];
var w = fs.watch(tmpPath, { interval: 50 }, function (ev, name) {
    fired.push(ev);
});

// Three progressively larger writes over a total ~900ms.
setTimeout(function () { fs.writeFileSync(tmpPath, "initialAA"); },       100);
setTimeout(function () { fs.writeFileSync(tmpPath, "initialAABBBB"); },   300);
setTimeout(function () { fs.writeFileSync(tmpPath, "initialAABBBBCCCCCC"); }, 600);

setTimeout(function () {
    w.close();
    try { fs.unlinkSync(tmpPath); } catch (e) {}
    assert(fired.length >= 1, "fs.watch detected at least 1 change (got " + fired.length + ")");
    assert(fired.indexOf("change") >= 0, "'change' event fired");
    console.log("ok: fs.watch change event (" + fired.length + " events observed)");
    console.log("\nfs_watch smoke: all assertions passed");
}, 1200);

// ---- lowercase-keys ----
try {
    var lck = unwrap(require("./vendor/lowercase-keys.js"));
    assert(typeof lck === "function", "lowercase-keys is function");
    eq(lck({ ABC: 1, Foo: 2 }), { abc: 1, foo: 2 }, "lowercase-keys");
    console.log("ok: lowercase-keys");
} catch (e) { console.log("skip: lowercase-keys (" + e.message + ")"); }

// ---- string-natural-compare ----
try {
    var natcmp = unwrap(require("./vendor/string-natural-compare.js"));
    assert(typeof natcmp === "function", "natural-compare is function");
    var arr = ["a2", "a10", "a1"];
    arr.sort(natcmp);
    eq(arr, ["a1", "a2", "a10"], "natural-compare sort");
    console.log("ok: string-natural-compare");
} catch (e) { console.log("skip: string-natural-compare (" + e.message + ")"); }

// ---- to-regex-range ----
try {
    var torg = unwrap(require("./vendor/to-regex-range.js"));
    assert(typeof torg === "function", "to-regex-range is function");
    var re = torg(1, 9);
    // torg produces a pattern. Wrap in new RegExp to test
    assert(typeof re === "string" && re.length > 0, "to-regex-range returns string");
    var rx = new RegExp("^(?:" + re + ")$");
    assert(rx.test("5"), "5 matches 1-9");
    assert(!rx.test("10"), "10 does not match 1-9");
    console.log("ok: to-regex-range");
} catch (e) { console.log("skip: to-regex-range (" + e.message + ")"); }

// ---- fill-range ----
try {
    var fr = unwrap(require("./vendor/fill-range.js"));
    assert(typeof fr === "function", "fill-range is function");
    // Upstream version returns numbers by default (older shapes returned strings).
    var out = fr(1, 5);
    assert(Array.isArray(out) && out.length === 5, "fill-range 1-5 length");
    assert(out[0] == 1 && out[4] == 5, "fill-range 1-5 endpoints");
    console.log("ok: fill-range");
} catch (e) { console.log("skip: fill-range (" + e.message + ")"); }
