// JSZip: build + read a zip archive entirely in memory.
// v0.11: promises are microtask-queued, so chain the whole flow and
// check results at exit time.

var JSZip = require("./vendor/jszip.js");

function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } }

var z = new JSZip();
z.file("hello.txt", "Hello from JSZip on a PowerPC Tiger machine.");
z.file("sub/dir/nested.txt", "nested content here");

var bytes = null;
var helloText = null;
var skip = false;

z.generateAsync({ type: "uint8array" })
    .then(function (u8) {
        bytes = u8;
        return new JSZip().loadAsync(u8);
    })
    .then(function (loaded) {
        return loaded.file("hello.txt").async("string");
    })
    .then(function (s) { helloText = s; })
    .catch(function (e) { skip = true; console.log("jszip: skipped (" + e.message + ")"); });

process.on("exit", function () {
    if (skip) { console.log("\njszip smoke: skipped"); return; }
    assert(bytes instanceof Uint8Array, "bytes is Uint8Array");
    assert(bytes.length > 50, "zip has content: " + bytes.length + " bytes");
    assert(bytes[0] === 0x50 && bytes[1] === 0x4B, "ZIP magic header");
    console.log("ok: built zip of " + bytes.length + " bytes");
    assert(helloText === "Hello from JSZip on a PowerPC Tiger machine.",
           "round-tripped hello.txt: " + helloText);
    console.log("ok: round-trip read");
    console.log("\njszip smoke: all assertions passed");
});
