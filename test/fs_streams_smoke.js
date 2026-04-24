// fs.createReadStream / createWriteStream — copy-a-file round trip.

var fs = require("fs");
var path = require("path");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

var src = "/tmp/ionpower-fs-src.txt";
var dst = "/tmp/ionpower-fs-dst.txt";

// Prep: write a predictable source (~10KB of numbered lines).
var lines = [];
for (var i = 0; i < 500; ++i) lines.push("line " + i);
var payload = lines.join("\n") + "\n";
fs.writeFileSync(src, payload);

var chunks = [];
var openFired = false, endFired = false, closeFired = false;

var rs = fs.createReadStream(src, { highWaterMark: 512 });
rs.on("open",  function () { openFired = true; });
rs.on("data",  function (c) { chunks.push(c); });
rs.on("end",   function () { endFired = true; });
rs.on("close", function () { closeFired = true; });
rs.on("error", function (e) { console.error("read error:", e); process.exit(1); });

// Pipe into a writestream — classic node pattern.
var ws = fs.createWriteStream(dst);
var finishFired = false;
rs.pipe(ws);
ws.on("finish", function () { finishFired = true; });
ws.on("error",  function (e) { console.error("write error:", e); process.exit(1); });

// encoding test: read same file as utf8 strings
var utf8Chunks = [];
var rs2 = fs.createReadStream(src, { encoding: "utf8", highWaterMark: 256 });
rs2.on("data", function (s) { utf8Chunks.push(s); });

// start/end slice test
var sliced = [];
var rs3 = fs.createReadStream(src, { start: 0, end: 9 }); // 10 bytes
rs3.on("data", function (c) { sliced.push(c); });

process.on("exit", function () {
    assert(openFired, "read stream 'open'");
    assert(endFired,  "read stream 'end'");
    assert(closeFired, "read stream 'close'");
    var total = Buffer.concat(chunks);
    assert(total.length === payload.length,
           "read chunk total " + total.length + " != " + payload.length);
    assert(total.toString("utf8") === payload, "read content matches");
    console.log("ok: createReadStream (" + chunks.length + " chunks, " + total.length + " bytes)");

    assert(finishFired, "write stream 'finish'");
    var dstData = fs.readFileSync(dst).toString("utf8");
    assert(dstData === payload, "dst file matches src (" + dstData.length + " bytes)");
    console.log("ok: pipe rs -> ws (" + dstData.length + " bytes)");

    var utf8All = utf8Chunks.join("");
    assert(utf8All === payload, "utf8 encoding option");
    console.log("ok: encoding:utf8");

    var slicedBuf = Buffer.concat(sliced);
    assert(slicedBuf.length === 10, "slice length 10, got " + slicedBuf.length);
    assert(slicedBuf.toString("utf8") === payload.slice(0, 10), "slice content");
    console.log("ok: start/end slice");

    // cleanup
    try { fs.unlinkSync(src); } catch (e) {}
    try { fs.unlinkSync(dst); } catch (e) {}

    console.log("\nfs_streams smoke: all assertions passed");
});
