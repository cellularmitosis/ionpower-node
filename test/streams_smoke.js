// streams: real Readable/Writable/Transform/PassThrough, replaces
// the previous pass-through stub.

var stream = require("stream");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }

// --- Writable ---------------------------------------------------------
var chunks = [];
var w = new stream.Writable({
    write: function (chunk, enc, cb) { chunks.push(String(chunk)); cb(); }
});
var finished = false;
w.on("finish", function () { finished = true; });
w.write("hello ");
w.write("world");
w.end();
assert(chunks.length === 2, "2 chunks");
assert(chunks.join("") === "hello world", "chunks: " + chunks);
assert(finished, "'finish' fired");
console.log("ok: Writable (write + write + end + finish)");

// --- Readable ---------------------------------------------------------
var source = ["a", "b", "c", null];
var srcIdx = 0;
var r = new stream.Readable({
    read: function () { this.push(source[srcIdx++]); }
});
var out = [];
var ended = false;
r.on("end", function () { ended = true; });
r.on("data", function (c) { out.push(String(c)); });
assert(out.join("") === "abc", "readable emitted a,b,c");
assert(ended, "'end' fired");
console.log("ok: Readable (push chain + 'data' + 'end')");

// --- Transform --------------------------------------------------------
var t = new stream.Transform({
    transform: function (chunk, enc, cb) { cb(null, String(chunk).toUpperCase()); }
});
var upper = [];
t.on("data", function (c) { upper.push(String(c)); });
t.write("foo");
t.write("bar");
t.end();
assert(upper.join("") === "FOOBAR", "transform -> upper");
console.log("ok: Transform (uppercase)");

// --- PassThrough ------------------------------------------------------
var pt = new stream.PassThrough();
var ptOut = [];
pt.on("data", function (c) { ptOut.push(String(c)); });
pt.write("x"); pt.write("y"); pt.end();
assert(ptOut.join("") === "xy", "pt");
console.log("ok: PassThrough");

// --- pipe chain: Readable -> Transform -> Writable -------------------
var srcData = ["alpha", "beta", "gamma", null];
var srcIdx2 = 0;
var src2 = new stream.Readable({
    read: function () { this.push(srcData[srcIdx2++]); }
});
var collected = [];
var dst = new stream.Writable({
    write: function (chunk, enc, cb) { collected.push(String(chunk)); cb(); }
});
src2.pipe(new stream.PassThrough()).pipe(dst);
assert(collected.join("|") === "alpha|beta|gamma", "piped: " + collected);
console.log("ok: pipe (Readable -> PassThrough -> Writable)");

// --- stream.pipeline / stream.finished -------------------------------
assert(typeof stream.pipeline === "function", "pipeline exists");
assert(typeof stream.finished === "function", "finished exists");
console.log("ok: stream.pipeline + stream.finished");

console.log("\nstreams smoke: all assertions passed");
