// stream.Readable.from / toArray smoke.

var stream = require("stream");

function assert(c, msg) { if (!c) { console.error("FAIL:", msg); process.exit(1); } }
function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.error("FAIL:", msg, "expected", JSON.stringify(b), "got", JSON.stringify(a));
        process.exit(1);
    }
}

assert(typeof stream.Readable.from === "function", "Readable.from present");
assert(typeof stream.Readable.prototype.toArray === "function", "Readable.prototype.toArray");

// ---- from array ----
var r1 = stream.Readable.from([1, 2, 3]);
r1.toArray().then(function (out) {
    eq(out, [1, 2, 3], "from(array) -> toArray");
    console.log("ok: stream.Readable.from(array)");
}).catch(function (e) { console.error("FAIL: from(array)", e); process.exit(1); });

// ---- from string ----
var r2 = stream.Readable.from("hello");
var collected2 = [];
r2.on("data", function (c) { collected2.push(c); });
r2.on("end", function () {
    assert(collected2.length === 1 && collected2[0] === "hello", "from(string)");
    console.log("ok: stream.Readable.from(string)");
});

// ---- from Buffer ----
var b = Buffer.from([0x41, 0x42, 0x43]);
var r3 = stream.Readable.from(b);
r3.toArray().then(function (out) {
    assert(out.length === 1 && Buffer.isBuffer(out[0]) && out[0].toString("utf8") === "ABC",
           "from(Buffer)");
    console.log("ok: stream.Readable.from(Buffer)");
});

// ---- pipe through PassThrough ----
var src = stream.Readable.from(["alpha", "bravo", "charlie"]);
var pt = new stream.PassThrough({ objectMode: true });
src.pipe(pt);
pt.toArray().then(function (out) {
    eq(out, ["alpha", "bravo", "charlie"], "pipe through PassThrough");
    console.log("ok: from(array) | PassThrough -> toArray");
});

console.log("\nstream_helpers smoke: 4 async tests pending");
